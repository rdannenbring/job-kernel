import React, { useState } from 'react';

const Sidebar = ({ currentScreen, setScreen }) => {
    const [collapsed, setCollapsed] = useState(false);

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
            background: 'rgba(15, 23, 42, 0.6)',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                            <div style={{ width: '2.2rem', height: '2.2rem', borderRadius: '0.6rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>track_changes</span>
                            </div>
                            <div>
                                <h1 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 800, margin: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>JobTracker Pro</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500, margin: 0, marginTop: '2px', whiteSpace: 'nowrap' }}>Premium SaaS</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div style={{ width: '2.2rem', height: '2.2rem', borderRadius: '0.6rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>track_changes</span>
                        </div>
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
