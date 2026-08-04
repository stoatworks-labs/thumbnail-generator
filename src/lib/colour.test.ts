import { describe, expect, it } from 'vitest'

import {
  autoTextColour,
  gradientStops,
  paletteColour,
  parseHex,
  relativeLuminance,
  rgbToHsl,
  toHex,
} from './colour'

describe('parseHex', () => {
  it('takes 3 and 6 digit forms, with or without the hash', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseHex('000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(toHex(parseHex('#f00')!)).toBe('#ff0000')
  })

  it('rejects anything else rather than guessing', () => {
    expect(parseHex('')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('rebeccapurple')).toBeNull()
  })
})

describe('gradientStops', () => {
  it('lifts the centre and drops the edge', () => {
    const { centre, edge } = gradientStops('#c0248f', true)
    const c = rgbToHsl(parseHex(centre)!)
    const e = rgbToHsl(parseHex(edge)!)
    const base = rgbToHsl(parseHex('#c0248f')!)
    expect(c.l).toBeGreaterThan(base.l)
    expect(e.l).toBeLessThan(base.l)
  })

  it('holds the hue, so a card stays the colour that was picked', () => {
    for (const hex of ['#c0248f', '#0a2bf5', '#eeee00', '#1f6fd0']) {
      const base = rgbToHsl(parseHex(hex)!)
      const c = rgbToHsl(parseHex(gradientStops(hex, true).centre)!)
      const e = rgbToHsl(parseHex(gradientStops(hex, true).edge)!)
      expect(c.h, hex).toBeCloseTo(base.h, 2)
      expect(e.h, hex).toBeCloseTo(base.h, 2)
    }
  })

  it('collapses to one flat colour when the gradient is off', () => {
    const { centre, edge } = gradientStops('#c0248f', false)
    expect(centre).toBe(edge)
    expect(centre).toBe('#c0248f')
  })

  it('does not blow up on black or white', () => {
    expect(gradientStops('#000000', true).centre).toBe('#0f0f0f')
    const white = gradientStops('#ffffff', true)
    expect(parseHex(white.centre)).not.toBeNull()
    expect(parseHex(white.edge)).not.toBeNull()
  })

  it('falls back to grey rather than throwing on a bad colour', () => {
    expect(parseHex(gradientStops('not a colour', true).centre)).not.toBeNull()
  })
})

describe('relativeLuminance', () => {
  it('is gamma-decoded, not a channel average', () => {
    // The whole point: saturated yellow is a BRIGHT colour, and an average of
    // the raw channels (0.67) badly understates how bright.
    expect(relativeLuminance(parseHex('#ffff00')!)).toBeGreaterThan(0.9)
    expect(relativeLuminance(parseHex('#0000ff')!)).toBeLessThan(0.1)
    expect(relativeLuminance(parseHex('#ffffff')!)).toBeCloseTo(1, 5)
    expect(relativeLuminance(parseHex('#000000')!)).toBeCloseTo(0, 5)
  })
})

describe('autoTextColour', () => {
  it('goes dark only on genuinely bright centres', () => {
    expect(autoTextColour('#ffff00')).toBe('#000000')
    expect(autoTextColour('#ffffff')).toBe('#000000')
    expect(autoTextColour('#0a2bf5')).toBe('#ffffff')
    expect(autoTextColour('#c0248f')).toBe('#ffffff')
    expect(autoTextColour('#000000')).toBe('#ffffff')
  })
})

describe('paletteColour', () => {
  it('is stable for a given index', () => {
    expect(paletteColour(3)).toBe(paletteColour(3))
  })

  it('keeps neighbours and near-neighbours apart', () => {
    const hues = Array.from({ length: 12 }, (_, i) => rgbToHsl(parseHex(paletteColour(i))!).h)
    for (let i = 1; i < hues.length; i++) {
      const d = Math.abs(hues[i]! - hues[i - 1]!)
      // Golden-angle stepping: consecutive hues are always far apart.
      expect(Math.min(d, 1 - d)).toBeGreaterThan(0.2)
    }
    // And the 9th is not a near-repeat of the 1st, which an even split would be.
    const d = Math.abs(hues[8]! - hues[0]!)
    expect(Math.min(d, 1 - d)).toBeGreaterThan(0.02)
  })
})
