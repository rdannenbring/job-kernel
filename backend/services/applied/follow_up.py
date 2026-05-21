"""Follow-up plan + send-log service.

Owner task: T3e. Do not implement bodies here unless you are that task.

Decision references:
- D4: ``follow_up_plan_json.status`` caches ``scheduled`` /
  ``overdue`` / ``completed``, always recomputed on read.
- D5: writers call ``derivations.recompute_substage_cache``.

Imports allowed: stdlib, ``sqlalchemy.orm.Session``,
``backend.services.database_service`` (ORM + ``_log_event``),
``backend.services.applied.derivations``,
``backend.models.applied_models``.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def save_follow_up_plan(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Create or update ``follow_up_plan_json``. If ``due_at`` is
    omitted, derive: confirmation_at + 7d when confirmation exists,
    else submission.applied_at + 5d. Emits ``follow_up_plan_saved``.
    """
    raise NotImplementedError("T3e owns this function")


def mark_follow_up_sent(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Mark the plan ``completed``, set ``completed_at``, emit
    ``follow_up_sent`` event, and refresh the substage cache.
    """
    raise NotImplementedError("T3e owns this function")
