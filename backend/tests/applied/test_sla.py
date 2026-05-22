"""T19b: SLA computation tests.

Verifies decision D6 (None when no baseline), confirmation-over-submission
baseline preference, milestone reach flags, and the state/alert/action
banding for elapsed days.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from services.applied.derivations import compute_sla


class _Row:
    def __init__(self, **kw):
        self.submission_record_json = kw.get("submission_record_json")
        self.confirmation_record_json = kw.get("confirmation_record_json")


def _iso(delta_days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


# ─── D6: no baseline -> None ────────────────────────────────────────────────


def test_no_baseline_returns_none():
    assert compute_sla(_Row()) is None


def test_malformed_submission_returns_none():
    assert compute_sla(_Row(submission_record_json="not-json")) is None


# ─── Baseline preference: confirmation > submission ─────────────────────────


def test_baseline_uses_confirmation_when_present():
    sub_iso = _iso(-15)
    conf_iso = _iso(-3)
    row = _Row(
        submission_record_json=f'{{"applied_at":"{sub_iso}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{conf_iso}"}}',
    )
    out = compute_sla(row)
    assert out is not None
    sla = out  # mypy-narrow to non-None
    # 3 days elapsed since confirmation, not 15 since submission
    assert sla["days_elapsed"] == 3


def test_baseline_falls_back_to_submission():
    sub_iso = _iso(-7)
    row = _Row(submission_record_json=f'{{"applied_at":"{sub_iso}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    assert out["days_elapsed"] == 7


# ─── Milestone reach flags ──────────────────────────────────────────────────


def test_zero_days_no_milestones_reached():
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(0)}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    assert all(m["reached"] is False for m in out["milestones"])


def test_eight_days_reaches_only_7d():
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(-8)}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    milestones = {m["days"]: m["reached"] for m in out["milestones"]}
    assert milestones[7] is True
    assert milestones[14] is False
    assert milestones[21] is False


def test_fifteen_days_reaches_7d_and_14d():
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(-15)}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    milestones = {m["days"]: m["reached"] for m in out["milestones"]}
    assert milestones[7] is True
    assert milestones[14] is True
    assert milestones[21] is False


def test_thirty_days_reaches_all():
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(-30)}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    assert all(m["reached"] for m in out["milestones"])


# ─── Banded current_state / alert_level / next_recommended_action ───────────


@pytest.mark.parametrize(
    "delta_days,expected_state,expected_alert,expected_action",
    [
        (-3, "within_window", "none", "wait"),
        (-10, "awaiting_response", "low", "prepare_follow_up"),
        (-17, "stale", "medium", "send_follow_up"),
        (-30, "critical", "high", "escalate"),
    ],
)
def test_state_banding(delta_days, expected_state, expected_alert, expected_action):
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(delta_days)}","channel":"direct"}}')
    out = compute_sla(row)
    assert out is not None
    assert out["current_state"] == expected_state
    assert out["alert_level"] == expected_alert
    assert out["next_recommended_action"] == expected_action


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
