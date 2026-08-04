/**
 * The painters. Everything that touches a `CanvasRenderingContext2D` lives
 * here, and it makes no layout decisions — `layout.ts` hands it boxes and it
 * fills them.
 *
 * 1 canvas unit = 1 raster pixel, always. There is no device-pixel-ratio
 * business in this file: the export canvas IS the output raster, and the
 * preview scales itself down with CSS rather than by drawing smaller, so what
 * you see is what the file contains.
 *
 * No strokes. Every mark is a fill, so nothing needs the half-pixel offset that
 * keeps a 1px line from rendering as two grey rows.
 */

import { autoTextColour, gradientStops } from '../lib/colour'
import type { Layout, Rect, Style, TextTone } from '../types'
import { dimensionLabel } from './layout'
import { type Icon, type Shape, iconBounds } from './icons'

/**
 * FONTS AND DETERMINISM — read before changing.
 *
 * This is a system font stack, so a card generated on this Mac and the same
 * card generated on a Windows PC will differ slightly in letterform and
 * therefore in shrink-to-fit width. For labels like "PC 2" this is invisible;
 * it is still a real caveat for anyone diffing outputs across machines.
 *
 * The fix, if it ever matters, is to vendor one OFL-licensed light sans as a
 * woff2 in `public/`, load it with the FontFace API, and await
 * `document.fonts.ready` before the first render. The CSP already permits it
 * (`font-src 'self' data:`) and nothing else in this file would change. It is
 * not done yet because it is a binary in the repo and an ATTRIBUTIONS entry,
 * for a difference no one has asked to see.
 */
const FONT_STACK = '"Lato", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif'

/** Light, to match the reference cards. The footer is the one heavy element. */
const WEIGHT_LIGHT = 300
const WEIGHT_BOLD = 600

/** Font size as a fraction of its box height, per role. */
const NAME_RATIO = 0.94
const HEADER_RATIO = 0.78
const FOOTER_RATIO = 0.8

/** How far shrink-to-fit may go before the label wraps to two lines instead. */
const MIN_SHRINK = 0.55

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function addShape(path: Path2D, s: Shape): void {
  switch (s.t) {
    case 'rrect':
      addRoundRect(path, s.x, s.y, s.w, s.h, s.r)
      break
    case 'circle':
      path.moveTo(s.cx + s.r, s.cy)
      path.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      break
    case 'ellipse':
      path.moveTo(s.cx + s.rx, s.cy)
      path.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2)
      break
    case 'poly': {
      s.pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)))
      path.closePath()
      break
    }
  }
}

/**
 * Rounded rectangle by hand rather than via `Path2D.roundRect`.
 *
 * roundRect is recent enough that it is missing from older Safari and from
 * jsdom, and a missing method here would throw mid-render rather than degrade.
 * Radius is clamped to half the shorter side, or a large radius on a thin
 * shape produces arcs that cross over and fill inside out.
 */
function addRoundRect(p: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  p.moveTo(x + rr, y)
  p.lineTo(x + w - rr, y)
  p.arcTo(x + w, y, x + w, y + rr, rr)
  p.lineTo(x + w, y + h - rr)
  p.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  p.lineTo(x + rr, y + h)
  p.arcTo(x, y + h, x, y + h - rr, rr)
  p.lineTo(x, y + rr)
  p.arcTo(x, y, x + rr, y, rr)
  p.closePath()
}

/**
 * Paint an icon to fill `box`, preserving its aspect ratio.
 *
 * Each part is filled separately with the even-odd rule so its holes knock
 * through, and parts are filled in order so a later one can cover an earlier
 * one's hole.
 */
export function drawIcon(ctx: Ctx, icon: Icon, box: Rect, colour: string): void {
  const b = iconBounds(icon)
  if (!b || b.w <= 0 || b.h <= 0) return

  const s = Math.min(box.w / b.w, box.h / b.h)
  const dx = box.x + (box.w - b.w * s) / 2 - b.x * s
  const dy = box.y + (box.h - b.h * s) / 2 - b.y * s

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.translate(dx, dy)
  ctx.scale(s, s)
  ctx.fillStyle = colour
  for (const part of icon.parts) {
    const path = new Path2D()
    for (const sh of part.shapes) addShape(path, sh)
    for (const sh of part.holes ?? []) addShape(path, sh)
    ctx.fill(path, 'evenodd')
  }
  ctx.restore()
}

/** Split a label into two roughly equal lines, breaking on whitespace only. */
function splitTwoLines(text: string): [string, string] | null {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  // Pick the break that gets the two halves closest in character count.
  let best = 1
  let bestDelta = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    const d = Math.abs(a - b)
    if (d < bestDelta) {
      bestDelta = d
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

function setFont(ctx: Ctx, size: number, weight: number): void {
  ctx.font = `${weight} ${size}px ${FONT_STACK}`
}

/**
 * Draw text to fit a box: shrink first, then wrap to two lines if shrinking
 * alone would make it too small.
 *
 * Vertical placement uses the measured ink (`actualBoundingBoxAscent` /
 * `Descent`) rather than the font's nominal metrics, so "PC 2" and "Playback"
 * both sit optically centred instead of the second one riding high because it
 * has a descender. Where a browser reports no ink metrics the em-box estimate
 * is close enough not to matter.
 */
export function drawFittedText(
  ctx: Ctx,
  text: string,
  box: Rect,
  opts: { weight: number; align: CanvasTextAlign; colour: string; sizeRatio: number },
): void {
  const label = text.trim()
  if (!label) return

  const startSize = box.h * opts.sizeRatio
  ctx.textAlign = opts.align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = opts.colour

  let size = startSize
  setFont(ctx, size, opts.weight)
  let lines: string[] = [label]
  let width = ctx.measureText(label).width

  if (width > box.w) {
    const shrunk = size * (box.w / width)
    if (shrunk >= startSize * MIN_SHRINK) {
      size = shrunk
    } else {
      const two = splitTwoLines(label)
      if (two) {
        // Two lines share the box height, so each starts smaller.
        lines = two
        size = startSize * 0.56
        setFont(ctx, size, opts.weight)
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
        if (widest > box.w) size *= box.w / widest
      } else {
        // A single unbreakable word. Shrink past the floor rather than clip it.
        size = shrunk
      }
    }
    setFont(ctx, size, opts.weight)
  }

  const x = opts.align === 'right' ? box.x + box.w : opts.align === 'left' ? box.x : box.x + box.w / 2

  if (lines.length === 1) {
    const m = ctx.measureText(lines[0]!)
    const asc = m.actualBoundingBoxAscent || size * 0.72
    const desc = m.actualBoundingBoxDescent || size * 0.2
    ctx.fillText(lines[0]!, x, box.y + (box.h + asc - desc) / 2)
    return
  }

  const lineHeight = size * 1.14
  const blockH = lineHeight * lines.length
  const first = box.y + (box.h - blockH) / 2
  lines.forEach((line, i) => {
    const m = ctx.measureText(line)
    const asc = m.actualBoundingBoxAscent || size * 0.72
    const desc = m.actualBoundingBoxDescent || size * 0.2
    ctx.fillText(line, x, first + i * lineHeight + (lineHeight + asc - desc) / 2)
  })
}

function paintBackground(ctx: Ctx, layout: Layout, base: string, gradient: boolean): string {
  const { centre, edge } = gradientStops(base, gradient)
  const { w, h } = layout.raster

  if (!gradient) {
    ctx.fillStyle = centre
    ctx.fillRect(0, 0, w, h)
    return centre
  }

  // Centred slightly above middle, matching the reference cards — the icon sits
  // in the brightest part and the name just below it.
  const cx = w * 0.5
  const cy = h * 0.45
  // Reach the edge colour exactly at the furthest corner, so the corners are
  // fully dark and nothing is left flat.
  const r = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy),
  )
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, centre)
  g.addColorStop(1, edge)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  return centre
}

function inkColour(tone: TextTone, centreHex: string): string {
  if (tone === 'light') return '#ffffff'
  if (tone === 'dark') return '#000000'
  return autoTextColour(centreHex)
}

export type CardPaint = {
  name: string
  icon: Icon
  colour: string
  style: Style
  /** Substituted into the footer for `{version}`. */
  version: string
}

/**
 * Paint one whole card.
 *
 * THE PREVIEW AND THE EXPORT BOTH CALL THIS. Do not add a second painter for
 * the preview, however tempting — the moment there are two, they drift, and the
 * bug you get is a card that looked right on screen and is wrong in the ZIP.
 */
export function paintCard(ctx: Ctx, layout: Layout, card: CardPaint): void {
  const { style } = card
  const centre = paintBackground(ctx, layout, card.colour, style.gradient)
  const ink = inkColour(style.textTone, centre)

  if (layout.icon && style.showIcon) {
    drawIcon(ctx, card.icon, layout.icon, ink)
  }

  drawFittedText(ctx, card.name, layout.name, {
    weight: WEIGHT_LIGHT,
    align: 'center',
    colour: ink,
    sizeRatio: NAME_RATIO,
  })

  if (layout.header) {
    drawFittedText(ctx, dimensionLabel(layout.raster), layout.header, {
      weight: WEIGHT_LIGHT,
      align: 'center',
      colour: ink,
      sizeRatio: HEADER_RATIO,
    })
  }

  if (layout.footer) {
    drawFittedText(ctx, style.footerText.replace(/\{version\}/g, card.version), layout.footer, {
      weight: WEIGHT_BOLD,
      align: 'right',
      colour: ink,
      sizeRatio: FOOTER_RATIO,
    })
  }
}
