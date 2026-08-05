/**
 * Turning parsed rows into `Card`s.
 *
 * THE RULE HERE IS: NEVER COERCE SILENTLY.
 * ========================================
 * Every value this file cannot understand produces a `warning` naming the row,
 * the column and the offending text, and falls back to the batch default. A
 * spreadsheet with `1920*1080` in the size column must not quietly produce
 * forty 1080p cards that look correct and are not what was asked for — that is
 * discovered on site, which is the whole failure mode this tool exists to
 * avoid.
 *
 * Header matching is deliberately generous, because the file comes from
 * whatever the user already had: a patch sheet, a kit list, an export from
 * someone else's system.
 */

import { parseHex } from '../lib/colour'
import { PRESETS } from '../render/layout'
import { ICONS } from '../render/icons'
import { newCard } from '../state/defaults'
import type { Card, PresetId, SizeMode } from '../types'

export type Field = 'name' | 'icon' | 'colour' | 'size'

export type ImportWarning = {
  /** 1-based, counting the header row as row 1, so it matches the spreadsheet. */
  row: number
  field: Field
  value: string
  message: string
}

export type ImportResult = {
  cards: Card[]
  warnings: ImportWarning[]
  /** Which header each field was taken from. Shown back to the user. */
  matched: Partial<Record<Field, string>>
  /** Headers present in the file that mean nothing here. Ignored, not an error. */
  ignoredHeaders: string[]
  /** True when no header row was recognised and columns were taken positionally. */
  positional: boolean
  rowCount: number
}

/**
 * Accepted header spellings. Compared after lowercasing and stripping
 * everything that is not a letter or a digit, so "Source Name", "source_name"
 * and "SOURCE NAME " all collapse to the same key.
 */
const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['name', 'source', 'sourcename', 'label', 'input', 'title', 'text', 'caption'],
  icon: ['icon', 'type', 'device', 'kind', 'symbol'],
  colour: ['colour', 'color', 'hex', 'colourhex', 'colorhex', 'background', 'bg'],
  size: ['size', 'resolution', 'raster', 'dimensions', 'dimension', 'res', 'format'],
}

const normaliseHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Icon synonyms beyond each icon's own id and label. */
const ICON_SYNONYMS: Record<string, string> = {
  cam: 'camera',
  stills: 'camera',
  ptz: 'video-camera',
  video: 'video-camera',
  videocam: 'video-camera',
  camcorder: 'video-camera',
  computer: 'desktop',
  pc: 'desktop',
  tower: 'desktop',
  workstation: 'desktop',
  mac: 'laptop',
  macbook: 'laptop',
  notebook: 'laptop',
  display: 'monitor',
  screen: 'monitor',
  tv: 'monitor',
  beamer: 'projector',
  proj: 'projector',
  usbstick: 'usb',
  flashdrive: 'usb',
  thumbdrive: 'usb',
  memorystick: 'usb',
  hdd: 'disk',
  ssd: 'disk',
  drive: 'disk',
  harddisk: 'disk',
  playback: 'play',
  player: 'play',
  media: 'play',
  vt: 'film',
  clip: 'film',
  movie: 'film',
  video2: 'film',
  presentation: 'slides',
  powerpoint: 'slides',
  keynote: 'slides',
  deck: 'slides',
  microphone: 'mic',
  audio: 'mic',
  speaker: 'speaker',
  pa: 'speaker',
  rack: 'server',
  ethernet: 'network',
  net: 'network',
  lan: 'network',
  ip: 'network',
  web: 'globe',
  browser: 'globe',
  internet: 'globe',
  url: 'globe',
  none: 'none',
  blank: 'none',
  no: 'none',
}

const ICON_LOOKUP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const icon of ICONS) {
    m.set(normaliseHeader(icon.id), icon.id)
    m.set(normaliseHeader(icon.label), icon.id)
  }
  // Synonyms last so they cannot shadow a real id or label.
  for (const [k, v] of Object.entries(ICON_SYNONYMS)) {
    if (!m.has(k)) m.set(k, v)
  }
  return m
})()

/**
 * A small set of colour names, because people type "red" in a spreadsheet and
 * a tool that only accepts #RRGGBB just produces a column of warnings.
 * Deliberately mid-toned rather than the CSS values: `red` as #ff0000 makes a
 * centre that clips, so these are chosen to survive `gradientStops`.
 */
const NAMED_COLOURS: Record<string, string> = {
  red: '#c0392b',
  orange: '#d35400',
  amber: '#c87f0a',
  yellow: '#c9b003',
  lime: '#5f9e0f',
  green: '#1e8449',
  teal: '#0e7c7b',
  cyan: '#0d7c94',
  blue: '#1f6fd0',
  navy: '#1a3a8f',
  indigo: '#4b3f9e',
  purple: '#7d3c98',
  violet: '#8e44ad',
  magenta: '#b0247f',
  pink: '#c2185b',
  brown: '#7b4b2a',
  grey: '#5d6d7e',
  gray: '#5d6d7e',
  black: '#1c1c1c',
  white: '#d8d8d8',
}

export function parseIcon(raw: string): string | null {
  const key = normaliseHeader(raw)
  if (!key) return null
  return ICON_LOOKUP.get(key) ?? null
}

export function parseColour(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const named = NAMED_COLOURS[t.toLowerCase()]
  if (named) return named
  const withHash = t.startsWith('#') ? t : `#${t}`
  const rgb = parseHex(withHash)
  if (!rgb) return null
  // Normalise 3-digit to 6-digit so the colour input shows it.
  const h = withHash.slice(1)
  return h.length === 3
    ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
    : withHash.toLowerCase()
}

const PRESET_LOOKUP: ReadonlyMap<string, PresetId> = (() => {
  const m = new Map<string, PresetId>()
  for (const p of PRESETS) {
    m.set(normaliseHeader(p.id), p.id)
    // "1080p — 1920 × 1080" also matches on its leading token.
    const lead = p.label.split('—')[0]!.trim()
    m.set(normaliseHeader(lead), p.id)
  }
  m.set('1080p', 'hd1080')
  m.set('fhd', 'hd1080')
  m.set('hd', 'hd1080')
  m.set('720p', 'hd720')
  m.set('4k', 'uhd4k')
  m.set('uhd', 'uhd4k')
  m.set('2160p', 'uhd4k')
  return m
})()

/**
 * Size from a cell. Accepts, in order:
 *   1920x1080 / 1920X1080 / 1920 × 1080 / 1920*1080   -> exact
 *   16:9 / 16x9@2560 / 16:9 @ 2560                    -> aspect (long edge)
 *   1080p / hd1080 / 4K / uhd4k                       -> preset
 *
 * Note `1920x1080` and `16:9` are told apart by magnitude, not by the
 * separator: `x` is a legitimate ratio separator too, and someone will write
 * `16x9`. Anything where both numbers are under 100 is a ratio.
 */
export function parseSize(raw: string): SizeMode | null {
  const t = raw.trim()
  if (!t) return null

  const preset = PRESET_LOOKUP.get(normaliseHeader(t))
  if (preset) return { kind: 'preset', id: preset }

  const at = t.split('@')
  const body = at[0]!.trim()
  const longEdge = at.length > 1 ? Number(at[1]!.trim().replace(/px$/i, '')) : null
  if (at.length > 1 && (!Number.isFinite(longEdge) || (longEdge as number) < 1)) return null

  const m = /^(\d+(?:\.\d+)?)\s*[x×*:\/]\s*(\d+(?:\.\d+)?)$/i.exec(body)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null

  const looksLikeRatio = a < 100 && b < 100
  if (looksLikeRatio || longEdge !== null) {
    return { kind: 'aspect', wRatio: a, hRatio: b, longEdge: longEdge ?? 1920 }
  }
  return { kind: 'exact', w: Math.round(a), h: Math.round(b) }
}

/** Match the header row against the known fields. */
function matchHeaders(header: string[]): {
  index: Partial<Record<Field, number>>
  matched: Partial<Record<Field, string>>
  ignored: string[]
} {
  const index: Partial<Record<Field, number>> = {}
  const matched: Partial<Record<Field, string>> = {}
  const ignored: string[] = []

  header.forEach((raw, i) => {
    const key = normaliseHeader(raw)
    if (!key) return
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find(
      (f) => HEADER_ALIASES[f].includes(key) && index[f] === undefined,
    )
    if (field) {
      index[field] = i
      matched[field] = raw.trim()
    } else {
      ignored.push(raw.trim())
    }
  })
  return { index, matched, ignored }
}

/**
 * Rows to cards.
 *
 * If the first row matches no known header, the file is treated as having no
 * header and columns are read positionally as name, icon, colour, size — which
 * is what a bare list of names pasted from a column actually is, and the common
 * case this has to get right.
 */
export function rowsToCards(rows: string[][]): ImportResult {
  const warnings: ImportWarning[] = []
  if (rows.length === 0) {
    return { cards: [], warnings, matched: {}, ignoredHeaders: [], positional: false, rowCount: 0 }
  }

  const header = rows[0]!
  const { index, matched, ignored } = matchHeaders(header)
  const positional = index.name === undefined

  const body = positional ? rows : rows.slice(1)
  const col: Record<Field, number> = positional
    ? { name: 0, icon: 1, colour: 2, size: 3 }
    : {
        name: index.name!,
        icon: index.icon ?? -1,
        colour: index.colour ?? -1,
        size: index.size ?? -1,
      }

  const cards: Card[] = []
  body.forEach((r, i) => {
    // Row number as the user sees it in their spreadsheet.
    const rowNo = positional ? i + 1 : i + 2
    const name = (r[col.name] ?? '').trim()
    if (!name) return

    const card = newCard(name)

    const iconRaw = col.icon >= 0 ? (r[col.icon] ?? '').trim() : ''
    if (iconRaw) {
      const icon = parseIcon(iconRaw)
      if (icon) card.iconId = icon
      else
        warnings.push({
          row: rowNo,
          field: 'icon',
          value: iconRaw,
          message: `Not an icon name — left as ${card.iconId}.`,
        })
    }

    const colourRaw = col.colour >= 0 ? (r[col.colour] ?? '').trim() : ''
    if (colourRaw) {
      const colour = parseColour(colourRaw)
      if (colour) card.colour = colour
      else
        warnings.push({
          row: rowNo,
          field: 'colour',
          value: colourRaw,
          message: 'Not a colour — using the batch default.',
        })
    }

    const sizeRaw = col.size >= 0 ? (r[col.size] ?? '').trim() : ''
    if (sizeRaw) {
      const size = parseSize(sizeRaw)
      if (size) card.size = size
      else
        warnings.push({
          row: rowNo,
          field: 'size',
          value: sizeRaw,
          message: 'Not a size — using the batch default.',
        })
    }

    cards.push(card)
  })

  return { cards, warnings, matched, ignoredHeaders: ignored, positional, rowCount: body.length }
}
