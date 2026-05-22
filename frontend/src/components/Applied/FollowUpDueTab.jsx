// T17: Wires the Follow-up Due substage panel to:
//   PUT /applied/follow-up-plan         (save due date / template selection)
//   POST /applied/follow-up/send-log    (mark follow-up sent)
//   GET /applied/follow-up/templates    (deterministic v1 templates)
// Contact card surfaces appliedState.contacts[0] when present.
import React, { useEffect, useState } from 'react';

function toDateInputValue(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function toISOFromDate(dateStr) {
  if (!dateStr) return null;
  // Persist as midnight UTC so the backend's UTCDateTime validator accepts it.
  return new Date(`${dateStr}T00:00:00Z`).toISOString();
}

export default function FollowUpDueTab({
  app,
  appliedState,
  refreshAppliedState,
  apiUrl,
  fetchWithAuth,
  onMarkFollowUpSent,
}) {
  const plan = appliedState?.follow_up_plan || null;
  const contacts = appliedState?.contacts || [];
  const primary = contacts[0] || null;

  const [dueDate, setDueDate] = useState(toDateInputValue(plan?.due_at));
  const [templates, setTemplates] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed local date when shared state refreshes.
  useEffect(() => { setDueDate(toDateInputValue(plan?.due_at)); }, [plan?.due_at]);

  // Fetch templates once per app.
  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      if (!app?.id) return;
      try {
        const res = await fetchWithAuth(
          `${apiUrl}/api/applications/${app.id}/applied/follow-up/templates`,
        );
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setTemplates(body.templates || []);
      } catch (e) {
        if (!cancelled) console.error('Failed to load templates', e);
      }
    };
    loadTemplates();
    return () => { cancelled = true; };
  }, [app?.id, apiUrl, fetchWithAuth]);

  const savePlan = async (overrideDate) => {
    const targetDate = overrideDate !== undefined ? overrideDate : dueDate;
    if (!app?.id) return;
    setSavingPlan(true);
    setError(null);
    try {
      const payload = {
        due_at: targetDate ? toISOFromDate(targetDate) : undefined,
        recommended_template_id: plan?.recommended_template_id,
      };
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/follow-up-plan`,
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
      await refreshAppliedState();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSavingPlan(false);
    }
  };

  const markSent = async () => {
    if (!app?.id) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/follow-up/send-log`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sent_at: new Date().toISOString(), channel: 'email' }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      await refreshAppliedState();
      // Preserve legacy substage_progress + auto-advance side-effects.
      if (onMarkFollowUpSent) await onMarkFollowUpSent();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSending(false);
    }
  };

  const overdueDays = plan?.overdue_days ?? 0;
  const planStatus = (plan?.status || '').toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>Follow-up Due</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Manage your upcoming and overdue reach-outs.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', border: '1px solid var(--border-color)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>calendar_month</span>
          </button>
        </div>
      </div>

      {planStatus === 'OVERDUE' && (
        <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f43f5e' }}>
          <span className="material-symbols-outlined">warning</span>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
            Follow-up is {overdueDays} day{overdueDays === 1 ? '' : 's'} overdue. Prioritize sending it.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        {/* Left Column: Scheduler & Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>calendar_month</span>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Follow-up Scheduler</h4>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Select Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() => { if (dueDate) savePlan(); }}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', color: 'var(--text-primary)', outline: 'none' }}
              />
              {savingPlan && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Saving…</div>}
            </div>

            {plan?.due_at && (
              <div style={{ padding: '1rem', background: planStatus === 'OVERDUE' ? 'rgba(244, 63, 94, 0.05)' : 'rgba(37, 106, 244, 0.05)', border: `1px solid ${planStatus === 'OVERDUE' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(37, 106, 244, 0.1)'}`, borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: planStatus === 'OVERDUE' ? '#f43f5e' : 'var(--primary-color)' }}>
                    {planStatus === 'OVERDUE' ? 'event_busy' : 'event_available'}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: planStatus === 'OVERDUE' ? '#f43f5e' : 'var(--primary-color)', textTransform: 'uppercase' }}>
                    Plan Status: {planStatus || 'SCHEDULED'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Due: {new Date(plan.due_at).toLocaleDateString()}
                  {planStatus === 'OVERDUE' && ` (${overdueDays} day${overdueDays === 1 ? '' : 's'} ago)`}
                </p>
              </div>
            )}

            {error && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.5rem', color: '#f43f5e', fontSize: '0.75rem' }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={markSent}
              disabled={sending}
              style={{ padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: sending ? 0.6 : 1, cursor: sending ? 'wait' : 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>send</span>
              {sending ? 'Marking…' : 'Mark Follow-up Sent'}
            </button>
          </div>

          {/* Contact card — first contact from the list (display only for v1) */}
          <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>person</span>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Contact Person</h4>
            </div>
            {primary ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', fontWeight: 800 }}>
                    {(primary.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{primary.name}</h5>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{primary.title || ''}{primary.is_hiring_manager ? ' • Hiring Manager' : ''}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {primary.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>mail</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>{primary.email}</span>
                      <button onClick={() => navigator.clipboard?.writeText(primary.email)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>COPY</button>
                    </div>
                  )}
                  {primary.company && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>domain</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{primary.company}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                No contact linked yet. Add one via the contacts section to enable personalized follow-ups.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Templates (now backend-fetched) */}
        <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.75rem' }}>description</span>
              <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>Follow-up Templates</h4>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.2)', textTransform: 'uppercase' }}>
              {templates.length} {templates.length === 1 ? 'Draft' : 'Drafts'} Available
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {templates.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Loading templates…</p>
            ) : templates.map((template) => (
              <div key={template.id} className="card" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.25rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{template.label}</h5>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{template.description}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(template.body)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>content_copy</span>
                    Copy
                  </button>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
                  {template.body}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '1rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Personalize the template before sending — placeholders like {'{{contact_first_name}}'} are intentional.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
