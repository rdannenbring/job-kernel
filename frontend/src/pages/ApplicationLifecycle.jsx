import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PipelineProgressBar, { PIPELINE_STAGES, STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import { useAuth } from '../context/AuthContext';
import ResumeEditor from '../components/JobMatch/ResumeEditor';
import { CompanyOverviewView, FinancialsView, CompetitorView } from '../components/CompanyResearchViews';

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

function extractInline(text, keywords) {
  const lines = (text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (keywords.some(k => line.toLowerCase().includes(k.toLowerCase()))) {
      let trimmed = line.trim().replace(/^[-•*]\s*/, '');
      
      if (trimmed.includes(':') && !trimmed.endsWith(':')) {
         return trimmed;
      }
      
      if (trimmed.length < 35 && (trimmed.endsWith(':') || trimmed.split(' ').length <= 4)) {
        for (let j = i + 1; j < lines.length; j++) {
          let nextLine = lines[j].trim().replace(/^[-•*]\s*/, '');
          if (nextLine !== '' && nextLine.length >= 2) {
            return nextLine;
          }
        }
      }
      return trimmed;
    }
  }
  return null;
}

// ── Components ────────────────────────────────────────────────────────────────

const SAVED_SUBSTAGES = [
  { id: 'parsed', label: 'Job Analysis (parsed)', icon: 'analytics' },
  { id: 'reviewed', label: 'Reviewed', icon: 'rule' },
  { id: 'network', label: 'Network Contacts', icon: 'group' },
  { id: 'company', label: 'Company Research', icon: 'business' },
  { id: 'prioritized', label: 'Prioritized', icon: 'format_list_numbered' },
];

const GENERATED_SUBSTAGES = [
  { id: 'resume', label: 'Resume', icon: 'description' },
  { id: 'cover_letter', label: 'Cover Letter', icon: 'mail' },
  { id: 'answers', label: 'Answers', icon: 'question_answer' },
  { id: 'prep', label: 'Prep Artifacts', icon: 'inventory_2' },
];

const APPLIED_SUBSTAGES = [
  { id: 'submitted', label: 'Submitted', icon: 'check_circle' },
  { id: 'confirmed', label: 'Confirmed', icon: 'verified' },
  { id: 'follow_up_due', label: 'Follow-up Due', icon: 'schedule' },
  { id: 'follow_up_sent', label: 'Follow-up Sent', icon: 'send' },
];

const INTERVIEWING_SUBSTAGES = [
  { id: 'recruiter_screen', label: 'Recruiter Screen', icon: 'person_search' },
  { id: 'hiring_manager', label: 'Hiring Manager', icon: 'psychology' },
  { id: 'technical', label: 'Technical', icon: 'code' },
  { id: 'panel', label: 'Panel', icon: 'account_tree' },
  { id: 'final_round', label: 'Final Round', icon: 'stars' },
];

const DECISION_SUBSTAGES = [
  { id: "awaiting_decision", label: "Awaiting Decision", icon: "hourglass_empty" },
  { id: "references", label: "References", icon: "quick_reference_all" },
  { id: "verbal_offer", label: "Verbal Offer", icon: "chat" },
  { id: "written_offer_pending", label: "Written Offer Pending", icon: "description" },
  { id: "likely_reject", label: "Likely Reject", icon: "thumb_down" },
];

const ACCEPTED_SUBSTAGES = [
  { id: 'offer_received', label: 'Offer Received', icon: 'receipt_long' },
  { id: 'offer_reviewed', label: 'Offer Reviewed', icon: 'fact_check' },
  { id: 'formal_acceptance', label: 'Formal Acceptance', icon: 'handshake' },
  { id: 'close_pipelines', label: 'Close Pipelines', icon: 'cancel_presentation' },
  { id: 'pre_onboarding', label: 'Pre-onboarding', icon: 'assignment_ind' },
];

const REJECTED_SUBSTAGES = [
  { id: 'rejection_received', label: 'Rejection Received', icon: 'mail' },
  { id: 'rejection_classified', label: 'Rejection Classified', icon: 'category' },
  { id: 'optional_response', label: 'Optional Response', icon: 'reply' },
  { id: 'reflection_recorded', label: 'Reflection Recorded', icon: 'psychology' },
  { id: 'close_active_tasks', label: 'Close Active Tasks', icon: 'task_alt' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
];

const DECLINED_SUBSTAGES = [
  { id: 'offer_review', label: 'Offer Review', icon: 'description' },
  { id: 'reason_selection', label: 'Reason Selection', icon: 'checklist' },
  { id: 'response_preparation', label: 'Response Preparation', icon: 'edit_note' },
  { id: 'communication_sent', label: 'Communication Sent', icon: 'send' },
  { id: 'preference_learning', label: 'Preference Learning', icon: 'insights' },
  { id: 'archived_summary', label: 'Archived Summary', icon: 'archive' },
];

const WITHDRAWN_SUBSTAGES = [
  { id: 'decision_made', label: 'Decision Made', icon: 'exit_to_app' },
  { id: 'reason_selected', label: 'Reason Selected', icon: 'help_outline' },
  { id: 'contact_path', label: 'Contact Path', icon: 'alt_route' },
  { id: 'withdrawal_sent', label: 'Withdrawal Sent', icon: 'outgoing_mail' },
  { id: 'close_active_tasks', label: 'Close Active Tasks', icon: 'task_alt' },
  { id: 'preference_learning', label: 'Preference Learning', icon: 'insights' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
];



const getScoreColors = (score) => {
    if (score >= 80) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    if (score >= 60) return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
};

const getScoreComparison = (score, avgScore) => {
    if (avgScore === null || avgScore === undefined) return null;
    const diff = score - avgScore;
    const absDiff = Math.abs(Math.round(diff));
    const isAbove = diff > 0.5;
    const isBelow = diff < -0.5;
    return { diff, absDiff, isAbove, isBelow, avg: Math.round(avgScore) };
};

const safeParseJSON = (data, fallback = {}) => {
    if (!data) return fallback;
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch (e) { return fallback; }
};

function GeneratedSubStagePanel({ app, onRefresh, onStageChange }) {
  const { fetchWithAuth } = useAuth();
  const [activeSubStage, setActiveSubStage] = useState('resume');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCLEditorOpen, setIsCLEditorOpen] = useState(false);
  const [isCLPreviewExpanded, setIsCLPreviewExpanded] = useState(false);
  const [refineInstructions, setRefineInstructions] = useState('');
  const [pendingRefinement, setPendingRefinement] = useState(null);

  // Parse JSON fields safely
  const requirements = safeParseJSON(app?.parsed_requirements, []);
  const skills = safeParseJSON(app?.parsed_skills, []);
  const changes = safeParseJSON(app?.resume_changes_summary, []);
  const matchDetails = safeParseJSON(app?.match_details, {});

  // Auto-generate if missing
  useEffect(() => {
    if (app && !app.tailored_resume_path && !isGenerating && !error) {
      handleRegenerate('resume');
    }
  }, [app?.id]);

  const handleRegenerate = async (type, instructions = '') => {
    setIsGenerating(true);
    setError(null);
    try {
      const endpoint = type === 'resume' ? '/api/tailor-resume' : '/api/generate-cover-letter';
      const body = { application_id: app.id };
      if (instructions) body.instructions = instructions;
      
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `Failed to generate ${type}`);
      }

      const data = await response.json();

      // Persist the generated file path back to the application record
      if (type === 'cover_letter' && data?.files?.docx) {
        const clFilename = data.files.docx.split('/').pop();
        await fetchWithAuth(`/api/applications/${app.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cover_letter_path: clFilename, cover_letter_text: data.content || '' })
        });
      }
      
      await onRefresh();
      if (type === 'resume') setSelectedRecommendations([]);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditorRegenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetchWithAuth('/api/refine-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: app.id,
          instructions: refineInstructions,
          current_resume_data: safeParseJSON(app.resume_data, {}),
          original_filename: app.original_resume_path?.split('/')?.pop() || '',
          original_text_content: app.diff_data?.original || ''
        })
      });
      
      if (!res.ok) throw new Error('Refinement failed');
      const data = await res.json();
      setPendingRefinement(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveRefinement = async () => {
    setIsGenerating(true);
    try {
      const res = await fetchWithAuth('/api/approve-refinement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: app.id,
          pending_refinement: pendingRefinement
        })
      });
      if (!res.ok) throw new Error('Approval failed');
      setPendingRefinement(null);
      setRefineInstructions('');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSync = async (showLoader = true) => {
    if (showLoader) setIsGenerating(true);
    try {
      await onRefresh();
    } finally {
      if (showLoader) setIsGenerating(false);
    }
  };

  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.875rem 1.25rem',
    borderRadius: '1rem',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    borderLeft: activeSubStage === id ? '2px solid var(--primary)' : '2px solid transparent',
    marginBottom: '0.5rem',
    color: activeSubStage === id ? 'var(--primary)' : 'var(--text-secondary)',
  });

  const renderContent = () => {
    if (error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem', color: '#f87171' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>error</span>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Generation Failed</h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '400px' }}>{error}</p>
            <button 
              onClick={() => handleRegenerate(activeSubStage === 'cover_letter' ? 'cover_letter' : 'resume')} 
              className="btn-primary" 
              style={{ marginTop: '1.5rem', background: '#f87171' }}
            >
              Retry Generation
            </button>
          </div>
        </div>
      );
    }

    if (isGenerating) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem' }}>
          <div className="spinner" style={{ width: '3rem', height: '3rem', border: '4px solid rgba(37, 106, 244, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {activeSubStage === 'resume' ? 'Tailoring Resume...' : 'Generating Cover Letter...'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Our AI is optimizing your documents for the job requirements.</p>
          </div>
        </div>
      );
    }

    switch (activeSubStage) {
      case 'resume':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Strategy & Analysis */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', paddingRight: '1rem' }} className="custom-scrollbar">
              {/* Job Requirements Alignment */}
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1.5rem' }}>Job Requirements Alignment</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {requirements.length > 0 ? requirements.map((req, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#10b981', marginTop: '2px' }}>check_circle</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{req}</p>
                    </div>
                  )) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No specific requirements parsed yet. Try enriching the application.</p>
                  )}
                </div>
              </div>

              {/* Keyword Map */}
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(37, 106, 244, 0.05), transparent)' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1.5rem' }}>Detected Skills & Keywords</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {skills.length > 0 ? skills.map((skill, i) => (
                    <span key={i} style={{ 
                      padding: '0.4rem 0.75rem', 
                      background: 'rgba(37, 106, 244, 0.1)', 
                      border: '1px solid rgba(37, 106, 244, 0.2)', 
                      borderRadius: '99px', 
                      fontSize: '10px', 
                      fontWeight: 800, 
                      color: 'var(--primary)',
                      textTransform: 'uppercase'
                    }}>
                      {skill}
                    </span>
                  )) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No skills extracted.</p>
                  )}
                </div>
                
                <div style={{ marginTop: '2rem', position: 'relative', height: '140px', borderRadius: '1rem', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>{app?.match_score || '—'}%</div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.1em' }}>Overall Match Score</span>
                  </div>
                </div>
              </div>

              {/* Optimization Recommendations Card */}
              {matchDetails?.coaching_plan?.length > 0 && (
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37, 106, 244, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>auto_awesome</span>
                    </div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Optimization Tips</h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {matchDetails.coaching_plan.map((tip, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }} onClick={() => {
                        setSelectedRecommendations(prev => 
                          prev.includes(tip) ? prev.filter(t => t !== tip) : [...prev, tip]
                        );
                      }}>
                        <div style={{ 
                          width: '18px', height: '18px', borderRadius: '4px', 
                          border: `2px solid ${selectedRecommendations.includes(tip) ? 'var(--primary)' : 'var(--border-color)'}`,
                          background: selectedRecommendations.includes(tip) ? 'var(--primary)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px'
                        }}>
                          {selectedRecommendations.includes(tip) && <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'white', fontWeight: 900 }}>check</span>}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{tip}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    className="btn-primary" 
                    disabled={selectedRecommendations.length === 0 || isGenerating}
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.8rem' }}
                    onClick={() => handleRegenerate('resume', selectedRecommendations)}
                  >
                    {isGenerating ? 'Applying Changes...' : 'Apply Selected Improvements'}
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Preview & Versions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
              <div className="card glass" style={{ flex: 1, borderRadius: '1.5rem', border: '1px solid rgba(37, 106, 244, 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 22, 34, 0.6)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 auto', minWidth: '200px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', flexShrink: 0 }}>description</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {app?.tailored_resume_path || 'No Resume Generated'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                    {app?.tailored_resume_path && (
                      <button 
                        onClick={() => setIsPreviewExpanded(true)}
                        className="btn-secondary" 
                        style={{ padding: '0.4rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', minWidth: 'auto' }}
                        title="View Fullscreen"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>fullscreen</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleRegenerate('resume')}
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      title="Re-generate Resume"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                      REGENERATE
                    </button>
                    {app?.tailored_resume_path && (
                      <button 
                        onClick={() => setIsEditorOpen(true)}
                        className="btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        title="Edit Manually"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                        EDIT
                      </button>
                    )}
                    {app?.tailored_resume_path && (
                      <a 
                        href={`/api/download/${app.tailored_resume_path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>
                        DOWNLOAD
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, background: 'rgba(30, 41, 59, 0.3)', padding: '1rem', overflowY: 'auto', display: 'flex', justifyContent: 'center' }} className="custom-scrollbar">
                  {app?.tailored_resume_path ? (
                    <div 
                      onClick={() => setIsPreviewExpanded(true)}
                      style={{ 
                        width: '100%', 
                        maxWidth: '750px', 
                        padding: '3rem', 
                        background: 'white', 
                        boxShadow: '0 20px 50px rgba(0,0,0,0.4)', 
                        borderRadius: '0.5rem', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        fontFamily: '"Montserrat", sans-serif',
                        fontSize: '0.85rem',
                        lineHeight: '1.6',
                        color: '#1e293b',
                        whiteSpace: 'pre-wrap'
                      }}
                      className="job-match-scroll"
                    >
                      {app?.resume_data ? (
                        (() => {
                          const data = safeParseJSON(app.resume_data, {});
                          // resume_data is from parse_docx: has sections[] and full_text[]
                          const sections = data.sections || [];
                          const fullText = data.full_text || [];
                          // Name is typically the first line of full_text
                          const nameText = fullText[0] || '';
                          // Header lines (contact info) are typically items 1-3
                          const contactLines = fullText.slice(1, 4).filter(l => l && l.trim());
                          // Body sections (exclude table sections and very short titles)
                          const bodySections = sections.filter(s => s.type !== 'table' && s.title !== 'Header');
                          return (
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                              {nameText && (
                                <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #256af4', paddingBottom: '1.25rem' }}>
                                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#256af4', letterSpacing: '-0.01em' }}>{nameText}</h1>
                                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    {contactLines.map((line, i) => (
                                      <span key={i}>{line}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {bodySections.map((section, si) => (
                                <div key={si} style={{ marginBottom: '1.5rem' }}>
                                  <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#256af4', marginBottom: '0.6rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                                    {section.title}
                                  </h2>
                                  {Array.isArray(section.content) && section.content.map((item, ii) => (
                                    <p key={ii} style={{ margin: '0 0 0.35rem 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>{item}</p>
                                  ))}
                                </div>
                              ))}

                              {bodySections.length === 0 && fullText.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No preview content available.</div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          No preview data available.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>description</span>
                      <p>No tailored resume generated yet.</p>
                      <button onClick={() => handleRegenerate('resume')} className="btn-primary" style={{ marginTop: '1rem' }}>Generate Now</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Changes Summary */}
              <div className="card glass" style={{ padding: '1.25rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Key Changes & Tailoring</h3>
                <div style={{ flex: 1 }}>
                  {changes.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {changes.map((change, i) => (
                        <li key={i} style={{ marginBottom: '0.5rem' }}>{change}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Detailed change list will appear after generation.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'cover_letter':
        if (isCLEditorOpen) {
          return (
            <ResumeEditor
              docxFilename={app?.cover_letter_path}
              applicationId={app?.id}
              resumeData={{}}
              refineInstructions={refineInstructions}
              setRefineInstructions={setRefineInstructions}
              onRegenerate={() => handleRegenerate('cover_letter', refineInstructions)}
              isRegenerating={isGenerating}
              onBack={() => setIsCLEditorOpen(false)}
              pendingRefinement={null}
              onApproveRefinement={() => {}}
              onDeclineRefinement={() => {}}
              onSync={handleSync}
              initialTab="manual"
            />
          );
        }
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
              <div className="card glass" style={{ flex: 1, borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                {/* Header */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 22, 34, 0.6)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 auto', minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', flexShrink: 0 }}>mail</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app?.cover_letter_path || 'Generated Cover Letter'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleRegenerate('cover_letter')}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                      REGENERATE
                    </button>
                    {app?.cover_letter_path && (
                      <>
                        <button
                          onClick={() => setIsCLEditorOpen(true)}
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit_document</span>
                          EDIT
                        </button>
                        <button
                          onClick={() => setIsCLPreviewExpanded(true)}
                          className="btn-secondary"
                          style={{ padding: '0.4rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center' }}
                          title="Fullscreen Preview"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>fullscreen</span>
                        </button>
                        <a
                          href={`/api/download/${app.cover_letter_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ padding: '0.4rem', borderRadius: '0.5rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                          title="Download"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview body */}
                <div style={{ flex: 1, background: 'rgba(30, 41, 59, 0.3)', padding: '1rem', overflowY: 'auto', display: 'flex', justifyContent: 'center' }} className="custom-scrollbar">
                  {app?.cover_letter_text ? (
                    <div
                      onClick={() => setIsCLPreviewExpanded(true)}
                      style={{
                        width: '100%',
                        maxWidth: '750px',
                        padding: '3rem',
                        background: 'white',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        fontFamily: '"Montserrat", sans-serif',
                        fontSize: '0.88rem',
                        lineHeight: '1.7',
                        color: '#1e293b',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {app.cover_letter_text}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>mail</span>
                      <p>No cover letter generated yet.</p>
                      <button onClick={() => handleRegenerate('cover_letter')} className="btn-primary" style={{ marginTop: '1rem' }}>Generate Now</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }} className="custom-scrollbar">
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', borderLeft: '4px solid rgba(37, 106, 244, 0.4)' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>stars</span>
                  Strategic Alignment
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  The cover letter emphasizes your skills in <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{skills.slice(0, 3).join(', ')}</span> as requested by the job description.
                </p>
              </div>

              <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>history</span>
                  Generation Info
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                    <span style={{ color: app?.cover_letter_text ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                      {app?.cover_letter_text ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Format</span>
                    <span style={{ color: 'var(--text-primary)' }}>DOCX + PDF</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>AI Model</span>
                    <span style={{ color: 'var(--text-primary)' }}>GPT-4o (Tailored)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CL Fullscreen Preview Overlay */}
            {isCLPreviewExpanded && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button onClick={() => setIsCLPreviewExpanded(false)} className="btn-secondary" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }} className="custom-scrollbar">
                  <div style={{ width: '100%', maxWidth: '800px', padding: '4rem', background: 'white', borderRadius: '0.5rem', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', fontFamily: '"Montserrat", sans-serif', fontSize: '0.9rem', lineHeight: 1.75, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                    {app?.cover_letter_text}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'answers':
      case 'prep':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>
              {activeSubStage === 'answers' ? 'chat' : 'school'}
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {activeSubStage === 'answers' ? 'Interview Answers' : 'Interview Prep'}
            </h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '400px' }}>
              This section is automatically populated based on your tailored resume and the job requirements.
              {activeSubStage === 'answers' ? ' Practice these responses to align with the AI strategy.' : ' Study the company research and STAR stories prepared for you.'}
            </p>
            <button className="btn-secondary" style={{ marginTop: '1.5rem' }}>Coming Soon</button>
          </div>
        );
      default:
        return null;
    }
  };

  if (isEditorOpen) {
    return (
      <ResumeEditor 
        docxFilename={app?.tailored_resume_path}
        applicationId={app?.id}
        resumeData={safeParseJSON(app?.resume_data, {})}
        refineInstructions={refineInstructions}
        setRefineInstructions={setRefineInstructions}
        onRegenerate={handleEditorRegenerate}
        isRegenerating={isGenerating}
        onBack={() => setIsEditorOpen(false)}
        pendingRefinement={pendingRefinement}
        onApproveRefinement={handleApproveRefinement}
        onDeclineRefinement={() => setPendingRefinement(null)}
        onSync={handleSync}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', padding: '0 1rem', marginBottom: '0.5rem' }}>Artifacts</h3>
        {GENERATED_SUBSTAGES.map((s) => (
          <button key={s.id} onClick={() => setActiveSubStage(s.id)} style={navStyle(s.id)}>
            <span className="material-symbols-outlined" style={{ 
              fontSize: '1.25rem',
              fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
            }}>
              {s.icon}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}>{s.label}</span>
          </button>
        ))}
        
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '1rem', padding: '1rem' }}>
             <p style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Strategy Ready</p>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Documents are tailored to <strong>{app?.match_score || 0}%</strong> match accuracy.</p>
          </div>
        </div>
      </div>

      {/* Right: Content Panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </div>
      {isPreviewExpanded && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.95)', 
          zIndex: 9999, 
          display: 'flex', 
          flexDirection: 'column',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button 
              onClick={() => setIsPreviewExpanded(false)}
              className="btn-secondary"
              style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div style={{ 
            flex: 1, 
            background: 'white', 
            borderRadius: '0.5rem', 
            overflowY: 'auto', 
            padding: '4rem', 
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            maxWidth: '1000px',
            margin: '0 auto',
            width: '100%'
          }} className="custom-scrollbar">
            {app?.resume_data ? (
              (() => {
                const data = safeParseJSON(app.resume_data, {});
                return (
                  <div style={{ maxWidth: '850px', margin: '0 auto', color: '#1e293b', fontFamily: '"Montserrat", sans-serif', lineHeight: 1.6 }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem', borderBottom: '3px solid #256af4', paddingBottom: '2rem' }}>
                      <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: '0 0 0.5rem 0', color: '#256af4' }}>{data.contact_info?.name || 'Your Name'}</h1>
                      <div style={{ fontSize: '1rem', color: '#64748b', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                        {data.contact_info?.email && <span>{data.contact_info.email}</span>}
                        {data.contact_info?.phone && <span>{data.contact_info.phone}</span>}
                        {data.contact_info?.location && <span>{data.contact_info.location}</span>}
                      </div>
                    </div>

                    {data.summary && (
                      <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#256af4', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Summary</h2>
                        <p style={{ margin: 0, fontSize: '1rem', textAlign: 'justify' }}>{data.summary}</p>
                      </div>
                    )}

                    {data.experience?.length > 0 && (
                      <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#256af4', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Experience</h2>
                        {data.experience.map((exp, idx) => (
                          <div key={idx} style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                              <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{exp.job_title}</strong>
                              <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>{exp.dates}</span>
                            </div>
                            <div style={{ color: '#256af4', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>{exp.company}</div>
                            <ul style={{ margin: 0, paddingLeft: '2rem', fontSize: '1rem', color: '#334155' }}>
                              {exp.responsibilities?.map((resp, i) => (
                                <li key={i} style={{ marginBottom: '0.6rem', textAlign: 'justify' }}>{resp}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {data.skills?.length > 0 && (
                      <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#256af4', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Technical Proficiencies</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          {data.skills.map((skill, i) => (
                            <span key={i} style={{ background: 'rgba(37, 106, 244, 0.05)', color: '#256af4', padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, border: '1px solid rgba(37, 106, 244, 0.2)' }}>{skill}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Preview data loading...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SavedSubStagePanel({ app, onRefresh, avgScore, onStageChange, connections = [], onAddContact, onSearchPeople, handleGenerateOutreach, generatingOutreach, outreachScript, setOutreachScript, openEditContact, handleDeleteContact }) {
  const { fetchWithAuth } = useAuth();
  const [activeSubStage, setActiveSubStage] = useState('parsed');
  const [companyView, setCompanyView] = useState('detailed');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [instructions, setInstructions] = useState({ resume: '', cl: '' });
  const [reviewForm, setReviewForm] = useState({});
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isReviewEditMode, setIsReviewEditMode] = useState(false);

  useEffect(() => {
    if (app) setReviewForm(app);
  }, [app]);

  useEffect(() => {
    const progress = safeParseJSON(app?.substage_progress, {});
    setIsReviewEditMode(!progress.reviewed);
  }, [app?.substage_progress]);

  const handleReviewFormChange = (field, value) => {
    setReviewForm(prev => ({ ...prev, [field]: value }));
  };

  const handleApproveDetails = async () => {
    setIsSavingReview(true);
    try {
      const progress = safeParseJSON(app?.substage_progress, {});
      const payload = {
        ...reviewForm,
        substage_progress: { ...progress, reviewed: true }
      };
      
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        onRefresh();
        setActiveSubStage('network');
      }
    } catch (e) {
      console.error("Failed to save review", e);
    } finally {
      setIsSavingReview(false);
    }
  };

  const isComplete = (id) => {
    if (id === 'parsed') return true;
    const progress = safeParseJSON(app?.substage_progress, {});
    return progress?.[id] === true;
  };

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

  const handleRefreshAnalysis = async () => {
    setIsEnriching(true);
    setIsScoring(true);
    try {
      await Promise.all([
        fetchWithAuth(`${API_URL}/api/applications/${app.id}/enrich?force=true`, { method: 'POST' }),
        fetchWithAuth(`${API_URL}/api/applications/${app.id}/score`, { method: 'POST' })
      ]);
      onRefresh();
    } catch (e) {
      console.error("Failed to refresh analysis", e);
    } finally {
      setIsEnriching(false);
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
        const SkeletonText = ({ lines = 1 }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', animation: 'skeletonPulse 1s infinite alternate' }}>
            {Array.from({ length: lines }).map((_, i) => (
              <div key={i} style={{ width: i === lines - 1 && lines > 1 ? '70%' : '100%', height: '1.2rem', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }} />
            ))}
          </div>
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            <style>{`
              @keyframes skeletonPulse {
                0% { opacity: 0.4; }
                100% { opacity: 0.8; }
              }
            `}</style>
            {/* Header Area with Job Match Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Job Analysis (Parsed)</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Structured data extracted from the job posting</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={handleRefreshAnalysis} 
                  disabled={isEnriching || isScoring}
                  className="btn-secondary" 
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isEnriching || (isScoring && isEnriching) ? 'hourglass_empty' : 'refresh'}</span>
                  {isEnriching ? 'Refreshing...' : 'Refresh Analysis'}
                </button>
                <button 
                  onClick={handleMatchReload} 
                  disabled={isScoring || isEnriching}
                  className="btn-primary" 
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isScoring && !isEnriching ? 'hourglass_empty' : 'model_training'}</span>
                  {isScoring && !isEnriching ? 'Generating...' : 'Generate Custom Resume'}
                </button>
              </div>
            </div>

            {app.match_score != null && (() => {
              const cmp = getScoreComparison(app.match_score, avgScore);
              const sc = getScoreColors(app.match_score);
              return (
                  <div id="compatibility-score-section" className="card glass" style={{ padding: '1.25rem', border: '1px solid var(--primary)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)' }}>
                      <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(37, 106, 244, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>analytics</span>
                          <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary)' }}>Compatibility Score</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{
                                  width: '80px', height: '80px', borderRadius: '50%',
                                  background: sc.bg, color: sc.text,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '2rem', fontWeight: 800, border: `4px solid ${sc.border}`,
                              }}>
                                  {app.match_score}
                              </div>
                              {cmp && (cmp.isAbove || cmp.isBelow) && (
                                  <span style={{
                                      position: 'absolute', bottom: 0, right: 0,
                                      width: 22, height: 22, borderRadius: '50%',
                                      background: cmp.isAbove ? '#10b981' : '#ef4444',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '11px', fontWeight: 900, color: 'white',
                                      border: '2px solid var(--bg-card)', lineHeight: 1,
                                  }}>
                                      {cmp.isAbove ? '▲' : '▼'}
                                  </span>
                              )}
                          </div>
                          <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                                  {app.match_score >= 80 ? 'Excellent match for your profile!' :
                                   app.match_score >= 60 ? 'Good match with some gaps.' :
                                   'Challenging match. Significant tailoring recommended.'}
                              </div>
                              {cmp && (
                                  <div style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                      fontSize: '0.82rem', fontWeight: 700,
                                      color: cmp.isAbove ? '#10b981' : cmp.isBelow ? '#ef4444' : 'var(--text-muted)',
                                      background: cmp.isAbove ? 'rgba(16,185,129,0.1)' : cmp.isBelow ? 'rgba(239,68,68,0.1)' : 'var(--bg-tertiary)',
                                      border: `1px solid ${cmp.isAbove ? 'rgba(16,185,129,0.3)' : cmp.isBelow ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                      borderRadius: '2rem', padding: '0.2rem 0.65rem',
                                  }}>
                                      <span style={{ fontSize: '0.75rem' }}>
                                          {cmp.isAbove ? '▲' : cmp.isBelow ? '▼' : '◆'}
                                      </span>
                                      {cmp.isAbove
                                          ? `${cmp.absDiff} pts above your avg (${cmp.avg})`
                                          : cmp.isBelow
                                              ? `${cmp.absDiff} pts below your avg (${cmp.avg})`
                                              : `Equal to your avg (${cmp.avg})`
                                      }
                                  </div>
                              )}
                          </div>
                      </div>
                      {(() => {
                          const matchData = safeParseJSON(app?.match_details, { criteria_scores: {} });
                          const scores = matchData.criteria_scores || {};
                          if (!app?.match_details || Object.keys(scores).length === 0) return null;
                          return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {Object.entries(scores).map(([key, info]) => (
                                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{String(key).replace(/_/g, ' ')}</span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{info?.score ?? '?'}/20</span>
                                      </div>
                                  ))}
                              </div>
                          );
                      })()}
                  </div>
              );
            })()}

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

              </div>
            </div>

            {/* Compensation Details */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Compensation Details</h4>
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
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.bonus_equity || extractInline(app.job_description, ['bonus', 'equity', 'stock', 'rsu']) || 'Not specified'}</div>
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
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.travel_requirements || extractInline(app.job_description, ['travel']) || 'None specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Relocation Support</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{app.relocation || 'Not offered'}</div>
                </div>
              </div>
            </div>

            {/* Role Overview */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Role Overview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Job Summary / Mission</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{isEnriching ? <SkeletonText lines={3} /> : (app.job_summary || 'Not provided')}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Core Purpose</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{isEnriching ? <SkeletonText lines={2} /> : (app.core_purpose || 'Not provided')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Function / Department</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{isEnriching ? <SkeletonText /> : (app.function_dept || 'Not specified')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Reporting Line</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{isEnriching ? <SkeletonText /> : (app.reporting_line || 'Not specified')}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Team Context</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{isEnriching ? <SkeletonText lines={2} /> : (app.team_context || 'Not specified')}</div>
                </div>
              </div>
            </div>

            {/* Primary Responsibilities */}
            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Primary Responsibilities</h4>
              {isEnriching ? <SkeletonText lines={5} /> : (
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
              )}
            </div>

            {/* Requirements & Skills Section */}
            {(() => {
              const reqs = safeParseJSON(app.parsed_requirements, []);
              const prefs = safeParseJSON(app.parsed_preferences, []);
              const skills = safeParseJSON(app.parsed_skills, []);
              
              if (!reqs.length && !prefs.length && !skills.length) {
                // Fallback to naive extraction
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 -0.5rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Requirements & Skills</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Key Skills</div>
                        {isEnriching ? <SkeletonText lines={3} /> : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {extractSection(app.job_description, ['skills', 'proficient', 'experience with', 'knowledge of']).map((skill, i) => {
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
                        )}
                      </div>
                      <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Requirements</div>
                        {isEnriching ? <SkeletonText lines={3} /> : (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {extractSection(app.job_description, ['experience', 'years', 'education', 'degree']).map((req, i) => {
                              const match = hasMatch(req);
                              return (
                                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'circle'}</span>
                                  {req}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 -0.5rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Requirements & Skills</h4>
                  
                  {skills.length > 0 && (
                    <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Target Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {skills.map((skill, i) => {
                          const match = hasMatch(skill);
                          return (
                            <div key={i} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, background: match ? 'rgba(37,106,244,0.1)' : 'var(--bg-tertiary)', color: match ? 'var(--primary)' : 'var(--text-secondary)', border: `1px solid ${match ? 'var(--primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {match && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                              {skill}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {reqs.length > 0 && (
                      <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Requirements</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {reqs.map((req, i) => {
                            const match = hasMatch(req);
                            return (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'circle'}</span>
                                {req}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                    {prefs.length > 0 && (
                      <div className="card glass" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Preferences</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {prefs.map((pref, i) => {
                            const match = hasMatch(pref);
                            return (
                              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.9rem', color: match ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: match ? 600 : 400 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: '2px', color: match ? 'var(--primary)' : 'var(--text-muted)' }}>{match ? 'check_circle' : 'add_circle'}</span>
                                {pref}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            
          </div>
        );

      case 'reviewed':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Review Job Details</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review and fill in missing job details before proceeding.</p>
              </div>
              {isReviewEditMode ? (
                <button 
                  onClick={handleApproveDetails} 
                  disabled={isSavingReview}
                  className="btn-primary" 
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isSavingReview ? 'hourglass_empty' : 'check'}</span>
                  {isSavingReview ? 'Saving...' : 'Approve'}
                </button>
              ) : (
                <button 
                  onClick={() => setIsReviewEditMode(true)} 
                  className="btn-secondary" 
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                  Edit Details
                </button>
              )}
            </div>

            <div className="card glass" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color-card)', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {[
                  { id: 'job_title', label: 'Job Title', type: 'text', colSpan: 1 },
                  { id: 'company', label: 'Company', type: 'text', colSpan: 1 },
                  { id: 'location', label: 'Location', type: 'text', colSpan: 1 },
                  { id: 'location_type', label: 'Location Type', type: 'select', options: ['Remote', 'Hybrid', 'On-site'], colSpan: 1 },
                  { id: 'job_type', label: 'Job Type', type: 'select', options: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'], colSpan: 1 },
                  { id: 'salary_range', label: 'Salary Range', type: 'text', colSpan: 1 },
                  { id: 'bonus_equity', label: 'Bonus / Equity Summary', type: 'text', colSpan: 1 },
                  { id: 'travel_requirements', label: 'Travel Requirements', type: 'text', colSpan: 1 },
                  { id: 'date_posted', label: 'Date Posted', type: 'date', colSpan: 1 },
                  { id: 'deadline', label: 'Application Deadline', type: 'date', colSpan: 1 },
                  { id: 'apply_url', label: 'Application URL', type: 'text', colSpan: 1 },
                  { id: 'job_url', label: 'Job Listing URL', type: 'text', colSpan: 1 },
                  { id: 'source', label: 'Source (LinkedIn, Indeed, etc)', type: 'text', colSpan: 1 },
                  { id: 'interest_level', label: 'Interest Level', type: 'select', options: ['High', 'Medium', 'Low'], colSpan: 1 },
                  { id: 'relocation', label: 'Relocation Required', type: 'select', options: [{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}, {label: 'Unknown', value: ''}], colSpan: 1 },
                  { id: 'commute_time_mins', label: 'Commute Time (mins)', type: 'number', colSpan: 1 },
                  { id: 'commute_distance_miles', label: 'Commute Distance (miles)', type: 'number', colSpan: 1 },
                  { id: 'glassdoor_rating', label: 'Glassdoor Rating', type: 'text', colSpan: 1 },
                  { id: 'glassdoor_url', label: 'Glassdoor URL', type: 'text', colSpan: 1 },
                  { id: 'indeed_rating', label: 'Indeed Rating', type: 'text', colSpan: 1 },
                  { id: 'indeed_url', label: 'Indeed URL', type: 'text', colSpan: 1 },
                  { id: 'linkedin_rating', label: 'LinkedIn Rating', type: 'text', colSpan: 1 },
                  { id: 'linkedin_url', label: 'LinkedIn URL', type: 'text', colSpan: 1 },
                  { id: 'remarks', label: 'Remarks / Internal Notes', type: 'textarea', colSpan: 2 },
                  { id: 'job_description', label: 'Full Job Description', type: 'textarea', colSpan: 2 }
                ].map(field => {
                  const requiredFields = ['job_title', 'company', 'location', 'location_type', 'job_type', 'apply_url'];
                  const isMissing = requiredFields.includes(field.id) && !reviewForm[field.id];
                  
                  return (
                    <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: field.colSpan === 2 ? 'span 2' : 'span 1', minWidth: 0 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: isMissing && isReviewEditMode ? '#f87171' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {field.label}
                        {isMissing && isReviewEditMode && <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#f87171' }}>error</span>}
                        {!requiredFields.includes(field.id) && isReviewEditMode && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>}
                      </label>
                      {!isReviewEditMode ? (
                        <div 
                          style={{ 
                            padding: '0.75rem', 
                            background: 'var(--bg-tertiary)', 
                            borderRadius: '0.5rem', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-primary)', 
                            fontSize: '0.95rem', 
                            minHeight: field.type === 'textarea' ? '100px' : 'auto', 
                            whiteSpace: field.id.endsWith('_url') ? 'nowrap' : 'pre-wrap',
                            overflow: field.id.endsWith('_url') ? 'hidden' : 'visible',
                            textOverflow: field.id.endsWith('_url') ? 'ellipsis' : 'clip'
                          }}
                          title={field.id.endsWith('_url') ? (app[field.id] || '') : undefined}
                        >
                          {app[field.id] || '—'}
                        </div>
                      ) : field.type === 'select' ? (
                        <select
                          value={reviewForm[field.id] || ''}
                          onChange={(e) => handleReviewFormChange(field.id, e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${isMissing ? '#f87171' : 'var(--border-color)'}`, background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                        >
                          <option value="" style={{ background: 'var(--bg-panel)' }}>Select...</option>
                          {field.options.map(opt => (
                            <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value} style={{ background: 'var(--bg-panel)' }}>
                              {typeof opt === 'string' ? opt : opt.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          value={reviewForm[field.id] || ''}
                          onChange={(e) => handleReviewFormChange(field.id, e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${isMissing ? '#f87171' : 'var(--border-color)'}`, background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', minHeight: field.id === 'job_description' ? '250px' : '100px', resize: 'vertical' }}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={reviewForm[field.id] || ''}
                          onChange={(e) => handleReviewFormChange(field.id, e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${isMissing ? '#f87171' : 'var(--border-color)'}`, background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', colorScheme: 'dark' }}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 'network':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Network Contacts</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>People you can reach out to at {app.company}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={onSearchPeople} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person_add</span>
                  Add Contact
                </button>
              </div>
            </div>

            {/* Application Contacts Section */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>contact_page</span>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.1em' }}>Application Contacts</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                {app.contacts?.length > 0 ? app.contacts.map((contact, i) => (
                  <div key={contact.id || i} className="card glass" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', minWidth: 0 }}>
                      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                        {contact.photo_url ? (
                          <img src={contact.photo_url} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          contact.name?.charAt(0)
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</h4>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.role || contact.headline || 'Application Contact'}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                           <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', textTransform: 'uppercase' }}>Saved</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>link</span>
                        </a>
                      )}
                      <button onClick={() => handleGenerateOutreach && handleGenerateOutreach(contact)} className="btn-primary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }} title="Generate Outreach Script">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>mail</span>
                      </button>
                      <button onClick={() => openEditContact(contact)} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }} title="Edit Contact">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.5rem', border: '1px dashed var(--border-color)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>person_off</span>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No contacts saved for this application yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* LinkedIn Matches Section */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.2rem' }}>hub</span>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.1em' }}>Potential Connections (LinkedIn)</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                {(() => {
                  const filteredConnections = connections.filter(person => {
                    const isMatch = app.contacts?.some(contact => {
                      return (contact.linkedin_url && person.profile_url && contact.linkedin_url === person.profile_url) ||
                             (contact.name && person.name && contact.name === person.name);
                    });
                    return !isMatch;
                  });

                  return filteredConnections.length > 0 ? filteredConnections.map((person, i) => (
                  <div key={i} className="card glass" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', minWidth: 0 }}>
                      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          person.name?.charAt(0)
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</h4>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.headline || person.title || 'LinkedIn Match'}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                           <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(37, 106, 244, 0.1)', color: 'var(--primary)', border: '1px solid rgba(37, 106, 244, 0.2)', textTransform: 'uppercase' }}>Match</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <a href={person.profile_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>link</span>
                      </a>
                      <button 
                        onClick={() => onAddContact({ ...person, title: person.headline || person.title })} 
                        className="btn-primary" 
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}
                        title="Add to Application Contacts"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person_add</span>
                      </button>
                    </div>
                  </div>
                  )) : (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.5rem', border: '1px dashed var(--border-color)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>search_off</span>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No LinkedIn matches found for {app.company}.</p>
                  </div>
                  );
                })()}
              </div>
            </section>

            {/* AI Insight Card */}
            {/* AI Insight Card */}
            {(connections.length > 0 || outreachScript?.body) && (
              <div id="networking-strategy-card" style={{ background: 'linear-gradient(135deg, rgba(37, 106, 244, 0.15) 0%, rgba(16, 22, 34, 0.4) 100%)', borderRadius: '1.25rem', padding: '1.75rem', border: '1px solid rgba(37, 106, 244, 0.2)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s ease', opacity: generatingOutreach ? 0.7 : 1, filter: generatingOutreach ? 'brightness(1.2)' : 'none', ...(generatingOutreach ? { animation: 'pulse 2s infinite' } : {}) }}>
                {generatingOutreach && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'shimmer 1.5s infinite', zIndex: 0 }} />
                )}
                <div style={{ position: 'absolute', top: '-1rem', right: '-1rem', opacity: 0.1 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '6rem' }}>auto_awesome</span>
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1rem' }}>psychology</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Networking Strategy</span>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Leverage Your Network</h4>
                  
                  {outreachScript?.body ? (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                        Here is your generated outreach script. You can edit it directly before copying.
                      </p>
                      
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Subject Line</label>
                        <input 
                          type="text" 
                          value={outreachScript.subject} 
                          onChange={(e) => setOutreachScript({...outreachScript, subject: e.target.value})}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Message Content</label>
                        <textarea 
                          value={outreachScript.body}
                          onChange={(e) => setOutreachScript({...outreachScript, body: e.target.value})}
                          style={{ width: '100%', height: '200px', padding: '1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button onClick={() => { navigator.clipboard.writeText(`${outreachScript.subject}\n\n${outreachScript.body}`); }} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.85rem' }}>
                          Copy to Clipboard
                        </button>
                        <button onClick={() => handleGenerateOutreach && handleGenerateOutreach()} disabled={generatingOutreach} className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.85rem' }}>
                          {generatingOutreach ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px' }}>
                        We found {connections.length} potential connections at {app.company}. Reaching out to employees in similar roles or design leadership can significantly increase your chances of getting an interview. Focus on those with mutual connections or shared backgrounds.
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button onClick={() => handleGenerateOutreach && handleGenerateOutreach()} disabled={generatingOutreach} className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.85rem' }}>
                          {generatingOutreach ? 'Generating...' : 'Generate Outreach Script'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'company':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Company Research</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', border: '1px solid var(--border-color)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>travel_explore</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 2fr', gap: '2rem' }}>
              {/* Left Sidebar: Nav & Mission */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card glass" style={{ padding: '0.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                  {(() => {
                    const cNavItems = [
                      { id: 'overview', label: 'Company Overview', icon: 'dashboard' },
                      { id: 'detailed', label: 'Detailed Research', icon: 'manage_search' },
                      { id: 'financials', label: 'Financials & Market', icon: 'bar_chart' },
                      { id: 'competitors', label: 'Competitor Matrix', icon: 'view_headline' },
                    ];
                    return (
                      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {cNavItems.map(item => (
                          <button key={item.id} onClick={() => setCompanyView(item.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '0.75rem', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.85rem', fontWeight: companyView === item.id ? 800 : 500, color: companyView === item.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: companyView === item.id ? 'rgba(37, 106, 244, 0.12)' : 'transparent', border: companyView === item.id ? '1px solid rgba(37,106,244,0.25)' : '1px solid transparent', transition: 'all 0.2s' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: companyView === item.id ? 'var(--primary-color)' : 'var(--text-muted)', fontVariationSettings: companyView === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                              {item.label}
                            </span>
                            {companyView === item.id ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)', boxShadow: '0 0 8px var(--primary-color)' }} /> : <span className="material-symbols-outlined" style={{ fontSize: '1rem', opacity: 0.3 }}>chevron_right</span>}
                          </button>
                        ))}
                      </nav>
                    );
                  })()}
                </div>

                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', top: '0', right: '0', padding: '1rem', opacity: 0.1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>format_quote</span>
                  </div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mission Statement</h4>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    "{app?.core_purpose || 'Unlock the potential of human creativity by giving artists the opportunity to live off their art.'}"
                  </p>
                </div>
              </div>

              {/* Main Content Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {companyView === 'overview' && <CompanyOverviewView app={app} />}
                {companyView === 'financials' && <FinancialsView app={app} />}
                {companyView === 'competitors' && <CompetitorView app={app} />}
                {companyView === 'detailed' && <>
                {/* Market Presence Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.2rem' }}>star</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Glassdoor</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{app?.glassdoor_rating || '4.2'}</div>
                    </div>
                  </div>
                  <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(37, 106, 244, 0.1)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>rate_review</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Indeed</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{app?.indeed_rating || '4.0'}</div>
                    </div>
                  </div>
                  <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>work</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>LinkedIn</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Verified</div>
                    </div>
                  </div>
                </div>

                {/* News Section */}
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Company News</h4>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>See all 24 sources</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="card glass" style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border-color)', borderLeft: '4px solid #22c55e', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>TechCrunch • 2 days ago</span>
                      <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{app?.company || 'Spotify'} expands AI DJ feature to Spanish-speaking markets globally</h5>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>The expansion follows a successful pilot in English-speaking markets, aiming to leverage localized cultural insights...</p>
                    </div>
                    <div className="card glass" style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary-color)', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Reuters • 1 week ago</span>
                      <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{app?.company || 'Spotify'} reports Q3 subscriber growth exceeding Wall Street estimates</h5>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>The streaming giant continues to diversify revenue through podcasting and audiobooks despite global economic headwinds...</p>
                    </div>
                  </div>
                </section>

                {/* Cultural Insights */}
                <section>
                   <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cultural & Engineering Insights</h4>
                   <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                     <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                          <div style={{ padding: '0.5rem', background: 'rgba(37, 106, 244, 0.1)', borderRadius: '0.75rem', display: 'flex' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.5rem' }}>hub</span>
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Squad Model 2.0</h5>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Autonomous teams with high alignment and loose coupling. Designers are embedded within cross-functional squads.</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                          {['Autonomy', 'Ownership', 'User-Centric'].map(tag => (
                            <span key={tag} style={{ padding: '0.25rem 0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{tag}</span>
                          ))}
                        </div>
                     </div>
                     <div className="card glass" style={{ borderRadius: '1rem', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                        <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxoyghDZv7ydchRv08fDkaZARI9BoaRXiYK1CSq6B0M45fULbeq5yESW9rmYpxA8NxWFllTUlHQCXr06GACyCUA7MPPMC57UFDEw8IVyL1KWgR9X96IQDKTqV0idB-dPs5cCD_ayV193zwC3Vwe75_TwPW_U0nfGf3Ns7H7DfMVdJKVqMeudmHS_BeVdGN2dlzVbNq0sK2zTqNY7PK0IFJDRUtEQcplbx6Bk-MZezEmQUmw_cfHrNxic9af0v9KXjHeW2-DFGWLpg" alt="Office" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16, 22, 34, 0.9), transparent)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Internal Tools</h5>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Proprietary design systems and frameworks used globally.</p>
                        </div>
                     </div>
                   </div>
                </section>

                {/* Research Notes */}
                <section className="card glass" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px dashed rgba(255, 255, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>edit_note</span>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Research Notes</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ width: '3px', height: 'auto', backgroundColor: 'var(--border-color)', borderRadius: '3px' }}></div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"Focus on the recent shift toward AI personalization in interviews. They value data-driven design decisions paired with emotional resonance."</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ width: '3px', height: 'auto', backgroundColor: 'var(--border-color)', borderRadius: '3px' }}></div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"Mention familiarity with the Encore Design System if possible. They are currently hiring for a major mobile redesign phase."</p>
                    </div>
                  </div>
                  <button style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px dashed rgba(255, 255, 255, 0.1)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
                    Add Research Entry
                  </button>
                </section>
                </>}
              </div>
            </div>
          </div>
        );
      case 'prioritized':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--primary-color)', fontSize: '10px', textTransform: 'uppercase', tracking: '0.2em', fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Stage IV: Selection Optimization</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', tracking: '-0.02em' }}>Final Prioritization Ranking</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem', maxWidth: '600px' }}>Aggregate your research data to finalize your intent. High-ranking roles will be prioritized for the Generation Phase.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.5rem', display: 'flex', border: '1px solid var(--border-color)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>leaderboard</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
              {/* Left Column: Strategic Evaluation & Rationale */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Strategic Evaluation Card */}
                <div className="card glass" style={{ padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '1rem', opacity: 0.1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>analytics</span>
                  </div>
                  <h4 style={{ margin: '0 0 2.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>analytics</span>
                    Strategic Evaluation
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {[
                      { id: 'job_fit', label: 'Job Fit', desc: 'How well do your skills and experience align with the core requirements of this role?', level: 4 },
                      { id: 'company_alignment', label: 'Company Alignment', desc: "Do the company's culture, mission, and long-term stability match your career goals?", level: 3 },
                      { id: 'overall_interest', label: 'Overall Interest', desc: 'Your personal level of excitement and motivation to work for this specific organization.', level: app?.interest_level || 5 }
                    ].map((dim) => (
                      <div key={dim.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ maxWidth: '400px' }}>
                          <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{dim.label}</h5>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{dim.desc}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <button key={i} style={{ 
                              width: '2.5rem', 
                              height: '2.5rem', 
                              borderRadius: '0.75rem', 
                              backgroundColor: i <= dim.level ? 'rgba(37, 106, 244, 0.15)' : 'rgba(255, 255, 255, 0.03)', 
                              color: i <= dim.level ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)', 
                              border: '1px solid ' + (i <= dim.level ? 'rgba(37, 106, 244, 0.2)' : 'transparent'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', fontVariationSettings: i <= dim.level ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rationale Section */}
                <div className="card glass" style={{ padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>description</span>
                    Prioritization Rationale
                  </h4>
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      style={{ 
                        width: '100%', 
                        minHeight: '160px', 
                        background: 'rgba(0, 0, 0, 0.2)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '1rem', 
                        padding: '1.25rem', 
                        color: 'var(--text-primary)', 
                        fontSize: '0.95rem', 
                        lineHeight: 1.6, 
                        resize: 'none',
                        outline: 'none'
                      }}
                      placeholder="Synthesize your research findings and explain why this role has earned its current priority ranking..."
                      defaultValue={app?.notes || ""}
                    />
                    <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer' }}>Import Notes</button>
                      <button style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer' }}>Clear</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Curation Intelligence */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Curation Intelligence</span>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>bolt</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="2.5"></circle>
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeDasharray="88, 100" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px var(--primary-color))' }}></circle>
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>88</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '2px' }}>Percent</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Compatibility Score</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>High Probability Match</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>verified</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Key Match Highlight</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Your experience with <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>React Architectures</span> perfectly aligns with the team's Q4 scaling initiatives.
                      </p>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>info</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Skill Gap Found</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Minor lack of exposure to <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Web3 protocols</span>; consider emphasizing quick-learning capabilities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card glass" style={{ borderRadius: '1.5rem', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIFwt82rHRUOiMAepNTtEXAxxDmrKq9-hmXKOU5bV8cB1bec0Ab0oAg179Py4XZg50VZunO-jH5N-ICfncvwsxIls2L02AOesiLB8K1LcimRT4K-ZfC4NoWdXfj3OO5nsK1QtBLvQ8Rfz6Kp-7CtA7BalPYKwz9FZBK57S_lERJooHWgUumGuaMEJvc4oDKYwYcSoqJaTkpjAFkeL5nihcRsS-J65Wqmw131sXXos2H83dBTD-_PiYuBqIOkKX2Syxhhxg0NCM6dk" alt="Nexus" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                  <div style={{ padding: '1.25rem' }}>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Global Tech Nexus</h5>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>San Francisco, CA</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Series D Funding</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>$240M+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky CTA Footer */}
            <div style={{ 
              position: 'fixed', 
              bottom: 0, 
              left: '520px', 
              right: 0, 
              padding: '1.5rem 3rem', 
              background: 'rgba(16, 22, 34, 0.8)', 
              backdropFilter: 'blur(12px)', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              zIndex: 100 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', marginLeft: '0.5rem' }}>
                  {[1, 2, 3].map(i => (
                    <img key={i} src={`https://lh3.googleusercontent.com/aida-public/AB6AXuDSOHxFW4pA6ydU1JORXejuRNqZRsU4G2P8A3XHy9b7pXaEp0lxxfzIsTcrXevruA_jr4sFzG_8TQhsevB0PVAqdefuJQtAKXvhmoUGO2MNx3CGxBV11Im9-szitQZg7A8BwTOxuPxY7RotbkjcfwbXcrvDeRqvIMvqY856HtdRgT9GO3QlW_AIPaMUQYxSzPoEJEZ2SSlaU5aZX4Xf-6wAKuBX6dLdjWv3V_dqCtaMlo0iP3-sQ4TzqxrM4bi1FPKyOVQ2HRc2SDc`} alt="Team" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: '2px solid var(--bg-surface)', marginLeft: '-0.5rem' }} />
                  ))}
                  <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '2px solid var(--bg-surface)', marginLeft: '-0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-secondary)' }}>+4</div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>6 team members are also tracking this role.</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 800 }}>Save as Draft</button>
                <button 
                  className="btn-primary" 
                  onClick={() => onStageChange('generated')}
                  style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Move to Generated Phase
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_forward</span>
                </button>
              </div>
            </div>
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
            {isComplete(s.id) ? (
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981' }}>check_circle</span>
            ) : (
              activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
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

function AppliedSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('submitted');

  const isComplete = (id) => {
    const progress = safeParseJSON(app?.substage_progress, {});
    return progress?.[id] === true;
  };

  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1.25rem',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: activeSubStage === id ? '1px solid rgba(37, 106, 244, 0.2)' : '1px solid transparent',
    marginBottom: '0.5rem',
    textAlign: 'left',
    width: '100%',
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'submitted':
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
      case 'confirmed':
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
                  <button className="btn-primary" style={{ padding: '1rem', borderRadius: '0.75rem', fontWeight: 800 }}>Save Receipt Details</button>
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
      case 'follow_up_due':
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
                    <button className="btn-primary" style={{ padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>save</span>
                      Update Schedule
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
      case 'follow_up_sent':
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
                 <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)' }}>100%</p>
               </div>
               <div style={{ height: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '1rem', overflow: 'hidden' }}>
                 <div style={{ width: '100%', height: '100%', background: 'var(--primary-color)', boxShadow: '0 0 10px var(--primary-color)' }}></div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: '1rem', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                 <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Ready to transition to Interviewing</span>
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
                      <button className="btn-primary" style={{ padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 0 20px rgba(37, 106, 244, 0.2)' }}>
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
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {APPLIED_SUBSTAGES.map((s) => (
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
            {isComplete(s.id) ? (
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981' }}>check_circle</span>
            ) : (
              activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
            )}
          </button>
        ))}
      </div>

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


function InterviewingSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('recruiter_screen');

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'recruiter_screen':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'rgba(37, 106, 244, 0.1)', border: '1px solid rgba(37, 106, 244, 0.2)', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-color)', letterSpacing: '0.1em' }}>Stage 01</span>
                </div>
                <h3 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Recruiter Screen</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Initial alignment call regarding role expectations and cultural fit.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>View Job Post</button>
                <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Add Notes</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Logistics Card */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>Logistics</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <span className="material-symbols-outlined">calendar_today</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Date & Time</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Oct 24, 2023 • 10:30 AM</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <span className="material-symbols-outlined">public</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Timezone</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pacific Standard Time (PT)</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <span className="material-symbols-outlined">videocam</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Zoom Link</p>
                        <a href="#" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>zoom.us/j/9283746551...</a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recruiter Card */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem' }}>Recruiter</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8AucskqWgqdpMcukoPK5V-J4jzIg4UeyApKTiP-CW7Q0atR7N64m0xH69KMX7NNb4oVAbTyOs-bamBsNfOEvHelce0VEncwqoi9dXXUsarrPksKZgetYEbsrZJ2tCGXY2W8ORF1rBzZWnTgN78M685i21upWwJnQeeB3cakLhDtKcowkpaXtspSygzUQBFOE64mEnI8wcIKg2KspaltdVvf29GqMq6QDSZ0aDTr9E6Hx_0U1votYzCOsB4vHuZWJjhqErN8YFVH8" alt="Recruiter" style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Sarah Jenkins</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Lead Tech Recruiter</p>
                    </div>
                  </div>
                  <button style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>link</span>
                    LINKEDIN PROFILE
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Prep Workspace */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Prep Workspace</h4>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Self-Assigned Focus</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {[
                      { icon: 'payments', label: 'Salary Range', value: '$165k - $185k' },
                      { icon: 'event_available', label: 'Availability', value: '2 Weeks Notice' },
                      { icon: 'flag', label: 'Career Goals', value: 'Lead IC Track' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1.25rem', borderRadius: '1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', marginBottom: '0.75rem', display: 'block' }}>{item.icon}</span>
                        <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', margin: 0 }}>{item.label}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Behavioral Questions */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Likely Behavioral Questions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { type: 'Experience', question: '"Tell me about a time you had to pivot your design strategy based on technical limitations."', color: 'var(--primary-color)' },
                      { type: 'Collaboration', question: '"How do you handle disagreements with Product Managers on feature priority?"', color: 'rgba(37, 106, 244, 0.3)' },
                      { type: 'Process', question: '"Explain your handoff process to engineering. How do you ensure visual fidelity?"', color: 'rgba(37, 106, 244, 0.3)' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderLeft: `4px solid ${item.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>{item.type}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>info</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{item.question}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes Area */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Interview Notes</h4>
                  <textarea 
                    placeholder="Start typing your thoughts here..."
                    style={{ width: '100%', minHeight: '120px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1rem', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'hiring_manager':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem' }}>
              {/* Left Column: Interviewer Briefing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                    <div style={{ position: 'relative' }}>
                      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8dHIfcUNEKt_2YJ7GsVOfIsyjkolqheZBX9Df8SfpROsMlQAERCfGJlKBF9svzjevEQVXWpfjpnNrPTFSSyFhs7ol_bdAoTx1pbYG4ZNX_5dq4-NjX41bFAZoONeeIO0S036Z4LxCe2Z6HuKiNUWCFf6UBZNWqyDix2_xPcLVPheY8XEiA6QZoOau9OsewENLiYUyu9Q18e-OsqVG6FGLTPtB2Pv-i2W95xRDcBJo8SWfZQNDwNmVwYpCiu-Sa4ypJd9e0hwnzmI" alt="HM" style={{ width: '6rem', height: '6rem', borderRadius: '1rem', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.2)' }} />
                      <div style={{ position: 'absolute', bottom: '-0.5rem', right: '-0.5rem', background: 'var(--primary-color)', padding: '0.375rem', borderRadius: '0.5rem', border: '2px solid var(--bg-panel)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: 'white', fontVariationSettings: "'FILL' 1" }}>link</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-color)', letterSpacing: '0.1em' }}>Hiring Manager</span>
                        <div style={{ height: '1px', flex: 1, background: 'rgba(37, 106, 244, 0.2)' }}></div>
                      </div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Marcus Thorne</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>VP of Engineering at CloudScale</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Scale-up Expert</span>
                        <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Ex-Google</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '2rem' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1rem' }}>Interviewer Bio</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "Marcus is known for his focus on distributed systems and architectural scalability. He values transparency and engineers who think like product owners. Expect deep-dives into how you handled failure at scale."
                    </p>
                  </div>
                  <div style={{ marginTop: '2rem' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1rem' }}>Focus Areas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {[
                        { icon: 'architecture', title: 'System Architecture', desc: 'He looks for design pattern mastery', color: 'var(--primary-color)' },
                        { icon: 'rocket_launch', title: 'Performance Optimization', desc: 'Latency and throughput trade-offs', color: 'var(--primary-color)' },
                        { icon: 'groups', title: 'Mentorship', desc: 'Growing teams and culture', color: '#f43f5e' }
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                            <span className="material-symbols-outlined">{item.icon}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.title}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: STAR Matcher & Questions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* STAR Story Matcher */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      STAR Story Matcher
                    </h3>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Edit Experiences</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '1.25rem', borderRadius: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>The 2023 Infrastructure Migration</h4>
                        <span style={{ background: 'rgba(37, 106, 244, 0.1)', color: 'var(--primary-color)', padding: '0.125rem 0.5rem', borderRadius: '1rem', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>High Match</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Situation</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Migrating 400 microservices from legacy VM to Kubernetes clusters.</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Impact</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>40% reduction in cloud spend; 99.99% uptime during transition.</p>
                        </div>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}><strong style={{ color: 'var(--primary-color)' }}>Why this works:</strong> Marcus values cost-efficiency and high availability in distributed architectures.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Questions to Ask */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1.5rem' }}>Strategic Questions to Ask</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { question: '"How does CloudScale balance rapid feature deployment with technical debt in your current architecture?"', target: 'Architectural Integrity' },
                      { question: '"What are the biggest bottlenecks currently preventing the team from scaling to 10M concurrent users?"', target: 'Scale & Strategy' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'start' }}>
                        <input type="checkbox" style={{ marginTop: '0.25rem' }} />
                        <div>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{item.question}</p>
                          <p style={{ fontSize: '10px', color: 'var(--primary-color)', fontWeight: 800, textTransform: 'uppercase', marginTop: '0.5rem', margin: 0 }}>Targets: {item.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Debrief Slider */}
            <div className="card glass" style={{ marginTop: '3rem', padding: '2.5rem', borderRadius: '2rem', borderTop: '2px solid rgba(37, 106, 244, 0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
                <div style={{ maxWidth: '400px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Interview Debrief</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Reflect on your performance immediately while the details are fresh. How confident do you feel about the HM's reception?</p>
                </div>
                <div style={{ flex: 1, maxWidth: '500px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Poor Match</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>Exceptional Fit</span>
                  </div>
                  <input type="range" style={{ width: '100%', accentColor: 'var(--primary-color)' }} defaultValue="75" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className="btn-secondary" style={{ fontSize: '10px', padding: '0.5rem 1rem' }}>Save Draft</button>
                      <button className="btn-primary" style={{ fontSize: '10px', padding: '0.5rem 1rem' }}>Submit Rating</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontWeight: 800 }}>
                      <span style={{ fontSize: '1.5rem' }}>75</span>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>/ 100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'technical':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', gap: '2rem' }}>
              {/* Left Column: Technical Briefing */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ height: '1px', width: '2rem', background: 'var(--primary-color)' }}></div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Technical Briefing</span>
                  </div>
                  <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>Scalable Microservices Architecture</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px' }}>
                    Evaluate the candidate's ability to design a resilient distributed system. Focus on event-driven patterns, data consistency, and high-availability trade-offs.
                  </p>
                </div>

                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>analytics</span> Core Requirements
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      'Demonstrate understanding of CAP theorem in relation to current stack.',
                      'Explain CQRS and Event Sourcing implementation challenges.',
                      'Discuss observability strategy (OpenTelemetry, Tracing, Metrics).'
                    ].map((req, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'start', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)', marginTop: '0.125rem' }}>check_circle</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Quick Debrief</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', display: 'block' }}>What went well?</label>
                      <textarea style={{ width: '100%', minHeight: '100px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }} placeholder="Strong grasp of asynchronous processing..." />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', display: 'block' }}>What missed?</label>
                      <textarea style={{ width: '100%', minHeight: '100px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }} placeholder="Struggled with multi-region database latency..." />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Question Bank */}
              <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Live Feed</p>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Question Bank</h2>
                  </div>
                  <button style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { priority: 'High Priority', question: '"How would you handle a sudden 10x spike in traffic for a write-heavy microservice?"', status: 'Q1' },
                    { priority: 'Conceptual', question: '"Describe your approach to implementing distributed transactions across disparate data stores."', status: 'Q2' }
                  ].map((q, i) => (
                    <div key={i} className="card glass" style={{ padding: '1.25rem', borderRadius: '1.25rem', borderLeft: '4px solid var(--primary-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>{q.priority}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.status}</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>{q.question}</p>
                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', minHeight: '80px' }}>
                        Type or speak notes here...
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Pass</button>
                        <button style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Mixed</button>
                        <button style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Fail</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'panel':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Cross-Functional Strategy</h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>You are meeting with the Product, Design, and Engineering leads. Focus on alignment, scalability, and design-system maturity.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
              {/* Left Column: Panel Roster */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interview Panel (3)</h3>
                {[
                  { name: 'Elena Rodriguez', role: 'Head of Design', tags: ['Strategy', 'Culture'], img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBMBPfkHsyixirywUsVr6adRNof4Fr_yUvFgCjYnQjoHyk85I7Tj5C1u7KphCgVxeLdxDlj3lK56w36mfVkfSD7Gn9DL8n44vwrpq90pwrdfjzky_4SplDLoX237uLobe4qMF0xza1Eppf2-JvSnz9DDzREJlukcF-zpGcxiCIdQi-lsy6XmfA8Ii6jisUyEy7nqYMfOt_koGJd284XYvVo3E1K98E3couq1aE5mJkXb3go5acNX1yk4fBj_vLeME7AwNw6GO3eGp8' },
                  { name: 'Marcus Chen', role: 'VP Engineering', tags: ['Infrastructure', 'Feasibility'], img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArh6aIzCOcGc9DDdwS3ajJOxaoKnok-FnUur27Lo7hFanaYufUTRqgqEJwOx2b7T3_hLHZIUU_16CNJ_RXomOLfHhC1NFHaR_eFp75cYHLygyJkIGR1vwpZoZSY9LM9niVCAq9cw9FSSVY5qso9wzjrCEGjgPx2HiIPPTtyb7_XYWvfRcD6V0yfYaMsM_dpPsUkKCUm2sO-sNuKMfeoLUtNmWxfQetykojB6G4Y_vKn6l0qLhChY7Gv-oPJkJjiIxMuvKtn8*jWc' },
                  { name: 'Sarah J. Miller', role: 'Product Director', tags: ['Roadmap', 'Growth'], img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5K4NC_EPaJmMIEiNB1FQVzzWUzJyo1NamYb37tek5muD8UbcOuRxjMl5YYfvEvB5_H43RbxHmWQPGd6-u4f36fkDhT4WN5qtWrWygmPykab1MGrUkNGU9SD56dKV0TNJJzbhYgS7rEpHL-_oEaGi3v9vbYww8eVoD-WC1oG4Faz9fT-D5v7HAKXak3qPIN-MHu0Xw4OkzRpAlIaXW2oG8SROmDqA4wgEECYJ0N5i60UCXyKKetb3L1zIgwbNdtf6JFXDziDjL8tU' }
                ].map((person, i) => (
                  <div key={i} className="card glass" style={{ padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer' }}>
                    <img src={person.img} alt={person.name} style={{ width: '4rem', height: '4rem', borderRadius: '0.75rem', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{person.name}</h4>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', margin: '0.125rem 0 0.5rem 0' }}>{person.role}</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {person.tags.map((tag, j) => (
                          <span key={j} style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '10px' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>open_in_new</span>
                  </div>
                ))}
              </div>

              {/* Right Column: Prep Strategy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cross-Functional Strategy</h3>
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(37, 106, 244, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--primary-color)' }}>
                      <span className="material-symbols-outlined">hub</span>
                    </div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>The Core Narrative</h4>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                    Focus on how your design system experience bridges the gap between Elena's aesthetic vision and Marcus's implementation requirements. You are the "translator" who ensures Sarah's product roadmap can be built efficiently.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>DESIGN OPS</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>EFFICIENCY</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>SCALE</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}>terminal</span>
                      <h5 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>For Marcus (Eng)</h5>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {['Token handoff automation', 'Accessibility constraints', 'Versioning strategy'].map((li, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                          {li}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}>view_quilt</span>
                      <h5 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>For Elena (Design)</h5>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {['Creative freedom vs consistency', 'Brand through motion', 'Mentoring juniors'].map((li, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                          {li}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'final_round':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>ACTIVE STAGE</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated 2h ago</span>
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Final Round sub-stage</h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '700px' }}>The ultimate alignment phase. Review key stakeholder profiles and prepare the cultural narrative before the transition to offer negotiation.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Executive Briefing */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>badge</span>
                      Executive Briefing
                    </h3>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>2 Stakeholders</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { name: 'Elena Vance', role: 'Chief Technology Officer', quote: '"Focus on scalability and how you manage high-stakes architectural shifts."', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC51jsyV1_Ep4chgC7kzFe1U07vzqfZcEU1c_L4qIyRjt2xhN4VUEMWiwkWHVbi0thYeTrGhmG2wxSwFiGViJltV2JUul6feHZZrygciqOOWju9j6rz9tCnEqavNP5XnqAFj92znOnF7tH9jzEO2Fd3GPKNel7F6B7kyq18WKlmKb22gVXpiJFZ_FcVnUf3bzNPj-fPPM5fzaVAPJqjB3R_BW3ApRuGIzIc527Lukiq-zDf83CwtvaCqUU-sC4R1qkqaGTyz71ZEQw' },
                      { name: 'Marcus Thorne', role: 'VP of Product', quote: '"He values cross-functional empathy and user-centric design cycles."', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZLoAYC4ZmLfJjNveWQyPQg1TWJbQy663BFH45h0w6y9-v8AepGUa06qzSAVxsDZhphW3bhRoyM-3yL6Om3VC2oUM9v6t2mhs5nVWLbzwxrx2i7iEfIwWLhGsgivTP-Xc95KkPHKsv3nc1_7OtYJ3ysj1hzFcqd85X0Zcrnui8EeQCKBGbl22x9krBoy5j7uJOtC5UDgT0zrvSi4CjmWZVt8qYp7MWTLSyw81Xgnme8lZF_bgecKOhJLG6WaMiVb3Lzn96dy19IUU' }
                    ].map((person, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img src={person.img} alt={person.name} style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(37, 106, 244, 0.2)' }} />
                          <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{person.name}</h4>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>{person.role}</p>
                          </div>
                          <button style={{ marginLeft: 'auto', background: 'rgba(255, 255, 255, 0.05)', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>chat_bubble</span>
                          </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.75rem', margin: 0 }}>{person.quote}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Final Round Logistics</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.125rem' }}>calendar_today</span>
                        Oct 24, 2023 at 2:00 PM (PT)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.125rem' }}>video_call</span>
                        Virtual Boardroom A (Link in Calendar)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.125rem' }}>timer</span>
                        90 Minutes Duration
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Final Polish */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: '#f43f5e' }}>auto_awesome</span>
                    Final Polish
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'block' }}>Culture Fit Strategy</label>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        Emphasize the 'Glass Culture'—transparency in feedback and radical ownership. Prepare stories about times you took responsibility for a project pivot.
                      </p>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'block' }}>Vision Alignment</label>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        The company is moving toward AI-driven curation. Relate your experience in automation and algorithmic thinking to their 2024 roadmap.
                      </p>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Ready to Move to Offer?</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {['Stakeholder prep complete', 'Cultural narratives defined', 'Compensation range verified', 'Portfolio links updated'].map((check, i) => (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                            <input type="checkbox" defaultChecked={i < 2} />
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{check}</span>
                          </label>
                        ))}
                      </div>
                      <button className="btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '1rem', fontWeight: 800, marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        Request Offer Draft
                        <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Interview Pipeline</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {INTERVIEWING_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function DecisionSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('awaiting_decision');

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'awaiting_decision':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <h3 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Decision Phase</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Post-interview review and outcome estimation for {app?.company || 'Target Company'}.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Archive</button>
                <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Update Status</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Decision Tracker Card */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Decision Tracker</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>Time Elapsed</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'rgba(37, 106, 244, 0.4)' }}>timer</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>04</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days</p>
                    </div>
                    <div style={{ width: '1px', height: '3rem', background: 'var(--border-color)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>18</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Hours</p>
                    </div>
                    <div style={{ width: '1px', height: '3rem', background: 'var(--border-color)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>32</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Minutes</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '1.5rem', margin: 0 }}>Average decision time for this role: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>7-10 Days</span></p>
                </div>

                {/* Recruiter Signals Log */}
                <div className="card glass" style={{ borderRadius: '1.25rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Recruiter Signals</h4>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>Live Log</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {[
                      { signal: 'Recruiter viewed your LinkedIn profile', time: '2 hours ago', color: '#22c55e' },
                      { signal: 'Internal system update: Interview stages complete', time: 'Yesterday, 4:45 PM', color: '#3b82f6' },
                      { signal: 'Final Round Feedback requested by HR', time: '3 days ago', color: 'var(--text-muted)' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1.25rem', borderBottom: i === 2 ? 'none' : '1px solid var(--border-color)', display: 'flex', gap: '1rem', transition: 'background 0.2s' }}>
                        <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: item.color, marginTop: '0.375rem', boxShadow: item.color !== 'var(--text-muted)' ? `0 0 8px ${item.color}` : 'none' }}></div>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{item.signal}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Sentiment */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', margin: 0 }}>User Sentiment</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.5rem', borderRadius: '1rem', textTransform: 'uppercase' }}>Confident</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)' }}>82% Positive</span>
                  </div>
                  <div style={{ height: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '1rem' }}>
                    <div style={{ height: '100%', background: 'var(--primary-color)', width: '82%', boxShadow: '0 0 15px rgba(37, 106, 244, 0.3)' }}></div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>"I felt really aligned with the team's culture during the systems design round. The technical challenge went smoothly."</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Outcome Predictor */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(37, 106, 244, 0.2)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(37, 106, 244, 0.03)', pointerEvents: 'none' }}></div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '1.5rem' }}>Outcome Predictor</span>
                  
                  <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 1.5rem' }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="8" />
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="var(--primary-color)" strokeWidth="8" strokeDasharray="440" strokeDashoffset="110" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>75%</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Likely</span>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', margin: 0 }}>High Likelihood</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, padding: '0 1rem' }}>AI analysis of recruiter responsiveness and interview feedback indicates a strong chance of an offer.</p>
                </div>

                {/* Follow-up Assistant */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>auto_awesome</span>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Follow-up Assistant</h4>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', margin: 0 }}>Recommendation</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>Wait until Friday morning before following up. The hiring manager is currently out of office.</p>
                    <button style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Draft Follow-up Email</button>
                  </div>
                </div>

                {/* Negotiation Prep */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '4rem', color: 'var(--primary-color)', opacity: 0.1 }}>payments</span>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', margin: 0 }}>Negotiation Prep</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', margin: 0 }}>Unlock salary benchmarks and equity analysis for this specific role and location.</p>
                  <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', textDecoration: 'none' }}>
                    View Strategy Guide
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      case 'references':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <nav style={{ display: 'flex', gap: '0.5rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  <span>Applications</span>
                  <span>/</span>
                  <span>{app?.company || 'Target'}</span>
                  <span>/</span>
                  <span style={{ color: 'var(--primary-color)' }}>References</span>
                </nav>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Reference Verification</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Export Report</button>
                <button className="btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Request New</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Reference List */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Reference List</h4>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '1rem', textTransform: 'uppercase' }}>3 Total</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { name: 'Sarah Jenkins', role: 'VP of Engineering', status: 'Verified', color: '#10b981', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCffXGA6bg355oZ71ON7Zyfj1rMwdkiuGwk8-7LHN2rm4-_WAwKb3d9-COo0KLPwOW_riA1CE_zmJJDGSzmfZ0YpJrwmwC7cNRX9l9Jf_p0fgWJlmH2a3jm1smnSolBbr-66y0lRQLdw_SFq7e2M_jveX-1ddZKWC0GwqhycWZdD6rLHf2HtsW8eVQabaOpNMvgyzueGALMpYENKVBINWggi9I1LQvcdJ7ePOgQCorI8V3MTMOIFkULW3hshILBruUyUmy6Wnd20CA' },
                      { name: 'Marcus Thorne', role: 'Former CTO', status: 'Contacted', color: 'var(--primary-color)', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCE-qpeSfly-9loVuisY8oLtcyDKIlEGAxOWC_iHejv041TeZurPakY7ixuAU_Fc9f5uTQh1zSgoXrYNAuBu7GgRnrz88zKdlW_URBSysjVCxn06r6WL0il_eiecrVdR9XY0VBdmKm6YiSBfPDbIq3e-pMOzH-2yp0Kjkh6AqAHVhuKYS_P5EipvxQOUGATHjtzdsXLeOrJBQ56bBBTmxEnD2qYAefKu7_73W0b7gcRLYZbYMsqKFKdlXMAGxPKC34f3uWucdQgMYE', active: true },
                      { name: 'David Chen', role: 'Senior Director', status: 'Pending', color: 'var(--text-muted)', img: null }
                    ].map((ref, i) => (
                      <div key={i} style={{ padding: '1rem', borderRadius: '1rem', background: ref.active ? 'rgba(37, 106, 244, 0.05)' : 'rgba(255, 255, 255, 0.02)', border: ref.active ? '1px solid rgba(37, 106, 244, 0.3)' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                        {ref.img ? (
                          <img src={ref.img} alt={ref.name} style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <span className="material-symbols-outlined">person</span>
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{ref.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{ref.role}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: ref.color, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>{ref.status}</span>
                          <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                            <div style={{ width: '12px', height: '4px', borderRadius: '2px', background: ref.status === 'Pending' ? 'var(--text-muted)' : 'var(--primary-color)' }}></div>
                            <div style={{ width: '12px', height: '4px', borderRadius: '2px', background: ref.status === 'Verified' ? '#10b981' : ref.status === 'Contacted' ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)' }}></div>
                            <div style={{ width: '12px', height: '4px', borderRadius: '2px', background: ref.status === 'Verified' ? '#10b981' : 'rgba(255, 255, 255, 0.1)' }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistics Card */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>schedule</span>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Logistics</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: 'rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <span className="material-symbols-outlined">mail</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Contact Initiated</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.125rem 0' }}>Oct 24, 2023 · 09:15 AM</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>By recruitment team assistant</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <span className="material-symbols-outlined">verified</span>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Last Verification</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.125rem 0' }}>Today · 11:42 AM</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Automated AI sync successful</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Detailed Briefing */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '2rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-6rem', right: '-6rem', width: '16rem', height: '16rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1rem', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>AI-Generated Analysis</span>
                        </div>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Reference Briefing: Marcus Thorne</h4>
                      </div>
                      <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div>
                        <h5 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', margin: 0 }}>Professional Sentiment</h5>
                        <div style={{ padding: '1.5rem', borderRadius: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          "Marcus provided an exceptionally high rating for technical leadership. He specifically noted the candidate's ability to 'architect scalable systems under extreme pressure.' There was a notable emphasis on emotional intelligence and team mentorship during the rapid growth phase at TechFlow."
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ padding: '1.25rem', borderRadius: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>Core Strengths</span>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {['System Architecture', 'Crisis Management', 'Cross-team Collab'].map((s, i) => (
                              <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ padding: '1.25rem', borderRadius: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>Growth Areas</span>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {['Delegation speed', 'Budget detailing'].map((s, i) => (
                              <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></div>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <h5 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', margin: 0 }}>Verification Transcript (Key Highlights)</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>mic</span>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>"When I think about the Series B crunch, their contributions were the only reason our infrastructure didn't melt. They possess a rare level of calm."</p>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>mic</span>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>"Would I hire them again? In a heartbeat. They were the cultural glue of the engineering organization."</p>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', marginLeft: '0.5rem' }}>
                            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRjNBVv77ooxunOHyE78ZAZtaf9LLT0icS4SM_whMEPm8NnleC3ueuls9-t0XltMUToeCH9rp60NETkBRUiLcbp1O5p3VlwdeWY3J_4yD_as8wxI1erhYeNTei6RgPwqCeUjZyRAt5L6olPlt2pY2s3F7EsegyPkzYfSagq3RqOm_Q431eG4u-TTz5Qw-nOnaABFU9wvObTgzivTEiPUJsYPvWuzIcOpgJwx6cI9UpEIWEg9FSteqdyLMJ1vO7X0v2962BIY2JS0o" style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '2px solid var(--bg-panel)' }} />
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', border: '2px solid var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)', marginLeft: '-0.75rem' }}>+2</div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contacted by Alex R. and 2 others</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Final Verification: 2 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'verbal_offer':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Offer Summary */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '8rem', height: '8rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '50%', filter: 'blur(40px)', marginTop: '-4rem', marginRight: '-4rem' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Verbal Offer Summary</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>Received via call on Oct 24, 2023</p>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', border: '1px solid rgba(37, 106, 244, 0.2)', padding: '0.25rem 0.75rem', borderRadius: '1rem', textTransform: 'uppercase' }}>Active Negotiation</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {[
                      { label: 'Base Salary', value: '$185,000', detail: '+8% from initial range', detailColor: 'var(--primary-color)' },
                      { label: 'Equity', value: '20,000 Units', detail: '4-year vest, 1-year cliff', detailColor: 'var(--text-muted)' },
                      { label: 'Annual Bonus', value: '15% Target', detail: 'Performance-based', detailColor: 'var(--text-muted)' },
                      { label: 'Start Date', value: 'Nov 15, 2023', detail: 'Negotiation requested: Dec 1', detailColor: '#f43f5e' }
                    ].map((item, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>{item.label}</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.value}</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: item.detailColor, marginTop: '0.25rem', margin: 0 }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recruiter Notes */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>sticky_note_2</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Recruiter Notes</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>"Sarah mentioned the team was specifically impressed with the system design presentation. There is some flexibility on the sign-on bonus if we can commit by end of week."</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.75rem', margin: 0 }}>Logged 2 hours ago</p>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '1rem', borderLeft: '4px solid var(--text-muted)' }}>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Discussed relocation support. They use a standard lump-sum package of $10k but could increase to $15k for the right candidate.</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.75rem', margin: 0 }}>Logged yesterday</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Negotiation Strategy */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(37, 106, 244, 0.2)', boxShadow: '0 0 20px rgba(37, 106, 244, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>psychology</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Negotiation Strategy</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', margin: 0 }}>Value Propositions</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[
                          'Exceeded revenue targets by 40% at previous role.',
                          'Direct experience with their current tech stack (Rust/Go).'
                        ].map((li, i) => (
                          <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>check_circle</span>
                            {li}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                    <div>
                      <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', margin: 0 }}>Counter-Offer Talking Points</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(244, 63, 94, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(244, 63, 94, 0.1)' }}>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>"I am thrilled about the role, however, based on market data for this seniority..."</p>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>"Given the immediate impact I plan to make on the Q1 roadmap..."</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offer Readiness Checklist */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>fact_check</span>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Readiness</h3>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary-color)' }}>75%</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { label: 'Review benefit enrollment guide', checked: true },
                      { label: 'Confirm 401k match details', checked: true },
                      { label: 'Clarify PTO accrual policy', checked: false },
                      { label: 'Draft counter-offer email', checked: true }
                    ].map((item, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                        <div style={{ 
                          width: '1.25rem', height: '1.25rem', borderRadius: '4px', border: item.checked ? 'none' : '1px solid var(--border-color)',
                          background: item.checked ? 'var(--primary-color)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}>
                          {item.checked && <span className="material-symbols-outlined" style={{ fontSize: '1rem', fontWeight: 800 }}>check</span>}
                        </div>
                        <span style={{ fontSize: '0.875rem', color: item.checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ width: '100%', marginTop: '2rem', padding: '1rem', borderRadius: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Request Written Offer
                    <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'written_offer_pending':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Pending Document Tracker */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>description</span>
                      Pending Document Tracker
                    </h3>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', border: '1px solid rgba(37, 106, 244, 0.2)', padding: '0.25rem 0.75rem', borderRadius: '1rem', textTransform: 'uppercase' }}>Awaiting Legal</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                          <span className="material-symbols-outlined">gavel</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Executive Compensation Clause</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Under Legal Review • Est. 48h</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>Reviewing</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                          <span className="material-symbols-outlined">person_check</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>HR Benefits Package</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>HR Approval Complete</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>Approved</span>
                    </div>
                  </div>
                </div>

                {/* Compensation Modeling */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', margin: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>calculate</span>
                    Compensation Modeling
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                      { label: 'Base Salary', value: '$210,000' },
                      { label: 'Equity (RSUs)', value: '$450,000' },
                      { label: 'Bonus Target', value: '15%' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1rem', borderRadius: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', margin: 0 }}>{item.label}</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'relative', height: '120px', width: '100%', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-end', padding: '1rem', gap: '0.5rem' }}>
                    {[0.4, 0.65, 0.55, 0.9, 0.5].map((h, i) => (
                      <div key={i} style={{ flex: 1, background: 'rgba(37, 106, 244, 0.2)', height: `${h*100}%`, borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'all 0.2s' }}></div>
                    ))}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>4-Year Projection Map</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Current Target: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>$845k Total Comp Value</span></p>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Adjust Model Variables</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Timeline & Logistics */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '4rem', color: 'var(--text-muted)', opacity: 0.1 }}>event_repeat</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2rem', margin: 0 }}>Timeline & Logistics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {[
                      { label: 'Estimated Arrival', value: 'Thursday, Oct 24th', detail: 'Confirmed by Talent Partner via Verbal', color: 'var(--primary-color)', active: true },
                      { label: 'Target Start Date', value: 'Monday, Nov 18th', detail: 'Dependent on 2-week notice period', color: 'var(--text-muted)' },
                      { label: 'Onboarding Location', value: 'Stripe HQ, San Francisco', detail: 'Travel arrangements pending offer', color: 'var(--text-muted)' }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: item.color, boxShadow: item.active ? `0 0 8px ${item.color}` : 'none' }}></div>
                          {i < 2 && <div style={{ flex: 1, width: '2px', background: 'rgba(255, 255, 255, 0.05)', marginTop: '0.25rem' }}></div>}
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', fontWeight: 800, color: item.active ? 'var(--primary-color)' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', margin: 0 }}>{item.label}</p>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.value}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Negotiation Packet Preview */}
                <div className="card glass" style={{ borderRadius: '1.5rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '2rem 2rem 1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Negotiation Packet</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>Last updated today at 09:12 AM</p>
                  </div>
                  <div style={{ position: 'relative', height: '180px', background: 'rgba(0, 0, 0, 0.4)', margin: '0 2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-a-eUBPfbWaUQrMLDfiAv3-ZG6tAazep_InolMKWBoUCYzng9MQBWdQ1BstFcjDq_vNJZnJc6RMhH-b4Gia_cHEi9wWIUDtFjI4wMtpAmRO2yj68WWzEq1OA1V0b4dUmD3LDhruV8Kb4UmHS1Lg12bUoSc-U3OX1qn_-hfrg9y2ATpxNxmbFsThZnKj9erCQoWyk9KZR3PqnbWTU8UW658UVSaHD7mWCiOo6aGJveFKj-4haeuPOJxV07A3bc6lG6j8SL_LaXm18" alt="Packet Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16, 22, 34, 1), transparent)' }}></div>
                    <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '2px', textTransform: 'uppercase' }}>Research.pdf</span>
                        <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '2px', textTransform: 'uppercase' }}>Market_Data</span>
                      </div>
                      <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '1rem' }}>open_in_new</span>
                    </div>
                  </div>
                  <div style={{ padding: '2rem', display: 'flex', gap: '1rem' }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>edit</span>
                      Finalize Packet
                    </button>
                    <button style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <span className="material-symbols-outlined">share</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'likely_reject':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Decision Phase</span>
                <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>chevron_right</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Likely Reject</span>
              </div>
              <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Likely Reject Analysis</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '700px' }}>Visualizing subtle rejection signals and preparing strategic pivots for the next career move.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Risk Assessment */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', opacity: 0.1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: '#f43f5e', fontVariationSettings: "'FILL' 1" }}>warning</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                      <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Risk Assessment</h4>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Rejection Signals Identified</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { icon: 'timer_off', title: 'Stale Response', desc: 'Last contact was 8 business days ago. Mean response time for this recruiter is typically 48 hours.', color: '#f43f5e' },
                      { icon: 'monetization_on', title: 'Budget Freeze Notes', desc: 'LinkedIn Intelligence suggests 15% workforce reduction in the Product vertical last week.', color: '#fb7185' },
                      { icon: 'person_search', title: 'Job Relisting', desc: 'The position was refreshed on company portal 24 hours ago, suggesting active search continuation.', color: 'var(--text-muted)' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                        <div style={{ color: item.color }}>
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div>
                          <h5 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.title}</h5>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recruiter Sentiment */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Recruiter Sentiment</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Negative Trend</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div style={{ width: '6px', height: '16px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}></div>
                        <div style={{ width: '6px', height: '16px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}></div>
                        <div style={{ width: '6px', height: '16px', background: '#f43f5e', borderRadius: '4px' }}></div>
                        <div style={{ width: '6px', height: '16px', background: '#f43f5e', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>42%</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Match Confidence</p>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e', margin: 0 }}>High</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Silence Risk</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>N/A</p>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Referral Boost</p>
                    </div>
                  </div>
                  <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.1)', borderRadius: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    "Recruiter sounded distracted during the final touchpoint; mentioned internal restructuring but stayed vague about timeline."
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Contingency Plan */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.4))' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', margin: 0 }}>Contingency Plan</h3>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', margin: 0 }}>Alternative Roles</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {[
                        'Staff UX Architect — FinTech Core',
                        'Creative Lead — Quantum Studio'
                      ].map((role, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{role}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>arrow_forward</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', margin: 0 }}>Networking Follow-up Wording</p>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative' }}>
                      <button style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>content_copy</span>
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, paddingRight: '1rem' }}>
                        "Thank you for the update. While I'm disappointed, I've truly enjoyed our conversations. If internal priorities shift or a similar role opens in the [Vertical Name] team, I'd love to be reconsidered."
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pivot Strategy */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', borderLeft: '4px solid var(--primary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pivot Strategy</h3>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>AI READY</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', margin: 0 }}>Signals suggest a focus on <strong style={{ color: 'var(--text-primary)' }}>B2B Infrastructure</strong> which wasn't fully highlighted in your portfolio.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(0, 0, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--primary-color)' }}>psychology</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--primary-color)', width: '75%' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Skills Gap: Systems Design</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-color)' }}>75% DEPTH</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)' }}>lightbulb</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add 2 case studies focusing on scale and latency to your deck.</span>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 800 }}>Generate Personalized Pivot Deck</button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Decision Pipeline</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {DECISION_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function AcceptedSubStagePanel({ app, onRefresh, onStageChange, initialSubStage = 'offer_received' }) {
  const [activeSubStage, setActiveSubStage] = useState(initialSubStage);

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'offer_received':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Offer Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Received recently</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Offer Received</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Review the formal terms from <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span>.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Log Negotiation</button>
                <button onClick={() => setActiveSubStage('offer_reviewed')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Complete Review</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Offer Letter Preview */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Formal Offer Document</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Official letter with finalized terms.</p>
                    </div>
                    <button className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem' }}>Upload New</button>
                  </div>
                  <div style={{ width: '100%', height: '240px', borderRadius: '1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
                       <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjKrL7_8FOPkallzfky9Ki9c9VxeWM7aIofF1S7HuPE6xgS04jGu-z9P5CJk8nMT55bMOqJBR4E15M27uTbZNxNyCEQkt8XqJQWXFXKvJw7pU14oUuOixNc979_mwtYYuLbGyZrgWClkK3jmQW0VhBgxVz3BLHio6ymv-GXOKUBie-t60gfIuCh6Azek1aPIOnMYVunl7eRJmdp_Zbf87DBvfEkAD95mYH4Xg585TLsllqn7MIKnOXT5YyRv6C5DBrq-CTq6S81K4" alt="Offer PDF" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--primary-color)', marginBottom: '1rem', position: 'relative' }}>picture_as_pdf</span>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', position: 'relative' }}>Offer_Letter_{app?.company || 'Nexus'}.pdf</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', position: 'relative' }}>2.4 MB • AI Analyzed</p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', position: 'relative' }}>
                      <button className="btn-secondary" style={{ padding: '0.4rem 1rem', borderRadius: '2rem', fontSize: '0.75rem' }}>View Fullscreen</button>
                      <button className="btn-secondary" style={{ padding: '0.4rem 1rem', borderRadius: '2rem', fontSize: '0.75rem' }}>Download</button>
                    </div>
                  </div>
                </div>

                {/* Compensation Package */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Base Compensation Package</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    {[
                      { label: 'Base Salary', value: '$185,000', detail: '+12% vs Target', color: 'var(--primary-color)' },
                      { label: 'Equity (RSUs)', value: '$240,000', detail: '4-year vesting', color: 'var(--text-muted)' },
                      { label: 'Sign-on Bonus', value: '$25,000', detail: 'One-time payment', color: 'var(--text-muted)' }
                    ].map((item, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>{item.label}</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.value}</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: item.color, marginTop: '0.25rem', margin: 0 }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                    <div>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Health & Wellness</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)' }}>check_circle</span> 100% Medical/Dental/Vision</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)' }}>check_circle</span> $2,500 Annual Wellness Stipend</div>
                      </div>
                    </div>
                    <div>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Work Environment</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)' }}>check_circle</span> Fully Remote (Hybrid Optional)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: 'var(--primary-color)' }}>check_circle</span> $1,000 Home Office Budget</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Quick Review Checklist */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Quick Review</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { title: 'Start Date Confirmed', desc: 'Proposed: Oct 14, 2024' },
                      { title: 'Vesting Schedule Verified', desc: '1-year cliff, 4-year total', checked: true },
                      { title: 'Non-Compete Clause Review', desc: 'Check Section 8.4' },
                      { title: 'Notice Period Requirement', desc: 'Check for 30-day exit clauses' }
                    ].map((item, i) => (
                      <label key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={item.checked} style={{ marginTop: '0.25rem' }} readOnly />
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.title}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Compare Offer Card */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(37, 106, 244, 0.05), transparent)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Compare Offer</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>See how this package stacks up against market data.</p>
                  <button className="btn-secondary" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>compare_arrows</span> Compare with Market
                  </button>
                  <button className="btn-secondary" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>history</span> View Version History
                  </button>
                </div>

                {/* Call to Action */}
                <div style={{ padding: '2rem', borderRadius: '1.5rem', background: 'rgba(37, 106, 244, 0.05)', border: '1px solid rgba(37, 106, 244, 0.2)', textAlign: 'center' }}>
                   <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary-color)', marginBottom: '1rem', fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                   <h5 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Ready to move forward?</h5>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Completing this review unlocks the "Offer Reviewed" stage.</p>
                   <button onClick={() => setActiveSubStage('offer_reviewed')} className="btn-primary" style={{ width: '100%', padding: '0.75rem', borderRadius: '2rem', fontWeight: 800 }}>Complete Review</button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'offer_reviewed':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', tracking: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Accepted Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Offer Reviewed</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Offer Review</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Audit the finalized terms before proceeding to signature.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Log Negotiation</button>
                <button onClick={() => setActiveSubStage('formal_acceptance')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Accept & Move Forward</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Terms Summary */}
                <div className="card glass" style={{ borderRadius: '1.5rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Terms Summary</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>REF: {app?.company?.toUpperCase()}-2024-OFFR</span>
                  </div>
                  <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {[
                      { label: 'Title', value: app?.job_title || 'Senior Product Designer' },
                      { label: 'Level', value: 'L5 (Senior II)' },
                      { label: 'Salary', value: '$185,000 / yr', color: 'var(--primary-color)' },
                      { label: 'Bonus', value: '15% Target' },
                      { label: 'Equity', value: '4,500 RSU / 4yr' },
                      { label: 'Work Model', value: 'Hybrid (3 days/wk)' },
                      { label: 'Start Date', value: 'October 14, 2024', fullWidth: true }
                    ].map((item, i) => (
                      <div key={i} style={{ gridColumn: item.fullWidth ? 'span 2' : 'auto' }}>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{item.label}</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: 800, color: item.color || 'var(--text-primary)', margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                    <div style={{ gridColumn: 'span 2' }}>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Benefits Package</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {['Premium Health (PPO)', '4% 401k Match', 'Unlimited PTO', '$2k Learning Stipend'].map((b, i) => (
                          <span key={i} style={{ padding: '0.25rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offer Document Bar */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: 'rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', border: '1px solid rgba(37, 106, 244, 0.2)' }}>
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Full Offer Document.pdf</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Last updated today at 09:42 AM</p>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ padding: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>download</span></button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Verification Checklist */}
                <div className="card glass" style={{ borderRadius: '1.5rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Verification</h4>
                  </div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Verify each term matches your expectations.</p>
                    {[
                      { title: 'Compensation', desc: 'Salary & Bonus targets' },
                      { title: 'Equity & Vesting', desc: 'RSU count & Schedule' },
                      { title: 'Logistics', desc: 'Start date & Hybrid policy' },
                      { title: 'Benefits Audit', desc: 'Healthcare & Perks' }
                    ].map((item, i) => (
                      <label key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ marginTop: '0.25rem' }} />
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.title}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ padding: '1.25rem', background: 'rgba(16, 22, 34, 0.4)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Missing something? Use Log Negotiation.</p>
                  </div>
                </div>

                {/* Negotiation Log Teaser */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                   <span className="material-symbols-outlined" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '4rem', color: 'var(--primary-color)', opacity: 0.05 }}>history_edu</span>
                   <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Negotiation Log</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ width: '2px', background: 'var(--primary-color)', borderRadius: '1rem' }}></div>
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>Counter-offer Sent</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>3 days ago • +$5k Equity</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ width: '2px', background: '#10b981', borderRadius: '1rem' }}></div>
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', margin: 0 }}>Employer Approved</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Yesterday • Term Finalized</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'formal_acceptance':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', tracking: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Accepted Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Success</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Formal Acceptance</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Congratulations! Sign the documents to finalize your new role at <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span>.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Download Copy</button>
                <button onClick={() => setActiveSubStage('pre_onboarding')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Sign & Confirm</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Signature Card */}
                <div className="card glass" style={{ padding: '3rem', borderRadius: '2rem', border: '1px solid var(--border-color)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHXjTfTIn2_09rYy6U-3M6Uo_rXm1-e1j7y5M8S9G8W7k-y-Y8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8uY8u" alt="Celebration" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '5rem', color: 'var(--primary-color)', marginBottom: '1.5rem', fontVariationSettings: "'FILL' 1" }}>draw</span>
                  <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>E-Signature Required</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '400px', marginInline: 'auto' }}>A secure signature request has been sent to your email. You can also sign directly within the platform.</p>
                  
                  <div style={{ padding: '2rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)', borderRadius: '1.5rem', marginBottom: '2rem' }}>
                    <p style={{ fontSize: '1.5rem', fontFamily: 'cursive', color: 'var(--text-primary)', margin: 0, opacity: 0.5 }}>Your Name Here</p>
                    <div style={{ height: '1px', background: 'var(--border-color)', width: '200px', margin: '0.5rem auto' }}></div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Candidate Signature</p>
                  </div>

                  <button className="btn-primary" style={{ padding: '1rem 3rem', borderRadius: '3rem', fontWeight: 800, fontSize: '1rem', boxShadow: '0 10px 30px rgba(37, 106, 244, 0.3)' }}>Sign Document Now</button>
                </div>

                {/* Celebration Element */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent)', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>celebration</span>
                  </div>
                  <div>
                    <h5 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white', margin: 0 }}>You're joining Nexus Dynamics!</h5>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0 }}>Your profile will automatically transition to "Hired" status once signed.</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Next Steps Checklist */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Next Steps</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {[
                      { label: 'Finalize notice period with current employer', icon: 'work_history' },
                      { label: 'Review onboarding materials', icon: 'auto_stories' },
                      { label: 'Setup your new home office', icon: 'desk' }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Preview */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Your New Team</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { name: 'Sarah Jenkins', role: 'Staff Product Designer', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCffXGA6bg355oZ71ON7Zyfj1rMwdkiuGwk8-7LHN2rm4-_WAwKb3d9-COo0KLPwOW_riA1CE_zmJJDGSzmfZ0YpJrwmwC7cNRX9l9Jf_p0fgWJlmH2a3jm1smnSolBbr-66y0lRQLdw_SFq7e2M_jveX-1ddZKWC0GwqhycWZdD6rLHf2HtsW8eVQabaOpNMvgyzueGALMpYENKVBINWggi9I1LQvcdJ7ePOgQCorI8V3MTMOIFkULW3hshILBruUyUmy6Wnd20CA' },
                      { name: 'David Chen', role: 'VP of Engineering', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCE-qpeSfly-9loVuisY8oLtcyDKIlEGAxOWC_iHejv041TeZurPakY7ixuAU_Fc9f5uTQh1zSgoXrYNAuBu7GgRnrz88zKdlW_URBSysjVCxn06r6WL0il_eiecrVdR9XY0VBdmKm6YiSBfPDbIq3e-pMOzH-2yp0Kjkh6AqAHVhuKYS_P5EipvxQOUGATHjtzdsXLeOrJBQ56bBBTmxEnD2qYAefKu7_73W0b7gcRLYZbYMsqKFKdlXMAGxPKC34f3uWucdQgMYE' }
                    ].map((person, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={person.img} alt={person.name} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{person.name}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{person.role}</p>
                        </div>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.75rem' }}>Meet the full team</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'close_pipelines':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', tracking: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Accepted Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Off-boarding</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Close Pipelines</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Gracefully withdraw from other active applications.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setActiveSubStage('pre_onboarding')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Finish Off-boarding</button>
              </div>
            </div>

            <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Active Pipelines</h4>
                <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>Withdraw All</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { company: 'Stripe', role: 'Product Designer', stage: 'Interviewing', status: 'Active' },
                  { company: 'Vercel', role: 'Staff Design Engineer', stage: 'Decision', status: 'Active' },
                  { company: 'Figma', role: 'Senior Product Designer', stage: 'Applied', status: 'Active' }
                ].map((pip, i) => (
                  <div key={i} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                       <div style={{ width: '2.5rem', height: '2.5rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800, opacity: 0.5 }}>{pip.company.charAt(0)}</div>
                       <div>
                         <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{pip.company}</p>
                         <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{pip.role} • {pip.stage}</p>
                       </div>
                    </div>
                    <button className="btn-secondary" style={{ color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', fontSize: '0.75rem', padding: '0.4rem 1rem' }}>Withdraw</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(37, 106, 244, 0.05)', borderRadius: '1rem', border: '1px solid rgba(37, 106, 244, 0.1)' }}>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.5rem' }}>AI Withdrawal Assistant</h5>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>We've prepared personalized withdrawal messages for each recruiter that maintain your professional network.</p>
                <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Draft Withdrawal Emails</button>
              </div>
            </div>
          </div>
        );
      case 'pre_onboarding':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', tracking: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Accepted Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Preparation</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Pre-onboarding</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Get ready for your first day at <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span>.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => onStageChange('archived')} className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Move to Hired</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Onboarding Checklist */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Onboarding Checklist</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { title: 'Background Check', desc: 'Verified on Oct 24, 2023', done: true },
                      { title: 'Paperwork', desc: 'Employee agreement and NDA signatures' },
                      { title: 'Tax Setup', desc: 'W-4 and banking information' },
                      { title: 'Equipment', desc: 'Select your hardware preference', locked: true }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', background: item.done ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)', opacity: item.locked ? 0.5 : 1 }}>
                        <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '6px', border: `2px solid ${item.done ? '#10b981' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                          {item.done && <span className="material-symbols-outlined" style={{ fontSize: '1rem', fontWeight: 900 }}>check</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.title}</h5>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{item.desc}</p>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: item.done ? '#10b981' : 'var(--text-muted)', textTransform: 'uppercase' }}>{item.done ? 'Done' : (item.locked ? 'Locked' : 'Required')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Culture Banner */}
                <div style={{ position: 'relative', borderRadius: '1.5rem', height: '200px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmkpZZfdtN5m78mHg_OQxK1t6qKYT8_AkRb-zHJVx-QAiJFTCBODr79OgGdq3RmdXmNDR8mdKrxzzd32zhMRnJN7fz35Ocyfwuvjdr_1Fd_Y2I7wNdxn2U2Tn9uIWYojd5QgeJOoTaCz4pC6EFSWCe3OCiwVc7xcuXmM1UW8dhFaBJe90Ebj4n-nlB0r52X5QRJ7FRiw6vQEIB4XDBkj_j8RNfI5v_SIz7W88qRYn1_UW0IEb_UiAalp727nztw8GmZcJleB7n95A" alt="Culture" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16, 22, 34, 0.9), transparent)' }}></div>
                  <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', margin: 0 }}>Company Culture Guide</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Learn about the mission you're joining.</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Countdown Card */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-2rem', right: '-2rem', width: '6rem', height: '6rem', background: 'rgba(37, 106, 244, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1.5rem' }}>Day 1 Countdown</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>12</span>
                    <div style={{ width: '1px', height: '2.5rem', background: 'var(--border-color)' }}></div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>DAYS</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Remaining</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Start Date: Nov 15, 2023</p>
                </div>

                {/* Important Contacts */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Important Contacts</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {[
                      { name: 'Sarah Jenkins', role: 'HR Coordinator', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5FOgXRBtLqRpEqNbBGkNRANn-kM4Jkf870O4UhaDUxBmowbdozXQYalZHh6M0KwzXa5MX5QeG4rs2kEnE7Vtbg1wyIz5qAyZ6gv7kqKEcyz_8YR7CG4dcpq5VHngYrGUK5rr3WCA2V48buTI2Bt0vHDVQZReLKJ4BVT90DPWGirEOa7aFdfG3HySeTRcmGt_8xVxal7FkFeSvzgQUBLb1QxNMl3zoAfsfTmXUIV2GZXLBrdwqDbQ6-C7496JPACraCLZayXqJHUg', action: 'mail' },
                      { name: 'David Chen', role: 'Product Manager', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDroyASGyLS7e62jNSbfDxb3sI9ZNWhgo6sHU8hrSSCNVoJJUrGGnI8EQF1tgFBBvUC7cHi0jx8GFoAbgikMdddWTRJz1dnG3m4j-2T6UYA-iJ2AlxC53MFXnXvjsvEbF-iPT3XSUftR3mZpPIggr7EArkXyGPr1CFRpIdL9_nRclgnSwNmBtmCw9m341wc3QyQeoMZy2Iuhn6-8-gsdIjfY-VjSnIduCXECk9QbTyn8JcQsvIoOFIFtbt8CehNCElFQsudDAG4kGY', action: 'chat_bubble' }
                    ].map((person, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={person.img} alt={person.name} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{person.name}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{person.role}</p>
                        </div>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{person.action}</span>
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.75rem' }}>View Full Team</button>
                  </div>
                </div>

                {/* Pro-tip */}
                <div style={{ padding: '1.5rem', borderRadius: '1.5rem', background: 'rgba(37, 106, 244, 0.05)', border: '1px solid rgba(37, 106, 244, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>info</span>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>Pro-tip</h5>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>Complete your Tax Setup by Friday to ensure your first paycheck is processed on time.</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Accepted Journey</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {ACCEPTED_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function RejectedSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('rejection_received');

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
    color: activeSubStage === id ? '#f43f5e' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'rejection_received':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>Rejected Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Update</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Rejection Received</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>The application thread with <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span> has been closed.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Log Feedback</button>
                <button onClick={() => setActiveSubStage('rejection_classified')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700, background: '#f43f5e' }}>Classify Rejection</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Rejection Analysis Card */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AI Rejection Analysis</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Parsing the communication for subtle signals.</p>
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem', background: 'rgba(244, 63, 94, 0.05)', borderRadius: '1rem', border: '1px solid rgba(244, 63, 94, 0.1)', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    "Thank you for your time. While your background is impressive, we've decided to move forward with candidates whose experience more closely aligns with our current infrastructure scale requirements."
                  </div>
                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Primary Reason</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Experience Scale Gap</p>
                    </div>
                    <div style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sentiment</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f43f5e', margin: 0 }}>Formal / Standard</p>
                    </div>
                  </div>
                </div>

                {/* Next Opportunity Card */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(37, 106, 244, 0.05), transparent)' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Strategic Pivot Recommended</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Based on this rejection, we recommend focusing on <strong style={{ color: 'var(--text-primary)' }}>Series B-C startups</strong> where your infrastructure experience is a 95% match.</p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn-primary" style={{ flex: 1 }}>Explore Similar Roles</button>
                    <button className="btn-secondary">Update Strategy</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Pipeline Stats */}
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Pipeline Impact</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Success Rate (this week)</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f43f5e' }}>-12.5%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Active Applications</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>14</span>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Rejections are part of the process. You have 3 interviews scheduled for next week.</p>
                  </div>
                </div>

                {/* Emotional Resilience Card */}
                <div style={{ padding: '1.5rem', borderRadius: '1.5rem', background: 'rgba(37, 106, 244, 0.05)', border: '1px solid rgba(37, 106, 244, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>favorite</span>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--primary-color)', margin: 0 }}>Resilience Check</h5>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>"Every 'no' brings you one step closer to the right 'yes'. Take 5 minutes to record what you learned, then move forward."</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'rejection_classified':
      case 'optional_response':
      case 'reflection_recorded':
      case 'close_active_tasks':
      case 'archived':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>{REJECTED_SUBSTAGES.find(s => s.id === activeSubStage)?.icon}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{REJECTED_SUBSTAGES.find(s => s.id === activeSubStage)?.label}</h3>
            <p style={{ fontSize: '0.875rem' }}>This sub-stage is under construction in the demo.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Rejection Flow</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {REJECTED_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function DeclinedSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('offer_review');

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'offer_review':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Declined Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Final Review</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Offer Review</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Confirming the decision to decline the offer from <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span>.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setActiveSubStage('reason_selection')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Select Reason</button>
              </div>
            </div>

            <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'rgba(37, 106, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>not_interested</span>
                </div>
                <div>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', margin: 0 }}>Declining is a Strategic Choice</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', margin: 0 }}>By declining this offer, you are prioritizing roles that better align with your long-term career goals.</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'reason_selection':
      case 'response_preparation':
      case 'communication_sent':
      case 'preference_learning':
      case 'archived_summary':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>{DECLINED_SUBSTAGES.find(s => s.id === activeSubStage)?.icon}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{DECLINED_SUBSTAGES.find(s => s.id === activeSubStage)?.label}</h3>
            <p style={{ fontSize: '0.875rem' }}>This sub-stage is under construction in the demo.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Declined Flow</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {DECLINED_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function WithdrawnSubStagePanel({ app, onRefresh, onStageChange }) {
  const [activeSubStage, setActiveSubStage] = useState('decision_made');

  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    background: activeSubStage === id ? 'rgba(37, 106, 244, 0.1)' : 'transparent',
    color: activeSubStage === id ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '0.25rem'
  });

  const renderContent = () => {
    switch (activeSubStage) {
      case 'decision_made':
        return (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-color)', background: 'rgba(37, 106, 244, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(37, 106, 244, 0.2)' }}>Withdrawn Phase</span>
                  <span style={{ height: '4px', width: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Intent to Withdraw</span>
                </div>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Withdrawal Decision</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Confirm your withdrawal from <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{app?.company || 'Target Company'}</span>.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setActiveSubStage('reason_selected')} className="btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 700 }}>Proceed to Reasons</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Decision Summary Card */}
                <div className="card glass" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                      <div style={{ width: '4rem', height: '4rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <img src={app?.company_logo || 'https://via.placeholder.com/64'} alt={app?.company} style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: 0 }}>{app?.company || 'Target Company'}</h4>
                        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>{app?.job_title || 'Senior Product Designer'}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#fb7185', background: 'rgba(251, 113, 133, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '2rem', textTransform: 'uppercase' }}>Action Required</span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Current Stage</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>calendar_today</span>
                        Final Interview
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Process Duration</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>timelapse</span>
                        42 Days
                      </div>
                    </div>
                  </div>
                </div>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Pipeline Health</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Other Active Apps</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'white' }}>12</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Withdrawal Rate</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#fb7185' }}>8%</span>
                    </div>
                  </div>
                </div>
               </div>
            </div>
          </div>
        );
      case 'reason_selected':
      case 'contact_path':
      case 'withdrawal_sent':
      case 'close_active_tasks':
      case 'preference_learning':
      case 'archived':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>{WITHDRAWN_SUBSTAGES.find(s => s.id === activeSubStage)?.icon}</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{WITHDRAWN_SUBSTAGES.find(s => s.id === activeSubStage)?.label}</h3>
            <p style={{ fontSize: '0.875rem' }}>This sub-stage is under construction in the demo.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>Withdrawn Flow</p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>{app?.job_title || 'Product Designer'}</h2>
        </div>
        {WITHDRAWN_SUBSTAGES.map((s) => (
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
            {activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>}
          </button>
        ))}
      </div>

      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

function ApplicationLifecycle({ app: initialApp, onBack, onUpdate, hideHeader = false, activePhaseTab, avgScore }) {


  const { fetchWithAuth } = useAuth();
  const [app, setApp] = useState(initialApp);
  const [connections, setConnections] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactMode, setAddContactMode] = useState('search');
  const [manualContact, setManualContact] = useState({ name: '', title: '', company: '', email: '', phone: '', linkedin_url: '', how_we_know: '' });
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);

  const [outreachScript, setOutreachScript] = useState({ subject: '', body: '' });
  const [generatingOutreach, setGeneratingOutreach] = useState(false);

  useEffect(() => {
    if (app?.outreach_script) {
      try {
        const parsed = JSON.parse(app.outreach_script);
        setOutreachScript({ subject: parsed.subject || '', body: parsed.body || '' });
      } catch (e) {
        setOutreachScript({ subject: 'Networking', body: app.outreach_script });
      }
    }
  }, [app?.outreach_script]);

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

  const extractNameFromUrl = (url) => {
    try {
      const match = url.match(/linkedin\.com\/in\/([^/]+)/i);
      if (match && match[1]) {
        let nameSlug = match[1];
        nameSlug = nameSlug.replace(/[-0-9]+$/, ''); // remove trailing numbers
        return nameSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ').trim();
      }
    } catch (e) {}
    return '';
  };

  const handleAddContact = async (contact) => {
    try {
      let finalName = contact.name;
      if (addContactMode === 'url' && !isEditingContact && !finalName) {
         finalName = extractNameFromUrl(contact.linkedin_url) || 'Unknown Connection';
      }

      const payload = {
        name: finalName,
        role: contact.title || contact.role,
        linkedin_url: contact.profile_url || contact.linkedin_url,
        company: contact.company || app.company,
        email: contact.email,
        phone: contact.phone,
        how_we_know: contact.how_we_know
      };
      
      const method = isEditingContact ? 'PUT' : 'POST';
      const endpoint = isEditingContact 
        ? `${API_URL}/api/applications/${app.id}/contacts/${editingContactId}`
        : `${API_URL}/api/applications/${app.id}/contacts`;

      const res = await fetchWithAuth(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        refreshApp();
        setShowAddContact(false);
        setIsEditingContact(false);
        setEditingContactId(null);
      }
    } catch (e) {
      console.error("Failed to add/update contact", e);
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/contacts/${contactId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        refreshApp();
        setShowAddContact(false);
        setIsEditingContact(false);
        setEditingContactId(null);
      }
    } catch (e) {
      console.error("Failed to delete contact", e);
    }
  };

  const openEditContact = (contact) => {
    setManualContact({
      name: contact.name || '',
      title: contact.role || '',
      company: contact.company || '',
      email: contact.email || '',
      phone: contact.phone || '',
      linkedin_url: contact.linkedin_url || '',
      how_we_know: contact.how_we_know || ''
    });
    setEditingContactId(contact.id);
    setIsEditingContact(true);
    setAddContactMode('manual');
    setShowAddContact(true);
  };

  const handleGenerateOutreach = async (contact = null) => {
    const card = document.getElementById('networking-strategy-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setGeneratingOutreach(true);
    try {
      const payload = contact ? {
        contact_name: contact.name || '',
        contact_role: contact.role || contact.title || '',
        linkedin_url: contact.linkedin_url || contact.profile_url || '',
        how_we_know: contact.how_we_know || ''
      } : {
        contact_name: "Hiring Manager",
        contact_role: "Recruiter / Hiring Manager"
      };

      const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/generate-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        refreshApp();
      }
    } catch (e) {
      console.error("Failed to generate script", e);
    } finally {
      setGeneratingOutreach(false);
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
        <SavedSubStagePanel 
          app={app} 
          onRefresh={refreshApp} 
          avgScore={avgScore} 
          onStageChange={updateStage} 
          connections={connections}
          onAddContact={handleAddContact}
          onSearchPeople={() => setShowAddContact(true)}
          handleGenerateOutreach={handleGenerateOutreach}
          generatingOutreach={generatingOutreach}
          outreachScript={outreachScript}
          setOutreachScript={setOutreachScript}
          openEditContact={openEditContact}
          handleDeleteContact={handleDeleteContact}
        />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'generated') ? (
        <GeneratedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'applied') ? (
        <AppliedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'interviewing') ? (
        <InterviewingSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'decision') ? (
        <DecisionSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'offered') ? (
        <AcceptedSubStagePanel key="offered" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="offer_received" />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'accepted') ? (
        <AcceptedSubStagePanel key="accepted" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="formal_acceptance" />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'rejected') ? (
        <RejectedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'declined') ? (
        <DeclinedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
) : ((activePhaseTab || app?.pipeline_stage || 'saved').toLowerCase() === 'withdrawn') ? (
        <WithdrawnSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />
      ) : (


      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        {/* Left Column: Stage Specific Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
                    <div 
                      onClick={() => setIsPreviewExpanded(true)}
                      style={{ 
                        flex: 1, 
                        padding: '2rem', 
                        background: 'rgba(16, 22, 34, 0.4)', 
                        borderRadius: '1rem', 
                        border: '1px solid var(--border-color)',
                        minHeight: '600px',
                        maxHeight: '800px',
                        overflowY: 'auto',
                        cursor: 'pointer',
                        fontFamily: '"Montserrat", sans-serif',
                        fontSize: '0.85rem',
                        lineHeight: '1.6',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap'
                      }}
                      className="job-match-scroll"
                    >
                      {app?.resume_data ? (
                        (() => {
                          const data = safeParseJSON(app.resume_data, {});
                          return (
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>{data.contact_info?.name || 'Your Name'}</h1>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                  {data.contact_info?.email && <span>{data.contact_info.email}</span>}
                                  {data.contact_info?.phone && <span>{data.contact_info.phone}</span>}
                                  {data.contact_info?.location && <span>{data.contact_info.location}</span>}
                                </div>
                              </div>

                              {data.summary && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '0.5rem' }}>Summary</h2>
                                  <p style={{ margin: 0 }}>{data.summary}</p>
                                </div>
                              )}

                              {data.experience?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '1rem' }}>Experience</h2>
                                  {data.experience.map((exp, idx) => (
                                    <div key={idx} style={{ marginBottom: '1.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '0.9rem' }}>{exp.job_title}</strong>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.dates}</span>
                                      </div>
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>{exp.company}</div>
                                      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem' }}>
                                        {exp.responsibilities?.map((resp, i) => (
                                          <li key={i} style={{ marginBottom: '0.25rem' }}>{resp}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {data.skills?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                  <h2 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '0.5rem' }}>Skills</h2>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {data.skills.map((skill, i) => (
                                      <span key={i} style={{ background: 'rgba(37, 106, 244, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{skill}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          No preview data available.
                        </div>
                      )}
                    </div>          
          {/* Phase-based view */}
          <div className="card glass" style={{ padding: '2rem' }}>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.headline || person.title}</div>
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
          <div className="card glass" style={{ width: '100%', maxWidth: '600px', padding: '2rem', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{isEditingContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button onClick={() => { setShowAddContact(false); setIsEditingContact(false); setEditingContactId(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button onClick={() => setAddContactMode('search')} style={{ background: 'none', border: 'none', color: addContactMode === 'search' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: addContactMode === 'search' ? 800 : 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: addContactMode === 'search' ? '2px solid var(--primary)' : 'none' }}>Search My LinkedIn Network</button>
              <button onClick={() => setAddContactMode('manual')} style={{ background: 'none', border: 'none', color: addContactMode === 'manual' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: addContactMode === 'manual' ? 800 : 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: addContactMode === 'manual' ? '2px solid var(--primary)' : 'none' }}>Manual Entry</button>
              <button onClick={() => setAddContactMode('url')} style={{ background: 'none', border: 'none', color: addContactMode === 'url' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: addContactMode === 'url' ? 800 : 600, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: addContactMode === 'url' ? '2px solid var(--primary)' : 'none' }}>LinkedIn URL</button>
            </div>

            {addContactMode === 'search' && (
              <>
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
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="custom-scrollbar">
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
              </>
            )}

            {addContactMode === 'manual' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Name (Required)</label>
                  <input type="text" value={manualContact.name} onChange={e => setManualContact({...manualContact, name: e.target.value})} placeholder="Jane Doe" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Title / Role</label>
                  <input type="text" value={manualContact.title} onChange={e => setManualContact({...manualContact, title: e.target.value})} placeholder="Software Engineer" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Company</label>
                  <input type="text" value={manualContact.company} onChange={e => setManualContact({...manualContact, company: e.target.value})} placeholder={app?.company} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
                  <input type="email" value={manualContact.email} onChange={e => setManualContact({...manualContact, email: e.target.value})} placeholder="jane@example.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Phone</label>
                  <input type="tel" value={manualContact.phone} onChange={e => setManualContact({...manualContact, phone: e.target.value})} placeholder="555-123-4567" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>How we know them</label>
                  <input type="text" value={manualContact.how_we_know} onChange={e => setManualContact({...manualContact, how_we_know: e.target.value})} placeholder="Met at conference..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                  {isEditingContact && (
                    <button onClick={() => handleDeleteContact(editingContactId)} className="btn-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Remove Contact</button>
                  )}
                  <button onClick={() => handleAddContact(manualContact)} disabled={!manualContact.name} className="btn-primary">{isEditingContact ? 'Save Changes' : 'Add Contact'}</button>
                </div>
              </div>
            )}

            {addContactMode === 'url' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>LinkedIn Profile URL (Required)</label>
                  <input type="url" value={manualContact.linkedin_url} onChange={e => setManualContact({...manualContact, linkedin_url: e.target.value})} placeholder="https://linkedin.com/in/..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => handleAddContact(manualContact)} disabled={!manualContact.linkedin_url} className="btn-primary">Add Contact</button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ApplicationLifecycle;
