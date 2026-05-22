// Extracted from ApplicationLifecycle.jsx (AppliedSubStagePanel, case 'follow_up_due').
// T15.0 refactor: zero behavior change; presentational only.
import React from 'react';

export default function FollowUpDueTab({ onMarkFollowUpSent }) {
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

       <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f43f5e' }}>
         <span className="material-symbols-outlined">warning</span>
         <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>⚠️ 2 tasks are overdue! Please prioritize these follow-ups.</p>
       </div>

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
                  defaultValue="2023-10-25"
                  style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.1)', borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#f43f5e' }}>event_busy</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase' }}>Overdue Status</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Scheduled for Oct 22 (3 days ago)</p>
              </div>
               <button className="btn-primary" onClick={onMarkFollowUpSent} style={{ padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>send</span>
                 Mark Follow-up Sent
               </button>
            </div>

            <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>person</span>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Contact Person</h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_OOzvG0ZrLixijkPiEMxTKIQSC49OwJsdynCzVqqokq5CkS1-TRCBmbbhZjee5XkHvfIQI3p7aj28MqXxc8SVbj_qVDJKb5jK46u60s-VLRVbjUGb5BjTT5LyRa_JuIASanAZDrk3tX3ezeeUrO5WgNLt3-M4C_XAE2UA_TBY8OQHIzKRPeyrerCCn1NyOdgZqfBFz7sMOiShmzou9D0iV8DFQolmKZnXgjNEUvQSElkK6TYPy1pPSnenYgAxAdHYipqgdf8fUMc" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(37, 106, 244, 0.2)' }} alt="Contact" />
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Elena Vance</h5>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Senior Talent Acquisition</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>mail</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>e.vance@lumon.tech</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>COPY</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>domain</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Lumon Industries</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Templates */}
          <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.75rem' }}>description</span>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>Follow-up Templates</h4>
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.2)', textTransform: 'uppercase' }}>2 Drafts Available</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                { title: 'Gentle Nudge', desc: 'Best for 3-5 days after last contact', content: '"Hi Elena, I hope your week is going well. I\'m just following up on my application for the Product Designer role. I\'m still very excited about the opportunity and look forward to hearing from you."' },
                { title: 'Detailed Check-in', desc: 'Best for 7+ days or after a specific milestone', content: '"Dear Elena, following up on our previous conversation regarding the Senior Design position. I\'ve recently updated my portfolio with a new case study that aligns with Lumon\'s current focus on glassmorphism. Thought it might be of interest!"' }
              ].map((template, i) => (
                <div key={i} className="card" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.25rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{template.title}</h5>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{template.desc}</p>
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>content_copy</span>
                      Copy
                    </button>
                  </div>
                  <div style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
                    {template.content}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '1rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Personalizing templates increases response rates by 40%.</p>
            </div>
          </div>
       </div>
    </div>
  );
}
