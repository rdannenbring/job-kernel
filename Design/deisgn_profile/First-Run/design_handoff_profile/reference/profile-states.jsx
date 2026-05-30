/* global React */
/* Interaction state artboards — small focused frames showing single states */

// 1. Section edit mode (save/cancel)
function StateEdit({ theme = 'light' }) {
  const P = window.PROFILE;
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)', borderRadius: 0 }}>
        <PCap icon="edit">Edit mode · save/cancel</PCap>
        <div style={{ paddingTop: 48, paddingLeft: 0, paddingRight: 0 }}>
          <PSection icon="auto_awesome" title="Career" sub="Roles, level, and authorization."
            affectsMatching
            actions={<>
              <button className="btn btn-sm">Cancel</button>
              <button className="btn btn-sm btn-primary"><Icon name="check" size={13} /> Save</button>
            </>}>
            <div className="p-field-grid">
              <PFieldInput label="Target roles" value="Senior Solutions Architect, Staff Engineer…" affectsMatching />
              <PFieldInput label="Seniority" value="Senior / Staff (10+ yrs)" affectsMatching />
              <PFieldInput label="Years experience" value="20" affectsMatching />
              <PFieldInput label="Work auth" value="US Citizen" affectsMatching />
            </div>
            <div style={{ height: 12 }} />
            <div className="p-field-grid is-1">
              <PFieldInput label="Additional notes for the agent" multi
                placeholder="e.g. willing to consider mid-career swaps to AI infra…" />
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--primary-soft)',
              border: '1px solid var(--primary-edge)', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <Icon name="info" size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ color: 'var(--txt-2)', flex: 1 }}>
                These fields will rescore your <b>34 saved jobs</b> on save.
              </span>
              <ScoreDelta delta={3} />
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

// 2. Inline-edit popover (skill weight)
function StateInlinePopover({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="touch_app">Inline popover · skill weight</PCap>
        <div style={{ paddingTop: 48 }}>
          <PSection icon="bolt" title="Skills" sub="Click any chip to change its weight."
            affectsMatching>
            <div className="p-skills" style={{ position: 'relative' }}>
              {window.PROFILE.skills.slice(0, 10).map((s, i) => (
                <PSkill key={i} name={s.name} w={s.w} />
              ))}
            </div>

            {/* Popover */}
            <div style={{ position: 'relative', marginTop: 0 }}>
              <div className="popover" style={{ position: 'absolute', top: -38, left: 200,
                width: 220, padding: 8 }}>
                <div className="popover-label">Weight · "Azure"</div>
                <div className="pop-weight">
                  <button className="pop-weight-btn">Like<br /><span style={{ fontSize: 9, fontWeight: 600, color: 'var(--txt-mute)' }}>1×</span></button>
                  <button className="pop-weight-btn">Strong<br /><span style={{ fontSize: 9, fontWeight: 600, color: 'var(--txt-mute)' }}>2×</span></button>
                  <button className="pop-weight-btn is-active">Core<br /><span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>3×</span></button>
                </div>
                <div className="popover-divider" />
                <div className="popover-item is-danger">
                  <Icon name="delete" size={14} />
                  Remove skill
                  <span className="popover-shortcut">⌫</span>
                </div>
                <div style={{ padding: '6px 8px 2px', fontSize: 10, color: 'var(--txt-mute)',
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="trending_up" size={11} style={{ color: 'var(--success)' }} />
                  Strong → Core changes your score by
                  <ScoreDelta delta={2} />
                </div>
              </div>
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

// 3. Confirm modal (destructive)
function StateConfirm({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)', overflow: 'hidden' }}>
        <PCap icon="warning">Destructive confirm · delete account</PCap>

        {/* Faded background content */}
        <div style={{ padding: '48px 20px 20px', filter: 'blur(2px)', opacity: 0.6 }}>
          <PSection icon="credit_card" title="Account & plan" sub="Billing, usage, data controls.">
            <div className="p-danger">
              <Icon name="warning" size={20} style={{ color: 'var(--danger)' }} />
              <div className="p-danger-text">
                <strong>Danger zone</strong>
                <p>Export everything, or permanently delete your account.</p>
              </div>
              <button className="btn btn-sm btn-danger">Delete account</button>
            </div>
          </PSection>
        </div>

        {/* Modal */}
        <div className="modal-bd">
          <div className="modal-card">
            <div className="modal-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <Icon name="delete_forever" size={20} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>
              Delete your JobKernel account?
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--txt-mute)', lineHeight: 1.5 }}>
              This permanently removes <b>34 tracked applications</b>, your master resume,
              context bank, and AI generation history. We'll email you a final data export.
            </p>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div className="p-field-label" style={{ marginBottom: 4 }}>Type DELETE to confirm</div>
              <input className="p-field-input" placeholder="DELETE" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm">Cancel</button>
              <button className="btn btn-sm btn-danger">
                <Icon name="delete_forever" size={13} /> Delete account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Document upload (drag-drop + progress + done)
function StateUpload({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="cloud_upload">Document upload · drop / uploading / done</PCap>
        <div style={{ paddingTop: 48 }}>
          <PSection icon="folder" title="Documents" sub="Resumes, cover letters, context bank.">
            <div className="p-doc-grid">
              {/* Drop target — hovered state */}
              <div className="p-dropzone is-active" style={{ gridColumn: 'span 2' }}>
                <div className="p-dropzone-icon"><Icon name="cloud_upload" size={22} /></div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Drop "resume-v3.pdf" to upload</div>
                <div style={{ fontSize: 12 }}>PDF or DOCX · 2.4MB</div>
              </div>

              {/* In-progress doc */}
              <div className="p-doc">
                <div className="p-doc-head">
                  <div className="p-doc-icon"><Icon name="description" size={16} /></div>
                  <div className="p-doc-text">
                    <div className="p-doc-name">long-resume-v2.pdf</div>
                    <div className="p-doc-sub">Uploading · 62%</div>
                  </div>
                </div>
                <div className="p-doc-upload"><i style={{ width: '62%' }} /></div>
                <div className="p-doc-foot">
                  <Icon name="schedule" size={11} />
                  <span>3s remaining</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--primary)', cursor: 'pointer' }}>Cancel</span>
                </div>
              </div>

              {/* Just-uploaded (done flash) */}
              <div className="p-doc" style={{ borderColor: 'rgba(5,150,105,0.40)',
                boxShadow: '0 0 0 3px rgba(5,150,105,0.10)' }}>
                <div className="p-doc-head">
                  <div className="p-doc-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    <Icon name="check" size={16} fill />
                  </div>
                  <div className="p-doc-text">
                    <div className="p-doc-name">cover-letter-base.docx</div>
                    <div className="p-doc-sub">Just uploaded · parsing structure…</div>
                  </div>
                </div>
                <div className="p-doc-foot">
                  <span className="chip chip-green" style={{ fontSize: 9, padding: '2px 6px' }}>
                    <Icon name="auto_awesome" size={9} /> Auto-detected: cover letter
                  </span>
                </div>
              </div>
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

// 5. Integration connect flow (3 states in one frame)
function StateIntegrations({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="link">Integrations · disconnected → connecting → connected</PCap>
        <div style={{ paddingTop: 48 }}>
          <PSection icon="link" title="Integrations" sub="One row per integration; three states.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Disconnected */}
              <div className="p-int">
                <div className="p-int-icon">C</div>
                <div className="p-int-text">
                  <div className="p-int-name">Google Calendar</div>
                  <div className="p-int-sub">Auto-schedule interview prep blocks · read-only</div>
                </div>
                <div className="p-int-status">
                  <span className="dot" style={{ background: 'var(--txt-faint)' }} />
                  Disconnected
                </div>
                <button className="btn btn-sm btn-primary">
                  <Icon name="link" size={13} /> Connect
                </button>
              </div>

              {/* Connecting */}
              <div className="p-int" style={{ borderColor: 'var(--primary-edge)' }}>
                <div className="p-int-icon" style={{ background: 'var(--primary-soft)',
                  borderColor: 'var(--primary-edge)', color: 'var(--primary)' }}>JK</div>
                <div className="p-int-text">
                  <div className="p-int-name">Browser Extension</div>
                  <div className="p-int-sub">Waiting for Chrome install · check the new tab…</div>
                </div>
                <div className="p-int-status is-connecting">
                  <span className="dot" />
                  Connecting…
                </div>
                <button className="btn btn-sm">Cancel</button>
              </div>

              {/* Connected */}
              <div className="p-int">
                <div className="p-int-icon" style={{ background: '#0a66c2', color: 'white', border: 0 }}>in</div>
                <div className="p-int-text">
                  <div className="p-int-name">LinkedIn</div>
                  <div className="p-int-sub">Posts, 1st/2nd-degree contacts, profile sync · since Apr 12</div>
                </div>
                <div className="p-int-status is-connected">
                  <span className="dot" />
                  Connected
                </div>
                <button className="btn btn-sm">Manage</button>
              </div>

              {/* Error / re-auth */}
              <div className="p-int" style={{ borderColor: 'rgba(220,38,38,0.30)',
                background: 'rgba(220,38,38,0.04)' }}>
                <div className="p-int-icon" style={{ background: 'var(--danger-soft)',
                  color: 'var(--danger)', border: 0 }}>M</div>
                <div className="p-int-text">
                  <div className="p-int-name">Gmail</div>
                  <div className="p-int-sub" style={{ color: 'var(--danger)' }}>
                    Token expired · reconnect to keep outreach replies tracked
                  </div>
                </div>
                <div className="p-int-status" style={{ color: 'var(--danger)' }}>
                  <span className="dot" />
                  Re-auth required
                </div>
                <button className="btn btn-sm btn-danger">Reconnect</button>
              </div>
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

// 6. Empty new-user state (completeness card prominent)
function StateEmpty({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="account_circle">Empty profile · brand-new user</PCap>
        <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Empty hero */}
          <div className="p-empty-hero">
            <ScoreRing score={12} size={72} />
            <div className="p-empty-hero-text">
              <h2>Let's get you to 100%</h2>
              <p>JobKernel works best with a Master Resume, your target roles, and one voice
                sample. Each step you finish nudges every Match Score across your saved jobs.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-primary">
                <Icon name="cloud_upload" size={14} /> Import from resume
              </button>
              <button className="btn btn-sm" style={{ justifyContent: 'center' }}>
                <Icon name="link" size={13} /> or from LinkedIn
              </button>
            </div>
          </div>

          {/* Checklist */}
          <PSection icon="task_alt" title="Quick wins"
            sub="Each item below adds to your Profile readiness score."
            actions={<button className="btn btn-sm btn-ghost"><Icon name="close" size={13} /> Dismiss</button>}>
            <PChecklist limit={7} />
          </PSection>
        </div>
      </div>
    </div>
  );
}

// 7. Score impact preview — animated delta callout
function StateScoreDelta({ theme = 'light' }) {
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="speed">Match-score impact preview</PCap>
        <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Score header */}
          <div className="p-hero">
            <div className="p-hero-text" style={{ paddingLeft: 0 }}>
              <div className="p-hero-headline" style={{ fontSize: 11, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--txt-mute)', fontWeight: 800 }}>
                Avg match across 34 saved jobs
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: 'var(--txt)',
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>89</span>
                <span style={{ fontSize: 18, color: 'var(--txt-mute)', fontWeight: 600 }}>/ 100</span>
                <ScoreDelta delta={3} />
                <span style={{ fontSize: 11, color: 'var(--txt-mute)', fontWeight: 600 }}>
                  from 86 · two minutes ago
                </span>
              </div>
              <div className="p-hero-headline" style={{ marginTop: 6 }}>
                Edits that moved the needle:
              </div>
            </div>
            <div className="p-hero-aside">
              <ScoreRing score={89} size={76} />
            </div>
          </div>

          {/* Stack of recent edits with their per-edit delta */}
          <PSection icon="history" title="Recent edits" sub="Live impact on average score.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { t: 'Added "LLM Orchestration" as Core skill', d: 3, when: '2 min ago' },
                { t: 'Updated minimum salary $140k → $160k', d: -1, when: '4 min ago' },
                { t: 'Added 2 target roles (Staff, Principal)', d: 2, when: '7 min ago' },
                { t: 'Set seniority to Senior / Staff', d: 1, when: '12 min ago' },
                { t: 'Marked "Azure" as Core (was Strong)', d: 2, when: '15 min ago' },
              ].map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--line-soft)' : 0 }}>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--txt-2)' }}>{e.t}</div>
                  <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontWeight: 600 }}>{e.when}</span>
                  <ScoreDelta delta={e.d} />
                </div>
              ))}
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  StateEdit, StateInlinePopover, StateConfirm, StateUpload,
  StateIntegrations, StateEmpty, StateScoreDelta,
});
