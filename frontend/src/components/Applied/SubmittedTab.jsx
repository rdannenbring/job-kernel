// Extracted from ApplicationLifecycle.jsx (AppliedSubStagePanel, case 'submitted').
// T15.0 refactor: zero behavior change; presentational only.
import React from 'react';

export default function SubmittedTab({ app }) {
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
          {/* Left Column: Submission Record */}
          <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission Record</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                  <span className="material-symbols-outlined">event_available</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Applied On</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{app?.applied_date ? new Date(app.applied_date).toLocaleString() : (app?.date_applied ? new Date(app.date_applied).toLocaleString() : '—')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                  <span className="material-symbols-outlined">hub</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Application Channel</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{app?.application_channel || 'Direct'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Portal Used</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>External Portal (ATS)</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Referral Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>None</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Snapshot */}
          <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>lock</span>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Historical Lock</span>
            </div>
            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Snapshot: What you submitted</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '2rem' }}>picture_as_pdf</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Resume_v4_Designer.pdf</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Updated Oct 2023 • 2.4 MB</div>
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>download</span>
              </div>
              <div className="card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', fontSize: '2rem' }}>description</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>CoverLetter_Stripe.docx</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Specific to: Stripe FinTech Role</div>
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>visibility</span>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                Note: Documents are archived in the state they were sent. Updating your global profile will not affect this historical snapshot.
              </p>
            </div>
          </div>
       </div>

       {/* Friction Notes */}
       <div className="card glass" style={{ padding: '1.5rem 2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>warning</span>
             <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission Friction Notes</h4>
           </div>
           <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
             <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
             Log Friction Point
           </button>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Issue Type</div>
              <div style={{ display: 'inline-flex', padding: '0.25rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '4px', color: '#f43f5e', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>UX Dark Pattern</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>The Experience</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                The application portal forced a re-entry of all work history despite successful PDF parsing. LinkedIn Easy Apply link redirected to a secondary Greenhouse portal requiring a new account creation. This adds approximately 15 minutes of overhead per submission.
              </p>
            </div>
         </div>
       </div>
    </div>
  );
}
