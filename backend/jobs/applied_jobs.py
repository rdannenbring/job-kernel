"""Background sweeper for Applied-stage notifications.

Owner task: T14.

Two responsibilities combined in one 10-minute loop:

1. **Overdue follow-up:** notify the user once when an application's
   follow-up plan is 7+ days past its ``due_at`` with no send-log
   (the plan's status is still ``scheduled`` or ``overdue``).
2. **SLA milestones:** notify the user once when an application
   crosses each SLA milestone (7 / 14 / 21 days elapsed since the
   baseline computed by ``derivations.compute_sla``).

Idempotency is delegated to ``application_events``: before creating
each notification, the sweeper checks for a marker event of the
matching ``event_type`` (e.g. ``sla_milestone_7d_notification_sent``)
and skips when one already exists. The marker is written alongside
the notification so repeated sweeper ticks are safe.

The thread runs at 10-minute cadence to mirror the existing
``run_maintenance_loop`` pattern (``main.py:171``).
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, cast

from sqlalchemy.orm import Session

from services.applied.derivations import compute_sla
from services.database_service import (
    Application,
    ApplicationEvent,
    DatabaseService,
)


# ─── Constants ──────────────────────────────────────────────────────────────


# Grace period before the overdue notification fires.
OVERDUE_GRACE_DAYS = 7

# SLA thresholds (days elapsed since baseline). Must match
# ``derivations.compute_sla`` so labels stay in sync.
SLA_MILESTONES: tuple[int, ...] = (7, 14, 21)

# Sleep between sweeper ticks. 10 min matches run_maintenance_loop.
SWEEP_INTERVAL_SECONDS = 600

# Initial delay so the server finishes booting before the first sweep.
STARTUP_DELAY_SECONDS = 10


# ─── Small parsing helpers (duplicated from services.applied to keep this
#     module DB-independent for unit testing). ────────────────────────────


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


def _parse_iso(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _has_marker_event(session: Session, app_id: int, event_type: str) -> bool:
    """Idempotency check: has the sweeper already emitted this marker?"""
    return (
        session.query(ApplicationEvent)
        .filter(
            ApplicationEvent.application_id == app_id,
            ApplicationEvent.event_type == event_type,
        )
        .first()
        is not None
    )


def _emit_marker_and_notification(
    session: Session,
    db: DatabaseService,
    app: Application,
    *,
    event_type: str,
    notif_title: str,
    notif_message: str,
    category: str,
    link_anchor: str,
) -> None:
    """Write the marker event, commit, then create the notification.

    The two-step commit ordering matters: ``create_notification`` opens
    its own internal session (legacy helper convention), so the outer
    marker write must be committed first or SQLite/Postgres will see
    overlapping transactions. The marker-then-commit-then-notify order
    also gives the right recovery semantics: if ``create_notification``
    fails after the marker is persisted, the next sweep skips this row
    (one-shot delivery, never duplicates the audit event).
    """
    # SQLAlchemy Column descriptors type as ``Column[int]`` when ``app``
    # is an explicit ``Application`` parameter (vs. locally inferred from
    # ``session.get``); the runtime values are plain ints. Cast at the
    # boundary to satisfy strict mypy without changing behavior.
    app_id_int = cast(int, app.id)
    user_id_int = cast(int, app.user_id)
    db._log_event(  # noqa: SLF001 — existing event helper
        app_id_int, event_type, "Sweeper notification", session=session
    )
    session.commit()  # release the lock + persist the marker before notify
    db.create_notification(
        user_id=user_id_int,
        title=notif_title,
        message=notif_message,
        category=category,
        link_screen="lifecycle",
        link_app_id=app_id_int,
        link_anchor=link_anchor,
    )


# ─── Per-row processors ─────────────────────────────────────────────────────


def _process_overdue_follow_up(
    session: Session,
    db: DatabaseService,
    app: Application,
    now: datetime,
) -> None:
    """Notify once when the plan is 7+ days past due_at with no send-log."""
    plan = _load_json(app.follow_up_plan_json)
    if plan is None:
        return
    if plan.get("status") == "completed":
        return  # send-log recorded; no notification needed

    due_at = _parse_iso(plan.get("due_at"))
    if due_at is None:
        return
    if due_at + timedelta(days=OVERDUE_GRACE_DAYS) > now:
        return  # not severely overdue yet

    event_type = "overdue_follow_up_notification_sent"
    if _has_marker_event(session, cast(int, app.id), event_type):
        return

    company = app.company or "this company"
    role = app.job_title or "your role"
    _emit_marker_and_notification(
        session,
        db,
        app,
        event_type=event_type,
        notif_title=f"Follow-up overdue for {company}",
        notif_message=(
            f"Your follow-up for {role} at {company} is {OVERDUE_GRACE_DAYS}+ "
            f"days past due. Consider sending a follow-up message."
        ),
        category="warning",
        link_anchor="applied/follow_up_due",
    )


def _process_sla_milestones(
    session: Session,
    db: DatabaseService,
    app: Application,
    _now: datetime,
) -> None:
    """For each crossed SLA threshold, notify once per (app, milestone)."""
    sla = compute_sla(app)
    if sla is None:
        return  # no baseline (D6)

    days_elapsed = int(sla.get("days_elapsed", 0))
    for milestone in SLA_MILESTONES:
        if days_elapsed < milestone:
            continue  # threshold not yet reached
        event_type = f"sla_milestone_{milestone}d_notification_sent"
        if _has_marker_event(session, cast(int, app.id), event_type):
            continue  # already notified for this milestone

        company = app.company or "this company"
        category = "info" if milestone == SLA_MILESTONES[0] else "warning"
        _emit_marker_and_notification(
            session,
            db,
            app,
            event_type=event_type,
            notif_title=f"{milestone} days since application to {company}",
            notif_message=(
                f"It has been {milestone} days since your submission was "
                f"recorded. Review the SLA tracker for the recommended next step."
            ),
            category=category,
            link_anchor="applied/confirmed",
        )


# ─── Sweep entry points ─────────────────────────────────────────────────────


def sweep_once(session: Session, db: DatabaseService) -> dict[str, int]:
    """Run one sweep pass. Returns a counters dict for tests/logging.

    Walks every Applied-stage row, processes overdue and SLA cases,
    commits once at the end. Rows without ``user_id`` (legacy data)
    are skipped because the notifications table requires user ownership.
    """
    counters = {"rows": 0, "skipped_no_user": 0, "errors": 0}
    now = datetime.now(timezone.utc)
    rows = (
        session.query(Application)
        .filter(Application.pipeline_stage == "applied")
        .all()
    )
    for app in rows:
        counters["rows"] += 1
        if app.user_id is None:
            counters["skipped_no_user"] += 1
            continue
        try:
            _process_overdue_follow_up(session, db, app, now)
            _process_sla_milestones(session, db, app, now)
        except Exception as exc:  # noqa: BLE001 — sweeper must not die
            counters["errors"] += 1
            print(f"APPLIED_SWEEPER: error on app_id={app.id}: {exc}")
    session.commit()
    return counters


def run_applied_sweeper_loop() -> None:
    """Daemon-thread entry point.

    Mirrors ``run_maintenance_loop`` (main.py:171): tolerate transient
    failures, sleep ``SWEEP_INTERVAL_SECONDS`` between ticks, never exit.
    """
    time.sleep(STARTUP_DELAY_SECONDS)
    print("APPLIED_SWEEPER: background scheduler started.")
    while True:
        try:
            # Local import keeps this module free of a hard load-time
            # dependency on ``main``.
            from main import database_service

            session = database_service.Session()
            try:
                counters = sweep_once(session, database_service)
                if counters["rows"]:
                    print(f"APPLIED_SWEEPER: tick counters={counters}")
            finally:
                session.close()
        except Exception as exc:  # noqa: BLE001 — never die
            print(f"APPLIED_SWEEPER ERROR: {exc}")
        time.sleep(SWEEP_INTERVAL_SECONDS)
