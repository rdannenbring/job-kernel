"""Applied stage routes.

This package exposes one ``APIRouter`` shared by every Applied-stage
endpoint module. Each endpoint owns its own file under this package and
imports ``router`` from here to register itself.

Mounting happens in ``main.py`` via ``app.include_router(router)``.

Endpoint files (one per task):

- state.py            (T5)   GET    /
- submission.py       (T6)   PUT    /submission
- receipt.py          (T7a)  POST   /confirmation/receipt
- confirmation.py     (T7b)  PUT    /confirmation
- sla.py              (T8)   GET    /sla
- follow_up_plan.py   (T9a)  PUT    /follow-up-plan
- follow_up_sent.py   (T9b)  POST   /follow-up/send-log
- templates.py        (T10)  GET    /follow-up/templates
- contact.py          (T11)  PUT    /contact
- activity_log.py     (T12)  GET    /activity-log
- next_steps.py       (T13a) GET    /next-steps
- transition.py       (T13b) POST   /transition-to-interviewing
"""
from fastapi import APIRouter

router = APIRouter(
    prefix="/api/applications/{application_id}/applied",
    tags=["applied"],
)

# Endpoint modules register themselves on import. Each module owns its own
# file; if you are adding a new endpoint, create a new file and import it
# here (not inline).
from . import (  # noqa: E402, F401 -- side-effect imports
    activity_log,
    confirmation,
    contact,
    follow_up_plan,
    follow_up_sent,
    next_steps,
    receipt,
    sla,
    state,
    submission,
    templates,
    transition,
)
