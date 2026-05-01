import re
import sys

file_path = "frontend/src/pages/ApplicationDetail.jsx"

with open(file_path, "r") as f:
    content = f.read()

# 1. Insert DocumentSelectionModal before Logo Picker Modal
modal_code = """
// --- Document Selection Modal ---
const DocumentSelectionModal = React.memo(({
    isOpen,
    onClose,
    docType, // 'resume' | 'cover_letter'
    app,
    onRegenerate,
    onUploadOverride,
    onPreview,
    onSetFinal,
    onDeleteOverride,
    regenerating,
    needsGeneration
}) => {
    if (!isOpen) return null;

    const isResume = docType === 'resume';
    const title = isResume ? "Select Active Resume" : "Select Active Cover Letter";
    const activeType = isResume ? app.active_resume_type : app.active_cover_letter_type;
    
    const originalPath = isResume ? app.original_resume_path : null; 
    const tailoredPath = isResume ? app.tailored_resume_path : app.cover_letter_path;
    const overridePath = isResume ? app.override_resume_path : app.override_cover_letter_path;
    
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '2rem', backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '600px',
                borderRadius: '0.75rem', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>{isResume ? 'description' : 'mail'}</span>
                        {title}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', maxHeight: '70vh' }}>
                    {/* Original Resume (Only for Resume) */}
                    {isResume && (
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                Reference Resume
                                {activeType === 'original' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="doc-row-btn btn-mini-doc" style={{ flex: 1 }} onClick={() => onPreview('original', originalPath)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>
                                    <span style={{ fontSize: '0.85rem' }}>Original Upload</span>
                                    <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '0.9rem', opacity: 0.6 }}>visibility</span>
                                </button>
                                {activeType !== 'original' && (
                                    <button className="btn-util" onClick={() => onSetFinal(docType, 'original')} title="Set as Final">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                                        Set Final
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Generated Version */}
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            Tailored (AI)
                            {activeType === 'generated' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE</span>}
                        </div>
                        {tailoredPath ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="doc-row-btn btn-mini-doc" style={{ flex: 1 }} onClick={() => onPreview(isResume ? 'tailored' : 'cover', tailoredPath)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{isResume ? 'auto_awesome' : 'edit_note'}</span>
                                    <span style={{ fontSize: '0.85rem' }}>Generated Version</span>
                                    <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '0.9rem', opacity: 0.6 }}>visibility</span>
                                </button>
                                {activeType !== 'generated' && (
                                    <button className="btn-util" onClick={() => onSetFinal(docType, 'generated')}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                                        Set Final
                                    </button>
                                )}
                                <button className="btn-util" onClick={onRegenerate} disabled={regenerating} title="Regenerate">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>Not generated yet</div>
                                {!needsGeneration && (
                                    <button className="btn-util" onClick={onRegenerate} disabled={regenerating}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>auto_awesome</span>
                                        Generate
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Custom Version */}
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            Custom Version
                            {activeType === 'override' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE</span>}
                        </div>
                        {overridePath ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="doc-row-btn btn-mini-doc" style={{ flex: 1 }} onClick={() => onPreview(isResume ? 'override' : 'override_cl', overridePath)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>verified</span>
                                    <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overridePath.split('/').pop()}</span>
                                    <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '0.9rem', opacity: 0.6 }}>visibility</span>
                                </button>
                                {activeType !== 'override' && (
                                    <button className="btn-util" onClick={() => onSetFinal(docType, 'override')}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                                        Set Final
                                    </button>
                                )}
                                <button className="btn-util btn-danger" onClick={() => onDeleteOverride(docType)} title="Delete Custom Version">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                                </button>
                            </div>
                        ) : (
                            <button className="btn-util" style={{ width: '100%' }} onClick={() => onUploadOverride(docType)}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>upload</span> Upload Custom Final
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

// ─── Logo Picker Modal ───────────────────────────────────────────────────────
"""
content = content.replace("// ─── Logo Picker Modal ───────────────────────────────────────────────────────", modal_code)

# 2. Add showResumeModal and showCLModal to state
state_search = """    const [expandedResume, setExpandedResume] = React.useState(false);
    const [expandedCL, setExpandedCL] = React.useState(false);"""
state_replace = """    const [expandedResume, setExpandedResume] = React.useState(false);
    const [expandedCL, setExpandedCL] = React.useState(false);
    const [showResumeModal, setShowResumeModal] = React.useState(false);
    const [showCLModal, setShowCLModal] = React.useState(false);"""
content = content.replace(state_search, state_replace)

# 3. Add modals to bottom of render
bottom_search = """            {/* Logo Picker Modal */}"""
bottom_replace = """            {/* Document Selection Modals */}
            <DocumentSelectionModal
                isOpen={showResumeModal}
                onClose={() => setShowResumeModal(false)}
                docType="resume"
                app={app}
                onRegenerate={handleRegenerateResume}
                onUploadOverride={handleOverrideUpload}
                onPreview={handlePreview}
                onSetFinal={toggleActiveVersion}
                onDeleteOverride={handleDeleteOverride}
                regenerating={regeneratingResume}
                needsGeneration={needsGeneration}
            />
            <DocumentSelectionModal
                isOpen={showCLModal}
                onClose={() => setShowCLModal(false)}
                docType="cover_letter"
                app={app}
                onRegenerate={handleRegenerateCL}
                onUploadOverride={handleOverrideUpload}
                onPreview={handlePreview}
                onSetFinal={toggleActiveVersion}
                onDeleteOverride={handleDeleteOverride}
                regenerating={regeneratingCL}
                needsGeneration={needsGeneration}
            />

            {/* Logo Picker Modal */}"""
content = content.replace(bottom_search, bottom_replace)

# 4. Remove View All Docs button
button_search = """                        {/* New button cell */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowDetails(true);
                                    setTimeout(() => {
                                        document.getElementById('job-details-accordion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 50);
                                }}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.75rem', 
                                    padding: '0.75rem 1.75rem',
                                    background: 'linear-gradient(135deg, var(--primary), #818cf8)', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: '2rem', 
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)'
                                }}
                                onMouseOver={(e) => { 
                                    e.currentTarget.style.transform = 'translateY(-2px)'; 
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)'; 
                                }}
                                onMouseOut={(e) => { 
                                    e.currentTarget.style.transform = 'translateY(0)'; 
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.25)'; 
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>feed</span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>View All Docs</span>
                            </button>
                        </div>"""
if button_search in content:
    content = content.replace(button_search, "")
else:
    print("Warning: Could not find View All Docs button to remove")

# 5. Add Document Hub below Personal Remarks
doc_hub_code = """
                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Application Documents</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            {/* Active Resume Card */}
                            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>description</span>
                                    <span style={{ fontWeight: 600 }}>Active Resume</span>
                                </div>
                                {(() => {
                                    const isActiveOverride = app.active_resume_type === 'override' && app.override_resume_path;
                                    const isActiveGenerated = app.active_resume_type === 'generated' || (!isActiveOverride && app.tailored_resume_path && app.active_resume_type !== 'original');
                                    let path = app.original_resume_path;
                                    let label = "Original Resume";
                                    let icon = "attach_file";
                                    let type = "original";

                                    if (isActiveOverride) {
                                        path = app.override_resume_path;
                                        label = "Custom Final";
                                        icon = "verified";
                                        type = "override";
                                    } else if (isActiveGenerated && app.tailored_resume_path) {
                                        path = app.tailored_resume_path;
                                        label = "Tailored Resume";
                                        icon = "auto_awesome";
                                        type = "tailored";
                                    }

                                    return (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>{icon}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path?.split('/').pop() || 'Not available'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                                <button className="btn-util" style={{ flex: 1 }} onClick={() => handlePreview(type, path)} disabled={!path}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span> Preview
                                                </button>
                                                <button className="btn-util" style={{ flex: 1 }} onClick={() => setShowResumeModal(true)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>swap_horiz</span> Change
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Active Cover Letter Card */}
                            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>mail</span>
                                    <span style={{ fontWeight: 600 }}>Active Cover Letter</span>
                                </div>
                                {(() => {
                                    const isActiveOverride = app.active_cover_letter_type === 'override' && app.override_cover_letter_path;
                                    const isActiveGenerated = app.active_cover_letter_type === 'generated' || (!isActiveOverride && app.cover_letter_path);
                                    let path = null;
                                    let label = "Cover Letter";
                                    let icon = "mail";
                                    let type = "cover";

                                    if (isActiveOverride) {
                                        path = app.override_cover_letter_path;
                                        label = "Custom Final";
                                        icon = "verified";
                                        type = "override_cl";
                                    } else if (isActiveGenerated && app.cover_letter_path) {
                                        path = app.cover_letter_path;
                                        label = "Generated Letter";
                                        icon = "edit_note";
                                        type = "cover";
                                    }

                                    return (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>{icon}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path?.split('/').pop() || 'Not available'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                                <button className="btn-util" style={{ flex: 1 }} onClick={() => handlePreview(type, path)} disabled={!path}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span> Preview
                                                </button>
                                                <button className="btn-util" style={{ flex: 1 }} onClick={() => setShowCLModal(true)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>swap_horiz</span> Change
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Additional Documents Card */}
                            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>folder_open</span>
                                    <span style={{ fontWeight: 600 }}>Additional Documents</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px dashed var(--border-color)' }}>
                                        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No additional documents yet.</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>Used for AI context</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                        <button className="btn-util" style={{ width: '100%' }} onClick={() => alert('Additional docs upload to be implemented')}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span> Add Document
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>"""
header_end_search = """                        </div>
                    </div>
                </div>


            </header>"""
if header_end_search in content:
    content = content.replace(header_end_search, "                        </div>\n                    </div>\n" + doc_hub_code + "\n                </div>\n\n            </header>")
else:
    print("Warning: Could not find header end to insert Document Hub")

with open(file_path, "w") as f:
    f.write(content)

print("Refactoring step 1 complete.")
