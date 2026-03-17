import React from 'react';
import CustomDropdown from '../components/CustomDropdown';
import InterestStars from '../components/InterestStars';
import PipelineProgressBar, { STAGE_TO_STATUS } from '../components/PipelineProgressBar';
import ApplicationLifecycle from './ApplicationLifecycle';

// Use same env logic or passed prop
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
const PreviewModal = ({ file, onClose }) => {
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
};


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
            const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(searchQuery)}`);
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
                                                background: 'white', border: '2px solid var(--border-color)',
                                                borderRadius: '0.6rem', padding: '0.6rem',
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
                                    background: 'white', borderRadius: '0.6rem', padding: '1rem',
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

const ApplicationDetail = ({ app, onBack, onDelete, onArchive, onStatusUpdate, onUpdate, onViewLifecycle }) => {
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
    const [activeTab, setActiveTab] = React.useState('details'); // 'details' | 'lifecycle'
    
    const [showResumeOverrideConfirm, setShowResumeOverrideConfirm] = React.useState(false);
    const [showCLOverrideConfirm, setShowCLOverrideConfirm] = React.useState(false);
    const [pendingResumeFile, setPendingResumeFile] = React.useState(null);
    const [pendingCLFile, setPendingCLFile] = React.useState(null);
    const [uploadingOverride, setUploadingOverride] = React.useState(false);
    const [connections, setConnections] = React.useState([]);
    const [commuteInfo, setCommuteInfo] = React.useState({ text: 'Calculating...' });
    const [profilePrefs, setProfilePrefs] = React.useState(null);

    const logoInputRef = React.useRef(null);
    
    const extractSalaryNumbers = (str) => {
        if (!str) return [];
        const normalized = str.replace(/,/g, '');
        const regex = /(\d+(?:\.\d+)?)(k)?/gi;
        let match;
        const nums = [];
        while ((match = regex.exec(normalized)) !== null) {
            let val = parseFloat(match[1]);
            if (match[2] && match[2].toLowerCase() === 'k') val *= 1000;
            else if (val < 1000 && val > 0 && str.toLowerCase().includes('k')) val *= 1000;
            else if (val < 1000 && val > 0 && !str.toLowerCase().includes('k')) val *= 2080;
            nums.push(val);
        }
        return nums;
    };
    const resumeOverrideInputRef = React.useRef(null);
    const clOverrideInputRef = React.useRef(null);

    // Sync formData when app changes
    React.useEffect(() => {
        setFormData({ ...app });
        setIsArchived(app.is_archived === 'true' || app.is_archived === true);
        setLogoUrl(app.company_logo || null);

        // Fetch connections
        if (app.company) {
            fetch(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(app.company)}`)
                .then(res => res.json())
                .then(data => setConnections(data.matches || []))
                .catch(err => console.warn("Failed to fetch connections", err));
        }

        // Use precalculated commute
        if (app.id) {
            const getPrefs = async () => {
                try {
                    const profileRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile`);
                    const profileData = await profileRes.json();
                    setProfilePrefs(profileData?.preferences || {});
                    
                    const maxCommutePref = profileData?.preferences?.max_commute || '';
                    let maxCommuteMins = null;
                    if (maxCommutePref === '15 mins') maxCommuteMins = 15;
                    else if (maxCommutePref === '30 mins') maxCommuteMins = 30;
                    else if (maxCommutePref === '45 mins') maxCommuteMins = 45;
                    else if (maxCommutePref === '1 hour') maxCommuteMins = 60;
                    else if (maxCommutePref === '1.5 hours') maxCommuteMins = 90;
                    else if (maxCommutePref === '2 hours') maxCommuteMins = 120;
                    else if (maxCommutePref === 'Remote Only') maxCommuteMins = 0;

                    if (!app.location) {
                        setCommuteInfo({ text: 'No Location Provided' });
                        return;
                    }

                    if (app.location.toLowerCase().includes('remote') || app.location_type?.toLowerCase() === 'remote') {
                        setCommuteInfo({ text: 'Remote (No Commute)' });
                        return;
                    }

                    if (app.commute_time_mins !== undefined && app.commute_time_mins !== null) {
                        const mins = app.commute_time_mins;
                        const dist = app.commute_distance_miles;
                        const isOverLimit = maxCommuteMins !== null && mins > maxCommuteMins;
                        
                        const originParts = [];
                        if (profileData.address_line1) originParts.push(profileData.address_line1);
                        if (profileData.city) originParts.push(profileData.city);
                        if (profileData.state) originParts.push(profileData.state);
                        const originStr = originParts.join(', ');
                        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(app.location)}&travelmode=driving`;
                        
                        setCommuteInfo({
                            text: `${mins} min driving (${dist || 0} mi)`,
                            isOverLimit,
                            maxMins: maxCommuteMins,
                            url: directionsUrl
                        });
                    } else {
                        setCommuteInfo({ text: 'Calculation pending...' });
                    }
                } catch(e) {
                    setCommuteInfo({ text: 'Unavailable' });
                }
            };
            getPrefs();
        }
    }, [app]);

    const handleArchive = async (archive) => {
        setArchiving(true);
        try {
            const res = await fetch(`${API_URL}/api/applications/${app.id}/archive`, {
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
                await fetch(`${API_URL}/api/applications/${app.id}/logo`, {
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
            await fetch(`${API_URL}/api/applications/${app.id}/logo`, {
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
            
            const res = await fetch(`${API_URL}/api/applications/${app.id}/${endpoint}`, {
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
            const res = await fetch(`${API_URL}/api/applications/${app.id}/toggle-active`, {
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/applications/${app.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
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
            // We use the profile's base resume by default
            body.append('use_default_resume', 'true'); 
            
            const res = await fetch(`${API_URL}/api/tailor-resume`, {
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
                await fetch(`${API_URL}/api/applications/${app.id}`, {
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
            const resumeData = typeof app.resume_data === 'string' ? JSON.parse(app.resume_data) : app.resume_data;
            const resumeText = resumeData?.full_text?.join('\n') || "";

            const res = await fetch(`${API_URL}/api/generate-cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_text: resumeText,
                    job_description: app.job_description,
                    base_filename: app.original_resume_path || "resume.docx"
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                const updateData = {
                    cover_letter_path: data.files.pdf.split('/').pop(),
                    cover_letter_changes_summary: data.generation_summary
                };
                // Save the update
                await fetch(`${API_URL}/api/applications/${app.id}`, {
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

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`${API_URL}/api/applications/${app.id}`, { method: 'DELETE' });
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
        }
    };



    return (
        <div style={{ padding: '3rem', maxWidth: '1600px', width: '100%', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
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
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.9rem', borderRadius: '0.5rem',
                            background: isEditing ? 'var(--primary)' : 'var(--bg-secondary)',
                            border: '1px solid var(--border-color-card)',
                            color: isEditing ? 'white' : 'var(--text-secondary)',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s',
                        }}
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
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.9rem', borderRadius: '0.5rem',
                            background: isArchived ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)',
                            border: isArchived ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-color-card)',
                            color: isArchived ? 'var(--warning)' : 'var(--text-secondary)',
                            cursor: archiving ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s',
                            opacity: archiving ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!archiving) { e.currentTarget.style.background = isArchived ? 'rgba(245,158,11,0.25)' : 'rgba(100,116,139,0.25)'; }}}
                        onMouseLeave={e => { e.currentTarget.style.background = isArchived ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)'; }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isArchived ? 'unarchive' : 'archive'}</span>
                        {isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    {/* Delete button */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.9rem', borderRadius: '0.5rem',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
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

            <header style={{ marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {/* Clickable logo zone — click to open logo picker */}
                        <div
                            onClick={() => setShowLogoPicker(true)}
                            title="Click to set a logo"
                            style={{
                                width: '72px', height: '72px', borderRadius: '12px', flexShrink: 0,
                                background: logoUrl ? 'white' : 'rgba(255,255,255,0.05)',
                                padding: logoUrl ? '6px' : '0',
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
                                { value: "Accepted", label: "Accepted" }
                            ]}
                            className="bg-tertiary"
                            style={{ width: '150px' }}
                        />
                    </div>
                </div>


                <PipelineProgressBar 
                    currentStage={app.pipeline_stage} 
                    isArchived={isArchived}
                    onStageClick={async (newStage) => {
                        if (newStage === app.pipeline_stage) return;
                        try {
                            const newStatus = STAGE_TO_STATUS[newStage] || app.status;
                            const res = await fetch(`${API_URL}/api/applications/${app.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...app, pipeline_stage: newStage, status: newStatus })
                            });
                            if (res.ok && onUpdate) {
                                onUpdate(app.id, { pipeline_stage: newStage, status: newStatus });
                            }
                        } catch (e) {
                            console.error("Failed to update pipeline stage", e);
                        }
                    }} 
                />

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                    gap: '2rem', 
                    marginBottom: '2.5rem', 
                    background: 'var(--bg-secondary)', 
                    padding: '2rem', 
                    borderRadius: '1rem',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
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
                                if (!profilePrefs.min_salary && !profilePrefs.max_salary) {
                                    matchNode = <a href="#profile" title="Salary preference missing. Click to set." style={{ color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span></a>;
                                } else {
                                    const jobSalaries = extractSalaryNumbers(app.salary_range);
                                    if (jobSalaries.length > 0) {
                                        const jobMin = Math.min(...jobSalaries);
                                        const jobMax = Math.max(...jobSalaries);
                                        const userMin = profilePrefs.min_salary ? Number(profilePrefs.min_salary) : null;
                                        const userMax = profilePrefs.max_salary ? Number(profilePrefs.max_salary) : null;
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
                                    <div style={{ fontWeight: 500, color: app.salary_range ? '#fbbf24' : 'inherit' }}>{app.salary_range || 'Not Listed'}</div>
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
                            <input
                                type="text"
                                value={formData.job_type || ''}
                                onChange={e => setFormData({ ...formData, job_type: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
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
                            <input
                                type="text"
                                value={formData.location_type || ''}
                                onChange={e => setFormData({ ...formData, location_type: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
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
                            <input
                                type="text"
                                value={formData.location || ''}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '0.4rem', color: 'var(--text-primary)', width: '100%', padding: '0.4rem' }}
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
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {commuteInfo.url ? (
                                <a href={commuteInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {commuteInfo.text} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>directions_car</span>
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
                            {profilePrefs && !profilePrefs.max_commute && (
                                <a href="#profile" title="Commute preference missing. Click to set." style={{ color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span></a>
                            )}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Date Created</div>
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
                                            const res = await fetch(`${API_URL}/api/applications/${app.id}`, {
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

                    <div style={{ gridColumn: 'span 2' }}>
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


            </header>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '2.5rem', 
                marginBottom: '2rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)', // Clear greyish line across the page
                padding: '0 0.5rem'
            }}>
                <button 
                    onClick={() => setActiveTab('lifecycle')}
                    style={{
                        padding: '0.75rem 0',
                        background: 'none',
                        color: activeTab === 'lifecycle' ? 'var(--primary)' : 'var(--text-muted)',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'lifecycle' ? 'var(--primary)' : 'transparent'}`,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        marginBottom: '-1px'
                    }}
                >
                    Current Phase
                </button>
                <button 
                    onClick={() => setActiveTab('details')}
                    style={{
                        padding: '0.75rem 0',
                        background: 'none',
                        color: activeTab === 'details' ? 'var(--primary)' : 'var(--text-muted)',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'details' ? 'var(--primary)' : 'transparent'}`,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        marginBottom: '-1px'
                    }}
                >
                    Details & Documents
                </button>
                <button 
                    style={{
                        padding: '0.75rem 0',
                        background: 'none',
                        color: 'var(--text-muted)',
                        border: 'none',
                        borderBottom: '2px solid transparent',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        marginBottom: '-1px',
                        opacity: 0.6
                    }}
                >
                    Interviewer Profiles
                </button>
            </div>

            {activeTab === 'details' ? (
                <>
                <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', 
                gap: '2.5rem', 
                marginBottom: '3rem',
                alignItems: 'start'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Remarks moved up to header */}
                    
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined">description</span>
                            Description & Requirements
                        </div>
                        <JobDescriptionContent text={app.job_description} />
                    </div>

                    {/* AI Insights - Moved below Description */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined">auto_awesome</span>
                            AI Insights & Tailoring Summary
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Resume Changes */}
                            <div>
                                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Resume Improvements</h4>
                                {app.resume_changes_summary ? (
                                    <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                        {((typeof app.resume_changes_summary === 'string'
                                            ? JSON.parse(app.resume_changes_summary || '[]')
                                            : app.resume_changes_summary) || []).map((change, i) => (
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
                                {app.cover_letter_changes_summary && (typeof app.cover_letter_changes_summary === 'string' ? JSON.parse(app.cover_letter_changes_summary) : app.cover_letter_changes_summary).length > 0 ? (
                                    <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                        {((typeof app.cover_letter_changes_summary === 'string'
                                            ? JSON.parse(app.cover_letter_changes_summary || '[]')
                                            : app.cover_letter_changes_summary) || []).map((change, i) => (
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
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>
                                                {conn.name?.split(' ').map(n => n[0]).join('') || '?'}
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


                    {/* Resume Card */}
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>description</span>
                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Resumes</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            {/* Reference Resume */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600 }}>Reference</div>
                                <button className="doc-row-btn btn-mini-doc" onClick={() => handlePreview('original', app.original_resume_path)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>attach_file</span>
                                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Original Upload</div>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '1rem', opacity: 0.6 }}>visibility</span>
                                </button>
                            </div>

                            {/* Generated Version */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                    Generated
                                    {app.active_resume_type === 'generated' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE (FINAL)</span>}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button 
                                        className={`doc-row-btn ${app.active_resume_type === 'generated' ? 'doc-active' : ''}`}
                                        onClick={() => handlePreview('tailored', app.tailored_resume_path)}
                                        style={{ borderStyle: app.active_resume_type === 'generated' ? 'solid' : 'dashed' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: app.active_resume_type === 'generated' ? 'var(--primary)' : 'inherit' }}>auto_awesome</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 600 }}>Tailored Resume</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>AI Optimized</div>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '1.2rem', opacity: 0.8 }}>visibility</span>
                                    </button>
                                    
                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        {app.active_resume_type !== 'generated' && (
                                            <button 
                                                className="btn-secondary btn-mini" 
                                                onClick={() => toggleActiveVersion('resume', 'generated')}
                                                style={{ flex: 1, fontSize: '0.7rem' }}
                                            >Use as Final</button>
                                        )}
                                        <button 
                                            className="btn-secondary btn-mini" 
                                            onClick={handleRegenerateResume}
                                            disabled={regeneratingResume}
                                            style={{ flex: 1, fontSize: '0.7rem' }}
                                        >Regenerate</button>
                                    </div>
                                </div>
                            </div>

                            {/* Final / Override Version */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                    Custom Final
                                    {app.active_resume_type === 'override' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE (FINAL)</span>}
                                </div>
                                {app.override_resume_path ? (
                                    <>
                                        <button 
                                            className={`doc-row-btn ${app.active_resume_type === 'override' ? 'doc-active' : ''}`}
                                            onClick={() => handlePreview('override', app.override_resume_path)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>verified</span>
                                            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 600 }}>Custom Version</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.override_resume_path.split('/').pop()}</div>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>visibility</span>
                                        </button>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                            {app.active_resume_type !== 'override' && (
                                                <button 
                                                    className="btn-primary btn-mini" 
                                                    onClick={() => toggleActiveVersion('resume', 'override')}
                                                    style={{ flex: 1, fontSize: '0.7rem' }}
                                                >Set Active</button>
                                            )}
                                            <button 
                                                className="btn-secondary btn-mini" 
                                                onClick={() => handleOverrideUpload('resume')}
                                                style={{ flex: 1, fontSize: '0.7rem' }}
                                            >Replace</button>
                                        </div>
                                    </>
                                ) : (
                                    <button 
                                        className="doc-row-btn" 
                                        style={{ borderStyle: 'dashed', background: 'transparent' }}
                                        onClick={() => handleOverrideUpload('resume')}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', opacity: 0.5 }}>upload_file</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 500, opacity: 0.7 }}>Upload Final</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Overwrite generated version</div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cover Letter Card */}
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>mail</span>
                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Cover Letter</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            {/* Generated Version */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                    Generated
                                    {app.active_cover_letter_type === 'generated' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE (FINAL)</span>}
                                </div>
                                {app.cover_letter_path ? (
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            className={`doc-row-btn ${app.active_cover_letter_type === 'generated' ? 'doc-active' : ''}`}
                                            onClick={() => handlePreview('cover', app.cover_letter_path)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: app.active_cover_letter_type === 'generated' ? 'var(--primary)' : 'inherit' }}>edit_note</span>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 600 }}>Generated Letter</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>AI Written</div>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '1.2rem', opacity: 0.8 }}>visibility</span>
                                        </button>
                                        
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                            {app.active_cover_letter_type !== 'generated' && (
                                                <button 
                                                    className="btn-secondary btn-mini" 
                                                    onClick={() => toggleActiveVersion('cover_letter', 'generated')}
                                                    style={{ flex: 1, fontSize: '0.7rem' }}
                                                >Use as Final</button>
                                            )}
                                            <button 
                                                className="btn-secondary btn-mini" 
                                                onClick={handleRegenerateCL}
                                                disabled={regeneratingCL}
                                                style={{ flex: 1, fontSize: '0.7rem' }}
                                            >Regenerate</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                                         <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Not generated</p>
                                         <button className="btn-primary btn-mini" onClick={handleRegenerateCL}>Generate</button>
                                    </div>
                                )}
                            </div>

                            {/* Final / Override Version */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                    Custom Final
                                    {app.active_cover_letter_type === 'override' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>● ACTIVE (FINAL)</span>}
                                </div>
                                {app.override_cover_letter_path ? (
                                    <>
                                        <button 
                                            className={`doc-row-btn ${app.active_cover_letter_type === 'override' ? 'doc-active' : ''}`}
                                            onClick={() => handlePreview('override_cl', app.override_cover_letter_path)}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>verified</span>
                                            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 600 }}>Custom Version</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.override_cover_letter_path.split('/').pop()}</div>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>visibility</span>
                                        </button>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                            {app.active_cover_letter_type !== 'override' && (
                                                <button 
                                                    className="btn-primary btn-mini" 
                                                    onClick={() => toggleActiveVersion('cover_letter', 'override')}
                                                    style={{ flex: 1, fontSize: '0.7rem' }}
                                                >Set Active</button>
                                            )}
                                            <button 
                                                className="btn-secondary btn-mini" 
                                                onClick={() => handleOverrideUpload('cover_letter')}
                                                style={{ flex: 1, fontSize: '0.7rem' }}
                                            >Replace</button>
                                        </div>
                                    </>
                                ) : (
                                    <button 
                                        className="doc-row-btn" 
                                        style={{ borderStyle: 'dashed', background: 'transparent' }}
                                        onClick={() => handleOverrideUpload('cover_letter')}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', opacity: 0.5 }}>upload_file</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 500, opacity: 0.7 }}>Upload Final</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Overwrite generated version</div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div> {/* End Grid Container */}
                </>
            ) : (
                <div style={{ marginTop: '1rem' }}>
                    <ApplicationLifecycle 
                        app={app} 
                        onUpdate={onUpdate} 
                        hideHeader={true} 
                        onBack={() => setActiveTab('details')} 
                    />
                </div>
            )}

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
                <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
            )}

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
