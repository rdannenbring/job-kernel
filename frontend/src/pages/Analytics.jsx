import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_META = {
  saved:        { label: 'Saved',        icon: 'bookmark',      color: '#6b7280' },
  generated:    { label: 'Generated',    icon: 'auto_awesome',  color: '#3b82f6' },
  applied:      { label: 'Applied',      icon: 'send',          color: '#06b6d4' },
  interviewing: { label: 'Interviewing', icon: 'groups',        color: '#8b5cf6' },
  decision:     { label: 'Decision',     icon: 'gavel',         color: '#f59e0b' },
  accepted:     { label: 'Accepted',     icon: 'stars',         color: '#10b981' },
  rejected:     { label: 'Rejected',     icon: 'cancel',        color: '#ef4444' },
  declined:     { label: 'Declined',     icon: 'undo',          color: '#ec4899' },
};

const INTEREST_META = {
  'High':    { color: '#10b981', icon: 'thumb_up' },
  'Medium':  { color: '#f59e0b', icon: 'thumbs_up_down' },
  'Low':     { color: '#6b7280', icon: 'thumb_down' },
  'Not Set': { color: '#374151', icon: 'help_outline' },
};

const JOB_TYPE_META = {
  'Full-time': { color: '#3b82f6', icon: 'work' },
  'Part-time': { color: '#8b5cf6', icon: 'work_history' },
  'Contract':  { color: '#f59e0b', icon: 'assignment' },
  'Internship':{ color: '#10b981', icon: 'school' },
  'Not Set':   { color: '#374151', icon: 'help_outline' },
};

const LOC_TYPE_META = {
  'Remote':  { color: '#10b981', icon: 'home_work' },
  'Hybrid':  { color: '#f59e0b', icon: 'sync_alt' },
  'On-site': { color: '#3b82f6', icon: 'location_on' },
  'Not Set': { color: '#374151', icon: 'help_outline' },
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function relativeDate(iso) {
  if (!iso) return '—';
  try {
    // Compare calendar dates (ignoring time) to avoid timezone-induced off-by-one
    const saved = new Date(iso);
    const today = new Date();
    const savedDay = new Date(saved.getFullYear(), saved.getMonth(), saved.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.round((todayDay - savedDay) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7)  return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return formatDate(iso);
  } catch { return iso; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color, loading, onClick }) => (
  <div 
    className={`stat-card card ${onClick && value !== 0 && value !== '—' && !loading ? 'clickable' : ''}`}
    onClick={() => { if (onClick && value !== 0 && value !== '—' && !loading) onClick(); }}
  >
    <div className="stat-icon" style={{ background: `${color}22`, color }}>
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <div className="stat-content">
      <div className="stat-value">
        {loading ? <span>—</span> : value}
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
    <div className="stat-stripe" style={{ background: color }} />
  </div>
);

const BarRow = ({ icon, label, value, max, color, pct: forcedPct, onClick }) => {
  const pct = forcedPct !== undefined ? forcedPct : (max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div 
      style={{ 
        display: 'flex', alignItems: 'center', gap: '1rem',
        cursor: onClick && value > 0 ? 'pointer' : 'default',
        padding: onClick ? '0.25rem 0.5rem' : '0',
        margin: onClick ? '-0.25rem -0.5rem' : '0',
        borderRadius: onClick ? '6px' : '0',
        transition: 'background 0.15s'
      }}
      onClick={() => { if (onClick && value > 0) onClick(); }}
      onMouseEnter={e => { if (onClick && value > 0) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (onClick && value > 0) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: '130px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end', pointerEvents: 'none' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color, opacity: 0.9 }}>{icon}</span>
        {label}
      </div>
      <div style={{ flex: 1, height: '9px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: '99px', transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
      <span style={{ width: '30px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
};

const StageBadge = ({ stage }) => {
  const meta = STAGE_META[stage?.toLowerCase()] || STAGE_META.saved;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.55rem', borderRadius: '99px',
      background: `${meta.color}18`, color: meta.color,
      fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>{meta.icon}</span>
      {meta.label}
    </span>
  );
};

const ScorePill = ({ score }) => {
  if (score == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.5rem',
      borderRadius: '99px', background: `${color}18`, color,
      fontSize: '0.78rem', fontWeight: 700,
    }}>{score}%</span>
  );
};

// Heat-map style 8-week activity calendar
const ActivityHeatmap = ({ data }) => {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getColor = (count) => {
    if (count === 0) return 'rgba(255,255,255,0.04)';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'rgba(59,130,246,0.25)';
    if (intensity < 0.5)  return 'rgba(59,130,246,0.5)';
    if (intensity < 0.75) return 'rgba(59,130,246,0.75)';
    return '#3b82f6';
  };

  // Group 56 days into 8 columns of 7 days
  const weeks = [];
  for (let w = 0; w < 8; w++) {
    weeks.push(data.slice(w * 7, w * 7 + 7));
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '2px' }}>
          {dayLabels.map(d => (
            <div key={d} style={{ height: '18px', fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{d}</div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                style={{
                  height: '18px',
                  borderRadius: '3px',
                  background: getColor(day.count),
                  transition: 'background 0.3s',
                  cursor: day.count > 0 ? 'default' : 'default',
                }}
              />
            ))}
            {/* Week start label */}
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>
              {week[0]?.date ? new Date(week[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: getColor(v * maxCount + (v > 0 ? 0.01 : 0)) }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Analytics = ({ setScreen }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const navigateToDashboard = (filters) => {
    if (!setScreen) return;
    try {
      const raw = sessionStorage.getItem('dashboard_state');
      const currentState = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem('dashboard_state', JSON.stringify({
        ...currentState,
        ...filters
      }));
      setScreen('dashboard');
    } catch(e) {
      console.error('Failed to set dashboard state', e);
    }
  };

  const handleStageClick = (stage) => {
    let filterVal = STAGE_META[stage]?.label;
    if (stage === 'decision') filterVal = 'Offered';
    navigateToDashboard({ filterStatuses: filterVal ? [filterVal] : [] });
  };

  const handleInterestClick = (label) => {
    navigateToDashboard({ filterInterestLevels: label === 'Not Set' ? [''] : [label] });
  };

  const handleJobTypeClick = (label) => {
    navigateToDashboard({ filterJobTypes: label === 'Not Set' ? [''] : [label] });
  };

  const handleLocTypeClick = (label) => {
    navigateToDashboard({ filterLocationTypes: label === 'Not Set' ? [''] : [label] });
  };

  const handleCompanyClick = (company) => {
    navigateToDashboard({ searchTerm: company });
  };

  const handleNetworkingClick = () => {
    navigateToDashboard({ filterHasConnections: true });
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const total = data?.total_applications ?? 0;

  // Pipeline stages — in display order
  const stageOrder = ['saved', 'generated', 'applied', 'interviewing', 'decision', 'accepted', 'rejected', 'declined'];
  const stageData = stageOrder.map(s => ({
    stage: s,
    ...STAGE_META[s],
    count: data?.pipeline_stages?.[s] ?? 0,
  }));
  const maxStage = Math.max(...stageData.map(s => s.count), 1);

  // Interest levels
  const interestOrder = ['High', 'Medium', 'Low', 'Not Set'];
  const interestData = interestOrder.map(k => ({
    label: k,
    count: data?.interest_levels?.[k] ?? 0,
    ...(INTEREST_META[k] || { color: '#6b7280', icon: 'help_outline' }),
  }));
  const maxInterest = Math.max(...interestData.map(d => d.count), 1);

  // Job types
  const jobTypeKeys = data?.job_types ? Object.keys(data.job_types) : [];
  const jobTypeData = jobTypeKeys.map(k => ({
    label: k,
    count: data.job_types[k],
    ...(JOB_TYPE_META[k] || { color: '#6b7280', icon: 'work' }),
  })).sort((a, b) => b.count - a.count);
  const maxJobType = Math.max(...jobTypeData.map(d => d.count), 1);

  // Location types
  const locTypeKeys = data?.location_types ? Object.keys(data.location_types) : [];
  const locTypeData = locTypeKeys.map(k => ({
    label: k,
    count: data.location_types[k],
    ...(LOC_TYPE_META[k] || { color: '#6b7280', icon: 'location_on' }),
  })).sort((a, b) => b.count - a.count);
  const maxLocType = Math.max(...locTypeData.map(d => d.count), 1);

  // Pipeline summary numbers for stat cards
  const applied = (data?.pipeline_stages?.applied ?? 0)
    + (data?.pipeline_stages?.interviewing ?? 0)
    + (data?.pipeline_stages?.decision ?? 0)
    + (data?.pipeline_stages?.accepted ?? 0)
    + (data?.pipeline_stages?.rejected ?? 0)
    + (data?.pipeline_stages?.declined ?? 0);
  const interviewing = data?.pipeline_stages?.interviewing ?? 0;
  const accepted = data?.pipeline_stages?.accepted ?? 0;

  // Weekly activity total
  const weeklyTotal = data?.weekly_activity?.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <div style={{ padding: '2.5rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--primary)' }}>leaderboard</span>
            Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Track your job search performance and identify trends.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          {lastRefresh && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            id="analytics-refresh-btn"
            onClick={fetchAnalytics}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', animation: loading ? 'spin 1s linear infinite' : 'none' }}>refresh</span>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '0.9rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#ef4444', fontSize: '0.88rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>error</span>
          Failed to load analytics: {error}. Is the backend running?
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="stat-grid">
        <StatCard
          icon="layers"
          label="Total Applications"
          value={total}
          sub="Active (non-archived)"
          color="#3b82f6"
          loading={loading}
          onClick={() => navigateToDashboard({ filterStatuses: [], filterJobTypes: [], filterLocationTypes: [], filterInterestLevels: [], searchTerm: '' })}
        />
        <StatCard
          icon="send"
          label="Submitted"
          value={applied}
          sub={total > 0 ? `${Math.round((applied / total) * 100)}% of tracked` : 'All stages after applied'}
          color="#06b6d4"
          loading={loading}
          onClick={() => navigateToDashboard({ filterStatuses: ['Applied', 'Interviewing', 'Offered', 'Accepted', 'Rejected'] })}
        />
        <StatCard
          icon="groups"
          label="Interviewing"
          value={interviewing}
          sub={applied > 0 ? `${Math.round((interviewing / applied) * 100)}% interview rate` : 'Active interviews'}
          color="#8b5cf6"
          loading={loading}
          onClick={() => handleStageClick('interviewing')}
        />
        <StatCard
          icon="auto_awesome"
          label="Avg Match Score"
          value={data?.avg_match_score != null ? `${data.avg_match_score}%` : '—'}
          sub={data?.scores_count ? `From ${data.scores_count} scored application${data.scores_count !== 1 ? 's' : ''}` : 'No scored applications yet'}
          color="#f59e0b"
          loading={loading}
        />
        <StatCard
          icon="group"
          label="LinkedIn Network"
          value={data?.linkedin_stats?.total_connections ?? 0}
          sub={`${data?.linkedin_stats?.apps_with_connections ?? 0} jobs have connections (${data?.linkedin_stats?.percentage_with_connections ?? 0}%)`}
          color="#10b981"
          loading={loading}
          onClick={() => handleNetworkingClick()}
        />
      </div>

      {/* ── Two column: pipeline stages + activity heatmap ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Pipeline by Stage */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>account_tree</span>
            Applications by Pipeline Stage
          </h3>
          {total === 0 && !loading ? (
            <EmptyState message="Add your first application to see the pipeline breakdown." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {stageData.map(s => (
                <BarRow
                  key={s.stage}
                  icon={s.icon}
                  label={s.label}
                  value={s.count}
                  max={maxStage}
                  color={s.color}
                  onClick={() => handleStageClick(s.stage)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity Heatmap */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>calendar_month</span>
            Activity (Last 8 Weeks)
            {weeklyTotal > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {weeklyTotal} application{weeklyTotal !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          {!loading && data?.weekly_activity ? (
            weeklyTotal === 0 ? (
              <EmptyState message="No applications added in the last 8 weeks." />
            ) : (
              <ActivityHeatmap data={data.weekly_activity} />
            )
          ) : (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Three column: interest, job type, location ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Interest Level */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>favorite</span>
            Interest Level
          </h3>
          {total === 0 && !loading ? (
            <EmptyState message="No applications yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {interestData.map(d => (
                <BarRow key={d.label} icon={d.icon} label={d.label} value={d.count} max={maxInterest} color={d.color} onClick={() => handleInterestClick(d.label)} />
              ))}
            </div>
          )}
        </div>

        {/* Job Type */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>work</span>
            Job Type
          </h3>
          {jobTypeData.length === 0 && !loading ? (
            <EmptyState message="No job type data yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {jobTypeData.map(d => (
                <BarRow key={d.label} icon={d.icon} label={d.label} value={d.count} max={maxJobType} color={d.color} onClick={() => handleJobTypeClick(d.label)} />
              ))}
            </div>
          )}
        </div>

        {/* Location Type */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>location_on</span>
            Location Type
          </h3>
          {locTypeData.length === 0 && !loading ? (
            <EmptyState message="No location type data yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {locTypeData.map(d => (
                <BarRow key={d.label} icon={d.icon} label={d.label} value={d.count} max={maxLocType} color={d.color} onClick={() => handleLocTypeClick(d.label)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Companies ── */}
      {data?.top_companies?.length > 1 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>business</span>
            Applications by Company
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {data.top_companies.map((c, i) => (
              <BarRow
                key={c.company}
                icon={i === 0 ? 'trophy' : 'business'}
                label={c.company}
                value={c.count}
                max={data.top_companies[0].count}
                color={i === 0 ? '#f59e0b' : '#3b82f6'}
                onClick={() => handleCompanyClick(c.company)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Networking Insights ── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#10b981', opacity: 0.8 }}>group</span>
          Networking Coverage
        </h3>
        {loading ? (
           <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>Loading networking stats...</div>
        ) : !data?.linkedin_stats?.distribution ? (
          <EmptyState message="No LinkedIn matching data yet." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
            {[
              { label: '0 Connections', key: '0', color: '#6b7280' },
              { label: '1 Connection',  key: '1', color: '#3b82f6' },
              { label: '2-5 Connections', key: '2-5', color: '#8b5cf6' },
              { label: '5+ Connections',  key: '5+', color: '#10b981' },
            ].map(range => {
               let count = 0;
               const dist = data.linkedin_stats.distribution;
               if (range.key === '0') count = dist['0'] || 0;
               else if (range.key === '1') count = dist['1'] || 0;
               else if (range.key === '2-5') {
                 for (let i = 2; i <= 5; i++) count += dist[i] || 0;
               } else {
                 Object.keys(dist).forEach(k => { if (parseInt(k) > 5) count += dist[k]; });
               }
               
               return (
                 <div 
                   key={range.key} 
                   style={{ 
                     textAlign: 'center',
                     cursor: count > 0 && range.key !== '0' ? 'pointer' : 'default',
                     transition: 'transform 0.15s, opacity 0.15s',
                     opacity: count > 0 ? 1 : 0.5
                   }}
                   onClick={() => {
                     if (count > 0 && range.key !== '0') handleNetworkingClick();
                   }}
                   onMouseEnter={e => { if (count > 0 && range.key !== '0') e.currentTarget.style.transform = 'translateY(-2px)'; }}
                   onMouseLeave={e => { if (count > 0 && range.key !== '0') e.currentTarget.style.transform = 'none'; }}
                 >
                   <div style={{ fontSize: '1.5rem', fontWeight: 800, color: range.color }}>{count}</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.2rem' }}>{range.label}</div>
                   <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.6rem', overflow: 'hidden' }}>
                      <div style={{ width: `${total > 0 ? (count/total)*100 : 0}%`, height: '100%', background: range.color }} />
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Applications Table ── */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.8 }}>history</span>
          Recent Applications
          {data?.recent_applications?.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              Showing last {data.recent_applications.length}
            </span>
          )}
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !data?.recent_applications?.length ? (
          <EmptyState icon="inbox" message="No applications yet. Add your first application to start tracking your job search." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Role', 'Company', 'Saved', 'Stage', 'Interest', 'Network', 'Score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_applications.map((app, i) => (
                  <tr
                    key={app.id}
                    style={{
                      borderBottom: i < data.recent_applications.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.job_title || '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {app.company_logo ? (
                          <img src={app.company_logo} alt="" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', background: 'rgba(255,255,255,0.08)' }} />
                        ) : (
                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>business</span>
                          </div>
                        )}
                        {app.company || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {relativeDate(app.date_saved)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <StageBadge stage={app.pipeline_stage} />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      {app.interest_level ? (
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600,
                          color: (INTEREST_META[app.interest_level] || INTEREST_META['Not Set']).color,
                        }}>
                          {app.interest_level}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      {app.connection_count > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>group</span>
                          {app.connection_count}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <ScorePill score={app.match_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* global styles & responsive tweaks */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.1rem;
          margin-bottom: 1.75rem;
        }

        .stat-card {
          display: flex !important;
          flex-direction: row;
          align-items: center;
          gap: 1.25rem;
          position: relative;
          overflow: hidden;
          padding: 1.25rem;
          height: 100%;
          transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .stat-card.clickable {
          cursor: pointer;
        }
        .stat-card.clickable:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon span {
           font-size: 1.5rem;
        }

        .stat-content {
          min-width: 0; 
          flex: 1;
        }

        .stat-value {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 0.1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-stripe {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          border-radius: 4px 0 0 4px;
        }

        @media (max-width: 1400px) {
          .stat-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          }
        }

        @media (max-width: 1000px) {
          .stat-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.75rem !important;
          }
          .stat-icon {
            width: 40px;
            height: 40px;
          }
          .stat-value {
            font-size: 1.6rem;
          }
        }

        @media (max-width: 600px) {
          .stat-grid {
            grid-template-columns: 1fr;
          }
          .stat-icon {
            display: none !important;
          }
          .stat-card {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

const EmptyState = ({ icon = 'inbox', message }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
    <div style={{ marginBottom: '0.5rem' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.25 }}>{icon}</span>
    </div>
    {message}
  </div>
);

export default Analytics;
