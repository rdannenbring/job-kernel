import { useState, useEffect } from 'react'
import PipelineProgressBar, { PIPELINE_STAGES, STAGE_TO_STATUS } from '../components/PipelineProgressBar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';


function ApplicationLifecycle({ app: initialApp, onBack, onUpdate, hideHeader = false }) {
  const [app, setApp] = useState(initialApp);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Refresh app data to get sub-steps, contacts, etc.
    const fetchFullApp = async () => {
      try {
        const res = await fetch(`${API_URL}/api/applications/${initialApp.id}`);
        const data = await res.json();
        setApp(data);
      } catch (e) {
        console.error("Failed to fetch full application data", e);
      }
    };
    fetchFullApp();
  }, [initialApp.id]);

  const updateStage = async (newStage) => {
    try {
      const newStatus = STAGE_TO_STATUS[newStage] || app.status;
      const res = await fetch(`${API_URL}/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus })
      });
      if (res.ok) {
        setApp({ ...app, pipeline_stage: newStage, status: newStatus });
        if (onUpdate) onUpdate(app.id, { pipeline_stage: newStage, status: newStatus });
      }
    } catch (e) {
      console.error("Failed to update pipeline stage", e);
    }
  };

  if (!app) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="card glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading analysis...</p>
        </div>
      </div>
    );
  }

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === (app.pipeline_stage || 'saved'));

  return (
    <div className="lifecycle-container" style={{ padding: hideHeader ? '0' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      {!hideHeader && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <div className="card" style={{ padding: '1rem', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: 0, overflow: 'hidden' }}>
            {app.company_logo ? (
              <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: 'bold', opacity: 0.3 }}>{app.company?.charAt(0)}</span>
            )}
          </div>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', background: 'rgba(37, 106, 244, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                Active Application
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                • Saved {new Date(app.date_saved).toLocaleDateString()}
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{app.job_title}</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{app.company} • {app.location || 'Remote'} ({app.location_type || 'Full-time'})</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined">description</span>
            All Details
          </button>
          <button className="btn btn-secondary">
            <span className="material-symbols-outlined">edit</span>
            Edit Progress
          </button>
        </div>
      </div>
      )}

      {/* Pipeline Progress Bar (only show if not hidden header, as Detail view shows it) */}
      {!hideHeader && (
        <PipelineProgressBar 
          currentStage={app.pipeline_stage} 
          onStageClick={updateStage} 
          isArchived={app.is_archived === 'true'}
        />
      )}

      {/* Main Content Areas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        {/* Left Column: Sub-steps and Phase Specific Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>pending_actions</span>
                {(PIPELINE_STAGES[currentStageIndex] || PIPELINE_STAGES[0]).label} Sub-steps
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add_circle</span>
                Add Sub-step
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(app.sub_steps && app.sub_steps.length > 0) ? app.sub_steps.map(step => (
                <div key={step.id} className="card glass-hover" style={{ padding: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: step.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: step.status === 'completed' ? 'var(--success)' : 'var(--text-muted)',
                      border: '1px solid ' + (step.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color-card)')
                    }}>
                      <span className="material-symbols-outlined">{step.status === 'completed' ? 'check_circle' : 'circle'}</span>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{step.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{step.description} {step.date ? `• ${step.date}` : ''}</p>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ padding: '0.5rem' }}>
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              )) : (
                <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-color-card)', borderRadius: '1rem', color: 'var(--text-muted)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>checklist</span>
                  <p>No sub-steps defined for this phase yet.</p>
                  <button className="btn btn-secondary mt-2">Create First Step</button>
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>auto_awesome</span>
              AI Prep Tools
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card glass-hover" style={{ cursor: 'pointer', margin: 0 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">quiz</span>
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Mock Interview</h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Generate likely interview questions based on the job description.</p>
              </div>
              <div className="card glass-hover" style={{ cursor: 'pointer', margin: 0 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">psychology</span>
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Company Deep-Dive</h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Get a summary of company culture, recent news, and interview tips.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card glass" style={{ margin: 0, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>contacts</span>
              Key Contacts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(app.contacts && app.contacts.length > 0) ? app.contacts.map(contact => (
                <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                    {contact.name?.charAt(0)}
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{contact.name}</h5>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{contact.role}</p>
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No contacts added.</p>
              )}
              <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.875rem', padding: '0.6rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                Add Contact
              </button>
            </div>
          </div>

          <div className="section">
             <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>history</span>
              Timeline
            </h3>
            <div className="card glass" style={{ margin: 0, padding: '1.25rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
                {(app.events && app.events.length > 0) ? app.events.map((event, idx) => (
                  <div key={event.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                    {idx < app.events.length - 1 && <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: '-20px', width: '2px', background: 'var(--bg-tertiary)' }}></div>}
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: '4px solid var(--bg-card)', color: 'white' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {event.event_type === 'stage_change' ? 'swap_horiz' : 'event'}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 2px 0' }}>{event.description}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{new Date(event.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No events recorded for this application.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationLifecycle;
