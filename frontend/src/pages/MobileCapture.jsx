import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
const LOCATION_TYPES = ['On-site', 'Remote', 'Hybrid'];

function MobileCapture({ onSaved, onGoToDashboard }) {
    const [stage, setStage] = useState('input'); // 'input', 'loading', 'review', 'saved', 'error'
    const [inputUrl, setInputUrl] = useState('');
    const [inputText, setInputText] = useState('');
    const [inputMode, setInputMode] = useState('url'); // 'url' or 'text'
    const [error, setError] = useState(null);
    const [rawDescription, setRawDescription] = useState('');
    const [duplicate, setDuplicate] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        job_title: '',
        company: '',
        location: '',
        location_type: '',
        job_type: '',
        salary_range: '',
        job_url: '',
        date_posted: '',
    });

    const urlInputRef = useRef(null);

    // On mount, check for share target params in the URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedUrl = params.get('url') || '';
        const sharedText = params.get('text') || '';
        const sharedTitle = params.get('title') || '';

        // Clean up the query string so it doesn't persist
        if (sharedUrl || sharedText) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
        }

        // Android often puts the URL in the 'text' param instead of 'url'
        let resolvedUrl = sharedUrl;
        if (!resolvedUrl && sharedText) {
            // Check if shared text contains a URL
            const urlMatch = sharedText.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                resolvedUrl = urlMatch[0];
            }
        }

        if (resolvedUrl) {
            setInputUrl(resolvedUrl);
            setInputMode('url');
            // Auto-submit after a brief delay
            setTimeout(() => handleCapture(resolvedUrl, ''), 300);
        } else if (sharedText) {
            setInputText(sharedText);
            setInputMode('text');
        }
    }, []);

    const handleCapture = async (url, text) => {
        const captureUrl = (url || inputUrl).trim();
        const captureText = (text !== undefined ? text : inputText).trim();

        if (!captureUrl && !captureText) {
            setError('Please enter a job URL or paste the job description');
            return;
        }

        setStage('loading');
        setError(null);
        setDuplicate(null);

        try {
            const res = await fetch(`${API_URL}/api/capture-job`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: captureUrl || undefined,
                    text: captureText || undefined,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error (${res.status})`);
            }

            const data = await res.json();

            setFormData({
                job_title: data.extracted?.job_title || '',
                company: data.extracted?.company || '',
                location: data.extracted?.location || '',
                location_type: data.extracted?.location_type || '',
                job_type: data.extracted?.job_type || '',
                salary_range: data.extracted?.salary_range || '',
                job_url: data.job_url || captureUrl || '',
                date_posted: data.extracted?.date_posted || '',
            });
            setRawDescription(data.raw_description || captureText || '');
            setDuplicate(data.duplicate || null);
            setStage('review');
        } catch (err) {
            setError(err.message);
            setStage('error');
        }
    };

    const handleSave = async () => {
        if (!formData.job_title.trim()) {
            setError('Job title is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const payload = {
                job_title: formData.job_title,
                company: formData.company || 'Unknown Company',
                job_url: formData.job_url,
                job_description: rawDescription,
                salary_range: formData.salary_range,
                date_posted: formData.date_posted,
                job_type: formData.job_type || 'Full-time',
                location_type: formData.location_type || 'On-site',
                location: formData.location,
                status: 'Saved',
                pipeline_stage: 'saved',
            };

            const res = await fetch(`${API_URL}/api/save-application`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Failed to save');
            }

            setStage('saved');
            if (onSaved) onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setStage('input');
        setFormData({ job_title: '', company: '', location: '', location_type: '', job_type: '', salary_range: '', job_url: '', date_posted: '' });
        setRawDescription('');
        setError(null);
        setDuplicate(null);
        setInputUrl('');
        setInputText('');
    };

    const updateField = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    // --- RENDER ---

    return (
        <div className="capture-root">
            {/* Header */}
            <header className="capture-header">
                <div className="capture-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: 'var(--primary)' }}>add_circle</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700 }}>Capture Job</span>
                    </div>
                    {onGoToDashboard && (
                        <button onClick={onGoToDashboard} className="capture-btn-link">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>dashboard</span>
                            Dashboard
                        </button>
                    )}
                </div>
            </header>

            <div className="capture-body">
                {/* === INPUT STAGE === */}
                {stage === 'input' && (
                    <div className="capture-card">
                        <h2 className="capture-card-title">
                            <span className="material-symbols-outlined">link</span>
                            Share a Job Listing
                        </h2>
                        <p className="capture-card-desc">
                            Paste a job URL or the full job description text. Our AI will extract the key details.
                        </p>

                        {/* Mode Toggle */}
                        <div className="capture-toggle-row">
                            <button
                                className={`capture-toggle-btn ${inputMode === 'url' ? 'active' : ''}`}
                                onClick={() => setInputMode('url')}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>link</span>
                                URL
                            </button>
                            <button
                                className={`capture-toggle-btn ${inputMode === 'text' ? 'active' : ''}`}
                                onClick={() => setInputMode('text')}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>content_paste</span>
                                Paste Text
                            </button>
                        </div>

                        {inputMode === 'url' ? (
                            <input
                                ref={urlInputRef}
                                type="url"
                                className="capture-input"
                                placeholder="https://linkedin.com/jobs/view/..."
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
                                autoFocus
                            />
                        ) : (
                            <textarea
                                className="capture-textarea"
                                placeholder="Paste the full job description here..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                rows={8}
                                autoFocus
                            />
                        )}

                        {error && (
                            <div className="capture-error">
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>warning</span>
                                {error}
                            </div>
                        )}

                        <button
                            className="capture-btn-primary"
                            onClick={() => handleCapture()}
                            disabled={inputMode === 'url' ? !inputUrl.trim() : !inputText.trim()}
                        >
                            <span className="material-symbols-outlined">auto_awesome</span>
                            Extract Job Details
                        </button>
                    </div>
                )}

                {/* === LOADING STAGE === */}
                {stage === 'loading' && (
                    <div className="capture-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <div className="capture-spinner" />
                        <p style={{ color: 'var(--text-secondary)', marginTop: '1.5rem', fontSize: '1rem' }}>
                            Analyzing job listing...
                        </p>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                            This may take a few seconds
                        </p>
                    </div>
                )}

                {/* === ERROR STAGE === */}
                {stage === 'error' && (
                    <div className="capture-card">
                        <div className="capture-error" style={{ marginBottom: '1.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>error</span>
                            {error}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="capture-btn-secondary" onClick={handleReset} style={{ flex: 1 }}>
                                <span className="material-symbols-outlined">arrow_back</span>
                                Try Again
                            </button>
                            {inputMode === 'url' && (
                                <button className="capture-btn-secondary" onClick={() => { setInputMode('text'); setStage('input'); }} style={{ flex: 1 }}>
                                    <span className="material-symbols-outlined">content_paste</span>
                                    Paste Instead
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* === REVIEW STAGE === */}
                {stage === 'review' && (
                    <div className="capture-card">
                        <h2 className="capture-card-title">
                            <span className="material-symbols-outlined">fact_check</span>
                            Review Details
                        </h2>

                        {duplicate && (
                            <div className="capture-warning" style={{ marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span>
                                A similar job may already be saved. You can still save this one.
                            </div>
                        )}

                        {error && (
                            <div className="capture-error" style={{ marginBottom: '1rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>warning</span>
                                {error}
                            </div>
                        )}

                        {/* Form Fields */}
                        <div className="capture-form">
                            <div className="capture-field">
                                <label>Job Title *</label>
                                <input
                                    className="capture-input"
                                    value={formData.job_title}
                                    onChange={(e) => updateField('job_title', e.target.value)}
                                    placeholder="e.g. Senior Software Engineer"
                                />
                            </div>

                            <div className="capture-field">
                                <label>Company</label>
                                <input
                                    className="capture-input"
                                    value={formData.company}
                                    onChange={(e) => updateField('company', e.target.value)}
                                    placeholder="e.g. Google"
                                />
                            </div>

                            <div className="capture-field">
                                <label>Location</label>
                                <input
                                    className="capture-input"
                                    value={formData.location}
                                    onChange={(e) => updateField('location', e.target.value)}
                                    placeholder="e.g. New York, NY"
                                />
                            </div>

                            <div className="capture-field-row">
                                <div className="capture-field" style={{ flex: 1 }}>
                                    <label>Job Type</label>
                                    <select
                                        className="capture-input"
                                        value={formData.job_type}
                                        onChange={(e) => updateField('job_type', e.target.value)}
                                    >
                                        <option value="">—</option>
                                        {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="capture-field" style={{ flex: 1 }}>
                                    <label>Location Type</label>
                                    <select
                                        className="capture-input"
                                        value={formData.location_type}
                                        onChange={(e) => updateField('location_type', e.target.value)}
                                    >
                                        <option value="">—</option>
                                        {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="capture-field">
                                <label>Salary Range</label>
                                <input
                                    className="capture-input"
                                    value={formData.salary_range}
                                    onChange={(e) => updateField('salary_range', e.target.value)}
                                    placeholder="e.g. $150k - $200k"
                                />
                            </div>

                            <div className="capture-field">
                                <label>Job URL</label>
                                <input
                                    type="url"
                                    className="capture-input"
                                    value={formData.job_url}
                                    onChange={(e) => updateField('job_url', e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button className="capture-btn-secondary" onClick={handleReset} style={{ flex: 0.4 }}>
                                <span className="material-symbols-outlined">arrow_back</span>
                                Back
                            </button>
                            <button
                                className="capture-btn-primary"
                                onClick={handleSave}
                                disabled={saving || !formData.job_title.trim()}
                                style={{ flex: 0.6 }}
                            >
                                {saving ? (
                                    <>
                                        <div className="capture-spinner-sm" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">save</span>
                                        Save Job
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* === SAVED STAGE === */}
                {stage === 'saved' && (
                    <div className="capture-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'rgba(34, 197, 94, 0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: '#22c55e' }}>check_circle</span>
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            Job Saved!
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            <strong>{formData.job_title}</strong> at <strong>{formData.company}</strong> has been added to your pipeline.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button className="capture-btn-secondary" onClick={handleReset}>
                                <span className="material-symbols-outlined">add</span>
                                Capture Another
                            </button>
                            {onGoToDashboard && (
                                <button className="capture-btn-primary" onClick={onGoToDashboard}>
                                    <span className="material-symbols-outlined">dashboard</span>
                                    Dashboard
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MobileCapture;
