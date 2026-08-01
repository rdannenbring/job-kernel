"""Transition to Interviewing.

Owner task: T3h. Readiness semantics revised per
``documentation/product-direction.md``.

Always computes readiness via ``derivations.compute_next_steps``, but only
*enforces* it when the caller passes ``enforce=True`` -- which the route
layer derives from the user's opt-in guided-mode preferences. The product
default is fast: readiness is advisory and the transition succeeds
regardless. On success, sets ``applications.pipeline_stage = 'interviewing'``
and emits a ``moved_to_interviewing`` event with structured readiness
metadata (recorded either way, so the signal survives even when it does not
block). Does not refresh the substage cache -- the row is leaving the
Applied stage and ``applied_substage`` becomes a historical marker.
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
    enforce: bool = False,
) -> dict[str, Any]:
    """Promote the application from Applied to Interviewing.

    ``enforce`` decides whether the readiness rules in
    ``compute_next_steps`` block the move. It defaults to ``False`` so the
    fast path is the default path; the route layer passes ``True`` only when
    the user has opted into guided mode for the Applied stage.

    Raises ``ValueError`` if the row is not currently in the Applied
    stage. Raises ``PermissionError`` if the user does not own the
    application, or -- when ``enforce`` is set -- if readiness checks fail.
    The route layer maps those to HTTP 403 / 422 respectively.
    """
    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")
    if app.pipeline_stage != "applied":
        raise ValueError("application is not in Applied stage")

    next_steps = derivations.compute_next_steps(app, contacts=app.contacts)
    if enforce and not next_steps["can_transition"]:
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
