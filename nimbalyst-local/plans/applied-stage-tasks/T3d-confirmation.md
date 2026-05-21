---
task: T3d
title: Confirmation service + receipt upload
plan: ../applied-stage.md
phase: A2
priority: 4
owner: backend
single_writer: backend/services/applied/confirmation.py
estimated_loc: ~170
status: ready
dispatchable: after T3a merged
depends_on: [T1, T2, T3.0, T3a]
unlocks: [T7a, T7b, T16]
---

# T3d — Confirmation + receipt upload

## 1. Purpose

Two service functions: `upload_receipt` (multipart -> hashed `applied_assets` row) and `save_confirmation` (record + receipt linkage + SLA initialization). Both refresh the substage cache.

## 2. Single-writer scope

Only `backend/services/applied/confirmation.py`.

## 3. Exact deliverables

### 3a. `upload_receipt(session, app_id, file, user_id) -> dict[str, Any]`

`file` is a FastAPI `UploadFile`-like object exposing `.filename`, `.content_type`, `.file` (binary stream) — type-hint as `Any` (matches stub).

MIME allow-list (PRD §3 + plan §13.6 T3d Do-not):
- `image/png`
- `image/jpeg`
- `application/pdf`
Reject any other type with `ValueError("unsupported mime type")` (route -> 415 or 400).

Steps:

1. Load app + ownership check.
2. Read the file bytes once into memory.
3. Compute SHA-256 hash: `"sha256:" + hashlib.sha256(content).hexdigest()`.
4. Save to disk under `UPLOADS_DIR/applied_receipts/<timestamp>_<safe_filename>` (mirror the pattern in `main.py:657`). `UPLOADS_DIR` resolves from `os.environ.get("DOCUMENTS_STORAGE_PATH", ".") + "/uploads"` — duplicate this constant inline since the existing definition is in `main.py` and we must not import from there.
5. Insert a new `AppliedAsset` row with all fields populated.
6. Return the asset row dict matching `ReceiptAssetOut`.

Do NOT update any column on `applications`. Receipt assets are independent until `save_confirmation` links them.

### 3b. `save_confirmation(session, app_id, payload, user_id) -> dict[str, Any]`

Steps:

1. Validate payload via `ConfirmationRecordIn.model_validate(payload)`.
2. Load app + ownership check.
3. If `payload.receipt_asset_id` is provided, fetch the asset and verify `asset.application_id == app_id`. Reject with `ValueError("receipt belongs to a different application")` otherwise.
4. Build the persisted `ConfirmationRecordOut` dict:
   - `confirmation_number`, `confirmed_at`, `source_type` from payload
   - `receipt_asset_id` from payload
   - `receipt_mime_type` and `receipt_uploaded_at` resolved from the linked asset (if any)
   Persist as `confirmation_record_json` via `model_dump_json()`.
5. Compute fresh `sla_tracker_json` via `derivations.compute_sla(app)` and persist (if not `None`).
6. Emit `confirmation_saved` event.
7. Call `derivations.recompute_substage_cache(session, app_id)`.
8. Return dict matching `ConfirmationOut`.

## 4. Do NOT touch

- Do not skip the MIME allow-list. PRD §3 + acceptance criteria are explicit.
- Do not store the receipt file path in `confirmation_record_json`. That belongs to `applied_assets`.
- Do not allow `receipt_asset_id` cross-application linkage.
- Do not commit the session.
- Do not modify any other service module.

## 5. Verification

```bash
backend/.venv/bin/ruff check backend/services/applied/confirmation.py
backend/.venv/bin/mypy --strict --no-incremental backend/services/applied/confirmation.py

TMPDB=$(mktemp -u --suffix=.db)
DATABASE_URL="sqlite:///$TMPDB" DOCUMENTS_STORAGE_PATH=/tmp backend/.venv/bin/python <<'PY'
from datetime import datetime, timezone
from io import BytesIO
from services.database_service import DatabaseService, Application
from backend.services.applied.confirmation import upload_receipt, save_confirmation

class FakeUpload:
    def __init__(self, name, ct, content):
        self.filename = name; self.content_type = ct; self.file = BytesIO(content)

db = DatabaseService(); s = db.Session()
now = datetime.now(timezone.utc).isoformat()
app = Application(job_title='x', company='y', user_id=42, pipeline_stage='applied',
                  submission_record_json='{"applied_at":"%s","channel":"direct"}' % now)
s.add(app); s.flush()

# Happy path: PDF accepted
asset = upload_receipt(s, app.id, FakeUpload("a.pdf", "application/pdf", b"%PDF-1.7\n..."), user_id=42)
assert asset["mime_type"] == "application/pdf"
assert asset["file_hash"].startswith("sha256:")
print("receipt PDF: OK")

# MIME reject
try:
    upload_receipt(s, app.id, FakeUpload("a.exe", "application/x-msdownload", b"MZ..."), user_id=42)
    raise AssertionError("MIME allow-list not enforced")
except ValueError:
    print("MIME reject: OK")

# Save confirmation, link the receipt
out = save_confirmation(s, app.id, {"confirmed_at": now, "receipt_asset_id": asset["id"]}, user_id=42)
assert out["applied_substage"] == "confirmed"
assert out["confirmation_record"]["receipt_asset_id"] == asset["id"]
assert out["sla_tracker"] is not None

# Cross-app rejection
app2 = Application(job_title='z', company='z', user_id=42, pipeline_stage='applied')
s.add(app2); s.flush()
try:
    save_confirmation(s, app2.id, {"confirmed_at": now, "receipt_asset_id": asset["id"]}, user_id=42)
    raise AssertionError("cross-app receipt linkage allowed")
except ValueError:
    print("cross-app reject: OK")
PY
rm -f "$TMPDB"
```

## 6. Definition of Done

- One file changed. All MIME + cross-app + happy-path verifications pass.

## 7. After-the-fact note

T3e next.
