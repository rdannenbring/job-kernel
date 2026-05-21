"""State assembly: read-only ``GET /applied`` response builder.

Owner task: T3b. Do not implement bodies here unless you are that task.

Imports allowed: stdlib, ``sqlalchemy.orm.Session``,
``backend.services.applied.derivations``,
``backend.services.database_service`` (for the existing ORM classes),
``backend.models.applied_models`` (for response shapes).

This module is strictly read-only. Do not write to any column, do not
emit events, do not mutate ``applied_substage``. Cache refresh is
T3a's recompute helper, invoked by writer modules only.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def get_applied_state(session: Session, app_id: int, user_id: int) -> dict[str, Any]:
    """Assemble the full Applied-stage state document for one application.

    Mirrors the ``AppliedStateOut`` shape in
    ``backend.models.applied_models``. Includes submission record,
    snapshot, confirmation record, follow-up plan, SLA tracker, contacts,
    and computed completion. Performs an ownership check: raises if
    ``app.user_id != user_id`` or the row does not exist.
    """
    raise NotImplementedError("T3b owns this function")
