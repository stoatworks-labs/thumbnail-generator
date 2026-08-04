import { describe, expect, it } from 'vitest'

import { DEFAULT_STYLE } from '../state/defaults'
import type { Raster, Style } from '../types'
import { dimensionLabel, layoutCard, resolveRaster, scaleFor } from './layout'

const style = (patch: Partial<Style> = {}): Style => ({ ...DEFAULT_STYLE, ...patch })

describe('resolveRaster', () => {
  it('returns preset pixels', () => {
    expect(resolveRaster({ kind: 'preset', id: 'hd1080' })).toEqual({ w: 1920, h: 1080 })
    expect(resolveRaster({ kind: 'preset', id: 'uhd4k' })).toEqual({ w: 3840, h: 2160 })
  })

  it('rounds exact sizes and never goes below 1px', () => {
    expect(resolveRaster({ kind: 'exact', w: 1920.4, h: 1080.6 })).toEqual({ w: 1920, h: 1081 })
    expect(resolveRaster({ kind: 'exact', w: 0, h: -5 })).toEqual({ w: 1, h: 1 })
  })

  it('derives the short edge from an aspect ratio, landscape or portrait', () => {
    expect(resolveRaster({ kind: 'aspect', wRatio: 16, hRatio: 9, longEdge: 1920 })).toEqual({
      w: 1920,
      h: 1080,
    })
    expect(resolveRaster({ kind: 'aspect', wRatio: 9, hRatio: 16, longEdge: 1920 })).toEqual({
      w: 1080,
      h: 1920,
    })
    expect(resolveRaster({ kind: 'aspect', wRatio: 1, hRatio: 1, longEdge: 512 })).toEqual({
      w: 512,
      h: 512,
    })
  })

  it('never derives a zero edge from an extreme ratio', () => {
    // 256:9 at a 64px long edge rounds the short edge to 2, not 0 — a 0px
    // canvas is an error in the browser, not an empty image.
    const r = resolveRaster({ kind: 'aspect', wRatio: 256, hRatio: 9, longEdge: 64 })
    expect(r.h).toBeGreaterThanOrEqual(1)
    expect(r.w).toBe(64)
  })
})

describe('scaleFor', () => {
  it('is 1 at the design size', () => {
    expect(scaleFor({ w: 1920, h: 1080 })).toBe(1)
  })

  it('tracks height, so aspect ratio alone does not shrink the card', () => {
    // An ultrawide 3840x1080 has the same height as 1080p and must draw the
    // icon at the same size, not shrink it to fit a contained design box.
    expect(scaleFor({ w: 3840, h: 1080 })).toBe(1)
  })

  it('scales up for portrait rather than painting a small landscape island', () => {
    expect(scaleFor({ w: 1080, h: 1920 })).toBeCloseTo(1920 / 1080, 5)
  })

  it('is clamped by width on very narrow cards', () => {
    // Without the width term the icon would be drawn wider than the card.
    expect(scaleFor({ w: 200, h: 1080 })).toBeCloseTo(200 / 420, 5)
  })
})

describe('layoutCard', () => {
  const check = (raster: Raster, s: Style) => layoutCard(raster, s)

  it('centres the icon horizontally', () => {
    const l = check({ w: 1920, h: 1080 }, style())
    expect(l.icon).not.toBeNull()
    expect(l.icon!.x + l.icon!.w / 2).toBeCloseTo(960, 5)
  })

  it('centres the icon-and-name block vertically', () => {
    const l = check({ w: 1920, h: 1080 }, style())
    const top = l.icon!.y
    const bottom = l.name.y + l.name.h
    expect((top + bottom) / 2).toBeCloseTo(540, 5)
  })

  it('re-centres the name when the icon is off, rather than leaving it low', () => {
    const l = check({ w: 1920, h: 1080 }, style({ showIcon: false }))
    expect(l.icon).toBeNull()
    expect(l.name.y + l.name.h / 2).toBeCloseTo(540, 5)
  })

  it('omits header and footer boxes when they are switched off', () => {
    const l = check({ w: 1920, h: 1080 }, style({ showDimensions: false, showFooter: false }))
    expect(l.header).toBeNull()
    expect(l.footer).toBeNull()
  })

  it('keeps the footer inside the raster and hard against the right margin', () => {
    const l = check({ w: 1920, h: 1080 }, style())
    expect(l.footer!.x).toBeGreaterThanOrEqual(0)
    expect(l.footer!.x + l.footer!.w).toBeCloseTo(1920 - 60, 5)
    expect(l.footer!.y + l.footer!.h).toBeLessThanOrEqual(1080)
  })

  it('keeps every box inside the raster across awkward aspect ratios', () => {
    const rasters: Raster[] = [
      { w: 1920, h: 1080 },
      { w: 2056, h: 1329 },
      { w: 3840, h: 2160 },
      { w: 512, h: 512 },
      { w: 256, h: 256 },
      { w: 1080, h: 1920 },
      { w: 3840, h: 1080 },
      { w: 200, h: 1080 },
      { w: 1920, h: 200 },
    ]
    for (const r of rasters) {
      const l = layoutCard(r, style())
      for (const [what, box] of Object.entries({
        icon: l.icon,
        name: l.name,
        header: l.header,
        footer: l.footer,
      })) {
        if (!box) continue
        const where = `${what} on ${r.w}x${r.h}`
        expect(box.x, where).toBeGreaterThanOrEqual(-0.001)
        expect(box.y, where).toBeGreaterThanOrEqual(-0.001)
        expect(box.x + box.w, where).toBeLessThanOrEqual(r.w + 0.001)
        expect(box.y + box.h, where).toBeLessThanOrEqual(r.h + 0.001)
      }
    }
  })

  it('does not overlap the name with the header or the footer at 16:9', () => {
    const l = layoutCard({ w: 1920, h: 1080 }, style())
    expect(l.header!.y + l.header!.h).toBeLessThan(l.name.y)
    expect(l.name.y + l.name.h).toBeLessThan(l.footer!.y)
  })
})

describe('dimensionLabel', () => {
  it('matches the reference cards', () => {
    expect(dimensionLabel({ w: 1920, h: 1080 })).toBe('1920 x 1080')
    expect(dimensionLabel({ w: 2056, h: 1329 })).toBe('2056 x 1329')
  })
})
