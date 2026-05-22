"""T19a: pure-function tests for services.applied.derivations.

Covers substage priority, completion math, the recompute helper, and
the edge cases for empty / malformed JSON inputs.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from services.applied import derivations as d
from tests.applied.conftest import make_app


class _Row:
    """Minimal duck-typed row so pure derivations don't need an ORM instance."""

    def __init__(self, **kw):
        for k in (
            "submission_record_json",
            "submission_snapshot_json",
            "confirmation_record_json",
            "follow_up_plan_json",
            "sla_tracker_json",
            "applied_substage",
        ):
            setattr(self, k, kw.get(k))


def _utc_iso(delta_days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


# ─── determine_applied_substage ─────────────────────────────────────────────


def test_empty_row_returns_none():
    assert d.determine_applied_substage(_Row()) is None


def test_submission_only_returns_submitted():
    row = _Row(submission_record_json=f'{{"applied_at":"{_utc_iso(-1)}","channel":"direct"}}')
    assert d.determine_applied_substage(row) == "submitted"


def test_confirmation_overrides_submission():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-3)}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{_utc_iso(-1)}"}}',
    )
    assert d.determine_applied_substage(row) == "confirmed"


def test_follow_up_due_when_past_due():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-8)}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{_utc_iso(-7)}"}}',
        follow_up_plan_json=f'{{"due_at":"{_utc_iso(-1)}","status":"scheduled"}}',
    )
    assert d.determine_applied_substage(row) == "follow_up_due"


def test_follow_up_sent_via_completed_status():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-10)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_utc_iso(-1)}","status":"completed"}}',
    )
    assert d.determine_applied_substage(row) == "follow_up_sent"


def test_follow_up_sent_via_events_argument():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-1)}","channel":"direct"}}',
    )

    class _Ev:
        event_type = "follow_up_sent"

    assert d.determine_applied_substage(row, events=[_Ev()]) == "follow_up_sent"


def test_malformed_json_does_not_raise():
    row = _Row(submission_record_json="{not json")
    assert d.determine_applied_substage(row) is None


# ─── compute_completion ─────────────────────────────────────────────────────


def test_completion_empty_row_is_zero():
    out = d.compute_completion(_Row())
    assert out["percentage"] == 0
    assert len(out["substages"]) == 4
    assert all(s["complete"] is False for s in out["substages"])


def test_completion_quarters():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-5)}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{_utc_iso(-2)}"}}',
    )
    out = d.compute_completion(row)
    assert out["percentage"] == 50
    sub_map = {s["id"]: s["complete"] for s in out["substages"]}
    assert sub_map["submitted"] is True
    assert sub_map["confirmed"] is True
    assert sub_map["follow_up_due"] is False


def test_completion_full():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_utc_iso(-10)}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{_utc_iso(-8)}"}}',
        follow_up_plan_json=f'{{"due_at":"{_utc_iso(-1)}","status":"completed","completed_at":"{_utc_iso(0)}"}}',
    )
    out = d.compute_completion(row)
    assert out["percentage"] == 100


# ─── recompute_substage_cache (DB-touching) ─────────────────────────────────


def test_recompute_writes_cache(session):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_utc_iso(-1)}","channel":"direct"}}',
    )
    new = d.recompute_substage_cache(session, app.id)
    assert new == "submitted"
    assert app.applied_substage == "submitted"


def test_recompute_idempotent_when_unchanged(session):
    app = make_app(
        session,
        submission_record_json=f'{{"applied_at":"{_utc_iso(-1)}","channel":"direct"}}',
        applied_substage="submitted",
    )
    new = d.recompute_substage_cache(session, app.id)
    assert new == "submitted"


def test_recompute_returns_none_for_missing_row(session):
    assert d.recompute_substage_cache(session, 999_999) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
