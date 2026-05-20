import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotifications = () => useContext(NotificationContext);

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Default toast display duration (seconds). Overridden by user's ui_config.
const DEFAULT_TOAST_DURATION = 8;

// How often to poll the backend for new notifications (ms)
const POLL_INTERVAL = 10000;

export const NotificationProvider = ({ children }) => {
  const { fetchWithAuth, token } = useAuth();

  // Stable ref for fetchWithAuth to avoid infinite re-render loops.
  // fetchWithAuth from AuthContext is not memoized, so putting it in
  // useCallback deps would cause cascading re-creates every render.
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);

  // All notifications fetched from server
  const [notifications, setNotifications] = useState([]);
  // Toasts currently visible on screen (auto-dismiss queue)
  const [toasts, setToasts] = useState([]);
  // Track IDs of notifications we've already shown as toasts so we don't re-show them
  const shownToastIds = useRef(new Set());
  // Toast duration from user settings
  const [toastDuration, setToastDuration] = useState(DEFAULT_TOAST_DURATION);
  // Per-category notification preferences (badge & toast toggles)
  const [notifPrefs, setNotifPrefs] = useState(null);
  // Center panel open/closed
  const [centerOpen, setCenterOpen] = useState(false);
  // View mode for the notification center
  const [showAll, setShowAll] = useState(false);

  // Helper: check if a category has a specific pref enabled (defaults to true)
  const isPrefEnabled = useCallback((category, field) => {
    if (!notifPrefs) return true; // No prefs saved yet → all enabled
    return notifPrefs[category]?.[field] !== false;
  }, [notifPrefs]);

  const unreadCount = notifications.filter(n => !n.is_read && isPrefEnabled(n.category, 'badge')).length;

  // ── Fetch notifications from backend ────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchRef.current(`${API_URL}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);

        // Show toast for any NEW unread notifications we haven't toasted yet
        data.forEach(n => {
          if (!n.is_read && !shownToastIds.current.has(n.id)) {
            shownToastIds.current.add(n.id);
            // Only show toast if the category's toast pref is enabled
            if (isPrefEnabled(n.category, 'toast')) {
              setToasts(prev => [...prev, { ...n, _toastId: `${n.id}-${Date.now()}` }]);
            }
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, [token, isPrefEnabled]);

  // ── Poll for new notifications ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [token, fetchNotifications]);

  // ── Load toast duration + notification prefs from config ────────────────
  useEffect(() => {
    if (!token) return;
    fetchRef.current(`${API_URL}/api/config`)
      .then(r => r.json())
      .then(d => {
        if (d.ui_config?.notification_duration != null) {
          setToastDuration(d.ui_config.notification_duration);
        }
        if (d.ui_config?.notification_prefs) {
          setNotifPrefs(d.ui_config.notification_prefs);
        }
      })
      .catch(() => {});
  }, [token]);

  // ── Auto-dismiss toasts ─────────────────────────────────────────────────
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, toastDuration * 1000);
    return () => clearTimeout(timer);
  }, [toasts, toastDuration]);

  // ── Mark single as read ─────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    try {
      await fetchRef.current(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  }, []);

  // ── Mark all as read ────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    try {
      await fetchRef.current(`${API_URL}/api/notifications/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  }, []);

  // ── Dismiss a toast manually ────────────────────────────────────────────
  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t._toastId !== toastId));
  }, []);

  const value = {
    notifications,
    toasts,
    unreadCount,
    toastDuration,
    setToastDuration,
    centerOpen,
    setCenterOpen,
    showAll,
    setShowAll,
    markAsRead,
    markAllAsRead,
    dismissToast,
    fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
