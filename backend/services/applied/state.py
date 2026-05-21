"""State assembly: read-only ``GET /applied`` response builder.

Owner task: T3b. This module is strictly read-only -- no column writes,
no event emission, no substage cache refresh. The substage cache is
maintained by writer modules per decision D5; reads consume whatever
the writers persisted.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from services.applied import derivations  # type: ignore[import-not-found]
from services.database_service import (  # type: ignore[import-not-found]
    Application,
    ApplicationContact,
)


def _load_json(blob: Any) -> dict[str, Any] | None:
    """Parse a JSON-as-Text column into a dict; tolerate null/blank/bad."""
    if blob is None:
        return None
    if isinstance(blob, dict):
        return blob
    if not isinstance(blob, str) or not blob.strip():
        return None
    try:
        parsed = json.loads(blob)
    except (ValueError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _contact_to_dict(c: ApplicationContact) -> dict[str, Any]:
    """Render a contact row with the D1 ``role`` -> API ``title`` alias."""
    return {
        "id": c.id,
        "name": c.name,
        # API surface field per D1 is ``title``; DB column stays ``role``.
        "title": c.role,
        "email": c.email,
        "company": c.company,
        "linkedin_url": c.linkedin_url,
        "is_hiring_manager": bool(c.is_hiring_manager) if c.is_hiring_manager is not None else False,
        "source": c.source,
    }


def get_applied_state(session: Session, app_id: int, user_id: int) -> dict[str, Any]:
    """Assemble the full Applied-stage state document for one application.

    Mirrors the ``AppliedStateOut`` shape in
    ``backend.models.applied_models``. Performs an ownership check:
    raises ``ValueError`` when the row does not exist, ``PermissionError``
    when ``app.user_id != user_id``. Route handlers translate these to
    404 / 403 respectively.
    """
    app = session.get(Application, app_id)
    if app is None:
        raise ValueError("application not found")
    if app.user_id is not None and app.user_id != user_id:
        raise PermissionError("not your application")

    submission_record = _load_json(app.submission_record_json)
    submission_snapshot = _load_json(app.submission_snapshot_json)
    confirmation_record = _load_json(app.confirmation_record_json)
    follow_up_plan = _load_json(app.follow_up_plan_json)

    # Prefer recomputed SLA over cached blob; fall back to cached when compute
    # returns None but a cache exists. compute_sla returns None when there is
    # no baseline (D6) -- the route maps that to a 404 if exposed standalone.
    fresh_sla = derivations.compute_sla(app)
    sla_tracker: dict[str, Any] | None = fresh_sla if fresh_sla is not None else _load_json(app.sla_tracker_json)

    contacts = [_contact_to_dict(c) for c in app.contacts]
    completion = derivations.compute_completion(app)

    return {
        "application_id": app.id,
        "pipeline_stage": app.pipeline_stage,
        "applied_substage": app.applied_substage,
        "submission_record": submission_record,
        "submission_snapshot": submission_snapshot,
        "confirmation_record": confirmation_record,
        "follow_up_plan": follow_up_plan,
        "sla_tracker": sla_tracker,
        "contacts": contacts,
        "completion": completion,
    }
