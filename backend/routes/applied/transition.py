"""POST ``/api/applications/{application_id}/applied/transition-to-interviewing``.

Owner task: T13b. Promotes the application from Applied to
Interviewing via ``services.applied.transition.transition_to_interviewing``.

Readiness is advisory unless the user opted into guided mode for the
Applied stage (see ``services.workflow_prefs``). When it *is* enforced and
the gate fails, this endpoint re-computes ``compute_next_steps`` on the same
row and returns 422 with the structured blocker list so the frontend can
surface specific reasons (per the dispatch guidance).
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from models.applied_models import TransitionResultOut
from services.applied.derivations import compute_next_steps
from services.applied.transition import transition_to_interviewing
from services.auth_service import get_current_user_id
from services.database_service import Application
from services.workflow_prefs import is_stage_gated

from . import router


@router.post(
    "/transition-to-interviewing",
    response_model=TransitionResultOut,
    summary="Promote the application from Applied to Interviewing",
)
async def transition_to_interviewing_endpoint(
    application_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Flip pipeline_stage and emit the event, gating only if opted in."""
    from main import database_service
    enforce = is_stage_gated(user_id, "applied")
    session = database_service.Session()
    try:
        result = transition_to_interviewing(
            session, application_id, user_id, enforce=enforce
        )
        session.commit()
        return result
    except ValueError as e:
        session.rollback()
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg) from e
        if "not in Applied" in msg:
            # State-machine violation (already transitioned, or never was Applied).
            raise HTTPException(status_code=409, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e
    except PermissionError as e:
        session.rollback()
        msg = str(e)
        if "readiness checks not met" in msg:
            # Re-compute next_steps to surface structured blockers in the
            # 422 detail. The session is rolled back but still usable; the
            # row state we just probed is exactly what the frontend needs.
            app = session.get(Application, application_id)
            if app is None:
                # Extremely unlikely race; fall back to a plain 422.
                raise HTTPException(
                    status_code=422,
                    detail={"code": "readiness_check_failed", "message": msg},
                ) from e
            next_steps = compute_next_steps(app, contacts=app.contacts)
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "readiness_check_failed",
                    "message": msg,
                    "blockers": next_steps["blockers"],
                    "reasons_met": next_steps["reasons_met"],
                    "readiness_score": next_steps["readiness_score"],
                    "recommended_action": next_steps["recommended_action"],
                },
            ) from e
        # Ownership failure
        raise HTTPException(status_code=403, detail=msg) from e
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
