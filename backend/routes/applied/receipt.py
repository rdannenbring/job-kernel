"""POST ``/api/applications/{application_id}/applied/confirmation/receipt``.

Owner task: T7a. Multipart upload of a confirmation receipt
(image/png, image/jpeg, or application/pdf only). Persists into
``applied_assets`` with a SHA-256 hash. Linkage to the confirmation
record happens later via T7b's PUT /confirmation endpoint.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, File, HTTPException, UploadFile

from models.applied_models import ReceiptAssetOut
from services.applied.confirmation import upload_receipt
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    if "unsupported mime" in msg:
        return HTTPException(status_code=415, detail=msg)
    if "empty" in msg or "no readable stream" in msg:
        return HTTPException(status_code=400, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.post(
    "/confirmation/receipt",
    response_model=ReceiptAssetOut,
    summary="Upload a confirmation receipt (PNG/JPEG/PDF only)",
)
async def upload_receipt_endpoint(
    application_id: int,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Validate MIME, hash, persist into applied_assets."""
    from main import database_service
    session = database_service.Session()
    try:
        result = upload_receipt(session, application_id, file, user_id)
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
