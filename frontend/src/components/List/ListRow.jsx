import React, { useCallback } from 'react';
import { deriveStage, TERMINAL_COLUMNS } from '../Kanban/stages.js';
import PipelineStrip from './PipelineStrip.jsx';
import ScoreMini from './ScoreMini.jsx';
import { DocsCondensed, DocsTextForward } from './DocsCluster.jsx';
import { deriveDocs, formatPosted, formatSalary, deriveHint, interestWeight } from './columns.js';

function CompanyLogo({ app }) {
  if (app.company_logo) {
    return (
      <div className="lco-logo">
        <img
          src={app.company_logo}
          alt={app.company}
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'grid'; }}
        />
        <div style={{ display: 'none', width: '100%', height: '100%', placeItems: 'center', fontWeight: 800, fontSize: 11 }}>
          {(app.company || '?').slice(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }
  return (
    <div className="lco-logo">
      {(app.company || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}

function StarsInline({ level, onSet }) {
  const weight = interestWeight(level);
  const LEVELS = ['Low', 'Medium', 'High'];
  return (
    <span className="lstars" onClick={e => e.stopPropagation()}>
      {[1, 2, 3].map(n => (
        <span
          key={n}
          className={`material-symbols-outlined ${n <= weight ? 'star-on' : ''}`}
          style={{
            fontSize: 14, cursor: 'pointer',
            color: n <= weight ? '#f59e0b' : 'var(--txt-faint)',
            fontVariationSettings: n <= weight ? "'FILL' 1" : "'FILL' 0",
          }}
          onClick={() => onSet && onSet(LEVELS[n - 1])}
        >
          star
        </span>
      ))}
    </span>
  );
}

function SalaryCell({ value }) {
  const display = formatSalary(value);
  if (!display) return <span className="salary-chip is-unlisted">—</span>;
  return (
    <span className="salary-chip">
      <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>payments</span>
      {display}
    </span>
  );
}

function QuickActions({ onOpen, onStage, onArchive }) {
  return (
    <span className="lqa" onClick={e => e.stopPropagation()}>
      <button className="lqa-btn" title="Open" onClick={onOpen}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
      </button>
      <button className="lqa-btn" title="Change stage" onClick={onStage}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>swap_horiz</span>
      </button>
      <button className="lqa-btn" title="Archive" onClick={onArchive}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>archive</span>
      </button>
    </span>
  );
}

export default function ListRow({
  app,
  cols,
  density = 'comfy',
  selected = false,
  focused = false,
  expanded = false,
  avgScore,
  onViewApp,
  onSelect,
  onToggleExpand,
  onSetInterest,
  onOpenStagePopover,
}) {
  const stage   = deriveStage(app);
  const isClosed = TERMINAL_COLUMNS.includes(stage);
  const docs    = deriveDocs(app);
  const hint    = deriveHint(app);
  const isUrgent = ['inbox', 'saved', 'generated'].includes(stage.toLowerCase());
  const rawSub = app.substage_progress ?? app.pipeline_substage ?? 0;
  const subProgress = rawSub !== null && typeof rawSub === 'object'
    ? Object.values(rawSub).filter(Boolean).length
    : (parseInt(rawSub) || 0);

  const handleClick = useCallback((e) => {
    if (e.target.closest('.lcb, .lstars, .lqa, .lqa-btn')) return;
    onViewApp(app);
  }, [app, onViewApp]);

  const handleCheck = useCallback((e) => {
    e.stopPropagation();
    onSelect(app.id);
  }, [app.id, onSelect]);

  const visibleCols = cols.filter(c => c.visible !== false);

  const renderCell = (col) => {
    switch (col.id) {
      case 'check':
        return (
          <div key={col.id} className="lcell lcheck" style={{ width: col.width }}>
            <input
              type="checkbox"
              className={`lcb`}
              checked={selected}
              onChange={handleCheck}
              onClick={e => e.stopPropagation()}
              aria-label={`Select ${app.company}`}
            />
          </div>
        );
      case 'company':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            <div className="lco">
              <CompanyLogo app={app} />
              <div className="lco-text">
                <span className="lco-name">{app.company || 'Unknown'}</span>
                {density !== 'compact' && (
                  <span className="lco-role">{app.job_title || ''}</span>
                )}
              </div>
            </div>
          </div>
        );
      case 'pipeline':
        return (
          <div
            key={col.id}
            className="lcell"
            style={{ width: col.width, cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onOpenStagePopover && onOpenStagePopover(app, e.currentTarget); }}
            title="Click to change stage"
          >
            <PipelineStrip stage={stage} subProgress={subProgress} />
          </div>
        );
      case 'score':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width, gap: 6 }}>
            <ScoreMini score={app.match_score} avgScore={avgScore} />
            {density !== 'compact' && avgScore != null && app.match_score != null && (
              <span className="lscore-vs">
                {app.match_score >= avgScore ? '+' : ''}{Math.round(app.match_score - avgScore)}
              </span>
            )}
          </div>
        );
      case 'salary':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            <SalaryCell value={app.salary_range || app.salary} />
          </div>
        );
      case 'stars':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            <StarsInline level={app.interest_level} onSet={onSetInterest} />
          </div>
        );
      case 'docs':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            {density === 'compact'
              ? <DocsCondensed docs={docs} />
              : <DocsTextForward docs={docs} />}
          </div>
        );
      case 'loc':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            <span className="lmeta" title={app.location}>{app.location || '—'}</span>
          </div>
        );
      case 'posted':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width }}>
            <span className="lmeta">{formatPosted(app)}</span>
          </div>
        );
      case 'hint':
        return (
          <div key={col.id} className="lcell" style={{ width: col.width, flex: 1, minWidth: 0 }}>
            <span className={`lhint${isUrgent ? ' is-urgent' : ''}`}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 13,
                  flexShrink: 0,
                  fontVariationSettings: isUrgent ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {isUrgent ? 'bolt' : 'schedule'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hint}
              </span>
            </span>
            <span style={{ marginLeft: 'auto' }} />
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: 'var(--txt-dim)', flexShrink: 0, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onToggleExpand(app.id); }}
              title={expanded ? 'Collapse' : 'Expand preview'}
            >
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
            <QuickActions
              onOpen={e => { e.stopPropagation(); onViewApp(app); }}
              onStage={e => { e.stopPropagation(); onOpenStagePopover && onOpenStagePopover(app, e.currentTarget); }}
              onArchive={e => e.stopPropagation()}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const totalWidth = visibleCols.reduce((s, c) => s + c.width, 0);

  return (
    <div
      className={`lrow d-${density}${selected ? ' is-selected' : ''}${focused ? ' is-focused' : ''}${expanded ? ' is-expanded' : ''}${isClosed ? ' is-closed' : ''}`}
      style={{ gridTemplateColumns: visibleCols.map(c => c.id === 'hint' ? '1fr' : `${c.width}px`).join(' '), minWidth: totalWidth }}
      onClick={handleClick}
      data-appid={app.id}
    >
      {visibleCols.map(col => renderCell(col))}
    </div>
  );
}
