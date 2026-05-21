"""PUT ``/api/applications/{application_id}/applied/follow-up-plan``.

Owner task: T9a. Persists the follow-up plan via
``services.applied.follow_up.save_follow_up_plan``. When ``due_at``
is omitted the service derives a default; that derivation fails
with ValueError when there is no submission record to anchor on.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import FollowUpPlanIn, FollowUpSentOut
from services.applied.follow_up import save_follow_up_plan
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.put(
    "/follow-up-plan",
    response_model=FollowUpSentOut,
    summary="Save or update the follow-up plan",
)
async def save_follow_up_plan_endpoint(
    application_id: int,
    payload: FollowUpPlanIn,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Persist follow_up_plan_json; derive default due_at when omitted."""
    from main import database_service
    session = database_service.Session()
    try:
        result = save_follow_up_plan(
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
