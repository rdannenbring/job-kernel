/* global React */
/* Variation B — Split-pane (macOS Settings) — section list left, one section visible right */

function ProfileSplit({ theme = 'light', density = 'comfy', showMatchChips = true, isEditing = false, activeSection = 'match' }) {
  const P = window.PROFILE;

  return (
    <div className={`p-artboard ${density === 'compact' ? 'is-compact' : density === 'relaxed' ? 'is-relaxed' : ''}`}>
      <ProfileShell theme={theme} isEditing={isEditing}>
        <div className="p-shell is-split">
          {/* ─── Left section list ─── */}
          <aside className="p-split-rail">
            <div className="p-split-search">
              <Icon name="search" size={13} />
              <input placeholder="Find a setting…" />
              <span className="lbar-kbd">⌘K</span>
            </div>

            <div className="p-split-item">
              <Icon name="home" size={16} />
              <span>Overview</span>
            </div>

            <div className="p-split-divider" />

            {window.PROFILE_SECTIONS.map(s => (
              <div key={s.id} className={`p-split-item ${activeSection === s.id ? 'is-active' : ''}`}>
                <Icon name={s.icon} size={16} fill={activeSection === s.id} />
                <span>{s.label}</span>
                {s.affectsMatching && <span className="match-chip is-tiny" style={{ marginLeft: 'auto', padding: '1px 5px' }}>
                  <Icon name="auto_awesome" size={9} fill /> Match
                </span>}
                {s.attention && <span className="pip" style={{ background: 'var(--warn-soft)', color: 'var(--warn)',
                  padding: '1px 6px', borderRadius: 999, fontWeight: 800 }}>{s.attention}</span>}
              </div>
            ))}

            <div className="p-split-divider" />

            <div className="p-split-item" style={{ color: 'var(--danger)' }}>
              <Icon name="logout" size={16} />
              <span>Sign out</span>
            </div>

            <div style={{ marginTop: 'auto', padding: '14px 18px 4px', borderTop: '1px solid var(--line-soft)' }}>
              <div className="p-rail-comp" style={{ padding: 10 }}>
                <ScoreRing score={P.completeness} size={36} />
                <div className="p-rail-comp-text">
                  <span className="p-rail-comp-pct" style={{ fontSize: 16 }}>{P.completeness}%</span>
                  <span className="p-rail-comp-lab" style={{ fontSize: 9 }}>Ready</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ─── Right detail (Match profile active) ─── */}
          <main className="p-main is-narrow">
            {/* Detail header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
              paddingBottom: 4 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 className="p-hero-name" style={{ fontSize: 22 }}>Match profile</h1>
                  <MatchChip />
                </div>
                <div className="p-hero-headline" style={{ marginTop: 4 }}>
                  Everything in this section feeds your Match Score. Higher fidelity → better Pulse ranking.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ScoreRing score={86} size={56} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className="p-hero-comp-lab">Avg match</span>
                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>+3 last 30 days</span>
                </div>
                <button className="btn btn-sm btn-primary"><Icon name="edit" size={13} /> Edit section</button>
              </div>
            </div>

            <PSection id="career" icon="auto_awesome" title="Career"
              sub="Roles, level, and authorization.">
              <div className="p-field-grid">
                <PField label="Target roles" affectsMatching={showMatchChips}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {P.targetRoles.map((r, i) => <span key={i} className="chip">{r}</span>)}
                    <button className="p-skill-add" style={{ padding: '2px 8px' }}>
                      <Icon name="add" size={11} /> Add
                    </button>
                  </div>
                </PField>
                <PField label="Seniority" value={P.seniority} affectsMatching={showMatchChips} />
                <PField label="Years experience" value={`${P.yearsExp} yrs`} affectsMatching={showMatchChips} />
                <PField label="Work authorization" value={P.workAuth} affectsMatching={showMatchChips} />
                <PField label="Remote / hybrid" affectsMatching={showMatchChips}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {P.remotePref.map((r, i) => <span key={i} className="chip chip-blue">{r}</span>)}
                  </div>
                </PField>
                <PField label="Relocation" value={P.relocation} affectsMatching={showMatchChips} />
              </div>
            </PSection>

            <PSection id="comp" icon="payments" title="Compensation"
              sub="Used on Pulse's salary chip and to filter out off-band roles.">
              <div className="p-field-grid">
                <PField label="Base range" affectsMatching={showMatchChips}>
                  <span className="salary-chip">
                    <Icon name="payments" size={11} />
                    ${(P.comp.min/1000).toFixed(0)}k – ${(P.comp.max/1000).toFixed(0)}k {P.comp.currency}
                  </span>
                </PField>
                <PField label="Equity" value={P.comp.equity} affectsMatching={showMatchChips} />
                <PField label="Currency" value={P.comp.currency} affectsMatching={showMatchChips} />
                <PField label="Negotiable" affectsMatching={showMatchChips}>
                  <span className="chip chip-green">
                    <Icon name="check" size={11} /> Open to negotiation
                  </span>
                </PField>
              </div>
            </PSection>

            <PSection id="skills" icon="bolt" title="Skills & expertise"
              sub={`${P.skills.length} skills · click any to set weight.`}
              affectsMatching={showMatchChips}
              actions={<>
                <button className="btn btn-sm"><Icon name="upload_file" size={13} /> From resume</button>
                <button className="btn btn-sm btn-primary"><Icon name="add" size={13} /> Add</button>
              </>}>
              <div className="p-skills">
                {P.skills.map((s, i) => <PSkill key={i} name={s.name} w={s.w} />)}
                <button className="p-skill-add"><Icon name="add" size={11} /> Add skill</button>
              </div>
              {/* Score impact preview footer */}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <Icon name="trending_up" size={16} style={{ color: 'var(--success)' }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--txt-2)' }}>
                  Adding <b>"LLM Orchestration"</b> as a Core skill bumped your average match by
                </div>
                <ScoreDelta delta={3} />
              </div>
            </PSection>
          </main>
        </div>
      </ProfileShell>
    </div>
  );
}

Object.assign(window, { ProfileSplit });
