/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, TweaksPanel, useTweaks,
          TweakSection, TweakRadio, TweakSelect, VariationAMobile, IOSDevice */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "focus": "all"
}/*EDITMODE-END*/;

const FRAME_W = 402;
const FRAME_H = 874;
const PAD = 20;

function PhoneBoard({ theme, view, initialSub, mockCurrent, initialPreview, initialConfirm }) {
  return (
    <div style={{
      width: FRAME_W + PAD * 2, height: FRAME_H + PAD * 2,
      display: 'grid', placeItems: 'center',
      background: 'transparent',
    }}>
      <IOSDevice width={FRAME_W} height={FRAME_H} dark={theme === 'dark'}>
        <VariationAMobile theme={theme} view={view} initialSub={initialSub}
          mockCurrent={mockCurrent} initialPreview={initialPreview}
          initialConfirm={initialConfirm} />
      </IOSDevice>
    </div>
  );
}

function MobileApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const showMain       = t.focus === 'all' || t.focus === 'main';
  const showSheet      = t.focus === 'all' || t.focus === 'sheet';
  const showPrioritize = t.focus === 'all' || t.focus === 'prioritize';
  const showPreview    = t.focus === 'all' || t.focus === 'preview';
  const showRollback   = t.focus === 'all' || t.focus === 'rollback';

  return (
    <>
      <DesignCanvas storageKey="jobkernel-jd-mobile-v1">
        <DCSection
          id="mobile"
          title="Job Details — Mobile (Variation A)"
          subtitle="Phone translation of header card + vertical pipeline + action workspace"
        >
          {showMain && (
            <DCArtboard id="main"
              label="01 · Main view — Analysis substage active"
              width={FRAME_W + PAD * 2} height={FRAME_H + PAD * 2}>
              <PhoneBoard theme={t.theme} view="main" initialSub="analysis" />
            </DCArtboard>
          )}
          {showPrioritize && (
            <DCArtboard id="prioritize"
              label="02 · Prioritize substage — decision flow"
              width={FRAME_W + PAD * 2} height={FRAME_H + PAD * 2}>
              <PhoneBoard theme={t.theme} view="prioritize" />
            </DCArtboard>
          )}
          {showSheet && (
            <DCArtboard id="sheet"
              label="03 · Pipeline sheet open — full rail + end states"
              width={FRAME_W + PAD * 2} height={FRAME_H + PAD * 2}>
              <PhoneBoard theme={t.theme} view="sheet" initialSub="prioritize" />
            </DCArtboard>
          )}
          {showPreview && (
            <DCArtboard id="preview"
              label="04 · Previewing a future stage (read-only)"
              width={FRAME_W + PAD * 2} height={FRAME_H + PAD * 2}>
              <PhoneBoard theme={t.theme} view="main"
                mockCurrent={0} initialPreview={3} />
            </DCArtboard>
          )}
          {showRollback && (
            <DCArtboard id="rollback"
              label="05 · Rollback confirmation (past stage preview)"
              width={FRAME_W + PAD * 2} height={FRAME_H + PAD * 2}>
              <PhoneBoard theme={t.theme} view="main"
                mockCurrent={2} initialPreview={0} initialConfirm="rollback" />
            </DCArtboard>
          )}
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio label="Mode"
            value={t.theme}
            options={['light', 'dark']}
            onChange={(v) => setTweak('theme', v)} />
        </TweakSection>

        <TweakSection label="Artboards">
          <TweakSelect label="Show"
            value={t.focus}
            options={[
              { value: 'all', label: 'All five states' },
              { value: 'main', label: '01 · Main view' },
              { value: 'prioritize', label: '02 · Prioritize' },
              { value: 'sheet', label: '03 · Pipeline sheet' },
              { value: 'preview', label: '04 · Preview future stage' },
              { value: 'rollback', label: '05 · Rollback confirm' },
            ]}
            onChange={(v) => setTweak('focus', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
