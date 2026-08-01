"""User workflow preferences: opt-in stage gating.

The product default is *fast* -- nothing blocks stage advancement. Users who
want the guided, evidence-gated experience turn it on per stage in Settings.

Preferences live in the existing per-user config blob (``configs.settings``)
under a ``workflow_config`` key, so adding them required no migration::

    "workflow_config": {
        "guided_mode": false,
        "stage_gates": {"saved": false, ..., "applied": true, ...}
    }

``stage_gates`` only take effect while ``guided_mode`` is on -- the master
toggle is the single switch that turns the whole guided experience off
without the user losing their per-stage choices.

Every lookup here **fails open**: a missing key, a malformed blob, or a
database error all resolve to "not gated". Enforcement is the opt-in path,
so any uncertainty must land on the permissive side.
"""
from __future__ import annotations

from typing import Any

# The pipeline stages that can carry a gate. Mirrors the ordered progression
# in ``database_service.STAGES``; terminal stages are never gated.
GATEABLE_STAGES: tuple[str, ...] = (
    "saved",
    "generated",
    "applied",
    "interviewing",
    "decision",
    "accepted",
)

# Shipped defaults. ``guided_mode`` off means none of these apply; ``applied``
# is pre-checked so that flipping the master toggle on reproduces the original
# readiness-gated behavior without further configuration.
DEFAULT_WORKFLOW_CONFIG: dict[str, Any] = {
    "guided_mode": False,
    "stage_gates": {stage: (stage == "applied") for stage in GATEABLE_STAGES},
}


def default_workflow_config() -> dict[str, Any]:
    """Return a fresh copy of the shipped defaults."""
    return {
        "guided_mode": False,
        "stage_gates": dict(DEFAULT_WORKFLOW_CONFIG["stage_gates"]),
    }


def normalize_workflow_config(raw: Any) -> dict[str, Any]:
    """Coerce a stored ``workflow_config`` blob into a complete, valid dict.

    Unknown stage keys are dropped and missing ones filled from defaults, so
    callers can index ``["stage_gates"][stage]`` without guarding.
    """
    config = default_workflow_config()
    if not isinstance(raw, dict):
        return config

    config["guided_mode"] = bool(raw.get("guided_mode", False))

    gates = raw.get("stage_gates")
    if isinstance(gates, dict):
        for stage in GATEABLE_STAGES:
            if stage in gates:
                config["stage_gates"][stage] = bool(gates[stage])

    return config


def get_workflow_config(user_id: int | None) -> dict[str, Any]:
    """Read and normalize the user's workflow preferences.

    Falls back to defaults if the config row is absent or unreadable.
    """
    try:
        from main import database_service  # local import: avoids a cycle

        stored = database_service.get_config(user_id) or {}
    except Exception:
        return default_workflow_config()

    return normalize_workflow_config(stored.get("workflow_config"))


def is_stage_gated(user_id: int | None, stage: str) -> bool:
    """True only when the user opted into guided mode *and* this stage's gate.

    This is the single question the route layer asks before enforcing a
    readiness check. Fails open on any error.
    """
    try:
        config = get_workflow_config(user_id)
    except Exception:
        return False

    if not config.get("guided_mode"):
        return False
    return bool(config.get("stage_gates", {}).get(stage, False))
