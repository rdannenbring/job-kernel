/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, DCPostIt,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakSlider,
   Discover, DiscoverShell, DetailPane, ResultRow, WhyMatch, QueryBar, SourcesBar, FilterBar,
   ProfileNudge, ResultsTakeover */

// Tweak knobs:
//   theme        light / dark
//   density      compact / comfy / relaxed
//   variant      slidein / split / grouped   (featured layout)
//   state        results / streaming / partial / zero / nosources / empty / saving
//   threshold    0..100  match-score floor
//   paneOpen     show the slide-in detail pane (slidein variant)
//   inlineExpand expand a row in place instead of the pane
//   focus        which canvas section to show
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfy",
  "variant": "slidein",
  "state": "results",
  "threshold": 70,
  "paneOpen": true,
  "inlineExpand": false,
  "focus": "all"
}/*EDITMODE-END*/;

// ── Light frame wrapper for standalone fragments ──
function Frame({ theme, children, style = {} }) {
  return (
    <div className="app" data-theme={theme} style={{ height: '100%', ...style }}>{children}</div>
  );
}

function RowList({ theme, children }) {
  return (
    <Frame theme={theme}>
      <div className="dsc-results" style={{ height: '100%', borderTop: '1px solid var(--line)' }}>{children}</div>
    </Frame>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const f = t.focus;
  const show = (id) => f === 'all' || f === id;

  const activeId = t.paneOpen && t.variant === 'slidein' ? 'j01' : null;
  const expandedId = t.inlineExpand && t.variant === 'slidein' ? 'j02' : null;

  return (
    <>
      <DesignCanvas title="JobKernel · Discover — Search & Listings">

        {/* ───── ① THE DIRECTION ───── */}
        {show('direction') && (
          <DCSection id="direction" title="① Discover — the direction"
            subtitle="A top-level surface that reuses Pulse's row engine. Saved-search rail · query bar + sources health + filter chips · ranked results scored against your Profile · slide-in detail pane. Driven live by the Tweaks panel.">
            <DCArtboard id="discover-live" label="Discover · live (tweakable)" width={1520} height={940}>
              <Discover theme={t.theme} density={t.density} variant={t.variant} state={t.state}
                threshold={t.threshold} activeId={activeId} expandedId={expandedId} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ② LAYOUT VARIATIONS ───── */}
        {show('variations') && (
          <DCSection id="variations" title="② Layout variations"
            subtitle="Same engine, three reading modes. A — list with on-demand slide-in pane (matches today's app). B — split master/detail, pane always docked for rapid scan-and-read. C — results grouped into match bands with pulse-day sticky headers.">
            <DCArtboard id="var-slidein" label="A · List + slide-in pane" width={1520} height={920}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="results"
                threshold={t.threshold} activeId="j01" />
            </DCArtboard>
            <DCArtboard id="var-split" label="B · Split master/detail (pane docked)" width={1520} height={920}>
              <Discover theme={t.theme} density={t.density} variant="split" state="results"
                threshold={t.threshold} activeId="j11" />
            </DCArtboard>
            <DCArtboard id="var-grouped" label="C · Grouped by match band" width={1320} height={920}>
              <Discover theme={t.theme} density={t.density} variant="grouped" state="results"
                threshold={t.threshold} showRail={true} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ③ RESULT ROW ANATOMY ───── */}
        {show('rows') && (
          <DCSection id="rows" title="③ Result row anatomy"
            subtitle="A search result is a Pulse row's sibling: score ring · company/role · work-model + location + salary chip + source badge + match band · 2-line excerpt · Process / Save / Dismiss. Three densities, plus the deduped, saved, and dismissed states.">
            <DCArtboard id="row-comfy" label="Comfy · 14px rows (default)" width={1040} height={300}>
              <RowList theme={t.theme}>
                <ResultRow job={window.S_JOBS[0]} density="comfy" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[2]} density="comfy" onClick={() => {}} />
              </RowList>
            </DCArtboard>
            <DCArtboard id="row-compact" label="Compact · scan mode" width={1040} height={250}>
              <RowList theme={t.theme}>
                <ResultRow job={window.S_JOBS[0]} density="compact" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[1]} density="compact" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[10]} density="compact" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[2]} density="compact" onClick={() => {}} />
              </RowList>
            </DCArtboard>
            <DCArtboard id="row-states" label="Deduped · saved · dismissed" width={1040} height={320}>
              <RowList theme={t.theme}>
                <ResultRow job={window.S_JOBS[10]} density="comfy" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[5]} density="comfy" onClick={() => {}} />
                <ResultRow job={window.S_JOBS[8]} density="comfy" onClick={() => {}} />
              </RowList>
              <DCPostIt top={-8} right={-150} width={188} rotate={2}>
                Row 1 was returned by 3 sources — merged into one, sources stacked. Row 2 is already
                in your pipeline. Row 3 was dismissed (greyed, restorable).
              </DCPostIt>
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ④ DETAIL / PREVIEW ───── */}
        {show('detail') && (
          <DCSection id="detail" title="④ Result detail & preview"
            subtitle="The slide-in pane carries Job Details' DNA — a 'Why this matches you' breakdown (same dimensions + 'Affects matching' chip), source provenance, the listing, and a primary 'Save to pipeline' action. The same content collapses into an inline row-expand.">
            <DCArtboard id="detail-pane" label="Slide-in detail pane" width={420} height={820}>
              <Frame theme={t.theme}><DetailPane job={window.S_JOBS[0]} /></Frame>
            </DCArtboard>
            <DCArtboard id="detail-inline" label="Inline row-expand (alternate)" width={1040} height={460}>
              <RowList theme={t.theme}>
                <ResultRow job={window.S_JOBS[0]} density="comfy" expanded={true} active={true} onClick={() => {}} />
                <ResultRow job={window.S_JOBS[6]} density="comfy" onClick={() => {}} />
              </RowList>
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ⑤ FILTERS ───── */}
        {show('filters') && (
          <DCSection id="filters" title="⑤ Filters & match threshold"
            subtitle="Pulse-style chip bar inline; advanced filters in a popover. The match-score threshold is a first-class filter, labelled with the 'Affects matching' chip and pointing back to the Profile that drives the scores.">
            <DCArtboard id="filter-bar" label="Filter chip bar + threshold popover" width={1040} height={420}>
              <Frame theme={t.theme}>
                <div className="dsc-main">
                  <QueryBar kw="staff engineer" loc="Remote" model="Remote" />
                  <SourcesBar sources={window.S_SOURCES} />
                  <FilterBar threshold={t.threshold} count={104} showThreshPop={true} sort="match" />
                </div>
              </Frame>
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ⑥ STATES ───── */}
        {show('states') && (
          <DCSection id="states" title="⑥ States — loading · partial · zero · no sources · saving"
            subtitle="Streaming results in per-source. One source down ≠ no results — partial failure stays graceful. Zero-results coaches the next move. No-sources links to Profile → Integrations. Saving a job turns it into a tracked application in place.">
            <DCArtboard id="st-stream" label="Streaming · per-source progress" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="streaming" threshold={t.threshold} showRail={true} />
            </DCArtboard>
            <DCArtboard id="st-partial" label="Partial-source failure" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="partial" threshold={t.threshold} showRail={true} />
            </DCArtboard>
            <DCArtboard id="st-saving" label="Saving → tracked application" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="saving" threshold={t.threshold} activeId="j02" showRail={true} />
            </DCArtboard>
            <DCArtboard id="st-zero" label="Zero results" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="zero" threshold={t.threshold} showRail={true} />
            </DCArtboard>
            <DCArtboard id="st-empty" label="No query yet (first run)" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="empty" threshold={t.threshold} showRail={true} />
            </DCArtboard>
            <DCArtboard id="st-nosources" label="No sources connected" width={1320} height={760}>
              <Discover theme={t.theme} density={t.density} variant="slidein" state="nosources" threshold={t.threshold} showRail={true} />
            </DCArtboard>
          </DCSection>
        )}

      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} options={['light', 'dark']}
            onChange={(v) => setTweak('theme', v)} />
        </TweakSection>

        <TweakSection label="Featured layout">
          <TweakSelect label="Variant" value={t.variant}
            options={[
              { value: 'slidein', label: 'A · List + slide-in pane' },
              { value: 'split', label: 'B · Split master/detail' },
              { value: 'grouped', label: 'C · Grouped by match band' },
            ]}
            onChange={(v) => setTweak('variant', v)} />
          <TweakRadio label="Density" value={t.density}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfy', label: 'Comfy' },
              { value: 'relaxed', label: 'Relaxed' },
            ]}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Result state">
          <TweakSelect label="State" value={t.state}
            options={[
              { value: 'results', label: 'Results' },
              { value: 'streaming', label: 'Loading / streaming' },
              { value: 'partial', label: 'Partial-source failure' },
              { value: 'saving', label: 'Saving → tracked' },
              { value: 'zero', label: 'Zero results' },
              { value: 'empty', label: 'No query yet' },
              { value: 'nosources', label: 'No sources connected' },
            ]}
            onChange={(v) => setTweak('state', v)} />
        </TweakSection>

        <TweakSection label="Match score">
          <TweakSlider label="Threshold" value={t.threshold} min={0} max={100} step={5}
            onChange={(v) => setTweak('threshold', v)} />
        </TweakSection>

        <TweakSection label="Detail (slide-in variant)">
          <TweakToggle label="Detail pane open" value={t.paneOpen}
            onChange={(v) => setTweak('paneOpen', v)} />
          <TweakToggle label="Inline row-expand" value={t.inlineExpand}
            onChange={(v) => setTweak('inlineExpand', v)} />
        </TweakSection>

        <TweakSection label="Focus">
          <TweakSelect label="Section" value={t.focus}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'direction', label: '① The direction' },
              { value: 'variations', label: '② Layout variations' },
              { value: 'rows', label: '③ Row anatomy' },
              { value: 'detail', label: '④ Detail & preview' },
              { value: 'filters', label: '⑤ Filters & threshold' },
              { value: 'states', label: '⑥ States' },
            ]}
            onChange={(v) => setTweak('focus', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
