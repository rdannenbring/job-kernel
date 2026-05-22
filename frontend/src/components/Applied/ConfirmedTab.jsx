// Extracted from ApplicationLifecycle.jsx (AppliedSubStagePanel, case 'confirmed').
// T15.0 refactor: zero behavior change; presentational only.
import React from 'react';

export default function ConfirmedTab({ onConfirmReceipt }) {
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
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Upload Screenshot</label>
              <div style={{ border: '2px dashed var(--border-color)', borderRadius: '1rem', padding: '2rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(37, 106, 244, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">cloud_upload</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Drop your receipt here</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Supports PNG, JPG, PDF.</p>
              </div>
            </div>
            <button className="btn-primary" onClick={onConfirmReceipt} style={{ padding: '1rem', borderRadius: '0.75rem', fontWeight: 800 }}>Save Receipt Details</button>
          </div>

          {/* Right Column: SLA Tracker */}
          <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>timer</span>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>SLA Tracker</h4>
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid rgba(244, 63, 94, 0.2)', textTransform: 'uppercase' }}>Awaiting Response</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border-color)', position: 'relative' }}>
              {[
                { days: '7 Days Elapsed', desc: 'Standard response window met. No action required.', status: 'COMPLETED • OCT 12', color: 'var(--primary-color)', completed: true },
                { days: '14 Days Elapsed', desc: 'Awaiting primary feedback. Response aging detected.', status: 'RESPONSE AGING ALERT', color: '#f43f5e', active: true },
                { days: '21 Days Elapsed', desc: 'Critical threshold for follow-up escalation.', status: 'ESTIMATED OCT 26', color: 'var(--text-muted)', future: true },
              ].map((sla, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-29px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: sla.color, border: '3px solid var(--bg-panel)', boxShadow: sla.active ? `0 0 10px ${sla.color}` : 'none' }}></div>
                  <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sla.days}</h5>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sla.desc}</p>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: sla.color, textTransform: 'uppercase' }}>{sla.status}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>info</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Pro Tip</p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Applications with uploaded receipts are 40% more likely to be processed within the 7-day window.</p>
              </div>
            </div>
          </div>
       </div>
    </div>
  );
}
