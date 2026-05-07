// Company Research sub-views: Overview, Detailed, Financials, Competitors
// All views now consume the `research` prop (AI-generated JSON).

const S = {
  card: { background: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem' },
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
      <div style={{ ...S.card, background: 'linear-gradient(135deg, rgba(37,106,244,0.12), rgba(30,41,59,0.4))', borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={S.label}>Mission</div>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.55, maxWidth: '560px' }}>
            "{ov.mission || `${co} is a leading company in its industry.`}"
          </p>
          {ov.industry && (
            <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(37,106,244,0.12)', border: '1px solid rgba(37,106,244,0.2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>work</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ov.industry}</span>
            </div>
          )}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.08, flexShrink: 0 }}>format_quote</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '1.2rem' }}>{s.icon}</span>
            </div>
            <div>
              <div style={S.label}>{s.label}</div>
              <div style={{ ...S.kpi, fontSize: '1rem', fontWeight: 800, lineHeight: 1.2 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Core Values + Glassdoor */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={S.card}>
          <div style={{ ...S.label, color: 'var(--primary)', marginBottom: '1rem' }}>Core Values</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {(ov.core_values || ['Innovation', 'Integrity', 'Collaboration']).map(v => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                <span key={p} style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.06)', borderRadius: '0.35rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p}</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
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
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.875rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
        <div style={{ ...S.card, borderLeft: '4px solid var(--primary)', background: 'linear-gradient(135deg, rgba(37,106,244,0.08), rgba(30,41,59,0.4))' }}>
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
