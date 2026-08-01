"""Opt-in gating tests for the Applied -> Interviewing transition.

Covers the product-direction change: readiness is advisory by default and
only blocks when the user turned on guided mode for the Applied stage.
See ``documentation/product-direction.md``.
"""
from __future__ import annotations

import pytest

from services.applied.transition import transition_to_interviewing
from services.workflow_prefs import (
    default_workflow_config,
    normalize_workflow_config,
)

from .conftest import make_app


# ─── The transition itself ──────────────────────────────────────────────────


def test_transition_succeeds_by_default_despite_zero_readiness(session):
    """The default path is fast: no follow-up, no contact, applied today."""
    app = make_app(session)

    result = transition_to_interviewing(session, app.id, user_id=99)

    assert result == {"ok": True, "pipeline_stage": "interviewing"}
    assert app.pipeline_stage == "interviewing"


def test_transition_blocked_when_enforced_and_not_ready(session):
    """Guided mode restores the original gate."""
    app = make_app(session)

    with pytest.raises(PermissionError) as exc:
        transition_to_interviewing(session, app.id, user_id=99, enforce=True)

    assert "readiness checks not met" in str(exc.value)
    # The row must not have moved.
    assert app.pipeline_stage == "applied"


def test_readiness_event_recorded_even_when_not_enforced(session):
    """The readiness signal survives demotion -- it is logged, not dropped."""
    from services.database_service import ApplicationEvent

    app = make_app(session)
    transition_to_interviewing(session, app.id, user_id=99)
    session.flush()

    events = (
        session.query(ApplicationEvent)
        .filter_by(application_id=app.id, event_type="moved_to_interviewing")
        .all()
    )
    assert len(events) == 1
    assert "readiness" in events[0].description


def test_wrong_stage_still_rejected_regardless_of_enforcement(session):
    """De-gating readiness must not weaken the state-machine check."""
    app = make_app(session, pipeline_stage="saved")

    with pytest.raises(ValueError, match="not in Applied stage"):
        transition_to_interviewing(session, app.id, user_id=99)


def test_ownership_still_rejected_regardless_of_enforcement(session):
    """De-gating readiness must not weaken the ownership check."""
    app = make_app(session)

    with pytest.raises(PermissionError, match="not your application"):
        transition_to_interviewing(session, app.id, user_id=1234)


# ─── Preference normalization (fails open) ──────────────────────────────────


def test_defaults_are_ungated():
    config = default_workflow_config()
    assert config["guided_mode"] is False


@pytest.mark.parametrize("garbage", [None, "", 0, [], "not-a-dict", 42])
def test_malformed_config_falls_back_to_defaults(garbage):
    assert normalize_workflow_config(garbage) == default_workflow_config()


def test_partial_config_is_filled_from_defaults():
    config = normalize_workflow_config({"guided_mode": True})
    assert config["guided_mode"] is True
    # Every gateable stage must be present so callers can index directly.
    assert set(config["stage_gates"]) == set(default_workflow_config()["stage_gates"])


def test_unknown_stage_keys_are_dropped():
    config = normalize_workflow_config(
        {"guided_mode": True, "stage_gates": {"applied": True, "bogus_stage": True}}
    )
    assert "bogus_stage" not in config["stage_gates"]
    assert config["stage_gates"]["applied"] is True


def test_malformed_stage_gates_do_not_crash():
    config = normalize_workflow_config({"guided_mode": True, "stage_gates": "nope"})
    assert config["guided_mode"] is True
    assert config["stage_gates"] == default_workflow_config()["stage_gates"]
