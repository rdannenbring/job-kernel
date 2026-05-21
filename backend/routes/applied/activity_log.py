"""GET ``/api/applications/{application_id}/applied/activity-log``.

Owner task: T12. Reads paginated rows from ``application_events``
filtered to one application, surfacing the new T1 columns
(``actor``, ``title``, ``metadata_json``, ``substage``) alongside
the legacy ``event_type`` + ``timestamp``. No service-layer
function exists for this read; the SQLAlchemy query is small
enough to live inline in the route.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query

from models.applied_models import ActivityLogPageOut
from services.auth_service import get_current_user_id
from services.database_service import Application, ApplicationEvent

from . import router


def _decode_metadata(blob: Any) -> dict[str, Any]:
    if blob is None:
        return {}
    if isinstance(blob, dict):
        return blob
    if not isinstance(blob, str) or not blob.strip():
        return {}
    try:
        parsed = json.loads(blob)
    except (ValueError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _normalize_ts(value: Any) -> str:
    """Coerce a stored ``application_events.timestamp`` to UTC-aware ISO.

    The legacy ``_log_event`` helper writes naive ``datetime.now().isoformat()``
    strings (a known bug to be fixed in a follow-up). The Pydantic
    ``UTCDateTime`` type used in ``ActivityLogItemOut`` rejects naive values,
    so this read endpoint normalizes defensively: parse, assume UTC when no
    tzinfo is present, re-serialize.
    """
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, datetime):
        parsed = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    if not isinstance(value, str):
        return datetime.now(timezone.utc).isoformat()
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc).isoformat()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


@router.get(
    "/activity-log",
    response_model=ActivityLogPageOut,
    summary="Paginated activity log for one application",
)
async def get_activity_log_endpoint(
    application_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Return ``application_events`` rows for this application, paginated."""
    from main import database_service
    session = database_service.Session()
    try:
        app = session.get(Application, application_id)
        if app is None:
            raise HTTPException(status_code=404, detail="application not found")
        if app.user_id is not None and app.user_id != user_id:
            raise HTTPException(status_code=403, detail="not your application")

        base_q = session.query(ApplicationEvent).filter(
            ApplicationEvent.application_id == application_id
        )
        total = base_q.count()
        rows = (
            base_q.order_by(ApplicationEvent.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = [
            {
                "id": r.id,
                "event_type": r.event_type,
                "actor": r.actor,
                "title": r.title,
                "substage": r.substage,
                "timestamp": _normalize_ts(r.timestamp),
                "metadata": _decode_metadata(r.metadata_json),
            }
            for r in rows
        ]
        return {"items": items, "total": total, "limit": limit, "offset": offset}
    finally:
        session.close()
