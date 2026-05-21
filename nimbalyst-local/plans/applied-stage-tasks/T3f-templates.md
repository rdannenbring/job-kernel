---
task: T3f
title: Follow-up templates (v1 deterministic)
plan: ../applied-stage.md
phase: A2
priority: 6
owner: backend
single_writer: backend/services/applied/templates.py
estimated_loc: ~40
status: ready
dispatchable: after T3.0 merged (independent of T3a)
depends_on: [T2, T3.0]
unlocks: [T10, T17]
---

# T3f — Follow-up templates

## 1. Purpose

Ship the two PRD-mandated v1 templates verbatim (D2). Pure static data — no DB, no AI.

## 2. Single-writer scope

Only `backend/services/applied/templates.py`.

## 3. Exact deliverables

Implement `list_follow_up_templates() -> list[dict[str, Any]]`.

Return a list of exactly two dicts matching `FollowUpTemplateOut` (id, label, description, body):

```python
{
    "id": "gentle_nudge",
    "label": "Gentle Nudge",
    "description": "Best for 3-5 days after last contact.",
    "body": "Hi {{contact_first_name}}, I hope your week is going well. I'm just following up on my application for the {{role_title}} role. I'm still very excited about the opportunity and look forward to hearing from you.",
}
```

and

```python
{
    "id": "detailed_check_in",
    "label": "Detailed Check-In",
    "description": "Best for 7+ days or after a milestone.",
    "body": "Dear {{contact_first_name}}, following up on our previous conversation regarding the {{role_title}} position. I'd love to hear about any updates and am happy to provide additional materials if helpful.",
}
```

Template-variable syntax (`{{...}}`) is a forward-looking convention. v1 returns the body literally; v2 will substitute. Routes (T10) and the frontend (T17) consume the body as-is for v1.

## 4. Do NOT touch

- Do not call any AI service or do any substitution.
- Do not persist these templates anywhere — they are static module-level data.
- Do not parameterize the count; ship exactly two templates per D2.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/templates.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/templates.py

backend/.venv/bin/python -c "
from backend.services.applied.templates import list_follow_up_templates
t = list_follow_up_templates()
assert len(t) == 2
ids = {x['id'] for x in t}
assert ids == {'gentle_nudge', 'detailed_check_in'}, ids
for tpl in t:
    assert set(tpl) >= {'id', 'label', 'description', 'body'}
print('templates: OK')
"
```

## 6. Definition of Done

- One file changed. Both template IDs present with all four keys. ruff + mypy pass.
