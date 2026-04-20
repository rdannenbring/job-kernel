import React, { useState, useEffect } from 'react';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const t = urlParams.get('token');
        if (t) {
            setToken(t);
        } else {
            setError('Missing reset token. Please request a new one.');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setMessage('Password reset successfully! You can now sign in.');
            } else {
                setError(data.detail || 'Reset failed. Token may be expired.');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Set New Password</h1>
                    <p>Enter your new password below</p>
                </div>

                {!success ? (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="password">New Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your new password"
                                required
                            />
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <button type="submit" className="auth-button" disabled={loading || !token}>
                            {loading ? 'Updating...' : 'Reset Password'}
                        </button>
                    </form>
                ) : (
                    <div className="success-section" style={{ textAlign: 'center' }}>
                        <div className="auth-message" style={{ marginBottom: '2rem' }}>{message}</div>
                        <button 
                            onClick={() => window.location.href = '/'} 
                            className="auth-button"
                            style={{ width: '100%' }}
                        >
                            Go to Login
                        </button>
                    </div>
                )}
            </div>

            {/* Reuse Auth.jsx styles by including them here or in a shared CSS */}
            <style jsx>{`
                .auth-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: var(--bg-primary);
                    padding: 2rem;
                }
                .auth-card {
                    width: 100%;
                    max-width: 400px;
                    background: var(--bg-secondary);
                    border-radius: 24px;
                    padding: 3rem;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    border: 1px solid var(--border-color);
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 2.5rem;
                }
                .auth-header h1 {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }
                .auth-header p {
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                }
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                .form-group input {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1rem;
                    color: var(--text-primary);
                    font-size: 1rem;
                }
                .auth-error {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    text-align: center;
                }
                .auth-message {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    text-align: center;
                }
                .auth-button {
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 1rem;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                }
            `}</style>
        </div>
    );
};

export default ResetPassword;
