export const KANBAN_COLUMNS = [
  'Inbox',
  'Saved',
  'Generated',
  'Applied',
  'Interviewing',
  'Decision',
  'Accepted',
];

export const TERMINAL_COLUMNS = ['Rejected', 'Declined', 'Withdrawn'];

export const SUBSTAGE_COUNTS = {
  Inbox: 0,
  Saved: 5,
  Generated: 4,
  Applied: 4,
  Interviewing: 5,
  Decision: 5,
  Accepted: 5,
  Rejected: 0,
  Declined: 0,
  Withdrawn: 0,
};

export const STAGE_ICONS = {
  Inbox: 'inbox',
  Saved: 'bookmark',
  Generated: 'auto_awesome',
  Applied: 'send',
  Interviewing: 'forum',
  Decision: 'gavel',
  Accepted: 'verified',
  Rejected: 'block',
  Declined: 'cancel',
  Withdrawn: 'undo',
};

export const EMPTY_STATE_COPY = {
  Inbox:        { icon: 'inbox',           title: 'No new captures',       body: 'Use the browser extension to scrape jobs directly into your inbox.',              cta: 'Install extension' },
  Saved:        { icon: 'bookmark_border', title: 'Nothing saved yet',      body: 'Drop interesting jobs here from your inbox to start research.',                   cta: null },
  Generated:    { icon: 'auto_awesome',    title: 'No materials drafted',   body: 'Move a saved job here to generate tailored resume + cover letter.',               cta: null },
  Applied:      { icon: 'send',            title: 'No applications sent',   body: 'Once you submit, drag the card here to start tracking responses.',                cta: null },
  Interviewing: { icon: 'forum',           title: 'No active interviews',   body: 'Cards arrive here when recruiters reach out or you book a screen.',               cta: null },
  Decision:     { icon: 'gavel',           title: 'No offers in flight',    body: 'Cards land here when an offer comes in or final-round happens.',                  cta: null },
  Accepted:     { icon: 'verified',        title: 'Nothing accepted yet',   body: 'When you sign, the role moves here for onboarding tracking.',                     cta: null },
};

// Inbox is a derived state — no backend enum value yet.
// TODO: Add 'Inbox' as a real backend status enum value in a follow-up.
export function deriveStage(app) {
  const isUnanalyzed =
    (app.match_score == null) &&
    !app.resume_changes_summary &&
    (!app.status || app.status === 'Saved');
  if (isUnanalyzed) return 'Inbox';
  return getStatusText(app);
}

export function getStatusText(app) {
  const stage = (app.pipeline_stage || '').toLowerCase();
  const status = (app.status || '').toLowerCase();
  const s = stage || status;
  if (!s) return 'Saved';
  if (s === 'saved' || s.includes('saved')) return 'Saved';
  if (s === 'generated' || s.includes('generated')) return 'Generated';
  if (s === 'applied' || s.includes('applied')) return 'Applied';
  if (s === 'interviewing' || s.includes('interview')) return 'Interviewing';
  if (s === 'decision' || s.includes('decision')) return 'Decision';
  if (s === 'accepted' || s.includes('accepted') || s.includes('offered')) return 'Accepted';
  if (s === 'rejected' || s.includes('reject')) return 'Rejected';
  if (s === 'declined' || s.includes('declin')) return 'Declined';
  if (s === 'withdrawn' || s.includes('withdraw') || s.includes('cancel')) return 'Withdrawn';
  return 'Saved';
}

export function stageIndex(stage) {
  const idx = KANBAN_COLUMNS.indexOf(stage);
  if (idx !== -1) return idx;
  // Terminal stages come after all active stages
  return KANBAN_COLUMNS.length + TERMINAL_COLUMNS.indexOf(stage);
}

export function isTerminal(stage) {
  return TERMINAL_COLUMNS.includes(stage);
}

export function isForward(fromStage, toStage) {
  if (isTerminal(toStage)) return false;
  return stageIndex(toStage) > stageIndex(fromStage);
}

export function isBack(fromStage, toStage) {
  if (isTerminal(toStage)) return false;
  return stageIndex(toStage) < stageIndex(fromStage);
}

// Score chip tint: green ≥85, blue 70-84, amber <70
export function getScoreTint(score) {
  if (score == null) return { cls: 'chip-neutral', color: 'var(--text-muted)' };
  if (score >= 85) return { cls: 'chip-green', color: 'var(--success)' };
  if (score >= 70) return { cls: 'chip-blue', color: 'var(--primary)' };
  return { cls: 'chip-amber', color: 'var(--warning)' };
}

// Last-activity date for sort: most recent of last_activity_at, updated_at, date_saved
export function lastActivityDate(app) {
  const candidates = [app.last_activity_at, app.updated_at, app.date_saved]
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d));
  if (candidates.length === 0) return new Date(0);
  return new Date(Math.max(...candidates));
}
