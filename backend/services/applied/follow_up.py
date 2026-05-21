"""Follow-up plan + send-log service.

Owner task: T3e.

Decision references:
- D4: ``follow_up_plan_json.status`` caches ``scheduled`` /
  ``overdue`` / ``completed``; T14's sweeper and reads recompute it.
- D5: both writers call ``derivations.recompute_substage_cache``.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from models.applied_models import (  # type: ignore[import-not-found]
    FollowUpPlanIn,
    FollowUpSentIn,
)
from services.applied import derivations  # type: ignore[import-not-found]
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    DatabaseService,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Any) -> datetime | None:
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
    return parsed.astimezone(timezone.utc)


def _load_json(blob: Any) -> dict[str, Any] | None:
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


def _derive_due_at(app: Application) -> datetime:
    """Default due_at when payload omits one (PRD section 5)."""
    confirmation = _load_json(app.confirmation_record_json)
    if confirmation is not None:
        confirmed_at = _parse_iso(confirmation.get("confirmed_at"))
        if confirmed_at is not None:
            return confirmed_at + timedelta(days=7)
    submission = _load_json(app.submission_record_json)
    if submission is not None:
        applied_at = _parse_iso(submission.get("applied_at"))
        if applied_at is not None:
            return applied_at + timedelta(days=5)
    raise ValueError("cannot derive due_at; no submission record")


def _plan_status(due_at: datetime, completed_at: datetime | None) -> tuple[str, int]:
    """Return (status, overdue_days). D4 caches this; reads recompute."""
    if completed_at is not None:
        return "completed", 0
    now = _now()
    if due_at <= now:
        return "overdue", max(0, (now - due_at).days)
    return "scheduled", 0


def save_follow_up_plan(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Create or update follow_up_plan_json."""
    validated = FollowUpPlanIn.model_validate(payload)

    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    existing = _load_json(app.follow_up_plan_json) or {}
    existing_completed_at = _parse_iso(existing.get("completed_at"))

    due_at: datetime
    if validated.due_at is not None:
        due_at = validated.due_at.astimezone(timezone.utc)
    else:
        due_at = _derive_due_at(app)

    last_contact_at = (
        validated.last_contact_at.astimezone(timezone.utc)
        if validated.last_contact_at is not None
        else _parse_iso(existing.get("last_contact_at"))
    )
    days_since_last_contact: int | None = None
    if last_contact_at is not None:
        days_since_last_contact = max(0, (_now() - last_contact_at).days)

    status, overdue_days = _plan_status(due_at, existing_completed_at)

    plan = {
        "due_at": due_at.isoformat(),
        "status": status,
        "recommended_template_id": validated.recommended_template_id
        or existing.get("recommended_template_id"),
        "last_contact_at": last_contact_at.isoformat() if last_contact_at is not None else None,
        "days_since_last_contact": days_since_last_contact,
        "overdue_days": overdue_days,
        "completed_at": existing_completed_at.isoformat() if existing_completed_at else None,
    }
    app.follow_up_plan_json = json.dumps(plan)

    DatabaseService()._log_event(  # noqa: SLF001
        app.id, "follow_up_plan_saved", f"Follow-up plan due {plan['due_at']}", session=session
    )

    new_substage = derivations.recompute_substage_cache(session, app.id)
    return {
        "ok": True,
        "applied_substage": new_substage,
        "follow_up_plan": plan,
    }


def mark_follow_up_sent(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Mark the existing plan completed and emit follow_up_sent."""
    validated = FollowUpSentIn.model_validate(payload)
    sent_at = validated.sent_at.astimezone(timezone.utc)

    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    submission = _load_json(app.submission_record_json)
    if submission is None:
        raise ValueError("no follow-up plan to mark sent")
    applied_at = _parse_iso(submission.get("applied_at"))
    if applied_at is not None and sent_at < applied_at:
        raise ValueError("sent_at cannot precede submission")

    plan = _load_json(app.follow_up_plan_json)
    if plan is None:
        raise ValueError("no follow-up plan to mark sent")

    plan["status"] = "completed"
    plan["completed_at"] = sent_at.isoformat()
    plan["overdue_days"] = 0
    app.follow_up_plan_json = json.dumps(plan)

    DatabaseService()._log_event(  # noqa: SLF001
        app.id,
        "follow_up_sent",
        f"Follow-up sent via {validated.channel or 'unspecified'}",
        session=session,
    )

    new_substage = derivations.recompute_substage_cache(session, app.id)
    return {
        "ok": True,
        "applied_substage": new_substage or "follow_up_sent",
        "follow_up_plan": plan,
    }
