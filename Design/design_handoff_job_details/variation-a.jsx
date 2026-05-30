/* global React */

// ─── Variation A — Compact Strip + Vertical Pipeline ───────────
// Refined: removed the doubled-up horizontal pipeline+tabs row.
// The vertical rail (from B) is now the single pipeline+stage
// navigator, sitting alongside the action workspace.

function VariationA({ density = 'comfy', theme = 'light' }) {
  const [activeStageIdx, setActiveStageIdx] = React.useState(0);
  const [activeSub, setActiveSub] = React.useState('analysis');
  const [interest, setInterest] = React.useState(2);
  const isCompact = density === 'compact';

  const salary = '$185k – $240k'; // demo: showing the populated state
  const salaryUnlisted = false;

  const meta = [
    { icon: 'location_on', label: 'United States · Remote' },
    { icon: 'work', label: 'Full-time' },
    { icon: 'event', label: 'Posted 2026-05-16' },
    { icon: 'open_in_new', label: 'Visit Listing', link: true },
    { icon: 'rocket_launch', label: 'Direct Apply', link: true },
  ];

  return (
    <AppShell theme={theme}>
      <div className={isCompact ? 'is-compact' : ''} style={{ padding: '16px 24px 24px', minHeight: '100%' }}>

        {/* ── Header card (identity + meta + docs + score) ── */}
        <div className="card card-pad" style={{ padding: isCompact ? '14px 16px' : '16px 18px', marginBottom: 14 }}>
          <div className="row gap-4" style={{ alignItems: 'flex-start' }}>
            <CompanyLogo size={isCompact ? 44 : 52} initials="PRI" />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row gap-3" style={{ marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: isCompact ? 18 : 22, fontWeight: 800, lineHeight: 1.2, color: 'var(--txt)' }}>
                  Senior Lead Software Architect
                </h1>
                <StatusPill status="Saved" />
              </div>
              <div className="row gap-3" style={{ marginBottom: 8, color: 'var(--txt-mute)', fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
                <span>PRI Technology <Icon name="arrow_outward" size={13} className="dim" /></span>

                {/* Salary — prominent inline */}
                <span className={`salary-chip ${salaryUnlisted ? 'is-unlisted' : ''}`}>
                  <Icon name="payments" size={13} fill={!salaryUnlisted} />
                  {salaryUnlisted ? 'Salary not listed' : salary}
                </span>

                {/* Interest stars — prominent inline */}
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <span className="label" style={{ fontSize: 9 }}>Interest</span>
                  <InterestStars value={interest} onChange={setInterest} size={14} />
                </div>
              </div>
              <MetaInline items={meta} compact={isCompact} />

              {/* Docs row — visually separated by a divider + soft band, with a "View full details" affordance */}
              <div className="header-divider" />
              <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="label" style={{ alignSelf: 'center' }}>Docs</span>
                <DocsCluster variant="chips" />
                <button className="btn btn-sm view-details" style={{ marginLeft: 'auto' }}>
                  <Icon name="article" size={14} /> View full job details
                  <Icon name="chevron_right" size={14} />
                </button>
              </div>
            </div>
            <div className="col gap-2" style={{ alignItems: 'flex-end' }}>
              <ScoreRing score={86} size={isCompact ? 52 : 60} />
              <div className="chip chip-green" style={{ fontSize: 10 }}>
                <Icon name="arrow_upward" size={10} /> 3 vs avg
              </div>
            </div>
          </div>
        </div>

        {/* ── Workspace: vertical pipeline + action content ── */}
        <div className="row gap-3" style={{ alignItems: 'flex-start' }}>

          {/* LEFT — vertical pipeline rail (the single pipeline + stage nav) */}
          <div className="card" style={{ width: 240, padding: 10, flexShrink: 0 }}>
            <div className="row" style={{ padding: '4px 8px 8px' }}>
              <span className="label">Pipeline</span>
            </div>
            <div className="vrail">
              {window.STAGES.map((s, i) => {
                const passed = i < activeStageIdx;
                const current = i === activeStageIdx;
                const cls = passed ? 'is-passed' : current ? 'is-current' : '';
                return (
                  <React.Fragment key={s.id}>
                    <div className={`vstep ${cls}`} onClick={() => setActiveStageIdx(i)}>
                      <div className="vnode" />
                      <div className="vname">{s.label}</div>
                      <div className="vsub">{s.subDone}/{s.subCount} {current ? '· in progress' : passed ? '· done' : ''}</div>
                    </div>
                    {/* Sub-stage nest under current */}
                    {current && (
                      <div className="vsubs">
                        {window.SAVED_SUBSTAGES.map(ss => (
                          <div key={ss.id}
                            onClick={(e) => { e.stopPropagation(); setActiveSub(ss.id); }}
                            className={`vsub ${ss.id === activeSub ? 'is-active' : ''} ${ss.done ? 'is-done' : ''}`}>
                            <Icon name={ss.done ? 'check_circle' : ss.icon} size={12}
                              className={ss.done ? 'check' : ''} fill={ss.id === activeSub} />
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ss.label}
                            </span>
                            {ss.current && <span className="pip" style={{ color: 'var(--primary)' }}>•</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Terminal / end states ── */}
            <div className="rail-divider">
              <span>End states</span>
            </div>
            <div className="col" style={{ gap: 2, padding: '0 4px' }}>
              {window.BRANCH_STAGES.map(b => (
                <button key={b.id} className="end-state" title={`Move to ${b.label}`}>
                  <Icon name={b.icon} size={14} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{b.label}</span>
                  <Icon name="arrow_outward" size={12} className="end-state-arrow" />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT — action workspace */}
          <div className="flex-1 col gap-3" style={{ minWidth: 0 }}>
            <NextAction compact={isCompact} />
            <SubStageContent activeSubId={activeSub} compact={isCompact} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

window.VariationA = VariationA;
