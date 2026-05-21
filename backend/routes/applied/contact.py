"""PUT ``/api/applications/{application_id}/applied/contact``.

Owner task: T11. Upserts a contact against ``application_contacts``
via ``services.applied.contact.upsert_contact``. The D1 ``role`` /
``title`` aliasing happens inside the Pydantic model and the service.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import AppliedContactIn, AppliedContactOut
from services.applied.contact import upsert_contact
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.put(
    "/contact",
    response_model=AppliedContactOut,
    summary="Insert or update a contact on this application",
)
async def upsert_contact_endpoint(
    application_id: int,
    payload: AppliedContactIn,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Insert or update a contact tied to ``application_id``."""
    from main import database_service
    session = database_service.Session()
    try:
        # by_alias=True so the service receives ``title`` (alias) and
        # the upsert layer can map it onto the DB column ``role``.
        result = upsert_contact(
            session,
            application_id,
            payload.model_dump(mode="json", by_alias=True),
            user_id,
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
