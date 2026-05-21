"""Follow-up templates.

Owner task: T3f.

Decision D2: ship the two PRD templates verbatim for v1
(``gentle_nudge``, ``detailed_check_in``). No AI calls, no
persistence. The ``{{contact_first_name}}`` / ``{{role_title}}``
placeholders are a forward-looking convention; v1 returns the body
literally and clients copy/edit before sending. A future renderer
service will substitute them server-side.
"""
from __future__ import annotations

from typing import Any


_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "gentle_nudge",
        "label": "Gentle Nudge",
        "description": "Best for 3-5 days after last contact.",
        "body": (
            "Hi {{contact_first_name}}, I hope your week is going well. "
            "I'm just following up on my application for the {{role_title}} role. "
            "I'm still very excited about the opportunity and look forward to "
            "hearing from you."
        ),
    },
    {
        "id": "detailed_check_in",
        "label": "Detailed Check-In",
        "description": "Best for 7+ days or after a milestone.",
        "body": (
            "Dear {{contact_first_name}}, following up on our previous "
            "conversation regarding the {{role_title}} position. I'd love to "
            "hear about any updates and am happy to provide additional "
            "materials if helpful."
        ),
    },
]


def list_follow_up_templates() -> list[dict[str, Any]]:
    """Return the v1 deterministic template catalogue.

    Each item matches ``FollowUpTemplateOut`` (id, label, description, body).
    The returned list is a shallow copy so callers cannot mutate the
    module-level singleton.
    """
    return [dict(tpl) for tpl in _TEMPLATES]
