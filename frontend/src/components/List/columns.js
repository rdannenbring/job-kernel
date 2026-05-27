import { KANBAN_COLUMNS, TERMINAL_COLUMNS, lastActivityDate, deriveStage } from '../Kanban/stages.js';

// Canonical column model — ported from L_COLUMNS in list-shared.jsx
export const DEFAULT_COLUMNS = [
  { id: 'check',    label: '',            width: 36,  locked: true,  sortable: false, visible: true },
  { id: 'company',  label: 'Company',     width: 260, locked: true,  sortable: true,  visible: true },
  { id: 'pipeline', label: 'Journey',     width: 240, locked: false, sortable: true,  visible: true },
  { id: 'score',    label: 'Score',       width: 90,  locked: false, sortable: true,  visible: true },
  { id: 'salary',   label: 'Salary',      width: 130, locked: false, sortable: false, visible: true },
  { id: 'stars',    label: 'Interest',    width: 80,  locked: false, sortable: true,  visible: true },
  { id: 'docs',     label: 'Docs',        width: 100, locked: false, sortable: false, visible: true },
  { id: 'loc',      label: 'Location',    width: 130, locked: false, sortable: true,  visible: true },
  { id: 'posted',     label: 'Added',            width: 78,  locked: false, sortable: true,  visible: true  },
  { id: 'hint',       label: 'Next action',      width: 240, locked: false, sortable: false, visible: true  },
  // Extended columns — hidden by default
  { id: 'job_type',   label: 'Job type',         width: 110, locked: false, sortable: true,  visible: false },
  { id: 'loc_type',   label: 'Location type',    width: 120, locked: false, sortable: true,  visible: false },
  { id: 'commute',    label: 'Commute',          width: 100, locked: false, sortable: true,  visible: false },
  { id: 'relocation', label: 'Relocation',       width: 100, locked: false, sortable: false, visible: false },
  { id: 'glassdoor',  label: 'Glassdoor',        width: 90,  locked: false, sortable: true,  visible: false },
  { id: 'indeed',     label: 'Indeed',           width: 80,  locked: false, sortable: true,  visible: false },
  { id: 'linkedin',   label: 'LinkedIn',         width: 90,  locked: false, sortable: true,  visible: false },
  { id: 'source',     label: 'Source',           width: 110, locked: false, sortable: true,  visible: false },
  { id: 'priority',   label: 'Priority',         width: 90,  locked: false, sortable: false, visible: false },
  { id: 'remarks',    label: 'Remarks',          width: 200, locked: false, sortable: false, visible: false },
];

// Minimum row width to show all columns
export function computeGridTemplate(cols) {
  return cols.filter(c => c.visible).map(c => `${c.width}px`).join(' ');
}

// Derive a formatted relative time string from an app
export function formatPosted(app) {
  const d = lastActivityDate(app);
  if (!d || d.getTime() === 0) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d';
  if (diffDays < 7) return `${diffDays}d`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(diffDays / 30);
  return `${months}mo`;
}

// Derive docs status object from app fields
export function deriveDocs(app) {
  const now = Date.now();
  const sevenDays = 7 * 86400000;

  function docState(content, updatedAt) {
    if (!content) return 'missing';
    if (updatedAt) {
      const age = now - new Date(updatedAt).getTime();
      if (age > sevenDays) return 'attention';
    }
    return 'ok';
  }

  return {
    resume: docState(app.resume_changes_summary, app.updated_at),
    cover:  docState(app.cover_letter_changes_summary || app.cover_letter, app.updated_at),
    ctx:    docState(app.company_research_summary || app.job_description, app.updated_at),
  };
}

// Derive a hint string from stage / substage
export function deriveHint(app) {
  const stage = deriveStage(app).toLowerCase();
  const sub = app.substage_progress ?? app.pipeline_substage ?? 0;

  if (stage === 'inbox')        return 'Run analysis, then move to Saved';
  if (stage === 'saved')        return sub < 3 ? 'Complete Saved-phase research' : 'Ready to generate materials';
  if (stage === 'generated')    return sub < 3 ? 'Tailor resume + cover letter' : 'Ready to submit — review before applying';
  if (stage === 'applied')      return 'Follow up if no response in 5 days';
  if (stage === 'interviewing') return 'Prepare for next interview stage';
  if (stage === 'decision')     return 'Evaluate offer / negotiate if needed';
  if (stage === 'accepted')     return 'Onboarding — confirm start date';
  return 'Review application status';
}

// Convert interest_level string to numeric weight (for sort + display)
export function interestWeight(level) {
  return { High: 3, Medium: 2, Low: 1, None: 0, '': 0 }[level || ''] || 0;
}

// Salary display: preserve "Not Listed" → "—"
export function formatSalary(value) {
  if (!value || value === 'Not Listed') return null; // null = unlisted chip
  return value;
}

// Sort comparator factory
export function makeSorter(sortBy, sortDir) {
  const asc = sortDir === 'asc' ? 1 : -1;
  return (a, b) => {
    let va, vb;
    switch (sortBy) {
      case 'company':  va = a.company || ''; vb = b.company || '';
        return asc * va.localeCompare(vb);
      case 'pipeline': va = KANBAN_COLUMNS.indexOf(deriveStage(a)); vb = KANBAN_COLUMNS.indexOf(deriveStage(b));
        return asc * (va - vb);
      case 'score':    va = a.match_score ?? -1; vb = b.match_score ?? -1;
        return asc * (va - vb);
      case 'stars':    va = interestWeight(a.interest_level); vb = interestWeight(b.interest_level);
        return asc * (va - vb);
      case 'loc':      va = a.location || ''; vb = b.location || '';
        return asc * va.localeCompare(vb);
      case 'posted':   va = lastActivityDate(a).getTime(); vb = lastActivityDate(b).getTime();
        return asc * (va - vb);
      default:         va = lastActivityDate(a).getTime(); vb = lastActivityDate(b).getTime();
        return asc * (va - vb);
    }
  };
}
