/**
 * Where everything goes on a card. Pure numbers in, pure numbers out — no
 * canvas, no fonts, no DOM. This is the file to unit test.
 *
 * THE DESIGN SPACE
 * ================
 * The card is laid out in a 1920×1080 design space and scaled onto the real
 * raster. Every constant below is in design units.
 *
 * HOW THE SCALE IS CHOSEN
 * -----------------------
 * Driven by HEIGHT, not by containing the whole design:
 *
 *     scale = min(h / 1080, w / MIN_WIDTH)
 *
 * Containing 1920×1080 inside the raster is the obvious move and it is wrong.
 * On a 1080×1920 portrait card it yields scale 0.56 and paints a small
 * landscape-proportioned island in the middle of a tall card, which looks like
 * a bug. Scaling on height puts the same proportion of the card's height into
 * the icon whatever the aspect, which is what the reference cards do across
 * 16:9 and 2056×1329 alike.
 *
 * The `w / MIN_WIDTH` term is the guard for the other extreme: without it, a
 * tall narrow card scales the icon wider than the card. MIN_WIDTH is the icon
 * box plus its margins, so the term only ever binds on cards narrower than
 * about 1:2.6.
 *
 * The name box takes its width from the REAL raster, not the design space, so a
 * long label on a wide card uses the room it has instead of being shrunk to fit
 * a 1920-wide box that is not there.
 */

import type { Layout, Preset, PresetId, Raster, SizeMode, Style } from '../types'

const DESIGN_H = 1080
/** Icon box plus margins — the narrowest the design can be drawn without clipping. */
const MIN_WIDTH = 420

const ICON_BOX_W = 300
const ICON_BOX_H = 250
/** Icon baseline to cap height of the name. Measured off the reference cards. */
const ICON_NAME_GAP = 55
/** Generous enough for descenders and for two lines after a shrink-to-fit. */
const NAME_BOX_H = 150

const SIDE_MARGIN = 60
const HEADER_H = 64
const HEADER_TOP = 16
const FOOTER_H = 60
const FOOTER_BOTTOM = 30
const FOOTER_W = 700

export const PRESETS: Preset[] = [
  { id: 'hd1080', label: '1080p — 1920 × 1080', raster: { w: 1920, h: 1080 } },
  { id: 'hd720', label: '720p — 1280 × 720', raster: { w: 1280, h: 720 } },
  { id: 'uhd4k', label: '4K UHD — 3840 × 2160', raster: { w: 3840, h: 2160 } },
  { id: 'wuxga', label: 'WUXGA — 1920 × 1200', raster: { w: 1920, h: 1200 } },
  { id: 'wxga', label: 'WXGA — 1280 × 800', raster: { w: 1280, h: 800 } },
  { id: 'sxga', label: 'SXGA — 1280 × 1024', raster: { w: 1280, h: 1024 } },
  { id: 'square512', label: 'Square — 512 × 512', raster: { w: 512, h: 512 } },
  { id: 'thumb256', label: 'Small — 256 × 256', raster: { w: 256, h: 256 } },
]

const PRESET_BY_ID = new Map<PresetId, Preset>(PRESETS.map((p) => [p.id, p]))

export const DEFAULT_PRESET: PresetId = 'hd1080'

/**
 * Turn a `SizeMode` into real pixels.
 *
 * The aspect case rounds the derived edge and never lets it reach zero: a
 * 32:9 ratio at a 64px long edge would otherwise produce an 18px-tall card, and
 * a 256:9 one a 0px-tall canvas, which browsers treat as an error rather than
 * as an empty image.
 */
export function resolveRaster(size: SizeMode): Raster {
  switch (size.kind) {
    case 'preset': {
      const p = PRESET_BY_ID.get(size.id)
      return p ? { ...p.raster } : { w: 1920, h: 1080 }
    }
    case 'exact':
      return { w: Math.max(1, Math.round(size.w)), h: Math.max(1, Math.round(size.h)) }
    case 'aspect': {
      const wr = Math.max(1e-6, size.wRatio)
      const hr = Math.max(1e-6, size.hRatio)
      const long = Math.max(1, Math.round(size.longEdge))
      return wr >= hr
        ? { w: long, h: Math.max(1, Math.round((long * hr) / wr)) }
        : { w: Math.max(1, Math.round((long * wr) / hr)), h: long }
    }
  }
}

/** The scale factor from design units onto this raster. Exported for the tests. */
export function scaleFor(raster: Raster): number {
  return Math.min(raster.h / DESIGN_H, raster.w / MIN_WIDTH)
}

/**
 * Lay a card out.
 *
 * The icon and the name are treated as one block and that block is centred
 * vertically, which is why dropping the icon does not leave the name sitting
 * low on the card — the block just gets shorter and re-centres.
 *
 * Header and footer are positioned against the real raster edges, not against
 * the design space, so they stay in the corners at any aspect ratio.
 */
export function layoutCard(raster: Raster, style: Style): Layout {
  const s = scaleFor(raster)
  const showIcon = style.showIcon

  const blockH = (showIcon ? ICON_BOX_H + ICON_NAME_GAP : 0) + NAME_BOX_H
  const blockTop = (raster.h - blockH * s) / 2

  const iconBoxW = ICON_BOX_W * s
  const icon = showIcon
    ? {
        x: (raster.w - iconBoxW) / 2,
        y: blockTop,
        w: iconBoxW,
        h: ICON_BOX_H * s,
      }
    : null

  const side = SIDE_MARGIN * s
  const name = {
    x: side,
    y: blockTop + (showIcon ? (ICON_BOX_H + ICON_NAME_GAP) * s : 0),
    w: Math.max(1, raster.w - side * 2),
    h: NAME_BOX_H * s,
  }

  const header = style.showDimensions
    ? { x: side, y: HEADER_TOP * s, w: Math.max(1, raster.w - side * 2), h: HEADER_H * s }
    : null

  const footerW = Math.min(FOOTER_W * s, raster.w - side * 2)
  const footer = style.showFooter
    ? {
        x: raster.w - side - footerW,
        y: raster.h - (FOOTER_BOTTOM + FOOTER_H) * s,
        w: Math.max(1, footerW),
        h: FOOTER_H * s,
      }
    : null

  return { raster, scale: s, icon, name, header, footer }
}

/** "1920 x 1080" — the header text. Kept here so the tests can assert on it. */
export function dimensionLabel(raster: Raster): string {
  return `${raster.w} x ${raster.h}`
}
