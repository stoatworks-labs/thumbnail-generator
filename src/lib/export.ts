/**
 * Building the ZIP: render every card, name the files, pack, download.
 */

import { encoderFor } from './encode'
import { safeStem, uniqueNames } from './filename'
import { renderCardBytes } from '../render/render'
import { resolveAll } from './resolve'
import type { Batch } from '../types'
import { buildZip, type ZipEntry } from './zip'

export type ExportOptions = {
  /** ASCII-only filenames. For targets that are a device rather than a computer. */
  strictNames: boolean
  /** JPEG quality, ignored by formats that have no quality knob. */
  quality: number | null
  includeManifest: boolean
}

export type ExportProgress = { done: number; total: number; current: string }

export type ExportResult = {
  blob: Blob
  filename: string
  count: number
  /** Archive size in bytes. Worth showing: a PNG batch gets big fast. */
  bytes: number
  /** Cards that failed, by name. The rest of the batch still exports. */
  failures: { name: string; reason: string }[]
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A CSV of what is in the archive.
 *
 * The point is the round trip back to the desk: once these are loaded onto a
 * frame, someone has to match "which file went with which input", and doing
 * that from a folder of images means opening all of them. Colour and raster are
 * in there because they are the two things people ask about afterwards.
 */
function manifestCsv(rows: { file: string; name: string; raster: string; colour: string; icon: string }[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [['file', 'source name', 'raster', 'colour', 'icon'].join(',')]
  for (const r of rows) {
    lines.push([r.file, r.name, r.raster, r.colour, r.icon].map(esc).join(','))
  }
  // Trailing newline: without one, `tail` and a few spreadsheet importers drop
  // or mangle the last row.
  return lines.join('\n') + '\n'
}

/** `thumbnails-2026-08-05-1432.zip` — sorts chronologically in a downloads folder. */
export function archiveName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `thumbnails-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.zip`
}

/**
 * Render and pack a whole batch.
 *
 * One card failing does not sink the export — it is collected into `failures`
 * and reported, because losing thirty-nine good cards to one bad raster is a
 * worse outcome than an archive with a gap in it that is named in the summary.
 */
export async function exportBatch(
  batch: Batch,
  version: string,
  opts: ExportOptions,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const resolved = resolveAll(batch)
  if (resolved.length === 0) throw new Error('There are no sources to export.')

  const ext = encoderFor(batch.format).ext
  const names = uniqueNames(resolved.map((r) => `${safeStem(r.card.name, opts.strictNames)}${ext}`))

  const entries: ZipEntry[] = []
  const failures: ExportResult['failures'] = []
  const rows: Parameters<typeof manifestCsv>[0] = []

  for (let i = 0; i < resolved.length; i++) {
    const rc = resolved[i]!
    const file = names[i]!
    onProgress?.({ done: i, total: resolved.length, current: rc.card.name })
    try {
      const data = await renderCardBytes(rc, batch, version, opts.quality)
      entries.push({ name: file, data })
      rows.push({
        file,
        name: rc.card.name,
        raster: `${rc.raster.w}x${rc.raster.h}`,
        colour: rc.colour,
        icon: rc.card.iconId,
      })
    } catch (err) {
      failures.push({ name: rc.card.name || `Card ${i + 1}`, reason: (err as Error).message })
    }
    // Yield to the event loop so the progress bar actually paints. Without
    // this the whole batch runs in one task and the UI is frozen throughout.
    await new Promise((r) => setTimeout(r, 0))
  }

  if (entries.length === 0) {
    throw new Error(`Every card failed to render. First reason: ${failures[0]?.reason ?? 'unknown'}`)
  }

  if (opts.includeManifest) {
    entries.push({
      name: 'manifest.csv',
      data: new TextEncoder().encode(manifestCsv(rows)),
    })
  }

  onProgress?.({ done: resolved.length, total: resolved.length, current: '' })
  const zip = buildZip(entries)
  // Copy into a fresh buffer: `zip` is a view over a larger allocation in
  // some engines, and Blob would otherwise capture the slack too.
  const blob = new Blob([zip.slice()], { type: 'application/zip' })
  return {
    blob,
    filename: archiveName(),
    count: entries.length - (opts.includeManifest ? 1 : 0),
    bytes: blob.size,
    failures,
  }
}

/** Hand a blob to the browser as a download. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously cancels the download in Firefox; one turn later is
  // enough for the navigation to have been taken.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
