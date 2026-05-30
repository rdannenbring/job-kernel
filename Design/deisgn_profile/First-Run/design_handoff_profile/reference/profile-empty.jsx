/* global React */
/* Full-page EMPTY / first-run Profile — Variation A (anchored rail) shell.
   This is a FULL PAGE, not a modal: same rail + same six sections as the
   populated profile, each rendered in its first-run empty state. */

// One section's empty affordance
function PEmptyZone({ icon, title, body, reward, matching, actions, ghost }) {
  return (
    <div className="p-empty-zone">
      <div className="p-empty-zone-icon"><Icon name={icon} size={20} /></div>
      <div className="p-empty-zone-text">
        <h4>
          {title}
          {matching && <MatchChip size="tiny" />}
          {reward && <span className="p-reward"><Icon name="trending_up" size={11} /> {reward} readiness</span>}
        </h4>
        <p>{body}</p>
        {ghost && (
          <div className="p-ghost-chips">
            {ghost.map((w, i) => <span key={i} className="p-ghost-chip" style={{ width: w }} />)}
          </div>
        )}
      </div>
      <div className="p-empty-zone-actions">{actions}</div>
    </div>
  );
}

function ProfileEmptyFull({ theme = 'light', density = 'comfy', showMatchChips = true }) {
  const sections = window.PROFILE_SECTIONS;

  return (
    <div className={`p-artboard ${density === 'compact' ? 'is-compact' : density === 'relaxed' ? 'is-relaxed' : ''}`}>
      <ProfileShell theme={theme}>
        <div className="p-shell">
          {/* ─── Rail — empty variant ─── */}
          <aside className="p-rail">
            <div className="p-rail-ident">
              <div className="p-avatar is-placeholder"><Icon name="person" size={18} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="p-rail-name" style={{ color: 'var(--txt-mute)' }}>Your name</div>
                <div className="p-rail-sub">Not set</div>
              </div>
            </div>

            <div className="p-rail-comp">
              <ScoreRing score={8} size={40} />
              <div className="p-rail-comp-text">
                <span className="p-rail-comp-pct">8%</span>
                <span className="p-rail-comp-lab">Profile readiness</span>
              </div>
            </div>

            <div>
              <div className="p-rail-group">Finish setup</div>
              <div className="p-rail-list">
                {sections.map((s, i) => (
                  <div key={s.id} className={`p-rail-item ${i === 0 ? 'is-active' : ''}`}>
                    <Icon name={s.icon} size={16} fill={i === 0} />
                    <span>{s.label}</span>
                    {/* every section is empty → hollow dot pip */}
                    <span className="p-rail-pip is-empty">
                      <Icon name="radio_button_unchecked" size={11} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: 11, color: 'var(--txt-mute)', fontWeight: 600, lineHeight: 1.5,
                padding: '10px 10px', background: 'var(--bg)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)' }}>
                <Icon name="lightbulb" size={13} style={{ color: 'var(--warn)', verticalAlign: '-2px' }} />
                {' '}Importing a resume fills most of this in one step.
              </div>
            </div>
          </aside>

          {/* ─── Content ─── */}
          <main className="p-main">
            {/* Guidance hero */}
            <div className="p-empty-hero">
              <ScoreRing score={8} size={76} />
              <div className="p-empty-hero-text">
                <h2>Let's build your profile</h2>
                <p>JobKernel scores and tailors every application against your profile. Start
                  by importing a resume — we'll auto-fill your identity, skills, and experience —
                  then refine the bits that drive your Match Score.</p>
              </div>
            </div>

            {/* The three ways to start */}
            <div className="p-methods">
              <button className="p-method is-primary">
                <span className="p-method-tag">Fastest</span>
                <div className="p-method-icon"><Icon name="upload_file" size={18} /></div>
                <div className="p-method-title">Import a resume</div>
                <div className="p-method-sub">PDF or DOCX. We parse identity, skills, and work history automatically.</div>
                <div className="p-method-foot">Upload <Icon name="arrow_forward" size={12} /></div>
              </button>
              <button className="p-method">
                <div className="p-method-icon" style={{ background: '#0a66c2', color: 'white' }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>in</span>
                </div>
                <div className="p-method-title">Connect LinkedIn</div>
                <div className="p-method-sub">Pull your headline, roles, and connections in one click.</div>
                <div className="p-method-foot">Connect <Icon name="arrow_forward" size={12} /></div>
              </button>
              <button className="p-method">
                <div className="p-method-icon"><Icon name="edit_note" size={18} /></div>
                <div className="p-method-title">Fill in manually</div>
                <div className="p-method-sub">Prefer to type it yourself? Start with the section below.</div>
                <div className="p-method-foot">Start <Icon name="arrow_forward" size={12} /></div>
              </button>
            </div>

            {/* Quick-wins checklist — the spine the user liked */}
            <PSection icon="task_alt" title="Quick wins"
              sub="Each item adds to your readiness and improves every Match Score."
              actions={<span className="chip">0 of 10 done</span>}>
              <PChecklist limit={6} />
            </PSection>

            {/* ─── The six sections, all in first-run empty state ─── */}
            <PBand kind="match" icon="auto_awesome" label="Match profile · feeds your score" count="Not set yet" />

            <PSection id="identity" icon="person" title="Identity"
              sub="Name, contact, headline, and links the agent uses to author messages."
              actions={<button className="btn btn-sm btn-primary"><Icon name="add" size={13} /> Add details</button>}>
              <PEmptyZone icon="badge"
                title="No identity yet"
                reward="+23"
                body="Add your name, email, location, and a one-line headline. Imported resumes fill this automatically."
                ghost={['120px', '90px', '160px']}
                actions={<>
                  <button className="btn btn-sm"><Icon name="upload_file" size={13} /> From resume</button>
                  <button className="btn btn-sm btn-primary">Add manually</button>
                </>} />
            </PSection>

            <PSection id="match" icon="auto_awesome" title="Career & compensation"
              sub="What you're looking for. Drives every Match Score on Pulse."
              affectsMatching={showMatchChips}
              actions={<button className="btn btn-sm btn-primary"><Icon name="add" size={13} /> Set targets</button>}>
              <PEmptyZone icon="my_location"
                title="No target roles or compensation set"
                matching={showMatchChips}
                reward="+20"
                body="Tell the agent the roles, seniority, work authorization, and salary range you want. Until this is set, Pulse can't rank jobs for you."
                ghost={['140px', '100px', '120px', '80px']}
                actions={<button className="btn btn-sm btn-primary">Set targets</button>} />
            </PSection>

            <PSection id="skills" icon="bolt" title="Skills"
              sub="Weighted skills tell the agent what to highlight first."
              affectsMatching={showMatchChips}
              actions={<button className="btn btn-sm"><Icon name="upload_file" size={13} /> Auto-fill from resume</button>}>
              <PEmptyZone icon="bolt"
                title="No skills added"
                matching={showMatchChips}
                reward="+15"
                body="Import a resume to auto-detect skills, then weight the ones that matter most (Core / Strong / Like)."
                ghost={['90px', '70px', '110px', '60px', '80px']}
                actions={<>
                  <button className="btn btn-sm"><Icon name="upload_file" size={13} /> From resume</button>
                  <button className="btn btn-sm btn-primary"><Icon name="add" size={13} /> Add skill</button>
                </>} />
            </PSection>

            <PSection id="ai" icon="neurology" title="AI generation"
              sub="How the agent writes resumes, cover letters, and outreach in your voice."
              actions={<button className="btn btn-sm btn-primary">Set voice</button>}>
              <PEmptyZone icon="record_voice_over"
                title="Using default voice"
                reward="+14"
                body="Add 1–3 writing samples and a few phrases to avoid, so generated drafts sound like you and not a template."
                ghost={['100%']}
                actions={<button className="btn btn-sm btn-primary">Add a voice sample</button>} />
            </PSection>

            <PSection id="documents" icon="folder" title="Documents"
              sub="Master resumes, base cover letters, and the context bank the agent pulls from."
              actions={<button className="btn btn-sm btn-primary"><Icon name="cloud_upload" size={13} /> Upload</button>}>
              <div className="p-dropzone">
                <div className="p-dropzone-icon"><Icon name="cloud_upload" size={22} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-2)' }}>
                  Drop your master resume here, or click to browse
                </div>
                <div style={{ fontSize: 12 }}>PDF or DOCX up to 10MB · we'll set it as your default</div>
                <div style={{ marginTop: 4 }}>
                  <span className="p-reward"><Icon name="trending_up" size={11} /> +20 readiness</span>
                </div>
              </div>
            </PSection>

            <PSection id="integrations" icon="link" title="Integrations"
              sub="Connect the apps the agent reads from and writes to.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { initials: 'in', name: 'LinkedIn', sub: 'Headline, roles, connections', brand: '#0a66c2' },
                  { initials: 'M',  name: 'Gmail', sub: 'Track outreach replies', brand: null },
                  { initials: 'JK', name: 'Browser Extension', sub: 'Capture jobs with one click', brand: null },
                ].map((i, k) => (
                  <div key={k} className="p-int">
                    <div className="p-int-icon" style={i.brand ? { background: i.brand, color: 'white', border: 0 } : {}}>{i.initials}</div>
                    <div className="p-int-text">
                      <div className="p-int-name">{i.name}</div>
                      <div className="p-int-sub">{i.sub}</div>
                    </div>
                    <div className="p-int-status"><span className="dot" style={{ background: 'var(--txt-faint)' }} /> Disconnected</div>
                    <button className="btn btn-sm btn-primary"><Icon name="link" size={13} /> Connect</button>
                  </div>
                ))}
              </div>
            </PSection>

            <PSection id="account" icon="credit_card" title="Account & plan"
              sub="You're on the Free plan. Upgrade any time.">
              <div className="p-plan">
                <span className="p-plan-badge" style={{ background: 'var(--txt-2)' }}>Free</span>
                <div className="p-plan-meter">
                  <div className="p-plan-meter-bar"><i style={{ width: '0%' }} /></div>
                  <div className="p-plan-meter-text">
                    <span>0 / 10 generations</span>
                    <span>$0/mo</span>
                  </div>
                </div>
                <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>
                  <Icon name="bolt" size={13} /> Upgrade to Pro
                </button>
              </div>
            </PSection>
          </main>
        </div>
      </ProfileShell>
    </div>
  );
}

Object.assign(window, { ProfileEmptyFull, PEmptyZone });
