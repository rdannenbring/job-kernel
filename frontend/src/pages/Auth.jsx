import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const { login, hasAdmin, loading: authLoading, refreshHasAdmin } = useAuth();
  const [isLogin, setIsLogin] = useState(true); // default to login; setup only when hasAdmin is explicitly false
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    // Only show the setup/register form if hasAdmin is explicitly false (no admin exists yet)
    if (hasAdmin === false) {
      setIsLogin(false);
    } else if (hasAdmin === true) {
      setIsLogin(true);
    }
    // hasAdmin === null means still loading — leave isLogin unchanged (stays true)
  }, [hasAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        login({ id: data.user_id, username, is_admin: data.is_admin }, data.access_token);
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
          <h1>{isLogin ? 'Welcome Back' : (hasAdmin ? 'Create Account' : 'Setup Admin Account')}</h1>
          <p>{isLogin ? 'Sign in to manage your applications' : (hasAdmin ? 'Join the automation revolution' : 'First user will be granted admin privileges')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {hasAdmin && (
          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="link-button">
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
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
