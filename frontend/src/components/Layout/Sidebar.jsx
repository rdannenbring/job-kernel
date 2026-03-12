import React, { useState } from 'react';
import logoImgDark from '../../assets/jobkernel-logo-dark.png';
import logoImgLight from '../../assets/jobkernel-logo-light.png';

const Sidebar = ({ currentScreen, setScreen, theme, onThemeToggle }) => {
    const [collapsed, setCollapsed] = useState(false);
    
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

    const topMenuItems = [
        { id: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
        { id: 'analytics',  label: 'Analytics',  icon: 'leaderboard' },
    ];

    const bottomMenuItems = [
        { id: 'profile',    label: 'Profile',    icon: 'person' },
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

                {/* Theme Toggle */}
                <div style={{ padding: '0.2rem 0', marginTop: 'auto' }}>
                    <button
                        onClick={onThemeToggle}
                        title={collapsed ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : undefined}
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
                            {isDark ? 'light_mode' : 'dark_mode'}
                        </span>
                        {!collapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
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
            </div>
        </aside>
    );
};

export default Sidebar;
