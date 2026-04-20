import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Account = ({ setScreen }) => {
    const { fetchWithAuth, user: authUser } = useAuth();
    const [form, setForm] = useState({
        first_name: '',
        last_name:  '',
        email:      '',
        password:   '',
        confirm_pw: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        // Load current account details from /api/auth/me
        const loadAccount = async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
                if (res.ok) {
                    const data = await res.json();
                    setForm(prev => ({
                        ...prev,
                        first_name: data.first_name || '',
                        last_name:  data.last_name  || '',
                        email:      data.email      || '',
                    }));
                }
            } catch (e) { console.error('Failed to load account', e); }
        };
        loadAccount();
    }, []);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (form.password && form.password !== form.confirm_pw) {
            setMessage({ text: 'Passwords do not match', type: 'error' });
            return;
        }
        setLoading(true);
        const payload = {
            first_name: form.first_name.trim() || null,
            last_name:  form.last_name.trim()  || null,
            email:      form.email.trim()      || null,
        };
        if (form.password) payload.password = form.password;

        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/account`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setMessage({ text: 'Account updated successfully!', type: 'success' });
                setForm(prev => ({ ...prev, password: '', confirm_pw: '' }));
            } else {
                const data = await res.json();
                setMessage({ text: data.detail || 'Update failed', type: 'error' });
            }
        } catch (e) {
            setMessage({ text: 'Error saving changes', type: 'error' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ');
    const initials = [form.first_name?.[0], form.last_name?.[0]].filter(Boolean).join('').toUpperCase()
        || authUser?.username?.[0]?.toUpperCase() || 'U';

    return (
        <div style={{ padding: '3rem', maxWidth: '640px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>account_circle</span>
                    My Account
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Update your name, email, and password.</p>
            </header>

            {/* Avatar + username display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem',
                padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: '12px',
                border: '1px solid var(--border-color)' }}>
                <div style={{
                    width: '60px', height: '60px', borderRadius: '50%',
                    background: 'var(--primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', fontWeight: 700, flexShrink: 0
                }}>
                    {initials}
                </div>
                <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{displayName || authUser?.username}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{authUser?.username}</div>
                    <span style={{
                        marginTop: '0.3rem', display: 'inline-block',
                        padding: '2px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600,
                        backgroundColor: authUser?.is_admin ? 'rgba(59,130,246,0.12)' : 'var(--bg-tertiary)',
                        color: authUser?.is_admin ? '#60a5fa' : '#94a3b8',
                        border: authUser?.is_admin ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent'
                    }}>
                        {authUser?.is_admin ? 'Administrator' : 'User'}
                    </span>
                </div>
            </div>

            <form onSubmit={handleSave} className="card">
                {/* Name */}
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>badge</span>
                    Personal Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">First Name</label>
                        <input className="form-input" value={form.first_name}
                            onChange={e => set('first_name', e.target.value)} placeholder="Jane" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Last Name</label>
                        <input className="form-input" value={form.last_name}
                            onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" value={form.email}
                        onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

                {/* Password */}
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>lock</span>
                    Change Password
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>(leave blank to keep current)</span>
                </h3>
                <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input className="form-input" type="password" value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="••••••••" autoComplete="new-password" />
                </div>
                <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input className="form-input" type="password" value={form.confirm_pw}
                        onChange={e => set('confirm_pw', e.target.value)}
                        placeholder="••••••••" autoComplete="new-password"
                        style={{ borderColor: form.password && form.confirm_pw && form.password !== form.confirm_pw ? '#ef4444' : '' }} />
                    {form.password && form.confirm_pw && form.password !== form.confirm_pw && (
                        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>Passwords do not match</p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setScreen('dashboard')}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Toast */}
            {message.text && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem',
                    backgroundColor: message.type === 'error' ? '#ef4444' : '#10b981',
                    color: 'white', padding: '1rem 2rem', borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    <span className="material-symbols-outlined">
                        {message.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {message.text}
                </div>
            )}
        </div>
    );
};

export default Account;
