"""Contact upsert against ``application_contacts``.

Owner task: T3g.

Decision D1: DB column is ``role``; the API field is ``title``. The
Pydantic model accepts either spelling on input thanks to
``populate_by_name=True``; we always read it back as ``role`` here.
Do NOT duplicate contact data into any JSON column on
``applications`` -- ``application_contacts`` is the canonical source.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from models.applied_models import (  # type: ignore[import-not-found]
    AppliedContactIn,
)
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    ApplicationContact,
    DatabaseService,
)


def _contact_to_dict(c: ApplicationContact) -> dict[str, Any]:
    """Render with the D1 ``role`` -> API ``title`` alias."""
    return {
        "id": c.id,
        "name": c.name,
        "title": c.role,
        "email": c.email,
        "company": c.company,
        "linkedin_url": c.linkedin_url,
        "is_hiring_manager": bool(c.is_hiring_manager) if c.is_hiring_manager is not None else False,
        "source": c.source,
    }


def upsert_contact(
    session: Session,
    app_id: int,
    payload: Any,
    user_id: int,
) -> dict[str, Any]:
    """Insert or update one contact row tied to ``app_id``.

    Match strategy:
    1. ``payload.id`` (if provided AND row exists for that (app_id, id)).
    2. Otherwise match by ``(app_id, email)`` when ``email`` is non-null.
    3. Otherwise insert a new row.

    Emits ``contact_linked`` on INSERT only -- updates are silent.
    """
    validated = AppliedContactIn.model_validate(payload)

    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    incoming_id = payload.get("id") if isinstance(payload, dict) else None
    target: ApplicationContact | None = None
    if incoming_id is not None:
        target = (
            session.query(ApplicationContact)
            .filter(ApplicationContact.application_id == app.id, ApplicationContact.id == incoming_id)
            .one_or_none()
        )
    if target is None and validated.email is not None:
        target = (
            session.query(ApplicationContact)
            .filter(
                ApplicationContact.application_id == app.id,
                ApplicationContact.email == str(validated.email),
            )
            .one_or_none()
        )

    is_insert = target is None
    if target is None:
        target = ApplicationContact(application_id=app.id)
        session.add(target)

    # ``role`` is the DB column; ``validated.role`` is the model attribute
    # populated by either API key (``title`` alias or bare ``role``) per D1.
    target.name = validated.name
    target.role = validated.role
    target.email = str(validated.email) if validated.email is not None else None
    target.company = validated.company
    target.linkedin_url = str(validated.linkedin_url) if validated.linkedin_url is not None else None
    target.is_hiring_manager = validated.is_hiring_manager
    target.source = validated.source

    session.flush()

    if is_insert:
        DatabaseService()._log_event(  # noqa: SLF001
            app.id,
            "contact_linked",
            f"Contact linked: {target.name}",
            session=session,
        )

    return _contact_to_dict(target)
