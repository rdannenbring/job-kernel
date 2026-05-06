// Company Research sub-views: Overview, Financials, Competitors

const S = {
  card: { background: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.5rem' },
  label: { fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '0.4rem' },
  kpi: { fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 },
  kpiSub: { fontSize: '0.7rem', fontWeight: 600, marginTop: '0.25rem' },
};

export function CompanyOverviewView({ app }) {
  const co = app?.company || 'Target Company';
  const stats = [
    { label: 'Employees', val: app?.employee_count || '9,800+', icon: 'group', color: '#60a5fa' },
    { label: 'Global Offices', val: app?.office_count || '45', icon: 'location_city', color: '#34d399' },
    { label: 'Markets', val: app?.market_count || '184', icon: 'public', color: '#a78bfa' },
  ];
  const values = [
    { icon: 'bolt', label: 'Innovation' },
    { icon: 'favorite', label: 'Sincerity' },
    { icon: 'local_fire_department', label: 'Passion' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ ...S.card, background: 'linear-gradient(135deg, rgba(37,106,244,0.12), rgba(30,41,59,0.4))', borderLeft: '4px solid var(--primary-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={S.label}>Our Mission</div>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, maxWidth: '520px' }}>
            "{app?.core_purpose || 'Unlock the potential of human creativity — giving artists the opportunity to live off their art.'}"
          </p>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.1 }}>format_quote</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: s.color, fontSize: '1.2rem' }}>{s.icon}</span>
            </div>
            <div>
              <div style={S.label}>{s.label}</div>
              <div style={S.kpi}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={S.card}>
          <div style={{ ...S.label, color: 'var(--primary-color)', marginBottom: '1rem' }}>Core Values</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {values.map(v => (
              <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{v.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: '1rem' }}>Glassdoor Rating</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{app?.glassdoor_rating || '4.2'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Based on employee reviews</div>
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={S.label}>CEO Approval</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: '82%', height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, #34d399, #60a5fa)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>82%</span>
            </div>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: '1rem' }}>Leadership Team</div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[['CEO', 'Chief Executive Officer'], ['CTO', 'Chief Technology Officer'], ['CPO', 'Chief Product Officer'], ['CHRO', 'Chief People Officer']].map(([title, full]) => (
            <div key={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(37,106,244,0.12)', border: '2px solid rgba(37,106,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}>person</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{full}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FinancialsView({ app }) {
  const kpis = [
    { label: 'Total Revenue', val: app?.annual_revenue || '€13.2B', trend: '+13% YoY', up: true, icon: 'payments' },
    { label: 'Gross Margin', val: app?.gross_margin || '26.4%', trend: '+2.1% improvement', up: true, icon: 'pie_chart' },
    { label: 'Market Cap', val: app?.market_cap || '$58B', trend: 'As of last quarter', up: null, icon: 'show_chart' },
  ];
  const acquisitions = [
    { name: 'Recent Acquisition #1', desc: 'Strategic expansion into adjacent market', year: '2023', icon: 'business_center' },
    { name: 'Recent Acquisition #2', desc: 'AI and technology capability boost', year: '2022', icon: 'psychology' },
    { name: 'Recent Acquisition #3', desc: 'Product and distribution expansion', year: '2021', icon: 'inventory_2' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {kpis.map(k => (
          <div key={k.label} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={S.label}>{k.label}</div>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{k.icon}</span>
            </div>
            <div style={S.kpi}>{k.val}</div>
            <div style={{ ...S.kpiSub, color: k.up === true ? '#34d399' : k.up === false ? '#f87171' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {k.up === true && <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>trending_up</span>}
              {k.up === false && <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>trending_down</span>}
              {k.trend}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Stock Performance</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trailing 12-month</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>{app?.stock_price || '$312'}</div>
              <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700 }}>+84% (1Y)</div>
            </div>
          </div>
          <div style={{ height: '120px', position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#256af4" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#256af4" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0 100 Q 60 90, 100 70 T 200 45 T 300 20 T 400 10" fill="url(#chartGrad)" stroke="none"/>
              <path d="M0 100 Q 60 90, 100 70 T 200 45 T 300 20 T 400 10" fill="none" stroke="#256af4" strokeWidth="2.5"/>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['Jan','Mar','May','Jul','Sep','Nov'].map(m => (
              <span key={m} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>{m}</span>
            ))}
          </div>
        </div>
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ ...S.label, color: 'var(--primary-color)' }}>Market Position</div>
          <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(37,106,244,0.08)', border: '1px solid rgba(37,106,244,0.15)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.4rem' }}>AUDIENCE REACH</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Dominant market position with leading share in key segments.</p>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f43f5e', marginBottom: '0.4rem' }}>COMPETITIVE MOAT</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>AI-driven personalization creates high switching costs and strong retention.</p>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Recent Acquisitions</div>
          <span style={{ ...S.label, marginBottom: 0 }}>Strategic Activity</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {acquisitions.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: 'rgba(37,106,244,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{a.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{a.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.desc}</div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{a.year}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompetitorView({ app }) {
  const co = app?.company || 'Target Co.';
  const features = [
    { label: 'Pricing (Premium)', sub: 'Individual Tier', vals: ['$10.99/mo', '$10.99/mo', '$10.99/mo', '$10.99/mo'] },
    { label: 'Free Tier', sub: 'Ad-Supported', vals: ['Comprehensive ✓', 'None ✗', 'Standard ✓', 'Prime Only'] },
    { label: 'Hi-Fi Audio', sub: 'Lossless Quality', vals: ['Roadmapped', 'Included', 'Limited', 'Included'] },
    { label: 'Discovery AI', sub: 'Personalization', vals: ['Market Leader ★', 'Curated Focus', 'Video-led', 'Standard'] },
    { label: 'Active Users', sub: 'Global Reach', vals: ['600M+', 'Proprietary', '80M+ Est.', '55M+ Est.'] },
  ];
  const competitors = [co, 'Apple Music', 'YT Music', 'Amazon HD'];
  const insights = [
    { icon: 'auto_awesome', title: 'Algorithm Maturity', desc: "The company's lead in personalized discovery remains the primary competitive moat." },
    { icon: 'devices', title: 'Ecosystem Synergy', desc: 'Competitors leverage hardware bundles to drive involuntary subscriber growth.' },
    { icon: 'public', title: 'Global Penetration', desc: "Emerging markets show strong preference for robust free-tier offerings." },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ ...S.card, padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.06)', width: '28%' }}>Feature</th>
                {competitors.map((c, i) => (
                  <th key={c} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem', background: i === 0 ? 'rgba(37,106,244,0.2)' : 'rgba(255,255,255,0.06)', border: i === 0 ? '1px solid rgba(37,106,244,0.3)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: i === 0 ? 'var(--primary-color)' : 'var(--text-muted)' }}>business</span>
                      </div>
                      <span style={{ fontWeight: i === 0 ? 800 : 600, color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.8rem' }}>{c}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, fi) => (
                <tr key={f.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{f.label}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.sub}</div>
                  </td>
                  {f.vals.map((v, vi) => (
                    <td key={vi} style={{ padding: '0.875rem 1.25rem', color: vi === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {vi === 0 ? <span style={{ fontWeight: 800, color: 'var(--primary-color)', background: 'rgba(37,106,244,0.1)', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(37,106,244,0.2)' }}>{v}</span> : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {insights.map(ins => (
          <div key={ins.title} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.6rem', background: 'rgba(37,106,244,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{ins.icon}</span>
            </div>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{ins.title}</div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
