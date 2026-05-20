import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';

/**
 * NotificationCenter — a slide-out panel showing all notifications.
 * Mounted in the sidebar area; controlled by the bell icon button.
 */

const ICON_MAP = {
  success: { icon: 'check_circle', color: '#22c55e' },
  info:    { icon: 'info',         color: '#3b82f6' },
  warning: { icon: 'warning',      color: '#f59e0b' },
  error:   { icon: 'error',        color: '#ef4444' },
  action:  { icon: 'touch_app',    color: '#8b5cf6' },
  update:  { icon: 'sync',         color: '#06b6d4' },
};

const NotificationCenter = ({ onNavigate }) => {
  const {
    notifications, unreadCount, centerOpen, setCenterOpen,
    showAll, setShowAll, markAsRead, markAllAsRead,
  } = useNotifications();

  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!centerOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Don't close if they clicked the bell button (that toggles it)
        if (e.target.closest('[data-notification-bell]')) return;
        setCenterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [centerOpen, setCenterOpen]);

  if (!centerOpen) return null;

  const filteredNotifications = showAll ? notifications : notifications.filter(n => !n.is_read);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  };

  const handleItemClick = (n) => {
    markAsRead(n.id);
    if (n.link_screen && onNavigate) {
      onNavigate(n.link_screen, n.link_app_id ? parseInt(n.link_app_id) : null, n.link_anchor || null);
      setCenterOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setCenterOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed', top: 0, left: '68px', bottom: 0,
          width: '380px', maxWidth: 'calc(100vw - 80px)',
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)',
          zIndex: 8001, display: 'flex', flexDirection: 'column',
          boxShadow: '8px 0 32px rgba(0,0,0,0.25)',
          animation: 'slideRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>
                notifications
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 900, background: 'var(--primary)',
                  color: 'white', borderRadius: '99px', padding: '0.1rem 0.45rem',
                  minWidth: '1.1rem', textAlign: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setCenterOpen(false)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
            </button>
          </div>

          {/* Filter toggle + Mark all */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              display: 'flex', gap: '0.25rem', padding: '0.2rem',
              background: 'var(--bg-tertiary)', borderRadius: '0.5rem',
            }}>
              {[
                { key: false, label: 'Unread' },
                { key: true, label: 'All' },
              ].map(tab => (
                <button
                  key={String(tab.key)}
                  onClick={() => setShowAll(tab.key)}
                  style={{
                    padding: '0.3rem 0.75rem', borderRadius: '0.4rem', border: 'none',
                    cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                    background: showAll === tab.key ? 'var(--primary)' : 'transparent',
                    color: showAll === tab.key ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                  done_all
                </span>
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '0.75rem',
              color: 'var(--text-muted)', padding: '2rem',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>
                notifications_off
              </span>
              <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
                {showAll ? 'No notifications yet.' : 'All caught up! No unread notifications.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(n => {
              const { icon, color } = ICON_MAP[n.category] || ICON_MAP.info;
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    display: 'flex', gap: '0.75rem', padding: '0.875rem 0.75rem',
                    borderRadius: '0.75rem', cursor: n.link_screen ? 'pointer' : 'default',
                    background: n.is_read ? 'transparent' : `${color}08`,
                    borderLeft: n.is_read ? '3px solid transparent' : `3px solid ${color}`,
                    transition: 'background 0.15s',
                    marginBottom: '0.25rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : `${color}08`}
                >
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '0.5rem', flexShrink: 0,
                    background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: '1.1rem', color, fontVariationSettings: "'FILL' 1",
                    }}>{icon}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '0.15rem',
                    }}>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: n.is_read ? 600 : 800,
                        color: 'var(--text-primary)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.title}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', color: 'var(--text-muted)',
                        flexShrink: 0, marginLeft: '0.5rem',
                      }}>
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)',
                      lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {n.message}
                    </p>
                    {n.link_screen && (
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, color,
                        marginTop: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>arrow_forward</span>
                        View
                      </span>
                    )}
                  </div>

                  {!n.is_read && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: color, flexShrink: 0, marginTop: '0.3rem',
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
