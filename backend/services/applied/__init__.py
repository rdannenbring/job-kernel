"""Applied stage service layer.

One module per concern so multiple agents can implement them in parallel
without single-writer collisions. Each module owns its public functions; do
not cross-import bodies between modules unless re-exporting through this
file.

Decision log references (see ``nimbalyst-local/plans/applied-stage.md``):
- D1: contact alias (title -> role) is handled by Pydantic in
  ``backend.models.applied_models``, not here.
- D3: snapshot immutability enforced in ``submission.save_submission``.
- D4: overdue cached in ``follow_up_plan_json.status``; recompute on read.
- D5: every writer calls ``derivations.recompute_substage_cache`` at the
  end of its write path.
- D6: ``derivations.compute_sla`` returns ``None`` when no baseline exists;
  the route handler maps that to HTTP 404.

Stub status: every function in every submodule below currently raises
``NotImplementedError``. Each will be filled in by its owner task
(T3a-T3h) per the orchestration plan in
``nimbalyst-local/plans/applied-stage.md`` section 13.6.
"""
from . import (
    contact,
    confirmation,
    derivations,
    follow_up,
    state,
    submission,
    templates,
    transition,
)

__all__ = [
    "contact",
    "confirmation",
    "derivations",
    "follow_up",
    "state",
    "submission",
    "templates",
    "transition",
]
