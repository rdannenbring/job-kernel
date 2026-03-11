import React from 'react';
import CustomDropdown from '../components/CustomDropdown';

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
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '2rem'
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
                            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem',
                            cursor: 'pointer', marginLeft: '1rem', lineHeight: 1
                        }}>×</button>
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


const ApplicationDetail = ({ app, onBack, onStatusUpdate }) => {
    const [previewFile, setPreviewFile] = React.useState(null);

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
        <div style={{ padding: '3rem', maxWidth: '1000px', width: '100%', height: '100%', overflowY: 'auto' }}>
            <button
                onClick={onBack}
                style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '1.5rem', padding: 0
                }}
            >
                ← Back to Dashboard
            </button>

            <header style={{ marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>{app.job_title}</h1>
                        <div style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>{app.company}</div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '0.5rem' }}>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Job Link</div>
                        {app.job_url ? (
                            <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all' }}>
                                Visit Listing 🔗
                            </a>
                        ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Date Created</div>
                        <div style={{ fontWeight: 500 }}>{new Date(app.date_saved).toLocaleDateString()}</div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Date Posted</div>
                        <div style={{ fontWeight: 500 }}>{app.date_posted || 'Unknown'}</div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Salary Range</div>
                        <div style={{ fontWeight: 500, color: app.salary_range ? '#fbbf24' : 'inherit' }}>{app.salary_range || 'Not Listed'}</div>
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Job Description</div>
                    <JobDescriptionContent text={app.job_description} />
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>

                {/* Documents Grid - Simplified */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

                    {/* Resume Card */}
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>📄 Resume</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                            {/* Original Resume Button */}
                            <button className="doc-row-btn" onClick={() => handlePreview('original', app.original_resume_path)}>
                                <span style={{ fontSize: '1.2rem' }}>📎</span>
                                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 500 }}>Original Resume</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{app.original_resume_path}</div>
                                </div>
                                <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>👁️</span>
                            </button>

                            {/* Tailored Version Button */}
                            <div style={{ marginTop: 'auto' }}>
                                <button className="doc-row-btn"
                                    onClick={() => handlePreview('tailored', app.tailored_resume_path)}
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--primary)', position: 'relative' }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>✨</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 500, color: 'var(--primary)' }}>Tailored Version</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Optimized for this role</div>
                                    </div>
                                    <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>👁️</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Cover Letter Card */}
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>✉️ Cover Letter</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                            {app.cover_letter_path ? (
                                <div style={{ marginTop: 'auto' }}>
                                    <button className="doc-row-btn"
                                        onClick={() => handlePreview('cover', app.cover_letter_path)}
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--primary)' }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>📝</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--primary)' }}>Generated Version</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Ready to send</div>
                                        </div>
                                        <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>👁️</span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 0.5rem 0' }}>Not generated yet</p>
                                        <button style={{
                                            padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white',
                                            border: 'none', borderRadius: '4px', cursor: 'pointer'
                                        }}>
                                            Generate Now
                                        </button>
                                    </div>
                                </div>
                            )}
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
                `}</style>

            </div>

            {/* Changes & Insights */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>✨ AI Insights & Changes</h3>
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>

                    {/* Resume Changes */}
                    <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Resume Improvements</h4>
                        {app.resume_changes_summary ? (
                            <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                {(typeof app.resume_changes_summary === 'string'
                                    ? JSON.parse(app.resume_changes_summary)
                                    : app.resume_changes_summary).map((change, i) => (
                                        <li key={i}>{change}</li>
                                    ))}
                            </ul>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No summary available.</p>
                        )}
                    </div>

                    {/* Cover Letter Refinements */}
                    <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Cover Letter History</h4>
                        {app.cover_letter_changes_summary && (typeof app.cover_letter_changes_summary === 'string' ? JSON.parse(app.cover_letter_changes_summary) : app.cover_letter_changes_summary).length > 0 ? (
                            <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                {(typeof app.cover_letter_changes_summary === 'string'
                                    ? JSON.parse(app.cover_letter_changes_summary)
                                    : app.cover_letter_changes_summary).map((change, i) => (
                                        <li key={i}>{change}</li>
                                    ))}
                            </ul>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No manual refinements made.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {previewFile && (
                <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
            )}

        </div>
    );
};

export default ApplicationDetail;
