"""PUT ``/api/applications/{application_id}/applied/submission``.

Owner task: T6. Persists the submission record and (on first save)
locks the submission snapshot per D3, then refreshes the substage
cache per D5. All behavior lives in
``services.applied.submission.save_submission``; this module owns
the auth wiring, transaction boundary, and error translation.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import SubmissionOut, SubmissionRecordIn
from services.applied.submission import save_submission
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    if "locked" in msg:
        # Snapshot already locked -- D3 forbids overwrite.
        return HTTPException(status_code=409, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.put(
    "/submission",
    response_model=SubmissionOut,
    summary="Save the submission record (and lock snapshot on first save)",
)
async def save_submission_endpoint(
    application_id: int,
    payload: SubmissionRecordIn,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Persist submission_record_json (+ snapshot on first save per D3)."""
    from main import database_service
    session = database_service.Session()
    try:
        result = save_submission(
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
