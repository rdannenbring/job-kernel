/* global React */
/* Row/section anatomy variations — two ways to render a field row */

function AnatomyStacked({ theme = 'light' }) {
  const P = window.PROFILE;
  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="view_agenda">Anatomy A · stacked label-over-value (2 col)</PCap>
        <div style={{ paddingTop: 48 }}>
          <PSection icon="payments" title="Compensation"
            sub="Stacked label-over-value · scannable in 2-up grid.">
            <div className="p-field-grid">
              <PField label="Base range" affectsMatching>
                <span className="salary-chip">
                  <Icon name="payments" size={11} />
                  ${(P.comp.min/1000).toFixed(0)}k – ${(P.comp.max/1000).toFixed(0)}k {P.comp.currency}
                </span>
              </PField>
              <PField label="Equity" value={P.comp.equity} affectsMatching />
              <PField label="Currency" value={P.comp.currency} affectsMatching />
              <PField label="Negotiable" affectsMatching>
                <span className="chip chip-green">
                  <Icon name="check" size={11} /> Open
                </span>
              </PField>
              <PField label="Total comp floor" value="$210k OTE" affectsMatching />
              <PField label="Sign-on bonus" value="Not required" />
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

function AnatomyInline({ theme = 'light' }) {
  const P = window.PROFILE;
  // Anatomy B — settings-style: label-left, value-right, divider per row
  const Row = ({ label, value, match }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{label}</span>
        {match && <MatchChip size="tiny" />}
      </div>
      <div style={{ fontSize: 13, color: 'var(--txt-2)', fontWeight: 500, display: 'flex',
        alignItems: 'center', gap: 6 }}>
        {value}
      </div>
      <Icon name="chevron_right" size={14} style={{ color: 'var(--txt-faint)' }} />
    </div>
  );

  return (
    <div className="p-artboard" style={{ background: 'var(--bg)', padding: 20 }}>
      <div className="app" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%',
        background: 'var(--bg)' }}>
        <PCap icon="view_list">Anatomy B · inline label-left value-right (settings-style)</PCap>
        <div style={{ paddingTop: 48 }}>
          <PSection icon="payments" title="Compensation"
            sub="Inline rows · denser, scrolls comfortably on narrow screens.">
            <div style={{ marginTop: -8 }}>
              <Row label="Base range" match value={
                <span className="salary-chip">
                  <Icon name="payments" size={11} />
                  ${(P.comp.min/1000).toFixed(0)}k – ${(P.comp.max/1000).toFixed(0)}k {P.comp.currency}
                </span>
              } />
              <Row label="Equity" match value={P.comp.equity} />
              <Row label="Currency" match value={P.comp.currency} />
              <Row label="Negotiable" match value={
                <span className="chip chip-green">
                  <Icon name="check" size={11} /> Open
                </span>
              } />
              <Row label="Total comp floor" match value="$210k OTE" />
              <Row label="Sign-on bonus" value="Not required" />
            </div>
          </PSection>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AnatomyStacked, AnatomyInline });
