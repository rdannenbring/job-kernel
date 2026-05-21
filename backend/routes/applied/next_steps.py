"""GET ``/api/applications/{application_id}/applied/next-steps``.

Owner task: T13a. Computes the readiness assessment for the
Move-to-Interviewing action via
``services.applied.derivations.compute_next_steps``. Strictly
read-only.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import NextStepsOut
from services.applied.derivations import compute_next_steps
from services.auth_service import get_current_user_id
from services.database_service import Application

from . import router


@router.get(
    "/next-steps",
    response_model=NextStepsOut,
    summary="Readiness assessment for transition to Interviewing",
)
async def get_next_steps_endpoint(
    application_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return ``NextStepsOut`` with can_transition and structured blockers."""
    from main import database_service
    session = database_service.Session()
    try:
        app = session.get(Application, application_id)
        if app is None:
            raise HTTPException(status_code=404, detail="application not found")
        if app.user_id is not None and app.user_id != user_id:
            raise HTTPException(status_code=403, detail="not your application")
        return compute_next_steps(app, contacts=app.contacts)
    finally:
        session.close()
