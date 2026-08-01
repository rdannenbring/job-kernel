/* global React */

// ─── JobKernel · Discover (Search & Listings) mock data ──────────
// Listings come from connected external APIs. Every result is scored
// against the user's Profile (same ScoreRing / "Affects matching"
// language used in Job Details + Profile). Fields below map onto what
// the live Discover feature already surfaces; anything net-new is
// flagged with a `// TODO: backend` note where it's used.

// ─── Connected sources (the four real integrations) ─────────────
// state: 'ok' | 'degraded' | 'down' | 'limit'  (limit = rate-limited)
window.S_SOURCES = [
  { id: 'adzuna',   label: 'Adzuna',   state: 'ok',       count: 41, latency: '0.4s' },
  { id: 'jsearch',  label: 'JSearch',  state: 'ok',       count: 33, latency: '0.7s' },
  { id: 'themuse',  label: 'TheMuse',  state: 'ok',       count: 18, latency: '0.5s' },
  { id: 'remoteok', label: 'RemoteOK', state: 'ok',       count: 12, latency: '0.3s' },
];

// Variant used by the "partial failure" state.
window.S_SOURCES_PARTIAL = [
  { id: 'adzuna',   label: 'Adzuna',   state: 'ok',       count: 41, latency: '0.4s' },
  { id: 'jsearch',  label: 'JSearch',  state: 'down',     count: 0,  latency: '—', error: 'Upstream 503 — retrying' },
  { id: 'themuse',  label: 'TheMuse',  state: 'ok',       count: 18, latency: '0.5s' },
  { id: 'remoteok', label: 'RemoteOK', state: 'limit',    count: 4,  latency: '2.1s', error: 'Rate-limited · partial' },
];

window.S_SOURCE_META = {
  adzuna:   { label: 'Adzuna',   abbr: 'Az' },
  jsearch:  { label: 'JSearch',  abbr: 'Js' },
  themuse:  { label: 'TheMuse',  abbr: 'Mu' },
  remoteok: { label: 'RemoteOK', abbr: 'Ro' },
};

// ─── Saved searches (left rail) ─────────────────────────────────
window.S_SAVED = [
  {
    id: 'all', name: 'All results', icon: 'list', kw: '', loc: '', model: 'any',
    isAll: true, count: 104, fresh: 0,
  },
  {
    id: 'eng-hybrid', name: 'Engineer · Hybrid only', icon: 'bookmark',
    kw: 'software engineer', loc: 'New York, US', model: 'hybrid',
    count: 38, fresh: 6, last: '5h ago', alerts: true, threshold: 70,
  },
  {
    id: 'staff-remote', name: 'Staff · Remote · $220k+', icon: 'bookmark',
    kw: 'staff engineer', loc: 'Remote', model: 'remote',
    count: 21, fresh: 3, last: '2h ago', alerts: true, threshold: 80,
  },
  {
    id: 'test', name: 'Test Search', icon: 'bookmark',
    kw: 'software engineer', loc: 'Stamford, CT', model: 'onsite',
    count: 0, fresh: 0, last: '5h ago', alerts: false,
  },
];

// ─── Score → band helper (reuses Job Details thresholds) ────────
window.S_BAND = (s) =>
  s >= 85 ? { id: 'strong', label: 'Strong match', cls: 'chip-green', color: 'var(--success)' }
  : s >= 70 ? { id: 'good', label: 'Good match', cls: 'chip-blue', color: 'var(--primary)' }
  : { id: 'stretch', label: 'Stretch', cls: 'chip-amber', color: 'var(--warn)' };

// Why-match breakdown dimensions (out of 20 each → 100). Mirrors the
// AnalysisContent dims in shared.jsx so the language is identical.
function whyDims(core, exp, edu, cult, ats) {
  return [
    { name: 'Core role', score: core },
    { name: 'Experience', score: exp },
    { name: 'Education', score: edu },
    { name: 'Culture', score: cult },
    { name: 'ATS keywords', score: ats },
  ];
}

// ─── Listings ───────────────────────────────────────────────────
// dedupe: when `also` is present, the same posting was returned by
// other sources and merged into one row.  // TODO: backend — merge rule
// keys on (normalized title + company + location) with fuzzy match.
window.S_JOBS = [
  {
    id: 'j01', title: 'Senior Software Engineer, Platform', co: 'Stripe', init: 'S',
    loc: 'Remote (US)', model: 'Remote', salary: '$220k–$290k',
    source: 'adzuna', also: ['jsearch', 'themuse'], posted: '2h', score: 92, stars: 0,
    excerpt: 'Build and scale the payments platform that powers millions of businesses. You will own services end-to-end across a distributed, event-driven architecture.',
    why: whyDims(19, 19, 17, 18, 19),
    whyTop: 'Strong overlap on distributed systems + Go; matches your target comp band.',
    whyGap: 'No fintech experience listed on your profile.',
    state: 'new',
  },
  {
    id: 'j02', title: 'Staff Frontend Engineer', co: 'Linear', init: 'L',
    loc: 'Remote', model: 'Remote', salary: '$210k–$260k',
    source: 'remoteok', also: ['adzuna'], posted: '4h', score: 89, stars: 0,
    excerpt: 'Craft the fastest project management tool on the planet. Obsessive about latency, keyboard-first UX, and pixel quality.',
    why: whyDims(18, 18, 18, 19, 16),
    whyTop: 'React + TypeScript depth and design-eng background line up well.',
    whyGap: 'Role wants 8+ yrs; you list 7.',
    state: 'new',
  },
  {
    id: 'j03', title: 'Engineering — New York — Associate, Software Engineering', co: 'Goldman Sachs', init: 'GS',
    loc: 'New York, US', model: 'Onsite', salary: '$132k–$186k',
    source: 'jsearch', also: [], posted: '1d', score: 71, stars: 0,
    excerpt: 'Develop, enhance, support and maintain the firm\u2019s software across multiple business divisions. Multiple positions available across the engineering org.',
    why: whyDims(15, 16, 16, 12, 12),
    whyTop: 'Backend + Java requirements match your core skills.',
    whyGap: 'Onsite NYC conflicts with your remote preference; culture fit lower.',
    state: 'new',
  },
  {
    id: 'j04', title: 'Software Engineer, Conversions API', co: 'LiveRamp', init: 'LR',
    loc: 'New York, US', model: 'Onsite', salary: 'Not Listed',
    source: 'jsearch', also: [], posted: '1d', score: 68, stars: 0,
    excerpt: 'LiveRamp is the data collaboration platform of choice for the world\u2019s most innovative companies. Join the team building privacy-first identity infrastructure.',
    why: whyDims(14, 15, 16, 13, 10),
    whyTop: 'Data-pipeline experience is relevant.',
    whyGap: 'Salary not disclosed; onsite; ATS keyword overlap is thin.',
    state: 'new',
  },
  {
    id: 'j05', title: 'Senior Control System Design Engineer', co: 'TEC Systems', init: 'TE',
    loc: 'New York, US', model: 'Onsite', salary: '$115k–$145k',
    source: 'jsearch', also: [], posted: '2d', score: 41, stars: 0,
    excerpt: 'Senior Controls Design Engineer specializing in HVAC, Building Automation and Control Systems (BAS/BMS). Reports to the VP of Engineering.',
    why: whyDims(6, 9, 12, 8, 6),
    whyTop: 'Shares the word "engineer" — little else.',
    whyGap: 'Hardware/controls domain is far from your software profile.',
    state: 'new',
  },
  {
    id: 'j06', title: 'Senior Product Engineer', co: 'Notion', init: 'N',
    loc: 'San Francisco · Hybrid', model: 'Hybrid', salary: '$200k–$270k',
    source: 'themuse', also: ['adzuna'], posted: '2d', score: 87, stars: 0,
    excerpt: 'Ship product surfaces used by tens of millions. We value engineers who think like designers and care about the smallest interaction details.',
    why: whyDims(18, 17, 17, 19, 16),
    whyTop: 'Product-minded full-stack profile is a strong culture match.',
    whyGap: 'Hybrid SF — 2 days onsite expected.',
    state: 'saved',
  },
  {
    id: 'j07', title: 'Backend Engineer, Payments Infrastructure', co: 'Mercury', init: 'Mc',
    loc: 'Remote (NA)', model: 'Remote', salary: '$190k–$245k',
    source: 'adzuna', also: ['jsearch'], posted: '3d', score: 84, stars: 0,
    excerpt: 'Banking built for startups. Join a small, high-leverage team building the ledger and money-movement systems at the core of the product.',
    why: whyDims(18, 17, 16, 17, 16),
    whyTop: 'Distributed-systems + Postgres depth match closely.',
    whyGap: 'Some ledger/accounting domain ramp expected.',
    state: 'new',
  },
  {
    id: 'j08', title: 'Founding Engineer (Full-stack)', co: 'Stealth AI', init: 'St',
    loc: 'Remote', model: 'Remote', salary: '$180k–$230k + equity',
    source: 'remoteok', also: [], posted: '3d', score: 79, stars: 0,
    excerpt: 'Early-stage, well-funded team building agentic developer tools. Wide ownership, fast iteration, and meaningful equity for the first engineers.',
    why: whyDims(17, 16, 15, 16, 15),
    whyTop: 'Generalist range + startup history is a good fit.',
    whyGap: 'Comp is equity-heavy; cash band below your target.',
    state: 'new',
  },
  {
    id: 'j09', title: 'Engineer, Front-end (US)', co: 'Code and Theory', init: 'CT',
    loc: 'New York, US', model: 'Onsite', salary: '$90k–$125k',
    source: 'jsearch', also: [], posted: '4d', score: 63, stars: 0,
    excerpt: 'Seeking a Front-End Engineer to help build AI-native digital platforms and experiences powering enterprise marketing workflows.',
    why: whyDims(14, 13, 15, 13, 12),
    whyTop: 'Front-end stack matches.',
    whyGap: 'Comp band is below your minimum; agency environment.',
    state: 'dismissed',
  },
  {
    id: 'j10', title: 'Senior Atlassian Platform Engineer', co: 'DoorDash', init: 'DD',
    loc: 'New York, US', model: 'Hybrid', salary: '$160k–$210k',
    source: 'jsearch', also: ['adzuna'], posted: '4d', score: 66, stars: 0,
    excerpt: 'Own and scale the internal developer tooling and Atlassian ecosystem supporting thousands of engineers across the company.',
    why: whyDims(13, 16, 15, 14, 12),
    whyTop: 'Platform/tooling experience is relevant.',
    whyGap: 'Heavy Atlassian-admin focus is a narrower fit.',
    state: 'new',
  },
  {
    id: 'j11', title: 'Senior Platform Engineer', co: 'Vercel', init: 'V',
    loc: 'Remote (Global)', model: 'Remote', salary: '$215k–$280k',
    source: 'remoteok', also: ['themuse', 'adzuna'], posted: '5d', score: 90, stars: 0,
    excerpt: 'Build the platform that ships the web. Work on edge infrastructure, build pipelines, and developer experience at massive scale.',
    why: whyDims(19, 18, 17, 18, 18),
    whyTop: 'Edge/infra + DX background is an excellent fit; remote-global.',
    whyGap: 'On-call rotation expected.',
    state: 'new',
  },
  {
    id: 'j12', title: 'Senior Software Engineer, ML Platform', co: 'Ramp', init: 'R',
    loc: 'New York · Hybrid', model: 'Hybrid', salary: '$230k–$300k',
    source: 'adzuna', also: ['jsearch'], posted: '6d', score: 81, stars: 0,
    excerpt: 'Build the ML infrastructure powering spend intelligence. Partner with applied scientists to take models from notebook to production.',
    why: whyDims(17, 17, 16, 16, 15),
    whyTop: 'Infra + data-platform skills transfer well.',
    whyGap: 'ML-platform specifics are a ramp; hybrid NYC.',
    state: 'new',
  },
];

// Profile context surfaced in the "why match" + threshold copy.
window.S_PROFILE = {
  avg: 78,                 // user's average match score across results
  readiness: 82,           // profile readiness %
  targetComp: '$200k+',
  targetModel: 'Remote / Hybrid',
};

Object.assign(window, {});
