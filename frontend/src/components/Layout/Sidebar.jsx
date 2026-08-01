import React, { useState } from 'react';
import logoImgDark from '../../assets/jobkernel-logo-dark.png';
import logoImgLight from '../../assets/jobkernel-logo-light.png';
import { useNotifications } from '../../context/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const Sidebar = ({ currentScreen, setScreen, theme, onThemeToggle, user, onLogout, onCollapsedChange, forceCollapsed }) => {
    const [collapsed, setCollapsedState] = useState(false);

    const setCollapsed = (val) => {
        setCollapsedState(val);
        if (onCollapsedChange) onCollapsedChange(val);
    };

    // Auto-collapse when the shell requests it (e.g. Discover detail pane open)
    React.useEffect(() => {
        if (forceCollapsed) setCollapsed(true);
    }, [forceCollapsed]);
    const { unreadCount, centerOpen, setCenterOpen } = useNotifications();
    
    // Auto-collapse based on window width
    React.useEffect(() => {
        const handleResize = () => {
            const threshold = (currentScreen === 'detail' || currentScreen === 'lifecycle') ? 1400 : 1025;
            if (window.innerWidth < threshold) {
                setCollapsed(true);
            }
        };
        handleResize(); // Initial check and check on screen change
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [currentScreen]);

    // Derived active theme for icon state
    const [activeTheme, setActiveTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

    // Keep activeTheme in sync with DOM (which App.jsx controls)
    React.useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    setActiveTheme(document.documentElement.getAttribute('data-theme'));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const isDark = activeTheme === 'dark';

    const getThemeDisplay = () => {
        if (theme === 'dark') return { icon: 'dark_mode', label: 'Dark Theme' };
        if (theme === 'light') return { icon: 'light_mode', label: 'Light Theme' };
        return { icon: 'settings_brightness', label: 'System Theme' };
    };
    const { icon: themeIcon, label: themeLabel } = getThemeDisplay();

    const topMenuItems = [
        { id: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
        { id: 'discover',   label: 'Discover',   icon: 'travel_explore' },
        { id: 'profile',    label: 'Profile',    icon: 'person' },
        { id: 'analytics',  label: 'Analytics',  icon: 'leaderboard' },
    ];

    const bottomMenuItems = [
        ...(user?.is_admin ? [{ id: 'admin', label: 'Admin', icon: 'admin_panel_settings' }] : []),
        { id: 'settings',   label: 'Settings',   icon: 'settings' },
    ];

    const W = collapsed ? '68px' : '240px';

    return (
        <aside style={{
            width: W,
            minWidth: W,
            background: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--bg-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            flexShrink: 0,
            transition: 'width 0.25s ease, min-width 0.25s ease',
            overflow: 'hidden',
        }}>
            <div style={{ padding: collapsed ? '1.25rem 0.85rem' : '1.25rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', transition: 'padding 0.25s ease' }}>

                {/* Logo + collapse toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', justifyContent: collapsed ? 'center' : 'space-between' }}>
                    <div 
                        onClick={() => setScreen('dashboard')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}
                    >
                        {!collapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                <img src={logoImgDark} alt="JobKernel logo" className="logo-dark" style={{ width: '2.4rem', height: '2.4rem', objectFit: 'contain', flexShrink: 0 }} />
                                <img src={logoImgLight} alt="JobKernel logo" className="logo-light" style={{ width: '2.4rem', height: '2.4rem', objectFit: 'contain', flexShrink: 0 }} />
                                <h1 style={{ margin: 0, lineHeight: 1, whiteSpace: 'nowrap', fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em', fontSize: '1.05rem' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-brand)' }}>Job</span><span style={{ fontWeight: 400, color: '#5BA4B5' }}>Kernel</span>
                                </h1>
                            </div>
                        )}
                        {collapsed && (
                            <>
                                <img src={logoImgDark} alt="JobKernel logo" className="logo-dark" style={{ width: '2.2rem', height: '2.2rem', objectFit: 'contain' }} />
                                <img src={logoImgLight} alt="JobKernel logo" className="logo-light" style={{ width: '2.2rem', height: '2.2rem', objectFit: 'contain' }} />
                            </>
                        )}
                    </div>
                    {!collapsed && (
                        <button onClick={() => setCollapsed(true)} title="Collapse sidebar" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
                        </button>
                    )}
                </div>

                {/* Expand button when collapsed */}
                {collapsed && (
                    <button onClick={() => setCollapsed(false)} title="Expand sidebar" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '7px', padding: '5px', margin: '-0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
                    </button>
                )}

                {/* New Application CTA */}
                <button
                    onClick={() => setScreen('new_app')}
                    title={collapsed ? 'New Application' : undefined}
                    style={{
                        width: '100%',
                        background: 'var(--primary)',
                        color: 'white',
                        fontWeight: 700,
                        padding: collapsed ? '0.65rem' : '0.65rem 1rem',
                        borderRadius: '0.65rem',
                        boxShadow: 'var(--shadow-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', flexShrink: 0 }}>add</span>
                    {!collapsed && <span>New Application</span>}
                </button>

                {/* Nav Items */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    {topMenuItems.map(item => {
                        const isActive = currentScreen === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setScreen(item.id)}
                                title={collapsed ? item.label : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    padding: collapsed ? '0.6rem' : '0.6rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    background: isActive ? 'rgba(37,106,244,0.12)' : 'transparent',
                                    color: isActive ? 'var(--primary-light)' : 'var(--text-secondary)',
                                    border: isActive ? '1px solid rgba(37,106,244,0.2)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    width: '100%',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
                                {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Notification Bell */}
                <button
                    data-notification-bell
                    onClick={() => setCenterOpen(!centerOpen)}
                    title={collapsed ? `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}` : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: collapsed ? '0.6rem' : '0.6rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: centerOpen ? 'rgba(37,106,244,0.12)' : 'transparent',
                        color: centerOpen ? 'var(--primary-light)' : 'var(--text-secondary)',
                        border: centerOpen ? '1px solid rgba(37,106,244,0.2)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        width: '100%',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                    }}
                    onMouseEnter={e => { if (!centerOpen) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseLeave={e => { if (!centerOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                >
                    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-6px',
                                minWidth: '16px', height: '16px', borderRadius: '99px',
                                background: '#ef4444', color: 'white',
                                fontSize: '0.55rem', fontWeight: 900,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 3px', border: '2px solid var(--bg-sidebar)',
                                animation: 'pulse 2s infinite',
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </span>
                    {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Notifications</span>}
                    {!collapsed && unreadCount > 0 && (
                        <span style={{
                            marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800,
                            background: '#ef4444', color: 'white', borderRadius: '99px',
                            padding: '0.1rem 0.4rem', minWidth: '1rem', textAlign: 'center',
                        }}>
                            {unreadCount}
                        </span>
                    )}
                </button>

                {/* Theme Toggle */}
                <div style={{ padding: '0.2rem 0', marginTop: 'auto' }}>
                    <button
                        onClick={onThemeToggle}
                        title={collapsed ? themeLabel : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: collapsed ? '0.6rem' : '0.6rem 0.75rem',
                            borderRadius: '0.5rem',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            width: '100%',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>
                            {themeIcon}
                        </span>
                        {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{themeLabel}</span>}
                    </button>
                </div>

                {/* Bottom Nav Items */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {bottomMenuItems.map(item => {
                        const isActive = currentScreen === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setScreen(item.id)}
                                title={collapsed ? item.label : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    padding: collapsed ? '0.6rem' : '0.6rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    background: isActive ? 'rgba(37,106,244,0.12)' : 'transparent',
                                    color: isActive ? 'var(--primary-light)' : 'var(--text-secondary)',
                                    border: isActive ? '1px solid rgba(37,106,244,0.2)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    width: '100%',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
                                {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div style={{ 
                    marginTop: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <button
                        onClick={() => setScreen('account')}
                        title="My Account"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            background: currentScreen === 'account' ? 'rgba(37,106,244,0.12)' : 'transparent',
                            border: currentScreen === 'account' ? '1px solid rgba(37,106,244,0.2)' : '1px solid transparent',
                            cursor: 'pointer', width: '100%', transition: 'all 0.15s', textAlign: 'left'
                        }}
                        onMouseEnter={e => { if (currentScreen !== 'account') { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.border = '1px solid transparent'; } }}
                        onMouseLeave={e => { if (currentScreen !== 'account') { e.currentTarget.style.background = 'transparent'; } }}
                    >
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--primary)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                            overflow: 'hidden', position: 'relative'
                        }}>
                            {user?.photo_url ? (
                                <img
                                    src={user.photo_url.startsWith('http') ? user.photo_url : `${API_URL}${user.photo_url}`}
                                    alt="Avatar"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        transform: `scale(${user.photo_zoom || 1.0}) translate(${user.photo_x || 0}px, ${user.photo_y || 0}px)`,
                                        transformOrigin: 'center center',
                                    }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : null}
                            {(!user?.photo_url) && (user?.username?.charAt(0).toUpperCase() || 'U')}
                        </div>
                        {!collapsed && (
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.is_admin ? 'Administrator' : 'User'}</div>
                            </div>
                        )}
                    </button>
                    
                    <button
                        onClick={onLogout}
                        title={collapsed ? "Logout" : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: collapsed ? '0.6rem' : '0.6rem 0.75rem',
                            borderRadius: '0.5rem',
                            background: 'transparent',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            width: '100%',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>logout</span>
                        {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Logout</span>}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
