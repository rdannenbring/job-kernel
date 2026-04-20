import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const checkAdmin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/has-admin`);
      if (res.ok) {
        const data = await res.json();
        setHasAdmin(data.has_admin);
        return data.has_admin;
      }
      setHasAdmin(true);
      return true;
    } catch (e) {
      console.error("Failed to check admin status", e);
      setHasAdmin(true);
      return true;
    }
  };

  const loadUser = async () => {
    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          logout();
        }
      } catch (e) {
        console.error("Failed to load user", e);
        logout();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await checkAdmin();
      if (token) {
        await loadUser();
      } else {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const login = (userData, userToken) => {
    localStorage.setItem('token', userToken);
    setToken(userToken);
    setUser(userData);
    setHasAdmin(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const headers = {
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      logout();
    }

    return response;
  };

  const value = {
    user,
    token,
    loading,
    hasAdmin,
    login,
    logout,
    fetchWithAuth,
    refreshHasAdmin: checkAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
