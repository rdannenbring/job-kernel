// T15: Wires the Submitted substage panel to GET /applied and the
// PUT /applied/submission endpoint. Backend-data driven; the friction
// note form posts a new note via PUT /applied/submission and refreshes
// the shared state.
import React, { useState } from 'react';

const ISSUE_TYPE_LABELS = {
  ux_dark_pattern: 'UX Dark Pattern',
  account_required: 'Forced Account Creation',
  duplicate_entry: 'Duplicate Data Entry',
  slow_portal: 'Slow Portal',
  other: 'Other',
};

function formatDateOrDash(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function SubmittedTab({
  app,
  appliedState,
  refreshAppliedState,
  apiUrl,
  fetchWithAuth,
}) {
  const submission = appliedState?.submission_record || null;
  const snapshot = appliedState?.submission_snapshot || null;
  const frictionNotes = submission?.friction_notes || [];

  const [issueType, setIssueType] = useState('ux_dark_pattern');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submitFrictionNote = async () => {
    if (!description.trim() || !app?.id) return;
    setSaving(true);
    setError(null);
    try {
      // Re-PUT the full submission record with the appended friction note.
      // The service preserves existing notes (matched by id) and assigns
      // server-side id + created_at to new entries.
      const incomingNotes = [
        ...frictionNotes,
        { issue_type: issueType, description: description.trim() },
      ];
      const payload = {
        applied_at: submission?.applied_at || new Date().toISOString(),
        channel: submission?.channel || 'direct',
        portal_type: submission?.portal_type,
        portal_name: submission?.portal_name,
        referral_status: submission?.referral_status,
        submitted_by: submission?.submitted_by,
        notes: submission?.notes,
        friction_notes: incomingNotes,
      };
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/submission`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      setDescription('');
      await refreshAppliedState();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Application Submission</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', border: '1px solid var(--border-color)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>edit_note</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Submission Record (now backend-driven) */}
        <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission Record</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                <span className="material-symbols-outlined">event_available</span>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Applied On</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateOrDash(submission?.applied_at)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                <span className="material-symbols-outlined">hub</span>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Application Channel</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{submission?.channel || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Portal Used</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {submission?.portal_name || submission?.portal_type || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Referral Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{submission?.referral_status || 'None'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Snapshot — historical lock only shown when snapshot exists */}
        <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
          {snapshot && (
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>lock</span>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Historical Lock</span>
            </div>
          )}
          <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Snapshot: What you submitted</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {snapshot ? (
              <>
                {snapshot.submitted_version_label && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Version: <span style={{ color: 'var(--text-primary)' }}>{snapshot.submitted_version_label}</span></div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {snapshot.resume_asset_id && <div>Resume asset #{snapshot.resume_asset_id}</div>}
                  {snapshot.cover_letter_asset_id && <div>Cover letter asset #{snapshot.cover_letter_asset_id}</div>}
                  {snapshot.portfolio_asset_id && <div>Portfolio asset #{snapshot.portfolio_asset_id}</div>}
                </div>
                {snapshot.captured_at && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Captured: {formatDateOrDash(snapshot.captured_at)}</div>
                )}
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                  Documents are archived in the state they were sent. Updating your global profile will not affect this historical snapshot.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                No snapshot captured yet. Save your submission with a snapshot to lock the submitted documents.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Friction Notes — now persisted via PUT /applied/submission */}
      <div className="card glass" style={{ padding: '1.5rem 2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>warning</span>
            <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission Friction Notes</h4>
          </div>
        </div>

        {/* Add new note */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Issue Type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'var(--text-primary)' }}
            >
              {Object.entries(ISSUE_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened?"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            type="button"
            onClick={submitFrictionNote}
            disabled={!description.trim() || saving}
            style={{
              padding: '0.6rem 1rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.8rem',
              background: 'var(--primary-color)', color: 'white', border: 'none',
              cursor: (!description.trim() || saving) ? 'not-allowed' : 'pointer',
              opacity: (!description.trim() || saving) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
            {saving ? 'Saving…' : 'Log Friction Point'}
          </button>
        </div>
        {error && (
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.5rem', color: '#f43f5e', fontSize: '0.75rem' }}>
            {error}
          </div>
        )}

        {/* Existing notes */}
        {frictionNotes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No friction notes logged yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {frictionNotes.map((note) => (
              <div key={note.id || note.description} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '2rem', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '0.25rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '4px', color: '#f43f5e', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                    {ISSUE_TYPE_LABELS[note.issue_type] || note.issue_type}
                  </div>
                  {note.created_at && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {formatDateOrDash(note.created_at)}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{note.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
