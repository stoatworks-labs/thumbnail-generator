/**
 * Colour handling: hex parsing, the gradient derivation, and the contrast
 * decision that picks white or black text.
 *
 * THE GRADIENT IS DERIVED, NOT TABULATED
 * ======================================
 * A card's background is one base colour turned into a light centre and a dark
 * edge. Both ends come out of `gradientStops()`; there is no per-colour table
 * and there must never be one, or a hundred palette entries become a hundred
 * chances to get one wrong.
 *
 * The multipliers below were fitted against the reference cards (magenta, blue
 * and yellow) and reproduce all three: a base at L≈0.50 lifts to ≈0.65 in the
 * centre and drops to ≈0.28 at the corners, which is the look those cards have.
 */

export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }

const CENTRE_GAIN = 1.18
const CENTRE_LIFT = 0.06
const EDGE_GAIN = 0.55
/** The centre desaturates very slightly, or bright hues posterise as they clip. */
const CENTRE_SAT = 0.94

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l, g: l, b: l }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return { r: f(h + 1 / 3), g: f(h), b: f(h - 1 / 3) }
}

/**
 * The two ends of a card's background, centre first.
 *
 * With `gradient: false` both come back identical, so the painter has one code
 * path and a flat card is just a gradient with no travel.
 */
export function gradientStops(baseHex: string, gradient: boolean): { centre: string; edge: string } {
  const rgb = parseHex(baseHex) ?? { r: 0.5, g: 0.5, b: 0.5 }
  if (!gradient) {
    const flat = toHex(rgb)
    return { centre: flat, edge: flat }
  }
  const hsl = rgbToHsl(rgb)
  const centre = hslToRgb({
    h: hsl.h,
    s: clamp01(hsl.s * CENTRE_SAT),
    l: clamp01(hsl.l * CENTRE_GAIN + CENTRE_LIFT),
  })
  const edge = hslToRgb({ h: hsl.h, s: hsl.s, l: clamp01(hsl.l * EDGE_GAIN) })
  return { centre: toHex(centre), edge: toHex(edge) }
}

/**
 * Rec.709 relative luminance, gamma-decoded — the WCAG definition.
 *
 * Naive (r+g+b)/3 calls a saturated yellow "mid" and picks white text over it,
 * which is the single most common way a generated card comes out unreadable.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * White or black for the text on this card.
 *
 * Measured against the CENTRE of the gradient, because that is what sits behind
 * the icon and the name. Judging by the base colour would flip to dark text on
 * cards whose centre is nowhere near that bright.
 *
 * The 0.45 threshold is deliberately above the 0.1791 point where the two
 * contrast ratios cross: the reference cards use white on colours that are
 * brighter than the crossover (a saturated yellow among them), and matching
 * that house style matters more here than winning a WCAG argument about a
 * label that is 100px tall.
 */
export function autoTextColour(centreHex: string): '#ffffff' | '#000000' {
  const rgb = parseHex(centreHex) ?? { r: 0.5, g: 0.5, b: 0.5 }
  return relativeLuminance(rgb) > 0.45 ? '#000000' : '#ffffff'
}

/**
 * A spread of distinguishable hues for cards added without a chosen colour.
 *
 * Golden-angle stepping rather than an even split, so the 9th card is not a
 * near-repeat of the 1st and the set stays usable at any length. Saturation and
 * lightness are held where `gradientStops` behaves.
 */
export function paletteColour(index: number): string {
  const GOLDEN = 0.618033988749895
  const h = (0.92 + index * GOLDEN) % 1
  return toHex(hslToRgb({ h, s: 0.72, l: 0.46 }))
}
