import React from 'react';
import CustomDropdown from '../components/CustomDropdown';
import LocationAutocomplete from '../components/LocationAutocomplete';
import InterestStars from '../components/InterestStars';
import PipelineProgressBar, { STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import ApplicationLifecycle from './ApplicationLifecycle';
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

const ApplicationDetail = ({ app, onBack, onDelete, onArchive, onStatusUpdate, onUpdate, onViewLifecycle, onStartFullGeneration, avgScore }) => {
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
    const [showDetails, setShowDetails] = React.useState(true);

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
    }, [app?.pipeline_stage]);
    const [expandedResume, setExpandedResume] = React.useState(false);
    const [expandedCL, setExpandedCL] = React.useState(false);
    const [showResumeModal, setShowResumeModal] = React.useState(false);
    const [showCLModal, setShowCLModal] = React.useState(false);
    const [resumeInstructions, setResumeInstructions] = React.useState('');
    const [clInstructions, setClInstructions] = React.useState('');
    const [showInstructionsModal, setShowInstructionsModal] = React.useState(false);
    const [modalResumeInstructions, setModalResumeInstructions] = React.useState('');
    const [modalClInstructions, setModalClInstructions] = React.useState('');

    
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



    return (
        <div style={{ padding: '3rem', maxWidth: '1600px', width: '100%', margin: '0 auto', height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'none', border: 'none', color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_back</span>
                    Back to Dashboard
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Button removed in favor of tabs */}
                    <button
                        onClick={() => {
                            if (isEditing) handleSave();
                            else {
                                setFormData({ ...app });
                                setIsEditing(true);
                            }
                        }}
                        disabled={saving}
                        className={`btn-util ${isEditing ? 'active' : ''}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isEditing ? 'save' : 'edit'}</span>
                        {isEditing ? (saving ? 'Saving...' : 'Save Changes') : 'Edit Info'}
                    </button>
                    {isEditing && (
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setFormData({ ...app });
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.4rem 0.9rem', borderRadius: '0.5rem',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                            }}
                        >
                            Cancel
                        </button>
                    )}
                    {/* Archive / Unarchive button */}
                    <button
                        onClick={() => handleArchive(!isArchived)}
                        disabled={archiving}
                        className={`btn-util ${isArchived ? 'btn-warning' : ''}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isArchived ? 'unarchive' : 'archive'}</span>
                        {isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    {/* Delete button */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="btn-util btn-danger"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                        Delete
                    </button>
                </div>
            </div>

            {/* Archived banner */}
            {isArchived && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 1rem', marginBottom: '1.25rem',
                    background: 'var(--shadow-glow)', border: '1px solid var(--warning)',
                    borderRadius: '0.6rem', color: 'var(--warning)', fontSize: '0.875rem',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>archive</span>
                    This application is archived. It won’t appear in your main dashboard view.
                </div>
            )}

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
                                onClick={() => {
                                    setShowResumeOverrideConfirm(false);
                                    setPendingResumeFile(null);
                                }}
                                style={{
                                    padding: '0.5rem 1.2rem', background: 'transparent',
                                    border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                    borderRadius: '0.5rem', cursor: 'pointer'
                                }}
                            >Cancel</button>
                            <button
                                onClick={() => confirmOverride('resume')}
                                disabled={uploadingOverride}
                                style={{
                                    padding: '0.5rem 1.2rem', background: 'var(--primary)',
                                    border: 'none', color: 'white', borderRadius: '0.5rem',
                                    cursor: uploadingOverride ? 'not-allowed' : 'pointer', fontWeight: 600,
                                    opacity: uploadingOverride ? 0.7 : 1
                                }}
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
                                onClick={() => {
                                    setShowCLOverrideConfirm(false);
                                    setPendingCLFile(null);
                                }}
                                style={{
                                    padding: '0.5rem 1.2rem', background: 'transparent',
                                    border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                    borderRadius: '0.5rem', cursor: 'pointer'
                                }}
                            >Cancel</button>
                            <button
                                onClick={() => confirmOverride('cover_letter')}
                                disabled={uploadingOverride}
                                style={{
                                    padding: '0.5rem 1.2rem', background: 'var(--primary)',
                                    border: 'none', color: 'white', borderRadius: '0.5rem',
                                    cursor: uploadingOverride ? 'not-allowed' : 'pointer', fontWeight: 600,
                                    opacity: uploadingOverride ? 0.7 : 1
                                }}
                            >{uploadingOverride ? 'Uploading...' : 'Confirm & Use'}</button>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {/* Clickable logo zone — click to open logo picker */}
                        <div
                            onClick={() => setShowLogoPicker(true)}
                            title="Click to set a logo"
                            style={{
                                width: '72px', height: '72px', borderRadius: '12px', flexShrink: 0,
                                background: logoUrl ? 'transparent' : 'rgba(255,255,255,0.05)',
                                padding: '0',
                                border: '1px dashed var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            {logoUrl
                                ? <img src={logoUrl} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setLogoUrl(null)} />
                                : <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '2rem' }}>add_photo_alternate</span>
                            }
                            {/* Hover overlay */}
                            <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                            >
                                <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '1.25rem' }}>edit</span>
                            </div>
                        </div>
                        {/* Hidden file input kept for legacy compatibility */}
                        <input type="file" ref={logoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                        <input type="file" ref={resumeOverrideInputRef} accept=".docx,.pdf,.txt" style={{ display: 'none' }} onChange={(e) => onFileSelected(e, 'resume')} />
                        <input type="file" ref={clOverrideInputRef} accept=".docx,.pdf,.txt" style={{ display: 'none' }} onChange={(e) => onFileSelected(e, 'cover_letter')} />
                        <div style={{ flex: 1 }}>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={formData.job_title}
                                        onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                                        style={{ fontSize: '2.5rem', fontWeight: 800, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'var(--text-primary)', width: '100%', padding: '0.25rem 0.75rem' }}
                                    />
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={e => setFormData({ ...formData, company: e.target.value })}
                                        style={{ fontSize: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'var(--text-secondary)', width: '100%', padding: '0.25rem 0.75rem' }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '0.25rem', lineHeight: '1.2', letterSpacing: '-0.02em' }}>{app.job_title}</h1>
                                    <div style={{ fontSize: '1.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{app.company}</div>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        {connections && connections.length > 0 && (
                            <button
                                onClick={() => {
                                    document.getElementById('networking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.4rem 0.8rem', borderRadius: '2rem',
                                    background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.4)',
                                    color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                                    transition: 'all 0.2s', whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'; }}
                                title="Scroll to networking contacts"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>group</span>
                                {connections.length} Network {connections.length === 1 ? 'Connection' : 'Connections'}
                            </button>
                        )}
                        {app?.match_score != null && (() => {
                            const scoreColors = getScoreColors(app.match_score);
                            const cmp = getScoreComparison(app.match_score, avgScore);
                            const tooltipText = cmp
                                ? cmp.isAbove
                                    ? `Match Score: ${app.match_score} \u2014 \u2191 ${cmp.absDiff} pts above your avg (${cmp.avg})`
                                    : cmp.isBelow
                                        ? `Match Score: ${app.match_score} \u2014 \u2193 ${cmp.absDiff} pts below your avg (${cmp.avg})`
                                        : `Match Score: ${app.match_score} \u2014 equal to your avg (${cmp.avg})`
                                : `Match Score: ${app.match_score}`;
                            return (
                                <button
                                    onClick={() => {
                                        setShowDetails(true);
                                        setTimeout(() => {
                                            document.getElementById('compatibility-score-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 50);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.35rem 0.75rem 0.35rem 0.35rem',
                                        borderRadius: '2rem',
                                        background: scoreColors.bg,
                                        border: `1px solid ${scoreColors.border}`,
                                        color: scoreColors.text,
                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                                        transition: 'all 0.2s', whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    title={tooltipText}
                                >
                                    {/* Score circle with arrow indicator */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: scoreColors.bg,
                                            border: `2px solid ${scoreColors.border}`,
                                            color: scoreColors.text,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.75rem', fontWeight: 800,
                                        }}>
                                            {app.match_score}
                                        </div>
                                        {cmp && (cmp.isAbove || cmp.isBelow) && (
                                            <span style={{
                                                position: 'absolute', bottom: -2, right: -2,
                                                width: 11, height: 11, borderRadius: '50%',
                                                background: cmp.isAbove ? '#10b981' : '#ef4444',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '7px', fontWeight: 900, color: 'white',
                                                border: '1px solid rgba(0,0,0,0.25)', lineHeight: 1,
                                            }}>
                                                {cmp.isAbove ? '\u25b2' : '\u25bc'}
                                            </span>
                                        )}
                                    </div>
                                    {cmp && (cmp.isAbove || cmp.isBelow)
                                        ? `${cmp.isAbove ? '\u2191' : '\u2193'} ${cmp.absDiff} vs avg`
                                        : 'Match Score'
                                    }
                                </button>
                            );
                        })()}
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-end', marginTop: connections && connections.length > 0 ? '0.5rem' : '0' }}>Status</label>
                        <CustomDropdown
                            value={app.status || 'Applied'}
                            onChange={(val) => onStatusUpdate(app.id, val)}
                            options={[
                                { value: "Saved", label: "Saved" },
                                { value: "Generated", label: "Generated" },
                                { value: "Applied", label: "Applied" },
                                { value: "Interviewing", label: "Interviewing" },
                                { value: "Rejected", label: "Rejected" },
                                { value: "Offered", label: "Offered" },
                                { value: "Accepted", label: "Accepted" },
                                { value: "Withdrawn/Cancelled", label: "Withdrawn/Cancelled" }
                            ]}
                            className="bg-tertiary"
                            style={{ width: '150px' }}
                        />
                    </div>
                </div>




                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '2rem',
                    marginBottom: '2.5rem',
                    background: 'transparent',
                    padding: '2rem',
                    borderRadius: '1rem',
                    border: '1px solid var(--border-color)'
                }}>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Job Link</div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.job_url || ''}
                                onChange={e => setFormData({ ...formData, job_url: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
                            />
                        ) : (
                            app.job_url ? (
                                <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    Visit Listing <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>open_in_new</span>
                                </a>
                            ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Apply Link</div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.apply_url || ''}
                                onChange={e => setFormData({ ...formData, apply_url: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
                            />
                        ) : (
                            app.apply_url ? (
                                <a href={app.apply_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    Direct Apply <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>rocket_launch</span>
                                </a>
                            ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Salary Range</div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.salary_range || ''}
                                onChange={e => setFormData({ ...formData, salary_range: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
                            />
                        ) : (() => {
                            let matchNode = null;
                            if (app.salary_range && profilePrefs) {
                                const jobSalaries = extractSalaryNumbers(app.salary_range);
                                if (jobSalaries.length > 0) {
                                    const jobMin = Math.min(...jobSalaries);
                                    const jobMax = Math.max(...jobSalaries);
                                    
                                    const userMin = profilePrefs.min_salary ? Number(profilePrefs.min_salary) : null;
                                    const userMax = profilePrefs.max_salary ? Number(profilePrefs.max_salary) : null;
                                    
                                    if (userMin || userMax) {
                                        const matchesMin = userMin ? jobMax >= userMin : true;
                                        const matchesMax = userMax ? jobMin <= userMax : true;
                                        
                                        if (matchesMin && matchesMax) {
                                            matchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }} title="Matches your salary preferences">check_circle</span>;
                                        } else {
                                            matchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#ef4444' }} title="Does not meet your salary preferences">cancel</span>;
                                        }
                                    }
                                }
                            }
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ fontWeight: 500, color: app.salary_range ? '#fbbf24' : 'inherit', wordBreak: 'break-word', hyphens: 'auto' }} title={String(app.salary_range)}>{app.salary_range ? formatCompensation(app.salary_range) : 'Not Listed'}</div>
                                    {matchNode}
                                </div>
                            );
                        })()}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Deadline</div>
                        {isEditing ? (
                            <input
                                type="date"
                                value={formData.deadline || ''}
                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
                            />
                        ) : (
                            <div style={{ fontWeight: 500, color: app.deadline ? '#ef4444' : 'inherit' }}>{app.deadline || 'None'}</div>
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Job Type</div>
                        {isEditing ? (
                            <CustomDropdown
                                value={formData.job_type === 'N/A' || !formData.job_type ? '' : formData.job_type}
                                onChange={(val) => setFormData({ ...formData, job_type: val })}
                                options={[
                                    { value: '', label: 'Not Provided' },
                                    { value: 'Full-time', label: 'Full-time' },
                                    { value: 'Part-time', label: 'Part-time' },
                                    { value: 'Contract', label: 'Contract' },
                                    { value: 'Internship', label: 'Internship' },
                                    { value: 'Temporary', label: 'Temporary' }
                                ]}
                                className="bg-tertiary"
                                style={{ width: '100%' }}
                            />
                        ) : (() => {
                            let jobMatchNode = null;
                            if (profilePrefs) {
                                const userJobTypes = profilePrefs.job_types || [];
                                const userArray = Array.isArray(userJobTypes) ? userJobTypes : (userJobTypes ? [userJobTypes] : []);
                                if (userArray.length === 0) {
                                    jobMatchNode = <a href="#profile" title="Job Type preference missing. Click to set." style={{ color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span></a>;
                                } else {
                                    const jobTypeField = app.job_type || '';
                                    if (jobTypeField && jobTypeField.trim() !== '' && jobTypeField.toUpperCase() !== 'N/A') {
                                        const isMatch = userArray.some(setting => jobTypeField.toLowerCase().includes(setting.toLowerCase()));
                                        if (isMatch) {
                                            jobMatchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }} title={`Matches your preference (${userArray.join(', ')})`}>check_circle</span>;
                                        } else {
                                            jobMatchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#ef4444' }} title={`Does not match preference (${userArray.join(', ')})`}>cancel</span>;
                                        }
                                    }
                                }
                            }
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ fontWeight: 500 }}>{app.job_type || 'Full-time'}</div>
                                    {jobMatchNode}
                                </div>
                            );
                        })()}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Location Type</div>
                        {isEditing ? (
                            <CustomDropdown
                                value={formData.location_type === 'N/A' || !formData.location_type ? '' : formData.location_type}
                                onChange={(val) => setFormData({ ...formData, location_type: val })}
                                options={[
                                    { value: '', label: 'Not Provided' },
                                    { value: 'On-site', label: 'On-site' },
                                    { value: 'Hybrid', label: 'Hybrid' },
                                    { value: 'Remote', label: 'Remote' }
                                ]}
                                className="bg-tertiary"
                                style={{ width: '100%' }}
                            />
                        ) : (() => {
                            let wsMatchNode = null;
                            if (profilePrefs) {
                                const userSetting = profilePrefs.work_setting || [];
                                const userArray = Array.isArray(userSetting) ? userSetting : (userSetting ? [userSetting] : []);
                                if (userArray.length === 0) {
                                    wsMatchNode = <a href="#profile" title="Location Type preference missing. Click to set." style={{ color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span></a>;
                                } else {
                                    const jobType = app.location_type || '';
                                    if (jobType && jobType.trim() !== '' && jobType.toUpperCase() !== 'N/A') {
                                        const isMatch = userArray.some(setting =>
                                            setting === 'Any' ||
                                            (setting.toLowerCase() === 'remote' && jobType.toLowerCase() === 'hybrid') ||
                                            jobType.toLowerCase().includes(setting.toLowerCase())
                                        );
                                        if (isMatch) {
                                            wsMatchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }} title={`Matches your preference (${userArray.join(', ')})`}>check_circle</span>;
                                        } else {
                                            wsMatchNode = <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#ef4444' }} title={`Does not match preference (${userArray.join(', ')})`}>cancel</span>;
                                        }
                                    }
                                }
                            }
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ fontWeight: 500 }}>{app.location_type || 'N/A'}</div>
                                    {wsMatchNode}
                                </div>
                            );
                        })()}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Location</div>
                        {isEditing ? (
                            <LocationAutocomplete
                                value={formData.location || ''}
                                onChange={(val) => setFormData({ ...formData, location: val })}
                            />
                        ) : (
                            app.location && app.location !== 'Remote' ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.location)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {app.location} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>map</span>
                                </a>
                            ) : (
                                <div style={{ fontWeight: 500 }}>{app.location || 'Remote'}</div>
                            )
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Estimated Commute</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {commuteInfo.url ? (
                                    <a href={commuteInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {commuteInfo.text} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                                            {commuteInfo.type === 'Walking' ? 'directions_walk' :
                                             commuteInfo.type === 'Bicycle' ? 'directions_bike' :
                                             commuteInfo.type === 'Public Transportation' ? 'directions_bus' :
                                             commuteInfo.type === 'Flight' ? 'flight' : 'directions_car'}
                                        </span>
                                    </a>
                                ) : (
                                    <span style={{ color: 'var(--primary)' }}>{commuteInfo.text}</span>
                                )}
                                {commuteInfo.isOverLimit && (
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#ef4444' }} title={`Exceeds preferred max commute: ${commuteInfo.maxMins} mins`}>
                                        warning
                                    </span>
                                )}
                                {commuteInfo.url && !commuteInfo.isOverLimit && profilePrefs?.max_commute && (
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }} title="Within preferred max commute limit">
                                        check_circle
                                    </span>
                                )}
                            </div>

                            {/* Commute Type Toggles */}
                            {allCommutes && Object.keys(allCommutes).length > 1 && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    {['Driving', 'Public Transportation', 'Bicycle', 'Walking', 'Flight'].map(type => {
                                        if (!allCommutes[type]) return null;
                                        const iconMap = {
                                            'Driving': 'directions_car',
                                            'Public Transportation': 'directions_bus',
                                            'Bicycle': 'directions_bike',
                                            'Walking': 'directions_walk',
                                            'Flight': 'flight'
                                        };
                                        const isSelected = currentCommuteType === type;
                                        const maxCommuteMinsValue = commuteInfo.maxMins;
                                        const mMins = allCommutes[type].mins;
                                        const mIsOverLimit = maxCommuteMinsValue !== null && mMins > maxCommuteMinsValue;
                                        const statusColor = mIsOverLimit ? '#ef4444' : '#10b981';
                                        const statusFaint = mIsOverLimit ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';

                                        return (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setCurrentCommuteType(type);
                                                    const data = allCommutes[type];
                                                    const mins = data.mins;
                                                    const dist = data.distance;
                                                    const isOverLimit = maxCommuteMinsValue !== null && mins > maxCommuteMinsValue;

                                                    // Re-generate Google Maps URL with correct travel mode
                                                    const urlBase = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(profilePrefs?.address_line1 || '')}+${encodeURIComponent(profilePrefs?.city || '')}&destination=${encodeURIComponent(app.location || '')}`;
                                                    let travelMode = 'driving';
                                                    if (type === 'Walking') travelMode = 'walking';
                                                    else if (type === 'Bicycle') travelMode = 'bicycling';
                                                    else if (type === 'Public Transportation') travelMode = 'transit';

                                                    setCommuteInfo(prev => ({
                                                        ...prev,
                                                        text: `${mins} min ${type.toLowerCase()} (${dist || 0} mi)`,
                                                        isOverLimit,
                                                        type: type,
                                                        url: `${urlBase}&travelmode=${travelMode}`
                                                     }));
                                                }}
                                                title={`${type}: ${mMins} mins`}
                                                style={{
                                                    background: isSelected ? statusColor : statusFaint,
                                                    border: `1px solid ${isSelected ? statusColor : statusColor}`,
                                                    color: isSelected ? 'white' : statusColor,
                                                    borderRadius: '4px',
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{iconMap[type]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Date Captured</div>
                        <div style={{ fontWeight: 500 }}>{new Date(app.date_saved).toLocaleDateString()}</div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Date Posted</div>
                        {isEditing ? (
                            <input
                                type="date"
                                value={formData.date_posted || ''}
                                onChange={e => setFormData({ ...formData, date_posted: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
                            />
                        ) : (
                            <div style={{ fontWeight: 500 }}>{app.date_posted || 'Unknown'}</div>
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Relocation</div>
                        {isEditing ? (
                            <CustomDropdown
                                value={formData.relocation === 'true' || formData.relocation === true || formData.relocation === 'True' ? 'true' : (formData.relocation === 'false' || formData.relocation === false || formData.relocation === 'False' ? 'false' : '')}
                                onChange={(val) => setFormData({ ...formData, relocation: val === '' ? null : val })}
                                options={[
                                    { value: '', label: 'Not Provided' },
                                    { value: 'true', label: 'Required' },
                                    { value: 'false', label: 'Not Required' }
                                ]}
                                className="bg-tertiary"
                                style={{ width: '100%' }}
                            />
                        ) : (
                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {app.relocation === 'true' || app.relocation === 'True' || app.relocation === true ? (
                                    'Required'
                                ) : app.relocation === 'false' || app.relocation === 'False' || app.relocation === false ? (
                                    'Not Required'
                                ) : (
                                    'Not Provided'
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Interest Level</div>
                        <div style={{ marginTop: '0.25rem' }}>
                            <InterestStars
                                level={isEditing ? formData.interest_level : app.interest_level}
                                size="1.4rem"
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
                                        } catch (err) {
                                            console.error(err);
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
                        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Personal Remarks & Notes</div>
                            {isEditing ? (
                                <textarea
                                    value={formData.remarks || ''}
                                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                    rows={2}
                                    placeholder="Add your own notes here..."
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'var(--text-primary)', width: '100%', padding: '0.75rem', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                                />
                            ) : (
                                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontStyle: app.remarks ? 'italic' : 'normal', lineHeight: '1.6' }}>
                                    {app.remarks ? `"${app.remarks}"` : <span style={{ opacity: 0.5 }}>No notes added yet. Click edit to add remarks.</span>}
                                </div>
                            )}
                        </div>


                    </div>
                </div>

                {/* --- Document Hub Section --- */}
                <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Application Documents</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {/* Active Resume Card */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>description</span>
                                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Active Resume</span>
                            </div>
                            {(() => {
                                const isActiveOverride = app.active_resume_type === 'override' && app.override_resume_path;
                                const isActiveGenerated = app.active_resume_type === 'generated' || (!isActiveOverride && app.tailored_resume_path && app.active_resume_type !== 'original');
                                let path = app.original_resume_path || profileBaseResume;
                                let label = "Profile Base Resume";
                                let icon = "attach_file";
                                let type = "original";
                                let isMissing = false;

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
                                } else if (!path) {
                                    isMissing = true;
                                    label = "Missing Profile Resume";
                                    icon = "warning";
                                }

                                return (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div 
                                            onClick={() => !isMissing && handlePreview(type, path)}
                                            style={{ cursor: isMissing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: isMissing ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)', borderRadius: '0.5rem', border: isMissing ? '1px dashed var(--danger)' : '1px solid var(--border-color)', transition: 'background-color 0.2s' }}
                                            onMouseOver={(e) => !isMissing && (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                                            onMouseOut={(e) => !isMissing && (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: isMissing ? 'var(--danger)' : 'var(--text-secondary)' }}>{icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isMissing ? 'var(--danger)' : 'inherit' }}>{label}</div>
                                                <div style={{ fontSize: '0.75rem', color: isMissing ? 'var(--danger)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem', opacity: isMissing ? 0.8 : 1 }}>
                                                    {isMissing ? 'Please upload a resume or generate one' : (path?.split('/').pop() || 'Not available')}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                            <button className="btn-util" style={{ flex: 1, padding: '0.6rem' }} onClick={() => handlePreview(type, path)} disabled={!path}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>visibility</span> Preview
                                            </button>
                                            <button className="btn-util" style={{ flex: 1, padding: '0.6rem', background: isMissing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', color: isMissing ? 'var(--danger)' : 'var(--primary)', borderColor: isMissing ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)' }} onClick={() => setShowResumeModal(true)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isMissing ? 'add_circle' : 'swap_horiz'}</span> {isMissing ? 'Add' : 'Change'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Active Cover Letter Card */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>mail</span>
                                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Active Cover Letter</span>
                            </div>
                            {(() => {
                                const isActiveOverride = app.active_cover_letter_type === 'override' && app.override_cover_letter_path;
                                const isActiveGenerated = app.active_cover_letter_type === 'generated' || (!isActiveOverride && app.cover_letter_path);
                                let path = app.original_cover_letter_path || null;
                                let label = "Cover Letter";
                                let icon = "mail";
                                let type = "cover";
                                let isMissing = false;

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
                                } else if (!path) {
                                    isMissing = true;
                                    label = "Missing Cover Letter";
                                    icon = "warning";
                                }

                                return (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div 
                                            onClick={() => !isMissing && handlePreview(type, path)}
                                            style={{ cursor: isMissing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: isMissing ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)', borderRadius: '0.5rem', border: isMissing ? '1px dashed var(--danger)' : '1px solid var(--border-color)', transition: 'background-color 0.2s' }}
                                            onMouseOver={(e) => !isMissing && (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                                            onMouseOut={(e) => !isMissing && (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: isMissing ? 'var(--danger)' : 'var(--text-secondary)' }}>{icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isMissing ? 'var(--danger)' : 'inherit' }}>{label}</div>
                                                <div style={{ fontSize: '0.75rem', color: isMissing ? 'var(--danger)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem', opacity: isMissing ? 0.8 : 1 }}>
                                                    {isMissing ? 'Please upload or generate a letter' : (path?.split('/').pop() || 'Not available')}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                            <button className="btn-util" style={{ flex: 1, padding: '0.6rem' }} onClick={() => handlePreview(type, path)} disabled={!path}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>visibility</span> Preview
                                            </button>
                                            <button className="btn-util" style={{ flex: 1, padding: '0.6rem', background: isMissing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', color: isMissing ? 'var(--danger)' : 'var(--primary)', borderColor: isMissing ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)' }} onClick={() => setShowCLModal(true)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{isMissing ? 'add_circle' : 'swap_horiz'}</span> {isMissing ? 'Add' : 'Change'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Additional Documents Card */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>folder_open</span>
                                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Additional Context</span>
                            </div>
                            
                            <input 
                                type="file" 
                                ref={docInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleUploadAppDoc} 
                            />

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(() => {
                                    const jobDocs = safeParseJSON(app.additional_docs, []);
                                    const excludedPaths = safeParseJSON(app.excluded_profile_docs, []);
                                    const filteredProfileDocs = profileDocs.filter(d => !excludedPaths.includes(d.path));
                                    
                                    const allDocs = [
                                        ...filteredProfileDocs.map(d => ({ ...d, source: 'From Profile' })),
                                        ...jobDocs.map(d => ({ ...d, source: 'Job Specific' }))
                                    ];

                                    if (allDocs.length === 0) {
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px dashed var(--border-color)', opacity: 0.8 }}>
                                                <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>No additional documents</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7, marginTop: '0.2rem' }}>Used for AI generation context</div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return allDocs.map((doc, idx) => (
                                        <div key={idx} className="doc-row" style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.75rem', 
                                            padding: '0.6rem 0.75rem', 
                                            background: 'var(--bg-card)', 
                                            borderRadius: '0.5rem', 
                                            border: '1px solid var(--border-color)',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                        }}>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                                                {doc.filename?.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {doc.filename}
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: doc.source === 'From Profile' ? 'var(--primary)' : 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    {doc.source}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button className="btn-util" onClick={() => handleViewDoc(doc.path)} title="View Document">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>visibility</span>
                                                </button>
                                                <button className="btn-util btn-danger" onClick={() => handleRemoveDoc(doc.path, doc.source === 'From Profile')} title="Remove from Job">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                                                </button>
                                            </div>
                                        </div>
                                    ));
                                })()}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button 
                                        className="btn-util" 
                                        style={{ width: '100%', padding: '0.6rem', borderStyle: 'dashed' }} 
                                        onClick={() => docInputRef.current?.click()}
                                        disabled={uploadingDoc}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                                            {uploadingDoc ? 'sync' : 'add'}
                                        </span> 
                                        {uploadingDoc ? 'Uploading...' : 'Add Job-Specific Document'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </header>

            {needsGeneration && (
                <>
                    <div style={{ marginBottom: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.1))', borderRadius: '1rem', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>auto_awesome</span>
                                Generate Documents
                            </h3>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Use AI to tailor your resume and write a cover letter based on this job.</p>
                        </div>
                        <button 
                            className="btn btn-primary" 
                            onClick={() => setShowInstructionsModal(true)}
                            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            Generate Now
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_forward</span>
                        </button>
                    </div>

                    {/* Pre-launch Instructions Modal */}
                    {showInstructionsModal && (
                        <div style={{
                            position: 'fixed', inset: 0, zIndex: 9000,
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div style={{
                                background: 'var(--bg-card)', borderRadius: '1rem',
                                border: '1px solid var(--border-color)',
                                padding: '2rem', width: '100%', maxWidth: '520px',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
                                display: 'flex', flexDirection: 'column', gap: '1.5rem'
                            }}>
                                <div>
                                    <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>tune</span>
                                        Any special instructions?
                                    </h2>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        Optionally guide the AI before it tailors your documents. Leave blank to use default settings.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>description</span>
                                        Resume Instructions
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        placeholder="e.g. 'Emphasize my leadership roles' or 'Highlight Python experience'"
                                        value={modalResumeInstructions}
                                        onChange={e => setModalResumeInstructions(e.target.value)}
                                        style={{ resize: 'vertical', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>mail</span>
                                        Cover Letter Instructions
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        placeholder="e.g. 'Keep it under one page' or 'Formal and concise tone'"
                                        value={modalClInstructions}
                                        onChange={e => setModalClInstructions(e.target.value)}
                                        style={{ resize: 'vertical', fontSize: '0.9rem' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setShowInstructionsModal(false);
                                            setModalResumeInstructions('');
                                            setModalClInstructions('');
                                        }}
                                        style={{ flex: 1, justifyContent: 'center' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            setShowInstructionsModal(false);
                                            if (onStartFullGeneration) {
                                                onStartFullGeneration(app, modalResumeInstructions, modalClInstructions);
                                            }
                                            setModalResumeInstructions('');
                                            setModalClInstructions('');
                                        }}
                                        style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_awesome</span>
                                        Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <PipelineProgressBar
                currentStage={app.pipeline_stage}
                isArchived={isArchived}
                onStageClick={async (newStage) => {
                    if (newStage === app.pipeline_stage) return;
                    try {
                        const newStatus = STAGE_TO_STATUS[newStage] || app.status;
                        const res = await fetchWithAuth(`${API_URL}/api/applications/${app.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus, force: true })
                        });
                        if (res.ok && onUpdate) {
                            onUpdate(app.id, { pipeline_stage: newStage, status: newStatus });
                        }
                    } catch (e) {
                        console.error("Failed to update pipeline stage", e);
                    }
                }}
            />

            {/* Phase Tabs — sticky so they freeze at top when scrolling */}
            <div style={{
                display: 'flex',
                gap: '0.2rem',
                marginTop: '2.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                background: 'var(--bg-primary)',
                paddingTop: '0.5rem',
                marginLeft: '-0.5rem',
                marginRight: '-0.5rem',
                paddingLeft: '0.5rem',
                paddingRight: '0.5rem',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            }}>
                {[
                    { id: 'Saved', label: 'Saved' },
                    { id: 'Generated', label: 'Generated' },
                    { id: 'Applied', label: 'Applied' },
                    { id: 'Interviewing', label: 'Interviewing' },
                    { id: 'Decision', label: 'Decision' },
                    { id: 'Offered', label: 'Offered' },
                    { id: 'Accepted', label: 'Accepted' },
                    { id: 'Rejected', label: 'Rejected' },
                    { id: 'Declined', label: 'Declined' },
                    { id: 'Withdrawn', label: 'Withdrawn' }
                ].map(tab => {
                    const isTabActive = activePhaseTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActivePhaseTab(tab.id)}
                            style={{
                                padding: '0.75rem 1.25rem',
                                fontSize: '0.65rem',
                                fontWeight: isTabActive ? 800 : 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: isTabActive ? 'var(--primary)' : 'var(--text-muted)',
                                background: isTabActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                backdropFilter: isTabActive ? 'blur(12px)' : 'none',
                                border: '1px solid ' + (isTabActive ? 'var(--border-color)' : 'transparent'),
                                borderBottom: isTabActive ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                                borderRadius: '0.5rem 0.5rem 0 0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: '-1px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                position: 'relative',
                                zIndex: isTabActive ? 2 : 1
                            }}
                            onMouseOver={(e) => { 
                                if (!isTabActive) {
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                }
                            }}
                            onMouseOut={(e) => { 
                                if (!isTabActive) {
                                    e.currentTarget.style.color = 'var(--text-muted)';
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {isTabActive && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Phase Content from Lifecycle Component */}
            <div style={{ 
                marginBottom: '2.5rem', 
                borderRadius: '0 1rem 1rem 1rem',
                padding: '2rem',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                position: 'relative'
            }}>
                <ApplicationLifecycle
                    app={app}
                    activePhaseTab={activePhaseTab}
                    onUpdate={onUpdate}
                    hideHeader={true}
                    avgScore={avgScore}
                />
            </div>

            {/* Job Details & Documents Accordion */}
            <div id="job-details-accordion" style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.5rem' }}>
                <button 
                    onClick={() => setShowDetails(!showDetails)}
                    style={{ 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        transition: 'background 0.2s',
                        color: 'var(--text-primary)'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.03)'}
                    onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>feed</span>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Job Details & Documents</h2>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                        expand_more
                    </span>
                </button>

                {showDetails && (
                    <div style={{ marginTop: '1.5rem', animation: 'fadeIn 0.3s' }}>
                <div className="job-details-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Remarks moved up to header */}
                    
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined">description</span>
                            Description & Requirements
                        </div>
                        {isEditing ? (
                            <textarea
                                value={formData.job_description || ''}
                                onChange={e => setFormData({ ...formData, job_description: e.target.value })}
                                rows={15}
                                placeholder="Paste job description here..."
                                style={{ 
                                    background: 'var(--bg-tertiary)', 
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '0.5rem', 
                                    color: 'var(--text-primary)', 
                                    width: '100%', 
                                    padding: '1rem', 
                                    fontSize: '0.9rem', 
                                    outline: 'none', 
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    lineHeight: '1.6'
                                }}
                            />
                        ) : (
                            <JobDescriptionContent text={app.job_description} />
                        )}
                    </div>

                    {/* AI Insights - Moved below Description */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined">auto_awesome</span>
                            AI Insights & Tailoring Summary
                        </div>
                        
                        <div className="two-col-grid">
                            {/* Resume Changes */}
                            <div>
                                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Resume Improvements</h4>
                                {app.resume_changes_summary ? (
                                    <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                        {safeParseJSON(app.resume_changes_summary, []).map((change, i) => (
                                                <li key={i}>{change}</li>
                                            ))}
                                    </ul>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No summary available.</p>
                                )}
                            </div>

                            {/* Cover Letter Refinements */}
                            <div>
                                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Cover Letter History</h4>
                                {app.cover_letter_changes_summary && safeParseJSON(app.cover_letter_changes_summary, []).length > 0 ? (
                                    <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                        {safeParseJSON(app.cover_letter_changes_summary, []).map((change, i) => (
                                                <li key={i}>{change}</li>
                                            ))}
                                    </ul>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No manual refinements made yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Compatibility Score Card */}
                    {app.match_score != null && (() => {
                        const cmp = getScoreComparison(app.match_score, avgScore);
                        const sc = getScoreColors(app.match_score);
                        return (
                            <div id="compatibility-score-section" className="card" style={{ padding: '1.25rem', border: '1px solid var(--primary)', background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.05), var(--bg-card))' }}>
                                <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>analytics</span>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary)' }}>Compatibility Score</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                                    {/* Large score circle with arrow indicator */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: '50%',
                                            background: sc.bg,
                                            color: sc.text,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem', fontWeight: 800,
                                            border: `4px solid ${sc.border}`,
                                        }}>
                                            {app.match_score}
                                        </div>
                                        {cmp && (cmp.isAbove || cmp.isBelow) && (
                                            <span style={{
                                                position: 'absolute', bottom: 0, right: 0,
                                                width: 22, height: 22, borderRadius: '50%',
                                                background: cmp.isAbove ? '#10b981' : '#ef4444',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: 900, color: 'white',
                                                border: '2px solid var(--bg-card)', lineHeight: 1,
                                            }}>
                                                {cmp.isAbove ? '\u25b2' : '\u25bc'}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                                            {app.match_score >= 80 ? 'Excellent match for your profile!' :
                                             app.match_score >= 60 ? 'Good match with some gaps.' :
                                             'Challenging match. Significant tailoring recommended.'}
                                        </div>
                                        {cmp && (
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                                fontSize: '0.82rem', fontWeight: 700,
                                                color: cmp.isAbove ? '#10b981' : cmp.isBelow ? '#ef4444' : 'var(--text-muted)',
                                                background: cmp.isAbove ? 'rgba(16,185,129,0.1)' : cmp.isBelow ? 'rgba(239,68,68,0.1)' : 'var(--bg-tertiary)',
                                                border: `1px solid ${cmp.isAbove ? 'rgba(16,185,129,0.3)' : cmp.isBelow ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                                borderRadius: '2rem',
                                                padding: '0.2rem 0.65rem',
                                            }}>
                                                <span style={{ fontSize: '0.75rem' }}>
                                                    {cmp.isAbove ? '\u25b2' : cmp.isBelow ? '\u25bc' : '\u25c6'}
                                                </span>
                                                {cmp.isAbove
                                                    ? `${cmp.absDiff} pts above your avg (${cmp.avg})`
                                                    : cmp.isBelow
                                                        ? `${cmp.absDiff} pts below your avg (${cmp.avg})`
                                                        : `Equal to your avg (${cmp.avg})`
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(() => {
                                    const matchData = safeParseJSON(app?.match_details, { criteria_scores: {} });
                                    const scores = matchData.criteria_scores || {};
                                    if (!app?.match_details || Object.keys(scores).length === 0) return null;
                                    
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {Object.entries(scores).map(([key, info]) => (
                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{String(key).replace('_', ' ')}</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{info?.score ?? '?'}/20</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}

                    {/* Networking Card */}
                    {connections && connections.length > 0 && (
                        <div id="networking-section" className="card" style={{ padding: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.05), var(--bg-card))' }}>
                            <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }}>group</span>
                                <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#10b981' }}>Networking ({connections.length})</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {connections.map((conn, i) => (
                                    <a key={i} href={conn.profile_url} target="_blank" rel="noopener noreferrer" 
                                       className="rating-row"
                                       style={{ textDecoration: 'none', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.75rem' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minWidth: 0 }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: conn.photo_url ? 'transparent' : 'linear-gradient(135deg, var(--primary), #4f46e5)', backgroundImage: conn.photo_url ? `url('${conn.photo_url.includes('licdn.com') ? `${API_URL}/api/proxy-image?url=${encodeURIComponent(conn.photo_url)}` : conn.photo_url}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0, overflow: 'hidden' }}>
                                                {!conn.photo_url && (conn.name?.split(' ').map(n => n[0]).join('') || '?')}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conn.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conn.headline}</div>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>open_in_new</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Company Ratings Card */}
                    <div className="card" style={{ padding: '1.25rem' }}>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>analytics</span>
                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Company Insights</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Glassdoor */}
                            <a href={app.glassdoor_url || `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(app.company)}`} 
                               target="_blank" rel="noopener noreferrer"
                               className="rating-row"
                            >
                                <img src="https://www.glassdoor.com/favicon.ico" alt="" style={{ width: '16px', height: '16px' }} />
                                <span style={{ fontWeight: 500 }}>Glassdoor</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {app.glassdoor_rating || 'Search'} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>search</span>
                                </span>
                            </a>

                            {/* Indeed */}
                            <a href={app.indeed_url || `https://www.indeed.com/cmp/${encodeURIComponent(app.company)}`} 
                               target="_blank" rel="noopener noreferrer"
                               className="rating-row"
                            >
                                <img src="https://www.indeed.com/favicon.ico" alt="" style={{ width: '16px', height: '16px' }} />
                                <span style={{ fontWeight: 500 }}>Indeed</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {app.indeed_rating || 'Search'} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>search</span>
                                </span>
                            </a>

                            {/* LinkedIn */}
                            <a href={app.linkedin_url || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(app.company)}`} 
                               target="_blank" rel="noopener noreferrer"
                               className="rating-row"
                            >
                                <img src="https://www.linkedin.com/favicon.ico" alt="" style={{ width: '16px', height: '16px' }} />
                                <span style={{ fontWeight: 500 }}>LinkedIn</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {app.linkedin_rating || 'Search'} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>search</span>
                                </span>
                            </a>
                        </div>
                    </div>

                </div>
            </div> {/* End Grid Container */}
                    </div>
                )}
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
