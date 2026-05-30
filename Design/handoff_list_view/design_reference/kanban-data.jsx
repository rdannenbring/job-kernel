/* global React */

// ─── Kanban mock data ────────────────────────────────────────────
// 28 applications distributed across active stages + end-states.
// All fields map onto what the live app already surfaces in Job Details.
// Stage IDs match window.STAGES from shared.jsx; "inbox" is the optional
// pre-Saved column for newly-scraped extension captures.

window.K_STAGES = [
  { id: 'inbox',        label: 'Inbox',        icon: 'inbox',         subCount: 0, kind: 'pre' },
  { id: 'saved',        label: 'Saved',        icon: 'bookmark',      subCount: 5, kind: 'active' },
  { id: 'generated',    label: 'Generated',    icon: 'auto_awesome',  subCount: 4, kind: 'active' },
  { id: 'applied',      label: 'Applied',      icon: 'send',          subCount: 4, kind: 'active' },
  { id: 'interviewing', label: 'Interviewing', icon: 'forum',         subCount: 5, kind: 'active' },
  { id: 'decision',     label: 'Decision',     icon: 'gavel',         subCount: 5, kind: 'active' },
  { id: 'accepted',     label: 'Accepted',     icon: 'verified',      subCount: 5, kind: 'active' },
];

window.K_END_STAGES = [
  { id: 'rejected',  label: 'Rejected',  icon: 'block' },
  { id: 'declined',  label: 'Declined',  icon: 'do_not_disturb_on' },
  { id: 'withdrawn', label: 'Withdrawn', icon: 'cancel' },
];

window.K_STAGE_INDEX = Object.fromEntries(
  [...window.K_STAGES, ...window.K_END_STAGES].map((s, i) => [s.id, i])
);

// ─── Substage labels per stage (compressed from the real model) ──
window.K_SUBSTAGES = {
  saved:        ['Analysis', 'Reviewed', 'Network', 'Research', 'Prioritize'],
  generated:    ['Resume', 'Cover Letter', 'Tailoring', 'QA'],
  applied:      ['Submitted', 'Confirmation', 'ATS Pass', 'Recruiter Reach'],
  interviewing: ['Screen', 'Tech 1', 'Tech 2', 'Onsite', 'Debrief'],
  decision:     ['Offer Pending', 'Negotiation', 'References', 'Background', 'Sign'],
  accepted:     ['Offer Signed', 'Start Date', 'Onboarding', 'Equipment', 'Day 1'],
};

// ─── Mock applications ────────────────────────────────────────────
window.K_APPS = [
  // Inbox — fresh captures from the extension, not yet triaged
  { id: 'a01', co: 'Stripe',     init: 'S',   role: 'Staff Software Engineer, Payments', loc: 'Remote (US)', salary: '$240k–$310k', score: 91, stars: 0, posted: '1d', source: 'LinkedIn', stage: 'inbox', sub: 0, docs: { resume: 'missing', cover: 'missing', ctx: 'ok' }, hint: 'Run analysis' },
  { id: 'a02', co: 'Anthropic',  init: 'A',   role: 'Senior Product Engineer',          loc: 'San Francisco',      salary: '$220k–$310k', score: 88, stars: 0, posted: '2d', source: 'Careers',  stage: 'inbox', sub: 0, docs: { resume: 'missing', cover: 'missing', ctx: 'missing' }, hint: 'Run analysis' },
  { id: 'a03', co: 'Datadog',    init: 'D',   role: 'Principal Engineer, APM',          loc: 'NYC · Hybrid',       salary: '—',           score: 74, stars: 0, posted: '3d', source: 'LinkedIn', stage: 'inbox', sub: 0, docs: { resume: 'missing', cover: 'missing', ctx: 'missing' }, hint: 'Run analysis' },

  // Saved — researching / deciding to commit
  { id: 'a04', co: 'PRI Technology', init: 'PRI', role: 'Senior Lead Software Architect', loc: 'United States · Remote', salary: 'Not Listed', score: 86, stars: 0, posted: '5d', source: 'LinkedIn', stage: 'saved', sub: 4, docs: { resume: 'attention', cover: 'missing', ctx: 'ok' }, hint: 'Decide to generate' },
  { id: 'a05', co: 'Figma',          init: 'F',   role: 'Engineering Manager, Platform', loc: 'San Francisco', salary: '$280k–$360k', score: 89, stars: 2, posted: '4d', source: 'Referral', stage: 'saved', sub: 3, docs: { resume: 'attention', cover: 'missing', ctx: 'ok' }, hint: 'Run research' },
  { id: 'a06', co: 'Linear',         init: 'L',   role: 'Senior Frontend Engineer',      loc: 'Remote',        salary: '$190k–$240k', score: 84, stars: 3, posted: '6d', source: 'Careers',  stage: 'saved', sub: 2, docs: { resume: 'missing', cover: 'missing', ctx: 'missing' }, hint: 'Tailor resume' },
  { id: 'a07', co: 'Shopify',        init: 'Sh',  role: 'Staff Engineer, Checkout',      loc: 'Remote (NA)',   salary: '$215k–$275k', score: 78, stars: 1, posted: '8d', source: 'LinkedIn', stage: 'saved', sub: 1, docs: { resume: 'missing', cover: 'missing', ctx: 'missing' }, hint: 'Review listing' },
  { id: 'a08', co: 'Mercury',        init: 'Mc',  role: 'Senior Software Engineer',      loc: 'Remote',        salary: '$200k–$260k', score: 81, stars: 2, posted: '2w', source: 'Referral', stage: 'saved', sub: 5, docs: { resume: 'ok', cover: 'attention', ctx: 'ok' }, hint: 'Ready to generate' },
  { id: 'a09', co: 'Vercel',         init: 'V',   role: 'Principal Platform Engineer',   loc: 'Remote (Global)', salary: '$240k–$300k', score: 87, stars: 3, posted: '1w', source: 'Careers',  stage: 'saved', sub: 3, docs: { resume: 'attention', cover: 'missing', ctx: 'ok' }, hint: 'Find network contacts' },

  // Generated — application materials produced
  { id: 'a10', co: 'Notion',     init: 'N',   role: 'Senior Engineer, AI Surfaces',  loc: 'San Francisco', salary: '$210k–$280k', score: 85, stars: 2, posted: '4d', source: 'LinkedIn', stage: 'generated', sub: 3, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Submit application' },
  { id: 'a11', co: 'Ramp',       init: 'R',   role: 'Staff Engineer, Spend Mgmt',    loc: 'NYC',         salary: '$240k–$310k', score: 90, stars: 3, posted: '6d', source: 'Referral', stage: 'generated', sub: 4, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Ready to submit' },
  { id: 'a12', co: 'Plaid',      init: 'P',   role: 'Senior Backend Engineer',       loc: 'Remote (US)', salary: '$200k–$255k', score: 82, stars: 1, posted: '5d', source: 'LinkedIn', stage: 'generated', sub: 2, docs: { resume: 'ok', cover: 'attention', ctx: 'ok' }, hint: 'Polish cover letter' },
  { id: 'a13', co: 'Brex',       init: 'B',   role: 'Engineering Manager',           loc: 'Remote',      salary: '$260k–$330k', score: 79, stars: 2, posted: '1w', source: 'LinkedIn', stage: 'generated', sub: 1, docs: { resume: 'ok', cover: 'missing', ctx: 'ok' }, hint: 'Draft cover letter' },

  // Applied — submitted, awaiting response
  { id: 'a14', co: 'Airtable',   init: 'At',  role: 'Senior Software Engineer',      loc: 'Remote',      salary: '$195k–$245k', score: 83, stars: 2, posted: '2w', source: 'Careers',  stage: 'applied', sub: 3, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Follow up · day 6' },
  { id: 'a15', co: 'Retool',     init: 'Re',  role: 'Founding Engineer, AI',         loc: 'SF · Hybrid', salary: '$240k–$320k', score: 88, stars: 3, posted: '10d', source: 'Referral', stage: 'applied', sub: 4, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Recruiter reached out' },
  { id: 'a16', co: 'Webflow',    init: 'W',   role: 'Staff Engineer, Designer',      loc: 'Remote',      salary: '$215k–$265k', score: 76, stars: 1, posted: '3w', source: 'LinkedIn', stage: 'applied', sub: 2, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'No response yet' },
  { id: 'a17', co: 'Pinecone',   init: 'Pn',  role: 'Senior Platform Engineer',      loc: 'NYC',         salary: '$210k–$270k', score: 80, stars: 2, posted: '2w', source: 'Careers',  stage: 'applied', sub: 2, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'ATS confirmed' },
  { id: 'a18', co: 'Supabase',   init: 'Sp',  role: 'Engineering Lead, Postgres',    loc: 'Remote (EU)', salary: '$200k–$260k', score: 84, stars: 2, posted: '1w', source: 'Referral', stage: 'applied', sub: 3, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Recruiter screen scheduled' },

  // Interviewing — active conversations
  { id: 'a19', co: 'Stripe',     init: 'S',   role: 'Engineering Manager, Issuing',  loc: 'SF · Hybrid', salary: '$295k–$380k', score: 92, stars: 3, posted: '3w', source: 'Referral', stage: 'interviewing', sub: 3, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Onsite Thu' },
  { id: 'a20', co: 'OpenAI',     init: 'O',   role: 'Member of Technical Staff',     loc: 'San Francisco', salary: '$310k–$420k', score: 94, stars: 3, posted: '4w', source: 'Referral', stage: 'interviewing', sub: 2, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Tech 2 prep' },
  { id: 'a21', co: 'Coinbase',   init: 'C',   role: 'Senior Engineer, Wallet',       loc: 'Remote',      salary: '$220k–$280k', score: 77, stars: 1, posted: '3w', source: 'LinkedIn', stage: 'interviewing', sub: 1, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Awaiting screen feedback' },

  // Decision
  { id: 'a22', co: 'Cloudflare', init: 'Cf',  role: 'Principal Engineer, Workers',   loc: 'Remote',      salary: '$270k–$340k', score: 89, stars: 3, posted: '6w', source: 'Referral', stage: 'decision', sub: 2, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Negotiating equity' },
  { id: 'a23', co: 'Render',     init: 'Rn',  role: 'Senior Software Engineer',      loc: 'Remote (US)', salary: '$205k–$255k', score: 81, stars: 2, posted: '5w', source: 'Careers',  stage: 'decision', sub: 1, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Verbal offer · written pending' },

  // Accepted
  { id: 'a24', co: 'Anthropic',  init: 'A',   role: 'Research Engineer, Alignment',  loc: 'San Francisco', salary: '$340k–$420k', score: 95, stars: 3, posted: '8w', source: 'Referral', stage: 'accepted', sub: 4, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Onboarding · start 6/15' },

  // End states
  { id: 'a25', co: 'Meta',       init: 'M',   role: 'E6 Software Engineer',          loc: 'Menlo Park',  salary: '$280k–$360k', score: 85, stars: 2, posted: '5w', source: 'LinkedIn', stage: 'rejected', sub: 0, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'After tech 2 · 4 weeks ago' },
  { id: 'a26', co: 'Google',     init: 'G',   role: 'L6 Staff Engineer',             loc: 'Mountain View', salary: '$290k–$380k', score: 88, stars: 2, posted: '6w', source: 'LinkedIn', stage: 'rejected', sub: 0, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'No interview' },
  { id: 'a27', co: 'Discord',    init: 'Dc',  role: 'Senior Engineer, Voice',        loc: 'Remote',      salary: '$210k–$270k', score: 79, stars: 1, posted: '4w', source: 'Careers',  stage: 'declined', sub: 0, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Comp below range' },
  { id: 'a28', co: 'Spotify',    init: 'Sp',  role: 'Backend Engineer',              loc: 'Stockholm',   salary: '€95k–€130k',  score: 70, stars: 0, posted: '3w', source: 'LinkedIn', stage: 'withdrawn', sub: 0, docs: { resume: 'ok', cover: 'ok', ctx: 'ok' }, hint: 'Withdrew · location' },
];

// Group helper
window.K_BY_STAGE = (apps = window.K_APPS) => {
  const out = {};
  for (const s of [...window.K_STAGES, ...window.K_END_STAGES]) out[s.id] = [];
  for (const a of apps) (out[a.stage] = out[a.stage] || []).push(a);
  return out;
};

window.K_DOC_TINT = {
  ok:        { color: 'var(--success)', soft: 'var(--success-soft)' },
  attention: { color: 'var(--warn)',    soft: 'var(--warn-soft)'    },
  missing:   { color: 'var(--danger)',  soft: 'var(--danger-soft)'  },
};

// Score colour mapping — same buckets as ScoreRing
window.K_SCORE_TINT = (s) => s >= 85 ? { c: 'var(--success)', soft: 'var(--success-soft)', cls: 'chip-green' }
                            : s >= 70 ? { c: 'var(--primary)', soft: 'var(--primary-soft)', cls: 'chip-blue'  }
                            :           { c: 'var(--warn)',    soft: 'var(--warn-soft)',    cls: 'chip-amber' };
