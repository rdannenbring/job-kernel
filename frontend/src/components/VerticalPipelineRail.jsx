import React from 'react';
import { STAGE_TO_STATUS } from './PipelineProgressBar';

const MAIN_STAGES = [
  { id: 'saved', label: 'Saved' },
  { id: 'generated', label: 'Generated' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'decision', label: 'Decision' },
  { id: 'accepted', label: 'Accepted' },
];

const END_STATES = [
  { id: 'rejected', label: 'Rejected', icon: 'block' },
  { id: 'declined', label: 'Declined', icon: 'do_not_disturb_on' },
  { id: 'withdrawn', label: 'Withdrawn', icon: 'cancel' },
];

const STAGE_SUBSTAGES = {
  saved: [
    { id: 'parsed', label: 'Job Analysis', icon: 'analytics' },
    { id: 'reviewed', label: 'Reviewed', icon: 'fact_check' },
    { id: 'network', label: 'Network Contacts', icon: 'group' },
    { id: 'company', label: 'Company Research', icon: 'domain' },
    { id: 'prioritized', label: 'Prioritize', icon: 'flag' },
  ],
  generated: [
    { id: 'resume', label: 'Resume', icon: 'description' },
    { id: 'cover_letter', label: 'Cover Letter', icon: 'mail' },
    { id: 'answers', label: 'Answers', icon: 'question_answer' },
    { id: 'prep', label: 'Prep Artifacts', icon: 'inventory_2' },
  ],
  applied: [
    { id: 'submitted', label: 'Submitted', icon: 'check_circle' },
    { id: 'confirmed', label: 'Confirmed', icon: 'verified' },
    { id: 'follow_up_due', label: 'Follow-up Due', icon: 'schedule' },
    { id: 'follow_up_sent', label: 'Follow-up Sent', icon: 'send' },
  ],
  interviewing: [
    { id: 'recruiter_screen', label: 'Recruiter Screen', icon: 'person_search' },
    { id: 'hiring_manager', label: 'Hiring Manager', icon: 'psychology' },
    { id: 'technical', label: 'Technical', icon: 'code' },
    { id: 'panel', label: 'Panel', icon: 'account_tree' },
    { id: 'final_round', label: 'Final Round', icon: 'stars' },
  ],
  decision: [
    { id: 'awaiting_decision', label: 'Awaiting Decision', icon: 'hourglass_empty' },
    { id: 'references', label: 'References', icon: 'quick_reference_all' },
    { id: 'verbal_offer', label: 'Verbal Offer', icon: 'chat' },
    { id: 'written_offer_pending', label: 'Written Offer Pending', icon: 'description' },
    { id: 'likely_reject', label: 'Likely Reject', icon: 'thumb_down' },
  ],
  accepted: [
    { id: 'offer_received', label: 'Offer Received', icon: 'receipt_long' },
    { id: 'offer_reviewed', label: 'Offer Reviewed', icon: 'fact_check' },
    { id: 'formal_acceptance', label: 'Formal Acceptance', icon: 'handshake' },
    { id: 'close_pipelines', label: 'Close Pipelines', icon: 'cancel_presentation' },
    { id: 'pre_onboarding', label: 'Pre-onboarding', icon: 'assignment_ind' },
  ],
};

const VerticalPipelineRail = ({
  currentStage,
  stageProgress = {},
  substageProgress = {},
  activePhaseTab,
  activeSubStage,
  onStageChange,
  onSubStageChange,
  onEndStateSelect,
}) => {
  const current = (currentStage || 'saved').toLowerCase();
  const linearOrder = ['saved', 'generated', 'applied', 'interviewing', 'decision', 'accepted'];
  const currentIdx = linearOrder.indexOf(current);
  const terminalStages = ['rejected', 'declined', 'withdrawn'];
  const isTerminal = terminalStages.includes(current);

  const getStageStatus = (stageId) => {
    if (isTerminal) {
      const lastIdx = current === 'rejected' ? 2 : 4;
      const idx = linearOrder.indexOf(stageId);
      if (idx !== -1 && idx <= lastIdx) return 'passed';
      return 'future';
    }
    const idx = linearOrder.indexOf(stageId);
    if (idx < currentIdx) return 'passed';
    if (idx === currentIdx) return 'current';
    return 'future';
  };

  const activeTabLower = (activePhaseTab || current).toLowerCase();

  const isSubDone = (stageId, subId) => {
    if (stageId === 'saved' && subId === 'parsed') return true;
    if (stageId === 'generated') {
      if (subId === 'resume') return !!(stageProgress?.generated?.completed > 0);
      if (subId === 'cover_letter') return !!(stageProgress?.generated?.completed > 1);
    }
    return substageProgress?.[subId] === true;
  };

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 14,
      padding: 10,
      alignSelf: 'flex-start',
    }}>
      <div style={{
        padding: '4px 8px 8px',
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
      }}>
        Pipeline
      </div>

      <div>
        {MAIN_STAGES.map((stage, i) => {
          const status = getStageStatus(stage.id);
          const isPassed = status === 'passed';
          const isActive = stage.id.toLowerCase() === activeTabLower;
          const prog = stageProgress?.[stage.id];
          const substages = STAGE_SUBSTAGES[stage.id] || [];

          return (
            <React.Fragment key={stage.id}>
              <div
                onClick={() => onStageChange(stage.id)}
                style={{
                  position: 'relative',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(37,106,244,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-primary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Vertical connecting line */}
                <div style={{
                  position: 'absolute',
                  left: 17,
                  top: i === 0 ? '50%' : 0,
                  bottom: i === MAIN_STAGES.length - 1 ? '50%' : 0,
                  width: 2,
                  background: isPassed || isActive ? 'var(--primary)' : 'var(--border-color)',
                  zIndex: 0,
                }} />

                {/* Stage node */}
                <div style={{
                  position: 'absolute',
                  left: 11,
                  top: 13,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isPassed ? 'var(--primary)' : 'var(--bg-card)',
                  border: `${isPassed ? 0 : 1.5}px solid ${(isActive || isPassed) ? 'var(--primary)' : 'var(--border-color)'}`,
                  boxShadow: isActive && !isPassed ? '0 0 0 4px rgba(37,106,244,0.12)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}>
                  {isPassed && (
                    <span style={{ color: 'white', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>✓</span>
                  )}
                  {isActive && !isPassed && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                  )}
                </div>

                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isActive ? 'var(--primary)' : isPassed ? 'var(--text-secondary)' : 'var(--text-muted)',
                  lineHeight: 1.3,
                }}>
                  {stage.label}
                </div>

                {prog && prog.total > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, fontWeight: 500 }}>
                    {prog.completed}/{prog.total}{isActive ? ' · in progress' : isPassed ? ' · done' : ''}
                  </div>
                )}
              </div>

              {/* Sub-stages under active stage — clickable navigation */}
              {isActive && substages.length > 0 && (
                <div style={{
                  marginLeft: 17,
                  paddingLeft: 25,
                  borderLeft: '1.5px dashed rgba(37,106,244,0.35)',
                  marginBottom: 4,
                  marginTop: 2,
                }}>
                  {substages.map((sub, subIdx) => {
                    const done = isSubDone(stage.id, sub.id);
                    const isSubActive = activeSubStage === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => onSubStageChange && onSubStageChange(sub.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          background: isSubActive ? 'rgba(37,106,244,0.1)' : 'transparent',
                          border: `1px solid ${isSubActive ? 'rgba(37,106,244,0.25)' : 'transparent'}`,
                          color: isSubActive ? 'var(--primary)' : done ? 'var(--text-muted)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: isSubActive ? 700 : 500,
                          textAlign: 'left',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={e => { if (!isSubActive) e.currentTarget.style.background = 'var(--bg-primary)'; }}
                        onMouseLeave={e => { if (!isSubActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: 12,
                            color: isSubActive ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-muted)',
                            fontVariationSettings: (isSubActive || done) ? "'FILL' 1" : "'FILL' 0",
                            flexShrink: 0,
                          }}
                        >
                          {done && !isSubActive ? 'check_circle' : sub.icon}
                        </span>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          opacity: done && !isSubActive ? 0.55 : 1,
                        }}>
                          {sub.label}
                        </span>
                        {isSubActive && (
                          <span className="material-symbols-outlined" style={{ fontSize: 10, opacity: 0.6 }}>chevron_right</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* End states */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        margin: '10px 4px 6px',
        fontSize: 9,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: 'var(--text-muted)',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
        End states
        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
      </div>

      {END_STATES.map(es => {
        const isCurrentEndState = current === es.id;
        return (
          <button
            key={es.id}
            onClick={() => onEndStateSelect(es.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              background: isCurrentEndState ? 'rgba(239,68,68,0.08)' : 'transparent',
              border: `1px solid ${isCurrentEndState ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
              color: isCurrentEndState ? '#ef4444' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!isCurrentEndState) {
                e.currentTarget.style.background = 'var(--bg-primary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!isCurrentEndState) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{es.icon}</span>
            <span style={{ flex: 1 }}>{es.label}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 12, opacity: 0.4 }}>arrow_outward</span>
          </button>
        );
      })}
    </div>
  );
};

export default VerticalPipelineRail;
