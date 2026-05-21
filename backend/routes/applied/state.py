"""GET ``/api/applications/{application_id}/applied`` -- Applied state.

Owner task: T5. Reads the assembled Applied-stage document via
``services.applied.state.get_applied_state``. Strictly read-only.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import AppliedStateOut
from services.applied.state import get_applied_state
from services.auth_service import get_current_user_id

from . import router


@router.get(
    "",
    response_model=AppliedStateOut,
    summary="Get Applied stage state",
)
async def get_applied_state_endpoint(
    application_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return the full Applied-stage state document for one application."""
    from main import database_service  # local import to avoid circular load
    session = database_service.Session()
    try:
        return get_applied_state(session, application_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    finally:
        session.close()
