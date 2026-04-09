import React, { useState, useEffect, useRef, useCallback } from 'react';
import './JobMatchStyles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ONLYOFFICE_URL = 'http://localhost:8443';

const ResumeEditor = ({ 
    pdfUrl, 
    resumeData, 
    refineInstructions, 
    setRefineInstructions, 
    onRegenerate, 
    isRegenerating, 
    onBack,
    docxFilename,
    pendingRefinement,
    onApproveRefinement,
    onDeclineRefinement,
    onSync,
    initialTab = null,
    applicationId = null
}) => {
    const [activeTab, setActiveTab] = useState(initialTab || (pendingRefinement ? 'ai' : 'manual'));
    const [editorReady, setEditorReady] = useState(false);
    const [editorError, setEditorError] = useState(null);
    const [editorLoading, setEditorLoading] = useState(false);
    const [regenerateStage, setRegenerateStage] = useState(0);
    const [regenerateText, setRegenerateText] = useState('');
    const [binaryStream, setBinaryStream] = useState('010101');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
    const editorRef = useRef(null);
    const editorInstanceRef = useRef(null);
    const initAttemptedRef = useRef(false);
    
    const safeInstructions = typeof refineInstructions === 'string' ? refineInstructions : '';

    // Tone presets
    const tonePresets = [
        { label: 'Executive', prompt: 'Rewrite with an executive tone — emphasize strategic leadership, high-level decision-making, and organizational impact.' },
        { label: 'Creative', prompt: 'Rewrite with a creative tone — emphasize innovation, design thinking, and unique problem-solving approaches.' },
        { label: 'Technical', prompt: 'Rewrite with a technical tone — emphasize specific technologies, engineering methodologies, and quantifiable technical achievements.' },
        { label: 'Academic', prompt: 'Rewrite with an academic tone — emphasize research contributions, publications, and scholarly achievements.' },
    ];

    useEffect(() => {
        setPreviewTimestamp(Date.now());
    }, [pdfUrl, pendingRefinement]);

    // Regeneration animation stages
    useEffect(() => {
        if (!isRegenerating) {
            setRegenerateStage(0);
            setRegenerateText('');
            return;
        }

        const stages = [
            { stage: 0, text: 'Analyzing revision instructions...', duration: 2000 },
            { stage: 1, text: 'Extracting key themes & keywords...', duration: 2000 },
            { stage: 2, text: 'AI Neural Optimization...', duration: 3000 },
            { stage: 3, text: 'Synthesizing revised resume...', duration: 60000 },
        ];

        let currentIndex = 0;
        setRegenerateStage(stages[0].stage);
        setRegenerateText(stages[0].text);

        const runStage = () => {
            if (currentIndex >= stages.length) return;
            setRegenerateStage(stages[currentIndex].stage);
            setRegenerateText(stages[currentIndex].text);
            setTimeout(() => {
                currentIndex++;
                if (currentIndex < stages.length) runStage();
            }, stages[currentIndex].duration);
        };
        runStage();

        const interval = setInterval(() => {
            setBinaryStream(Math.random().toString(2).substr(2, 8));
        }, 100);

        return () => clearInterval(interval);
    }, [isRegenerating]);

    // Initialize OnlyOffice editor
    const initEditor = useCallback(async () => {
        if (!docxFilename || editorInstanceRef.current) return;
        
        setEditorLoading(true);
        setEditorError(null);
        
        try {
            if (typeof window.DocsAPI === 'undefined') {
                throw new Error('OnlyOffice Document Server is not available. Make sure the onlyoffice container is running.');
            }

            const configUrl = new URL(`${API_URL}/api/onlyoffice/config/${docxFilename}`);
            configUrl.searchParams.append('t', Date.now());
            if (applicationId) {
                configUrl.searchParams.append('application_id', applicationId);
            }

            const res = await fetch(configUrl.toString());
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Failed to get editor config (${res.status})`);
            }
            const config = await res.json();

            if (!editorRef.current) throw new Error('Editor container not ready');

            editorRef.current.innerHTML = '';
            const placeholderId = 'onlyoffice-editor-' + Date.now();
            const placeholder = document.createElement('div');
            placeholder.id = placeholderId;
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            editorRef.current.appendChild(placeholder);

            config.events = {
                onDocumentReady: () => {
                    setEditorReady(true);
                    setEditorLoading(false);
                },
                onError: (event) => {
                    setEditorError('Editor error: ' + (event?.data?.message || 'Unknown error'));
                    setEditorLoading(false);
                },
                onDocumentStateChange: (event) => {
                    // event.data is true if document has unsaved changes
                    setHasUnsavedChanges(event.data);
                }
            };

            editorInstanceRef.current = new window.DocsAPI.DocEditor(placeholderId, config);
        } catch (err) {
            setEditorError(err.message);
            setEditorLoading(false);
        }
    }, [docxFilename, applicationId]);

    const destroyEditor = useCallback(() => {
        if (editorInstanceRef.current) {
            try { editorInstanceRef.current.destroyEditor(); } catch (e) {}
            editorInstanceRef.current = null;
        }
        setEditorReady(false);
        initAttemptedRef.current = false;
    }, []);

    useEffect(() => {
        if (activeTab === 'manual') {
            // If filename changed, we MUST destroy the old editor session first
            destroyEditor();
            initAttemptedRef.current = true;
            const timer = setTimeout(() => initEditor(), 300);
            return () => clearTimeout(timer);
        }
    }, [activeTab, initEditor, docxFilename, destroyEditor, applicationId]);


    useEffect(() => {
        return () => destroyEditor();
    }, [destroyEditor]);

    const handleTabSwitch = (tab) => {
        if (tab === activeTab) return;
        if (activeTab === 'manual') {
            destroyEditor();
            if (onSync) onSync();
        }
        setActiveTab(tab);
        if (tab === 'manual') initAttemptedRef.current = false;
    };

    const applyPreset = (preset) => {
        setRefineInstructions(preset.prompt);
    };

    const handleBackClick = () => {
        if (activeTab === 'manual' && onSync) {
            onSync();
        }
        onBack();
    };

    // Inline regeneration overlay 
    const renderRegeneratingOverlay = () => {
        if (!isRegenerating) return null;
        return (
            <div style={{
                position: 'absolute', inset: 0, zIndex: 50,
                background: 'var(--bg-overlay, rgba(0,0,0,0.85))',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: '2rem', backdropFilter: 'blur(12px)',
            }}>
                {/* Animation */}
                <div style={{ position: 'relative', width: '140px', height: '140px', marginBottom: '2rem' }}>
                    {/* Orbiting ring */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        border: '3px solid transparent',
                        borderTopColor: 'var(--primary, #256af4)',
                        borderRightColor: 'rgba(37,106,244,0.3)',
                        borderRadius: '50%',
                        animation: 'oo-spin 1.2s linear infinite',
                    }} />
                    <div style={{
                        position: 'absolute', inset: '12px',
                        border: '3px solid transparent',
                        borderBottomColor: 'var(--primary, #256af4)',
                        borderLeftColor: 'rgba(37,106,244,0.2)',
                        borderRadius: '50%',
                        animation: 'oo-spin 1.8s linear infinite reverse',
                    }} />
                    {/* Center icon */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {regenerateStage <= 1 && (
                            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary, #256af4)' }}>search</span>
                        )}
                        {regenerateStage === 2 && (
                            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary, #256af4)', animation: 'pulse-icon 1.5s ease infinite' }}>psychology</span>
                        )}
                        {regenerateStage >= 3 && (
                            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary, #256af4)' }}>edit_document</span>
                        )}
                    </div>

                    {/* Synaptic particles for stage 2 */}
                    {regenerateStage === 2 && [0, 60, 120, 180, 240, 300].map(deg => (
                        <div key={deg} style={{
                            position: 'absolute', top: '50%', left: '50%',
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: 'var(--primary, #256af4)',
                            transform: `rotate(${deg}deg) translateX(55px)`,
                            animation: `pulse-network 1s infinite ${deg % 2 === 0 ? 'ease-in' : 'ease-out'}`,
                            opacity: 0.7,
                        }} />
                    ))}
                </div>

                {/* Binary stream */}
                <div style={{
                    fontFamily: 'monospace', fontSize: '0.7rem',
                    color: 'rgba(37, 106, 244, 0.4)', letterSpacing: '0.3em',
                    marginBottom: '1rem',
                }}>
                    {binaryStream}
                </div>

                {/* Status text */}
                <p style={{
                    fontSize: '1rem', fontWeight: 600,
                    color: 'var(--text-primary, #f1f5f9)',
                    textAlign: 'center', animation: 'fadeInUp 0.4s ease',
                }}>
                    {regenerateText}
                </p>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: i <= regenerateStage ? 'var(--primary, #256af4)' : 'rgba(148, 163, 184, 0.3)',
                            transition: 'all 0.3s ease',
                            boxShadow: i <= regenerateStage ? '0 0 8px var(--primary, #256af4)' : 'none',
                        }} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="midnight-editor flex flex-col" style={{ height: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {/* Header Bar */}
            <header style={{
                position: 'relative', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 2rem', height: '60px',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-color-card)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        onClick={handleBackClick} 
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-secondary)', padding: '0.5rem 0.75rem',
                            borderRadius: '0.75rem', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Back to Scoring</span>
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {activeTab === 'manual' && editorReady && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse-icon 2s infinite' }}></span>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
                                Live Sync Enabled
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div style={{ position: 'relative', zIndex: 5, flex: 1, padding: '1.5rem 2rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Tab Switcher */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.375rem', borderRadius: '1rem', width: 'fit-content',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color-card)',
                }}>
                    <button 
                        onClick={() => handleTabSwitch('manual')}
                        style={{
                            padding: '0.625rem 1.5rem', borderRadius: '0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.1em', cursor: 'pointer', border: 'none',
                            transition: 'all 0.2s',
                            background: activeTab === 'manual' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'manual' ? '#fff' : 'var(--text-muted)',
                            boxShadow: activeTab === 'manual' ? '0 4px 15px -3px rgba(37, 106, 244, 0.3)' : 'none',
                        }}
                    >
                        Manual Edit
                    </button>
                    <button 
                        onClick={() => handleTabSwitch('ai')}
                        style={{
                            padding: '0.625rem 1.5rem', borderRadius: '0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.1em', cursor: 'pointer', border: 'none',
                            transition: 'all 0.2s',
                            background: activeTab === 'ai' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'ai' ? '#fff' : 'var(--text-muted)',
                            boxShadow: activeTab === 'ai' ? '0 4px 15px -3px rgba(37, 106, 244, 0.3)' : 'none',
                        }}
                    >
                        AI Revision
                    </button>
                </div>

                {/* ===== MANUAL EDIT TAB ===== */}
                {activeTab === 'manual' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{
                            flex: 1, borderRadius: '1rem', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', minHeight: '500px',
                            background: 'var(--bg-card)', border: '1px solid var(--border-color-card)',
                        }}>
                            <div style={{
                                padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning, #f59e0b)', borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                                fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>save</span>
                                Remember to click the Save icon within the editor before returning to scoring
                            </div>
                            {editorError ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--error)' }}>error_outline</span>
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '30rem' }}>{editorError}</p>
                                    <button 
                                        onClick={() => { destroyEditor(); initAttemptedRef.current = false; setEditorError(null); }}
                                        style={{
                                            padding: '0.625rem 1.5rem', borderRadius: '0.75rem',
                                            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color-card)',
                                            color: 'var(--text-primary)', transition: 'all 0.2s',
                                        }}
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : editorLoading ? (
                                <div className="oo-loading" style={{ flex: 1 }}>
                                    <div className="spinner"></div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading document editor...</span>
                                </div>
                            ) : null}
                            <div 
                                ref={editorRef} 
                                className="onlyoffice-container"
                                style={{ flex: 1, display: editorError ? 'none' : 'block', minHeight: '500px' }}
                            />
                        </div>

                        {/* Status Bar */}
                        <div style={{
                            height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0 1.5rem',
                            borderTop: '1px solid var(--border-color-card)',
                            background: 'var(--bg-secondary)',
                        }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
                                {docxFilename || 'No file loaded'}
                            </span>
                            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>
                                Manual Editing Mode
                            </span>
                        </div>
                    </div>
                )}

                {/* ===== AI REVISION TAB ===== */}
                {activeTab === 'ai' && (
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                        {renderRegeneratingOverlay()}
                        
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem',
                            height: '100%', alignItems: 'start',
                        }}>
                            {/* Left Column: AI Prompt */}
                            <div className="midnight-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                                {pendingRefinement && (
                                    <div style={{
                                        padding: '1.5rem', borderRadius: '1.5rem',
                                        background: 'rgba(37, 106, 244, 0.05)', border: '1px solid var(--primary)',
                                        display: 'flex', flexDirection: 'column', gap: '1rem',
                                        animation: 'fadeInUp 0.4s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>auto_awesome</span>
                                            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Proposed Changes</h3>
                                        </div>
                                        
                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {(pendingRefinement.change_summary || []).length > 0 ? (
                                                pendingRefinement.change_summary.map((change, i) => (
                                                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                        {change}
                                                    </li>
                                                ))
                                            ) : (
                                                <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    The AI has optimized your resume based on your instructions.
                                                </li>
                                            )}
                                        </ul>

                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                            <button 
                                                onClick={onApproveRefinement}
                                                disabled={isRegenerating}
                                                className="btn btn-primary"
                                                style={{ flex: 1, padding: '0.75rem', fontSize: '0.8rem', gap: '0.4rem' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                                KEEP CHANGES
                                            </button>
                                            <button 
                                                onClick={onDeclineRefinement}
                                                disabled={isRegenerating}
                                                className="btn-util"
                                                style={{ flex: 1, padding: '0.75rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border-color-card)', gap: '0.4rem' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                                                DISCARD
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Revision Instructions Card */}
                                <div style={{
                                    padding: '1.5rem', borderRadius: '1.5rem',
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color-card)',
                                    display: 'flex', flexDirection: 'column', gap: '1rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary)' }}>
                                            {pendingRefinement ? 'Refine Instructions Further' : 'Revision Instructions'}
                                        </label>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                            {safeInstructions.length}/500 characters
                                        </span>
                                    </div>
                                    <textarea 
                                        className="form-textarea"
                                        style={{
                                            height: pendingRefinement ? '8rem' : '14rem', resize: 'none',
                                            borderRadius: '1rem',
                                            background: 'var(--bg-input)',
                                            border: '1px solid var(--border-color-input)',
                                            color: 'var(--text-primary)',
                                            padding: '1.25rem',
                                            transition: 'height 0.3s ease'
                                        }}
                                        placeholder="E.g., 'Make my leadership experience sound more authoritative and highlight my impact on cross-functional team growth over the last 3 years...'"
                                        value={safeInstructions}
                                        onChange={(e) => setRefineInstructions(e.target.value.slice(0, 500))}
                                    />
                                    
                                    {/* Tone Presets (Only show if NOT currently reviewing a refinement) */}
                                    {!pendingRefinement && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
                                                Quick Tone Presets
                                            </span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {tonePresets.map((preset) => (
                                                    <button 
                                                        key={preset.label}
                                                        onClick={() => applyPreset(preset)}
                                                        style={{
                                                            padding: '0.5rem 1rem', borderRadius: '9999px',
                                                            fontSize: '0.75rem', fontWeight: 600,
                                                            color: 'var(--text-secondary)',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border-color-card)',
                                                            cursor: 'pointer', transition: 'all 0.2s',
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.borderColor = 'rgba(37,106,244,0.4)';
                                                            e.currentTarget.style.color = 'var(--primary)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.borderColor = 'var(--border-color-card)';
                                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                                        }}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Regenerate Button */}
                                    <button 
                                        onClick={onRegenerate}
                                        disabled={isRegenerating || !safeInstructions.trim()}
                                        className="btn btn-primary"
                                        style={{
                                            width: '100%', padding: '1rem',
                                            borderRadius: '1rem', fontWeight: 700,
                                            letterSpacing: '0.05em', fontSize: '0.9rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                            marginTop: '0.5rem',
                                        }}
                                    >
                                        {isRegenerating ? (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: 'oo-spin 0.8s linear infinite' }}>sync</span>
                                                {pendingRefinement ? 'UPDATING...' : 'REGENERATING...'}
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>auto_awesome</span>
                                                {pendingRefinement ? 'UPDATE SUGGESTION' : 'REGENERATE RESUME'}
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* AI Pro Tip */}
                                <div style={{
                                    padding: '1.5rem', borderRadius: '1.5rem',
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color-card)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>lightbulb</span>
                                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Pro Tip</h3>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                        For better results, mention the specific industry keywords you'd like to emphasize. 
                                        Our engine works best when targeting 3-5 core competencies.
                                    </p>
                                </div>
                            </div>

                            {/* Right Column: Live Preview */}
                            <div style={{ height: 'calc(100vh - 200px)' }}>
                                <div className="preview-ghost-border" style={{
                                    height: '100%', borderRadius: '2rem', overflow: 'hidden',
                                    display: 'flex', flexDirection: 'column',
                                    background: '#f8fafc',
                                    border: '1px solid var(--border-color-card)',
                                }}>
                                    {/* Preview Toolbar */}
                                    <div style={{
                                        height: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0 1.5rem',
                                        borderBottom: '1px solid #e2e8f0', background: 'rgba(241, 245, 249, 0.8)',
                                        backdropFilter: 'blur(8px)',
                                    }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: pendingRefinement ? 'var(--primary)' : '#64748b' }}>
                                            {pendingRefinement ? 'PROPOSED REVISION' : 'LIVE PREVIEW'}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {pdfUrl && (
                                                <a href={pdfUrl} target="_blank" rel="noreferrer" 
                                                   className="material-symbols-outlined" 
                                                   style={{ fontSize: '18px', color: '#64748b', textDecoration: 'none', cursor: 'pointer' }}>
                                                    open_in_new
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* PDF Preview */}
                                    <div style={{ flex: 1 }}>
                                        { (pendingRefinement ? `${API_URL}${pendingRefinement.files.pdf}` : pdfUrl) ? (
                                            <iframe 
                                                src={`${pendingRefinement ? `${API_URL}${pendingRefinement.files.pdf}` : pdfUrl}?t=${previewTimestamp}#toolbar=0&navpanes=0`}
                                                style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                                                key={pendingRefinement ? pendingRefinement.files.pdf : pdfUrl}
                                                title="Resume PDF Preview"
                                            />
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: '#94a3b8' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem' }}>description</span>
                                                <p>Preview will appear after generation</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumeEditor;
