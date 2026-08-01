import React from 'react';
import ApplicationDetailMobile, { useIsMobile } from './ApplicationDetailMobile';
import CustomDropdown from '../components/CustomDropdown';
import LocationAutocomplete from '../components/LocationAutocomplete';
import InterestStars from '../components/InterestStars';
import PipelineProgressBar, { STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import VerticalPipelineRail from '../components/VerticalPipelineRail';
import ApplicationLifecycle, { computeStageProgress } from './ApplicationLifecycle';
import { useAuth } from '../context/AuthContext';

// Use same env logic or passed prop
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const safeParseJSON = (data, fallback = {}) => {
    if (!data) return fallback;
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data) || fallback;
    } catch (e) {
        console.warn('Failed to parse JSON:', data);
        return fallback;
    }
};

// Interpolates red (0) → yellow (50) → green (100) via HSL hue
const getScoreColors = (score) => {
    const hue = Math.round((score / 100) * 120); // 0 → red, 120 → green
    return {
        bg: `hsla(${hue}, 75%, 40%, 0.15)`,
        border: `hsla(${hue}, 75%, 50%, 0.6)`,
        text: `hsl(${hue}, 75%, 55%)`,
    };
};

// Returns comparison info between a score and the user's average
const getScoreComparison = (score, avgScore) => {
    if (avgScore === null || avgScore === undefined) return null;
    const diff = score - avgScore;
    const absDiff = Math.abs(Math.round(diff));
    const isAbove = diff >= 1;
    const isBelow = diff <= -1;
    return { diff, absDiff, isAbove, isBelow, avg: Math.round(avgScore) };
};

const formatCompensation = (salary) => {
    if (!salary || salary === 'Not Listed') return '-';
    let truncated = String(salary);
    if (truncated.length > 60) {
        truncated = truncated.substring(0, 57) + '...';
    }
    const words = truncated.split(' ');
    const hyphenatedWords = words.map(word => {
        if (word.length > 12) {
            let newWord = '';
            for (let i = 0; i < word.length; i += 12) {
                newWord += word.substring(i, i + 12);
                if (i + 12 < word.length) newWord += '\u00AD';
            }
            return newWord;
        }
        return word;
    });
    return hyphenatedWords.join(' ');
};

const JobDescriptionContent = ({ text }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const shouldTruncate = text && text.length > 500;

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        }}>
            <div style={{
                padding: '1rem',
                maxHeight: isExpanded ? 'none' : '200px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Collapse trigger at top - full width clickable row */}
                {isExpanded && shouldTruncate && (
                    <button
                        onClick={() => setIsExpanded(false)}
                        title="Collapse"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--bg-tertiary)',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            marginBottom: '1rem',
                            color: 'var(--primary)',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                    >
                        Show Less
                    </button>
                )}

                <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    margin: 0,
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)'
                }}>
                    {text || "No description available."}
                </pre>

                {/* Gradient Overlay when collapsed */}
                {!isExpanded && shouldTruncate && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '80px',
                        background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
                        pointerEvents: 'none'
                    }} />
                )}
            </div>

            {shouldTruncate && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-tertiary)',
                        border: 'none',
                        borderTop: '1px solid var(--border-color)',
                        color: 'var(--primary)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                >
                    {isExpanded ? 'Show Less' : 'Show Full Description'}
                </button>
            )}
        </div>
    );
};

// --- Preview Modal Component ---
const PreviewModal = React.memo(({ file, onClose }) => {
    if (!file) return null;

    const handleDownload = (format) => {
        let path = file.path;
        if (format === 'pdf') path = path.replace('.docx', '.pdf');
        if (format === 'txt') path = path.replace('.docx', '.txt');
        window.open(`${API_URL}/api/download/${path}`, '_blank');
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '2rem',
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '800px', height: '85vh',
                borderRadius: '0.75rem', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{file.title}</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{file.subtitle}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleDownload('docx')} className="btn-modal">DOCX</button>
                        <button onClick={() => handleDownload('pdf')} className="btn-modal">PDF</button>
                        <button onClick={() => handleDownload('txt')} className="btn-modal">TXT</button>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', marginLeft: '1rem'
                        }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, background: '#525659', display: 'flex', flexDirection: 'column' }}>
                    {file.pdfUrl ? (
                        <iframe
                            src={file.pdfUrl}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            title="PDF Preview"
                        />
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                            <p>Preview not available for this format.</p>
                            <p style={{ fontSize: '0.9rem' }}>Please download the file to view it.</p>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                .btn-modal {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 0.4rem 0.8rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                .btn-modal:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
            `}</style>
        </div>
    );
});



// --- Document Selection Modal ---
const DocumentSelectionModal = React.memo(({
    isOpen,
    onClose,
    docType, // 'resume' | 'cover_letter'
    app,
    profileBaseResume,
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
    
    const originalPath = isResume ? (app.original_resume_path || profileBaseResume) : null; 
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
                                Base Resume
                                {activeType === 'original' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="doc-row-btn btn-mini-doc" style={{ flex: 1 }} onClick={() => onPreview('original', originalPath)} disabled={!originalPath}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>
                                    <span style={{ fontSize: '0.85rem' }}>Profile Base Resume</span>
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
                                <button className="btn-util" onClick={onRegenerate} disabled={regenerating}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>auto_awesome</span>
                                    Generate
                                </button>
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

const LogoPickerModal = ({ companyName, onSelect, onClose }) => {
    const [tab, setTab] = React.useState('search'); // 'search' | 'url' | 'upload'
    const [query, setQuery] = React.useState(companyName || '');
    const [results, setResults] = React.useState([]);
    const [searching, setSearching] = React.useState(false);
    const [urlValue, setUrlValue] = React.useState('');
    const [urlError, setUrlError] = React.useState('');
    const fileInputRef = React.useRef(null);
    const debounceRef = React.useRef(null);

    // Auto-search when component mounts with a company name
    React.useEffect(() => {
        if (companyName) {
            performSearch(companyName);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const performSearch = async (searchQuery) => {
        if (!searchQuery.trim()) { setResults([]); return; }
        setSearching(true);
        try {
            // Use Clearbit autocomplete search
            const res = await fetchWithAuth(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                // data is an array of { name, domain, logo }
                setResults((data || []).slice(0, 12));
            } else {
                setResults([]);
            }
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(val), 400);
    };

    const handleSelectResult = (domain) => {
        // Use Google Favicon API
        const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        onSelect(url);
    };

    const handleUrlSubmit = () => {
        if (!urlValue.trim()) { setUrlError('Please enter an image URL.'); return; }
        try { new URL(urlValue); } catch { setUrlError('Please enter a valid URL.'); return; }
        onSelect(urlValue.trim());
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => onSelect(ev.target.result);
        reader.readAsDataURL(file);
    };

    const tabStyle = (t) => ({
        padding: '0.5rem 1.2rem',
        borderRadius: '0.4rem',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 600,
        transition: 'all 0.2s',
        background: tab === t ? 'var(--primary)' : 'transparent',
        color: tab === t ? 'white' : 'var(--text-secondary)',
    });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)',
            padding: '1rem',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '1rem', width: '100%',
                maxWidth: '560px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8)',
                border: '1px solid var(--border-color)', overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>

                {/* Modal Header */}
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)',
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Set Company Logo</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose how you'd like to add a logo</p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', padding: '0.25rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', padding: '0.75rem 1.25rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <button style={tabStyle('search')} onClick={() => setTab('search')}>
                        <span className="material-symbols-outlined" style={{ marginRight: '0.4rem', fontSize: '1.2rem', verticalAlign: 'middle' }}>search</span>Search Logos
                    </button>
                    <button style={tabStyle('url')} onClick={() => setTab('url')}>
                        <span className="material-symbols-outlined" style={{ marginRight: '0.4rem', fontSize: '1.2rem', verticalAlign: 'middle' }}>link</span>Paste URL
                    </button>
                    <button style={tabStyle('upload')} onClick={() => setTab('upload')}>
                        <span className="material-symbols-outlined" style={{ marginRight: '0.4rem', fontSize: '1.2rem', verticalAlign: 'middle' }}>folder</span>Upload File
                    </button>
                </div>

                {/* Tab Content */}
                <div style={{ padding: '1.5rem', minHeight: '280px' }}>

                    {/* ── Search tab ── */}
                    {tab === 'search' && (
                        <div>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{
                                    position: 'absolute', left: '0.75rem', top: '50%',
                                    transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem',
                                }}>search</span>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={handleQueryChange}
                                    placeholder="Search by company name…"
                                    style={{
                                        width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                    autoFocus
                                />
                            </div>

                            {searching && (
                                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                    <div style={{
                                        width: '28px', height: '28px', border: '3px solid var(--border-color)',
                                        borderTopColor: 'var(--primary)', borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem',
                                    }} />
                                    Searching logos…
                                </div>
                            )}

                            {!searching && results.length === 0 && query.trim() && (
                                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                    No logos found for "{query}". Try a different name.
                                </div>
                            )}

                            {!searching && results.length === 0 && !query.trim() && (
                                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                                    Type a company name to search for logos.
                                </div>
                            )}

                            {!searching && results.length > 0 && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
                                }}>
                                    {results.map((r, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectResult(r.domain)}
                                            title={r.name || r.domain}
                                            style={{
                                                background: 'transparent', border: '2px solid var(--border-color)',
                                                borderRadius: '0.6rem', padding: '0',
                                                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', gap: '0.4rem',
                                                transition: 'all 0.15s', aspectRatio: '1 / 1.2',
                                                justifyContent: 'center',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <img
                                                src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`}
                                                alt={r.name || r.domain}
                                                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                                                onError={e => { e.target.style.display = 'none'; }}
                                            />
                                            <span style={{
                                                fontSize: '0.65rem', color: '#333',
                                                textOverflow: 'ellipsis', overflow: 'hidden',
                                                whiteSpace: 'nowrap', maxWidth: '80px', textAlign: 'center',
                                            }}>{r.name || r.domain}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── URL tab ── */}
                    {tab === 'url' && (
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0 }}>Paste a direct link to any image on the web.</p>
                            <input
                                type="url"
                                value={urlValue}
                                onChange={e => { setUrlValue(e.target.value); setUrlError(''); }}
                                placeholder="https://example.com/logo.png"
                                style={{
                                    width: '100%', padding: '0.65rem 0.75rem',
                                    background: 'var(--bg-secondary)', border: `1px solid ${urlError ? '#ef4444' : 'var(--border-color)'}`,
                                    borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem',
                                    outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem',
                                }}
                            />
                            {urlError && <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>{urlError}</p>}

                            {/* Live preview */}
                            {urlValue && !urlError && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'transparent', borderRadius: '0.6rem', padding: '0',
                                    marginBottom: '1rem', border: '1px solid var(--border-color)',
                                    minHeight: '100px',
                                }}>
                                    <img
                                        src={urlValue}
                                        alt="Logo preview"
                                        style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }}
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleUrlSubmit}
                                style={{
                                    width: '100%', padding: '0.7rem', background: 'var(--primary)',
                                    border: 'none', borderRadius: '0.5rem', color: 'white',
                                    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                                }}
                            >
                                Use This Image
                            </button>
                        </div>
                    )}

                    {/* ── Upload tab ── */}
                    {tab === 'upload' && (
                        <div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0 }}>Choose an image file from your computer.</p>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: '2px dashed var(--border-color)', borderRadius: '0.75rem',
                                    padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer',
                                    transition: 'all 0.2s', color: 'var(--text-muted)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(var(--primary-rgb, 99,102,241), 0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>upload_file</span>
                                <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Click to browse files</div>
                                <div style={{ fontSize: '0.8rem' }}>PNG, JPG, SVG, WEBP accepted</div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

const ApplicationDetail = ({ app, onBack, onDelete, onArchive, onStatusUpdate, onUpdate, onPersist, onViewLifecycle, onStartFullGeneration, avgScore, isEnrichingGlobal = false }) => {
    const isMobile = useIsMobile();
    const headerSentinelRef = React.useRef(null);
    const [showStickyHeaderSummary, setShowStickyHeaderSummary] = React.useState(false);

    React.useEffect(() => {
        const scrollContainer = document.querySelector('main');
        if (!scrollContainer) return;

        const handleScroll = () => {
            const shouldShow = scrollContainer.scrollTop > 50;
            setShowStickyHeaderSummary(prev => {
                if (prev !== shouldShow) {
                    return shouldShow;
                }
                return prev;
            });
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    const { fetchWithAuth } = useAuth();
    const [profileDocs, setProfileDocs] = React.useState([]);
    const [uploadingDoc, setUploadingDoc] = React.useState(false);
    const docInputRef = React.useRef(null);
    const needsGeneration = !app.tailored_resume_path && !app.cover_letter_path;
    const [previewFile, setPreviewFile] = React.useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [isArchived, setIsArchived] = React.useState(app.is_archived === 'true');
    const [archiving, setArchiving] = React.useState(false);
    const [logoUrl, setLogoUrl] = React.useState(app.company_logo || null);
    const [showLogoPicker, setShowLogoPicker] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [formData, setFormData] = React.useState({ ...app });
    const [regeneratingResume, setRegeneratingResume] = React.useState(false);
    const [regeneratingCL, setRegeneratingCL] = React.useState(false);
    const [activePhaseTab, setActivePhaseTab] = React.useState('Saved');

    // Default first sub-stage per stage — keeps externalSubStage always wired
    const DEFAULT_SUBSTAGES = {
        saved: 'parsed', generated: 'resume', applied: 'submitted',
        interviewing: 'recruiter_screen', decision: 'awaiting_decision',
        accepted: 'offer_received', offered: 'offer_received',
        rejected: 'rejection_received', declined: 'offer_review', withdrawn: 'decision_made',
    };
    const getDefaultSubStage = (stage) => DEFAULT_SUBSTAGES[(stage || 'saved').toLowerCase()] || 'parsed';

    const [activeSubStage, setActiveSubStage] = React.useState(() => getDefaultSubStage(app?.pipeline_stage));
    const [isJobDescExpanded, setIsJobDescExpanded] = React.useState(false);

    React.useEffect(() => {
        if (app?.pipeline_stage) {
            const s = app.pipeline_stage.toLowerCase();
            if (s === 'accepted') setActivePhaseTab('Accepted');
            else if (s === 'rejected') setActivePhaseTab('Rejected');
            else if (s === 'declined') setActivePhaseTab('Declined');
            else if (s.includes('withdraw') || s.includes('cancel')) setActivePhaseTab('Withdrawn');
            else if (s === 'offered') setActivePhaseTab('Offered');
            else if (s === 'decision') setActivePhaseTab('Decision');
            else if (['saved', 'generated', 'applied', 'interviewing'].includes(s)) {
                setActivePhaseTab(s.charAt(0).toUpperCase() + s.slice(1));
            } else setActivePhaseTab('Saved');
        }
        setActiveSubStage(getDefaultSubStage(app?.pipeline_stage));
    }, [app?.pipeline_stage]);
    const [expandedResume, setExpandedResume] = React.useState(false);
    const [expandedCL, setExpandedCL] = React.useState(false);
    const [showResumeModal, setShowResumeModal] = React.useState(false);
    const [showCLModal, setShowCLModal] = React.useState(false);
    const [resumeInstructions, setResumeInstructions] = React.useState('');
    const [clInstructions, setClInstructions] = React.useState('');

    
    const [showResumeOverrideConfirm, setShowResumeOverrideConfirm] = React.useState(false);
    const [showCLOverrideConfirm, setShowCLOverrideConfirm] = React.useState(false);
    const [pendingResumeFile, setPendingResumeFile] = React.useState(null);
    const [pendingCLFile, setPendingCLFile] = React.useState(null);
    const [uploadingOverride, setUploadingOverride] = React.useState(false);
    const [connections, setConnections] = React.useState([]);
    const [commuteInfo, setCommuteInfo] = React.useState({ text: 'Calculating...' });
    const [profilePrefs, setProfilePrefs] = React.useState(null);
    const [profileBaseResume, setProfileBaseResume] = React.useState(null);
    const [currentCommuteType, setCurrentCommuteType] = React.useState('Driving');
    const [allCommutes, setAllCommutes] = React.useState({});

    const logoInputRef = React.useRef(null);
    
    const extractSalaryNumbers = (str) => {
        if (!str) return [];
        const s = String(str);
        const normalized = s.replace(/,/g, '');
        const regex = /(\d+(?:\.\d+)?)(k)?/gi;
        let match;
        const nums = [];
        while ((match = regex.exec(normalized)) !== null) {
            let val = parseFloat(match[1]);
            if (match[2] && match[2].toLowerCase() === 'k') val *= 1000;
            else if (val < 1000 && val > 0 && s.toLowerCase().includes('k')) val *= 1000;
            else if (val < 1000 && val > 0 && !s.toLowerCase().includes('k')) val *= 2080;
            nums.push(val);
        }
        return nums;
    };
    const resumeOverrideInputRef = React.useRef(null);
    const clOverrideInputRef = React.useRef(null);

    // Stable handler for closing preview to avoid unnecessary re-renders of the memoized PreviewModal
    const handleClosePreview = React.useCallback(() => {
        setPreviewFile(null);
    }, []);

    // Sync formData when app changes
    React.useEffect(() => {
        const loadProfileData = async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/api/profile`);
                if (res.ok) {
                    const profileData = await res.json();
                    setProfileDocs(profileData.additional_docs || []);
                    setProfilePrefs(profileData?.preferences || {});
                    setProfileBaseResume(profileData?.base_resume_path || null);
                    
                    if (app.id && app.location) {
                        const maxCommutePref = profileData?.preferences?.max_commute || '';
                        let maxCommuteMins = null;
                        if (maxCommutePref === '15 mins') maxCommuteMins = 15;
                        else if (maxCommutePref === '30 mins') maxCommuteMins = 30;
                        else if (maxCommutePref === '45 mins') maxCommuteMins = 45;
                        else if (maxCommutePref === '1 hour') maxCommuteMins = 60;
                        else if (maxCommutePref === '1.5 hours') maxCommuteMins = 90;
                        else if (maxCommutePref === '2 hours') maxCommuteMins = 120;
                        else if (maxCommutePref === 'Remote Only') maxCommuteMins = 0;

                        if (app.location.toLowerCase().includes('remote') || app.location_type?.toLowerCase() === 'remote') {
                            setCommuteInfo({ text: 'Remote (No Commute)' });
                        } else {
                            const commuteDetails = app.commute_details || {};
                            const prefCommuteTypes = profileData?.preferences?.commute_types || ['Driving'];
                            setAllCommutes(commuteDetails);
                            
                            let initialType = 'Driving';
                            if (prefCommuteTypes.includes('Driving') && commuteDetails['Driving']) {
                                initialType = 'Driving';
                            } else if (prefCommuteTypes.length > 0) {
                                const found = prefCommuteTypes.find(t => commuteDetails[t]);
                                if (found) initialType = found;
                                else {
                                    const available = Object.keys(commuteDetails);
                                    if (available.length > 0) initialType = available[0];
                                }
                            }
                            setCurrentCommuteType(initialType);

                            const updateCommuteDisplay = (type) => {
                                const data = commuteDetails[type];
                                if (!data) {
                                    setCommuteInfo({ text: 'Pending...' });
                                    return;
                                }
                                const mins = data.mins;
                                const dist = data.distance;
                                const isOverLimit = maxCommuteMins !== null && mins > maxCommuteMins;
                                const originParts = [];
                                if (profileData.address_line1) originParts.push(profileData.address_line1);
                                if (profileData.city) originParts.push(profileData.city);
                                if (profileData.state) originParts.push(profileData.state);
                                const originStr = originParts.join(', ');
                                let mode = 'driving';
                                if (type === 'Walking') mode = 'walking';
                                else if (type === 'Bicycle') mode = 'bicycling';
                                else if (type === 'Public Transportation') mode = 'transit';
                                else if (type === 'Flight') mode = 'driving';
                                const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(app.location)}&travelmode=${mode}`;
                                setCommuteInfo({
                                    text: `${mins} min ${type.toLowerCase()} (${dist || 0} mi)`,
                                    isOverLimit,
                                    maxMins: maxCommuteMins,
                                    url: directionsUrl,
                                    type: type
                                });
                            };
                            updateCommuteDisplay(initialType);
                        }
                    } else if (app.id && !app.location) {
                        setCommuteInfo({ text: 'No Location Provided' });
                    }
                }
            } catch (err) {
                console.error("Failed to load profile data", err);
            }
        };

        setFormData({ ...app });
        setIsArchived(app.is_archived === 'true' || app.is_archived === true);
        setLogoUrl(app.company_logo || null);

        if (app.company) {
            fetchWithAuth(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(app.company)}`)
                .then(res => res.json())
                .then(data => setConnections(data.matches || []))
                .catch(err => console.warn("Failed to fetch connections", err));
        }

        loadProfileData();
    }, [app]);

    const handleArchive = async (archive) => {
        setArchiving(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/archive`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: archive }),
            });
            if (res.ok) {
                setIsArchived(archive);
                if (onArchive) onArchive(app.id, archive);
            } else {
                alert('Failed to update archive status.');
            }
        } catch {
            alert('Error updating archive status.');
        } finally {
            setArchiving(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            setLogoUrl(dataUrl);
            if (onUpdate) onUpdate(app.id, { company_logo: dataUrl });
            // Persist to backend
            try {
                await fetchWithAuth(`${API_URL}/api/applications/${app.id}/logo`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company_logo: dataUrl }),
                });
            } catch (err) {
                console.warn('Logo save failed', err);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLogoSelect = async (logoValue) => {
        // logoValue can be a data URL (from file) or a remote URL
        setShowLogoPicker(false);
        setLogoUrl(logoValue);
        if (onUpdate) onUpdate(app.id, { company_logo: logoValue });
        try {
            await fetchWithAuth(`${API_URL}/api/applications/${app.id}/logo`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_logo: logoValue }),
            });
        } catch (err) {
            console.warn('Logo save failed', err);
        }
    };

    const handleOverrideUpload = (type) => {
        if (type === 'resume') {
            resumeOverrideInputRef.current?.click();
        } else {
            clOverrideInputRef.current?.click();
        }
    };

    const onFileSelected = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (type === 'resume') {
            setPendingResumeFile(file);
            setShowResumeOverrideConfirm(true);
        } else {
            setPendingCLFile(file);
            setShowCLOverrideConfirm(true);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const confirmOverride = async (type) => {
        setUploadingOverride(true);
        const file = type === 'resume' ? pendingResumeFile : pendingCLFile;
        const endpoint = type === 'resume' ? 'override-resume' : 'override-cover-letter';
        
        try {
            const upData = new FormData();
            upData.append('file', file);
            
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/${endpoint}`, {
                method: 'POST',
                body: upData
            });
            
            if (res.ok) {
                const result = await res.json();
                if (onUpdate) {
                    const updateData = type === 'resume' 
                        ? { override_resume_path: result.path, active_resume_type: 'override', profile_snapshot: result.profile_snapshot }
                        : { override_cover_letter_path: result.path, active_cover_letter_type: 'override' };
                    onUpdate(app.id, updateData);
                }
            } else {
                alert(`Failed to upload override ${type}.`);
            }
        } catch (err) {
            console.error(err);
            alert(`Error uploading override ${type}.`);
        } finally {
            setUploadingOverride(false);
            if (type === 'resume') {
                setShowResumeOverrideConfirm(false);
                setPendingResumeFile(null);
            } else {
                setShowCLOverrideConfirm(false);
                setPendingCLFile(null);
            }
        }
    };
    const toggleActiveVersion = async (type, active) => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/toggle-active`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, active })
            });
            if (res.ok) {
                if (onUpdate) {
                    const field = type === 'resume' ? 'active_resume_type' : 'active_cover_letter_type';
                    onUpdate(app.id, { [field]: active });
                }
            }
        } catch (err) {
            console.error(err);
        }
    };
    const handleDeleteOverride = async (type) => {
        if (!confirm(`Are you sure you want to delete this custom ${type}?`)) return;
        
        try {
            const docType = type === 'resume' ? 'resume' : 'cover_letter';
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/override/${docType}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                if (onUpdate) {
                    const field = type === 'resume' ? 'override_resume_path' : 'override_cover_letter_path';
                    const activeField = type === 'resume' ? 'active_resume_type' : 'active_cover_letter_type';
                    onUpdate(app.id, { [field]: null, [activeField]: 'generated' });
                }
            } else {
                alert(`Failed to delete custom ${type}.`);
            }
        } catch (err) {
            console.error(err);
            alert(`Error deleting custom ${type}.`);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, force: true }),
            });
            if (res.ok) {
                setIsEditing(false);
                if (onUpdate) onUpdate(app.id, formData);
            } else {
                alert('Failed to save changes.');
            }
        } catch {
            alert('Error saving changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateResume = async () => {
        if (!window.confirm("This will regenerate the tailored resume using your current base resume and this job description. Continue?")) return;
        setRegeneratingResume(true);
        try {
            const body = new FormData();
            body.append('job_description', app.job_description);
            body.append('use_default_resume', 'true'); 
            body.append('instructions', resumeInstructions);
            
            // Calculate additional context paths
            const jobDocs = safeParseJSON(app.additional_docs, []);
            const excludedPaths = safeParseJSON(app.excluded_profile_docs, []);
            const filteredProfilePaths = profileDocs.filter(d => !excludedPaths.includes(d.path)).map(d => d.path);
            const jobPaths = jobDocs.map(d => d.path);
            const allContextPaths = [...filteredProfilePaths, ...jobPaths];
            
            if (allContextPaths.length > 0) {
                body.append('additional_context_paths', JSON.stringify(allContextPaths));
            }
            
            const res = await fetchWithAuth(`${API_URL}/api/tailor-resume`, {
                method: 'POST',
                body: body
            });
            
            if (res.ok) {
                const data = await res.json();
                const updateData = {
                    tailored_resume_path: data.files.pdf.split('/').pop(),
                    resume_changes_summary: data.change_summary
                };
                // Save the update
                await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                if (onUpdate) onUpdate(app.id, updateData);
                alert("Resume regenerated successfully!");
            } else {
                const err = await res.json();
                alert(`Failed to regenerate: ${err.detail || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setRegeneratingResume(false);
        }
    };

    const handleRegenerateCL = async () => {
        if (!window.confirm("This will regenerate the cover letter using your current resume data and this job description. Continue?")) return;
        setRegeneratingCL(true);
        try {
            // We need resume text. If we don't have it locally, we might need to fetch it or assume backend handles it.
            // Currently generate-cover-letter requires resume_text.
            // Let's see if we have resume_data in app.
                const resumeData = safeParseJSON(app.resume_data, {});
                const resumeText = resumeData?.full_text?.join('\n') || "";

                // Calculate additional context paths
                const jobDocs = safeParseJSON(app.additional_docs, []);
                const excludedPaths = safeParseJSON(app.excluded_profile_docs, []);
                const filteredProfilePaths = profileDocs.filter(d => !excludedPaths.includes(d.path)).map(d => d.path);
                const jobPaths = jobDocs.map(d => d.path);
                const allContextPaths = [...filteredProfilePaths, ...jobPaths];

                const res = await fetchWithAuth(`${API_URL}/api/generate-cover-letter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resume_text: resumeText,
                        job_description: app.job_description,
                        base_filename: app.original_resume_path || "resume.docx",
                        instructions: clInstructions,
                        additional_context_paths: allContextPaths
                    })
                });
            
            if (res.ok) {
                const data = await res.json();
                const updateData = {
                    cover_letter_path: data.files.pdf.split('/').pop(),
                    cover_letter_changes_summary: data.generation_summary
                };
                // Save the update
                await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                if (onUpdate) onUpdate(app.id, updateData);
                alert("Cover letter regenerated successfully!");
            } else {
                const err = await res.json();
                alert(`Failed to regenerate: ${err.detail || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setRegeneratingCL(false);
        }
    };

    const handleUploadAppDoc = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingDoc(true);
        const formDataUpload = new FormData();
        formDataUpload.append('document', file);

        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}/upload-additional-doc`, {
                method: 'POST',
                body: formDataUpload
            });
            if (res.ok) {
                const data = await res.json();
                onUpdate({ ...app, additional_docs: data.docs });
            } else {
                alert("Failed to upload document");
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading document");
        } finally {
            setUploadingDoc(false);
            if (docInputRef.current) docInputRef.current.value = '';
        }
    };

    const handleRemoveDoc = async (docPath, isProfileDoc) => {
        if (!window.confirm(`Are you sure you want to remove this ${isProfileDoc ? 'profile ' : '' }document from this job?`)) return;

        let updatedFields = {};
        if (isProfileDoc) {
            const currentExclusions = safeParseJSON(app.excluded_profile_docs, []);
            if (!currentExclusions.includes(docPath)) {
                updatedFields.excluded_profile_docs = [...currentExclusions, docPath];
            }
        } else {
            const currentDocs = safeParseJSON(app.additional_docs, []);
            updatedFields.additional_docs = currentDocs.filter(d => d.path !== docPath);
        }

        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
            });
            if (res.ok) {
                onUpdate({ ...app, ...updatedFields });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewDoc = (path) => {
        window.open(`${API_URL}/api/download/${path}`, '_blank');
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, { method: 'DELETE' });
            if (res.ok) {
                onDelete(app.id);
            } else {
                alert('Failed to delete application. Please try again.');
            }
        } catch {
            alert('Error deleting application.');
        } finally {
            setDeleting(false);
        }
    };

    const handlePreview = async (type, path) => {
        if (!path) return;

        let title = '';
        let subtitle = '';
        let pdfUrl = null;

        if (type === 'original') {
            title = 'Original Resume';
            subtitle = 'Source Document';

            // Try to find PDF version. If it's a docx, assume backend generated a .pdf
            if (path.toLowerCase().endsWith('.pdf')) {
                pdfUrl = `${API_URL}/api/download/${path}`;
            } else if (path.toLowerCase().endsWith('.docx')) {
                const pdfPath = path.replace('.docx', '.pdf');
                pdfUrl = `${API_URL}/api/download/${pdfPath}`;
            } else {
                pdfUrl = null;
            }
            setPreviewFile({ type, path, title, subtitle, pdfUrl, isLoading: false });

        } else if (type === 'tailored') {
            title = 'Tailored Resume';
            subtitle = `Targeting ${app.company}`;
            // Assume PDF version exists for tailored docs
            const pdfPath = path.replace('.docx', '.pdf');
            pdfUrl = `${API_URL}/api/download/${pdfPath}`;
            setPreviewFile({ type, path, title, subtitle, pdfUrl, isLoading: false });

        } else if (type === 'cover') {
            title = 'Cover Letter';
            subtitle = `For ${app.company}`;
            // Assume PDF version exists for generated docs
            const pdfPath = path.replace('.docx', '.pdf');
            pdfUrl = `${API_URL}/api/download/${pdfPath}`;
            setPreviewFile({ type, path, title, subtitle, pdfUrl, isLoading: false });
        } else if (type === 'override' || type === 'override_cl') {
            title = type === 'override' ? 'Custom Final Resume' : 'Custom Final Cover Letter';
            subtitle = 'User Uploaded Version';
            const pdfPath = path.toLowerCase().endsWith('.pdf') ? path : path.replace('.docx', '.pdf');
            pdfUrl = `${API_URL}/api/download/${pdfPath}`;
            setPreviewFile({ type, path, title, subtitle, pdfUrl, isLoading: false });
        }
    };

    if (isMobile) {
        return <ApplicationDetailMobile app={app} onBack={onBack} onUpdate={onUpdate} onPersist={onPersist} onStartFullGeneration={onStartFullGeneration} />;
    }

    return (
        <div style={{ maxWidth: '1600px', width: '100%', margin: '0 auto', background: 'var(--bg-primary)', position: 'relative' }}>
            <style>{`
                :root {
                    --bg-glass-custom: rgba(15, 23, 42, 0.85);
                    --badge-bg-custom: rgba(255, 255, 255, 0.04);
                    --salary-not-listed-bg-custom: rgba(255, 255, 255, 0.02);
                    --btn-hover-bg: rgba(255, 255, 255, 0.06);
                }
                .sticky-header-container {
                    padding: 0 24px;
                }
                .detail-main-layout {
                    padding: 16px 24px 24px 24px;
                }
                @media (max-width: 1024px) {
                    .sticky-header-container {
                        padding: 0 16px !important;
                    }
                    .detail-main-layout {
                        padding: 16px 16px 24px 16px !important;
                    }
                }
                @media (max-width: 768px) {
                    .sticky-header-container {
                        padding: 0 12px !important;
                    }
                    .detail-main-layout {
                        padding: 12px 12px 24px 12px !important;
                    }
                }

                :root[data-theme="light"] {
                    --bg-glass-custom: rgba(255, 255, 255, 0.85);
                    --badge-bg-custom: rgba(15, 23, 42, 0.04);
                    --salary-not-listed-bg-custom: rgba(15, 23, 42, 0.02);
                    --btn-hover-bg: rgba(15, 23, 42, 0.06);
                }
                @media (max-width: 1400px) {
                    .sticky-interest {
                        display: none !important;
                    }
                }
                @media (max-width: 1280px) {
                    .sticky-job-type {
                        display: none !important;
                    }
                }
                @media (max-width: 1180px) {
                    .sticky-location {
                        display: none !important;
                    }
                }
                @media (max-width: 1080px) {
                    .sticky-salary {
                        display: none !important;
                    }
                }
                @media (max-width: 980px) {
                    .sticky-score {
                        display: none !important;
                    }
                }
                @media (max-width: 880px) {
                    .sticky-stage {
                        display: none !important;
                    }
                }
                @media (max-width: 768px) {
                    .sticky-title-info, .sticky-divider-info {
                        display: none !important;
                    }
                    .sticky-btn-text {
                        display: none !important;
                    }
                    .sticky-btn {
                        padding: 0 !important;
                        width: 32px !important;
                        height: 32px !important;
                        justify-content: center !important;
                        border-radius: 50% !important;
                        gap: 0 !important;
                    }
                }
            `}</style>

            {/* Sticky Mini Header — Logo, Title, Actions, and Rich Metadata (zero-height outer wrapper to prevent layout shift) */}
            <div style={{
                position: 'sticky',
                top: 0,
                left: 0,
                right: 0,
                width: '100%',
                height: 0,
                overflow: 'visible',
                zIndex: 10001,
            }}>
                <div className="sticky-header-container" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '64px',
                    background: 'var(--bg-glass-custom)',
                    backdropFilter: 'blur(16px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(120%)',
                    borderBottom: '1px solid var(--border-color)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, visibility 0.4s ease',
                    transform: showStickyHeaderSummary ? 'translateY(0)' : 'translateY(-100%)',
                    opacity: showStickyHeaderSummary ? 1 : 0,
                    visibility: showStickyHeaderSummary ? 'visible' : 'hidden',
                    pointerEvents: showStickyHeaderSummary ? 'auto' : 'none',
                }}>
                    {/* Left Section: Back, Logo, Title, Stage, Score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexShrink: 0 }}>
                        <button
                            onClick={onBack}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                transition: 'background 0.2s, color 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--btn-hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            title="Back to Dashboard"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_back</span>
                        </button>
                        
                        <div className="sticky-divider-info" style={{ width: '1px', height: '20px', background: 'var(--border-color)', flexShrink: 0 }} />

                        {app.company_logo ? (
                            <img 
                                src={app.company_logo} 
                                alt={app.company} 
                                style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    objectFit: 'contain', 
                                    borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '2px',
                                    border: '1px solid var(--border-color)',
                                    flexShrink: 0
                                }} 
                            />
                        ) : (
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '11px' }}>
                                    {(app.company || '?').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                                </span>
                            </div>
                        )}

                        <div className="sticky-title-info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 800, 
                                color: 'var(--text-primary)', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                lineHeight: 1.25
                            }}>
                                {app.job_title}
                            </span>
                            <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: 'var(--text-secondary)', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                            }}>
                                {app.company}
                            </span>
                        </div>

                        {/* Stage Pill */}
                        {(() => {
                            const stickyStage = (app.pipeline_stage || 'saved').toLowerCase();
                            const stickyStatusColorMap = {
                                saved: 'var(--primary)', generated: 'var(--primary)', applied: 'var(--primary)',
                                interviewing: 'var(--warning)', decision: 'var(--warning)',
                                accepted: 'var(--success)', offered: 'var(--success)',
                                rejected: 'var(--error)', declined: 'var(--error)', withdrawn: 'var(--error)',
                            };
                            const stickyPillColor = stickyStatusColorMap[stickyStage] || 'var(--primary)';
                            const stickyPillBg = stickyStage === 'accepted' || stickyStage === 'offered'
                                ? 'rgba(16,185,129,0.1)'
                                : stickyStage === 'interviewing' || stickyStage === 'decision'
                                ? 'rgba(245,158,11,0.1)'
                                : stickyStage === 'rejected' || stickyStage === 'declined' || stickyStage === 'withdrawn'
                                ? 'rgba(239,68,68,0.1)'
                                : 'rgba(37,106,244,0.1)';

                            return (
                                <span className="sticky-stage" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 8px', borderRadius: 999,
                                    background: stickyPillBg, color: stickyPillColor,
                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    marginLeft: '8px',
                                    flexShrink: 0
                                }}>
                                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: stickyPillColor, flexShrink: 0 }} />
                                    {app.pipeline_stage || 'Saved'}
                                </span>
                            );
                        })()}

                        {/* Match Score */}
                        {app.match_score != null && (
                            <div className="sticky-score" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', flexShrink: 0 }}>
                                {(() => {
                                    const score = app.match_score;
                                    const scoreColor = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--error)';
                                    const size = 32, stroke = 2.5;
                                    const r = (size - stroke) / 2;
                                    const circ = 2 * Math.PI * r;
                                    const dash = (score / 100) * circ;
                                    return (
                                        <div style={{ position: 'relative', width: size, height: size }}>
                                            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                                                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-color)" strokeWidth={stroke} />
                                                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={scoreColor} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
                                            </svg>
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: scoreColor }}>
                                                {score}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Match</span>
                            </div>
                        )}
                    </div>

                    {/* Middle Section: Metadata Details */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: 0,
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                    }}>
                        {/* Salary */}
                        {app.salary_range && app.salary_range !== 'Not Listed' ? (
                            <div className="sticky-salary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>payments</span>
                                <span>{app.salary_range}</span>
                            </div>
                        ) : (
                            <div className="sticky-salary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--salary-not-listed-bg-custom)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>payments</span>
                                <span>Salary not listed</span>
                            </div>
                        )}

                        {/* Location & Location Type */}
                        {app.location && (
                            <div className="sticky-location" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--badge-bg-custom)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>location_on</span>
                                <span>{app.location}{app.location_type ? ` (${app.location_type})` : ''}</span>
                            </div>
                        )}

                        {/* Job Type */}
                        {app.job_type && app.job_type !== 'N/A' && (
                            <div className="sticky-job-type" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--badge-bg-custom)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>work</span>
                                <span>{app.job_type}</span>
                            </div>
                        )}

                        {/* Interest Level */}
                        <div className="sticky-interest" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--badge-bg-custom)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Interest</span>
                            <InterestStars
                                level={isEditing ? formData.interest_level : app.interest_level}
                                size="12px"
                                onChange={async (newLevel) => {
                                    if (isEditing) {
                                        setFormData({ ...formData, interest_level: newLevel });
                                    } else {
                                        try {
                                            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ interest_level: newLevel })
                                            });
                                            if (res.ok && onUpdate) onUpdate(app.id, { interest_level: newLevel });
                                        } catch (err) { console.error(err); }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Right Section: Compact Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <button
                            onClick={() => { if (isEditing) handleSave(); else { setFormData({ ...app }); setIsEditing(true); } }}
                            disabled={saving}
                            className="sticky-btn btn-util"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>{isEditing ? 'save' : 'edit'}</span>
                            <span className="sticky-btn-text">{isEditing ? (saving ? 'Saving...' : 'Save') : 'Edit'}</span>
                        </button>
                        {isEditing && (
                            <button
                                onClick={() => { setIsEditing(false); setFormData({ ...app }); }}
                                className="sticky-btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>close</span>
                                <span className="sticky-btn-text">Cancel</span>
                            </button>
                        )}
                        <button 
                            onClick={() => handleArchive(!isArchived)} 
                            disabled={archiving} 
                            className={`sticky-btn btn-util ${isArchived ? 'btn-warning' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>{isArchived ? 'unarchive' : 'archive'}</span>
                            <span className="sticky-btn-text">{isArchived ? 'Unarchive' : 'Archive'}</span>
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)} 
                            className="sticky-btn btn-util btn-danger"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>delete</span>
                            <span className="sticky-btn-text">Delete</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main layout — compact header + two-column workspace */}
            <div className="detail-main-layout" style={{ overflowX: 'hidden' }}>
                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, backdropFilter: 'blur(6px)'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                            border: '1px solid rgba(239,68,68,0.3)', maxWidth: '440px', width: '90%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ color: '#f87171', fontSize: '1.5rem' }}>warning</span>
                                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Delete Application?</h2>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                This will permanently delete <strong>{app.job_title}</strong> at <strong>{app.company}</strong>.
                                This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    style={{
                                        padding: '0.5rem 1.2rem', background: 'transparent',
                                        border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                        borderRadius: '0.5rem', cursor: 'pointer'
                                    }}
                                >Cancel</button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    style={{
                                        padding: '0.5rem 1.2rem', background: '#ef4444',
                                        border: 'none', color: 'white', borderRadius: '0.5rem',
                                        cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 600,
                                        opacity: deleting ? 0.7 : 1
                                    }}
                                >{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Resume Override Confirmation Modal */}
                {showResumeOverrideConfirm && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, backdropFilter: 'blur(6px)'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                            border: '1px solid var(--primary)', maxWidth: '440px', width: '90%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>info</span>
                                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Use Override Resume?</h2>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                You are about to upload a final override version of your resume.
                                <strong> This version will be used by the Chrome extension when applying for this job.</strong>
                                <br/><br/>
                                We will also process this document to update your profile snapshot for this application.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowResumeOverrideConfirm(false); setPendingResumeFile(null); }}
                                    style={{ padding: '0.5rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '0.5rem', cursor: 'pointer' }}
                                >Cancel</button>
                                <button
                                    onClick={() => confirmOverride('resume')}
                                    disabled={uploadingOverride}
                                    style={{ padding: '0.5rem 1.2rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: uploadingOverride ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: uploadingOverride ? 0.7 : 1 }}
                                >{uploadingOverride ? 'Uploading...' : 'Confirm & Use'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cover Letter Override Confirmation Modal */}
                {showCLOverrideConfirm && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, backdropFilter: 'blur(6px)'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                            border: '1px solid var(--primary)', maxWidth: '440px', width: '90%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>info</span>
                                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Use Override Cover Letter?</h2>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                You are about to upload a final override version of your cover letter.
                                <strong> This version will be used by the Chrome extension when applying for this job.</strong>
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowCLOverrideConfirm(false); setPendingCLFile(null); }}
                                    style={{ padding: '0.5rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '0.5rem', cursor: 'pointer' }}
                                >Cancel</button>
                                <button
                                    onClick={() => confirmOverride('cover_letter')}
                                    disabled={uploadingOverride}
                                    style={{ padding: '0.5rem 1.2rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: uploadingOverride ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: uploadingOverride ? 0.7 : 1 }}
                                >{uploadingOverride ? 'Uploading...' : 'Confirm & Use'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* File inputs */}
                <input type="file" ref={logoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <input type="file" ref={resumeOverrideInputRef} accept=".docx,.pdf,.txt" style={{ display: 'none' }} onChange={(e) => onFileSelected(e, 'resume')} />
                <input type="file" ref={clOverrideInputRef} accept=".docx,.pdf,.txt" style={{ display: 'none' }} onChange={(e) => onFileSelected(e, 'cover_letter')} />
                <input type="file" ref={docInputRef} style={{ display: 'none' }} onChange={handleUploadAppDoc} />

                {/* Action bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button
                        onClick={onBack}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_back</span>
                        Back to Dashboard
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => { if (isEditing) handleSave(); else { setFormData({ ...app }); setIsEditing(true); } }}
                            disabled={saving}
                            className={`btn-util ${isEditing ? 'active' : ''}`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isEditing ? 'save' : 'edit'}</span>
                            {isEditing ? (saving ? 'Saving...' : 'Save Changes') : 'Edit Info'}
                        </button>
                        {isEditing && (
                            <button
                                onClick={() => { setIsEditing(false); setFormData({ ...app }); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                            >Cancel</button>
                        )}
                        <button onClick={() => handleArchive(!isArchived)} disabled={archiving} className={`btn-util ${isArchived ? 'btn-warning' : ''}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isArchived ? 'unarchive' : 'archive'}</span>
                            {isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(true)} className="btn-util btn-danger">
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                            Delete
                        </button>
                    </div>
                </div>

                {/* Archived banner */}
                {isArchived && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', marginBottom: '12px', background: 'var(--shadow-glow)', border: '1px solid var(--warning)', borderRadius: '0.6rem', color: 'var(--warning)', fontSize: '0.875rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>archive</span>
                        This application is archived. It won't appear in your main dashboard view.
                    </div>
                )}

                {/* ── Header card ──────────────────────────────────────────────────── */}
                {(() => {
                    const stage = (app.pipeline_stage || 'saved').toLowerCase();
                    const statusColorMap = {
                        saved: 'var(--primary)', generated: 'var(--primary)', applied: 'var(--primary)',
                        interviewing: 'var(--warning)', decision: 'var(--warning)',
                        accepted: 'var(--success)', offered: 'var(--success)',
                        rejected: 'var(--error)', declined: 'var(--error)', withdrawn: 'var(--error)',
                    };
                    const pillColor = statusColorMap[stage] || 'var(--primary)';
                    const pillBg = stage === 'accepted' || stage === 'offered'
                        ? 'rgba(16,185,129,0.1)'
                        : stage === 'interviewing' || stage === 'decision'
                        ? 'rgba(245,158,11,0.1)'
                        : stage === 'rejected' || stage === 'declined' || stage === 'withdrawn'
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(37,106,244,0.1)';

                    const resumeState = app.tailored_resume_path ? 'ok'
                        : (app.original_resume_path || profileBaseResume) ? 'attention'
                        : 'missing';
                    const coverState = app.cover_letter_path ? 'ok' : 'missing';
                    const docList = [
                        { id: 'resume', name: 'Resume', icon: 'description', state: resumeState },
                        { id: 'cover', name: 'Cover', icon: 'mail', state: coverState },
                        { id: 'ctx', name: 'Context', icon: 'folder', state: 'ok' },
                    ];
                    const docStateColor = { ok: 'var(--success)', attention: 'var(--warning)', missing: 'var(--error)' };
                    const docStateBg = { ok: 'rgba(16,185,129,0.08)', attention: 'rgba(245,158,11,0.08)', missing: 'rgba(239,68,68,0.08)' };
                    const docStateBorder = { ok: 'rgba(16,185,129,0.2)', attention: 'rgba(245,158,11,0.25)', missing: 'rgba(239,68,68,0.25)' };
                    const docStateLabel = { ok: 'OK', attention: 'Tailor', missing: 'Missing' };
                    const docStateIcon = { ok: 'check_circle', attention: 'priority_high', missing: 'add' };

                    const score = app.match_score;
                    const scoreColor = score == null ? 'var(--text-muted)' : score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--error)';
                    const cmp = score != null ? getScoreComparison(score, avgScore) : null;

                    const initials = (app.company || '?').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

                    return (
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 14,
                            padding: 18,
                            marginBottom: 14,
                            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                        }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                                {/* 1a. Company logo */}
                                <div
                                    onClick={() => setShowLogoPicker(true)}
                                    title="Click to set a logo"
                                    style={{
                                        width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                                        background: logoUrl ? 'transparent' : 'rgba(255,255,255,0.04)',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                >
                                    {isEnrichingGlobal ? (
                                        <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
                                    ) : logoUrl ? (
                                        <img src={logoUrl} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setLogoUrl(null)} />
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: 16 }}>{initials}</span>
                                    )}
                                </div>

                                {/* 1b. Identity column */}
                                <div style={{ flex: 1, minWidth: 0 }}>

                                    {/* Title row + status pill */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.job_title}
                                                onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                                                style={{ fontSize: 20, fontWeight: 800, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 8px', flex: 1 }}
                                            />
                                        ) : (
                                            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                                                {app.job_title}
                                            </h1>
                                        )}
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            padding: '3px 10px', borderRadius: 999,
                                            background: pillBg, color: pillColor,
                                            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pillColor, flexShrink: 0 }} />
                                            {app.pipeline_stage || 'Saved'}
                                        </span>
                                    </div>

                                    {/* Company + salary + interest */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.company}
                                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                                                style={{ fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 8px' }}
                                            />
                                        ) : (
                                            app.company_url ? (
                                                <a href={app.company_url.startsWith('http') ? app.company_url : `https://${app.company_url}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    {app.company}
                                                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--primary)', opacity: 0.7 }}>arrow_outward</span>
                                                </a>
                                            ) : (
                                                <span>{app.company}</span>
                                            )
                                        )}

                                        {/* Salary chip */}
                                        {app.salary_range && app.salary_range !== 'Not Listed' ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)', fontSize: 12, fontWeight: 800 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>payments</span>
                                                {app.salary_range}
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 10px', borderRadius: 999, background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>payments</span>
                                                Salary not listed
                                            </span>
                                        )}

                                        {/* Interest stars */}
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Interest</span>
                                            <InterestStars
                                                level={isEditing ? formData.interest_level : app.interest_level}
                                                size="14px"
                                                onChange={async (newLevel) => {
                                                    if (isEditing) {
                                                        setFormData({ ...formData, interest_level: newLevel });
                                                    } else {
                                                        try {
                                                            const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ interest_level: newLevel })
                                                            });
                                                            if (res.ok && onUpdate) onUpdate(app.id, { interest_level: newLevel });
                                                        } catch (err) { console.error(err); }
                                                    }
                                                }}
                                            />
                                        </span>
                                    </div>

                                    {/* Meta row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                        {app.location && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>location_on</span>
                                                {app.location}
                                            </span>
                                        )}
                                        {app.location && (app.job_type || app.job_url || app.apply_url) && (
                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                        )}
                                        {app.job_type && app.job_type !== 'N/A' && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>work</span>
                                                {app.job_type}
                                            </span>
                                        )}
                                        {app.job_type && app.job_type !== 'N/A' && (app.job_url || app.apply_url) && (
                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                        )}
                                        {app.job_url && (
                                            <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                                                Visit Listing
                                            </a>
                                        )}
                                        {app.job_url && app.apply_url && <span style={{ color: 'var(--text-muted)' }}>·</span>}
                                        {app.apply_url && (
                                            <a href={app.apply_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rocket_launch</span>
                                                Direct Apply
                                            </a>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div style={{ height: 1, background: 'var(--border-color)', marginBottom: 10 }} />

                                    {/* Docs cluster + view full details */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Docs</span>
                                        {docList.map(doc => (
                                            <button
                                                key={doc.id}
                                                onClick={() => {
                                                    if (doc.id === 'resume') setShowResumeModal(true);
                                                    else if (doc.id === 'cover') setShowCLModal(true);
                                                    else docInputRef.current?.click();
                                                }}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 4px 4px 10px', borderRadius: 999,
                                                    background: 'var(--bg-card)',
                                                    border: `1px solid ${docStateBorder[doc.state]}`,
                                                    cursor: 'pointer',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{doc.icon}</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</span>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                                    padding: '2px 7px', borderRadius: 999,
                                                    background: docStateBg[doc.state],
                                                    color: docStateColor[doc.state],
                                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                                                }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 9, fontVariationSettings: "'FILL' 1" }}>{docStateIcon[doc.state]}</span>
                                                    {docStateLabel[doc.state]}
                                                </span>
                                            </button>
                                        ))}

                                        {/* View full job details */}
                                        <button
                                            onClick={() => setIsJobDescExpanded(v => !v)}
                                            style={{
                                                marginLeft: 'auto',
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '5px 10px', borderRadius: 8,
                                                background: 'rgba(37,106,244,0.08)',
                                                border: '1px solid rgba(37,106,244,0.18)',
                                                color: 'var(--primary)',
                                                fontSize: 12, cursor: 'pointer',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,106,244,0.16)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,106,244,0.08)'; e.currentTarget.style.borderColor = 'rgba(37,106,244,0.18)'; }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>article</span>
                                            {isJobDescExpanded ? 'Hide details' : 'View full job details'}
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                                {isJobDescExpanded ? 'expand_less' : 'chevron_right'}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Expandable job description */}
                                    {isJobDescExpanded && (
                                        <div style={{ marginTop: 12 }}>
                                            <JobDescriptionContent text={app.job_description} />
                                        </div>
                                    )}
                                </div>

                                {/* 1c. Score ring */}
                                {score != null && (
                                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                        {(() => {
                                            const size = 60, stroke = 4;
                                            const r = (size - stroke) / 2;
                                            const circ = 2 * Math.PI * r;
                                            const dash = (score / 100) * circ;
                                            return (
                                                <div style={{ position: 'relative', width: size, height: size }}>
                                                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                                                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-color)" strokeWidth={stroke} />
                                                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={scoreColor} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
                                                    </svg>
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: scoreColor }}>
                                                        {score}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {cmp && (
                                            <div style={{ fontSize: 10, fontWeight: 700, color: cmp.isAbove ? 'var(--success)' : 'var(--error)', background: cmp.isAbove ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                                                {cmp.isAbove ? '↑' : '↓'} {cmp.absDiff} vs avg
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Two-column workspace: pipeline rail + lifecycle content ── */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

                    {/* Vertical pipeline rail */}
                    <VerticalPipelineRail
                        currentStage={app.pipeline_stage}
                        stageProgress={computeStageProgress(app)}
                        substageProgress={safeParseJSON(app.substage_progress, {})}
                        activePhaseTab={activePhaseTab}
                        activeSubStage={activeSubStage}
                        onSubStageChange={(subId) => setActiveSubStage(subId)}
                        onStageChange={async (newStage) => {
                            const tabLabel = newStage.charAt(0).toUpperCase() + newStage.slice(1);
                            setActivePhaseTab(tabLabel);
                            setActiveSubStage(getDefaultSubStage(newStage));
                            if (newStage === (app.pipeline_stage || '').toLowerCase()) return;
                            try {
                                const newStatus = STAGE_TO_STATUS[newStage] || app.status;
                                const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus, force: true })
                                });
                                if (res.ok && onUpdate) onUpdate(app.id, { pipeline_stage: newStage, status: newStatus });
                            } catch (e) {
                                console.error('Failed to update pipeline stage', e);
                            }
                        }}
                        onEndStateSelect={async (endState) => {
                            if (!window.confirm(`Move this application to "${endState.charAt(0).toUpperCase() + endState.slice(1)}"?`)) return;
                            const tabLabel = endState.charAt(0).toUpperCase() + endState.slice(1);
                            setActivePhaseTab(tabLabel);
                            setActiveSubStage(getDefaultSubStage(endState));
                            try {
                                const newStatus = STAGE_TO_STATUS[endState] || endState;
                                const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ...app, pipeline_stage: endState, status: newStatus, force: true })
                                });
                                if (res.ok && onUpdate) onUpdate(app.id, { pipeline_stage: endState, status: newStatus });
                            } catch (e) {
                                console.error('Failed to update end state', e);
                            }
                        }}
                    />

                    {/* Workspace — phase content driven by rail sub-stage selection */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <ApplicationLifecycle
                            app={app}
                            activePhaseTab={activePhaseTab}
                            onUpdate={onUpdate}
                            onStartFullGeneration={onStartFullGeneration}
                            hideHeader={true}
                            avgScore={avgScore}
                            externalSubStage={activeSubStage}
                        />
                    </div>
                </div>
            </div>



            <style>{`
                .doc-row-btn {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    width: 100%;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .doc-row-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    border-color: var(--text-muted);
                }
                .rating-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-primary);
                    text-decoration: none;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                }
                .rating-row:hover {
                    background: var(--bg-tertiary);
                    border-color: var(--primary);
                    transform: translateX(4px);
                }
                .btn-mini-doc {
                    padding: 0.5rem 0.75rem !important;
                    gap: 0.5rem !important;
                }
                .doc-active {
                    background: var(--bg-card) !important;
                    border: 2px solid var(--primary) !important;
                    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2) !important;
                }
            `}</style>

            {/* Preview Modal */}
            {previewFile && (
                <PreviewModal file={previewFile} onClose={handleClosePreview} />
            )}

            {/* Document Selection Modals */}
            <DocumentSelectionModal
                isOpen={showResumeModal}
                onClose={() => setShowResumeModal(false)}
                docType="resume"
                app={app}
                profileBaseResume={profileBaseResume}
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

            {/* Logo Picker Modal */}
            {showLogoPicker && (
                <LogoPickerModal
                    companyName={app.company}
                    onSelect={handleLogoSelect}
                    onClose={() => setShowLogoPicker(false)}
                />
            )}
        </div>
    );
};

export default ApplicationDetail;
