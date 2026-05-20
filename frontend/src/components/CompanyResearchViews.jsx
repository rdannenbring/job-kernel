// Company Research sub-views: Overview, Detailed, Financials, Competitors, Career Matches
// All views now consume the `research` prop (AI-generated JSON).
import { useState } from 'react';

const S = {
  card: { background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', padding: '1.5rem' },
  label: { fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '0.4rem' },
  kpi: { fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 },
  kpiSub: { fontSize: '0.7rem', fontWeight: 600, marginTop: '0.25rem' },
};

// ── Skeleton shimmer loader ────────────────────────────────────────────────────
export function ResearchSectionSkeleton({ lines = 4, height = 180 }) {
  return (
    <div style={{ ...S.card, padding: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="skeleton-shimmer" style={{ height: '12px', width: '40%', borderRadius: '6px' }} />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: '10px', width: `${75 + Math.random() * 20}%`, borderRadius: '6px', opacity: 1 - i * 0.15 }} />
        ))}
        <div className="skeleton-shimmer" style={{ height: height + 'px', borderRadius: '0.75rem', marginTop: '0.5rem' }} />
      </div>
    </div>
  );
}

// ── Company Overview ─────────────────────────────────────────────────────────
export function CompanyOverviewView({ research, app }) {
  const ov = research?.overview || {};
  const co = app?.company || 'Target Company';

  const stats = [
    { label: 'Employees', val: ov.employee_count || '—', icon: 'group', color: '#60a5fa' },
    { label: 'Founded', val: ov.founded || '—', icon: 'calendar_today', color: '#34d399' },
    { label: 'HQ', val: ov.headquarters || '—', icon: 'location_city', color: '#a78bfa' },
    { label: 'Stage', val: ov.public_private || '—', icon: 'show_chart', color: '#fb923c' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Mission card */}
      <div style={{ ...S.card, background: 'linear-gradient(135deg, rgba(37,106,244,0.12), var(--glass-bg))', borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={S.label}>Mission</div>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.55, maxWidth: '560px' }}>
            "{ov.mission || `${co} is a leading company in its industry.`}"
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {ov.industry && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(37,106,244,0.12)', border: '1px solid rgba(37,106,244,0.2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>work</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ov.industry}</span>
              </div>
            )}
            {ov.careers_url && (
              <a href={ov.careers_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#34d399' }}>launch</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Careers Page</span>
              </a>
            )}
          </div>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.08, flexShrink: 0 }}>format_quote</span>
      </div>

      {/* Stats row */}
      <div className="research-stats-grid">
        {stats.map(s => (
          <div key={s.label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '1.2rem' }}>{s.icon}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={S.label}>{s.label}</div>
              <div style={{ ...S.kpi, fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, overflowWrap: 'break-word' }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Core Values + Glassdoor */}
      <div className="research-two-col">
        <div style={S.card}>
          <div style={{ ...S.label, color: 'var(--primary)', marginBottom: '1rem' }}>Core Values</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {(ov.core_values || ['Innovation', 'Integrity', 'Collaboration']).map(v => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1rem' }}>diamond</span>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          {ov.glassdoor_rating ? (
            <>
              <div style={{ ...S.label, marginBottom: '0.5rem' }}>Glassdoor Rating</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{ov.glassdoor_rating}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>out of 5.0</div>
            </>
          ) : (
            <>
              <div style={{ ...S.label, marginBottom: '0.5rem' }}>Ticker</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{ov.ticker || 'N/A'}</div>
            </>
          )}
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={S.label}>Business Model</div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ov.business_model || '—'}</p>
          </div>
        </div>
      </div>

      {/* Leadership */}
      {ov.leadership && ov.leadership.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '1rem' }}>Leadership Team</div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {ov.leadership.map(l => (
              <div key={l.title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(37,106,244,0.12)', border: '2px solid rgba(37,106,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>person</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-primary)' }}>{l.title}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{l.name || 'Unknown'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detailed Research ────────────────────────────────────────────────────────
export function DetailedResearchView({ research, app }) {
  const dt = research?.detailed || {};
  const co = app?.company || 'Target Company';

  const sentimentColor = (s) => {
    if (s === 'positive') return '#22c55e';
    if (s === 'negative') return '#f87171';
    return 'var(--primary)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Market position + culture */}
      <div className="research-equal-col">
        <div style={S.card}>
          <div style={{ ...S.label, color: 'var(--primary)', marginBottom: '0.75rem' }}>Market Position</div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{dt.market_position || '—'}</p>
          {dt.work_model && (
            <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#10b981' }}>home_work</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>{dt.work_model}</span>
            </div>
          )}
        </div>
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '0.75rem' }}>Culture & Engineering</div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{dt.culture_summary || '—'}</p>
          {dt.notable_perks && dt.notable_perks.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {dt.notable_perks.map(p => (
                <span key={p} style={{ padding: '0.2rem 0.6rem', background: 'var(--bg-tertiary)', borderRadius: '0.35rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tech stack */}
      {dt.tech_stack && dt.tech_stack.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '1rem' }}>Tech Stack</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {dt.tech_stack.map(t => (
              <span key={t} style={{ padding: '0.35rem 0.75rem', background: 'rgba(37,106,244,0.1)', border: '1px solid rgba(37,106,244,0.2)', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent news */}
      {dt.recent_news && dt.recent_news.length > 0 && (
        <div>
          <div style={{ ...S.label, marginBottom: '0.875rem' }}>Recent News</div>
          <div className="research-equal-col">
            {dt.recent_news.map((n, i) => (
              <div key={i} style={{ ...S.card, borderLeft: `4px solid ${sentimentColor(n.sentiment)}`, cursor: 'default' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>{n.source} • {n.time_ago}</span>
                <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.headline}</h5>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Financials ───────────────────────────────────────────────────────────────
export function FinancialsView({ research, app }) {
  const fin = research?.financials || {};

  const kpis = [
    { label: 'Annual Revenue', val: fin.annual_revenue || '—', trend: fin.revenue_growth ? `${fin.revenue_growth} YoY` : null, up: true, icon: 'payments' },
    { label: 'Gross Margin', val: fin.gross_margin || '—', trend: null, up: null, icon: 'pie_chart' },
    { label: 'Market Cap', val: fin.market_cap || fin.total_funding || '—', trend: fin.funding_stage, up: null, icon: 'show_chart' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div className="research-three-col">
        {kpis.map(k => (
          <div key={k.label} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={S.label}>{k.label}</div>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{k.icon}</span>
            </div>
            <div style={S.kpi}>{k.val}</div>
            {k.trend && (
              <div style={{ ...S.kpiSub, color: k.up === true ? '#34d399' : k.up === false ? '#f87171' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {k.up === true && <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>trending_up</span>}
                {k.trend}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Funding / profitability info */}
      <div className="research-equal-col">
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '0.75rem' }}>Funding & Stage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Stage', val: fin.funding_stage },
              { label: 'Total Funding', val: fin.total_funding },
              { label: 'Profitable', val: fin.profitable },
              { label: 'Ticker', val: fin.stock_symbol },
            ].filter(r => r.val).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent acquisitions */}
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '0.75rem' }}>Recent Acquisitions</div>
          {fin.recent_acquisitions && fin.recent_acquisitions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {fin.recent_acquisitions.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(37,106,244,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1rem' }}>business_center</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{a.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({a.year})</span></div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{a.rationale}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notable acquisitions found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Competitors ──────────────────────────────────────────────────────────────
export function CompetitorView({ research, app }) {
  const comp = research?.competitors || {};
  const co = app?.company || 'Target Co.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Competitor list */}
      {comp.primary_competitors && comp.primary_competitors.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '1rem' }}>Primary Competitors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {comp.primary_competitors.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.875rem', borderRadius: '0.875rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', background: 'rgba(37,106,244,0.1)', border: '1px solid rgba(37,106,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary)' }}>business</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{c.name}</div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.differentiator}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="research-equal-col">
        {/* Competitive advantages */}
        {comp.competitive_advantages && comp.competitive_advantages.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.label, color: '#34d399', marginBottom: '0.875rem' }}>Competitive Advantages</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {comp.competitive_advantages.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: '#34d399', marginTop: '2px', flexShrink: 0 }}>check_circle</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market threats */}
        {comp.market_threats && comp.market_threats.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.label, color: '#f87171', marginBottom: '0.875rem' }}>Market Threats</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {comp.market_threats.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: '#f87171', marginTop: '2px', flexShrink: 0 }}>warning</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interview tips */}
      {comp.interview_tips && (
        <div style={{ ...S.card, borderLeft: '4px solid var(--primary)', background: 'linear-gradient(135deg, rgba(37,106,244,0.08), var(--glass-bg))' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.25rem', flexShrink: 0 }}>tips_and_updates</span>
            <div>
              <div style={{ ...S.label, color: 'var(--primary)', marginBottom: '0.4rem' }}>Interview Tip</div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{comp.interview_tips}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Career Matches ──────────────────────────────────────────────────────────
export function CareerMatchesView({ research, app, onRefresh, fetchWithAuth, apiUrl }) {
  const matches = research?.career_matches?.matches || [];
  const summary = research?.career_matches?.summary;
  const direct = research?.career_matches?.direct_listing;
  const [isUpdatingUrl, setIsUpdatingUrl] = useState(false);
  const [urlUpdated, setUrlUpdated] = useState(false);

  // Check if the current apply_url already matches the direct listing
  const alreadyUsingDirect = direct?.url && app?.apply_url === direct.url;

  const handleReplaceApplyUrl = async () => {
    if (!direct?.url || !fetchWithAuth || !app?.id) return;
    setIsUpdatingUrl(true);
    try {
      const res = await fetchWithAuth(`${apiUrl}/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply_url: direct.url }),
      });
      if (res.ok) {
        setUrlUpdated(true);
        if (onRefresh) await onRefresh();
      }
    } catch (e) {
      console.error('Failed to update apply URL', e);
    } finally {
      setIsUpdatingUrl(false);
    }
  };

  if (!research?.overview?.careers_url) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--text-muted)', opacity: 0.5 }}>search_off</span>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No Careers URL Found</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
            We couldn't identify a careers page for this company. Try adding one to the research data or checking the company website manually.
          </p>
        </div>
      </div>
    );
  }

  if (!direct && matches.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="skeleton-shimmer" style={{ width: '3rem', height: '3rem', borderRadius: '50%' }} />
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Scanning for Opportunities...</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
            We're currently scanning the company's careers page to find the direct listing and other roles that might fit your profile. This usually takes 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  const confidenceColor = (c) => {
    if (c === 'high') return '#22c55e';
    if (c === 'medium') return '#fb923c';
    return 'var(--text-muted)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* ── Direct Listing Section ───────────────────────────────────── */}
      {direct && (
        <div style={{
          ...S.card,
          background: direct.found
            ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(37,106,244,0.06))'
            : 'var(--glass-bg)',
          borderLeft: `4px solid ${direct.found ? '#22c55e' : 'var(--border-color)'}`,
          padding: '1.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '1rem', flexShrink: 0,
              background: direct.found ? 'rgba(34,197,94,0.12)' : 'var(--bg-tertiary)',
              border: `1px solid ${direct.found ? 'rgba(34,197,94,0.25)' : 'var(--border-color)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '1.75rem',
                color: direct.found ? '#22c55e' : 'var(--text-muted)',
                fontVariationSettings: direct.found ? "'FILL' 1" : "'FILL' 0",
              }}>
                {direct.found ? 'verified' : 'search_off'}
              </span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                <span style={{ ...S.label, margin: 0, color: direct.found ? '#22c55e' : 'var(--text-muted)' }}>
                  Direct Job Listing
                </span>
                {direct.found && direct.confidence && (
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                    padding: '0.15rem 0.5rem', borderRadius: '99px',
                    background: `${confidenceColor(direct.confidence)}18`,
                    color: confidenceColor(direct.confidence),
                    border: `1px solid ${confidenceColor(direct.confidence)}30`,
                  }}>
                    {direct.confidence} confidence
                  </span>
                )}
              </div>

              {direct.found ? (
                <>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {direct.title}
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {direct.match_reasoning}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {direct.url && (
                      <a href={direct.url} target="_blank" rel="noreferrer" style={{
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.4rem 0.85rem', borderRadius: '0.5rem',
                        background: 'rgba(37,106,244,0.1)', border: '1px solid rgba(37,106,244,0.2)',
                        fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)',
                        transition: 'transform 0.2s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>open_in_new</span>
                        View on Company Site
                      </a>
                    )}

                    {direct.url && !alreadyUsingDirect && !urlUpdated && (
                      <button
                        onClick={handleReplaceApplyUrl}
                        disabled={isUpdatingUrl}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                          padding: '0.4rem 0.85rem', borderRadius: '0.5rem',
                          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                          fontSize: '0.75rem', fontWeight: 700, color: '#22c55e',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                          {isUpdatingUrl ? 'hourglass_empty' : 'swap_horiz'}
                        </span>
                        {isUpdatingUrl ? 'Updating...' : 'Use as Apply Link'}
                      </button>
                    )}

                    {(alreadyUsingDirect || urlUpdated) && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.4rem 0.85rem', borderRadius: '0.5rem',
                        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
                        fontSize: '0.75rem', fontWeight: 700, color: '#22c55e',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Apply Link Updated
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Listing Not Found on Careers Page
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    We scanned the company's careers page but couldn't confidently match your current application to a direct listing. The role may be posted through a third-party job board only.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary ─────────────────────────────────────────────────── */}
      {summary && (
        <div style={{ ...S.card, background: 'rgba(37,106,244,0.05)', borderLeft: '4px solid var(--primary)' }}>
          <div style={S.label}>Hiring Landscape</div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 500 }}>{summary}</p>
        </div>
      )}

      {/* ── Similar Roles ───────────────────────────────────────────── */}
      {matches.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>explore</span>
            <span style={{ ...S.label, margin: 0, fontSize: '0.65rem' }}>Other Roles That May Interest You</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {matches.map((m, i) => (
              <div key={i} style={{ ...S.card, display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'transform 0.2s', cursor: m.url ? 'pointer' : 'default' }} onMouseEnter={e => m.url && (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => m.url && (e.currentTarget.style.transform = 'translateY(0)')} onClick={() => m.url && window.open(m.url, '_blank')}>
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ position: 'relative' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.75rem', color: 'var(--primary)' }}>work</span>
                    <div style={{ position: 'absolute', top: -4, right: -4, width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: m.fit_score > 80 ? '#34d399' : '#fb923c', border: '2px solid var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 900, color: 'white' }}>
                      {m.fit_score}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{m.title}</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {m.location && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>location_on</span>
                          {m.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.reasoning}</p>
                </div>
                {m.url && (
                  <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', opacity: 0.5 }}>chevron_right</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Footer link ─────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <a href={research.overview.careers_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          View all openings on Careers Page
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
        </a>
      </div>
    </div>
  );
}
