const fs = require('fs');

const file = 'frontend/src/pages/ApplicationLifecycle.jsx';
let content = fs.readFileSync(file, 'utf8');

// Find start and end of renderContent
const renderStart = content.indexOf('const renderContent = () => {');
const renderEnd = content.indexOf('  return (\n    <div style={{ display: \'grid\',');

if (renderStart === -1 || renderEnd === -1) {
    console.error("Could not find renderContent boundaries");
    process.exit(1);
}

// Generate the new renderContent
const newRenderContent = `  const renderContent = () => {
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
                    {score ? \`\${score}%\` : '—'}
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
                        <div key={i} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, background: match ? 'rgba(37,106,244,0.1)' : 'var(--bg-tertiary)', color: match ? 'var(--primary)' : 'var(--text-secondary)', border: \`1px solid \${match ? 'var(--primary)' : 'var(--border-color)'}\`, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                        <div key={i} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, background: match ? 'rgba(37,106,244,0.1)' : 'var(--bg-tertiary)', color: match ? 'var(--primary)' : 'var(--text-secondary)', border: \`1px solid \${match ? 'var(--primary)' : 'var(--border-color)'}\`, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
  };`;

const newContent = content.substring(0, renderStart) + newRenderContent + '\n' + content.substring(renderEnd);
fs.writeFileSync(file, newContent);
console.log("Successfully patched renderContent.");
