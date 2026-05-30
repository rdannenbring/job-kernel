import sys

def enhance_lifecycle():
    file_path = 'frontend/src/pages/ApplicationLifecycle.jsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add useRef to imports
    if 'useRef' not in content.split('\n')[0]:
        content = content.replace("import { useState, useEffect } from 'react'", "import { useState, useEffect, useRef } from 'react'")
        print("Added useRef to imports.")

    # 2. Update panel signatures
    signatures = [
        ("function GeneratedSubStagePanel({ app, onRefresh, onStageChange }) {", 
         "function GeneratedSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function SavedSubStagePanel({ app, onRefresh, avgScore, onStageChange, connections = [], onAddContact, onSearchPeople, handleGenerateOutreach, generatingOutreach, outreachScript, setOutreachScript, openEditContact, handleDeleteContact }) {",
         "function SavedSubStagePanel({ app, onRefresh, avgScore, onStageChange, connections = [], onAddContact, onSearchPeople, handleGenerateOutreach, generatingOutreach, outreachScript, setOutreachScript, openEditContact, handleDeleteContact, navCollapsed, onToggleNav }) {"),
        ("function AppliedSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function AppliedSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function InterviewingSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function InterviewingSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function DecisionSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function DecisionSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function AcceptedSubStagePanel({ app, onRefresh, onStageChange, initialSubStage = 'offer_received' }) {",
         "function AcceptedSubStagePanel({ app, onRefresh, onStageChange, initialSubStage = 'offer_received', navCollapsed, onToggleNav }) {"),
        ("function RejectedSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function RejectedSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function DeclinedSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function DeclinedSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {"),
        ("function WithdrawnSubStagePanel({ app, onRefresh, onStageChange }) {",
         "function WithdrawnSubStagePanel({ app, onRefresh, onStageChange, navCollapsed, onToggleNav }) {")
    ]

    for target, repl in signatures:
        if target in content:
            content = content.replace(target, repl)
            print(f"Updated signature for {target.split('(')[0].replace('function ', '').strip()}")
        else:
            print(f"Warning: target signature not found: {target}")

    # 3. Insert Scroll-to-Top useEffect block after activeSubStage declarations
    use_effect_block = """
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const main = document.querySelector('main');
    const grid = document.querySelector('.substage-grid');
    if (main && grid) {
      setTimeout(() => {
        main.scrollTo({
          top: grid.getBoundingClientRect().top + main.scrollTop - 135,
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [activeSubStage]);"""

    state_lines = [
        "  const [activeSubStage, setActiveSubStage] = useState('resume');",
        "  const [activeSubStage, setActiveSubStage] = useState('parsed');",
        "  const [activeSubStage, setActiveSubStage] = useState('submitted');",
        "  const [activeSubStage, setActiveSubStage] = useState('recruiter_screen');",
        "  const [activeSubStage, setActiveSubStage] = useState('awaiting_decision');",
        "  const [activeSubStage, setActiveSubStage] = useState(initialSubStage);",
        "  const [activeSubStage, setActiveSubStage] = useState('rejection_received');",
        "  const [activeSubStage, setActiveSubStage] = useState('offer_review');",
        "  const [activeSubStage, setActiveSubStage] = useState('decision_made');"
    ]

    for s_line in state_lines:
        if s_line in content:
            # Avoid duplicate injection
            if s_line + use_effect_block not in content:
                content = content.replace(s_line, s_line + use_effect_block)
                print(f"Injected useEffect after: {s_line.strip()}")
        else:
            print(f"Warning: state line not found: {s_line.strip()}")

    # 4. Update navStyle functions
    navstyle_target_gen = """  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.875rem 1.25rem',"""
    
    navstyle_repl_gen = """  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: navCollapsed ? 'center' : 'flex-start',
    gap: navCollapsed ? '0' : '0.875rem',
    padding: navCollapsed ? '0.875rem 0' : '0.875rem 1.25rem',"""

    if navstyle_target_gen in content:
        content = content.replace(navstyle_target_gen, navstyle_repl_gen)
        print("Updated navStyle for GeneratedSubStagePanel.")

    navstyle_target_others = """  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1.25rem',"""

    navstyle_repl_others = """  const navStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: navCollapsed ? 'center' : 'space-between',
    padding: navCollapsed ? '0.875rem 0' : '0.875rem 1.25rem',"""

    if navstyle_target_others in content:
        content = content.replace(navstyle_target_others, navstyle_repl_others)
        print("Updated navStyle for other panels.")

    # 5. Inject navCollapsed state into main component
    main_comp_target = """  const { fetchWithAuth } = useAuth();
  const [app, setApp] = useState(initialApp);"""
    
    main_comp_repl = """  const { fetchWithAuth } = useAuth();
  const [app, setApp] = useState(initialApp);
  const [navCollapsed, setNavCollapsed] = useState(false);"""

    if main_comp_target in content and "const [navCollapsed, setNavCollapsed]" not in content:
        content = content.replace(main_comp_target, main_comp_repl)
        print("Injected navCollapsed state into main ApplicationLifecycle component.")

    # 6. Pass props to rendered panels
    render_targets = [
        ("<GeneratedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<GeneratedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ("<AppliedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<AppliedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ("<InterviewingSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<InterviewingSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ("<DecisionSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<DecisionSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ('<AcceptedSubStagePanel key="offered" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="offer_received" />',
         '<AcceptedSubStagePanel key="offered" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="offer_received" navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />'),
        ('<AcceptedSubStagePanel key="accepted" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="formal_acceptance" />',
         '<AcceptedSubStagePanel key="accepted" app={app} onRefresh={refreshApp} onStageChange={updateStage} initialSubStage="formal_acceptance" navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />'),
        ("<RejectedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<RejectedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ("<DeclinedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<DeclinedSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />"),
        ("<WithdrawnSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} />",
         "<WithdrawnSubStagePanel app={app} onRefresh={refreshApp} onStageChange={updateStage} navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed(!navCollapsed)} />")
    ]

    for target, repl in render_targets:
        if target in content:
            content = content.replace(target, repl)
            print(f"Updated render line for {target.split(' ')[0].replace('<', '')}")

    # Update SavedSubStagePanel render multiline block
    saved_render_target = """          handleDeleteContact={handleDeleteContact}
        />"""
    saved_render_repl = """          handleDeleteContact={handleDeleteContact}
          navCollapsed={navCollapsed}
          onToggleNav={() => setNavCollapsed(!navCollapsed)}
        />"""
    if saved_render_target in content:
        content = content.replace(saved_render_target, saved_render_repl)
        print("Updated render block for SavedSubStagePanel.")

    # 7. Update return blocks for the panels
    # Toggle button snippet
    toggle_snippet = """        <div style={{ display: 'flex', justifyContent: navCollapsed ? 'center' : 'flex-end', padding: '0 0.5rem', marginBottom: '0.5rem' }}>
          <button className="substage-nav-toggle-btn" onClick={onToggleNav} title={navCollapsed ? "Expand menu" : "Collapse menu"}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
              {navCollapsed ? 'last_page' : 'first_page'}
            </span>
          </button>
        </div>"""

    # Panel 1: GeneratedSubStagePanel
    gen_ret_target = """  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', padding: '0 1rem', marginBottom: '0.5rem' }}>Artifacts</h3>
        {GENERATED_SUBSTAGES.map((s) => (
          <button key={s.id} onClick={() => setActiveSubStage(s.id)} style={navStyle(s.id)}>
            <span className="material-symbols-outlined" style={{ 
              fontSize: '1.25rem',
              fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
            }}>
              {s.icon}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}>{s.label}</span>
          </button>
        ))}
        
        <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '1rem', padding: '1rem' }}>
             <p style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Strategy Ready</p>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Documents are tailored to <strong>{app?.match_score || 0}%</strong> match accuracy.</p>
          </div>
        </div>
      </div>"""

    gen_ret_repl = f"""  return (
    <div className={{`substage-grid ${{navCollapsed ? 'is-collapsed' : 'is-expanded'}}`}}>
      {{/* Left: Navigation */}}
      <div style={{{{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'sticky', top: '130px', height: 'fit-content', zIndex: 100 }}}}>
{toggle_snippet}
        <h3 className="substage-nav-label" style={{{{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', padding: '0 1rem', marginBottom: '0.5rem' }}}}>Artifacts</h3>
        {{GENERATED_SUBSTAGES.map((s) => (
          <button key={{s.id}} onClick={{() => setActiveSubStage(s.id)}} style={{{{ ...navStyle(s.id), position: 'relative' }}}} title={{s.label}}>
            <span className="material-symbols-outlined" style={{{{ 
              fontSize: '1.25rem',
              fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
            }}}}>
              {{s.icon}}
            </span>
            <span className="substage-nav-label" style={{{{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}}}>{{s.label}}</span>
          </button>
        ))}}
        
        <div style={{{{ marginTop: 'auto', padding: navCollapsed ? '1.5rem 0' : '1.5rem 1rem' }}}}>
          <div 
            style={{{{ 
              background: 'rgba(16, 185, 129, 0.05)', 
              border: '1px solid rgba(16, 185, 129, 0.2)', 
              borderRadius: '1rem', 
              padding: navCollapsed ? '0.75rem' : '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: navCollapsed ? 'center' : 'flex-start',
              cursor: navCollapsed ? 'help' : 'default',
              transition: 'all 0.3s ease'
            }}}}
            title={{navCollapsed ? `Strategy Ready: Documents are tailored to ${{app?.match_score || 0}}% match accuracy.` : ""}}
          >
            {{navCollapsed ? (
              <span className="material-symbols-outlined" style={{{{ color: '#10b981', fontSize: '1.25rem' }}}}>info</span>
            ) : (
              <>
                <p className="substage-nav-label" style={{{{ fontSize: '10px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.5rem', width: '100%' }}}}>Strategy Ready</p>
                <p className="substage-nav-label" style={{{{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, width: '100%', whiteSpace: 'normal' }}}}>Documents are tailored to <strong>{{app?.match_score || 0}}%</strong> match accuracy.</p>
              </>
            )}}
          </div>
        </div>
      </div>"""

    if gen_ret_target in content:
        content = content.replace(gen_ret_target, gen_ret_repl)
        print("Updated return layout for GeneratedSubStagePanel.")

    # Panel 2: SavedSubStagePanel
    saved_ret_target = """  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {SAVED_SUBSTAGES.map((s) => (
          <button key={s.id} onClick={() => setActiveSubStage(s.id)} style={navStyle(s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}>
                {s.icon}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}>{s.label}</span>
            </div>
            {isComplete(s.id) ? (
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981' }}>check_circle</span>
            ) : (
              activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
            )}
          </button>
        ))}
      </div>"""

    saved_ret_repl = f"""  return (
    <div className={{`substage-grid ${{navCollapsed ? 'is-collapsed' : 'is-expanded'}}`}}>
      {{/* Left: Navigation */}}
      <div style={{{{ display: 'flex', flexDirection: 'column', position: 'sticky', top: '130px', height: 'fit-content', zIndex: 100 }}}}>
{toggle_snippet}
        {{SAVED_SUBSTAGES.map((s) => (
          <button key={{s.id}} onClick={{() => setActiveSubStage(s.id)}} style={{{{ ...navStyle(s.id), position: 'relative' }}}} title={{s.label}}>
            <div style={{{{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}}}>
              <span className="material-symbols-outlined" style={{{{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}}}>
                {{s.icon}}
              </span>
              <span className="substage-nav-label" style={{{{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}}}>{{s.label}}</span>
            </div>
            <span className="substage-nav-status">
              {{isComplete(s.id) ? (
                <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem', color: '#10b981' }}}}>check_circle</span>
              ) : (
                activeSubStage === s.id && <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem' }}}}>chevron_right</span>
              )}}
            </span>
          </button>
        ))}}
      </div>"""

    if saved_ret_target in content:
        content = content.replace(saved_ret_target, saved_ret_repl)
        print("Updated return layout for SavedSubStagePanel.")

    # Panel 3: AppliedSubStagePanel
    app_ret_target = """  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {APPLIED_SUBSTAGES.map((s) => (
          <button key={s.id} onClick={() => setActiveSubStage(s.id)} style={navStyle(s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span className="material-symbols-outlined" style={{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}>
                {s.icon}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}>{s.label}</span>
            </div>
            {isComplete(s.id) ? (
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981' }}>check_circle</span>
            ) : (
              activeSubStage === s.id && <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
            )}
          </button>
        ))}
      </div>"""

    app_ret_repl = f"""  return (
    <div className={{`substage-grid ${{navCollapsed ? 'is-collapsed' : 'is-expanded'}}`}}>
      <div style={{{{ display: 'flex', flexDirection: 'column', position: 'sticky', top: '130px', height: 'fit-content', zIndex: 100 }}}}>
{toggle_snippet}
        {{APPLIED_SUBSTAGES.map((s) => (
          <button key={{s.id}} onClick={{() => setActiveSubStage(s.id)}} style={{{{ ...navStyle(s.id), position: 'relative' }}}} title={{s.label}}>
            <div style={{{{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}}}>
              <span className="material-symbols-outlined" style={{{{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}}}>
                {{s.icon}}
              </span>
              <span className="substage-nav-label" style={{{{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}}}>{{s.label}}</span>
            </div>
            <span className="substage-nav-status">
              {{isComplete(s.id) ? (
                <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem', color: '#10b981' }}}}>check_circle</span>
              ) : (
                activeSubStage === s.id && <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem' }}}}>chevron_right</span>
              )}}
            </span>
          </button>
        ))}}
      </div>"""

    if app_ret_target in content:
        content = content.replace(app_ret_target, app_ret_repl)
        print("Updated return layout for AppliedSubStagePanel.")

    # Panels 4-9 standard structure
    std_panels = [
        ("Interview Pipeline", "INTERVIEWING_SUBSTAGES"),
        ("Decision Pipeline", "DECISION_SUBSTAGES"),
        ("Accepted Journey", "ACCEPTED_SUBSTAGES"),
        ("Rejection Flow", "REJECTED_SUBSTAGES"),
        ("Declined Flow", "DECLINED_SUBSTAGES"),
        ("Withdrawn Flow", "WITHDRAWN_SUBSTAGES")
    ]

    for flow_title, arr_name in std_panels:
        p_target = f"""  return (
    <div style={{{{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}}}>
      <div style={{{{ display: 'flex', flexDirection: 'column' }}}}>
        <div style={{{{ marginBottom: '1.5rem', padding: '0 0.5rem' }}}}>
          <p style={{{{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}}}>{flow_title}</p>
          <h2 style={{{{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}}}>{{app?.job_title || 'Product Designer'}}</h2>
        </div>
        {{{arr_name}.map((s) => (
          <button key={{s.id}} onClick={{() => setActiveSubStage(s.id)}} style={{navStyle(s.id)}}>
            <div style={{{{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}}}>
              <span className="material-symbols-outlined" style={{{{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}}}>
                {{s.icon}}
              </span>
              <span style={{{{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}}}>{{s.label}}</span>
            </div>
            {{activeSubStage === s.id && <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem' }}}}>chevron_right</span>}}
          </button>
        ))}}
      </div>"""

        p_repl = f"""  return (
    <div className={{`substage-grid ${{navCollapsed ? 'is-collapsed' : 'is-expanded'}}`}}>
      <div style={{{{ display: 'flex', flexDirection: 'column', position: 'sticky', top: '130px', height: 'fit-content', zIndex: 100 }}}}>
{toggle_snippet}
        <div className="substage-nav-label" style={{{{ marginBottom: '1.5rem', padding: '0 0.5rem' }}}}>
          <p style={{{{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}}}>{flow_title}</p>
          <h2 style={{{{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}}}>{{app?.job_title || 'Product Designer'}}</h2>
        </div>
        {{{arr_name}.map((s) => (
          <button key={{s.id}} onClick={{() => setActiveSubStage(s.id)}} style={{{{ ...navStyle(s.id), position: 'relative' }}}} title={{s.label}}>
            <div style={{{{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}}}>
              <span className="material-symbols-outlined" style={{{{ 
                fontSize: '1.25rem',
                fontVariationSettings: activeSubStage === s.id ? "'FILL' 1" : "'FILL' 0"
              }}}}>
                {{s.icon}}
              </span>
              <span className="substage-nav-label" style={{{{ fontSize: '0.9rem', fontWeight: activeSubStage === s.id ? 800 : 600 }}}}>{{s.label}}</span>
            </div>
            <span className="substage-nav-status">
              {{activeSubStage === s.id && <span className="material-symbols-outlined" style={{{{ fontSize: '1.1rem' }}}}>chevron_right</span>}}
            </span>
          </button>
        ))}}
      </div>"""

        if p_target in content:
            content = content.replace(p_target, p_repl)
            print(f"Updated return layout for {arr_name.split('_')[0].capitalize()} panel.")
        else:
            print(f"Warning: return target not found for {flow_title}")

    # Save changes
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully enhanced ApplicationLifecycle.jsx!")

if __name__ == '__main__':
    enhance_lifecycle()
