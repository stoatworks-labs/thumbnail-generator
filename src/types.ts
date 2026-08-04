/**
 * The model. Read this first.
 *
 * The unit of work is a `Card`: one source label that becomes one image file.
 * A `Batch` holds the cards plus the defaults they inherit from. Everything
 * else in the app is either a pure function over these types or a React view of
 * them.
 */

/** A raster in pixels. Always the real output size — never a ratio. */
export type Raster = { w: number; h: number }

/**
 * How a card's raster is arrived at.
 *
 * `aspect` is the one that needs explaining: an aspect ratio alone does not
 * determine a pixel count, so it carries a `longEdge` and the short edge is
 * derived. This is why `resolveRaster()` exists and why nothing downstream ever
 * sees a `SizeMode` — painters and exporters only ever see a resolved `Raster`.
 */
export type SizeMode =
  | { kind: 'preset'; id: PresetId }
  | { kind: 'exact'; w: number; h: number }
  | { kind: 'aspect'; wRatio: number; hRatio: number; longEdge: number }

export type PresetId =
  | 'hd1080'
  | 'hd720'
  | 'uhd4k'
  | 'wuxga'
  | 'wxga'
  | 'sxga'
  | 'square512'
  | 'thumb256'

export type Preset = { id: PresetId; label: string; raster: Raster }

/** Where the text sits relative to the background. */
export type TextTone = 'auto' | 'light' | 'dark'

/**
 * One source. `name` is both the label painted on the card and the stem of the
 * filename in the ZIP — they are deliberately the same thing, because a
 * thumbnail whose filename does not match its label is worse than useless on a
 * patch sheet.
 *
 * `size` and `colour` are nullable: null means "inherit the batch default".
 * That is what makes a 40-source batch tolerable to fill in.
 */
export type Card = {
  id: string
  name: string
  iconId: string
  colour: string | null
  size: SizeMode | null
}

/** Batch-wide look. Applies to every card; nothing here is per-card. */
export type Style = {
  /** Header text at the top of the card, e.g. "1920 x 1080". */
  showDimensions: boolean
  /** Footer text, bottom right. Free-form — `{version}` is substituted. */
  showFooter: boolean
  footerText: string
  /** Radial lighten-the-centre background. Off gives a flat fill. */
  gradient: boolean
  textTone: TextTone
  /** Draw the icon at all. Some houses want the label only. */
  showIcon: boolean
}

export type Batch = {
  cards: Card[]
  defaultSize: SizeMode
  defaultColour: string
  /** Cards added without an explicit colour cycle through this. */
  autoPalette: boolean
  style: Style
  format: FormatId
}

export type FormatId = 'png' | 'jpeg'

/** A rectangle in raster pixels. Origin top-left, as canvas has it. */
export type Rect = { x: number; y: number; w: number; h: number }

/**
 * The result of laying a card out. Pure numbers — no canvas, no fonts. The
 * painter fits content into these boxes; it never decides where they go.
 */
export type Layout = {
  raster: Raster
  /** Scale factor from the 1920x1080 design space onto this raster. */
  scale: number
  icon: Rect | null
  name: Rect
  header: Rect | null
  footer: Rect | null
}
