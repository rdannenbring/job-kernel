---
task: T1
title: Schema + SQLAlchemy model deltas for Applied stage
plan: ../applied-stage.md
phase: A1
owner: backend
single_writer: backend/services/database_service.py
estimated_loc: ~80 added (no edits to existing)
status: merged
dispatchable: complete
merged_commit: b92938d117b46b0ca8399df7550852216faf859a
merged_at: 2026-05-21T17:48:36.000Z
---
# T1 — Schema + SQLAlchemy model deltas

You are a subordinate coding agent. Read this entire packet before touching code. The parent plan is at `nimbalyst-local/plans/applied-stage.md`; you do not need to read it cover-to-cover, but §4 ("Recommended data model changes") and §13.6 (your "Do not touch" rules) are authoritative when they conflict with anything here.

## 1. Purpose

Persist the Applied stage's new state fields on existing tables, extend `application_events` and `application_contacts`, and create the new `applied_assets` table. Every later backend task (T2 onward) imports from the SQLAlchemy classes you update here.

## 2. Single-writer scope

You are the **only agent** writing `backend/services/database_service.py` for this entire Applied-stage initiative. Do not split this into multiple edits across multiple sessions. Land it as one PR.

## 3. Exact deliverables

### 3a. Append migrations to `_migrate_schema()` (file: `backend/services/database_service.py:551`)

Append the following entries to the `migrations` list inside `_migrate_schema()`, **at the bottom**, in the order shown. Do not modify, reorder, or delete any existing entry.

```python
# ── Applied stage (added 2026-05-21) ────────────────────────────────────────
"ALTER TABLE applications ADD COLUMN applied_substage TEXT",
"ALTER TABLE applications ADD COLUMN submission_record_json TEXT",
"ALTER TABLE applications ADD COLUMN submission_snapshot_json TEXT",
"ALTER TABLE applications ADD COLUMN confirmation_record_json TEXT",
"ALTER TABLE applications ADD COLUMN follow_up_plan_json TEXT",
"ALTER TABLE applications ADD COLUMN sla_tracker_json TEXT",

"ALTER TABLE application_events ADD COLUMN actor TEXT",
"ALTER TABLE application_events ADD COLUMN title TEXT",
"ALTER TABLE application_events ADD COLUMN metadata_json TEXT",
"ALTER TABLE application_events ADD COLUMN related_asset_id INTEGER",
"ALTER TABLE application_events ADD COLUMN substage TEXT",

# Per decision D1: keep existing `role` column; expose as `title` via Pydantic alias in T2.
"ALTER TABLE application_contacts ADD COLUMN is_hiring_manager INTEGER DEFAULT 0",
"ALTER TABLE application_contacts ADD COLUMN source TEXT",

"""
CREATE TABLE IF NOT EXISTS applied_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  created_by_user_id INTEGER,
  FOREIGN KEY(application_id) REFERENCES applications(id)
)
""",
"CREATE INDEX IF NOT EXISTS idx_applied_assets_app ON applied_assets(application_id)",
```

The existing per-statement `try/except` already swallows "duplicate column" errors, so re-running on a partially-migrated DB is safe.

### 3b. Extend SQLAlchemy model classes

Add columns at the **bottom** of each existing class (preserve historical ordering for diffability):

**`Application` (currently at `database_service.py:28`):** add inside the class body, right before the `# Relationships` comment near line 107:
```python
# Applied stage (added 2026-05-21)
applied_substage = Column(String(64), nullable=True)
submission_record_json = Column(Text, nullable=True)
submission_snapshot_json = Column(Text, nullable=True)
confirmation_record_json = Column(Text, nullable=True)
follow_up_plan_json = Column(Text, nullable=True)
sla_tracker_json = Column(Text, nullable=True)
```
Then in the relationship block, add:
```python
applied_assets = relationship("AppliedAsset", back_populates="application", cascade="all, delete-orphan")
```

**`ApplicationEvent` (currently at `database_service.py:140`):** append columns before the `application = relationship(...)` line:
```python
# Applied stage (added 2026-05-21)
actor = Column(String(32), nullable=True)            # 'user' | 'agent' | 'system'
title = Column(String(255), nullable=True)
metadata_json = Column(Text, nullable=True)
related_asset_id = Column(Integer, nullable=True)
substage = Column(String(64), nullable=True)
```

**`ApplicationContact` (currently at `database_service.py:125`):** append columns before the `application = relationship(...)` line:
```python
# Applied stage (added 2026-05-21)
is_hiring_manager = Column(Boolean, default=False)
source = Column(String, nullable=True)
```

### 3c. New `AppliedAsset` class

Insert immediately **after** the `ApplicationEvent` class (so it's near related models, before `UserProfile` at line 150):

```python
class AppliedAsset(Base):
    __tablename__ = 'applied_assets'

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey('applications.id'), nullable=False, index=True)
    asset_type = Column(String(64), nullable=False)              # 'receipt', 'screenshot', etc.
    file_path = Column(String(1024), nullable=False)
    mime_type = Column(String(128), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(128), nullable=False)              # 'sha256:<hex>'
    uploaded_at = Column(String(64), nullable=False)             # ISO-8601 UTC
    created_by_user_id = Column(Integer, nullable=True)

    application = relationship("Application", back_populates="applied_assets")
```

## 4. Do NOT touch

- **Do not reorder, edit, or delete** any existing entry in the `migrations` list. Only append.
- **Do not** drop or rename any existing column on `applications`, `application_events`, or `application_contacts`. SQLite cannot drop columns inline anyway.
- **Do not rename `application_contacts.role` to `title`.** Decision D1 keeps `role` and aliases at the API layer (Pydantic, T2). Renaming would require a table rebuild.
- **Do not** modify `User`, `UserProfile`, `UserExperience`, `UserEducation`, `LinkedInConnection`, `Config`, `UserApiKey`, or `Notification`.
- **Do not** modify the `DatabaseService` class or any of its existing methods (`_log_event`, `create_notification`, `update_application`, etc.). T3 will add new service code in a different package.
- **Do not** write any new service functions, endpoints, Pydantic models, or tests in this task. Schema only.
- **Do not** touch `applications.db`, `applications.db.backup-20260420-010305`, `backend/applications.db`, or `job_kernel.db`. Migrations run automatically on next service start; you do not run them manually.
- **Do not** add Alembic, alembic.ini, or any migration framework. The append-only list pattern is the repo convention.
- **Do not** add or change indexes on existing columns. The only new index is `idx_applied_assets_app`.

## 5. Verification (must all pass before marking complete)

Run from repo root:

```bash
# 5a. Python parses cleanly
python -c "from backend.services.database_service import DatabaseService, Application, ApplicationEvent, ApplicationContact, AppliedAsset; print('OK')"

# 5b. Schema migration applies idempotently against a fresh DB
DATABASE_URL="sqlite:///$(mktemp -u --suffix=.db)" python -c "
from backend.services.database_service import DatabaseService
db = DatabaseService()
db._migrate_schema()
db._migrate_schema()  # second call must be a no-op
print('migrations idempotent')
"

# 5c. New columns visible on existing DB
DB=applications.db
python -c "
from backend.services.database_service import DatabaseService
DatabaseService()  # triggers _migrate_schema
"
sqlite3 "$DB" "PRAGMA table_info(applications)" | grep -E 'applied_substage|submission_record_json|submission_snapshot_json|confirmation_record_json|follow_up_plan_json|sla_tracker_json' | wc -l
# Expect: 6

sqlite3 "$DB" "PRAGMA table_info(application_events)" | grep -E 'actor|title|metadata_json|related_asset_id|substage' | wc -l
# Expect: 5

sqlite3 "$DB" "PRAGMA table_info(application_contacts)" | grep -E 'is_hiring_manager|source' | wc -l
# Expect: 2

sqlite3 "$DB" ".schema applied_assets" | grep -c "file_hash"
# Expect: 1

# 5d. App boots end-to-end (no migration crash)
cd backend && timeout 10 python -c "
import main  # importing the FastAPI app triggers DatabaseService() initialization
print('boot ok')
" && cd ..
```

All four checks must return the expected values. Report each command's actual output in the PR description.

## 6. Definition of Done

- All edits constrained to `backend/services/database_service.py`.
- `git diff --stat` shows exactly one file changed.
- All four verifications in §5 pass.
- The PR description quotes the SQL block actually appended (so reviewers can diff against §3a here).
- No new files created.

## 7. After-the-fact note for orchestrator

When T1 merges, dispatch T2 (`T2-pydantic-models.md`). T2 imports the new ORM fields you exposed.
