"""PUT ``/api/applications/{application_id}/applied/confirmation``.

Owner task: T7b. Persists the confirmation record, optionally
linking a previously uploaded receipt (T7a), initializes the SLA
tracker, and refreshes the substage cache per D5.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import ConfirmationOut, ConfirmationRecordIn
from services.applied.confirmation import save_confirmation
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    if "different application" in msg:
        # Cross-application receipt linkage attempt -- structurally invalid.
        return HTTPException(status_code=409, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.put(
    "/confirmation",
    response_model=ConfirmationOut,
    summary="Save the confirmation record (and link a previously uploaded receipt)",
)
async def save_confirmation_endpoint(
    application_id: int,
    payload: ConfirmationRecordIn,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Persist confirmation_record_json + initialize the SLA tracker."""
    from main import database_service
    session = database_service.Session()
    try:
        result = save_confirmation(
            session, application_id, payload.model_dump(mode="json"), user_id
        )
        session.commit()
        return result
    except ValueError as e:
        session.rollback()
        raise _value_error_to_http(e) from e
    except PermissionError as e:
        session.rollback()
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
