"""Transition to Interviewing.

Owner task: T3h.

Validates readiness via ``derivations.compute_next_steps``; refuses
to transition when ``can_transition == False``. On success, sets
``applications.pipeline_stage = 'interviewing'`` and emits a
``moved_to_interviewing`` event with structured readiness metadata.
Does not refresh the substage cache -- the row is leaving the Applied
stage and ``applied_substage`` becomes a historical marker.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from services.applied import derivations  # type: ignore[import-not-found]
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    DatabaseService,
)


def transition_to_interviewing(
    session: Session,
    app_id: int,
    user_id: int,
) -> dict[str, Any]:
    """Promote the application from Applied to Interviewing if the
    readiness rules in ``compute_next_steps`` are all met.

    Raises ``ValueError`` if the row is not currently in the Applied
    stage. Raises ``PermissionError`` if readiness checks fail or if
    the user does not own the application. The route layer maps the
    latter to HTTP 422 / 403 respectively.
    """
    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")
    if app.pipeline_stage != "applied":
        raise ValueError("application is not in Applied stage")

    next_steps = derivations.compute_next_steps(app, contacts=app.contacts)
    if not next_steps["can_transition"]:
        blockers = ", ".join(next_steps["blockers"]) or "unknown"
        raise PermissionError(f"readiness checks not met: {blockers}")

    app.pipeline_stage = "interviewing"
    session.flush()

    DatabaseService()._log_event(  # noqa: SLF001
        app.id,
        "moved_to_interviewing",
        f"Promoted to Interviewing (readiness {next_steps['readiness_score']}%)",
        session=session,
    )

    return {"ok": True, "pipeline_stage": "interviewing"}
