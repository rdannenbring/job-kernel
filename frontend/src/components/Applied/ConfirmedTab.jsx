// T16: Wires the Confirmed substage panel to GET /applied (state),
// POST /applied/confirmation/receipt (file upload, multipart) and
// PUT /applied/confirmation (record + receipt linkage). SLA panel
// reads appliedState.sla_tracker (compute_sla returns the same shape).
import React, { useRef, useState } from 'react';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'application/pdf']);

function fmtDate(value) {
  if (!value) return null;
  try { return new Date(value).toLocaleDateString(); } catch { return value; }
}

function SlaMilestone({ m, idx }) {
  const color = m.reached ? 'var(--primary-color)' : 'var(--text-muted)';
  const statusText = m.reached
    ? `REACHED${m.reached_at ? ` • ${fmtDate(m.reached_at)?.toUpperCase()}` : ''}`
    : 'NOT YET';
  return (
    <div key={idx} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '-29px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: color, border: '3px solid var(--bg-panel)' }}></div>
      <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{m.days} Days Elapsed</h5>
      <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {m.label.replace(/_/g, ' ')}
      </p>
      <span style={{ fontSize: '9px', fontWeight: 800, color, textTransform: 'uppercase' }}>{statusText}</span>
    </div>
  );
}

export default function ConfirmedTab({
  app,
  appliedState,
  refreshAppliedState,
  apiUrl,
  fetchWithAuth,
  onConfirmReceipt,
}) {
  const confirmation = appliedState?.confirmation_record || null;
  const sla = appliedState?.sla_tracker || null;
  const fileInputRef = useRef(null);

  const [confirmationNumber, setConfirmationNumber] = useState(confirmation?.confirmation_number || '');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [linkedReceiptId, setLinkedReceiptId] = useState(confirmation?.receipt_asset_id || null);
  const [receiptFilename, setReceiptFilename] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onDropFile = async (file) => {
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      setError(`Unsupported file type: ${file.type || 'unknown'}. PNG / JPEG / PDF only.`);
      return;
    }
    setError(null);
    setUploadingReceipt(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/confirmation/receipt`,
        { method: 'POST', body: form },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const asset = await res.json();
      setLinkedReceiptId(asset.id);
      setReceiptFilename(asset.original_filename);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setUploadingReceipt(false);
    }
  };

  const saveConfirmation = async () => {
    if (!app?.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        confirmation_number: confirmationNumber.trim() || null,
        confirmed_at: confirmation?.confirmed_at || new Date().toISOString(),
        source_type: confirmation?.source_type,
        receipt_asset_id: linkedReceiptId,
      };
      const res = await fetchWithAuth(
        `${apiUrl}/api/applications/${app.id}/applied/confirmation`,
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
      // Preserve legacy substage_progress flag + auto-advance behavior.
      if (onConfirmReceipt) await onConfirmReceipt();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Confirmation Audit</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', border: '1px solid var(--border-color)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>receipt_long</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        {/* Left Column: Confirmation Receipt */}
        <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>receipt_long</span>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Confirmation Receipt</h4>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Confirmation Number</label>
            <input
              type="text"
              placeholder="e.g. APP-8829-XJ"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Upload Screenshot</label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); onDropFile(e.dataTransfer.files?.[0]); }}
              onDragOver={(e) => e.preventDefault()}
              style={{ border: '2px dashed var(--border-color)', borderRadius: '1rem', padding: '2rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer' }}
            >
              <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(37, 106, 244, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                <span className="material-symbols-outlined">{uploadingReceipt ? 'sync' : 'cloud_upload'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {uploadingReceipt ? 'Uploading…' : (linkedReceiptId ? `Linked: ${receiptFilename || `receipt #${linkedReceiptId}`}` : 'Drop your receipt here')}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Supports PNG, JPG, PDF.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => onDropFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.5rem', color: '#f43f5e', fontSize: '0.75rem' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={saveConfirmation}
            disabled={saving}
            style={{ padding: '1rem', borderRadius: '0.75rem', fontWeight: 800, opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save Receipt Details'}
          </button>
        </div>

        {/* Right Column: SLA Tracker — now backend-driven */}
        <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>timer</span>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>SLA Tracker</h4>
            </div>
            {sla && (
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid rgba(244, 63, 94, 0.2)', textTransform: 'uppercase' }}>
                {sla.current_state.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {sla ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border-color)', position: 'relative' }}>
                {sla.milestones.map((m, i) => (
                  <SlaMilestone key={i} m={m} idx={i} />
                ))}
              </div>

              <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>info</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Recommended action</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {(sla.next_recommended_action || '').replace(/_/g, ' ')} • Days elapsed: {sla.days_elapsed}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              SLA tracking starts once a submission or confirmation is recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
