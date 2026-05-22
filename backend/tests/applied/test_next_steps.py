"""T19f: next-steps readiness gate tests.

Verifies the 4 readiness signals (follow_up_sent, contact_exists,
response_window_met, no_unresolved_blockers), the readiness score
math (25/25/25/25), and the recommended_action selection logic.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from services.applied.derivations import compute_next_steps


class _Row:
    def __init__(self, **kw):
        for k in (
            "submission_record_json",
            "submission_snapshot_json",
            "confirmation_record_json",
            "follow_up_plan_json",
            "applied_substage",
        ):
            setattr(self, k, kw.get(k))


def _iso(delta_days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


def _row_all_signals_met():
    """Submission 10d ago + completed follow-up plan; contacts passed separately."""
    return _Row(
        submission_record_json=f'{{"applied_at":"{_iso(-10)}","channel":"direct"}}',
        confirmation_record_json=f'{{"confirmed_at":"{_iso(-9)}"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-2)}","status":"completed","completed_at":"{_iso(-1)}"}}',
    )


# ─── Happy path ─────────────────────────────────────────────────────────────


def test_all_signals_met_can_transition():
    out = compute_next_steps(_row_all_signals_met(), contacts=[object()])
    assert out["can_transition"] is True
    assert out["readiness_score"] == 100
    assert len(out["blockers"]) == 0
    assert "follow_up_sent" in out["reasons_met"]
    assert "contact_exists" in out["reasons_met"]
    assert "response_window_met" in out["reasons_met"]
    assert "no_unresolved_blockers" in out["reasons_met"]
    assert out["recommended_action"] == "transition_to_interviewing"


# ─── Empty / no-signals row ─────────────────────────────────────────────────


def test_empty_row_cannot_transition():
    out = compute_next_steps(_Row(), contacts=None)
    assert out["can_transition"] is False
    assert out["readiness_score"] == 25  # no_unresolved_blockers placeholder always true
    assert "follow_up_sent" in out["blockers"]
    assert "contact_exists" in out["blockers"]
    assert "response_window_met" in out["blockers"]
    assert "no_unresolved_blockers" not in out["blockers"]


# ─── Individual missing signals ─────────────────────────────────────────────


def test_missing_follow_up_sent_blocks():
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_iso(-10)}","channel":"direct"}}',
        # No completed follow-up plan
    )
    out = compute_next_steps(row, contacts=[object()])
    assert out["can_transition"] is False
    assert "follow_up_sent" in out["blockers"]
    assert "contact_exists" in out["reasons_met"]
    assert "response_window_met" in out["reasons_met"]


def test_missing_contact_blocks():
    out = compute_next_steps(_row_all_signals_met(), contacts=[])
    assert out["can_transition"] is False
    assert "contact_exists" in out["blockers"]


def test_missing_contacts_param_blocks():
    # When the caller passes contacts=None, contact_exists is False.
    out = compute_next_steps(_row_all_signals_met(), contacts=None)
    assert out["can_transition"] is False
    assert "contact_exists" in out["blockers"]


def test_short_response_window_blocks():
    """Submission 3d ago < 7d -> response_window_met false."""
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_iso(-3)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(2)}","status":"completed","completed_at":"{_iso(-1)}"}}',
    )
    out = compute_next_steps(row, contacts=[object()])
    assert out["can_transition"] is False
    assert "response_window_met" in out["blockers"]
    # follow_up_sent + contact_exists still met
    assert "follow_up_sent" in out["reasons_met"]
    assert "contact_exists" in out["reasons_met"]


# ─── Readiness score math ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "row,contacts,expected_score",
    [
        # 0 signals met (none would be true except the placeholder); placeholder = 25%
        (_Row(), None, 25),
        # Only submission present + 10d old + plan completed + contact -> 100
        (
            _Row(
                submission_record_json=f'{{"applied_at":"{_iso(-10)}","channel":"direct"}}',
                follow_up_plan_json=f'{{"due_at":"{_iso(-3)}","status":"completed","completed_at":"{_iso(-2)}"}}',
            ),
            [object()],
            100,
        ),
    ],
)
def test_readiness_score_math(row, contacts, expected_score):
    out = compute_next_steps(row, contacts=contacts)
    assert out["readiness_score"] == expected_score


# ─── Recommended action selection ───────────────────────────────────────────


def test_recommended_action_when_window_not_met_yet():
    # Fresh submission (3 days), contact present so add_contact doesn't fire.
    # follow_up_sent=False AND response_window_met=False -> wait_for_response.
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(-3)}","channel":"direct"}}')
    out = compute_next_steps(row, contacts=[object()])
    assert out["recommended_action"] == "wait_for_response"


def test_recommended_action_send_follow_up_after_window():
    # 10 days post-submission, no follow-up plan -> response_window_met, follow_up_sent False
    row = _Row(submission_record_json=f'{{"applied_at":"{_iso(-10)}","channel":"direct"}}')
    out = compute_next_steps(row, contacts=[object()])
    assert out["recommended_action"] == "send_follow_up"


def test_recommended_action_add_contact():
    # Follow-up sent + window met but no contact.
    row = _Row(
        submission_record_json=f'{{"applied_at":"{_iso(-10)}","channel":"direct"}}',
        follow_up_plan_json=f'{{"due_at":"{_iso(-2)}","status":"completed","completed_at":"{_iso(-1)}"}}',
    )
    out = compute_next_steps(row, contacts=[])
    assert out["recommended_action"] == "add_contact"


# ─── reasons_met + blockers are mutually exclusive ──────────────────────────


def test_reasons_and_blockers_are_disjoint():
    out = compute_next_steps(_row_all_signals_met(), contacts=[])
    overlap = set(out["reasons_met"]) & set(out["blockers"])
    assert not overlap


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
