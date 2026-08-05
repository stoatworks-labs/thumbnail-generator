import { describe, expect, it } from 'vitest'

import { parseDelimited } from './csv'
import { parseColour, parseIcon, parseSize, rowsToCards } from './mapping'
import { TEMPLATE_ROWS, templateCsv } from './template'

const cards = (text: string) => rowsToCards(parseDelimited(text))

describe('parseIcon', () => {
  it('takes ids and labels', () => {
    expect(parseIcon('camera')).toBe('camera')
    expect(parseIcon('Video camera')).toBe('video-camera')
    expect(parseIcon('video-camera')).toBe('video-camera')
    expect(parseIcon('USB stick')).toBe('usb')
  })

  it('is insensitive to case, spaces and punctuation', () => {
    expect(parseIcon('  VIDEO_CAMERA ')).toBe('video-camera')
    expect(parseIcon('Desktop Computer')).toBe('desktop')
  })

  it('takes the synonyms people actually type', () => {
    expect(parseIcon('cam')).toBe('camera')
    expect(parseIcon('PC')).toBe('desktop')
    expect(parseIcon('MacBook')).toBe('laptop')
    expect(parseIcon('screen')).toBe('monitor')
    expect(parseIcon('VT')).toBe('film')
    expect(parseIcon('PowerPoint')).toBe('slides')
    expect(parseIcon('SSD')).toBe('disk')
  })

  it('never lets a synonym shadow a real icon', () => {
    // "drive" is both a synonym for disk and the Drive icon's own label.
    expect(parseIcon('Drive')).toBe('disk')
    expect(parseIcon('speaker')).toBe('speaker')
  })

  it('returns null rather than guessing', () => {
    expect(parseIcon('flugelhorn')).toBeNull()
    expect(parseIcon('')).toBeNull()
  })
})

describe('parseColour', () => {
  it('takes hex with or without the hash, and 3-digit form', () => {
    expect(parseColour('#1f6fd0')).toBe('#1f6fd0')
    expect(parseColour('1f6fd0')).toBe('#1f6fd0')
    expect(parseColour('#F00')).toBe('#ff0000')
  })

  it('takes colour names, because people type them in spreadsheets', () => {
    expect(parseColour('red')).toBe('#c0392b')
    expect(parseColour('Teal')).toBe('#0e7c7b')
  })

  it('returns null for anything else', () => {
    expect(parseColour('reddish')).toBeNull()
    expect(parseColour('#12345')).toBeNull()
    expect(parseColour('')).toBeNull()
  })
})

describe('parseSize', () => {
  it('reads an exact raster', () => {
    expect(parseSize('1920x1080')).toEqual({ kind: 'exact', w: 1920, h: 1080 })
    expect(parseSize('1920 × 1080')).toEqual({ kind: 'exact', w: 1920, h: 1080 })
    expect(parseSize('2056*1329')).toEqual({ kind: 'exact', w: 2056, h: 1329 })
  })

  it('reads a ratio, telling it from a raster by magnitude not by separator', () => {
    // `16x9` is a ratio and `1920x1080` is a raster, both written with an x.
    expect(parseSize('16:9')).toEqual({ kind: 'aspect', wRatio: 16, hRatio: 9, longEdge: 1920 })
    expect(parseSize('16x9')).toEqual({ kind: 'aspect', wRatio: 16, hRatio: 9, longEdge: 1920 })
    expect(parseSize('9:16')).toEqual({ kind: 'aspect', wRatio: 9, hRatio: 16, longEdge: 1920 })
  })

  it('reads a ratio with an explicit long edge', () => {
    expect(parseSize('16:9@2560')).toEqual({
      kind: 'aspect', wRatio: 16, hRatio: 9, longEdge: 2560,
    })
    expect(parseSize('16:9 @ 2560px')).toEqual({
      kind: 'aspect', wRatio: 16, hRatio: 9, longEdge: 2560,
    })
  })

  it('reads presets by id and by common name', () => {
    expect(parseSize('hd1080')).toEqual({ kind: 'preset', id: 'hd1080' })
    expect(parseSize('1080p')).toEqual({ kind: 'preset', id: 'hd1080' })
    expect(parseSize('4K')).toEqual({ kind: 'preset', id: 'uhd4k' })
    expect(parseSize('720p')).toEqual({ kind: 'preset', id: 'hd720' })
  })

  it('returns null rather than guessing', () => {
    expect(parseSize('big')).toBeNull()
    expect(parseSize('1920')).toBeNull()
    expect(parseSize('1920x')).toBeNull()
    expect(parseSize('0x0')).toBeNull()
    expect(parseSize('')).toBeNull()
  })
})

describe('rowsToCards', () => {
  it('maps a well-formed file', () => {
    const r = cards('name,icon,colour,size\nPC 1,laptop,#1f6fd0,1920x1080')
    expect(r.warnings).toEqual([])
    expect(r.positional).toBe(false)
    expect(r.cards).toHaveLength(1)
    expect(r.cards[0]).toMatchObject({
      name: 'PC 1',
      iconId: 'laptop',
      colour: '#1f6fd0',
      size: { kind: 'exact', w: 1920, h: 1080 },
    })
  })

  it('accepts the header spellings people actually use, in any order', () => {
    const r = cards('Colour,Source Name,Resolution\nred,PC 1,720p')
    expect(r.positional).toBe(false)
    expect(r.matched).toEqual({ colour: 'Colour', name: 'Source Name', size: 'Resolution' })
    expect(r.cards[0]).toMatchObject({ name: 'PC 1', colour: '#c0392b' })
  })

  it('reads columns positionally when no header is recognised', () => {
    // A bare list pasted from a column is the common case and must not lose
    // its first row to a header that is not there.
    const r = cards('PC 1\nPC 2\nCamera 1')
    expect(r.positional).toBe(true)
    expect(r.cards.map((c) => c.name)).toEqual(['PC 1', 'PC 2', 'Camera 1'])
  })

  it('reports unrecognised headings rather than failing on them', () => {
    const r = cards('name,rack,notes\nPC 1,A2,spare')
    expect(r.cards).toHaveLength(1)
    expect(r.ignoredHeaders).toEqual(['rack', 'notes'])
    expect(r.warnings).toEqual([])
  })

  it('warns instead of silently defaulting, and says which spreadsheet row', () => {
    const r = cards('name,icon,colour,size\nPC 1,flugelhorn,notacolour,1920*1080 ish')
    expect(r.cards).toHaveLength(1)
    expect(r.warnings.map((w) => w.field).sort()).toEqual(['colour', 'icon', 'size'])
    // Row 2: the header is row 1, as the user sees it.
    expect(new Set(r.warnings.map((w) => w.row))).toEqual(new Set([2]))
    expect(r.warnings.find((w) => w.field === 'icon')!.value).toBe('flugelhorn')
    // The card still exists and falls back rather than being dropped.
    expect(r.cards[0]!.colour).toBeNull()
    expect(r.cards[0]!.size).toBeNull()
  })

  it('numbers warning rows from 1 when there is no header', () => {
    const r = cards('PC 1,flugelhorn')
    expect(r.warnings[0]!.row).toBe(1)
  })

  it('skips rows with no name', () => {
    const r = cards('name,icon\nPC 1,laptop\n,camera\nPC 2,laptop')
    expect(r.cards.map((c) => c.name)).toEqual(['PC 1', 'PC 2'])
  })

  it('leaves blank cells as inherit rather than as a value', () => {
    const r = cards('name,icon,colour,size\nPC 1,,,')
    expect(r.warnings).toEqual([])
    expect(r.cards[0]!.colour).toBeNull()
    expect(r.cards[0]!.size).toBeNull()
  })

  it('gives every card a distinct id', () => {
    const r = cards('name\nA\nB\nC\nD')
    expect(new Set(r.cards.map((c) => c.id)).size).toBe(4)
  })

  it('handles an empty input', () => {
    expect(cards('').cards).toEqual([])
  })
})

describe('the template', () => {
  it('imports cleanly with no warnings at all', () => {
    // The template is the documentation. If it cannot be imported without a
    // complaint, the documentation is wrong — which is exactly the drift this
    // test exists to catch.
    const r = cards(templateCsv())
    expect(r.warnings).toEqual([])
    expect(r.positional).toBe(false)
    expect(r.cards).toHaveLength(TEMPLATE_ROWS.length)
  })

  it('demonstrates every size form the parser accepts', () => {
    const r = cards(templateCsv())
    const kinds = new Set(r.cards.map((c) => c.size?.kind ?? 'inherit'))
    expect(kinds).toEqual(new Set(['exact', 'preset', 'aspect', 'inherit']))
  })

  it('survives the quoted comma in "Lectern, stage left"', () => {
    const r = cards(templateCsv())
    expect(r.cards.map((c) => c.name)).toContain('Lectern, stage left')
  })
})
