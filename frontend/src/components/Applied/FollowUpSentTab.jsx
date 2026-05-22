// Extracted from ApplicationLifecycle.jsx (AppliedSubStagePanel, case 'follow_up_sent').
// T15.0 refactor: zero behavior change; presentational only.
import React from 'react';

export default function FollowUpSentTab({ completedCount, totalSubstages, onMoveToInterviewing }) {
  const percent = Math.round((completedCount / totalSubstages) * 100);
  const isReady = completedCount === totalSubstages;
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
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{isReady ? 'Ready to transition to Interviewing' : `${completedCount} of ${totalSubstages} sub-stages complete`}</span>
          </div>
        </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
          {/* Left Column: Activity Log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Activity Log</h4>
              <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { title: 'Follow-up Sent', date: 'Oct 24, 2023 • 2:45 PM', icon: 'send', color: 'var(--primary-color)', desc: 'Second follow-up communication dispatched to hiring manager. Template used: Professional Re-engagement v2.1', preview: '"Hi [Name], I\'m reaching out to express my continued interest in the Senior UI Designer position..."', active: true },
                { title: 'Follow-up Due Reminder', date: 'Oct 24, 2023 • 9:00 AM', icon: 'notifications_active', color: 'var(--text-muted)', desc: 'System generated notification: 7 days since last contact. Recommendation: Send polite follow-up.', opacity: 0.7 },
                { title: 'Application Confirmed', date: 'Oct 17, 2023 • 11:20 AM', icon: 'mail', color: 'var(--text-muted)', desc: 'Automated receipt confirmation from Greenhouse ATS received.', opacity: 0.5 }
              ].map((activity, i) => (
                <div key={i} className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', borderLeft: `4px solid ${activity.color}`, display: 'flex', gap: '1.25rem', opacity: activity.opacity || 1 }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: activity.active ? 'rgba(37, 106, 244, 0.1)' : 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activity.color }}>
                    <span className="material-symbols-outlined">{activity.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activity.title}</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{activity.date}</p>
                    </div>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{activity.desc}</p>
                    {activity.preview && (
                      <div style={{ padding: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {activity.preview}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Next Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid rgba(37, 106, 244, 0.2)', background: 'linear-gradient(to bottom right, rgba(37, 106, 244, 0.05), transparent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Next Steps</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recommended actions for this stage.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ready to move to Interviewing?</p>
                {['Follow-up email sent', '7 days post-application reached', 'Contact person identified'].map((check, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '4px', border: '1px solid var(--primary-color)', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'white', fontWeight: 800 }}>check</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{check}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn-primary" onClick={onMoveToInterviewing} style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 0 20px rgba(37, 106, 244, 0.2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>forward</span>
                  Move to Interviewing
                </button>
                <button style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>Wait for Response</button>
                <button style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, background: 'transparent', border: 'none', color: 'rgba(244, 63, 94, 0.8)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>archive</span>
                  Archive Application
                </button>
              </div>
            </div>

            <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hiring Manager</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHRTk14KKSSI9akZHsZwJFsRQBDaKkZA1DZSWHX36M5oIMB7mCShZ6kTdPjjvXzeM-nqaCTEaOZAlJTXvhV2hJurqv9y5Z1Pfk9JFL3XJuL1lSAjk_8P4vljSmlx8L2jgwg9nXGRrk_ZaG5v0ez5JNesrO6-QEheVYtRme5kgoeThUEYM4tTxr6HELcDcyIfTJgKgXLydZoO1oDrz-U2qX-E20tnxipw_LiiAzDcbJUopLApg3yoZSezO6bawaN2wrSBNG6QVdWYo" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)' }} alt="HM" />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Marcus Sterling</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Design Lead at Linear</p>
                </div>
                <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined">chat_bubble</span>
                </button>
              </div>
            </div>
          </div>
       </div>
    </div>
  );
}
