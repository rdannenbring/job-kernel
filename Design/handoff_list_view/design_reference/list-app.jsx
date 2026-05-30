/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle,
   ListClassic, ListGrouped, ListPulse,
   RowSingleLine, RowTwoLine, RowPipeline,
   StateHover, StateSelection, StateStagePopover, StateConfirmModal,
   StateColumnManager, StateStickyLoading, StateEmpty, StateLoading, StateError, StateShortcuts */

// Tweak defaults — exposed knobs:
//   theme          light / dark
//   density        compact / comfy / relaxed
//   focus          all / pulse / groupings / alts / rows / interactions / states
//   groupBy        flat / urgency / stage / interest / location / nextaction / source
//   showClosed     keep closed apps inline (true) or hide them (false)
//   inlineExpand   when 'pulse' shows the inline-preview row open
//   showGroupMenu  pin the Group-by popover open on the lead Pulse artboard
//   forceHover     pin the hover state on row 2 in Classic for easy review
//   forceSelect    show the bulk-action bar prepopulated in Classic
//
// NOTE: After review, you picked Pulse as the direction — it now sits at the
// top of the canvas with grouping defaulting OFF, and a dedicated section
// shows the seven group-by modes side by side.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfy",
  "focus": "all",
  "groupBy": "flat",
  "showClosed": true,
  "inlineExpand": true,
  "showGroupMenu": false,
  "forceHover": false,
  "forceSelect": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const focus = t.focus;

  const showPulse        = focus === 'all' || focus === 'pulse';
  const showGroupings    = focus === 'all' || focus === 'groupings';
  const showAlts         = focus === 'all' || focus === 'alts';
  const showRows         = focus === 'all' || focus === 'rows';
  const showInteractions = focus === 'all' || focus === 'interactions';
  const showStates       = focus === 'all' || focus === 'states';

  return (
    <>
      <DesignCanvas storageKey="jobkernel-list-v2">

        {/* ───── ① PULSE — the chosen direction ───── */}
        {showPulse && (
          <DCSection
            id="pulse-lead"
            title="① Pulse — the direction"
            subtitle="Flat by default (sorted urgency-first), Group by available as a single dropdown with 7 modes. Same pipeline-strip row + inline expand-in-place preview. Use the Tweaks panel to change theme, density, grouping, or to open the group-by popover."
          >
            <DCArtboard id="pulse" label="Pulse · live (tweakable)" width={1320} height={860}>
              <ListPulse
                density={t.density} theme={t.theme}
                expandedId={t.inlineExpand ? 'a04' : null}
                showClosed={t.showClosed}
                groupBy={t.groupBy}
                showGroupMenu={t.showGroupMenu}
              />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ② GROUPINGS — every group-by mode side by side ───── */}
        {showGroupings && (
          <DCSection
            id="pulse-groupings"
            title="② Group-by modes — all seven"
            subtitle="Grouping is off by default; users opt in. The dropdown offers: Urgency (today / week / awaiting / closed), Stage, Interest, Location, Next action, Source — and back to a flat list. State is saved per view and syncs across devices."
          >
            <DCArtboard id="gb-menu" label="Dropdown · open" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy={t.groupBy} showGroupMenu={true}
              />
            </DCArtboard>

            <DCArtboard id="gb-urgency" label="Group by · Urgency" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="urgency"
              />
            </DCArtboard>

            <DCArtboard id="gb-stage" label="Group by · Stage" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="stage"
              />
            </DCArtboard>

            <DCArtboard id="gb-interest" label="Group by · Interest" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="interest"
              />
            </DCArtboard>

            <DCArtboard id="gb-location" label="Group by · Location" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="location"
              />
            </DCArtboard>

            <DCArtboard id="gb-action" label="Group by · Next action" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="nextaction"
              />
            </DCArtboard>

            <DCArtboard id="gb-source" label="Group by · Source" width={1320} height={860}>
              <ListPulse density={t.density} theme={t.theme}
                expandedId={null} showClosed={t.showClosed}
                groupBy="source"
              />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ③ ALTERNATES — kept for reference ───── */}
        {showAlts && (
          <DCSection
            id="alts"
            title="③ Earlier alternates (for reference)"
            subtitle="Classic table and Grouped-by-stage from the first round — kept around so we can lift specific moves if useful. Not the direction."
          >
            <DCArtboard id="classic" label="Classic table" width={1280} height={820}>
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <ListClassic density={t.density} theme={t.theme} showClosed={t.showClosed}
                  forceHoverRow={t.forceHover ? 2 : null}
                />
                {t.forceSelect && (
                  <div className="app" data-theme={t.theme} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
                    <BulkBarOverlay count={3} />
                  </div>
                )}
              </div>
            </DCArtboard>

            <DCArtboard id="grouped" label="Grouped by stage (sticky headers)" width={1280} height={820}>
              <ListGrouped density={t.density} theme={t.theme} showClosed={t.showClosed} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ④ ROW ANATOMY ───── */}
        {showRows && (
          <DCSection
            id="rows"
            title="④ Row anatomy — three densities"
            subtitle="Holding the layout constant. Single-line for power scanning · two-line as default · pipeline-strip is the centerpiece of Pulse."
          >
            <DCArtboard id="row-single" label="Single-line · 36px" width={980} height={300}>
              <RowSingleLine theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="row-two" label="Two-line · 52px" width={980} height={300}>
              <RowTwoLine theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="row-pipe" label="Pipeline-strip · 52px" width={980} height={300}>
              <RowPipeline theme={t.theme} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ⑤ INTERACTION STATES ───── */}
        {showInteractions && (
          <DCSection
            id="interactions"
            title="⑤ Interaction states"
            subtitle="Hover, selection, inline edit, the same confirm modal Job Details uses, column controls, and sticky-header / virtualization affordance."
          >
            <DCArtboard id="hover" label="Hover · quick actions" width={1080} height={420}>
              <StateHover theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="selection" label="Multi-select · bulk bar" width={1080} height={500}>
              <StateSelection theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="stage-pop" label="Inline stage edit · popover" width={1080} height={500}>
              <StateStagePopover theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="confirm" label="Stage rollback · confirm modal" width={1080} height={520}>
              <StateConfirmModal theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="columns" label="Column manager · reorder + hide" width={1080} height={520}>
              <StateColumnManager theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="sticky" label="Sticky header · loading more" width={1080} height={520}>
              <StateStickyLoading theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="shortcuts" label="Keyboard shortcuts (?)" width={1080} height={520}>
              <StateShortcuts theme={t.theme} />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───── ⑥ EMPTY / LOADING / ERROR ───── */}
        {showStates && (
          <DCSection
            id="states"
            title="⑥ Empty · loading · error"
            subtitle="All three states keep the toolbar visible so filter context is never lost. Light + dark theme parity comes from the existing tokens."
          >
            <DCArtboard id="empty" label="Empty (filtered)" width={1080} height={520}>
              <StateEmpty theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="loading" label="Initial load · skeleton" width={1080} height={520}>
              <StateLoading theme={t.theme} />
            </DCArtboard>
            <DCArtboard id="error" label="Network error" width={1080} height={520}>
              <StateError theme={t.theme} />
            </DCArtboard>
          </DCSection>
        )}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} options={['light', 'dark']}
            onChange={(v) => setTweak('theme', v)} />
        </TweakSection>

        <TweakSection label="Density">
          <TweakRadio label="Rows"
            value={t.density}
            options={[
              { value: 'compact', label: '1-line' },
              { value: 'comfy',   label: '2-line' },
              { value: 'relaxed', label: 'Roomy' },
            ]}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Pulse · Group by">
          <TweakSelect label="Mode"
            value={t.groupBy}
            options={[
              { value: 'flat',       label: 'No grouping (default)' },
              { value: 'urgency',    label: 'Urgency · today / week' },
              { value: 'stage',      label: 'Stage' },
              { value: 'interest',   label: 'Interest' },
              { value: 'location',   label: 'Location' },
              { value: 'nextaction', label: 'Next action' },
              { value: 'source',     label: 'Source' },
            ]}
            onChange={(v) => setTweak('groupBy', v)} />
          <TweakToggle label="Show dropdown open"
            value={t.showGroupMenu}
            onChange={(v) => setTweak('showGroupMenu', v)} />
          <TweakToggle label="Expand-in-place row"
            value={t.inlineExpand}
            onChange={(v) => setTweak('inlineExpand', v)} />
        </TweakSection>

        <TweakSection label="Focus">
          <TweakSelect label="Show"
            value={t.focus}
            options={[
              { value: 'all',          label: 'Everything' },
              { value: 'pulse',        label: '① Pulse only' },
              { value: 'groupings',    label: '② Group-by modes' },
              { value: 'alts',         label: '③ Alternates' },
              { value: 'rows',         label: '④ Row anatomy' },
              { value: 'interactions', label: '⑤ Interactions' },
              { value: 'states',       label: '⑥ States' },
            ]}
            onChange={(v) => setTweak('focus', v)} />
        </TweakSection>

        <TweakSection label="Data">
          <TweakToggle label="Show closed apps"
            value={t.showClosed}
            onChange={(v) => setTweak('showClosed', v)} />
        </TweakSection>

        <TweakSection label="Force state (Classic)">
          <TweakToggle label="Hover row"
            value={t.forceHover}
            onChange={(v) => setTweak('forceHover', v)} />
          <TweakToggle label="Selection + bulk bar"
            value={t.forceSelect}
            onChange={(v) => setTweak('forceSelect', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Bulk bar overlay reused for the "force selection" tweak inside Classic.
function BulkBarOverlay({ count }) {
  return (
    <div className="bulkbar" style={{ pointerEvents: 'auto' }}>
      <span className="bulkbar-count">
        <span className="n">{count}</span> selected
      </span>
      <button className="bulkbar-btn"><span className="icon icon-14">swap_horiz</span> Move stage</button>
      <button className="bulkbar-btn"><span className="icon icon-14">local_offer</span> Add tag</button>
      <button className="bulkbar-btn"><span className="icon icon-14">snooze</span> Snooze</button>
      <button className="bulkbar-btn"><span className="icon icon-14">archive</span> Archive</button>
      <button className="bulkbar-btn"><span className="icon icon-14">file_download</span> Export</button>
      <button className="bulkbar-btn is-danger"><span className="icon icon-14">delete</span> Delete</button>
      <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
      <button className="bulkbar-close"><span className="icon icon-14">close</span></button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
