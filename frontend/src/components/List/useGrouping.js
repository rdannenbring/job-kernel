import { useMemo } from 'react';
import { deriveStage, lastActivityDate, KANBAN_COLUMNS, TERMINAL_COLUMNS, STAGE_ICONS } from '../Kanban/stages.js';
import { interestWeight } from './columns.js';

export const GROUPINGS = [
  { id: 'flat',       label: 'No grouping',   icon: 'horizontal_rule' },
  { id: 'urgency',    label: 'Urgency',        icon: 'bolt' },
  { id: 'stage',      label: 'Stage',          icon: 'route' },
  { id: 'interest',   label: 'Interest',       icon: 'star' },
  { id: 'location',   label: 'Location',       icon: 'location_on' },
  { id: 'nextaction', label: 'Next action',    icon: 'task_alt' },
  { id: 'source',     label: 'Source',         icon: 'public' },
];

// Derive urgency bucket from app fields
export function urgencyOf(app) {
  const stage = deriveStage(app).toLowerCase();
  if (TERMINAL_COLUMNS.map(s => s.toLowerCase()).includes(stage)) return 'closed';

  const lastAct = lastActivityDate(app);
  const daysSince = (Date.now() - lastAct.getTime()) / 86400000;

  // Overdue: applied/interviewing with no activity > 7d
  if (['applied', 'interviewing'].includes(stage) && daysSince > 7) return 'overdue';

  // Awaiting: applied/interviewing/decision and not overdue
  if (['applied', 'interviewing', 'decision'].includes(stage)) return 'awaiting';

  // Today / this week: inbox/saved/generated (user's move)
  if (['inbox', 'saved', 'generated'].includes(stage)) {
    return daysSince < 1 ? 'today' : 'week';
  }

  // Accepted
  return 'awaiting';
}

function locationKey(loc) {
  if (!loc) return 'Other';
  const s = loc.toLowerCase();
  if (s.includes('remote')) return 'Remote';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('new york') || s.includes('nyc')) return 'New York';
  if (s.includes('san francisco') || s.includes('bay area') || s.includes('menlo') || s.includes('mountain view')) return 'Bay Area';
  if (s.includes('chicago')) return 'Chicago';
  if (s.includes('seattle')) return 'Seattle';
  if (s.includes('austin')) return 'Austin';
  if (s.includes('boston')) return 'Boston';
  return 'Other';
}

function nextActionKey(hint) {
  if (!hint) return 'Other';
  const h = hint.toLowerCase();
  if (h.includes('analysis') || h.includes('run analysis')) return 'Analyze posting';
  if (h.includes('research'))  return 'Research company';
  if (h.includes('tailor'))    return 'Tailor resume';
  if (h.includes('cover'))     return 'Write cover letter';
  if (h.includes('generate'))  return 'Generate materials';
  if (h.includes('ready to') || h.includes('review')) return 'Ready to submit';
  if (h.includes('submit'))    return 'Submit application';
  if (h.includes('follow'))    return 'Follow up';
  if (h.includes('prep'))      return 'Interview prep';
  if (h.includes('negotiat') || h.includes('offer')) return 'Decision / Negotiate';
  if (h.includes('onboarding') || h.includes('start')) return 'Onboarding';
  return 'Other';
}

function sourceKey(app) {
  if (app.source) return app.source;
  if (app.job_url) {
    try { return new URL(app.job_url).hostname.replace(/^www\./, ''); } catch {}
  }
  return 'Manual entry';
}

export function useGrouping(apps, groupBy, hideClosed, deriveHintFn) {
  return useMemo(() => {
    let filtered = apps;
    if (hideClosed) {
      filtered = apps.filter(a => !TERMINAL_COLUMNS.includes(deriveStage(a)));
    }

    if (groupBy === 'flat') {
      return [{ id: '_flat', kind: null, label: null, apps: filtered }];
    }

    const buckets = new Map();
    const add = (key, app) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(app);
    };

    if (groupBy === 'urgency') {
      for (const a of filtered) add(urgencyOf(a), a);
      const META = {
        overdue:  { label: 'Overdue',           kind: 'overdue',  sub: 'Follow-ups past due' },
        today:    { label: 'Today',             kind: 'now',      sub: 'Apps waiting on your move' },
        week:     { label: 'This week',         kind: 'week',     sub: null },
        awaiting: { label: 'Awaiting response', kind: 'awaiting', sub: 'Their move — no action needed' },
        closed:   { label: 'Closed',            kind: 'closed',   sub: 'Rejected · declined · withdrawn' },
      };
      return ['overdue', 'today', 'week', 'awaiting', 'closed']
        .filter(k => buckets.has(k))
        .map(k => ({ id: k, apps: buckets.get(k), ...META[k] }));
    }

    if (groupBy === 'stage') {
      for (const a of filtered) add(deriveStage(a), a);
      const allStages = [...KANBAN_COLUMNS, ...TERMINAL_COLUMNS];
      return allStages
        .filter(s => buckets.has(s))
        .map(s => ({
          id: s.toLowerCase(),
          label: s,
          kind: TERMINAL_COLUMNS.includes(s) ? 'closed' : 'week',
          sub: null,
          icon: STAGE_ICONS[s],
          apps: buckets.get(s),
        }));
    }

    if (groupBy === 'interest') {
      for (const a of filtered) add(interestWeight(a.interest_level), a);
      const LABELS = { 3: '★★★ High', 2: '★★☆ Medium', 1: '★☆☆ Low', 0: 'No interest set' };
      return [3, 2, 1, 0]
        .filter(n => buckets.has(n))
        .map(n => ({ id: `i${n}`, label: LABELS[n], kind: n >= 2 ? 'now' : null, sub: null, apps: buckets.get(n) }));
    }

    if (groupBy === 'location') {
      for (const a of filtered) add(locationKey(a.location), a);
      const ORDER = ['Remote', 'Hybrid', 'New York', 'Bay Area', 'Chicago', 'Seattle', 'Austin', 'Boston', 'Other'];
      return ORDER
        .filter(k => buckets.has(k))
        .map(k => ({ id: `l-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k) }));
    }

    if (groupBy === 'nextaction') {
      for (const a of filtered) add(nextActionKey(deriveHintFn(a)), a);
      const ORDER = ['Follow up', 'Decision / Negotiate', 'Tailor resume', 'Generate materials',
        'Submit application', 'Interview prep', 'Analyze posting', 'Research company',
        'Ready to submit', 'Write cover letter', 'Onboarding', 'Other'];
      return ORDER
        .filter(k => buckets.has(k))
        .map(k => ({ id: `h-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k) }));
    }

    if (groupBy === 'source') {
      for (const a of filtered) add(sourceKey(a), a);
      return [...buckets.keys()].sort().map(k => ({
        id: `s-${k}`, label: k, kind: null, sub: null, apps: buckets.get(k),
      }));
    }

    return [{ id: '_flat', kind: null, label: null, apps: filtered }];
  }, [apps, groupBy, hideClosed, deriveHintFn]);
}
