/**
 * End-to-end cover for the export chain: resolve → paint → encode → name →
 * pack. The canvas is stubbed, so this asserts everything EXCEPT the pixels a
 * real browser would draw — which is the part a unit test cannot see anyway,
 * and which `draw.ts` keeps honest by having the preview and the export call
 * the same painter.
 *
 * What it is really guarding is the join: that forty sources come out as forty
 * uniquely-named entries plus a manifest that agrees with them, and that one
 * bad card does not take the batch down with it.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { exportBatch, formatBytes } from './export'
import { INITIAL_BATCH, newCard } from '../state/defaults'
import type { Batch } from '../types'

/** Absorbs every canvas call; returns plausible values where one is read. */
function fakeContext() {
  const gradient = { addColorStop() {} }
  return new Proxy(
    {
      measureText: (t: string) => ({
        width: t.length * 40,
        actualBoundingBoxAscent: 70,
        actualBoundingBoxDescent: 20,
      }),
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop in target) return target[prop as string]
        // Everything else is a no-op method; property reads return undefined,
        // which is fine because the painter only ever writes them.
        return () => undefined
      },
      set() {
        return true
      },
    },
  )
}

/** Bytes that stand in for an encoded image, distinct per size so we can tell them apart. */
function fakeImageBytes(w: number, h: number): Uint8Array {
  return new TextEncoder().encode(`IMAGE ${w}x${h}`)
}

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return fakeContext()
  }
  async convertToBlob({ type }: { type: string }) {
    // .slice() to get a Uint8Array backed by a plain ArrayBuffer — TextEncoder
    // returns one typed as ArrayBufferLike, which Blob's signature rejects.
    return new Blob([fakeImageBytes(this.width, this.height).slice()], { type })
  }
}

const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}

beforeAll(() => {
  for (const k of ['OffscreenCanvas', 'Path2D']) saved[k] = g[k]
  g.OffscreenCanvas = FakeOffscreenCanvas
  g.Path2D = class {
    moveTo() {}
    lineTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    closePath() {}
  }
})

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete g[k]
    else g[k] = v
  }
})

const batchOf = (names: string[], patch: Partial<Batch> = {}): Batch => ({
  ...INITIAL_BATCH,
  cards: names.map((n) => newCard(n)),
  ...patch,
})

async function unzipNames(blob: Blob): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'tg-exp-'))
  const path = join(dir, 'out.zip')
  writeFileSync(path, new Uint8Array(await blob.arrayBuffer()))
  const out = execFileSync(
    'python3',
    ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', path],
    { encoding: 'utf8' },
  )
  return out.trim().split('\n')
}

async function readEntry(blob: Blob, name: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'tg-exp-'))
  const path = join(dir, 'out.zip')
  writeFileSync(path, new Uint8Array(await blob.arrayBuffer()))
  execFileSync('python3', [
    '-c',
    'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
    path,
    dir,
  ])
  return readFileSync(join(dir, name), 'utf8')
}

const OPTS = { strictNames: false, quality: null, includeManifest: true }

describe('exportBatch', () => {
  it('refuses an empty batch rather than making an empty archive', async () => {
    await expect(exportBatch(batchOf([]), 'v1', OPTS)).rejects.toThrow(/no sources/i)
  })

  it('produces one entry per source, plus the manifest', async () => {
    const result = await exportBatch(batchOf(['PC 1', 'PC 2', 'Camera 1']), 'v1', OPTS)
    expect(result.count).toBe(3)
    expect(result.failures).toEqual([])
    expect(await unzipNames(result.blob)).toEqual([
      'PC 1.png',
      'PC 2.png',
      'Camera 1.png',
      'manifest.csv',
    ])
  })

  it('leaves the manifest out when asked', async () => {
    const result = await exportBatch(batchOf(['A']), 'v1', { ...OPTS, includeManifest: false })
    expect(await unzipNames(result.blob)).toEqual(['A.png'])
    expect(result.count).toBe(1)
  })

  it('de-duplicates names so no card is silently lost', async () => {
    // Two inputs called "Laptop" is normal on a real rig, and a ZIP with two
    // identical names extracts to one file.
    const result = await exportBatch(batchOf(['Laptop', 'Laptop', 'Laptop']), 'v1', OPTS)
    const names = (await unzipNames(result.blob)).filter((n) => n !== 'manifest.csv')
    expect(names).toEqual(['Laptop.png', 'Laptop-2.png', 'Laptop-3.png'])
    expect(result.count).toBe(3)
  })

  it('writes a manifest whose filenames match the entries actually packed', async () => {
    const result = await exportBatch(batchOf(['Laptop', 'Laptop', 'Régie']), 'v1', OPTS)
    const csv = await readEntry(result.blob, 'manifest.csv')
    const rows = csv.trim().split('\n')
    expect(rows[0]).toBe('file,source name,raster,colour,icon')
    expect(rows).toHaveLength(4)

    const entries = (await unzipNames(result.blob)).filter((n) => n !== 'manifest.csv')
    const listed = rows.slice(1).map((r) => r.split(',')[0]!)
    expect(listed).toEqual(entries)
    expect(csv).toContain('1920x1080')
  })

  it('honours the strict filename policy', async () => {
    const result = await exportBatch(batchOf(['Régie Café', 'PC 2']), 'v1', {
      ...OPTS,
      strictNames: true,
    })
    const names = (await unzipNames(result.blob)).filter((n) => n !== 'manifest.csv')
    expect(names).toEqual(['Regie_Cafe.png', 'PC_2.png'])
  })

  it('uses the per-card raster override, not just the batch default', async () => {
    const batch = batchOf(['Big', 'Small'])
    batch.cards[0]!.size = { kind: 'exact', w: 2056, h: 1329 }
    const result = await exportBatch(batch, 'v1', OPTS)
    // The stub encodes its own dimensions, so the bytes prove which raster the
    // canvas was actually made at.
    expect(await readEntry(result.blob, 'Big.png')).toBe('IMAGE 2056x1329')
    expect(await readEntry(result.blob, 'Small.png')).toBe('IMAGE 1920x1080')
  })

  it('survives one bad card instead of losing the whole batch', async () => {
    const batch = batchOf(['Good 1', 'Oversized', 'Good 2'])
    // Past the canvas area limit, which is checked before anything is drawn.
    batch.cards[1]!.size = { kind: 'exact', w: 16000, h: 16000 }
    const result = await exportBatch(batch, 'v1', OPTS)
    expect(result.count).toBe(2)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]!.name).toBe('Oversized')
    expect(result.failures[0]!.reason).toMatch(/canvas/i)
    const names = (await unzipNames(result.blob)).filter((n) => n !== 'manifest.csv')
    expect(names).toEqual(['Good 1.png', 'Good 2.png'])
  })

  it('throws when every card fails, rather than handing back an empty ZIP', async () => {
    const batch = batchOf(['A', 'B'])
    for (const c of batch.cards) c.size = { kind: 'exact', w: 16000, h: 16000 }
    await expect(exportBatch(batch, 'v1', OPTS)).rejects.toThrow(/every card failed/i)
  })

  it('reports progress across the batch', async () => {
    const seen: number[] = []
    await exportBatch(batchOf(['A', 'B', 'C']), 'v1', OPTS, (p) => seen.push(p.done))
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(3)
  })

  it('scales to a realistic batch without collisions', async () => {
    const names = Array.from({ length: 48 }, (_, i) => `Input ${i + 1}`)
    const result = await exportBatch(batchOf(names), 'v1', OPTS)
    const entries = (await unzipNames(result.blob)).filter((n) => n !== 'manifest.csv')
    expect(entries).toHaveLength(48)
    expect(new Set(entries).size).toBe(48)
  })
})

describe('formatBytes', () => {
  it('reads naturally at each scale', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(6.4 * 1024 * 1024)).toBe('6.4 MB')
  })
})
