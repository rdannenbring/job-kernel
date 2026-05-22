"""T19e: sweeper idempotency tests for jobs.applied_jobs.sweep_once.

The sweeper must never duplicate notifications for the same
(application, threshold) pair across ticks; marker events in
``application_events`` are the idempotency anchor.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import cast

import pytest

from jobs.applied_jobs import sweep_once
from services.database_service import ApplicationEvent, Notification
from tests.applied.conftest import make_app


def _iso(delta_days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


def _count_events(session, app_id: int, event_type: str) -> int:
    return cast(int, (
        session.query(ApplicationEvent)
        .filter_by(application_id=app_id, event_type=event_type)
        .count()
    ))


def _count_notifs(session, user_id: int, app_id: int) -> int:
    return cast(int, session.query(Notification).filter_by(user_id=user_id, link_app_id=app_id).count())


# ─── Overdue follow-up ──────────────────────────────────────────────────────


def test_overdue_emits_once(session, db):
    """Verify the overdue marker fires exactly once for a freshly overdue row.

    Note: this fixture has BOTH a 15-day-old submission and an overdue plan,
    so a single sweep emits three notifications (1 overdue + 1 SLA 7d +
    1 SLA 14d). We assert each marker count individually rather than the
    aggregate, so the test is robust to which milestones happen to cross.
    """
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-8)}","status":"scheduled","overdue_days":8}}',
    )
    n_before = _count_notifs(session, 99, app.id)
    sweep_once(session, db)
    assert _count_events(session, app.id, "overdue_follow_up_notification_sent") == 1
    # Notification per marker emitted: 1 overdue + 1 SLA 7d + 1 SLA 14d
    assert _count_notifs(session, 99, app.id) - n_before == 3


def test_overdue_is_idempotent_across_sweeps(session, db):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-8)}","status":"scheduled","overdue_days":8}}',
    )
    n_before = _count_notifs(session, 99, app.id)
    sweep_once(session, db)
    sweep_once(session, db)
    sweep_once(session, db)
    assert _count_events(session, app.id, "overdue_follow_up_notification_sent") == 1
    # Should also have an SLA 7d marker (submission is 15 days old).
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 1
    # Total notifications: 1 overdue + 1 SLA 7d + 1 SLA 14d (15d old > 14)
    assert _count_notifs(session, 99, app.id) - n_before == 3


def test_overdue_within_grace_does_not_emit(session, db):
    # Plan was due 1 day ago — not yet OVERDUE_GRACE_DAYS=7 past.
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-3)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-1)}","status":"scheduled"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, app.id, "overdue_follow_up_notification_sent") == 0


def test_completed_plan_does_not_emit_overdue(session, db):
    # Plan past due AND already completed (send-log recorded). Skip.
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-10)}","status":"completed","completed_at":"{_iso(-5)}"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, app.id, "overdue_follow_up_notification_sent") == 0


# ─── SLA milestones ─────────────────────────────────────────────────────────


def test_sla_7d_fires_at_7_days(session, db):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-8)}","channel":"direct"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 1
    assert _count_events(session, app.id, "sla_milestone_14d_notification_sent") == 0


def test_sla_milestones_idempotent_across_sweeps(session, db):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-8)}","channel":"direct"}}',
    )
    sweep_once(session, db)
    sweep_once(session, db)
    sweep_once(session, db)
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 1


def test_sla_14d_fires_when_crossed_without_re_emitting_7d(session, db):
    # Start with a row at 8 days — fires 7d.
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-8)}","channel":"direct"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 1
    assert _count_events(session, app.id, "sla_milestone_14d_notification_sent") == 0

    # Backdate to 15 days (mimic time passing). 14d should fire; 7d preserved.
    app.submission_record_json = f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}'  # type: ignore[assignment]
    session.commit()
    sweep_once(session, db)
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 1  # NOT duplicated
    assert _count_events(session, app.id, "sla_milestone_14d_notification_sent") == 1


# ─── Stage filter: only pipeline_stage='applied' rows are processed ─────────


def test_non_applied_stage_skipped(session, db):
    app = make_app(
        session,
        pipeline_stage="interviewing",  # already moved out of Applied
        submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-10)}","status":"scheduled"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, app.id, "overdue_follow_up_notification_sent") == 0
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 0


def test_independent_apps_get_independent_markers(session, db):
    a = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-8)}","channel":"direct"}}',
    )
    b = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_iso(-9)}","channel":"direct"}}',
    )
    sweep_once(session, db)
    assert _count_events(session, a.id, "sla_milestone_7d_notification_sent") == 1
    assert _count_events(session, b.id, "sla_milestone_7d_notification_sent") == 1


# ─── No-user rows are skipped (legacy) ──────────────────────────────────────


def test_legacy_no_user_row_skipped(session, db):
    app = make_app(
        session,
        user_id=None,  # legacy data lacking ownership
        submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}',
    )
    counters = sweep_once(session, db)
    assert counters["skipped_no_user"] >= 1
    assert _count_events(session, app.id, "sla_milestone_7d_notification_sent") == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
