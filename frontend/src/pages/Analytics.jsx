import React from 'react';

const StatCard = ({ icon, label, value, sub, color }) => (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{label}</div>
            {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
        </div>
    </div>
);

const BarRow = ({ label, value, max, color }) => {
    const pct = Math.round((value / max) * 100);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ width: '110px', fontSize: '0.82rem', color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>{label}</span>
            <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ width: '28px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right' }}>{value}</span>
        </div>
    );
};

const Analytics = () => {
    return (
        <div style={{ padding: '3rem', maxWidth: '1100px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📊 Analytics</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Track your job search performance over time.</p>
            </header>

            {/* Coming Soon Banner */}
            <div style={{ marginBottom: '2.5rem', padding: '1rem 1.5rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🚧</span>
                <div>
                    <strong style={{ color: '#f59e0b' }}>Full analytics coming soon.</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginLeft: '0.5rem' }}>Below is a preview of the metrics we'll be tracking once more data is available.</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                <StatCard icon="📤" label="Applications Sent" value="—" sub="This month" color="#3b82f6" />
                <StatCard icon="💬" label="Responses Received" value="—" sub="All time" color="#10b981" />
                <StatCard icon="📞" label="Interviews Booked" value="—" sub="All time" color="#8b5cf6" />
                <StatCard icon="🎯" label="Response Rate" value="—%" sub="vs industry avg 8%" color="#f59e0b" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* Applications by Status */}
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Applications by Status</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <BarRow label="Applied"      value={0} max={20} color="#3b82f6" />
                        <BarRow label="Reviewing"    value={0} max={20} color="#f59e0b" />
                        <BarRow label="Interview"    value={0} max={20} color="#8b5cf6" />
                        <BarRow label="Offer"        value={0} max={20} color="#10b981" />
                        <BarRow label="Rejected"     value={0} max={20} color="#ef4444" />
                        <BarRow label="Withdrawn"    value={0} max={20} color="#6b7280" />
                    </div>
                </div>

                {/* Activity Timeline placeholder */}
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Weekly Activity</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', gap: '6px', padding: '0 0.5rem' }}>
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                            <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                                <div style={{ width: '100%', height: '0px', background: 'rgba(59,130,246,0.4)', borderRadius: '4px 4px 0 0', minHeight: '4px', border: '1px dashed rgba(255,255,255,0.08)' }} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{day}</span>
                            </div>
                        ))}
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>No activity yet — start applying to see trends here.</p>
                </div>
            </div>

            {/* Top Companies / Roles table placeholder */}
            <div className="card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Recent Applications</h3>
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                    No applications yet. Add your first application to start tracking your job search journey.
                </div>
            </div>
        </div>
    );
};

export default Analytics;
