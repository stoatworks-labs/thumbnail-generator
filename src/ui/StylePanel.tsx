/**
 * Batch defaults and the card look. Everything here applies to every card;
 * per-card overrides live in the table.
 */

import { useStore } from '../state/store'
import { SizeControl } from './SizeControl'

export function StylePanel() {
  const batch = useStore((s) => s.batch)
  const { setDefaultSize, setDefaultColour, setAutoPalette, setStyle } = useStore()
  const s = batch.style

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Defaults &amp; look</h2>
      </header>

      <div className="fields">
        <div className="field">
          <label htmlFor="default-size-mode">Default size</label>
          {/* The batch default cannot be "inherit", so `allowInherit` is off
              and null can never come back out of the control. */}
          <SizeControl
            id="default-size"
            value={batch.defaultSize}
            onChange={(v) => v && setDefaultSize(v)}
          />
        </div>

        <div className="field">
          <label htmlFor="auto-palette">Colour</label>
          <div className="stack">
            <label className="check">
              <input
                id="auto-palette"
                type="checkbox"
                checked={batch.autoPalette}
                onChange={(e) => setAutoPalette(e.target.checked)}
              />
              Give each source its own colour automatically
            </label>
            {!batch.autoPalette && (
              <label className="check">
                <input
                  type="color"
                  aria-label="Default colour"
                  value={batch.defaultColour}
                  onChange={(e) => setDefaultColour(e.target.value)}
                />
                Default colour for sources you have not set
              </label>
            )}
          </div>
        </div>

        <div className="field">
          <span className="label">Card</span>
          <div className="stack">
            <label className="check">
              <input
                type="checkbox"
                checked={s.showIcon}
                onChange={(e) => setStyle({ showIcon: e.target.checked })}
              />
              Show the icon
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.gradient}
                onChange={(e) => setStyle({ gradient: e.target.checked })}
              />
              Radial gradient background
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.showDimensions}
                onChange={(e) => setStyle({ showDimensions: e.target.checked })}
              />
              Dimension label along the top
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.showFooter}
                onChange={(e) => setStyle({ showFooter: e.target.checked })}
              />
              Footer text, bottom right
            </label>
            {s.showFooter && (
              <input
                type="text"
                className="footer-text"
                aria-label="Footer text"
                value={s.footerText}
                placeholder="Footer text"
                onChange={(e) => setStyle({ footerText: e.target.value })}
              />
            )}
            {s.showFooter && (
              <p className="hint">
                <code>{'{version}'}</code> is replaced with this tool&rsquo;s version.
              </p>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="text-tone">Text</label>
          <select
            id="text-tone"
            value={s.textTone}
            onChange={(e) => setStyle({ textTone: e.target.value as typeof s.textTone })}
          >
            <option value="light">Always white</option>
            <option value="dark">Always black</option>
            <option value="auto">Pick per card by contrast</option>
          </select>
        </div>
      </div>
    </section>
  )
}
