
export const STAGE_TO_STATUS = {
  'saved': 'Saved',
  'generated': 'Generated',
  'applied': 'Applied',
  'interviewing': 'Interviewing',
  'decision': 'Interviewing',
  'accepted': 'Accepted',
  'declined': 'Declined',
  'rejected': 'Rejected',
  'archived': 'Archived'
};

const STAGES = {
  saved: { id: 'saved', label: 'Saved', icon: 'bookmark', col: 1, row: 1 },
  generated: { id: 'generated', label: 'Generated', icon: 'description', col: 2, row: 1 },
  applied: { id: 'applied', label: 'Applied', icon: 'send', col: 3, row: 1 },
  interviewing: { id: 'interviewing', label: 'Interviewing', icon: 'chat_bubble', col: 4, row: 1 },
  rejected: { id: 'rejected', label: 'Rejected', icon: 'dangerous', col: 4, row: 2, color: '#ef4444' },
  decision: { id: 'decision', label: 'Decision', icon: 'gavel', col: 5, row: 1 },
  accepted: { id: 'accepted', label: 'Accepted', icon: 'verified', col: 6, row: 1, color: '#22c55e' },
  declined: { id: 'declined', label: 'Declined', icon: 'block', col: 6, row: 2, color: '#f59e0b' },
  archived: { id: 'archived', label: 'Archived', icon: 'archive', col: 6, row: 3, color: '#64748b' },
};

export const PIPELINE_STAGES = Object.values(STAGES);

const PipelineProgressBar = ({ currentStage: stageProp, onStageClick, isArchived }) => {
  const currentStage = (stageProp || 'saved').toLowerCase();

  const getStatus = (id) => {
    // Archived is a special terminal state
    if (id === 'archived') {
      return isArchived ? 'current' : 'future';
    }

    // Normal stage logic
    if (currentStage === id) {
      return isArchived ? 'completed' : 'current';
    }
    
    const linearOrder = ['saved', 'generated', 'applied', 'interviewing', 'decision', 'accepted'];
    const currentIndex = linearOrder.indexOf(currentStage);
    const targetIndex = linearOrder.indexOf(id);
    
    // If current is outcome, handle linear path
    const outcomes = ['accepted', 'declined', 'rejected'];
    if (outcomes.includes(currentStage)) {
       const stageIndex = linearOrder.indexOf(id);
       if (stageIndex !== -1) {
          // If we reached decision or beyond, stages up to decision are completed
          const lastLinear = currentStage === 'rejected' ? 2 : 4; // applied or decision
          const linearLimit = linearOrder.indexOf(linearOrder[lastLinear]);
          if (stageIndex <= linearLimit) return 'completed';
       }
    }

    // Specific logic for Rejected branch
    if (id === 'rejected') return currentStage === 'rejected' ? 'current' : 'future';
    
    // Specific logic for Declined branch
    if (id === 'declined') return currentStage === 'declined' ? 'current' : 'future';

    // Linear logic for main path
    if (currentIndex !== -1 && targetIndex !== -1) {
        return targetIndex < currentIndex ? 'completed' : 'future';
    }
    
    // Fallback: if we are further in the flow, mark previous as completed
    if (currentIndex === -1 && outcomes.includes(currentStage)) {
        // Handled above for outcomes, but let's be safe
        const lastStageIdx = {
            'rejected': 2, // up to applied
            'declined': 4, // up to decision
            'accepted': 4  // up to decision
        }[currentStage];
        if (targetIndex !== -1 && targetIndex <= lastStageIdx) return 'completed';
    }

    return 'future';
  };

  const renderNode = (stage) => {
    const status = getStatus(stage.id);
    const isCurrent = status === 'current';
    const isCompleted = status === 'completed';
    const isFuture = status === 'future';
    const nodeColor = stage.color || 'var(--primary)';

    return (
      <div 
        key={stage.id} 
        onClick={() => onStageClick && onStageClick(stage.id)}
        style={{ 
          gridColumn: stage.col, 
          gridRow: stage.row,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2, 
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <div style={{ 
          width: isCurrent ? '48px' : '40px', 
          height: isCurrent ? '48px' : '40px', 
          borderRadius: '50%', 
          background: (isCompleted || isCurrent) ? nodeColor : 'var(--bg-primary)', 
          border: isFuture ? '2px solid var(--border-color-card)' : 'none',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: (isCompleted || isCurrent) ? 'white' : 'var(--text-secondary)',
          boxShadow: isCurrent ? `0 0 20px ${nodeColor}66` : 'none',
          transition: 'all 0.3s ease'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: isCurrent ? '24px' : '20px' }}>
            {isCompleted ? 'check' : stage.icon}
          </span>
        </div>
        <span style={{ 
          fontSize: '9px', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          color: isCurrent ? nodeColor : (isCompleted ? 'var(--text-primary)' : 'var(--text-muted)'),
          textAlign: 'center',
          position: 'absolute',
          bottom: '4px', // Stable position in 100px cell
          width: '100%',
          left: 0
        }}>
          {stage.label}
        </span>
      </div>
    );
  };

  // Helper to get archived connection path
  const getCurvedPath = (fromX, fromY, toX, toY, splitOffset = 50) => {
    const splitX = fromX + splitOffset;
    const cpX = (splitX + toX) / 2;
    return `M ${fromX},${fromY} L ${splitX},${fromY} C ${cpX},${fromY} ${cpX},${toY} ${toX},${toY}`;
  };

  const getArchivedPath = () => {
    const stage = STAGES[currentStage] || STAGES.saved;
    const startX = stage.col * 100 - 50;
    const startY = stage.row * 100 - 50; // Row 1: 50, Row 2: 150, Row 3: 250
    const target = STAGES.archived;
    const targetX = target.col * 100 - 50;
    const targetY = target.row * 100 - 50;
    
    return getCurvedPath(startX, startY, targetX, targetY);
  };

  return (
    <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem', position: 'relative', overflow: 'visible' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gridTemplateRows: `repeat(${isArchived ? 3 : 2}, 100px)`, // Dynamic height
        position: 'relative'
      }}>
        {/* SVG Connections Layer */}
        <svg 
          viewBox={`0 0 600 ${isArchived ? 300 : 200}`} 
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}
        >
          {/* Base Background Paths */}
          <g stroke="var(--bg-tertiary)" strokeWidth="2" fill="none">
             {/* Main linear path */}
             <path d="M 50,50 L 550,50" />
             
             {/* Branches */}
             <path d={getCurvedPath(250, 50, 350, 150)} /> {/* To Rejected */}
             <path d={getCurvedPath(450, 50, 550, 150)} /> {/* To Declined */}
             
             {/* Dynamic background archived path */}
             {isArchived && <path d={getArchivedPath()} strokeDasharray="4 4" opacity="0.3" />}
          </g>

          {/* Active Highlight Paths */}
          <g stroke="var(--primary)" strokeWidth="3" fill="none" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }}>
             {/* Progression highlights */}
             {getStatus('generated') !== 'future' && <path d="M 50,50 L 150,50" />}
             {getStatus('applied') !== 'future' && <path d="M 150,50 L 250,50" />}
             
             {/* Interviewing path */}
             {['interviewing', 'decision', 'accepted', 'declined'].includes(currentStage) && (
                 <path d="M 250,50 L 350,50" />
             )}
             
             {/* Decision path */}
             {['decision', 'accepted', 'declined'].includes(currentStage) && (
                 <path d="M 350,50 L 450,50" />
             )}

             {/* Outcome: Rejected */}
             {currentStage === 'rejected' && (
                 <path d={getCurvedPath(250, 50, 350, 150)} stroke="#ef4444" />
             )}

             {/* Outcome: Accepted */}
             {currentStage === 'accepted' && (
                 <path d="M 450,50 L 550,50" stroke="#22c55e" />
             )}

             {/* Outcome: Declined */}
             {currentStage === 'declined' && (
                 <path d={getCurvedPath(450, 50, 550, 150)} stroke="#f59e0b" />
             )}

             {/* Dynamic Archive Highlight */}
             {isArchived && <path d={getArchivedPath()} stroke="#64748b" strokeDasharray="4 4" />}
          </g>
        </svg>

        {Object.values(STAGES).map(stage => {
          if (stage.id === 'archived' && !isArchived) return null;
          return renderNode(stage);
        })}
      </div>
    </div>
  );
};

export default PipelineProgressBar;
