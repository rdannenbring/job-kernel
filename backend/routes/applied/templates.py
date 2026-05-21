"""GET ``/api/applications/{application_id}/applied/follow-up/templates``.

Owner task: T10. Returns the deterministic v1 template catalogue
(per decision D2). Auth is required for consistency with the rest
of the Applied API even though template content is not
application-specific.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends

from models.applied_models import FollowUpTemplateOut
from services.applied.templates import list_follow_up_templates
from services.auth_service import get_current_user_id

from . import router


@router.get(
    "/follow-up/templates",
    response_model=dict[str, list[FollowUpTemplateOut]],
    summary="List the deterministic v1 follow-up templates",
)
async def list_follow_up_templates_endpoint(
    application_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, list[dict[str, Any]]]:
    """Return ``{"templates": [...]}`` wrapping the catalogue.

    ``application_id`` is part of the router prefix but not used to
    filter the response; templates are global content.
    """
    return {"templates": list_follow_up_templates()}
