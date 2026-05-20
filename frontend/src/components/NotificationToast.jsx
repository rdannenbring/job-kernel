import React from 'react';
import { useNotifications } from '../context/NotificationContext';

/**
 * NotificationToast — renders floating toast alerts in the bottom-right corner.
 * This component is mounted once at the App level so toasts appear on every screen.
 */
const ICON_MAP = {
  success: { icon: 'check_circle', color: '#22c55e' },
  info:    { icon: 'info',         color: '#3b82f6' },
  warning: { icon: 'warning',      color: '#f59e0b' },
  error:   { icon: 'error',        color: '#ef4444' },
  action:  { icon: 'touch_app',    color: '#8b5cf6' },
  update:  { icon: 'sync',         color: '#06b6d4' },
};

const NotificationToast = ({ onNavigate }) => {
  const { toasts, dismissToast, markAsRead } = useNotifications();

  if (toasts.length === 0) return null;

  const handleClick = (toast) => {
    markAsRead(toast.id);
    dismissToast(toast._toastId);
    if (toast.link_screen && onNavigate) {
      onNavigate(toast.link_screen, toast.link_app_id ? parseInt(toast.link_app_id) : null, toast.link_anchor || null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '0.75rem',
      zIndex: 9999,
      pointerEvents: 'none',
      maxWidth: '420px',
      width: '100%',
    }}>
      {toasts.slice(0, 4).map((toast, index) => {
        const { icon, color } = ICON_MAP[toast.category] || ICON_MAP.info;
        return (
          <div
            key={toast._toastId}
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg-secondary)',
              border: `1px solid ${color}30`,
              borderLeft: `4px solid ${color}`,
              borderRadius: '0.875rem',
              padding: '1rem 1.25rem',
              boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(16px)',
              animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: toast.link_screen ? 'pointer' : 'default',
              transition: 'transform 0.2s, opacity 0.2s',
              display: 'flex',
              gap: '0.875rem',
              alignItems: 'flex-start',
              opacity: 1 - (index * 0.15),
            }}
            onClick={() => handleClick(toast)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
          >
            {/* Icon */}
            <div style={{
              width: '2.25rem', height: '2.25rem', borderRadius: '0.6rem', flexShrink: 0,
              background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '1.25rem', color, fontVariationSettings: "'FILL' 1",
              }}>{icon}</span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)',
                marginBottom: '0.2rem', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {toast.title}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {toast.message}
              </div>
              {toast.link_screen && (
                <div style={{
                  marginTop: '0.5rem', fontSize: '0.65rem', fontWeight: 700,
                  color, display: 'flex', alignItems: 'center', gap: '0.3rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>arrow_forward</span>
                  View Details
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast(toast._toastId); }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '2px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', flexShrink: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToast;
