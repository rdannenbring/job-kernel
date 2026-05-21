"""Contact upsert against ``application_contacts``.

Owner task: T3g. Do not implement bodies here unless you are that task.

Decision D1: DB column is ``role``; Pydantic model exposes it as
``title``. Map ``payload.role`` (or aliased ``payload.title``) into
the ``role`` column. Do NOT duplicate contact data into any JSON
column on ``applications``.

Imports allowed: stdlib, ``sqlalchemy.orm.Session``,
``backend.services.database_service`` (ORM + ``_log_event``),
``backend.models.applied_models``.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def upsert_contact(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Insert or update one contact row tied to ``app_id``. Emits a
    ``contact_linked`` event on insert. Returns the persisted contact
    as ``AppliedContactOut``.
    """
    raise NotImplementedError("T3g owns this function")
