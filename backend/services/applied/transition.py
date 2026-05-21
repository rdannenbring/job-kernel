"""Transition to Interviewing.

Owner task: T3h. Do not implement bodies here unless you are that task.

Validates readiness via ``derivations.compute_next_steps``; refuses
to transition when ``can_transition == False``. On success, sets
``applications.pipeline_stage = 'interviewing'`` and emits a
``moved_to_interviewing`` event. The substage cache is not refreshed
here -- the row is leaving the Applied stage.

Imports allowed: stdlib, ``sqlalchemy.orm.Session``,
``backend.services.database_service`` (ORM + ``_log_event``),
``backend.services.applied.derivations``,
``backend.models.applied_models``.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def transition_to_interviewing(
    session: Session,
    app_id: int,
    user_id: int,
) -> dict[str, Any]:
    """Promote the application from Applied to Interviewing if
    readiness rules permit. Returns ``TransitionResultOut`` shape:
    ``{"ok": True, "pipeline_stage": "interviewing"}``.
    """
    raise NotImplementedError("T3h owns this function")
