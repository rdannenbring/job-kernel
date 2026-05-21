"""Derivations: pure functions over an Application row.

Owner task: T3a. Do not implement bodies here unless you are that task.

Imports allowed: stdlib only. This module MUST remain free of DB I/O so
its functions can be reused in tests, route handlers, and the background
sweeper (T14) without setting up a session. The substage-cache writer
``recompute_substage_cache`` is the only function permitted to take a
``Session`` -- it composes the pure ``determine_applied_substage`` with
a single targeted UPDATE.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


def determine_applied_substage(app_row: Any) -> str | None:
    """Return the current Applied substage, or ``None`` if the row is not
    in the Applied stage. Priority order per PRD section 'Substages':
    ``follow_up_sent`` > ``follow_up_due`` > ``confirmed`` > ``submitted``.
    """
    raise NotImplementedError("T3a owns this function")


def compute_completion(app_row: Any) -> dict[str, Any]:
    """Return ``{"percentage": int, "substages": [{"id": str, "complete": bool}, ...]}``.
    Weights are 25/25/25/25 per PRD section 'compute_applied_completion'.
    """
    raise NotImplementedError("T3a owns this function")


def compute_sla(app_row: Any) -> dict[str, Any] | None:
    """Return the SLA tracker dict, or ``None`` when no baseline exists
    (D6). Baseline = ``confirmation_record.confirmed_at`` else
    ``submission_record.applied_at``. Milestones: 7 / 14 / 21 days.
    """
    raise NotImplementedError("T3a owns this function")


def compute_next_steps(app_row: Any) -> dict[str, Any]:
    """Return ``{"can_transition": bool, "readiness_score": int,
    "reasons_met": list[str], "blockers": list[str],
    "recommended_action": str}`` per PRD section 'GET /applied/next-steps'.
    """
    raise NotImplementedError("T3a owns this function")


def recompute_substage_cache(session: Session, app_id: int) -> str | None:
    """Recompute ``determine_applied_substage`` and persist it onto
    ``applications.applied_substage`` (D5). Called at the end of every
    Applied write inside the writer modules. Returns the new substage.
    """
    raise NotImplementedError("T3a owns this function")
