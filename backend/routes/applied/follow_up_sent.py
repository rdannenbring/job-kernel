"""POST ``/api/applications/{application_id}/applied/follow-up/send-log``.

Owner task: T9b. Marks the existing follow-up plan as completed via
``services.applied.follow_up.mark_follow_up_sent``. The plan must
already exist (state-machine prerequisite) and ``sent_at`` must be
no earlier than the submission's ``applied_at``.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import FollowUpSentIn, FollowUpSentOut
from services.applied.follow_up import mark_follow_up_sent
from services.auth_service import get_current_user_id

from . import router


def _value_error_to_http(e: ValueError) -> HTTPException:
    msg = str(e)
    if "no follow-up plan" in msg:
        # State-machine violation: plan must be created first.
        return HTTPException(status_code=409, detail=msg)
    if "not found" in msg:
        return HTTPException(status_code=404, detail=msg)
    if "cannot precede" in msg:
        return HTTPException(status_code=400, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.post(
    "/follow-up/send-log",
    response_model=FollowUpSentOut,
    summary="Record that the user sent the follow-up",
)
async def mark_follow_up_sent_endpoint(
    application_id: int,
    payload: FollowUpSentIn,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Complete the plan and emit follow_up_sent."""
    from main import database_service
    session = database_service.Session()
    try:
        result = mark_follow_up_sent(
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
