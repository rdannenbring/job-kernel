"""Follow-up templates.

Owner task: T3f. Do not implement bodies here unless you are that task.

Decision D2: ship the two PRD templates verbatim for v1
(``gentle_nudge``, ``detailed_check_in``). No AI calls, no
persistence. Return a static list constructed in pure Python.

Imports allowed: stdlib, ``backend.models.applied_models``.
"""
from __future__ import annotations

from typing import Any


def list_follow_up_templates() -> list[dict[str, Any]]:
    """Return the v1 deterministic template catalogue: each item
    matches ``FollowUpTemplateOut`` (id, label, description, body).
    """
    raise NotImplementedError("T3f owns this function")
