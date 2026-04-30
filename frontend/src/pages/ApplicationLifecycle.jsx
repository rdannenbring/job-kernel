import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PipelineProgressBar, { PIPELINE_STAGES, STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Parsing helpers ───────────────────────────────────────────────────────────
const NOISE_PATTERNS = [
  /salary/i, /compensation/i, /\$\d+/, /incentive/i, /eligible/i,
  /equal opportunity/i, /eeo/i, /discrimination/i, /background check/i,
  /benefits/i, /401k/i, /vacation/i, /pto\b/i, /dental/i, /vision/i,
  /health insurance/i, /we are an equal/i, /applicants will/i,
];
function isNoiseLine(line) {
  return NOISE_PATTERNS.some(p => p.test(line));
}

function extractSection(text, keywords) {
  const lines = (text || '').split('\n');
  let result = [];
  let found = false;
  for (let line of lines) {
    if (keywords.some(k => line.toLowerCase().includes(k.toLowerCase()))) {
      found = true;
      continue;
    }
    if (found) {
      if (line.trim() === '' || (line.length < 5 && !line.includes('•'))) continue;
      if (isNoiseLine(line)) continue;
      result.push(line.trim());
    }
  }
  return result.slice(0, 5);
}

// ── Components ────────────────────────────────────────────────────────────────

const SAVED_SUBSTAGES = [
  { id: 'parsed', label: 'Job Analysis (parsed)', icon: 'analytics' },
  { id: 'reviewed', label: 'Reviewed', icon: 'rule' },
  { id: 'network', label: 'Network Contacts', icon: 'group' },
  { id: 'company', label: 'Company Research', icon: 'business' },
  { id: 'prioritized', label: 'Prioritized', icon: 'format_list_numbered' },
];

function SavedSubStagePanel({ app, onRefresh }) {
  const { fetchWithAuth } = useAuth();
  const [activeSubStage, setActiveSubStage] = useState('parsed');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [instructions, setInstructions] = useState({ resume: '', cl: '' });

  // Auto-enrich if fields are missing
  useEffect(() => {
    if (activeSubStage === 'parsed' && !app.job_summary && !isEnriching) {
      handleEnrich();
    }
  }, [activeSubStage, app.id]);

  if (!app) return null;

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/enrich`, {
        method: 'POST'
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error("Enrichment failed", e);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleMatchReload = async () => {
    setIsScoring(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/score`, {
        method: 'POST'
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error("Scoring failed", e);
    } finally {
      setIsScoring(false);
    }
  };

  const handleRegenerate = async (type) => {
    setIsRegenerating(true);
    try {
      const endpoint = type === 'resume' ? '/api/generate/resume' : '/api/generate/cover-letter';
      const body = {
        application_id: app.id,
        instructions: instructions[type]
      };
      
      const res = await fetchWithAuth(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(`Failed to regenerate ${type}`, e);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Parsing score details
  let matchDetails = null;
  try {
    matchDetails = app.match_details ? (typeof app.match_details === 'string' ? JSON.parse(app.match_details) : app.match_details) : null;
  } catch(e) {
    console.warn("Could not parse match_details", e);
  }

  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1.25rem',
    borderRadius: '1rem',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    border: activeSubStage === id ? '1px solid var(--primary)' : '1px solid transparent',
    marginBottom: '0.5rem',
    color: activeSubStage === id ? 'var(--text-primary)' : 'var(--text-secondary)',
    boxShadow: activeSubStage === id ? '0 4px 12px rgba(37, 106, 244, 0.15)' : 'none'
  });

    const renderContent = () => {
    const score = app.match_score || 0;
    
    // Fallback parsing for highlighting
    const userSkillsStr = JSON.stringify(app.resume_data || app.profile_snapshot || {}).toLowerCase();
    const hasMatch = (text) => {
      if (!text || text.length < 5) return false;
      const textLower = text.toLowerCase();
      // Simple heuristic if resume data isn't deeply structured
      const commonTech = ['react', 'python', 'javascript', 'node', 'typescript', 'aws', 'docker', 'kubernetes', 'sql', 'agile', 'leadership', 'design', 'architecture'];
      const matchesTech = commonTech.some(k => textLower.includes(k) && userSkillsStr.includes(k));
      return matchesTech || userSkillsStr.includes(textLower.substring(0, 15));
    };

    switch (activeSubStage) {
      case 'parsed':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            {/* Header Area with Job Match Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Job Analysis (Parsed)</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Structured data extracted from the job posting</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={handleMatchReload} 
                  disabled={isScoring}
                  className="btn-primary" 
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isScoring ? 'hourglass_empty' : 'model_training'}</span>
                  {isScoring ? 'Generating...' : 'Generate Custom Resume'}
                </button>
              </div>
            </div>

            {/* Job Summary Card */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Job Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Job Title</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.job_title || '—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {app.company_logo && <img src={app.company_logo} alt="Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Company</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.company || '—'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Location & Type</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.location || '—'} • {app.location_type || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Job Type & Source</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.job_type || '—'} • {app.source || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>URL</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {app.job_url ? <a href={app.job_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>View Listing</a> : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Dates</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    Saved: {app.date_saved ? new Date(app.date_saved).toLocaleDateString() : '—'}<br/>
                    Posted: {app.date_posted || '—'}<br/>
                    Expires: {app.deadline || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Experience & Seniority</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {matchDetails?.experience_required || extractSection(app.job_description, ['years'])[0] || 'Not specified'} • {matchDetails?.seniority_level || 'Not specified'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Job Match Score</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: score > 75 ? '#10b981' : (score > 50 ? '#f59e0b' : 'var(--text-muted)') }}>
                    {score ? `${score}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Role Overview */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Role Overview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Job Summary / Mission</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{app.job_summary || 'Not provided'}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Core Purpose</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{app.core_purpose || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Function / Department</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{app.function_dept || 'Not specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Reporting Line</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{app.reporting_line || 'Not specified'}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Team Context</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{app.team_context || 'Not specified'}</div>
                </div>
              </div>
            </div>

            {/* Primary Responsibilities */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Primary Responsibilities</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {extractSection(app.job_description, ['responsibilities', 'duties', 'role', 'work with', 'you will', 'what you']).map((req, i) => {
                  const match = hasMatch(req);
                  return (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.95rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400, background: match ? 'rgba(37,106,244,0.05)' : 'transparent', padding: '0.5rem', borderRadius: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'fiber_manual_record'}</span>
                      {req}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Requirements Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <h4 style={{ margin: '0 0 -0.5rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Requirements</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Required Skillsets</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['skills', 'proficient', 'experience with', 'knowledge of']).map((skill, i) => {
                      // Try to keep it short for a puck
                      const shortSkill = skill.length > 40 ? skill.substring(0, 37) + '...' : skill;
                      const match = hasMatch(skill);
                      return (
                        <div key={i} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, background: match ? 'rgba(37,106,244,0.1)' : 'var(--bg-tertiary)', color: match ? 'var(--primary)' : 'var(--text-secondary)', border: `1px solid ${match ? 'var(--primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {match && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {shortSkill}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Experience Requirements</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['experience', 'years', 'track record']).map((req, i) => {
                      const match = hasMatch(req);
                      return (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'circle'}</span>
                          {req}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Education & Certifications</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['education', 'degree', 'certification', 'bachelor', 'master']).map((req, i) => {
                      const match = hasMatch(req);
                      return (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'school'}</span>
                          {req}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Other Requirements</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['authorization', 'clearance', 'travel', 'language', 'visa', 'citizen']).map((req, i) => {
                      const match = hasMatch(req);
                      return (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'rule'}</span>
                          {req}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Preferred Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <h4 style={{ margin: '0 0 -0.5rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Preferred Qualifications</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Preferred Skillsets</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['preferred', 'plus', 'nice to have', 'bonus']).map((skill, i) => {
                      const shortSkill = skill.length > 40 ? skill.substring(0, 37) + '...' : skill;
                      const match = hasMatch(skill);
                      return (
                        <div key={i} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, background: match ? 'rgba(37,106,244,0.1)' : 'var(--bg-tertiary)', color: match ? 'var(--primary)' : 'var(--text-secondary)', border: `1px solid ${match ? 'var(--primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {match && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {shortSkill}
                        </div>
                      )
                    })}
                  </div>
                </div>
                 <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Preferred Experience</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractSection(app.job_description, ['preferred experience', 'ideally', 'advantage']).map((req, i) => {
                      const match = hasMatch(req);
                      return (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'circle'}</span>
                          {req}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Compensation & Details */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Compensation & Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Salary Min/Max</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>{app.salary_range || 'Not disclosed'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Currency & Interval</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>USD • Annual (Assumed)</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bonus / Equity</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{extractSection(app.job_description, ['bonus', 'equity', 'stock', 'rsu'])[0] || 'Not specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Employment Type</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.job_type || 'Full-time'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Work Model</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.location_type || 'Remote / Hybrid'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Office Location(s)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.location || 'Not specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Travel Requirements</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{extractSection(app.job_description, ['travel'])[0] || 'None specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Relocation Support</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.relocation || 'Not offered'}</div>
                </div>
              </div>
            </div>
            
          </div>
        );

      case 'reviewed':
      case 'network':
      case 'company':
      case 'prioritized':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{SAVED_SUBSTAGES.find(s => s.id === activeSubStage)?.label}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>This section is currently under development.</p>
          </div>
        );

      default:
        return null;
    }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {SAVED_SUBSTAGES.map((s) => (
          <button key={s.id} onClick={() => setActiveSubStage(s.id)} style={navStyle(s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}>
                {s.icon}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}>{s.label}</span>
            </div>
            {activeSubStage === s.id && (
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
            )}
          </button>
        ))}
      </div>

      {/* Right: Content Panel */}
      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '400px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────


function ApplicationLifecycle({ app: initialApp, onBack, onUpdate, hideHeader = false, activePhaseTab }) {
  const { fetchWithAuth } = useAuth();
  const [app, setApp] = useState(initialApp);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!initialApp?.id) return;

    // Refresh app data to get sub-steps, contacts, etc.
    const fetchFullApp = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/applications/${initialApp.id}`);
        const data = await res.json();
        setApp(data);
      } catch (e) {
        console.error("Failed to fetch full application data", e);
      }
    };
    fetchFullApp();

    // Fetch LinkedIn connections
    const fetchConnections = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(initialApp.company || '')}`);
        const data = await res.json();
        setConnections(data.matches || []);
      } catch (e) {
        console.warn("Failed to fetch LinkedIn connections for lifecycle", e);
      }
    };
    if (initialApp.company) fetchConnections();
  }, [initialApp?.id, initialApp?.company]);

  const refreshApp = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`);
      const data = await res.json();
      setApp(data);
    } catch (e) {
      console.error("Failed to refresh application data", e);
    }
  };

  const updateStage = async (newStage) => {
    try {
      const newStatus = STAGE_TO_STATUS[newStage] || app.status;
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus, force: true })
      });
      if (res.ok) {
        const updatedFullApp = await res.json();
        setApp(updatedFullApp);
        if (onUpdate) onUpdate(app.id, updatedFullApp);
      }
    } catch (e) {
      console.error("Failed to update stage", e);
    }
  };

  const handleAddContact = async (linkedinPerson) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: linkedinPerson.name,
          role: linkedinPerson.title,
          linkedin_url: linkedinPerson.profile_url,
          company: app.company
        })
      });
      if (res.ok) {
        refreshApp();
        setShowAddContact(false);
      }
    } catch (e) {
      console.error("Failed to add contact", e);
    }
  };

  const searchPeople = async () => {
    if (!contactSearch.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(app.company)}?q=${encodeURIComponent(contactSearch)}`);
      const data = await res.json();
      setSearchResults(data.matches || []);
    } catch (e) {
      console.error("Failed to search people", e);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px' }}>
        <div className="card glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading analysis...</p>
        </div>
      </div>
    );
  }

  console.log('ApplicationLifecycle rendering:', { appId: app?.id, activePhaseTab, pipelineStage: app?.pipeline_stage });

  if (!app) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading application details...</div>;

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id.toLowerCase() === (activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase());

  return (
    <div className="lifecycle-container" style={{ padding: hideHeader ? '0' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      {!hideHeader && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <div className="card" style={{ padding: '0', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, overflow: 'hidden', background: 'transparent' }}>
            {app?.company_logo ? (
              <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: 'bold', opacity: 0.3 }}>{app?.company?.charAt(0)}</span>
            )}
          </div>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', background: 'rgba(37, 106, 244, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                Active Application
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                • Saved {app?.date_saved ? new Date(app.date_saved).toLocaleDateString() : '—'}
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{app?.job_title || '—'}</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{app?.company || '—'} • {app?.location || 'Remote'} ({app?.location_type || 'Full-time'})</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Archive</button>
          <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Application Link</button>
        </div>
      </div>
      )}

      {/* Progress Bar */}
      {!hideHeader && (
        <PipelineProgressBar 
          currentStage={app?.pipeline_stage || 'saved'} 
          onStageClick={updateStage} 
          isArchived={app?.is_archived === 'true'}
        />
      )}

      {/* Main Content Areas */}
      {((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'saved') ? (
        <SavedSubStagePanel app={app} onRefresh={refreshApp} />
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        {/* Left Column: Stage Specific Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Phase-based view */}
          <div className="card glass" style={{ padding: '2rem' }}>
            {currentStageIndex === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Initial Preparation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>description</span>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Resume Status</h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>AI optimization complete. 12 skills matched.</p>
                    <button className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }}>View Tailored Version</button>
                  </div>
                  <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>mail</span>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Cover Letter</h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Narrative generated based on company mission.</p>
                    <button className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }}>View Draft</button>
                  </div>
                </div>
              </div>
            )}
            
            {currentStageIndex === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Application Submission</h3>
                <div style={{ padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>cloud_upload</span>
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>Mark this job as 'Applied' once you've submitted your documents.</p>
                  <button onClick={() => updateStage('applied')} className="btn-primary">Confirm Applied</button>
                </div>
              </div>
            )}

            {currentStageIndex >= 2 && currentStageIndex <= 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Interview Pipeline</h3>
                <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>event</span>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Upcoming Interviews</h4>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No interviews scheduled yet.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Job Details Accordion */}
          <div className="card glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Job Requirements Analysis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Critical Skills</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {extractSection(app?.job_description || '', ['skill', 'experience', 'requirement', 'qualifications']).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981' }}>check_circle</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Responsibilities</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {extractSection(app?.job_description || '', ['responsibilities', 'duties', 'role', 'work with']).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>arrow_right_alt</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Networking & Company Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Networking Panel */}
          <div className="card glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Networking</h3>
              <button onClick={() => setShowAddContact(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                <span className="material-symbols-outlined">add_circle</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {connections.length > 0 ? connections.slice(0, 3).map((person, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', opacity: 0.5 }}>person</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.title}</div>
                  </div>
                  <a href={person.profile_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>link</span>
                  </a>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No connections found for {app?.company}.
                </div>
              )}
              
              <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem' }}>View All Matches</button>
            </div>
          </div>

          {/* Company Context */}
          <div className="card glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: 'var(--text-primary)' }}>Company Intelligence</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Mission</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {app?.company_mission || "Analyzing company culture and mission statement..."}
                </p>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recent News</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Searching for latest updates...
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      )}

      {/* Add Contact Portal */}
      {showAddContact && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Add Contact</h2>
              <button onClick={() => setShowAddContact(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Search People at {app?.company}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={contactSearch} 
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Name or title..."
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
                <button onClick={searchPeople} disabled={isSearching} className="btn-primary" style={{ padding: '0 1.25rem' }}>
                  {isSearching ? '...' : 'Search'}
                </button>
              </div>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {searchResults.map((person, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.title}</div>
                  </div>
                  <button onClick={() => handleAddContact(person)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>Add</button>
                </div>
              ))}
              {searchResults.length === 0 && !isSearching && contactSearch && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No results found.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ApplicationLifecycle;
