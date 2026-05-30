/* global React */
/* Variation C — Hub + drill-in. Landing card grid summarizing each section. */

function ProfileHub({ theme = 'light', density = 'comfy', showMatchChips = true }) {
  const P = window.PROFILE;

  // Card summary per section
  const cards = [
    {
      id: 'identity', icon: 'person', title: 'Identity',
      rows: [
        { k: 'Name', v: P.displayName },
        { k: 'Headline', v: P.headline.substring(0, 38) + '…' },
        { k: 'Location', v: P.location },
      ],
      meta: { icon: 'check_circle', text: 'Complete · last edit 4 days ago', color: 'var(--success)' },
    },
    {
      id: 'match', icon: 'auto_awesome', title: 'Match profile',
      affectsMatching: true,
      rows: [
        { k: 'Target roles', v: `${P.targetRoles.length} roles` },
        { k: 'Seniority', v: 'Senior / Staff' },
        { k: 'Compensation', v: `$${(P.comp.min/1000)}k – $${(P.comp.max/1000)}k` },
      ],
      meta: { icon: 'speed', text: 'Avg match 86 · top quartile', color: 'var(--primary)' },
    },
    {
      id: 'skills', icon: 'bolt', title: 'Skills',
      affectsMatching: true,
      skills: P.skills,
      rows: [
        { k: 'Total', v: `${P.skills.length} skills` },
        { k: 'Core (3×)', v: P.skills.filter(s => s.w === 3).length },
        { k: 'Strong (2×)', v: P.skills.filter(s => s.w === 2).length },
      ],
      meta: { icon: 'sync', text: 'Synced from Master Resume', color: 'var(--txt-mute)' },
    },
    {
      id: 'ai', icon: 'neurology', title: 'AI generation',
      rows: [
        { k: 'Tone', v: 'Formal · concise' },
        { k: 'Voice samples', v: `${P.ai.voiceSamples.length} of 5` },
        { k: 'Banned phrases', v: `${P.ai.avoid.length}` },
      ],
      meta: { icon: 'priority_high', text: 'Add 3 more voice samples (+8 readiness)', color: 'var(--warn)' },
      attention: true,
    },
    {
      id: 'documents', icon: 'folder', title: 'Documents',
      rows: [
        { k: 'Resumes', v: '2 · Master is default' },
        { k: 'Cover letters', v: '1 · base default' },
        { k: 'Context bank', v: '1 of 25 docs' },
      ],
      meta: { icon: 'priority_high', text: 'Transcripts not uploaded', color: 'var(--warn)' },
      attention: true,
    },
    {
      id: 'integrations', icon: 'link', title: 'Integrations',
      rows: [
        { k: 'Connected', v: 'LinkedIn, Gmail' },
        { k: 'Disconnected', v: 'Calendar, Greenhouse' },
        { k: 'Extension', v: 'Installing…' },
      ],
      meta: { icon: 'check_circle', text: '2 of 5 connected', color: 'var(--success)' },
    },
    {
      id: 'account', icon: 'credit_card', title: 'Account',
      rows: [
        { k: 'Plan', v: `${P.plan.name} · ${P.plan.price}` },
        { k: 'Generations', v: `${P.plan.used.gens} / ${P.plan.cap.gens}` },
        { k: 'Renewal', v: 'Jun 12, 2026' },
      ],
      meta: { icon: 'lock', text: 'Billing managed by Stripe', color: 'var(--txt-mute)' },
    },
    {
      id: 'completeness', icon: 'task_alt', title: 'Profile completeness',
      rows: [
        { k: 'Identity', v: '✓' },
        { k: 'Match profile', v: '✓' },
        { k: 'AI + Voice', v: 'In progress' },
      ],
      meta: { icon: 'trending_up', text: '78% · 3 quick wins available', color: 'var(--primary)' },
    },
  ];

  return (
    <div className={`p-artboard ${density === 'compact' ? 'is-compact' : density === 'relaxed' ? 'is-relaxed' : ''}`}>
      <ProfileShell theme={theme}>
        <div className="p-shell is-single">
          <main className="p-main" style={{ maxWidth: 1080 }}>
            <ProfileHero showDelta={false} />

            {/* Hub grid */}
            <div className="p-hub-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              {cards.map(c => (
                <div key={c.id} className={`p-hub-card ${c.attention ? 'is-attention' : ''}`}>
                  <div className="p-hub-head">
                    <Icon name={c.icon} size={18} fill />
                    <span className="p-hub-title">{c.title}</span>
                    {c.affectsMatching && showMatchChips && <MatchChip size="tiny" />}
                    <Icon name="arrow_forward" size={16} className="p-hub-arrow" />
                  </div>

                  {c.skills ? (
                    /* Skills card uses chips instead of kv rows */
                    <div className="p-skills" style={{ flex: 1 }}>
                      {c.skills.slice(0, 6).map((s, i) => <PSkill key={i} name={s.name} w={s.w} />)}
                      <span className="chip" style={{ fontSize: 10 }}>+{c.skills.length - 6}</span>
                    </div>
                  ) : (
                    <div className="p-hub-summary">
                      {c.rows.map((r, i) => (
                        <div key={i} className="kv">
                          <span className="label-mini">{r.k}</span>
                          <span className="val">{r.v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-hub-meta" style={{ color: c.meta.color }}>
                    <Icon name={c.meta.icon} size={13} fill style={{ color: c.meta.color }} />
                    <span>{c.meta.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </ProfileShell>
    </div>
  );
}

Object.assign(window, { ProfileHub });
