"""GET ``/api/applications/{application_id}/applied/sla``.

Owner task: T8. Returns the SLA tracker for an application, or 404
when no baseline exists per decision D6 (UI hides the SLA panel).
Strictly read-only.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import SLATrackerOut
from services.applied.derivations import compute_sla
from services.auth_service import get_current_user_id
from services.database_service import Application

from . import router


@router.get(
    "/sla",
    response_model=SLATrackerOut,
    summary="Get SLA tracker (404 when no submission or confirmation)",
)
async def get_sla_endpoint(
    application_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return SLATrackerOut, or 404 when no baseline exists (D6)."""
    from main import database_service
    session = database_service.Session()
    try:
        app = session.get(Application, application_id)
        if app is None:
            raise HTTPException(status_code=404, detail="application not found")
        if app.user_id is not None and app.user_id != user_id:
            raise HTTPException(status_code=403, detail="not your application")
        sla = compute_sla(app)
        if sla is None:
            # D6: no baseline available (no submission or confirmation yet)
            raise HTTPException(
                status_code=404,
                detail="no SLA baseline; save a submission or confirmation first",
            )
        return sla
    finally:
        session.close()
