/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfy",
  "focus": "compare",
  "theme": "dark"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const focused = t.focus;
  const showA = focused === 'compare' || focused === 'a';
  const showB = focused === 'compare' || focused === 'b';

  return (
    <>
      <DesignCanvas storageKey="jobkernel-jd-redesign-v2">
        <DCSection
          id="job-details"
          title="Job Details — refining the fold"
          subtitle="Header card + single vertical pipeline + action workspace"
        >
          {showA && (
            <DCArtboard id="A" label="A · Header Card + Vertical Pipeline" width={1280} height={820}>
              <VariationA density={t.density} theme={t.theme} />
            </DCArtboard>
          )}
          {showB && (
            <DCArtboard id="B" label="B · Slim Header + Three Columns" width={1280} height={820}>
              <VariationB density={t.density} theme={t.theme} />
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

        <TweakSection label="Density">
          <TweakRadio label="Padding"
            value={t.density}
            options={['comfy', 'compact']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Layout focus">
          <TweakSelect label="Show"
            value={t.focus}
            options={[
              { value: 'compare', label: 'Compare both' },
              { value: 'a', label: 'A · Header Card + Vertical Pipeline' },
              { value: 'b', label: 'B · Slim Header + Three Columns' },
            ]}
            onChange={(v) => setTweak('focus', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
