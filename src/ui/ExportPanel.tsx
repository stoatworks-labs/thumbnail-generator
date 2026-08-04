/**
 * Format, filename policy, and the Generate button.
 */

import { useState } from 'react'

import { ENCODERS, encoderFor } from '../lib/encode'
import { download, exportBatch, formatBytes, type ExportProgress } from '../lib/export'
import { useStore } from '../state/store'
import type { FormatId } from '../types'
import { APP_VERSION } from '../version'

export function ExportPanel() {
  const batch = useStore((s) => s.batch)
  const exportOpts = useStore((s) => s.exportOpts)
  const { setFormat, setExportOpts } = useStore()

  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const encoder = encoderFor(batch.format)
  const busy = progress !== null
  const canExport = batch.cards.length > 0 && !busy

  async function run() {
    setError(null)
    setMessage(null)
    setProgress({ done: 0, total: batch.cards.length, current: '' })
    try {
      const result = await exportBatch(
        batch,
        APP_VERSION,
        {
          strictNames: exportOpts.strictNames,
          quality: encoder.defaultQuality === null ? null : exportOpts.quality,
          includeManifest: exportOpts.includeManifest,
        },
        setProgress,
      )
      download(result.blob, result.filename)
      const failed = result.failures.length
      setMessage(
        `${result.count} thumbnail${result.count === 1 ? '' : 's'}, ` +
          `${formatBytes(result.bytes)} — ${result.filename}` +
          (failed ? ` · ${failed} failed: ${result.failures.map((f) => f.name).join(', ')}` : ''),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Export</h2>
      </header>

      <div className="fields">
        <div className="field">
          <label htmlFor="format">Format</label>
          <div className="stack">
            <select
              id="format"
              value={batch.format}
              onChange={(e) => setFormat(e.target.value as FormatId)}
            >
              {Object.values(ENCODERS).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            {encoder.note && <p className="hint">{encoder.note}</p>}
            {encoder.defaultQuality !== null && (
              <label className="check">
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={exportOpts.quality}
                  onChange={(e) => setExportOpts({ quality: Number(e.target.value) })}
                />
                Quality {Math.round(exportOpts.quality * 100)}%
              </label>
            )}
          </div>
        </div>

        <div className="field">
          <span className="label">Files</span>
          <div className="stack">
            <label className="check">
              <input
                type="checkbox"
                checked={exportOpts.strictNames}
                onChange={(e) => setExportOpts({ strictNames: e.target.checked })}
              />
              Safe filenames (ASCII, underscores for spaces)
            </label>
            <p className="hint">
              Turn this on when the files are going straight onto a frame rather than onto a
              computer.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={exportOpts.includeManifest}
                onChange={(e) => setExportOpts({ includeManifest: e.target.checked })}
              />
              Include <code>manifest.csv</code>
            </label>
          </div>
        </div>
      </div>

      <button type="button" className="primary big" disabled={!canExport} onClick={run}>
        {busy
          ? `Rendering ${progress.done} of ${progress.total}…`
          : `Generate ${batch.cards.length} thumbnail${batch.cards.length === 1 ? '' : 's'}`}
      </button>

      {busy && (
        <progress
          className="bar"
          value={progress.done}
          max={progress.total}
          aria-label="Export progress"
        />
      )}
      {message && <p className="result ok">{message}</p>}
      {error && <p className="result bad">{error}</p>}
    </section>
  )
}
