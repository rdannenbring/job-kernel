import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const { login, hasAdmin, loading: authLoading, refreshHasAdmin } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    if (hasAdmin === false) {
      setAuthMode('register');
    } else if (hasAdmin === true) {
      setAuthMode('login');
    }
  }, [hasAdmin]);

  const isLogin = authMode === 'login';
  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    let endpoint = '';
    let body = {};

    if (isForgot) {
      endpoint = '/api/auth/forgot-password';
      body = { email };
    } else {
      endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      body = { username, password };
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        if (isForgot) {
          setMessage(data.message);
          setEmail('');
        } else {
          login({ id: data.user_id, username, is_admin: data.is_admin }, data.access_token);
        }
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || hasAdmin === null) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-spinner">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             </svg>
          </div>
          <h1>{isForgot ? 'Reset Password' : (isLogin ? 'Welcome Back' : (hasAdmin ? 'Create Account' : 'Setup Admin Account'))}</h1>
          <p>{isForgot ? 'Enter your email to receive a reset link' : (isLogin ? 'Sign in to manage your applications' : (hasAdmin ? 'Join the automation revolution' : 'First user will be granted admin privileges'))}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isForgot ? (
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Processing...' : (isForgot ? 'Send Link' : (isLogin ? 'Sign In' : 'Create Account'))}
          </button>
        </form>

        {hasAdmin && (
          <div className="auth-footer">
            {isForgot ? (
              <p>
                Remembered your password?{" "}
                <button onClick={() => setAuthMode('login')} className="link-button">
                  Sign In
                </button>
              </p>
            ) : (
              <>
                <p>
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <button onClick={() => setAuthMode(isLogin ? 'register' : 'login')} className="link-button">
                    {isLogin ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
                {isLogin && (
                  <p style={{ marginTop: '1rem' }}>
                    <button onClick={() => setAuthMode('forgot')} className="link-button" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                      Forgot Password?
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }
        .auth-logo {
          margin-bottom: 1.5rem;
          display: inline-block;
          padding: 1rem;
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 16px;
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
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-group input {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
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
          transition: all 0.2s;
          margin-top: 1rem;
        }
        .auth-button:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(var(--primary-rgb), 0.2);
        }
        .auth-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .link-button {
          background: none;
          border: none;
          color: var(--primary);
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          font-size: inherit;
        }
        .link-button:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default Auth;
