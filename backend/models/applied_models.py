"""Pydantic contracts for the Applied stage API.

All models defined here are the canonical request/response shapes for
``/api/applications/{application_id}/applied/*`` endpoints. Do not redefine
any of these in route handlers or service modules.

Datetime convention: every datetime field is UTC-aware. Naive datetimes (no
``tzinfo``) are rejected with a 422 by the ``UTCDateTime`` annotated type;
non-UTC offsets are normalized to UTC.

Field aliasing (decision D1): ``AppliedContactIn.role`` / ``AppliedContactOut.role``
expose the field as ``title`` to the API via Pydantic's alias. The DB column
``application_contacts.role`` is intentionally not renamed; the alias bridges
the API surface to the legacy column name.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from pydantic import (
    AnyUrl,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    AfterValidator,
)


def _ensure_utc(value: datetime) -> datetime:
    """Reject naive datetimes; normalize tz-aware ones to UTC."""
    if value.tzinfo is None:
        raise ValueError(
            "datetime must be timezone-aware (UTC); naive datetimes are rejected"
        )
    return value.astimezone(timezone.utc)


# Reusable UTC-aware datetime type — apply everywhere instead of bare datetime.
UTCDateTime = Annotated[datetime, AfterValidator(_ensure_utc)]


# ─── Submission ─────────────────────────────────────────────────────────────


class FrictionNoteIn(BaseModel):
    """One UX/friction observation captured at submission time."""

    issue_type: str
    description: str


class FrictionNoteOut(FrictionNoteIn):
    """Persisted friction note — server-assigned id and timestamp."""

    id: str
    created_at: UTCDateTime


class SubmissionSnapshotIn(BaseModel):
    """Optional snapshot payload accepted on the *initial* submission save."""

    resume_asset_id: Optional[int] = None
    cover_letter_asset_id: Optional[int] = None
    portfolio_asset_id: Optional[int] = None
    submitted_version_label: Optional[str] = None


class SubmissionSnapshotOut(BaseModel):
    """Persisted, immutable snapshot of the submitted assets."""

    resume_asset_id: Optional[int] = None
    cover_letter_asset_id: Optional[int] = None
    portfolio_asset_id: Optional[int] = None
    submitted_version_label: Optional[str] = None
    historical_lock: bool = True
    captured_at: UTCDateTime


class SubmissionRecordIn(BaseModel):
    """Input for ``PUT /applied/submission``.

    The optional ``snapshot`` is only honored on the first save; subsequent
    saves that include it are rejected by the service layer per D3.
    """

    applied_at: UTCDateTime
    channel: str
    portal_type: Optional[str] = None
    portal_name: Optional[str] = None
    referral_status: Optional[str] = None
    submitted_by: Optional[str] = None
    notes: Optional[str] = None
    friction_notes: list[FrictionNoteIn] = Field(default_factory=list)
    snapshot: Optional[SubmissionSnapshotIn] = None


class SubmissionRecordOut(BaseModel):
    """Persisted submission record returned by ``GET /applied`` etc."""

    applied_at: UTCDateTime
    channel: str
    portal_type: Optional[str] = None
    portal_name: Optional[str] = None
    referral_status: Optional[str] = None
    submitted_by: Optional[str] = None
    notes: Optional[str] = None
    friction_notes: list[FrictionNoteOut] = Field(default_factory=list)


class SubmissionOut(BaseModel):
    """Envelope returned by ``PUT /applied/submission``."""

    ok: bool = True
    applied_substage: str
    submission_record: SubmissionRecordOut
    submission_snapshot: Optional[SubmissionSnapshotOut] = None


# ─── Receipts / Confirmation ────────────────────────────────────────────────


class ReceiptAssetOut(BaseModel):
    """Persisted ``applied_assets`` row returned by the upload endpoint."""

    id: int
    application_id: int
    asset_type: str
    mime_type: str
    original_filename: str
    uploaded_at: UTCDateTime
    file_hash: str


class ConfirmationRecordIn(BaseModel):
    """Input for ``PUT /applied/confirmation``."""

    confirmation_number: Optional[str] = None
    confirmed_at: UTCDateTime
    source_type: Optional[str] = None
    receipt_asset_id: Optional[int] = None


class ConfirmationRecordOut(BaseModel):
    """Persisted confirmation record returned to clients."""

    confirmation_number: Optional[str] = None
    confirmed_at: UTCDateTime
    source_type: Optional[str] = None
    receipt_asset_id: Optional[int] = None
    receipt_mime_type: Optional[str] = None
    receipt_uploaded_at: Optional[UTCDateTime] = None


class ConfirmationOut(BaseModel):
    """Envelope returned by ``PUT /applied/confirmation``."""

    ok: bool = True
    applied_substage: str
    confirmation_record: ConfirmationRecordOut
    sla_tracker: Optional["SLATrackerOut"] = None


# ─── Follow-up plan + send-log ──────────────────────────────────────────────


class FollowUpPlanIn(BaseModel):
    """Input for ``PUT /applied/follow-up-plan``."""

    due_at: Optional[UTCDateTime] = None
    recommended_template_id: Optional[str] = None
    last_contact_at: Optional[UTCDateTime] = None


class FollowUpPlanOut(BaseModel):
    """Persisted follow-up plan returned by reads + mutations."""

    due_at: Optional[UTCDateTime] = None
    status: str
    recommended_template_id: Optional[str] = None
    last_contact_at: Optional[UTCDateTime] = None
    days_since_last_contact: Optional[int] = None
    overdue_days: int = 0
    completed_at: Optional[UTCDateTime] = None


class FollowUpSentIn(BaseModel):
    """Input for ``POST /applied/follow-up/send-log``."""

    sent_at: UTCDateTime
    channel: Optional[str] = None
    template_id: Optional[str] = None
    message_excerpt: Optional[str] = None


class FollowUpSentOut(BaseModel):
    """Envelope returned by ``POST /applied/follow-up/send-log``."""

    ok: bool = True
    applied_substage: str
    follow_up_plan: FollowUpPlanOut


class FollowUpTemplateOut(BaseModel):
    """Single follow-up template entry."""

    id: str
    label: str
    description: str
    body: str


# ─── Contacts ───────────────────────────────────────────────────────────────


class AppliedContactIn(BaseModel):
    """Input for ``PUT /applied/contact``.

    The API surface field is ``title`` (PRD); the underlying DB column is
    ``role`` (decision D1). ``populate_by_name=True`` accepts either spelling
    on input; ``model_dump(by_alias=True)`` emits ``title``.
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str
    role: Optional[str] = Field(default=None, alias="title")
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    linkedin_url: Optional[AnyUrl] = None
    is_hiring_manager: bool = False
    source: Optional[str] = None


class AppliedContactOut(BaseModel):
    """Persisted contact returned by reads + mutations.

    Same ``role``/``title`` aliasing as :class:`AppliedContactIn`.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: int
    name: str
    role: Optional[str] = Field(default=None, alias="title")
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    linkedin_url: Optional[AnyUrl] = None
    is_hiring_manager: bool = False
    source: Optional[str] = None


# ─── SLA ────────────────────────────────────────────────────────────────────


class SLAMilestoneOut(BaseModel):
    """One milestone entry inside the SLA tracker."""

    days: int
    label: str
    reached: bool
    reached_at: Optional[UTCDateTime] = None


class SLATrackerOut(BaseModel):
    """Persisted SLA snapshot returned by ``GET /applied/sla`` and embedded reads."""

    baseline_date: UTCDateTime
    days_elapsed: int
    milestones: list[SLAMilestoneOut]
    current_state: str
    alert_level: str
    next_recommended_action: str


# ─── Activity log ───────────────────────────────────────────────────────────


class ActivityLogItemOut(BaseModel):
    """One row from ``application_events`` rendered for the timeline."""

    id: int
    event_type: str
    actor: Optional[str] = None
    title: Optional[str] = None
    substage: Optional[str] = None
    timestamp: UTCDateTime
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActivityLogPageOut(BaseModel):
    """Paged response from ``GET /applied/activity-log``."""

    items: list[ActivityLogItemOut]
    total: int
    limit: int
    offset: int


# ─── Next steps + transition ────────────────────────────────────────────────


class NextStepsOut(BaseModel):
    """Response shape for ``GET /applied/next-steps``."""

    can_transition: bool
    readiness_score: int
    reasons_met: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    recommended_action: str
    # Whether the user opted into guided mode for the Applied stage. When
    # False (the default), the readiness signals above are advisory only and
    # the transition endpoint will not refuse the move.
    enforced: bool = False


class TransitionResultOut(BaseModel):
    """Response shape for ``POST /applied/transition-to-interviewing``."""

    ok: bool = True
    pipeline_stage: str


# ─── Completion + top-level Applied state ───────────────────────────────────


class CompletionSubstageOut(BaseModel):
    """Per-substage completion flag inside :class:`CompletionOut`."""

    id: str
    complete: bool


class CompletionOut(BaseModel):
    """Aggregate completion view for the Applied stage."""

    percentage: int
    substages: list[CompletionSubstageOut]


class AppliedStateOut(BaseModel):
    """Top-level response for ``GET /applied``.

    Every nested document is optional because a freshly-promoted application
    has none of them populated yet. Endpoints that mutate state return
    fully-populated subtrees in their own envelopes (e.g. :class:`SubmissionOut`).
    """

    application_id: int
    pipeline_stage: str
    applied_substage: Optional[str] = None
    submission_record: Optional[SubmissionRecordOut] = None
    submission_snapshot: Optional[SubmissionSnapshotOut] = None
    confirmation_record: Optional[ConfirmationRecordOut] = None
    follow_up_plan: Optional[FollowUpPlanOut] = None
    sla_tracker: Optional[SLATrackerOut] = None
    contacts: list[AppliedContactOut] = Field(default_factory=list)
    completion: CompletionOut


# Resolve forward reference on ConfirmationOut.sla_tracker
ConfirmationOut.model_rebuild()
