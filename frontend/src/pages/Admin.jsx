import React, { useState, useEffect, useRef } from 'react';
import CustomDropdown from '../components/CustomDropdown';
import { useAuth } from '../context/AuthContext';

const VITE_API_URL = import.meta.env.VITE_API_URL;
const API_URL = (VITE_API_URL !== undefined && VITE_API_URL !== null) ? VITE_API_URL : 'http://localhost:8000';

// ── Edit User Modal ───────────────────────────────────────────────────────────
const EditUserModal = ({ targetUser, currentAdminId, onSave, onCancel }) => {
    const [form, setForm] = useState({
        first_name: targetUser.first_name || '',
        last_name:  targetUser.last_name  || '',
        email:      targetUser.email      || '',
        password:   '',
        is_admin:   !!targetUser.is_admin,
    });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <>
            {/* Backdrop */}
            <div onClick={onCancel} style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)', zIndex: 4000
            }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)', zIndex: 4001,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '2rem', width: '480px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
            }}>
                <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>manage_accounts</span>
                    Edit User: <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{targetUser.username}</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">First Name</label>
                        <input className="form-input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Last Name</label>
                        <input className="form-input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last" />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@example.com" />
                </div>

                <div className="form-group">
                    <label className="form-label">New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                    <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                </div>

                {/* Role toggle — can't demote yourself */}
                {targetUser.id !== currentAdminId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        background: 'var(--bg-tertiary)', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <input
                            type="checkbox" id="edit-is-admin"
                            checked={form.is_admin}
                            onChange={e => set('is_admin', e.target.checked)}
                        />
                        <label htmlFor="edit-is-admin" style={{ cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Administrator privileges
                        </label>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={async () => { setSaving(true); await onSave(targetUser.id, form); setSaving(false); }}
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Admin = () => {
    const { fetchWithAuth, user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [globalConfig, setGlobalConfig] = useState({
        ai_config: { provider: 'openai', model: 'gpt-4o-mini', base_url: '', api_key: '' },
        prompts: {},
        maintenance: {
            cleanup_enabled: false,
            frequency: 'weekly',
            start_time: '03:00',
            day_of_week: 'Sunday',
            day_of_month: 1,
            log_retention_days: 7
        }
    });
    const [newUser, setNewUser] = useState({
        username: '', password: '', first_name: '', last_name: '', email: '', is_admin: false
    });
    const [activeTab, setActiveTab] = useState('users');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [availableModels, setAvailableModels] = useState([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelFetchError, setModelFetchError] = useState('');
    const [logs, setLogs] = useState('');
    const [logType, setLogType] = useState('app');
    const [logLines, setLogLines] = useState(500);
    const [fetchingLogs, setFetchingLogs] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('log');
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const logContainerRef = useRef(null);

    // Auto-scroll logs to bottom when updated
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);


    // The initial admin is the user with the lowest ID among all users.
    // We protect them from deletion.
    const initialAdminId = users.length ? Math.min(...users.map(u => u.id)) : null;

    useEffect(() => {
        if (currentUser?.is_admin) {
            fetchUsers();
            fetchGlobalConfig();
        }
    }, [currentUser]);

    const fetchUsers = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/users`);
            if (res.ok) setUsers(await res.json());
        } catch (e) { console.error('Failed to fetch users', e); }
    };

    const fetchGlobalConfig = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/config`);
            if (res.ok) setGlobalConfig(await res.json());
        } catch (e) { console.error('Failed to fetch global config', e); }
    };

    const saveGlobalConfig = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(globalConfig)
            });
            if (res.ok) { setMessage('Global configuration saved!'); setTimeout(() => setMessage(''), 3000); }
        } catch (e) { setMessage('Error saving global config'); }
        finally { setLoading(false); }
    };

    const fetchModels = async () => {
        setFetchingModels(true);
        setModelFetchError('');
        setAvailableModels([]);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/fetch-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(globalConfig.ai_config || {})
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to fetch models');
            const models = data.models || [];
            if (models.length === 0) throw new Error('No models returned — check your API key');
            setAvailableModels(models);
        } catch (e) {
            setModelFetchError(e.message);
        } finally {
            setFetchingModels(false);
        }
    };

    const fetchLogs = async (type = logType, lines = logLines) => {
        setFetchingLogs(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/logs?type=${type}&lines=${lines}`);
            const data = await res.json();
            setLogs(data.logs || 'No logs available');
        } catch (e) {
            setLogs('Error fetching logs');
        } finally {
            setFetchingLogs(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchLogs();
        }
    }, [activeTab]);

    // Handle auto-refresh for logs
    useEffect(() => {
        let interval;
        if (activeTab === 'logs' && autoRefresh) {
            interval = setInterval(() => {
                // We use a functional check or just rely on the fact that 
                // fetchLogs handles its own loading state.
                fetchLogs(logType, logLines);
            }, 5000); // Refresh every 5 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, autoRefresh, logType, logLines]);

    const createUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                setMessage('User created successfully');
                setNewUser({ username: '', password: '', first_name: '', last_name: '', email: '', is_admin: false });
                fetchUsers();
                setTimeout(() => setMessage(''), 3000);
            } else {
                const data = await res.json();
                setMessage(data.detail || 'Failed to create user');
            }
        } catch (e) { setMessage('Error creating user'); }
        finally { setLoading(false); }
    };

    const saveUserEdit = async (uid, form) => {
        const payload = { ...form };
        if (!payload.password) delete payload.password; // don't send empty password
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/users/${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setMessage('User updated successfully');
                setEditingUser(null);
                fetchUsers();
                setTimeout(() => setMessage(''), 3000);
            } else {
                const data = await res.json();
                setMessage(data.detail || 'Failed to update user');
            }
        } catch (e) { setMessage('Error updating user'); }
    };

    const vacuumDb = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/db/vacuum`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage(data.detail || 'Failed to optimize database');
            }
        } catch (e) { setMessage('Error during cleanup'); }
        finally { setLoading(false); }
    };

    const purgeLogs = async (retention = null) => {
        const confirmMsg = retention 
            ? `Clean up log rotations older than ${retention} days? (Active logs will be preserved)`
            : 'Are you sure you want to purge ALL log files? This will clear active logs and delete all backups.';
            
        if (!window.confirm(confirmMsg)) return;
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/logs/purge`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ retention_days: retention })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(retention 
                    ? `Cleanup complete. Removed ${data.purged.length} old log files.`
                    : `Successfully purged ${data.purged.length} log files.`);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage(data.detail || 'Failed to purge logs');
            }
        } catch (e) { setMessage('Error purging logs'); }
        finally { setLoading(false); }
    };

    const resetDb = async () => {
        if (!window.confirm('ARE YOU ABSOLUTELY SURE? This will delete ALL data and cannot be undone.')) return;
        if (!window.confirm('FINAL WARNING: This will delete everything and restart the application. Proceed?')) return;
        
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/db/reset`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                // Redirect to login after a delay to let the server restart
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            } else {
                setMessage(data.detail || 'Failed to reset database');
                setLoading(false);
            }
        } catch (e) { 
            setMessage('Database reset initiated. Application is restarting...');
            setTimeout(() => {
                window.location.href = '/';
            }, 5000);
        }
    };

    const deleteUser = async (userId) => {
        if (!window.confirm('Delete this user? All their data will be permanently removed.')) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) { fetchUsers(); setMessage('User deleted'); setTimeout(() => setMessage(''), 3000); }
        } catch (e) { setMessage('Error deleting user'); }
    };

    const promptLabels = {
        analyze_job:          'Analyze Job Description',
        tailor_resume:        'Tailor Resume',
        refine_resume:        'Refine Resume',
        extract_profile:      'Extract Profile Data',
        generate_cover_letter:'Generate Cover Letter',
        refine_cover_letter:  'Refine Cover Letter',
    };

    const providerDefaults = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com',
        gemini: 'https://generativelanguage.googleapis.com/v1beta',
        openrouter: 'https://openrouter.ai/api/v1'
    };
    const currentProvider = globalConfig.ai_config?.provider || 'openai';
    const defaultBaseUrl = providerDefaults[currentProvider];
    const helperText = defaultBaseUrl ? `(Default: ${defaultBaseUrl})` : `(Leave blank to use default)`;
    const inputPlaceholder = defaultBaseUrl || 'e.g. http://127.0.0.1:11434/v1';

    if (!currentUser?.is_admin) {
        return <div style={{ padding: '3rem', textAlign: 'center' }}>Access Denied</div>;
    }

    return (
        <div style={{ padding: '3rem', maxWidth: '1100px' }}>
            {editingUser && (
                <EditUserModal
                    targetUser={editingUser}
                    currentAdminId={currentUser.id}
                    onSave={saveUserEdit}
                    onCancel={() => setEditingUser(null)}
                />
            )}

            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>admin_panel_settings</span>
                    Admin Dashboard
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Manage users and global system configuration.</p>
            </header>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '1px solid #334155' }}>
                {[
                    { id: 'users',     label: 'User Management' },
                    { id: 'ai-config', label: 'Global AI Config' },
                    { id: 'prompts',   label: 'Global Prompts' },
                    { id: 'maintenance', label: 'Maintenance' },
                    { id: 'logs',      label: 'System Logs' },
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

            {/* ── Users Tab ────────────────────────────────────────────────── */}
            {activeTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Create User Form */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined">person_add</span>
                                Create New User
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin);
                                    setMessage('Invite link copied!');
                                    setTimeout(() => setMessage(''), 3000);
                                }} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>content_copy</span>
                                    Copy Invite Link
                                </button>
                                <button className="btn btn-secondary" onClick={() => {
                                    const url = window.location.origin;
                                    window.location.href = `mailto:?subject=Invite to Resume Automator&body=You have been invited. Register here: ${url}`;
                                }} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>mail</span>
                                    Send Invite
                                </button>
                            </div>
                        </div>

                        <form onSubmit={createUser}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">First Name</label>
                                    <input className="form-input" placeholder="Jane" value={newUser.first_name}
                                        onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Last Name</label>
                                    <input className="form-input" placeholder="Doe" value={newUser.last_name}
                                        onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Email Address</label>
                                    <input className="form-input" type="email" placeholder="jane@example.com" value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                    <label className="form-label">Username <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="form-input" value={newUser.username} required
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                    <label className="form-label">Password <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="form-input" type="password" value={newUser.password} required
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', height: '42px', padding: '0 0.5rem', flexShrink: 0 }}>
                                    <input type="checkbox" id="new-is-admin" checked={newUser.is_admin}
                                        onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })} />
                                    <label htmlFor="new-is-admin" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>Administrator</label>
                                </div>
                                <button className="btn btn-primary" type="submit" disabled={loading} style={{ height: '42px', padding: '0 2rem', flexShrink: 0 }}>Create User</button>
                            </div>
                        </form>
                    </div>

                    {/* Users Table */}
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>group</span>
                            Active Users
                            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                {users.length} user{users.length !== 1 ? 's' : ''}
                            </span>
                        </h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const isInitialAdmin = u.id === initialAdminId;
                                    const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || null;
                                    return (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: u.is_admin ? 'var(--primary)' : 'var(--bg-tertiary)',
                                                        color: u.is_admin ? 'white' : 'var(--text-secondary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.8rem', fontWeight: 700, flexShrink: 0
                                                    }}>
                                                        {u.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                            {u.username}
                                                            {u.id === currentUser.id && (
                                                                <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: '4px' }}>You</span>
                                                            )}
                                                            {isInitialAdmin && (
                                                                <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px' }}>Original</span>
                                                            )}
                                                        </div>
                                                        {displayName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{displayName}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {u.email || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600,
                                                    backgroundColor: u.is_admin ? 'rgba(59,130,246,0.12)' : 'var(--bg-tertiary)',
                                                    color: u.is_admin ? '#60a5fa' : '#94a3b8',
                                                    border: u.is_admin ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent'
                                                }}>
                                                    {u.is_admin ? 'Admin' : 'User'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                    <button
                                                        onClick={() => setEditingUser(u)}
                                                        className="btn btn-secondary"
                                                        title="Edit user"
                                                        style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(u.id)}
                                                        className="btn btn-secondary"
                                                        title={isInitialAdmin ? 'Cannot delete the original admin account' : 'Delete user'}
                                                        disabled={isInitialAdmin}
                                                        style={{
                                                            padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                            fontSize: '0.8rem',
                                                            color: isInitialAdmin ? 'var(--text-muted)' : '#ef4444',
                                                            opacity: isInitialAdmin ? 0.45 : 1,
                                                            cursor: isInitialAdmin ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── AI Config Tab ─────────────────────────────────────────────── */}
            {activeTab === 'ai-config' && (
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>settings_suggest</span>
                        Global AI Settings
                    </h3>
                    <div className="form-group">
                        <label className="form-label">AI Provider</label>
                        <CustomDropdown
                            value={globalConfig.ai_config?.provider || 'openai'}
                            onChange={(val) => setGlobalConfig({ ...globalConfig, ai_config: { ...globalConfig.ai_config, provider: val } })}
                            options={[
                                { value: 'openai',     label: 'OpenAI (Official)' },
                                { value: 'anthropic',  label: 'Anthropic (Claude)' },
                                { value: 'gemini',     label: 'Google Gemini' },
                                { value: 'openrouter', label: 'OpenRouter' },
                                { value: 'ollama',     label: 'Ollama (Local)' },
                                { value: 'local',      label: 'Other AI Provider (OpenAI compatible)' },
                            ]}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">API Base URL <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>{helperText}</span></label>
                        <input className="form-input" value={globalConfig.ai_config?.[`${currentProvider}_base_url`] ?? ''} placeholder={inputPlaceholder}
                            onChange={(e) => setGlobalConfig({ ...globalConfig, ai_config: { ...globalConfig.ai_config, [`${currentProvider}_base_url`]: e.target.value } })} />
                    </div>
                    <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label className="form-label" style={{ margin: 0 }}>Model Name</label>
                            <button
                                type="button"
                                onClick={fetchModels}
                                disabled={fetchingModels}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    background: 'transparent', border: '1px solid var(--border-color)',
                                    borderRadius: '6px', padding: '3px 10px', cursor: fetchingModels ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-secondary)', fontSize: '0.78rem', opacity: fetchingModels ? 0.6 : 1,
                                    transition: 'color 0.15s, border-color 0.15s',
                                }}
                                onMouseEnter={e => { if (!fetchingModels) { e.currentTarget.style.color='var(--primary)'; e.currentTarget.style.borderColor='var(--primary)'; }}}
                                onMouseLeave={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-color)'; }}
                            >
                                {fetchingModels ? (
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cloud_download</span>
                                )}
                                {fetchingModels ? 'Loading…' : 'Load from Provider'}
                            </button>
                        </div>

                        {modelFetchError && (
                            <div style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                                {modelFetchError}
                            </div>
                        )}

                        {availableModels.length > 0 ? (
                            <>
                                <CustomDropdown
                                    value={globalConfig.ai_config?.[`${currentProvider}_model`] ?? ''}
                                    onChange={(val) => setGlobalConfig({ ...globalConfig, ai_config: { ...globalConfig.ai_config, [`${currentProvider}_model`]: val } })}
                                    options={availableModels.map(m => ({ value: m, label: m }))}
                                    placeholder="Select a model…"
                                />
                                <button
                                    type="button"
                                    onClick={() => setAvailableModels([])}
                                    style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                                >
                                    ✕ Enter model name manually
                                </button>
                            </>
                        ) : (
                            <input
                                className="form-input"
                                value={globalConfig.ai_config?.[`${currentProvider}_model`] ?? ''}
                                placeholder="e.g. gemini-2.0-flash or gpt-4o"
                                onChange={(e) => setGlobalConfig({ ...globalConfig, ai_config: { ...globalConfig.ai_config, [`${currentProvider}_model`]: e.target.value } })}
                            />
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">API Key</label>
                        <input className="form-input" type="password" value={globalConfig.ai_config?.[`${currentProvider}_api_key`] ?? ''}
                            onChange={(e) => setGlobalConfig({ ...globalConfig, ai_config: { ...globalConfig.ai_config, [`${currentProvider}_api_key`]: e.target.value } })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                        <button className="btn btn-primary" onClick={saveGlobalConfig} disabled={loading}>Save Global AI Config</button>
                    </div>
                </div>
            )}

            {/* ── Prompts Tab ───────────────────────────────────────────────── */}
            {activeTab === 'prompts' && (
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Global Prompts</h3>
                    {Object.keys(promptLabels).map(key => (
                        <div key={key} className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label">{promptLabels[key]}</label>
                            <textarea className="form-input"
                                style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                value={globalConfig.prompts?.[key] || ''}
                                onChange={(e) => setGlobalConfig({ ...globalConfig, prompts: { ...globalConfig.prompts, [key]: e.target.value } })}
                            />
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={saveGlobalConfig} disabled={loading}>Save All Global Prompts</button>
                    </div>
                </div>
            )}

            {/* ── Maintenance Tab ───────────────────────────────────────────── */}
            {activeTab === 'maintenance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>schedule</span>
                            Scheduled Maintenance
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <input 
                                type="checkbox" 
                                id="cleanup-enabled" 
                                checked={globalConfig.maintenance?.cleanup_enabled || false}
                                onChange={(e) => setGlobalConfig({
                                    ...globalConfig, 
                                    maintenance: { ...globalConfig.maintenance, cleanup_enabled: e.target.checked }
                                })}
                            />
                            <label htmlFor="cleanup-enabled" style={{ fontWeight: 600, cursor: 'pointer' }}>Enable automated scheduled cleanup</label>
                        </div>

                        {globalConfig.maintenance?.cleanup_enabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Frequency</label>
                                    <CustomDropdown 
                                        value={globalConfig.maintenance?.frequency || 'weekly'}
                                        onChange={(val) => setGlobalConfig({
                                            ...globalConfig, 
                                            maintenance: { ...globalConfig.maintenance, frequency: val }
                                        })}
                                        options={[
                                            { value: 'hourly', label: 'Hourly' },
                                            { value: 'daily', label: 'Daily' },
                                            { value: 'weekly', label: 'Weekly' },
                                            { value: 'monthly', label: 'Monthly' }
                                        ]}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Start Time (HH:MM)</label>
                                    <input 
                                        type="time" 
                                        className="form-input" 
                                        value={globalConfig.maintenance?.start_time || '03:00'}
                                        onChange={(e) => setGlobalConfig({
                                            ...globalConfig, 
                                            maintenance: { ...globalConfig.maintenance, start_time: e.target.value }
                                        })}
                                    />
                                </div>
                                {globalConfig.maintenance?.frequency === 'weekly' && (
                                    <div className="form-group">
                                        <label className="form-label">Day of Week</label>
                                        <CustomDropdown 
                                            value={globalConfig.maintenance?.day_of_week || 'Sunday'}
                                            onChange={(val) => setGlobalConfig({
                                                ...globalConfig, 
                                                maintenance: { ...globalConfig.maintenance, day_of_week: val }
                                            })}
                                            options={[
                                                { value: 'Monday', label: 'Monday' },
                                                { value: 'Tuesday', label: 'Tuesday' },
                                                { value: 'Wednesday', label: 'Wednesday' },
                                                { value: 'Thursday', label: 'Thursday' },
                                                { value: 'Friday', label: 'Friday' },
                                                { value: 'Saturday', label: 'Saturday' },
                                                { value: 'Sunday', label: 'Sunday' }
                                            ]}
                                        />
                                    </div>
                                )}
                                {globalConfig.maintenance?.frequency === 'monthly' && (
                                    <div className="form-group">
                                        <label className="form-label">Day of Month</label>
                                        <input 
                                            type="number" 
                                            min="1" max="31"
                                            className="form-input" 
                                            value={globalConfig.maintenance?.day_of_month || 1}
                                            onChange={(e) => setGlobalConfig({
                                                ...globalConfig, 
                                                maintenance: { ...globalConfig.maintenance, day_of_month: e.target.value }
                                            })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" onClick={saveGlobalConfig} disabled={loading}>Save Schedule</button>
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>cleaning_services</span>
                            Database Cleanup
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Reclaim unused space in the SQLite database file. This will run the <code>VACUUM</code> command to compress the database and optimize performance.
                        </p>
                        <button 
                            className="btn btn-primary" 
                            onClick={vacuumDb} 
                            disabled={loading}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <span className="material-symbols-outlined">auto_fix_high</span>
                            Run Cleanup Now
                        </button>
                    </div>
                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>history</span>
                            Log Maintenance
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Configure how many days of log history to keep. Old log rotations will be automatically cleaned up during scheduled maintenance.
                        </p>
                        
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontSize: '0.85rem' }}>Retention Period (Days)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ width: '100px', margin: 0 }}
                                    value={globalConfig.maintenance?.log_retention_days || 7} 
                                    onChange={e => setGlobalConfig({
                                        ...globalConfig, 
                                        maintenance: { ...globalConfig.maintenance, log_retention_days: parseInt(e.target.value) || 7 }
                                    })}
                                    min="1" max="365"
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>days</span>
                                <button className="btn btn-secondary" onClick={saveGlobalConfig} disabled={loading} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Save Setting</button>
                            </div>
                            <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                Recommended: 7–14 days. Active logs are never truncated during automated cleanup.
                            </small>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                className="btn btn-primary" 
                                onClick={() => purgeLogs(globalConfig.maintenance?.log_retention_days || 7)} 
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}
                            >
                                <span className="material-symbols-outlined">cleaning_services</span>
                                Run Cleanup
                            </button>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => purgeLogs(null)} 
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#ef4444', color: '#ef4444', flex: 1, justifyContent: 'center' }}
                            >
                                <span className="material-symbols-outlined">delete_sweep</span>
                                Purge All
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                            <span className="material-symbols-outlined">warning</span>
                            Danger Zone: Reset Database
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            This will <strong>permanently delete all data</strong> from the database, including all users, job applications, profiles, and documents.
                            The application will restart, and you will need to go through the initial setup process again to create the administrator account.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button 
                                className="btn" 
                                onClick={resetDb} 
                                disabled={loading}
                                style={{ 
                                    background: 'rgba(239, 68, 68, 0.1)', 
                                    color: '#ef4444', 
                                    border: '1px solid #ef4444',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <span className="material-symbols-outlined">delete_forever</span>
                                Reset Everything
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Logs Tab ────────────────────────────────────────────────── */}
            {activeTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>terminal</span>
                                {logType === 'app' ? 'Application Logs' : logType === 'db' ? 'Database Logs' : 'Extension Logs'}
                            </h3>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={autoRefresh} 
                                            onChange={(e) => setAutoRefresh(e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-refresh</span>
                                    </label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lines:</span>
                                    <select 
                                        value={logLines} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLogLines(val);
                                            fetchLogs(logType, val);
                                        }}
                                        style={{
                                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                                            borderRadius: '6px', padding: '2px 6px', fontSize: '0.8rem', cursor: 'pointer'
                                        }}
                                    >
                                        <option value={100}>100</option>
                                        <option value={500}>500</option>
                                        <option value={1000}>1000</option>
                                        <option value={2000}>2000</option>
                                    </select>
                                </div>
                                <div style={{ 
                                    display: 'flex', background: 'var(--bg-tertiary)', 
                                    padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' 
                                }}>
                                    <button 
                                        onClick={() => { setLogType('app'); fetchLogs('app'); }}
                                        style={{
                                            padding: '4px 12px', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: logType === 'app' ? 'var(--primary)' : 'transparent',
                                            color: logType === 'app' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Application
                                    </button>
                                    <button 
                                        onClick={() => { setLogType('db'); fetchLogs('db'); }}
                                        style={{
                                            padding: '4px 12px', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: logType === 'db' ? 'var(--primary)' : 'transparent',
                                            color: logType === 'db' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Database
                                    </button>
                                    <button 
                                        onClick={() => { setLogType('extension'); fetchLogs('extension'); }}
                                        style={{
                                            padding: '4px 12px', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: logType === 'extension' ? 'var(--primary)' : 'transparent',
                                            color: logType === 'extension' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        Extension
                                    </button>
                                </div>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => setShowExportModal(true)}
                                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Export / Download Logs"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>download</span>
                                </button>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => fetchLogs()} 
                                    disabled={fetchingLogs}
                                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Refresh Logs"
                                >
                                    <span className={`material-symbols-outlined ${fetchingLogs ? 'spin' : ''}`} style={{ fontSize: '1.2rem' }}>refresh</span>
                                </button>
                            </div>
                        </div>

                        <div 
                            ref={logContainerRef}
                            style={{ 
                                background: '#0f172a', color: '#cbd5e1', padding: '1.5rem', borderRadius: '12px', 
                                fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5',
                                height: '500px', overflowY: 'auto', border: '1px solid #1e293b',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                            }}
                        >

                            {fetchingLogs && logs === '' ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                    Loading logs...
                                </div>
                            ) : (
                                logs ? logs.split('\n').map((line, i) => {
                                    if (!line.trim()) return null;
                                    // Match standard timestamp: 2026-04-27 18:37:51,234
                                    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})/);
                                    if (tsMatch) {
                                        const ts = tsMatch[1];
                                        const content = line.substring(ts.length);
                                        return (
                                            <div key={i} style={{ marginBottom: '1px' }}>
                                                <span style={{ color: '#6366f1', fontWeight: 600 }}>{ts}</span>
                                                {content}
                                            </div>
                                        );
                                    }
                                    return <div key={i}>{line}</div>;
                                }) : 'No log data available.'
                            )}
                        </div>

                        <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Showing last 500 lines</span>
                            <span>Auto-refresh when switching tabs</span>
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>info</span>
                            About System Logs
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <strong>Application Logs:</strong> Captures web server activity, AI requests, document generation events, and general application errors. 
                            Use this to debug why enrichment or resume generation might be failing.
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginTop: '1rem' }}>
                            <strong>Database Logs:</strong> Shows raw SQL queries executed by the application. Useful for performance tuning and verifying data integrity.
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginTop: '1rem' }}>
                            <strong>Extension Logs:</strong> Captures activity from the Chrome extension, including scraping events, LinkedIn sync status, and browser-side errors.
                        </p>
                    </div>
                </div>
            )}

            {/* Toast */}
            {message && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem',
                    backgroundColor: message.includes('Error') || message.includes('Failed') ? '#ef4444' : 'var(--primary)',
                    color: 'white', padding: '1rem 2rem', borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                        {message.includes('Error') || message.includes('Failed') ? 'error' : 'check_circle'}
                    </span>
                    {message}
                </div>
            )}
            {/* ── Export Logs Modal ────────────────────────────────────────────────── */}
            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Export Logs</h3>
                            <button className="btn-icon" onClick={() => setShowExportModal(false)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label>Log Type</label>
                                <select 
                                    className="input" 
                                    value={logType} 
                                    onChange={(e) => setLogType(e.target.value)}
                                >
                                    <option value="app">Application Logs</option>
                                    <option value="db">Database Logs</option>
                                    <option value="extension">Extension Logs</option>
                                    <option value="all">All Logs (ZIP)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Format</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {['log', 'jsonl', 'csv'].map(fmt => (
                                        <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                name="exportFormat" 
                                                value={fmt} 
                                                checked={fmt === exportFormat}
                                                onChange={(e) => setExportFormat(e.target.value)}
                                            />
                                            <span style={{ textTransform: 'uppercase', fontSize: '0.9rem' }}>.{fmt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Start Date (Optional)</label>
                                    <input 
                                        type="date" 
                                        className="input"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date (Optional)</label>
                                    <input 
                                        type="date" 
                                        className="input"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ 
                                padding: '0.75rem 1rem', 
                                background: 'var(--bg-tertiary)', 
                                borderRadius: '8px', 
                                border: '1px solid var(--border-color)',
                                fontSize: '0.9rem',
                                color: 'var(--primary)',
                                fontWeight: 500
                            }}>
                                <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', fontWeight: 400 }}>Selected:</span>
                                {exportStartDate || exportEndDate 
                                    ? `${exportStartDate || 'Beginning'} — ${exportEndDate || 'End'}`
                                    : `Last ${logLines} lines (Current view)`}
                            </div>

                            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
                                    Standard export includes log files within the specified date range.
                                </p>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%' }}
                                    onClick={async () => {
                                        const format = exportFormat;
                                        const start = exportStartDate;
                                        const end = exportEndDate;
                                        let url = `${API_URL}/api/admin/logs/export?type=${logType}&format=${format}`;
                                        if (start) url += `&start_date=${start}`;
                                        if (end) url += `&end_date=${end}`;
                                        if (!start && !end) url += `&lines=${logLines}`;
                                        
                                        try {
                                            const res = await fetchWithAuth(url);
                                            const blob = await res.blob();
                                            const link = document.createElement('a');
                                            link.href = window.URL.createObjectURL(blob);
                                            const ext = logType === 'all' ? 'zip' : format;
                                            link.download = `${logType}_logs_${new Date().toISOString().split('T')[0]}.${ext}`;
                                            link.click();
                                            setShowExportModal(false);
                                        } catch (e) {
                                            alert('Failed to download logs');
                                        }
                                    }}
                                >
                                    Download Logs
                                </button>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>System Diagnostic Bundle</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    Includes all logs, server configuration, environment variables, and system info in a single ZIP file.
                                </p>
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                    onClick={async () => {
                                        try {
                                            const res = await fetchWithAuth(`${API_URL}/api/admin/system/diagnostic-bundle`);
                                            const blob = await res.blob();
                                            const link = document.createElement('a');
                                            link.href = window.URL.createObjectURL(blob);
                                            link.download = `diagnostic_bundle_${new Date().toISOString().split('T')[0]}.zip`;
                                            link.click();
                                            setShowExportModal(false);
                                        } catch (e) {
                                            alert('Failed to download diagnostic bundle');
                                        }
                                    }}
                                >
                                    Download Diagnostic Bundle (.zip)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
