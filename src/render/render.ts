/**
 * Orchestration: make a canvas the size of the raster, paint into it, hand the
 * bytes back. The only file that knows both `paintCard` and `encode.ts` exist.
 */

import { canvasLimitProblem, encoderFor, type RenderTarget } from '../lib/encode'
import type { ResolvedCard } from '../lib/resolve'
import type { Batch, Raster } from '../types'
import { type Ctx, paintCard } from './draw'
import { iconById } from './icons'
import { layoutCard } from './layout'

/**
 * `OffscreenCanvas` where it exists — it does not touch the DOM, so a batch of
 * a hundred cards does not thrash layout. Falls back to a detached `<canvas>`,
 * which every browser this runs in has.
 */
function makeCanvas(raster: Raster): RenderTarget {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(raster.w, raster.h)
  }
  const c = document.createElement('canvas')
  c.width = raster.w
  c.height = raster.h
  return c
}

function context2d(canvas: RenderTarget): Ctx {
  const ctx = canvas.getContext('2d') as Ctx | null
  if (!ctx) throw new Error('Could not get a 2D context — the browser refused a canvas this size.')
  return ctx
}

/**
 * Paint a resolved card into a canvas that is already the right size.
 *
 * Used by the preview (which then scales the canvas down with CSS) and by the
 * exporter. Both go through here so there is exactly one painting path.
 */
export function renderCardTo(canvas: RenderTarget, rc: ResolvedCard, batch: Batch, version: string): void {
  const ctx = context2d(canvas)
  const layout = layoutCard(rc.raster, batch.style)
  ctx.clearRect(0, 0, rc.raster.w, rc.raster.h)
  paintCard(ctx, layout, {
    name: rc.card.name,
    icon: iconById(rc.card.iconId),
    colour: rc.colour,
    style: batch.style,
    version,
  })
}

/**
 * Render one card to file bytes.
 *
 * The size check runs BEFORE anything is drawn. Browsers do not throw when a
 * canvas is over their limit — they hand back a blank one — so without this a
 * 16K batch would export a folder of perfectly-sized empty files and the
 * problem would surface on site.
 */
export async function renderCardBytes(
  rc: ResolvedCard,
  batch: Batch,
  version: string,
  quality: number | null,
): Promise<Uint8Array> {
  const problem = canvasLimitProblem(rc.raster.w, rc.raster.h)
  if (problem) throw new Error(`${rc.card.name || 'Card'}: ${problem}`)

  const canvas = makeCanvas(rc.raster)
  renderCardTo(canvas, rc, batch, version)
  return encoderFor(batch.format).encode(canvas, quality)
}
