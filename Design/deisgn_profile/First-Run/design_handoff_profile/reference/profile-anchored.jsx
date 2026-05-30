/* global React */
/* Variation A — Anchored rail + single scroll content */

function ProfileAnchored({ theme = 'light', density = 'comfy', showMatchChips = true, isEditing = false, activeSection = 'identity' }) {
  const P = window.PROFILE;

  return (
    <div className={`p-artboard ${density === 'compact' ? 'is-compact' : density === 'relaxed' ? 'is-relaxed' : ''}`}>
      <ProfileShell theme={theme} isEditing={isEditing}>
        <div className="p-shell">
          {/* ─── Left anchored rail ─── */}
          <aside className="p-rail">
            <div className="p-rail-ident">
              <div className="p-avatar">{P.initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="p-rail-name">{P.displayName}</div>
                <div className="p-rail-sub">{P.location}</div>
              </div>
            </div>

            <div className="p-rail-comp">
              <ScoreRing score={P.completeness} size={40} />
              <div className="p-rail-comp-text">
                <span className="p-rail-comp-pct">{P.completeness}%</span>
                <span className="p-rail-comp-lab">Profile readiness</span>
              </div>
            </div>

            <div>
              <div className="p-rail-group">Profile</div>
              <div className="p-rail-list">
                {window.PROFILE_SECTIONS.map(s => (
                  <div key={s.id} className={`p-rail-item ${activeSection === s.id ? 'is-active' : ''} ${s.attention ? 'is-attention' : ''}`}>
                    <Icon name={s.icon} size={16} fill={activeSection === s.id} />
                    <span>{s.label}</span>
                    {s.affectsMatching && <span className="p-rail-pip">86</span>}
                    {s.attention && !s.affectsMatching && <span className="p-rail-pip">{s.attention}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-sm" style={{ justifyContent: 'flex-start' }}>
                <Icon name="download" size={14} /> Export profile
              </button>
              <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}>
                <Icon name="logout" size={14} /> Sign out
              </button>
            </div>
          </aside>

          {/* ─── Main column ─── */}
          <main className="p-main">
            <ProfileHero showDelta={false} />

            {/* IDENTITY */}
            <PSection id="identity" icon="person" title="Identity"
              sub="Name, contact, and links the agent uses to author messages."
              actions={<button className="btn btn-sm"><Icon name="edit" size={13} /> Edit</button>}>
              <div className="p-field-grid">
                <PField label="Display name" value={P.displayName} />
                <PField label="Headline" value={P.headline} />
                <PField label="Email" value={P.email} />
                <PField label="Phone" value={P.phone} />
                <PField label="Location" value={P.location} affectsMatching={showMatchChips} />
                <PField label="Work auth" value={P.workAuth} affectsMatching={showMatchChips} />
              </div>
              <div style={{ height: 12 }} />
              <div className="p-field-grid is-1">
                <PField label="Bio / summary" multi value={P.bio} />
              </div>
              <div style={{ height: 12 }} />
              <div className="p-field-grid is-3">
                <PField label="LinkedIn"><span style={{ color: 'var(--primary)' }}>{P.links.linkedin}</span></PField>
                <PField label="GitHub"><span style={{ color: 'var(--primary)' }}>{P.links.github}</span></PField>
                <PField label="Portfolio"><span style={{ color: 'var(--primary)' }}>{P.links.portfolio}</span></PField>
              </div>
            </PSection>

            {/* MATCH PROFILE — banded as feeding the score */}
            <PBand kind="match" icon="auto_awesome" label="Match profile · feeds your score" count={`Score 86 · top quartile`} />

            <PSection id="match" icon="auto_awesome" title="Career & compensation"
              sub="What you're looking for. Drives every Match Score on Pulse."
              affectsMatching={showMatchChips}
              actions={<button className="btn btn-sm"><Icon name="edit" size={13} /> Edit</button>}>
              <div className="p-field-grid">
                <PField label="Target roles" affectsMatching={showMatchChips}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {P.targetRoles.map((r, i) => (
                      <span key={i} className="chip">{r}</span>
                    ))}
                  </div>
                </PField>
                <PField label="Seniority" value={P.seniority} affectsMatching={showMatchChips} />
                <PField label="Years of experience" value={`${P.yearsExp} years`} affectsMatching={showMatchChips} />
                <PField label="Remote / hybrid" affectsMatching={showMatchChips}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {P.remotePref.map((r, i) => <span key={i} className="chip chip-blue">{r}</span>)}
                  </div>
                </PField>
                <PField label="Relocation" value={P.relocation} affectsMatching={showMatchChips} />
                <PField label="Compensation" affectsMatching={showMatchChips}>
                  <span className="salary-chip">
                    <Icon name="payments" size={11} />
                    ${(P.comp.min/1000).toFixed(0)}k – ${(P.comp.max/1000).toFixed(0)}k {P.comp.currency}
                  </span>
                  {P.comp.negotiable && <span className="chip" style={{ marginLeft: 6 }}>Negotiable</span>}
                </PField>
              </div>
            </PSection>

            <PSection id="skills" icon="bolt" title="Skills"
              sub={`${P.skills.length} skills · weights tell the agent what to highlight first.`}
              affectsMatching={showMatchChips}
              actions={<>
                <button className="btn btn-sm"><Icon name="sort" size={13} /> Weight</button>
                <button className="btn btn-sm btn-primary"><Icon name="add" size={13} /> Add</button>
              </>}>
              <div className="p-skills">
                {P.skills.map((s, i) => <PSkill key={i} name={s.name} w={s.w} />)}
                <button className="p-skill-add"><Icon name="add" size={11} /> Add skill</button>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--txt-mute)', display: 'flex', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span className="p-skill-weight" style={{ background: 'var(--primary)', color: 'white' }}>Core</span>
                  Highlighted first; counts 3× toward score
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span className="p-skill-weight" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--primary-edge)' }}>Strong</span>
                  Counts 2×
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span className="p-skill-weight">Like</span>
                  Counts 1×
                </span>
              </div>
            </PSection>

            {/* AI generation */}
            <PSection id="ai" icon="neurology" title="AI generation"
              sub="How the agent writes resumes, cover letters, and outreach in your voice."
              actions={<button className="btn btn-sm"><Icon name="edit" size={13} /> Edit</button>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="p-field-label" style={{ marginBottom: 8 }}>Tone</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <ToneSlider left="Casual" right="Formal" value={P.ai.formality} />
                    <ToneSlider left="Concise" right="Detailed" value={P.ai.detail} />
                  </div>
                </div>
                <div>
                  <div className="p-field-label" style={{ marginBottom: 8 }}>Voice samples
                    <span className="chip" style={{ fontSize: 9, padding: '1px 6px' }}>{P.ai.voiceSamples.length} / 5</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {P.ai.voiceSamples.map((s, i) => (
                      <VoiceSample key={i} text={s} source={i === 0 ? 'Architecture review · 2025' : 'Blog post · 2024'} />
                    ))}
                    <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
                      <Icon name="add" size={13} /> Add sample
                    </button>
                  </div>
                </div>
                <div>
                  <div className="p-field-label" style={{ marginBottom: 8 }}>Things to avoid</div>
                  <PTagInput tags={P.ai.avoid} placeholder="Add a phrase…" />
                </div>
              </div>
            </PSection>

            {/* Documents */}
            <PSection id="documents" icon="folder" title="Documents"
              sub="Master resumes, base cover letters, and the context bank the agent pulls from."
              actions={<>
                <button className="btn btn-sm"><Icon name="cloud_upload" size={13} /> Upload</button>
                <button className="btn btn-sm btn-primary"><Icon name="open_in_full" size={13} /> Open library</button>
              </>}>
              <div className="p-doc-grid">
                {P.docs.slice(0, 4).map(d => <PDoc key={d.id} doc={d} />)}
                <PDocEmpty label="Add a document" sub="PDF, DOCX up to 10MB" />
              </div>
            </PSection>

            {/* Integrations */}
            <PSection id="integrations" icon="link" title="Integrations"
              sub="Connect the apps the agent reads from and writes to.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {P.integrations.map(i => <PIntegration key={i.id} integration={i} />)}
              </div>
            </PSection>

            {/* Account */}
            <PSection id="account" icon="credit_card" title="Account & plan"
              sub="Billing, usage, notifications, and data controls.">
              <div className="p-plan">
                <span className="p-plan-badge">{P.plan.name}</span>
                <div className="p-plan-meter">
                  <div className="p-plan-meter-bar"><i style={{ width: `${P.plan.used.gens / P.plan.cap.gens * 100}%` }} /></div>
                  <div className="p-plan-meter-text">
                    <span>{P.plan.used.gens} / {P.plan.cap.gens} generations</span>
                    <span>{P.plan.price}</span>
                  </div>
                </div>
                <button className="btn btn-sm" style={{ marginLeft: 'auto' }}>Manage billing</button>
              </div>
              <div style={{ height: 14 }} />
              <div className="p-field-grid">
                <PField label="Application limit" value={`${P.plan.used.applications} / ${P.plan.cap.applications}`} />
                <PField label="Context bank" value={`${P.plan.used.contextBank} / ${P.plan.cap.contextBank} docs`} />
                <PField label="Email digests" value="Weekly, Sunday 7pm" />
                <PField label="Quiet hours" value="9pm – 7am · America/New_York" />
              </div>
              <div style={{ height: 14 }} />
              <div className="p-danger">
                <Icon name="warning" size={20} style={{ color: 'var(--danger)' }} />
                <div className="p-danger-text">
                  <strong>Danger zone</strong>
                  <p>Export everything, or permanently delete your account and all tracked applications.</p>
                </div>
                <button className="btn btn-sm">Export data</button>
                <button className="btn btn-sm btn-danger">Delete account</button>
              </div>
            </PSection>
          </main>
        </div>
      </ProfileShell>
    </div>
  );
}

Object.assign(window, { ProfileAnchored });
