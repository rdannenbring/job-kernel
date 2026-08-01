// T18: Wires the Follow-up Sent substage panel to:
//   GET  /applied/activity-log              (timeline events)
//   GET  /applied/next-steps                (readiness signals)
//   POST /applied/transition-to-interviewing (promote on click)
// Completion bar now reads appliedState.completion.percentage so the
// number lines up with the backend's derivation.
//
// Readiness is ADVISORY by default (see documentation/product-direction.md).
// The checklist always renders as suggestions, and Move to Interviewing stays
// enabled. Only when next_steps.enforced is true — i.e. the user turned on
// guided mode for the Applied stage in Settings — does an unmet checklist
// disable the button and surface the blocker list as a tooltip.
import React, { useCallback, useEffect, useState } from 'react';

const READINESS_LABEL = {
  follow_up_sent: 'Follow-up email sent',
  contact_exists: 'Contact person identified',
  response_window_met: '7+ days post-application reached',
  no_unresolved_blockers: 'No unresolved blockers',
};

function fmtDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return value;
  }
}

const EVENT_ICON = {
  follow_up_sent: 'send',
  follow_up_overdue: 'notifications_active',
  confirmation_saved: 'mail',
  submission_logged: 'edit_note',
  submission_snapshot_locked: 'lock',
  receipt_uploaded: 'receipt_long',
  contact_linked: 'person_add',
  moved_to_interviewing: 'forward',
};

export default function FollowUpSentTab({
  app,
  appliedState,
  refreshAppliedState,
  apiUrl,
  fetchWithAuth,
  completedCount,
  totalSubstages,
  onMoveToInterviewing,
  onStageChange,
}) {
  const completion = appliedState?.completion || null;
  // Prefer the backend-computed percentage; fall back to the legacy local count.
  const backendPct = completion?.percentage;
  const fallbackPct = totalSubstages > 0 ? Math.round((completedCount / totalSubstages) * 100) : 0;
  const percent = typeof backendPct === 'number' ? backendPct : fallbackPct;
  const isReady = percent >= 100;

  const [activity, setActivity] = useState([]);
  const [nextSteps, setNextSteps] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState(null);

  const fetchActivity = useCallback(async () => {
    if (!app?.id) return;
    try {
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/activity-log?limit=20`,
      );
      if (res.ok) {
        const body = await res.json();
        setActivity(body.items || []);
      }
    } catch (e) {
      console.error('Failed to load activity log', e);
    }
  }, [app?.id, apiUrl, fetchWithAuth]);

  const fetchNextSteps = useCallback(async () => {
    if (!app?.id) return;
    try {
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/next-steps`,
      );
      if (res.ok) setNextSteps(await res.json());
    } catch (e) {
      console.error('Failed to load next-steps', e);
    }
  }, [app?.id, apiUrl, fetchWithAuth]);

  useEffect(() => { fetchActivity(); fetchNextSteps(); }, [fetchActivity, fetchNextSteps]);

  const transition = async () => {
    if (!app?.id) return;
    setTransitioning(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/transition-to-interviewing`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Surface structured blocker info from the route (T13b detail shape).
        const detail = body?.detail;
        if (detail && typeof detail === 'object' && detail.blockers) {
          throw new Error(`Readiness checks not met: ${detail.blockers.join(', ')}`);
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      // Refresh and notify parent so the page swaps to the Interviewing stage.
      await refreshAppliedState();
      if (onStageChange) onStageChange('interviewing');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setTransitioning(false);
    }
  };

  const canTransition = nextSteps?.can_transition === true;
  const blockers = nextSteps?.blockers || [];
  // Guided mode is opt-in; absent an explicit `true` we never block.
  const enforced = nextSteps?.enforced === true;
  const blocked = enforced && !canTransition;
  const suggestionList = blockers.map((b) => READINESS_LABEL[b] || b).join(', ');
  const tooltip = canTransition
    ? 'All readiness checks met. Promote to Interviewing.'
    : (blockers.length
        ? (enforced
            ? `Guided mode is on. Blocked by: ${suggestionList}`
            : `Suggested first: ${suggestionList} — you can move on anyway.`)
        : 'Readiness assessment loading…');

  // All four checkbox items, with state from next_steps.
  const reasonsMet = new Set(nextSteps?.reasons_met || []);
  const readinessRows = [
    'follow_up_sent',
    'response_window_met',
    'contact_exists',
    'no_unresolved_blockers',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Follow-up Sent</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sub-stage: Activity confirmed.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.6rem 1rem', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.8rem' }}>View Job Description</button>
          <button className="btn-primary" style={{ padding: '0.6rem 1rem', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.8rem', boxShadow: '0 0 20px rgba(37, 106, 244, 0.3)' }}>Edit Application</button>
        </div>
      </div>

      <div className="card glass" style={{ padding: '1.5rem 2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Applied Phase Completion</p>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)' }}>{percent}%</p>
        </div>
        <div style={{ height: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary-color)', boxShadow: '0 0 10px var(--primary-color)' }}></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isReady ? 'var(--primary-color)' : 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', fontVariationSettings: isReady ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{isReady ? 'Ready to transition to Interviewing' : `${percent}% complete`}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        {/* Left Column: Activity Log — backend-driven */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Activity Log</h4>
            <button onClick={fetchActivity} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>Refresh</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activity.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No activity recorded yet.</p>
            ) : activity.map((ev) => (
              <div key={ev.id} className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', borderLeft: `4px solid var(--primary-color)`, display: 'flex', gap: '1.25rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                  <span className="material-symbols-outlined">{EVENT_ICON[ev.event_type] || 'history'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {ev.title || ev.event_type.replace(/_/g, ' ')}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{fmtDate(ev.timestamp)}</p>
                  </div>
                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                    </p>
                  )}
                  {ev.substage && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {ev.substage.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Next Steps — advisory unless guided mode is on */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid rgba(37, 106, 244, 0.2)', background: 'linear-gradient(to bottom right, rgba(37, 106, 244, 0.05), transparent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Next Steps</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {nextSteps ? `Readiness: ${nextSteps.readiness_score}% • Recommended: ${(nextSteps.recommended_action || '').replace(/_/g, ' ')}` : 'Loading readiness…'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {enforced ? 'Required before Interviewing' : 'Suggested before Interviewing'}
              </p>
              {nextSteps && !enforced && (
                <p style={{ margin: '-0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Optional — none of these block the move. Turn on guided mode in Settings to enforce them.
                </p>
              )}
              {readinessRows.map((k) => {
                const met = reasonsMet.has(k);
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '1.25rem', height: '1.25rem', borderRadius: '4px',
                      border: '1px solid var(--primary-color)',
                      background: met ? 'var(--primary-color)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {met && <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'white', fontWeight: 800 }}>check</span>}
                    </div>
                    <span style={{ fontSize: '0.85rem', color: met ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {READINESS_LABEL[k] || k}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

            {error && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.5rem', color: '#f43f5e', fontSize: '0.75rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn-primary"
                onClick={transition}
                disabled={blocked || transitioning}
                title={tooltip}
                style={{
                  padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: canTransition ? '0 0 20px rgba(37, 106, 244, 0.2)' : 'none',
                  opacity: (blocked || transitioning) ? 0.55 : 1,
                  cursor: (blocked || transitioning) ? 'not-allowed' : 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>forward</span>
                {transitioning ? 'Promoting…' : 'Move to Interviewing'}
              </button>
              <button style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>Wait for Response</button>
              <button style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, background: 'transparent', border: 'none', color: 'rgba(244, 63, 94, 0.8)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>archive</span>
                Archive Application
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suppress unused-prop warnings for callbacks not used in v1 of this tab */}
      {/* onMoveToInterviewing kept as a prop because the parent's legacy handler */}
      {/* still drives substage_progress flags. We call onStageChange directly above */}
      {/* after the transition endpoint succeeds; the legacy callback is intentionally */}
      {/* not invoked since the backend transition is the source of truth now. */}
      {false && onMoveToInterviewing}
    </div>
  );
}
