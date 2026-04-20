import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Modals ────────────────────────────────────────────────────────────────────

const Backdrop = ({ onClick }) => (
    <div onClick={onClick} style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: 4000, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    }} />
);

/** Step 1 – ask for a name */
const NameModal = ({ onConfirm, onCancel }) => {
    const [name, setName] = useState('');
    const inputRef = useRef(null);
    useEffect(() => inputRef.current?.focus(), []);

    return (
        <>
            <Backdrop onClick={onCancel} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)', zIndex: 4001,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '2rem', width: '420px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)', animation: 'slideUp 0.25s ease-out'
            }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>key</span>
                    Name Your API Key
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Give this key a recognisable name so you know where it's used.
                </p>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Key Name / Description</label>
                    <input
                        ref={inputRef}
                        className="form-input"
                        placeholder="e.g. Chrome Extension, Home PC, CI Bot…"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => onConfirm(name.trim())}
                        disabled={!name.trim()}
                    >
                        Generate Key
                    </button>
                </div>
            </div>
        </>
    );
};

/** Step 2 – reveal the key once */
const RevealModal = ({ keyData, onClose }) => {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(keyData.api_key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <Backdrop onClick={onClose} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)', zIndex: 4001,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '2rem', width: '480px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)', animation: 'slideUp 0.25s ease-out'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '1.6rem' }}>check_circle</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Key Created: {keyData.name}</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Copy it now — you won't be able to see the full value again.
                        </p>
                    </div>
                </div>

                <div style={{
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                    <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem',
                        color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {keyData.api_key}
                    </code>
                    <button
                        onClick={copy}
                        className="btn btn-secondary"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                            {copied ? 'check' : 'content_copy'}
                        </span>
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>

                <div style={{
                    background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem',
                    display: 'flex', gap: '0.5rem', color: '#ca8a04', fontSize: '0.8rem'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>warning</span>
                    Store this key securely. It will be obscured after you close this window.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lock</span>
                        Save &amp; Close
                    </button>
                </div>
            </div>
        </>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

const Settings = ({ theme: externalTheme, onThemeChange, setScreen }) => {
    const { fetchWithAuth, user } = useAuth();
    const [uiConfig, setUiConfig] = useState({ font_size: 14.5, theme: 'system' });
    const [apiKeys, setApiKeys] = useState([]);
    const [revealedKeys, setRevealedKeys] = useState({}); // keyId -> bool
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('extension');

    // Modal state
    const [showNameModal, setShowNameModal] = useState(false);
    const [newKeyData, setNewKeyData] = useState(null); // set after creation

    useEffect(() => { fetchConfig(); fetchApiKeys(); }, []);

    useEffect(() => {
        if (externalTheme) setUiConfig(prev => ({ ...prev, theme: externalTheme }));
    }, [externalTheme]);

    const fetchConfig = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/config`);
            const data = await res.json();
            if (data.ui_config) setUiConfig(prev => ({ ...prev, ...data.ui_config }));
        } catch (e) { console.error('Failed to load config', e); }
    };

    const fetchApiKeys = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/api-keys`);
            if (res.ok) setApiKeys(await res.json());
        } catch (e) { console.error('Error fetching API keys', e); }
    };

    const handleCreateKey = async (name) => {
        setShowNameModal(false);
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/api-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const data = await res.json();
                setNewKeyData(data);          // triggers reveal modal
                fetchApiKeys();               // refresh list
            } else {
                const err = await res.json();
                setMessage(err.detail || 'Failed to create key');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (e) {
            setMessage('Failed to create key');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteKey = async (keyId) => {
        if (!window.confirm('Delete this API key? Any integrations using it will stop working.')) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/api-keys/${keyId}`, { method: 'DELETE' });
            if (res.ok) {
                setApiKeys(prev => prev.filter(k => k.id !== keyId));
                setMessage('API key deleted.');
                setTimeout(() => setMessage(''), 2500);
            }
        } catch (e) { setMessage('Failed to delete key'); }
    };

    const toggleReveal = (keyId) =>
        setRevealedKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));

    const copyKey = (key, name) => {
        navigator.clipboard.writeText(key);
        setMessage(`Copied "${name}" to clipboard!`);
        setTimeout(() => setMessage(''), 2000);
    };

    const saveConfig = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ui_config: uiConfig })
            });
            if (!res.ok) throw new Error('Failed to save');
            setMessage('Settings saved!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e) {
            setMessage('Error saving settings: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '1000px' }}>
            {/* Modals */}
            {showNameModal && (
                <NameModal onConfirm={handleCreateKey} onCancel={() => setShowNameModal(false)} />
            )}
            {newKeyData && (
                <RevealModal keyData={newKeyData} onClose={() => setNewKeyData(null)} />
            )}

            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>settings</span>
                    Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Configure your application preferences.</p>
            </header>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '1px solid #334155', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex' }}>
                    {[
                        { id: 'extension',  label: 'API Keys' },
                        { id: 'appearance', label: 'Appearance' },
                        { id: 'about',      label: 'About' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            background: 'transparent', border: 'none', padding: '0.5rem 1.1rem', cursor: 'pointer',
                            color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
                            borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                            fontWeight: activeTab === tab.id ? '600' : '400',
                            fontSize: '0.875rem', transition: 'color 0.15s', marginBottom: '-1px'
                        }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {user?.is_admin && (
                    <button
                        onClick={() => setScreen('admin')}
                        style={{
                            background: 'transparent', border: 'none',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)',
                            cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginRight: '0.5rem'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>admin_panel_settings</span>
                        Admin Dashboard
                    </button>
                )}
            </div>

            {/* ── API Keys Tab ──────────────────────────────────────────────── */}
            {activeTab === 'extension' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>vpn_key</span>
                                    API Keys
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                                    Use these keys to authenticate the Chrome extension or any other integration.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowNameModal(true)}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
                                New API Key
                            </button>
                        </div>

                        {apiKeys.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '2.5rem',
                                color: 'var(--text-muted)', border: '1px dashed var(--border-color)',
                                borderRadius: '10px'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem', opacity: 0.4 }}>key_off</span>
                                No API keys yet. Click <strong>New API Key</strong> to create one.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {apiKeys.map(k => (
                                    <div key={k.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        background: 'var(--bg-tertiary)', borderRadius: '10px',
                                        padding: '0.875rem 1rem', border: '1px solid var(--border-color)'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', flexShrink: 0 }}>key</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{k.name}</div>
                                            <code style={{
                                                fontFamily: 'monospace', fontSize: '0.78rem',
                                                color: 'var(--text-secondary)',
                                                letterSpacing: revealedKeys[k.id] ? 'normal' : '0.1em'
                                            }}>
                                                {revealedKeys[k.id] ? k.api_key : k.api_key_preview}
                                            </code>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                            <button
                                                title={revealedKeys[k.id] ? 'Hide' : 'Reveal'}
                                                onClick={() => toggleReveal(k.id)}
                                                className="btn btn-secondary"
                                                style={{ padding: '5px 8px' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                                                    {revealedKeys[k.id] ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                            <button
                                                title="Copy to clipboard"
                                                onClick={() => copyKey(k.api_key, k.name)}
                                                className="btn btn-secondary"
                                                style={{ padding: '5px 8px' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>content_copy</span>
                                            </button>
                                            <button
                                                title="Delete key"
                                                onClick={() => handleDeleteKey(k.id)}
                                                className="btn btn-secondary"
                                                style={{ padding: '5px 8px', color: '#ef4444' }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                                            </button>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                                            {k.created_at ? new Date(k.created_at).toLocaleDateString() : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Appearance Tab ────────────────────────────────────────────── */}
            {activeTab === 'appearance' && (
                <div className="card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>palette</span>
                        Appearance
                    </h3>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>UI Scale (Font Size)</span>
                            <span>{uiConfig.font_size}px</span>
                        </label>
                        <input
                            type="range" min="12" max="18" step="0.5"
                            value={uiConfig.font_size}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setUiConfig({ ...uiConfig, font_size: val });
                                document.documentElement.style.fontSize = `${val}px`;
                            }}
                            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary-light)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            <span>Smaller</span><span>Default</span><span>Larger</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Theme</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { value: 'dark', label: 'Dark', action: () => { document.documentElement.setAttribute('data-theme','dark'); document.documentElement.classList.add('dark'); } },
                                { value: 'light', label: 'Light', action: () => { document.documentElement.setAttribute('data-theme','light'); document.documentElement.classList.remove('dark'); } },
                                { value: 'system', label: 'System', action: () => { const isLight = window.matchMedia('(prefers-color-scheme: light)').matches; document.documentElement.setAttribute('data-theme', isLight?'light':'dark'); document.documentElement.classList.toggle('dark',!isLight); } },
                            ].map(t => (
                                <button key={t.value}
                                    className={`btn ${uiConfig.theme === t.value || (t.value==='system' && !uiConfig.theme) ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => { setUiConfig({...uiConfig, theme: t.value}); if(onThemeChange) onThemeChange(t.value); t.action(); }}
                                >{t.label}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={saveConfig} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Appearance'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── About Tab ─────────────────────────────────────────────────── */}
            {activeTab === 'about' && (
                <div>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>info</span>
                            About Resume Automator
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Privacy-first, AI-powered job application assistant.</p>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>How it works</h3>
                        <ul style={{ padding: 0, listStyle: 'none', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0 }}>
                            {[
                                { icon: 'auto_awesome', title: 'Tailor', desc: 'AI analyzes your resume against a job description to highlight the best fit.' },
                                { icon: 'edit_note', title: 'Refine', desc: 'Review the suggested changes and make tweaks before exporting.' },
                                { icon: 'history_edu', title: 'Cover Letter', desc: 'A matching cover letter is generated automatically.' },
                                { icon: 'shield', title: 'Save', desc: 'Everything is stored locally in your private database — nothing leaves your machine.' },
                            ].map(item => (
                                <li key={item.icon} style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginTop: '0.1rem' }}>{item.icon}</span>
                                    <span><strong>{item.title}:</strong> {item.desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="card">
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Open Source</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            Built with <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#f87171' }}>favorite</span> using React, FastAPI, and Docker.
                        </p>
                    </div>
                </div>
            )}

            {/* Toast */}
            {message && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem',
                    backgroundColor: message.includes('Error') || message.includes('Failed') ? '#ef4444' : '#10b981',
                    color: 'white', padding: '1rem 2rem', borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 3000,
                    animation: 'slideIn 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                    <span className="material-symbols-outlined">
                        {message.includes('Error') || message.includes('Failed') ? 'error' : 'check_circle'}
                    </span>
                    {message}
                </div>
            )}
        </div>
    );
};

export default Settings;
