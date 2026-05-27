import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePhotoModal from '../components/ProfilePhotoModal';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const Account = ({ setScreen }) => {
    const { fetchWithAuth, user: authUser } = useAuth();
    const [form, setForm] = useState({
        first_name: '',
        last_name:  '',
        email:      '',
        password:   '',
        confirm_pw: '',
        photo_url:  '',
        photo_zoom: 1.0,
        photo_x:    0,
        photo_y:    0,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

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
                        photo_url:  data.photo_url  || '',
                        photo_zoom: data.photo_zoom || 1.0,
                        photo_x:    data.photo_x    || 0,
                        photo_y:    data.photo_y    || 0,
                    }));
                }
            } catch (e) { console.error('Failed to load account', e); }
        };
        loadAccount();
    }, []);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handlePhotoSuccess = (data) => {
        setForm(prev => ({
            ...prev,
            photo_url: data.photo_url,
            photo_zoom: data.photo_zoom,
            photo_x: data.photo_x,
            photo_y: data.photo_y
        }));
    };

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
            photo_url:  form.photo_url.trim()  || null,
            photo_zoom: parseFloat(form.photo_zoom),
            photo_x:    parseFloat(form.photo_x),
            photo_y:    parseFloat(form.photo_y),
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
        <div style={{ padding: 'var(--page-py) var(--page-px)', maxWidth: '640px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>account_circle</span>
                    My Account
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Update your name, email, and password.</p>
            </header>

            {/* Avatar + username display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem',
                padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px',
                border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                
                {/* Clickable Circle Avatar */}
                <div 
                    onClick={() => setIsPhotoModalOpen(true)}
                    title="Click to edit profile photo"
                    style={{
                        width: '100px', height: '100px', borderRadius: '50%',
                        background: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2rem', fontWeight: 700, flexShrink: 0,
                        overflow: 'hidden', position: 'relative',
                        cursor: 'pointer',
                        border: '3px solid var(--border-color)',
                        boxShadow: 'var(--shadow-glow)',
                        transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1.0)'; }}
                >
                    {form.photo_url ? (
                        <img
                            src={form.photo_url.startsWith('http') ? form.photo_url : `${API_URL}${form.photo_url}`}
                            alt="Avatar"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: `scale(${form.photo_zoom}) translate(${form.photo_x}px, ${form.photo_y}px)`,
                                transformOrigin: 'center center',
                                pointerEvents: 'none',
                            }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : null}
                    {(!form.photo_url) && initials}
                    
                    {/* Hover edit overlay */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s ease',
                        borderRadius: '50%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'white' }}>edit</span>
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName || authUser?.username}</div>
                        <span style={{
                            display: 'inline-block',
                            padding: '2px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600,
                            backgroundColor: authUser?.is_admin ? 'rgba(59,130,246,0.12)' : 'var(--bg-tertiary)',
                            color: authUser?.is_admin ? '#60a5fa' : '#94a3b8',
                            border: authUser?.is_admin ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent'
                        }}>
                            {authUser?.is_admin ? 'Administrator' : 'User'}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>@{authUser?.username}</div>
                    
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => setIsPhotoModalOpen(true)}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>photo_camera</span>
                        {form.photo_url ? 'Edit Profile Photo' : 'Add Profile Photo'}
                    </button>
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
            <ProfilePhotoModal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                onSuccess={handlePhotoSuccess}
                initialPhotoUrl={form.photo_url}
                initialZoom={form.photo_zoom}
                initialX={form.photo_x}
                initialY={form.photo_y}
            />
        </div>
    );
};

export default Account;
