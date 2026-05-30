import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePhotoModal from '../components/ProfilePhotoModal';
import './Profile.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Rail section registry — used by rail nav + command palette
const RAIL_SECTIONS = [
  { id: 'identity',     label: 'Identity',      icon: 'person',      affectsMatching: false },
  { id: 'match',        label: 'Match profile',  icon: 'auto_awesome', affectsMatching: true,  matchScore: 86 },
  { id: 'ai',           label: 'AI generation',  icon: 'neurology',   affectsMatching: false },
  { id: 'documents',    label: 'Documents',      icon: 'folder',      affectsMatching: false, attention: 1 },
  { id: 'integrations', label: 'Integrations',   icon: 'link',        affectsMatching: false },
  { id: 'account',      label: 'Account',        icon: 'credit_card', affectsMatching: false },
];

// Content sections (includes 'skills' which maps to 'match' in the rail)
const CONTENT_SECTION_IDS = ['identity', 'match', 'skills', 'ai', 'documents', 'integrations', 'account'];

// Command palette field registry (field label → section id, optionally affectsMatching, searchTerms)
const PALETTE_FIELDS = [
  { label: 'Display name',         section: 'identity',  terms: ['name', 'display name'] },
  { label: 'Headline',             section: 'identity',  terms: ['headline', 'title', 'job title'] },
  { label: 'Email',                section: 'identity',  terms: ['email', 'contact'] },
  { label: 'Phone',                section: 'identity',  terms: ['phone', 'mobile'] },
  { label: 'Location',             section: 'identity',  terms: ['location', 'city', 'address'], affectsMatching: true },
  { label: 'Work authorization',   section: 'identity',  terms: ['work auth', 'visa', 'citizenship'], affectsMatching: true },
  { label: 'Bio / summary',        section: 'identity',  terms: ['bio', 'summary', 'about'] },
  { label: 'LinkedIn',             section: 'identity',  terms: ['linkedin', 'links'] },
  { label: 'GitHub',               section: 'identity',  terms: ['github', 'links'] },
  { label: 'Portfolio',            section: 'identity',  terms: ['portfolio', 'website', 'links'] },
  { label: 'Target roles',         section: 'match',     terms: ['roles', 'job titles', 'target'], affectsMatching: true },
  { label: 'Seniority',            section: 'match',     terms: ['seniority', 'level', 'senior'], affectsMatching: true },
  { label: 'Years of experience',  section: 'match',     terms: ['experience', 'years', 'tenure'], affectsMatching: true },
  { label: 'Remote / hybrid',      section: 'match',     terms: ['remote', 'hybrid', 'work setting'], affectsMatching: true },
  { label: 'Relocation',           section: 'match',     terms: ['relocation', 'relocate', 'move'], affectsMatching: true },
  { label: 'Compensation',         section: 'match',     terms: ['salary', 'comp', 'pay', 'compensation', 'money'], affectsMatching: true },
  { label: 'Skills',               section: 'skills',    terms: ['skills', 'expertise', 'technologies'], affectsMatching: true },
  { label: 'Tone (Casual↔Formal)', section: 'ai',        terms: ['tone', 'formal', 'casual', 'style'] },
  { label: 'Tone (Concise↔Detailed)', section: 'ai',     terms: ['detail', 'verbose', 'concise'] },
  { label: 'Voice samples',        section: 'ai',        terms: ['voice', 'samples', 'writing style'] },
  { label: 'Things to avoid',      section: 'ai',        terms: ['avoid', 'banned', 'words', 'phrases'] },
  { label: 'Master resume',        section: 'documents', terms: ['resume', 'cv', 'default resume'] },
  { label: 'Cover letter',         section: 'documents', terms: ['cover letter', 'cl', 'default cover'] },
  { label: 'Documents',            section: 'documents', terms: ['docs', 'files', 'uploads'] },
  { label: 'Integrations',         section: 'integrations', terms: ['linkedin', 'gmail', 'calendar', 'connect'] },
  { label: 'Plan & billing',       section: 'account',   terms: ['plan', 'billing', 'subscription', 'pro'] },
  { label: 'Email digests',        section: 'account',   terms: ['digest', 'notifications', 'email'] },
  { label: 'Quiet hours',          section: 'account',   terms: ['quiet', 'hours', 'notifications'] },
  { label: 'Export data',          section: 'account',   terms: ['export', 'data', 'download'] },
  { label: 'Delete account',       section: 'account',   terms: ['delete', 'account', 'danger'] },
];

// Quick wins data — mirrors computeCompleteness weights
const QUICK_WINS = [
  { key: 'resume',      label: 'Upload your master resume',           section: 'documents', focusKey: null,            impact: 15, done: (d) => !!d.base_resume_path },
  { key: 'name',        label: 'Add your full name',                  section: 'identity',  focusKey: 'first_name',    impact: 10, done: (d) => !!(d.first_name && d.last_name) },
  { key: 'skills',      label: 'Add 5+ skills',                       section: 'skills',    focusKey: 'skill-add',     impact: 10, done: (d) => (d.skills || []).length >= 5 },
  { key: 'bio',         label: 'Write a short bio',                   section: 'identity',  focusKey: 'bio',           impact: 8,  done: (d) => !!d.bio },
  { key: 'targetRoles', label: 'Set target roles',                    section: 'match',     focusKey: 'target_roles',  impact: 8,  done: (d) => (d.preferences?.target_roles || []).length > 0 },
  { key: 'salary',      label: 'Set expected compensation',           section: 'match',     focusKey: 'expected_salary', impact: 7, done: (d) => !!d.preferences?.expected_salary },
  { key: 'workSetting', label: 'Set work preference (remote/hybrid)', section: 'match',     focusKey: 'work_setting',  impact: 5,  done: (d) => !!d.preferences?.work_setting },
  { key: 'location',    label: 'Add your location',                   section: 'identity',  focusKey: 'city',          impact: 5,  done: (d) => !!d.city },
  { key: 'email',       label: 'Confirm your email',                  section: 'identity',  focusKey: 'email',         impact: 5,  done: (d) => !!d.email },
  { key: 'linkedin',    label: 'Add LinkedIn URL',                    section: 'identity',  focusKey: 'linkedin_url',  impact: 5,  done: (d) => !!d.linkedin_url },
];

const FIRST_RUN_THRESHOLD = 20; // % completeness below which first-run extras appear

const MOCK_INTEGRATIONS = [
  { id: 'linkedin',   name: 'LinkedIn',         initials: 'in', state: 'connected',    sub: 'Posts, 1st/2nd-degree contacts, profile sync · since Apr 12' },
  { id: 'gmail',      name: 'Gmail',            initials: 'M',  state: 'connected',    sub: 'Outreach replies · 142 threads tracked' },
  { id: 'calendar',   name: 'Google Calendar',  initials: 'C',  state: 'disconnected', sub: 'Auto-schedule interview prep blocks' },
  { id: 'greenhouse', name: 'Greenhouse ATS',   initials: 'GH', state: 'disconnected', sub: 'Application status sync' },
  { id: 'extension',  name: 'Browser Extension',initials: 'JK', state: 'connecting',   sub: 'Capture jobs from LinkedIn, Indeed, Otta with one click' },
];

// ─── Utility functions ───────────────────────────────────────

function getInitials(first, last) {
  return `${(first || '').charAt(0).toUpperCase()}${(last || '').charAt(0).toUpperCase()}`;
}

function computeCompleteness(data) {
  let pts = 0;
  if (data.first_name && data.last_name) pts += 10;
  if (data.email) pts += 5;
  if (data.phone_primary) pts += 5;
  if (data.city) pts += 5;
  if (data.job_title) pts += 5;
  if (data.bio) pts += 8;
  if (data.base_resume_path) pts += 15;
  if ((data.skills || []).length >= 5) pts += 10;
  if (data.linkedin_url) pts += 5;
  if ((data.preferences?.target_roles || []).length > 0) pts += 8;
  if (data.preferences?.expected_salary) pts += 7;
  if (data.preferences?.work_setting) pts += 5;
  if ((data.preferences?.skill_weights || null)) pts += 3;
  return Math.min(pts, 100);
}

function getSkillWeight(prefs, skillName) {
  return (prefs?.skill_weights || {})[skillName] || 1;
}

function buildDocs(formData) {
  const docs = [];
  if (formData.base_resume_path) docs.push({
    id: 'base-resume', name: 'Master Resume', kind: 'resume',
    state: 'ok', isDefault: true, updated: 'on file', usedOn: 0, sizeHint: 'PDF',
  });
  if (formData.long_form_resume_path) docs.push({
    id: 'long-resume', name: 'Long-form Resume', kind: 'resume',
    state: 'ok', isDefault: false, updated: 'on file', usedOn: 0, sizeHint: 'PDF',
  });
  if (formData.example_cover_letter_path) docs.push({
    id: 'base-cover', name: 'Base Cover Letter', kind: 'cover',
    state: 'ok', isDefault: true, updated: 'on file', usedOn: 0, sizeHint: 'DOCX',
  });
  (formData.additional_docs || []).forEach((d, i) => {
    docs.push({
      id: `add-${i}`, name: d.label || d.filename || `Document ${i+1}`, kind: 'context',
      state: 'ok', isDefault: false, updated: 'on file', usedOn: 0, sizeHint: d.filename || '',
    });
  });
  return docs;
}

// Scroll to a section using the main container, avoiding scrollIntoView
function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  const container = document.querySelector('main');
  if (!el || !container) return;
  const elTop = el.getBoundingClientRect().top;
  const containerTop = container.getBoundingClientRect().top;
  const offset = elTop - containerTop + container.scrollTop - 72;
  container.scrollTo({ top: offset, behavior: 'smooth' });
}

// Fuzzy search: true if query chars appear in str in order (case-insensitive)
function fuzzyMatch(query, str) {
  const q = query.toLowerCase();
  const s = str.toLowerCase();
  if (s.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─── Icon ───────────────────────────────────────────────────
function Icon({ name, size = 20, fill = false, style, className }) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ''}`}
      style={{
        fontSize: size,
        fontVariationSettings: fill ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400",
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

// ─── ScoreRing ──────────────────────────────────────────────
function ScoreRing({ score = 0, size = 40 }) {
  const sw = 3;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 100) / 100);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--primary)" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ─── ScoreDelta ─────────────────────────────────────────────
function ScoreDelta({ delta }) {
  if (!delta) return null;
  return (
    <span className={`score-delta${delta < 0 ? ' is-down' : ''} score-pop`}>
      <Icon name={delta < 0 ? 'arrow_downward' : 'arrow_upward'} size={10} />
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

// ─── MatchChip ──────────────────────────────────────────────
function MatchChip({ tiny = false }) {
  return (
    <span className={`match-chip${tiny ? ' is-tiny' : ''}`}>
      <Icon name="auto_awesome" size={tiny ? 9 : 10} fill />
      Affects matching
    </span>
  );
}

// ─── PBand ──────────────────────────────────────────────────
function PBand({ icon, label, count, kind }) {
  return (
    <div className={`p-band${kind === 'match' ? ' is-match' : ''}`}>
      <Icon name={icon} size={12} fill={kind === 'match'} />
      {label}
      {count != null && <span className="p-band-count">{count}</span>}
    </div>
  );
}

// ─── PSection ───────────────────────────────────────────────
function PSection({ id, icon, title, sub, actions, affectsMatching, children }) {
  return (
    <section id={id} className="p-section">
      <header className="p-section-head">
        <div className="p-section-icon"><Icon name={icon} size={16} /></div>
        <div className="p-section-text">
          <div className="p-section-title">
            {title}
            {affectsMatching && <MatchChip />}
          </div>
          {sub && <div className="p-section-sub">{sub}</div>}
        </div>
        {actions && <div className="p-section-actions">{actions}</div>}
      </header>
      <div className="p-section-body">{children}</div>
    </section>
  );
}

// ─── PField (read mode) ─────────────────────────────────────
function PField({ label, value, affectsMatching, multi, children }) {
  return (
    <div className="p-field">
      <div className="p-field-label">
        {label}
        {affectsMatching && <MatchChip tiny />}
      </div>
      <div className={`p-field-value${multi ? ' is-multi' : ''}`}>
        {children || (value ? <span>{value}</span> : <span className="is-muted">Not set</span>)}
      </div>
    </div>
  );
}

// ─── PFieldEdit (edit mode) ─────────────────────────────────
function PFieldEdit({ label, value, onChange, affectsMatching, multi, placeholder, focusKey }) {
  return (
    <div className="p-field">
      <div className="p-field-label">
        {label}
        {affectsMatching && <MatchChip tiny />}
      </div>
      {multi ? (
        <textarea
          className="p-field-input is-multi"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          {...(focusKey ? { 'data-focus-key': focusKey } : {})}
        />
      ) : (
        <input
          className="p-field-input"
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          {...(focusKey ? { 'data-focus-key': focusKey } : {})}
        />
      )}
    </div>
  );
}

// ─── PSkill (weighted chip) ─────────────────────────────────
function PSkill({ name, w = 1, onClick }) {
  const lbl = ['', 'Like', 'Strong', 'Core'][w] ?? 'Like';
  return (
    <button type="button" className={`p-skill w-${w}`} onClick={onClick}>
      <span className="p-skill-name">{name}</span>
      <span className="p-skill-weight">{lbl}</span>
    </button>
  );
}

// ─── SkillWeightPopover ─────────────────────────────────────
function SkillWeightPopover({ skillName, currentWeight, position, onUpdate, onRemove, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const style = position
    ? { top: Math.min(position.top, window.innerHeight - 220), left: Math.min(position.left, window.innerWidth - 240) }
    : {};

  return (
    <div ref={ref} className="p-skill-popover" style={style}>
      <div className="p-popover-label">Weight · "{skillName}"</div>
      <div className="p-pop-weight">
        {[1, 2, 3].map(w => (
          <button
            key={w}
            type="button"
            className={`p-pop-weight-btn${currentWeight === w ? ' is-active' : ''}`}
            onClick={() => onUpdate(w)}
          >
            {['', 'Like', 'Strong', 'Core'][w]}
            <br />
            <span style={{ fontSize: 9, fontWeight: 600, opacity: currentWeight === w ? 0.7 : undefined }}>
              {w}×
            </span>
          </button>
        ))}
      </div>
      <div className="p-popover-divider" />
      <div className="p-popover-item is-danger" onClick={onRemove}>
        <Icon name="delete" size={14} />
        Remove skill
      </div>
      <div className="p-popover-hint">
        <Icon name="trending_up" size={11} style={{ color: 'var(--success)' }} />
        Adjust weight to affect your match score
      </div>
    </div>
  );
}

// ─── ToneSlider ─────────────────────────────────────────────
function ToneSlider({ left, right, value = 0.5, onChange, editing }) {
  const pct = value * 100;
  return (
    <div className="p-slider-row">
      <span className="lbl-l">{left}</span>
      {editing ? (
        <input
          type="range" min={0} max={100} value={Math.round(pct)}
          onChange={e => onChange?.(e.target.value / 100)}
          style={{ flex: 1 }}
        />
      ) : (
        <div className="p-slider-track">
          <div className="p-slider-fill" style={{ width: `${pct}%` }} />
          <div className="p-slider-thumb" style={{ left: `${pct}%` }} />
        </div>
      )}
      <span className="lbl-r">{right}</span>
    </div>
  );
}

// ─── VoiceSample ────────────────────────────────────────────
function VoiceSample({ text, source, onRemove }) {
  return (
    <div className="p-voice">
      "{text}"
      <div className="p-voice-foot">
        <Icon name="record_voice_over" size={11} />
        Source: {source}
        {onRemove && (
          <button type="button" className="p-voice-remove" onClick={onRemove}>
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PTagInput ──────────────────────────────────────────────
function PTagInput({ tags = [], onChange, placeholder = 'Add…', editing = false, focusKey }) {
  const [input, setInput] = useState('');
  const addTag = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) { onChange?.([...tags, t]); }
    setInput('');
  };
  const removeTag = (idx) => onChange?.(tags.filter((_, i) => i !== idx));
  const handleKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags.length - 1);
  };
  return (
    <div className="p-tag-input">
      {tags.map((t, i) => (
        <span key={i} className="chip" style={{ fontSize: 11 }}>
          {t}
          {editing && (
            <Icon
              name="close" size={10}
              style={{ color: 'var(--txt-dim)', cursor: 'pointer', marginLeft: 2 }}
              onClick={() => removeTag(i)}
            />
          )}
        </span>
      ))}
      {editing && (
        <input
          className="ghost"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={addTag}
          placeholder={placeholder}
          {...(focusKey ? { 'data-focus-key': focusKey } : {})}
        />
      )}
    </div>
  );
}

// ─── PDoc ───────────────────────────────────────────────────
function PDoc({ doc }) {
  const iconName = doc.kind === 'cover' ? 'mail' : doc.kind === 'context' ? 'folder' : 'description';
  const iconCls = (doc.state === 'attention' || doc.state === 'missing') ? 'is-attention' : '';
  return (
    <div className="p-doc">
      <div className="p-doc-head">
        <div className={`p-doc-icon ${iconCls}`}><Icon name={iconName} size={16} /></div>
        <div className="p-doc-text">
          <div className="p-doc-name">{doc.name}</div>
          <div className="p-doc-sub">{doc.sizeHint}</div>
        </div>
      </div>
      <div className="p-doc-foot">
        {doc.isDefault && (
          <span className="p-doc-default">
            <Icon name="bookmark" size={9} fill /> Default
          </span>
        )}
        {doc.state === 'attention' && (
          <span className="chip chip-amber" style={{ fontSize: 9, padding: '2px 6px' }}>Action needed</span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--txt-mute)', fontSize: 10 }}>
          <Icon name="schedule" size={11} /> {doc.updated}
        </span>
        {doc.usedOn > 0 && (
          <span style={{ fontSize: 10, color: 'var(--txt-mute)' }}>· used on {doc.usedOn} jobs</span>
        )}
      </div>
    </div>
  );
}

// ─── PDocEmpty ──────────────────────────────────────────────
function PDocEmpty({ onClick }) {
  return (
    <div className="p-doc p-doc-empty-cta" onClick={onClick} role="button" tabIndex={0}>
      <div className="p-doc-head" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
        <div className="p-doc-icon is-empty"><Icon name="add" size={18} /></div>
        <div className="p-doc-text" style={{ textAlign: 'center' }}>
          <div className="p-doc-name">Add a document</div>
          <div className="p-doc-sub">PDF, DOCX up to 10MB</div>
        </div>
      </div>
    </div>
  );
}

// ─── PIntegration ────────────────────────────────────────────
function PIntegration({ integration, onToggle }) {
  const s = integration.state;
  const statusLabel = s === 'connected' ? 'Connected' : s === 'connecting' ? 'Connecting…' : s === 'reauth' ? 'Re-auth required' : 'Disconnected';
  const btnLabel = s === 'connected' ? 'Manage' : s === 'connecting' ? 'Cancel' : 'Connect';
  return (
    <div className="p-int">
      <div className="p-int-icon">{integration.initials}</div>
      <div className="p-int-text">
        <div className="p-int-name">{integration.name}</div>
        <div className="p-int-sub">{integration.sub}</div>
      </div>
      <div className={`p-int-status is-${s}`}>
        <span className="dot" />
        {statusLabel}
      </div>
      <button
        type="button"
        className={`p-btn p-btn-sm${s === 'disconnected' || s === 'reauth' ? ' p-btn-primary' : ''}`}
        onClick={() => onToggle?.(integration.id)}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// ─── PEmptyZone ──────────────────────────────────────────────
function PEmptyZone({ icon, title, body, reward, matching, actions, ghost }) {
  return (
    <div className="p-empty-zone">
      <div className="p-empty-zone-icon"><Icon name={icon} size={20} /></div>
      <div className="p-empty-zone-text">
        <h4>
          {title}
          {matching && <MatchChip tiny />}
          {reward != null && (
            <span className="p-reward">
              <Icon name="trending_up" size={11} /> +{reward} readiness
            </span>
          )}
        </h4>
        <p>{body}</p>
        {ghost && (
          <div className="p-ghost-chips">
            {ghost.map((w, i) => <span key={i} className="p-ghost-chip" style={{ width: w }} />)}
          </div>
        )}
      </div>
      {actions && <div className="p-empty-zone-actions">{actions}</div>}
    </div>
  );
}

// ─── PChecklist ───────────────────────────────────────────────
function PChecklist({ items, onNavigate }) {
  return (
    <div className="p-checklist">
      {items.map(item => (
        <div key={item.key}
          className={`p-checklist-item ${item.isDone ? 'is-done' : 'is-todo'}`}
          onClick={!item.isDone ? () => onNavigate(item.section, item.focusKey) : undefined}>
          <Icon name={item.isDone ? 'check_circle' : 'radio_button_unchecked'} size={16} fill={item.isDone} />
          <span className="cl-label">{item.label}</span>
          <span className="impact">{item.isDone ? `+${item.impact}` : `+${item.impact}`}</span>
          {!item.isDone && (
            <span className="go">
              <span className="label-go">Complete</span>
              <Icon name="chevron_right" size={16} className="icon" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CommandPalette ──────────────────────────────────────────
function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(''); setActiveIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  // Build filtered results
  const results = React.useMemo(() => {
    if (!query.trim()) {
      // Show all sections when no query
      return RAIL_SECTIONS.map(s => ({ label: s.label, section: s.id, icon: s.icon, isSection: true }));
    }
    const q = query.toLowerCase();
    const matched = [];
    PALETTE_FIELDS.forEach(f => {
      const haystack = [f.label, ...f.terms].join(' ');
      if (fuzzyMatch(q, haystack)) {
        const sec = RAIL_SECTIONS.find(s => s.id === f.section || (f.section === 'skills' && s.id === 'match'));
        matched.push({ label: f.label, section: f.section, icon: sec?.icon || 'search', affectsMatching: f.affectsMatching, sectionLabel: sec?.label });
      }
    });
    return matched;
  }, [query]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      const r = results[activeIdx];
      onNavigate(r.section === 'skills' ? 'skills' : r.section);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="p-palette-bd" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="p-palette">
        <div className="p-palette-input-row">
          <Icon name="search" size={18} style={{ color: 'var(--txt-dim)' }} />
          <input
            ref={inputRef}
            className="p-palette-input"
            placeholder="Jump to any section or field…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button type="button" className="p-btn p-btn-sm" onClick={onClose}>Esc</button>
        </div>
        <div className="p-palette-results">
          {results.length === 0 && <div className="p-palette-empty">No results for "{query}"</div>}
          {results.map((r, i) => (
            <div
              key={i}
              className={`p-palette-item${activeIdx === i ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => { onNavigate(r.section === 'skills' ? 'skills' : r.section); onClose(); }}
            >
              <Icon name={r.icon || 'search'} size={16} className="p-palette-item-icon" />
              <span className="p-palette-item-label">{r.label}</span>
              {r.sectionLabel && <span className="p-palette-item-section">{r.sectionLabel}</span>}
              {r.affectsMatching && <MatchChip tiny />}
            </div>
          ))}
        </div>
        <div className="p-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> jump to section</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteAccountModal ──────────────────────────────────────
function DeleteAccountModal({ onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  return (
    <div className="p-modal-bd" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="p-modal-card">
        <div className="p-modal-icon"><Icon name="delete_forever" size={20} /></div>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>
          Delete your JobKernel account?
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--txt-mute)', lineHeight: 1.5 }}>
          This permanently removes all tracked applications, your master resume, context bank, and AI generation history.
          We'll email you a final data export.
        </p>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
          <div className="p-field-label" style={{ marginBottom: 4 }}>Type DELETE to confirm</div>
          <input
            className="p-field-input"
            placeholder="DELETE"
            value={typed}
            onChange={e => setTyped(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="p-btn p-btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="p-btn p-btn-sm p-btn-danger"
            disabled={typed !== 'DELETE'}
            onClick={() => typed === 'DELETE' && onConfirm()}
          >
            <Icon name="delete_forever" size={13} /> Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

const Profile = () => {
  const { fetchWithAuth, user: authUser, logout } = useAuth();

  // ── Data state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', full_name: '',
    city: '', state: '',
    phone_primary: '', email: '',
    linkedin_url: '', github_url: '', website_url: '',
    job_title: '', bio: '',
    skills: [],
    preferences: {
      max_commute: '', work_setting: '', expected_salary: '',
      target_roles: [], seniority: '', years_exp: '', relocation: '',
      salary_negotiable: false, skill_weights: {},
    },
    base_resume_path: null,
    long_form_resume_path: null,
    example_cover_letter_path: null,
    additional_docs: [],
    ai_formality: 0.65,
    ai_detail: 0.40,
    voice_samples: [],
    things_to_avoid: [],
  });
  const [photoData, setPhotoData] = useState({ photo_url: '', photo_zoom: 1.0, photo_x: 0, photo_y: 0 });
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── UI state ─────────────────────────────────────────────────
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('profile_rail_collapsed') ?? 'false'); }
    catch { return false; }
  });
  const [manualOverride, setManualOverride] = useState(false);
  const [activeSection, setActiveSection] = useState('identity');
  const [editingSection, setEditingSection] = useState(null);
  const [sectionDraft, setSectionDraft] = useState(null);
  const [savingSection, setSavingSection] = useState(false);
  const [readiness, setReadiness] = useState(0);
  const [readinessDelta, setReadinessDelta] = useState(null);

  // ── Popover/modal state ──────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [skillPopover, setSkillPopover] = useState(null); // { name, weight, x, y }
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // ── Integrations (mocked) ────────────────────────────────────
  const [integrations, setIntegrations] = useState(MOCK_INTEGRATIONS);

  // ── First-run / empty state ──────────────────────────────────
  const [quickWinsDismissed, setQuickWinsDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('profile_qw_dismissed') ?? 'false'); }
    catch { return false; }
  });

  const dismissQuickWins = () => {
    setQuickWinsDismissed(true);
    localStorage.setItem('profile_qw_dismissed', 'true');
  };

  // ── LinkedIn import (preserved from original) ─────────────────
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [linkedInTab, setLinkedInTab] = useState('extension');
  const [linkedInPastedText, setLinkedInPastedText] = useState('');
  const [importingLinkedIn, setImportingLinkedIn] = useState(false);
  const [linkedInError, setLinkedInError] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [selectedFields, setSelectedFields] = useState({});

  // ── File upload refs ─────────────────────────────────────────
  const fileInputRef = useRef(null);
  const baseResumeInputRef = useRef(null);
  const additionalDocsInputRef = useRef(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingAdditionalDoc, setUploadingAdditionalDoc] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, profileRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/auth/me`),
          fetchWithAuth(`${API_URL}/api/profile`),
        ]);
        if (meRes.ok) {
          const me = await meRes.json();
          setPhotoData({ photo_url: me.photo_url || '', photo_zoom: me.photo_zoom || 1.0, photo_x: me.photo_x || 0, photo_y: me.photo_y || 0 });
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data && Object.keys(data).length > 0) {
            setFormData(prev => ({
              ...prev,
              ...data,
              skills: data.skills || [],
              preferences: {
                max_commute: '', work_setting: '', expected_salary: '',
                target_roles: [], seniority: '', years_exp: '', relocation: '',
                salary_negotiable: false, skill_weights: {},
                ...(data.preferences || {}),
              },
              base_resume_path: data.base_resume_path || null,
              long_form_resume_path: data.long_form_resume_path || null,
              example_cover_letter_path: data.example_cover_letter_path || null,
              additional_docs: data.additional_docs || [],
              ai_formality: data.ai_formality ?? 0.65,
              ai_detail: data.ai_detail ?? 0.40,
              voice_samples: data.voice_samples || [],
              things_to_avoid: data.things_to_avoid || [],
            }));
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Update readiness when formData changes
  useEffect(() => {
    setReadiness(computeCompleteness(formData));
  }, [formData]);

  // Sync dirty state with App.jsx guard
  useEffect(() => {
    if (window.__setProfileDirty) window.__setProfileDirty(isDirty);
  }, [isDirty]);

  // ─────────────────────────────────────────────────────────────
  // Rail collapse / viewport auto-collapse
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      if (!manualOverride && window.innerWidth < 1280) {
        setRailCollapsed(true);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [manualOverride]);

  const toggleRail = () => {
    setRailCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('profile_rail_collapsed', JSON.stringify(next));
      return next;
    });
    setManualOverride(true);
  };

  // ─────────────────────────────────────────────────────────────
  // Scroll-spy
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const container = document.querySelector('main');
    if (!container) return;
    const handleScroll = () => {
      for (let i = CONTENT_SECTION_IDS.length - 1; i >= 0; i--) {
        const el = document.getElementById(CONTENT_SECTION_IDS[i]);
        if (el) {
          const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
          if (top <= 90) {
            const railId = CONTENT_SECTION_IDS[i] === 'skills' ? 'match' : CONTENT_SECTION_IDS[i];
            setActiveSection(railId);
            break;
          }
        }
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading]);

  // ─────────────────────────────────────────────────────────────
  // ⌘K command palette
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePaletteNavigate = (sectionId, focusKey) => {
    const targetId = sectionId === 'skills' ? 'skills' : sectionId;
    scrollToSection(targetId);
    const railId = targetId === 'skills' ? 'match' : targetId;
    setActiveSection(railId);
    // Open section for editing
    setEditingSection(sectionId);
    setSectionDraft({ ...formData, preferences: { ...formData.preferences } });
    // Focus the specific field after edit mode renders
    if (focusKey) {
      setTimeout(() => {
        const el = document.querySelector(`[data-focus-key="${focusKey}"]`);
        if (!el) return;
        if (el.tagName === 'BUTTON') { el.click(); } else { el.focus({ preventScroll: true }); el.select?.(); }
      }, 120);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Section edit / save / cancel
  // ─────────────────────────────────────────────────────────────
  const startEdit = (sectionId) => {
    setEditingSection(sectionId);
    setSectionDraft({ ...formData, preferences: { ...formData.preferences } });
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setSectionDraft(null);
  };

  const saveSection = async (sectionId) => {
    if (!sectionDraft) return;
    setSavingSection(true);
    const prevReadiness = readiness;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionDraft),
      });
      if (res.ok) {
        setFormData(sectionDraft);
        setIsDirty(false);
        const newReadiness = computeCompleteness(sectionDraft);
        const delta = newReadiness - prevReadiness;
        if (delta !== 0) {
          setReadinessDelta(delta);
          setTimeout(() => setReadinessDelta(null), 4000);
        }
        setEditingSection(null);
        setSectionDraft(null);
        showNotification('Changes saved.', 'success');
      } else {
        showNotification('Failed to save. Please try again.', 'error');
      }
    } catch (e) {
      showNotification('Error saving changes.', 'error');
    }
    setSavingSection(false);
  };

  const updateDraft = (key, value) => {
    setSectionDraft(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const updateDraftPref = (key, value) => {
    setSectionDraft(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value },
    }));
    setIsDirty(true);
  };

  // ─────────────────────────────────────────────────────────────
  // Skill weight management
  // ─────────────────────────────────────────────────────────────
  const handleSkillClick = (e, skillName) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = getSkillWeight(formData.preferences, skillName);
    setSkillPopover({ name: skillName, weight: w, top: rect.bottom + 6, left: rect.left });
  };

  const handleSkillWeightUpdate = (newWeight) => {
    if (!skillPopover) return;
    const name = skillPopover.name;
    const weights = { ...(formData.preferences?.skill_weights || {}), [name]: newWeight };
    setFormData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, skill_weights: weights },
    }));
    setIsDirty(true);
    setSkillPopover(null);
    // Persist immediately
    fetchWithAuth(`${API_URL}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        preferences: { ...formData.preferences, skill_weights: weights },
      }),
    }).catch(() => {});
  };

  const handleSkillRemove = () => {
    if (!skillPopover) return;
    const name = skillPopover.name;
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== name),
    }));
    setIsDirty(true);
    setSkillPopover(null);
  };

  // ─────────────────────────────────────────────────────────────
  // Integration toggle (mock)
  // ─────────────────────────────────────────────────────────────
  const handleIntegrationToggle = (id) => {
    setIntegrations(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (i.state === 'connected') return { ...i, state: 'disconnected' };
      if (i.state === 'disconnected') return { ...i, state: 'connecting' };
      if (i.state === 'connecting') return { ...i, state: 'disconnected' };
      return i;
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // Resume upload
  // ─────────────────────────────────────────────────────────────
  const handleResumeUpload = async (file, type) => {
    if (!file) return;
    setUploadingResume(true);
    const fd = new FormData();
    fd.append('resume', file);
    fd.append('resume_type', type);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/profile/upload-resume`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        const key = type === 'base' ? 'base_resume_path' : 'long_form_resume_path';
        setFormData(prev => ({ ...prev, [key]: data.path }));
        showNotification('Resume uploaded.', 'success');
      } else { showNotification('Upload failed.', 'error'); }
    } catch { showNotification('Error uploading.', 'error'); }
    setUploadingResume(false);
  };

  // ─────────────────────────────────────────────────────────────
  // LinkedIn import (preserved)
  // ─────────────────────────────────────────────────────────────
  const applyLinkedInData = (data) => {
    const changes = {};
    Object.entries(data).forEach(([key, val]) => {
      if (Array.isArray(val) ? val.length > 0 : (val && val !== formData[key])) {
        changes[key] = val;
      }
    });
    if (Object.keys(changes).length > 0) {
      setExtractedData(changes);
      setSelectedFields(Object.fromEntries(Object.keys(changes).map(k => [k, true])));
      setShowLinkedInModal(false);
    } else {
      showNotification('No new information found.', 'info');
    }
  };

  const handleLinkedInImport = async () => {
    if (linkedInTab === 'extension') {
      setImportingLinkedIn(true);
      setLinkedInError('');
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        setLinkedInError('Could not communicate with the extension.');
        setImportingLinkedIn(false);
      }, 3000);
      const handler = (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'JOB_AUTOMATOR_SCRAPE_LINKEDIN_RESPONSE') {
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          if (event.data.response?.success) applyLinkedInData(event.data.response.data);
          else setLinkedInError(event.data.response?.error || 'Import failed.');
          setImportingLinkedIn(false);
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'JOB_AUTOMATOR_SCRAPE_LINKEDIN' }, '*');
      return;
    }
    if (!linkedInPastedText.trim()) return;
    setImportingLinkedIn(true);
    setLinkedInError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/extract-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: linkedInPastedText }),
      });
      if (res.ok) applyLinkedInData(await res.json());
      else setLinkedInError('Failed to parse LinkedIn text.');
    } catch { setLinkedInError('Connection error.'); }
    setImportingLinkedIn(false);
  };

  const handleApplyExtractedData = () => {
    setFormData(prev => {
      const next = { ...prev };
      Object.entries(extractedData).forEach(([key, val]) => {
        if (selectedFields[key]) next[key] = val;
      });
      return next;
    });
    setIsDirty(true);
    setExtractedData(null);
    showNotification('Profile updated. Save to confirm.', 'success');
  };

  // ─────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────
  const displayName = [formData.first_name, formData.last_name].filter(Boolean).join(' ') || 'Your Name';
  const initials = getInitials(formData.first_name, formData.last_name) || 'YN';
  // Resolve photo URL — stored as a relative /api/... path, needs the API base for img rendering
  const resolvedPhotoUrl = photoData.photo_url
    ? (photoData.photo_url.startsWith('/') ? `${API_URL}${photoData.photo_url}` : photoData.photo_url)
    : null;
  const location = [formData.city, formData.state].filter(Boolean).join(', ');
  const skillsWithWeights = (formData.skills || []).map(name => ({
    name,
    w: getSkillWeight(formData.preferences, name),
  }));
  const docs = buildDocs(formData);

  const isFirstRun = readiness < FIRST_RUN_THRESHOLD;
  const quickWinsItems = QUICK_WINS.map(qw => ({ ...qw, isDone: qw.done(formData) }));
  const quickWinsDone = quickWinsItems.filter(i => i.isDone).length;
  const showQuickWins = (isFirstRun || quickWinsDone < QUICK_WINS.length) && !quickWinsDismissed;

  // ─────────────────────────────────────────────────────────────
  // Section edit actions (reused across sections)
  // ─────────────────────────────────────────────────────────────
  const editActions = (sectionId) => {
    if (editingSection === sectionId) {
      return (
        <>
          <button type="button" className="p-btn p-btn-sm" onClick={cancelEdit} disabled={savingSection}>Cancel</button>
          <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => saveSection(sectionId)} disabled={savingSection}>
            <Icon name="check" size={13} />
            {savingSection ? 'Saving…' : 'Save'}
          </button>
        </>
      );
    }
    return (
      <button type="button" className="p-btn p-btn-sm" onClick={() => startEdit(sectionId)}>
        <Icon name="edit" size={13} /> Edit
      </button>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Rescore notice (shown inside match/skills edit mode)
  // ─────────────────────────────────────────────────────────────
  const RescoreNotice = () => (
    <div className="p-rescore-notice">
      <Icon name="info" size={14} style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--txt-2)', flex: 1, fontSize: 12 }}>
        These fields will rescore your saved jobs on save.
      </span>
      {readinessDelta && <ScoreDelta delta={readinessDelta} />}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--txt-mute)', fontSize: 13 }}>
        Loading profile…
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      {/* ── Topbar ──────────────────────────────────────────────── */}
      <div className="p-topbar">
        <div className="p-topbar-crumb">
          <Icon name="person" size={16} className="dim" />
          <span>Profile</span>
        </div>
        <div className="p-topbar-actions">
          <button type="button" className="p-btn p-btn-sm" onClick={() => setShowLinkedInModal(true)}>
            <Icon name="link" size={14} /> Import from LinkedIn
          </button>
          <button type="button" className="p-btn p-btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Icon name="file_upload" size={14} /> Import resume
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f, 'base'); e.target.value = ''; }} />
          <button type="button" className="p-btn p-btn-sm" onClick={() => setPaletteOpen(true)}
            title="⌘K">
            <Icon name="search" size={14} /> Jump to… <kbd style={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 4px', marginLeft: 2 }}>⌘K</kbd>
          </button>
        </div>
      </div>

      {/* ── Body grid ──────────────────────────────────────────── */}
      <div className={`p-shell${railCollapsed ? ' is-collapsed' : ''}`}>

        {/* ── Rail ──────────────────────────────────────────────── */}
        <aside className="p-rail">
          {/* Collapse toggle */}
          <div className="p-rail-toggle">
            <button type="button" className="p-rail-toggle-btn" onClick={toggleRail} title={railCollapsed ? 'Expand rail' : 'Collapse rail'}>
              <Icon name={railCollapsed ? 'chevron_right' : 'chevron_left'} size={14} />
            </button>
          </div>

          {/* Identity mini-header */}
          <div className="p-rail-ident">
            {isFirstRun && !resolvedPhotoUrl ? (
              <div className="p-avatar is-placeholder"><Icon name="person" size={18} /></div>
            ) : (
              <div
                className="p-avatar"
                style={resolvedPhotoUrl ? { backgroundImage: `url(${resolvedPhotoUrl})`, backgroundSize: 'cover', backgroundPosition: `${50 + photoData.photo_x}% ${50 + photoData.photo_y}%`, cursor: 'pointer' } : { cursor: 'pointer' }}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                {!resolvedPhotoUrl && initials}
              </div>
            )}
            <div className="p-rail-ident-text">
              <div className="p-rail-name" style={isFirstRun && !formData.first_name ? { color: 'var(--txt-mute)' } : undefined}>
                {isFirstRun && !formData.first_name ? 'Your name' : displayName}
              </div>
              <div className="p-rail-sub">{location || 'Not set'}</div>
            </div>
          </div>

          {/* Readiness card */}
          <div className="p-rail-comp">
            <ScoreRing score={readiness} size={railCollapsed ? 28 : 40} />
            <div className="p-rail-comp-text">
              <div className="p-rail-comp-pct">
                {readiness}%
                {readinessDelta && <ScoreDelta delta={readinessDelta} />}
              </div>
              <div className="p-rail-comp-lab">Profile readiness</div>
            </div>
          </div>

          {/* Section nav */}
          <div>
            {/* Quick wins shortcut — always visible in rail */}
            {quickWinsDone < QUICK_WINS.length && (
              <div className="p-rail-list" style={{ marginBottom: 4 }}>
                <div
                  className={`p-rail-item${activeSection === 'quick-wins' ? ' is-active' : ''}${quickWinsDismissed ? ' is-attention' : ''}`}
                  title={railCollapsed ? `Quick wins · ${quickWinsDone}/${QUICK_WINS.length} done` : undefined}
                  onClick={() => {
                    if (quickWinsDismissed) setQuickWinsDismissed(false);
                    setActiveSection('quick-wins');
                    setTimeout(() => scrollToSection('quick-wins'), 50);
                  }}
                >
                  <Icon name="task_alt" size={16} fill={activeSection === 'quick-wins'} className="p-rail-icon" />
                  <span className="p-rail-item-label">Quick wins</span>
                  <span className="p-rail-pip">{quickWinsDone}/{QUICK_WINS.length}</span>
                </div>
              </div>
            )}
            <div className="p-rail-group">{isFirstRun ? 'Finish setup' : 'Profile'}</div>
            <div className="p-rail-list">
              {RAIL_SECTIONS.map(s => (
                <div
                  key={s.id}
                  className={`p-rail-item${activeSection === s.id ? ' is-active' : ''}${s.attention && !isFirstRun ? ' is-attention' : ''}`}
                  onClick={() => { scrollToSection(s.id); setActiveSection(s.id); }}
                  title={railCollapsed ? s.label : undefined}
                >
                  <Icon name={s.icon} size={16} fill={activeSection === s.id} className="p-rail-icon" />
                  <span className="p-rail-item-label">{s.label}</span>
                  {isFirstRun ? (
                    <span className="p-rail-pip is-empty">
                      <Icon name="radio_button_unchecked" size={11} />
                    </span>
                  ) : (
                    <>
                      {s.affectsMatching && (
                        <span className="p-rail-pip">{s.matchScore ?? 86}</span>
                      )}
                      {s.attention && !s.affectsMatching && (
                        <span className="p-rail-pip">{s.attention}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-rail-footer">
            {isFirstRun && !railCollapsed && (
              <div style={{ fontSize: 11, color: 'var(--txt-mute)', fontWeight: 600, lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', marginBottom: 4 }}>
                <Icon name="lightbulb" size={13} style={{ color: 'var(--warn)', verticalAlign: '-2px' }} />
                {' '}Importing a resume fills most of this in one step.
              </div>
            )}
            <button type="button" className="p-btn p-btn-sm p-btn-ghost" style={{ justifyContent: 'flex-start' }}
              title={railCollapsed ? 'Export profile' : undefined}
              onClick={() => { scrollToSection('account'); setActiveSection('account'); }}>
              <Icon name="download" size={14} /> {!railCollapsed && 'Export profile'}
            </button>
          </div>
        </aside>

        {/* ── Content column ──────────────────────────────────── */}
        <main className="p-main">

          {/* ── Hero ──────────────────────────────────────────── */}
          {isFirstRun ? (
            <div className="p-empty-hero">
              <ScoreRing score={readiness} size={76} />
              <div className="p-empty-hero-text">
                <h2>Let's build your profile</h2>
                <p>JobKernel scores and tailors every application against your profile. Start by importing a resume — we'll auto-fill your identity, skills, and experience — then refine the bits that drive your Match Score.</p>
              </div>
            </div>
          ) : (
            <div className="p-hero">
              <div
                className="p-avatar is-xl"
                style={resolvedPhotoUrl
                  ? { backgroundImage: `url(${resolvedPhotoUrl})`, backgroundSize: 'cover', backgroundPosition: `${50 + photoData.photo_x}% ${50 + photoData.photo_y}%`, cursor: 'pointer' }
                  : { cursor: 'pointer' }}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                {!resolvedPhotoUrl && initials}
              </div>
              <div className="p-hero-text">
                <h1 className="p-hero-name">{displayName}</h1>
                <div className="p-hero-headline">{formData.job_title || 'Add a headline'}</div>
                <div className="p-hero-meta">
                  {location && <span className="p-hero-meta-item"><Icon name="place" size={13} className="p-meta-icon" />{location}</span>}
                  {formData.email && <span className="p-hero-meta-item"><Icon name="mail" size={13} className="p-meta-icon" />{formData.email}</span>}
                  {formData.preferences?.work_auth && <span className="p-hero-meta-item"><Icon name="badge" size={13} className="p-meta-icon" />{formData.preferences.work_auth}</span>}
                  {(formData.linkedin_url || formData.github_url || formData.website_url) && (
                    <span className="p-hero-meta-item" style={{ color: 'var(--primary)' }}>
                      <Icon name="link" size={13} />
                      {[formData.linkedin_url, formData.github_url, formData.website_url].filter(Boolean).length} links
                    </span>
                  )}
                </div>
              </div>
              <div className="p-hero-aside">
                <ScoreRing score={readiness} size={64} />
                <div className="p-hero-comp">
                  <div className="p-hero-comp-lab">Profile readiness</div>
                  <div className="p-hero-comp-pct">
                    {readiness}<span style={{ fontSize: 14, color: 'var(--txt-mute)' }}>%</span>
                  </div>
                  {readinessDelta && <ScoreDelta delta={readinessDelta} />}
                </div>
              </div>
            </div>
          )}

          {/* ── First-run: method cards ────────────────────────── */}
          {isFirstRun && (
            <div className="p-methods">
              <button type="button" className="p-method is-primary" onClick={() => fileInputRef.current?.click()}>
                <span className="p-method-tag">Fastest</span>
                <div className="p-method-icon"><Icon name="upload_file" size={18} /></div>
                <div className="p-method-title">Import a resume</div>
                <div className="p-method-sub">PDF or DOCX. We parse identity, skills, and work history automatically.</div>
                <div className="p-method-foot">Upload <Icon name="arrow_forward" size={12} /></div>
              </button>
              <button type="button" className="p-method" onClick={() => setShowLinkedInModal(true)}>
                <div className="p-method-icon" style={{ background: '#0a66c2', color: 'white' }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>in</span>
                </div>
                <div className="p-method-title">Connect LinkedIn</div>
                <div className="p-method-sub">Pull your headline, roles, and connections in one click.</div>
                <div className="p-method-foot">Connect <Icon name="arrow_forward" size={12} /></div>
              </button>
              <button type="button" className="p-method" onClick={() => { scrollToSection('identity'); startEdit('identity'); }}>
                <div className="p-method-icon"><Icon name="edit_note" size={18} /></div>
                <div className="p-method-title">Fill in manually</div>
                <div className="p-method-sub">Prefer to type it yourself? Start with the section below.</div>
                <div className="p-method-foot">Start <Icon name="arrow_forward" size={12} /></div>
              </button>
            </div>
          )}

          {/* ── Quick wins checklist ────────────────────────────── */}
          {showQuickWins && (
            <PSection id="quick-wins" icon="task_alt" title="Quick wins"
              sub="Each item adds to your readiness and improves every Match Score."
              actions={
                <>
                  <span className="chip" style={{ fontSize: 11 }}>{quickWinsDone} of {QUICK_WINS.length} done</span>
                  <button type="button" className="p-btn p-btn-sm p-btn-ghost" onClick={dismissQuickWins} title="Dismiss">
                    <Icon name="close" size={14} />
                  </button>
                </>
              }>
              <PChecklist
                items={quickWinsItems}
                onNavigate={handlePaletteNavigate}
              />
            </PSection>
          )}

          {/* ── Identity ────────────────────────────────────────── */}
          <PSection id="identity" icon="person" title="Identity"
            sub="Name, contact, and links the agent uses to author messages."
            actions={!formData.first_name && !editingSection ? (
              <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('identity')}>
                <Icon name="add" size={13} /> Add details
              </button>
            ) : editActions('identity')}>
            {!formData.first_name && editingSection !== 'identity' ? (
              <PEmptyZone
                icon="badge"
                title="No identity yet"
                reward={23}
                body="Add your name, email, location, and a one-line headline. Imported resumes fill this automatically."
                ghost={['120px', '90px', '160px']}
                actions={
                  <>
                    <button type="button" className="p-btn p-btn-sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload_file" size={13} /> From resume
                    </button>
                    <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('identity')}>Add manually</button>
                  </>
                }
              />
            ) : editingSection === 'identity' ? (
              <>
                <div className="p-field-grid">
                  <PFieldEdit label="First name" value={sectionDraft?.first_name} onChange={e => updateDraft('first_name', e.target.value)} focusKey="first_name" />
                  <PFieldEdit label="Last name" value={sectionDraft?.last_name} onChange={e => updateDraft('last_name', e.target.value)} />
                  <PFieldEdit label="Headline" value={sectionDraft?.job_title} onChange={e => updateDraft('job_title', e.target.value)} placeholder="Senior Solutions Architect…" />
                  <PFieldEdit label="Email" value={sectionDraft?.email} onChange={e => updateDraft('email', e.target.value)} focusKey="email" />
                  <PFieldEdit label="Phone" value={sectionDraft?.phone_primary} onChange={e => updateDraft('phone_primary', e.target.value)} />
                  <PFieldEdit label="City" value={sectionDraft?.city} onChange={e => updateDraft('city', e.target.value)} affectsMatching focusKey="city" />
                  <PFieldEdit label="State" value={sectionDraft?.state} onChange={e => updateDraft('state', e.target.value)} affectsMatching />
                  <PFieldEdit label="Work authorization" value={sectionDraft?.preferences?.work_auth} onChange={e => updateDraftPref('work_auth', e.target.value)} affectsMatching placeholder="US Citizen, H1-B…" />
                </div>
                <div style={{ height: 12 }} />
                <div className="p-field-grid is-1">
                  <PFieldEdit label="Bio / summary" value={sectionDraft?.bio} onChange={e => updateDraft('bio', e.target.value)} multi placeholder="Strategic technology leader…" focusKey="bio" />
                </div>
                <div style={{ height: 12 }} />
                <div className="p-field-grid is-3">
                  <PFieldEdit label="LinkedIn URL" value={sectionDraft?.linkedin_url} onChange={e => updateDraft('linkedin_url', e.target.value)} focusKey="linkedin_url" />
                  <PFieldEdit label="GitHub URL" value={sectionDraft?.github_url} onChange={e => updateDraft('github_url', e.target.value)} />
                  <PFieldEdit label="Portfolio URL" value={sectionDraft?.website_url} onChange={e => updateDraft('website_url', e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="p-field-grid">
                  <PField label="Display name" value={displayName} />
                  <PField label="Headline" value={formData.job_title} />
                  <PField label="Email" value={formData.email} />
                  <PField label="Phone" value={formData.phone_primary} />
                  <PField label="Location" value={location} affectsMatching />
                  <PField label="Work auth" value={formData.preferences?.work_auth} affectsMatching />
                </div>
                {formData.bio && (
                  <>
                    <div style={{ height: 12 }} />
                    <div className="p-field-grid is-1">
                      <PField label="Bio / summary" value={formData.bio} multi />
                    </div>
                  </>
                )}
                {(formData.linkedin_url || formData.github_url || formData.website_url) && (
                  <>
                    <div style={{ height: 12 }} />
                    <div className="p-field-grid is-3">
                      <PField label="LinkedIn"><span style={{ color: 'var(--primary)' }}>{formData.linkedin_url || '—'}</span></PField>
                      <PField label="GitHub"><span style={{ color: 'var(--primary)' }}>{formData.github_url || '—'}</span></PField>
                      <PField label="Portfolio"><span style={{ color: 'var(--primary)' }}>{formData.website_url || '—'}</span></PField>
                    </div>
                  </>
                )}
              </>
            )}
          </PSection>

          {/* ── Match band ─────────────────────────────────────── */}
          <PBand kind="match" icon="auto_awesome" label="Match profile · feeds your score"
            count={`Score ${formData.preferences?.match_score ?? 86} · top quartile`} />

          {/* ── Match profile ──────────────────────────────────── */}
          <PSection id="match" icon="auto_awesome" title="Career & compensation"
            sub="What you're looking for. Drives every Match Score on Pulse."
            affectsMatching
            actions={!(formData.preferences?.target_roles || []).length && !formData.preferences?.expected_salary && !editingSection ? (
              <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('match')}>
                <Icon name="add" size={13} /> Set targets
              </button>
            ) : editActions('match')}>
            {!(formData.preferences?.target_roles || []).length && !formData.preferences?.expected_salary && editingSection !== 'match' ? (
              <PEmptyZone
                icon="my_location"
                title="No target roles or compensation set"
                matching
                reward={20}
                body="Tell the agent the roles, seniority, work setting, and salary range you want. Until this is set, Pulse can't rank jobs for you."
                ghost={['140px', '100px', '120px', '80px']}
                actions={
                  <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('match')}>Set targets</button>
                }
              />
            ) : editingSection === 'match' ? (
              <>
                <div className="p-field-grid">
                  <div className="p-field">
                    <div className="p-field-label">Target roles <MatchChip tiny /></div>
                    <PTagInput
                      tags={sectionDraft?.preferences?.target_roles || []}
                      onChange={v => updateDraftPref('target_roles', v)}
                      placeholder="Add a role…" editing
                      focusKey="target_roles"
                    />
                  </div>
                  <PFieldEdit label="Seniority" value={sectionDraft?.preferences?.seniority}
                    onChange={e => updateDraftPref('seniority', e.target.value)} affectsMatching
                    placeholder="Senior / Staff (10+ yrs)" />
                  <PFieldEdit label="Years of experience" value={sectionDraft?.preferences?.years_exp}
                    onChange={e => updateDraftPref('years_exp', e.target.value)} affectsMatching
                    placeholder="20" />
                  <PFieldEdit label="Work setting" value={sectionDraft?.preferences?.work_setting}
                    onChange={e => updateDraftPref('work_setting', e.target.value)} affectsMatching
                    placeholder="Remote, Hybrid…" focusKey="work_setting" />
                  <PFieldEdit label="Relocation" value={sectionDraft?.preferences?.relocation}
                    onChange={e => updateDraftPref('relocation', e.target.value)} affectsMatching
                    placeholder="Not available" />
                  <PFieldEdit label="Expected salary" value={sectionDraft?.preferences?.expected_salary}
                    onChange={e => updateDraftPref('expected_salary', e.target.value)} affectsMatching
                    placeholder="$160k – $250k USD" focusKey="expected_salary" />
                </div>
                <RescoreNotice />
              </>
            ) : (
              <div className="p-field-grid">
                <PField label="Target roles" affectsMatching>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(formData.preferences?.target_roles || []).length > 0
                      ? (formData.preferences.target_roles).map((r, i) => <span key={i} className="chip">{r}</span>)
                      : <span className="is-muted" style={{ color: 'var(--txt-mute)', fontStyle: 'italic', fontSize: 13 }}>Not set</span>}
                  </div>
                </PField>
                <PField label="Seniority" value={formData.preferences?.seniority} affectsMatching />
                <PField label="Years of experience"
                  value={formData.preferences?.years_exp ? `${formData.preferences.years_exp} years` : null}
                  affectsMatching />
                <PField label="Remote / hybrid" affectsMatching>
                  {formData.preferences?.work_setting
                    ? <span className="chip chip-blue">{formData.preferences.work_setting}</span>
                    : <span className="is-muted" style={{ color: 'var(--txt-mute)', fontStyle: 'italic', fontSize: 13 }}>Not set</span>}
                </PField>
                <PField label="Relocation" value={formData.preferences?.relocation} affectsMatching />
                <PField label="Compensation" affectsMatching>
                  {formData.preferences?.expected_salary
                    ? <span className="salary-chip"><Icon name="payments" size={11} />{formData.preferences.expected_salary}</span>
                    : <span className="is-muted" style={{ color: 'var(--txt-mute)', fontStyle: 'italic', fontSize: 13 }}>Not set</span>}
                </PField>
              </div>
            )}
          </PSection>


          {/* ── Skills ─────────────────────────────────────────── */}
          <PSection id="skills" icon="bolt" title="Skills"
            sub={`${(formData.skills || []).length} skills · weights tell the agent what to highlight first.`}
            affectsMatching
            actions={
              <>
                {(formData.skills || []).length > 0 && (
                  <button type="button" className="p-btn p-btn-sm">
                    <Icon name="sort" size={13} /> Weight
                  </button>
                )}
                <button type="button" className="p-btn p-btn-sm p-btn-primary"
                  onClick={() => {
                    const name = window.prompt('New skill name:');
                    if (name?.trim() && !formData.skills.includes(name.trim())) {
                      setFormData(prev => ({ ...prev, skills: [...prev.skills, name.trim()] }));
                      setIsDirty(true);
                    }
                  }}>
                  <Icon name="add" size={13} /> Add
                </button>
              </>
            }>
            {!(formData.skills || []).length ? (
              <PEmptyZone
                icon="bolt"
                title="No skills added"
                matching
                reward={15}
                body="Import a resume to auto-detect skills, then weight the ones that matter most (Core / Strong / Like)."
                ghost={['90px', '70px', '110px', '60px', '80px']}
                actions={
                  <>
                    <button type="button" className="p-btn p-btn-sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload_file" size={13} /> From resume
                    </button>
                    <button type="button" className="p-btn p-btn-sm p-btn-primary"
                      onClick={() => {
                        const name = window.prompt('New skill name:');
                        if (name?.trim()) {
                          setFormData(prev => ({ ...prev, skills: [name.trim()] }));
                          setIsDirty(true);
                        }
                      }}>
                      <Icon name="add" size={13} /> Add skill
                    </button>
                  </>
                }
              />
            ) : (
            <>
            <div className="p-skills">
              {skillsWithWeights.map((s, i) => (
                <PSkill key={i} name={s.name} w={s.w} onClick={e => handleSkillClick(e, s.name)} />
              ))}
              <button type="button" className="p-skill-add" data-focus-key="skill-add"
                onClick={() => {
                  const name = window.prompt('New skill name:');
                  if (name?.trim() && !formData.skills.includes(name.trim())) {
                    setFormData(prev => ({ ...prev, skills: [...prev.skills, name.trim()] }));
                    setIsDirty(true);
                  }
                }}>
                <Icon name="add" size={11} /> Add skill
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--txt-mute)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="p-skill-weight" style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 'var(--r-pill)' }}>Core</span>
                Highlighted first; counts 3× toward score
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="p-skill-weight" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--primary-edge)', padding: '2px 6px', borderRadius: 'var(--r-pill)' }}>Strong</span>
                Counts 2×
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="p-skill-weight" style={{ background: 'var(--bg-card)', color: 'var(--txt-mute)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 'var(--r-pill)' }}>Like</span>
                Counts 1×
              </span>
            </div>
            </>
            )}
          </PSection>

          {/* ── AI generation ──────────────────────────────────── */}
          <PSection id="ai" icon="neurology" title="AI generation"
            sub="How the agent writes resumes, cover letters, and outreach in your voice."
            actions={!(formData.voice_samples || []).length && editingSection !== 'ai' ? (
              <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('ai')}>Set voice</button>
            ) : editActions('ai')}>
            {!(formData.voice_samples || []).length && editingSection !== 'ai' ? (
              <PEmptyZone
                icon="record_voice_over"
                title="Using default voice"
                reward={14}
                body="Add 1–3 writing samples and a few phrases to avoid, so generated drafts sound like you and not a template."
                ghost={['100%']}
                actions={
                  <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={() => startEdit('ai')}>Add a voice sample</button>
                }
              />
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="p-field-label" style={{ marginBottom: 8 }}>Tone</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ToneSlider left="Casual" right="Formal"
                    value={editingSection === 'ai' ? (sectionDraft?.ai_formality ?? 0.65) : (formData.ai_formality ?? 0.65)}
                    onChange={v => updateDraft('ai_formality', v)}
                    editing={editingSection === 'ai'} />
                  <ToneSlider left="Concise" right="Detailed"
                    value={editingSection === 'ai' ? (sectionDraft?.ai_detail ?? 0.40) : (formData.ai_detail ?? 0.40)}
                    onChange={v => updateDraft('ai_detail', v)}
                    editing={editingSection === 'ai'} />
                </div>
              </div>
              <div>
                <div className="p-field-label" style={{ marginBottom: 8 }}>
                  Voice samples
                  <span className="chip" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 6 }}>
                    {(formData.voice_samples || []).length} / 5
                  </span>
                  <span className="chip chip-amber" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>TODO: backend</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(formData.voice_samples || []).map((s, i) => (
                    <VoiceSample key={i} text={typeof s === 'string' ? s : s.text}
                      source={typeof s === 'object' ? s.source : `Sample ${i + 1}`}
                      onRemove={editingSection === 'ai' ? () => {
                        const next = [...(sectionDraft?.voice_samples || [])];
                        next.splice(i, 1);
                        updateDraft('voice_samples', next);
                      } : undefined} />
                  ))}
                  {editingSection === 'ai' && (formData.voice_samples || []).length < 5 && (
                    <button type="button" className="p-btn p-btn-sm" style={{ alignSelf: 'flex-start' }}
                      onClick={() => {
                        const text = window.prompt('Paste a voice sample (a paragraph in your writing style):');
                        if (text?.trim()) {
                          const next = [...(sectionDraft?.voice_samples || []), { text: text.trim(), source: 'Manual' }];
                          updateDraft('voice_samples', next);
                        }
                      }}>
                      <Icon name="add" size={13} /> Add sample
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="p-field-label" style={{ marginBottom: 8 }}>
                  Things to avoid
                  <span className="chip chip-amber" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>TODO: backend</span>
                </div>
                <PTagInput
                  tags={editingSection === 'ai' ? (sectionDraft?.things_to_avoid || []) : (formData.things_to_avoid || [])}
                  onChange={v => updateDraft('things_to_avoid', v)}
                  placeholder="Add a phrase…"
                  editing={editingSection === 'ai'}
                />
              </div>
            </div>
            )}
          </PSection>

          {/* ── Documents ──────────────────────────────────────── */}
          <PSection id="documents" icon="folder" title="Documents"
            sub="Master resumes, base cover letters, and the context bank the agent pulls from."
            actions={
              <>
                <button type="button" className="p-btn p-btn-sm" onClick={() => baseResumeInputRef.current?.click()}>
                  <Icon name="cloud_upload" size={13} /> Upload
                </button>
                <button type="button" className="p-btn p-btn-sm p-btn-primary">
                  <Icon name="open_in_full" size={13} /> Open library
                </button>
                <input ref={baseResumeInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f, 'base'); e.target.value = ''; }} />
              </>
            }>
            {docs.length === 0 ? (
              <div
                className="p-dropzone"
                onClick={() => baseResumeInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('is-active'); }}
                onDragLeave={e => e.currentTarget.classList.remove('is-active')}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('is-active');
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleResumeUpload(f, 'base');
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="p-dropzone-icon"><Icon name="cloud_upload" size={22} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-2)' }}>
                  Drop your master resume here, or click to browse
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt-mute)' }}>PDF or DOCX up to 10MB · we'll set it as your default</div>
                <div style={{ marginTop: 4 }}>
                  <span className="p-reward"><Icon name="trending_up" size={11} /> +20 readiness</span>
                </div>
              </div>
            ) : (
              <div className="p-doc-grid">
                {docs.map(d => <PDoc key={d.id} doc={d} />)}
                <PDocEmpty onClick={() => baseResumeInputRef.current?.click()} />
              </div>
            )}
          </PSection>

          {/* ── Integrations ───────────────────────────────────── */}
          <PSection id="integrations" icon="link" title="Integrations"
            sub="Connect the apps the agent reads from and writes to.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {integrations.map(i => (
                <PIntegration key={i.id} integration={i} onToggle={handleIntegrationToggle} />
              ))}
            </div>
          </PSection>

          {/* ── Account & plan ─────────────────────────────────── */}
          <PSection id="account" icon="credit_card" title="Account"
            sub="Data controls and account management.">
            {/* Export data — non-destructive, lives outside the danger zone */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Export your data</div>
                <div style={{ fontSize: 12, color: 'var(--txt-mute)', marginTop: 2 }}>Download all your applications, documents, and profile data as a ZIP archive.</div>
              </div>
              <button type="button" className="p-btn p-btn-sm" style={{ marginLeft: 16, flexShrink: 0 }}>
                <Icon name="download" size={13} /> Export data
              </button>
            </div>
            <div style={{ height: 10 }} />
            <div className="p-danger">
              <Icon name="warning" size={20} style={{ color: 'var(--danger)' }} />
              <div className="p-danger-text">
                <strong>Danger zone</strong>
                <p>Permanently delete your account and all tracked applications. This cannot be undone.</p>
              </div>
              <button type="button" className="p-btn p-btn-sm p-btn-danger" onClick={() => setDeleteModalOpen(true)}>
                Delete account
              </button>
            </div>
          </PSection>

        </main>
      </div>

      {/* ── Overlays ──────────────────────────────────────────── */}

      {/* Skill weight popover */}
      {skillPopover && (
        <SkillWeightPopover
          skillName={skillPopover.name}
          currentWeight={skillPopover.weight}
          position={{ top: skillPopover.top, left: skillPopover.left }}
          onUpdate={handleSkillWeightUpdate}
          onRemove={handleSkillRemove}
          onClose={() => setSkillPopover(null)}
        />
      )}

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={handlePaletteNavigate} />

      {/* Delete account modal */}
      {deleteModalOpen && (
        <DeleteAccountModal
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => {
            setDeleteModalOpen(false);
            showNotification('Account deletion requested. Check your email.', 'info');
          }}
        />
      )}

      {/* Photo modal */}
      {isPhotoModalOpen && (
        <ProfilePhotoModal
          isOpen={true}
          initialPhotoUrl={resolvedPhotoUrl}
          initialZoom={photoData.photo_zoom}
          initialX={photoData.photo_x}
          initialY={photoData.photo_y}
          onClose={() => setIsPhotoModalOpen(false)}
          onSuccess={(data) => {
            setPhotoData(data);
            setIsPhotoModalOpen(false);
            showNotification('Photo updated.', 'success');
          }}
        />
      )}

      {/* LinkedIn import modal */}
      {showLinkedInModal && (
        <div className="p-modal-bd" onClick={e => { if (e.target === e.currentTarget) setShowLinkedInModal(false); }}>
          <div className="p-modal-card" style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>
              Import from LinkedIn
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button type="button" className={`p-btn p-btn-sm${linkedInTab === 'extension' ? ' p-btn-primary' : ''}`}
                onClick={() => setLinkedInTab('extension')}>Extension</button>
              <button type="button" className={`p-btn p-btn-sm${linkedInTab === 'paste' ? ' p-btn-primary' : ''}`}
                onClick={() => setLinkedInTab('paste')}>Paste text</button>
            </div>
            {linkedInTab === 'extension' ? (
              <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.5 }}>
                Open your LinkedIn profile page, then click Import below. The JobKernel browser extension will extract your data.
              </p>
            ) : (
              <textarea className="p-field-input is-multi" style={{ minHeight: 120 }}
                placeholder="Paste your LinkedIn profile text here…"
                value={linkedInPastedText} onChange={e => setLinkedInPastedText(e.target.value)} />
            )}
            {linkedInError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{linkedInError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="p-btn p-btn-sm" onClick={() => setShowLinkedInModal(false)}>Cancel</button>
              <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={handleLinkedInImport} disabled={importingLinkedIn}>
                {importingLinkedIn ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted data review modal */}
      {extractedData && (
        <div className="p-modal-bd" onClick={e => { if (e.target === e.currentTarget) setExtractedData(null); }}>
          <div className="p-modal-card" style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>Review imported data</h3>
            <p style={{ fontSize: 13, color: 'var(--txt-mute)', marginBottom: 14 }}>
              Select the fields you want to apply to your profile.
            </p>
            {Object.entries(extractedData).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <input type="checkbox" checked={!!selectedFields[key]}
                  onChange={e => setSelectedFields(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt-mute)', textTransform: 'uppercase', marginBottom: 2 }}>{key.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt-2)' }}>
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="p-btn p-btn-sm" onClick={() => setExtractedData(null)}>Cancel</button>
              <button type="button" className="p-btn p-btn-sm p-btn-primary" onClick={handleApplyExtractedData}>Apply selected</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification toast */}
      {notification && (
        <div className={`p-notification${notification.type ? ` ${notification.type}` : ''}`}>
          <Icon name={notification.type === 'success' ? 'check_circle' : notification.type === 'error' ? 'error' : 'info'} size={16} />
          {notification.msg}
        </div>
      )}
    </div>
  );
};

export default Profile;
