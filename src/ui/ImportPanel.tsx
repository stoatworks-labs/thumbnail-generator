/**
 * Importing a source list: a file, a paste, or a published Google Sheet.
 *
 * NOTHING IS APPLIED UNTIL THE USER HAS SEEN WHAT PARSED.
 * ======================================================
 * Every path lands on the same staged preview — how many sources, which
 * columns were matched to which headings, which headings were ignored, and
 * every value that could not be understood. Only then are the Add/Replace
 * buttons live.
 *
 * That is the whole point of the feature. Importing forty rows straight into
 * the batch would hide exactly the mistakes worth catching: a size column that
 * says `1920*1080`, an icon column full of a vocabulary this tool does not
 * know, a spreadsheet whose first row is data rather than headings.
 */

import { useRef, useState } from 'react'

import { parseDelimited } from '../import/csv'
import { rowsToCards, type ImportResult } from '../import/mapping'
import { fetchSheetCsv, normaliseSheetUrl, SheetFetchError } from '../import/sheets'
import { downloadTemplate, SHEETS_STEPS } from '../import/template'
import { useStore } from '../state/store'

type Mode = 'file' | 'paste' | 'sheet'

export function ImportPanel() {
  const importCards = useStore((s) => s.importCards)
  const existingCount = useStore((s) => s.batch.cards.length)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('file')
  const [paste, setPaste] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [staged, setStaged] = useState<ImportResult | null>(null)
  const [source, setSource] = useState<string>('')
  const [error, setError] = useState<{ message: string; advice: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function stage(text: string, from: string) {
    setError(null)
    const result = rowsToCards(parseDelimited(text))
    if (result.cards.length === 0) {
      setStaged(null)
      setError({
        message: 'Nothing in that had a source name in it.',
        advice: 'The first column should be the source name, or there should be a "name" heading.',
      })
      return
    }
    setSource(from)
    setStaged(result)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      stage(await file.text(), file.name)
    } catch {
      setError({ message: 'That file could not be read.', advice: null })
    } finally {
      setBusy(false)
    }
  }

  async function onSheet() {
    setBusy(true)
    setError(null)
    setStaged(null)
    try {
      const { csv, normalised } = await fetchSheetCsv(sheetUrl)
      stage(csv, normalised.kind === 'published' ? 'the published sheet' : 'the sheet')
    } catch (err) {
      if (err instanceof SheetFetchError) setError({ message: err.message, advice: err.advice })
      else setError({ message: (err as Error).message, advice: null })
    } finally {
      setBusy(false)
    }
  }

  function apply(replace: boolean) {
    if (!staged) return
    importCards(staged.cards, replace)
    setStaged(null)
    setPaste('')
    setOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Import</h2>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Import a list'}
        </button>
      </header>

      {!open ? (
        <p className="hint">
          Bring a source list in from a CSV, a paste, or a published Google Sheet — with the icon,
          colour and size for each if you have them.
        </p>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Import source">
            {(
              [
                ['file', 'CSV file'],
                ['paste', 'Paste'],
                ['sheet', 'Google Sheet'],
              ] as [Mode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={mode === id ? 'tab active' : 'tab'}
                onClick={() => {
                  setMode(id)
                  setStaged(null)
                  setError(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'file' && (
            <div className="import-body">
              <label htmlFor="import-file">Choose a .csv or .tsv file</label>
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          )}

          {mode === 'paste' && (
            <div className="import-body">
              <label htmlFor="import-paste">
                Paste rows — copying straight out of a spreadsheet works
              </label>
              <textarea
                id="import-paste"
                rows={6}
                value={paste}
                placeholder={'name,icon,colour,size\nPC 1,laptop,#1f6fd0,1920x1080\nCamera 1,camera,red,'}
                onChange={(e) => setPaste(e.target.value)}
              />
              <button
                type="button"
                disabled={!paste.trim()}
                onClick={() => stage(paste, 'the pasted rows')}
              >
                Read it
              </button>
            </div>
          )}

          {mode === 'sheet' && (
            <div className="import-body">
              <label htmlFor="import-sheet">Published Google Sheet link</label>
              <input
                id="import-sheet"
                type="url"
                value={sheetUrl}
                placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              {/* Shown BEFORE fetching. Telling someone their link is the
                  wrong shape only after a failed request wastes the round trip
                  and reads like the tool is broken. */}
              {(() => {
                const n = sheetUrl.trim() ? normaliseSheetUrl(sheetUrl) : null
                return n?.warning ? <p className="pre-warning">{n.warning}</p> : null
              })()}
              <button type="button" disabled={!sheetUrl.trim() || busy} onClick={onSheet}>
                {busy ? 'Fetching…' : 'Fetch it'}
              </button>
              <details className="sheets-help">
                <summary>How to publish a sheet</summary>
                <ol>
                  {SHEETS_STEPS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
            </div>
          )}

          <div className="import-template">
            <button type="button" className="link" onClick={() => downloadTemplate()}>
              Download a template CSV
            </button>
            <span className="hint">
              Columns: <code>name</code>, <code>icon</code>, <code>colour</code>, <code>size</code>.
              Only <code>name</code> is required; a blank cell uses the batch default.
            </span>
          </div>

          {error && (
            <p className="result bad">
              {error.message}
              {error.advice && <span className="advice"> {error.advice}</span>}
            </p>
          )}

          {staged && <StagedPreview result={staged} from={source} existing={existingCount} onApply={apply} />}
        </>
      )}
    </section>
  )
}

function StagedPreview({
  result,
  from,
  existing,
  onApply,
}: {
  result: ImportResult
  from: string
  existing: number
  onApply: (replace: boolean) => void
}) {
  const n = result.cards.length
  return (
    <div className="staged">
      <p className="staged-head">
        <strong>
          {n} source{n === 1 ? '' : 's'}
        </strong>{' '}
        read from {from}.
      </p>

      <ul className="staged-facts">
        {result.positional ? (
          <li>
            No column headings were recognised, so columns were read in order: name, icon, colour,
            size.
          </li>
        ) : (
          <li>
            Columns used:{' '}
            {(Object.entries(result.matched) as [string, string][])
              .map(([field, header]) => `${field} ← “${header}”`)
              .join(', ')}
            .
          </li>
        )}
        {result.ignoredHeaders.length > 0 && (
          <li>Ignored: {result.ignoredHeaders.map((h) => `“${h}”`).join(', ')}.</li>
        )}
      </ul>

      {result.warnings.length > 0 && (
        <details className="warnings" open={result.warnings.length <= 6}>
          <summary>
            {result.warnings.length} value{result.warnings.length === 1 ? '' : 's'} not understood —
            the batch default was used
          </summary>
          <ul>
            {result.warnings.slice(0, 40).map((w, i) => (
              <li key={i}>
                Row {w.row}, {w.field}: “{w.value}” — {w.message}
              </li>
            ))}
            {result.warnings.length > 40 && <li>…and {result.warnings.length - 40} more.</li>}
          </ul>
        </details>
      )}

      <ul className="staged-names">
        {result.cards.slice(0, 8).map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
        {n > 8 && <li className="more">…and {n - 8} more</li>}
      </ul>

      <div className="staged-actions">
        <button type="button" className="primary" onClick={() => onApply(false)}>
          Add {n} to the {existing} already there
        </button>
        <button
          type="button"
          onClick={() => {
            if (existing === 0 || confirm(`Replace all ${existing} sources with these ${n}?`)) {
              onApply(true)
            }
          }}
        >
          Replace everything
        </button>
      </div>
    </div>
  )
}
