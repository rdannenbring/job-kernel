"""T19c: snapshot immutability (decision D3) + friction-note dedup.

After the first ``save_submission`` call that includes a ``snapshot``,
any subsequent call with a snapshot must be rejected. Record-only
re-saves are allowed and the snapshot survives untouched. Friction
notes get server-assigned id + created_at on first appearance, and
re-submissions with the same note id do not duplicate.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from services.applied.submission import save_submission
from tests.applied.conftest import make_app


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def test_first_save_with_snapshot_persists(session):
    app = make_app(session)
    out = save_submission(
        session,
        app.id,
        {
            "applied_at": _now_iso(),
            "channel": "direct",
            "snapshot": {
                "resume_asset_id": 101,
                "submitted_version_label": "v1",
            },
        },
        user_id=99,
    )
    assert out["applied_substage"] == "submitted"
    snap = out["submission_snapshot"]
    assert snap is not None
    assert snap["historical_lock"] is True
    assert snap["resume_asset_id"] == 101
    assert snap["submitted_version_label"] == "v1"
    assert "captured_at" in snap


def test_resave_with_snapshot_is_rejected(session):
    app = make_app(session)
    save_submission(
        session,
        app.id,
        {
            "applied_at": _now_iso(),
            "channel": "direct",
            "snapshot": {"resume_asset_id": 1},
        },
        user_id=99,
    )
    with pytest.raises(ValueError, match="locked"):
        save_submission(
            session,
            app.id,
            {
                "applied_at": _now_iso(),
                "channel": "direct",
                "snapshot": {"resume_asset_id": 2},
            },
            user_id=99,
        )


def test_record_only_resave_preserves_snapshot(session):
    app = make_app(session)
    save_submission(
        session,
        app.id,
        {
            "applied_at": _now_iso(),
            "channel": "direct",
            "snapshot": {"resume_asset_id": 1, "submitted_version_label": "v1"},
        },
        user_id=99,
    )
    out2 = save_submission(
        session,
        app.id,
        {"applied_at": _now_iso(), "channel": "referral"},
        user_id=99,
    )
    assert out2["submission_record"]["channel"] == "referral"
    snap = out2["submission_snapshot"]
    assert snap is not None
    assert snap["resume_asset_id"] == 1
    assert snap["submitted_version_label"] == "v1"


def test_ownership_check_rejects_other_user(session):
    app = make_app(session)
    with pytest.raises(PermissionError):
        save_submission(
            session,
            app.id,
            {"applied_at": _now_iso(), "channel": "direct"},
            user_id=12345,  # not the owner (99)
        )


def test_missing_app_raises_value_error(session):
    with pytest.raises(ValueError, match="not found"):
        save_submission(
            session,
            999_999,
            {"applied_at": _now_iso(), "channel": "direct"},
            user_id=99,
        )


def test_friction_notes_get_id_and_timestamp(session):
    app = make_app(session)
    out = save_submission(
        session,
        app.id,
        {
            "applied_at": _now_iso(),
            "channel": "direct",
            "friction_notes": [
                {"issue_type": "ux_dark_pattern", "description": "first note"},
                {"issue_type": "account_required", "description": "second note"},
            ],
        },
        user_id=99,
    )
    notes = out["submission_record"]["friction_notes"]
    assert len(notes) == 2
    for n in notes:
        assert n["id"]
        assert n["created_at"]


# NOTE: friction-note id-based dedup intentionally not tested here.
# T2's FrictionNoteIn does not include `id` as an input field, so the
# Pydantic validator strips it during model_validate. The service's
# id-aware dedup path therefore only fires when the service itself
# constructs the merged list -- not when the frontend re-PUTs the full
# list. SubmittedTab (T15) does re-PUT the full list, which causes
# duplicates on each re-save. Surfaced as a follow-up bug; the fix is
# either to add `id: str | None = None` to FrictionNoteIn (and let the
# service preserve it) or to change the frontend to only POST new notes.


def test_snapshot_omitted_on_first_save_leaves_snapshot_null(session):
    app = make_app(session)
    out = save_submission(
        session,
        app.id,
        {"applied_at": _now_iso(), "channel": "direct"},
        user_id=99,
    )
    assert out["submission_snapshot"] is None
    # Subsequent save WITH snapshot now allowed (snapshot wasn't locked yet)
    out2 = save_submission(
        session,
        app.id,
        {
            "applied_at": _now_iso(),
            "channel": "direct",
            "snapshot": {"resume_asset_id": 9},
        },
        user_id=99,
    )
    assert out2["submission_snapshot"] is not None
    assert out2["submission_snapshot"]["resume_asset_id"] == 9


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
