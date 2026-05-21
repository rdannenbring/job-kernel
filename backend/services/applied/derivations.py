"""Derivations: pure functions over an Application row.

Owner task: T3a. The four ``compute_*`` / ``determine_*`` functions are
strictly pure -- they accept a row-like object plus optional eagerly-loaded
relationships and return a value. They MUST NOT open a database session
so they can be reused in tests, route handlers, and the background
sweeper (T14) without setup ceremony.

``recompute_substage_cache`` is the only DB-touching function in this
module: it composes the pure ``determine_applied_substage`` with a single
targeted write, and is called at the end of every Applied write path per
decision D5.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy.orm import Session

# ─── Helpers ────────────────────────────────────────────────────────────────


def _attr(row: Any, name: str, default: Any = None) -> Any:
    """Read ``name`` from row that may be a SQLAlchemy instance or a dict-like."""
    if row is None:
        return default
    if isinstance(row, dict):
        return row.get(name, default)
    return getattr(row, name, default)


def _load_json(blob: Any) -> dict[str, Any] | None:
    """Parse a JSON-as-Text column into a dict; return None on null/blank/bad."""
    if blob is None:
        return None
    if isinstance(blob, dict):
        return blob
    if not isinstance(blob, str) or not blob.strip():
        return None
    try:
        parsed = json.loads(blob)
    except (ValueError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _parse_iso(value: Any) -> datetime | None:
    """Parse an ISO-8601 timestamp into a UTC-aware datetime; return None on failure."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _now() -> datetime:
    """Indirection point for tests; production always returns UTC now."""
    return datetime.now(timezone.utc)


# ─── Substage derivation ────────────────────────────────────────────────────


def _has_follow_up_sent_event(events: Iterable[Any] | None) -> bool:
    if events is None:
        return False
    for ev in events:
        if _attr(ev, "event_type") == "follow_up_sent":
            return True
    return False


def determine_applied_substage(
    app_row: Any,
    events: Iterable[Any] | None = None,
) -> str | None:
    """Return the current Applied substage per the PRD priority order.

    Priority: ``follow_up_sent`` > ``follow_up_due`` > ``confirmed`` > ``submitted``.
    Returns ``None`` if no Applied predicate holds.

    ``events`` is optional. When omitted, the ``follow_up_sent`` predicate
    falls back to ``follow_up_plan_json.status == 'completed'`` -- which is
    correct because writer modules always set the status alongside emitting
    the event.
    """
    plan = _load_json(_attr(app_row, "follow_up_plan_json"))
    if _has_follow_up_sent_event(events) or (plan is not None and plan.get("status") == "completed"):
        return "follow_up_sent"

    if plan is not None:
        due_at = _parse_iso(plan.get("due_at"))
        if due_at is not None and due_at <= _now():
            return "follow_up_due"

    if _load_json(_attr(app_row, "confirmation_record_json")) is not None:
        return "confirmed"

    if _load_json(_attr(app_row, "submission_record_json")) is not None:
        return "submitted"

    return None


# ─── Completion ─────────────────────────────────────────────────────────────


def compute_completion(app_row: Any) -> dict[str, Any]:
    """Return Applied-stage completion view with 25/25/25/25 weights."""
    plan = _load_json(_attr(app_row, "follow_up_plan_json"))
    submission_done = _load_json(_attr(app_row, "submission_record_json")) is not None
    confirmation_done = _load_json(_attr(app_row, "confirmation_record_json")) is not None

    follow_up_due_done = False
    follow_up_sent_done = False
    if plan is not None:
        if plan.get("status") == "completed" or plan.get("completed_at") is not None:
            follow_up_sent_done = True
            follow_up_due_done = True
        else:
            due_at = _parse_iso(plan.get("due_at"))
            if due_at is not None and due_at <= _now():
                follow_up_due_done = True

    substages = [
        {"id": "submitted", "complete": submission_done},
        {"id": "confirmed", "complete": confirmation_done},
        {"id": "follow_up_due", "complete": follow_up_due_done},
        {"id": "follow_up_sent", "complete": follow_up_sent_done},
    ]
    done = sum(1 for s in substages if s["complete"])
    percentage = int(round(done * 25))
    return {"percentage": percentage, "substages": substages}


# ─── SLA ────────────────────────────────────────────────────────────────────


_SLA_MILESTONES: tuple[tuple[int, str], ...] = (
    (7, "standard_window"),
    (14, "aging_alert"),
    (21, "escalation_threshold"),
)


def _sla_state(days_elapsed: int) -> tuple[str, str, str]:
    """Return (current_state, alert_level, next_recommended_action) for elapsed days."""
    if days_elapsed < 7:
        return "within_window", "none", "wait"
    if days_elapsed < 14:
        return "awaiting_response", "low", "prepare_follow_up"
    if days_elapsed < 21:
        return "stale", "medium", "send_follow_up"
    return "critical", "high", "escalate"


def _baseline_for_sla(app_row: Any) -> datetime | None:
    confirmation = _load_json(_attr(app_row, "confirmation_record_json"))
    if confirmation is not None:
        baseline = _parse_iso(confirmation.get("confirmed_at"))
        if baseline is not None:
            return baseline
    submission = _load_json(_attr(app_row, "submission_record_json"))
    if submission is not None:
        return _parse_iso(submission.get("applied_at"))
    return None


def compute_sla(app_row: Any) -> dict[str, Any] | None:
    """Compute the SLA tracker, or ``None`` if no baseline exists (D6)."""
    baseline = _baseline_for_sla(app_row)
    if baseline is None:
        return None

    now = _now()
    days_elapsed = max(0, math.floor((now - baseline).total_seconds() / 86400))
    milestones: list[dict[str, Any]] = []
    for days, label in _SLA_MILESTONES:
        reached_at = baseline + timedelta(days=days)
        reached = reached_at <= now
        milestones.append(
            {
                "days": days,
                "label": label,
                "reached": reached,
                "reached_at": reached_at.isoformat() if reached else None,
            }
        )

    state, alert_level, action = _sla_state(days_elapsed)
    return {
        "baseline_date": baseline.isoformat(),
        "days_elapsed": days_elapsed,
        "milestones": milestones,
        "current_state": state,
        "alert_level": alert_level,
        "next_recommended_action": action,
    }


# ─── Next steps ─────────────────────────────────────────────────────────────


def compute_next_steps(
    app_row: Any,
    contacts: Iterable[Any] | None = None,
    events: Iterable[Any] | None = None,
) -> dict[str, Any]:
    """Return readiness assessment for the Move to Interviewing action."""
    substage = determine_applied_substage(app_row, events=events)
    sla = compute_sla(app_row)
    days_elapsed = sla["days_elapsed"] if sla is not None else 0

    has_contact = bool(contacts) if contacts is not None else False
    follow_up_sent = substage == "follow_up_sent"
    response_window_met = days_elapsed >= 7
    # Placeholder for future blocker signals (e.g. unresolved review tasks).
    no_unresolved_blockers = True

    signals = {
        "follow_up_sent": follow_up_sent,
        "contact_exists": has_contact,
        "response_window_met": response_window_met,
        "no_unresolved_blockers": no_unresolved_blockers,
    }
    reasons_met = [name for name, ok in signals.items() if ok]
    blockers = [name for name, ok in signals.items() if not ok]
    readiness_score = int(round(len(reasons_met) / len(signals) * 100))
    can_transition = not blockers

    if can_transition:
        recommended_action = "transition_to_interviewing"
    elif not follow_up_sent and response_window_met:
        recommended_action = "send_follow_up"
    elif not has_contact:
        recommended_action = "add_contact"
    else:
        recommended_action = "wait_for_response"

    return {
        "can_transition": can_transition,
        "readiness_score": readiness_score,
        "reasons_met": reasons_met,
        "blockers": blockers,
        "recommended_action": recommended_action,
    }


# ─── Cache refresh (D5) ─────────────────────────────────────────────────────


def recompute_substage_cache(session: Session, app_id: int) -> str | None:
    """Recompute the substage from the row's current state and persist
    onto ``applications.applied_substage``. Returns the new value.

    Does not commit; the caller owns the transaction boundary per the
    Applied service-layer convention.
    """
    # Imported lazily to avoid a hard import-time dependency on
    # ``services.database_service`` for non-DB callers of this module.
    # ``services.*`` is the runtime import style (uvicorn cwd is ``backend/``);
    # mypy run from repo root can't resolve it, so we silence that here only.
    from services.database_service import Application  # type: ignore[import-not-found]

    app = session.get(Application, app_id)
    if app is None:
        return None

    new_substage = determine_applied_substage(app, events=getattr(app, "events", None))
    if new_substage != app.applied_substage:
        app.applied_substage = new_substage
        session.flush()
    return new_substage
