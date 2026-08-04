import { describe, expect, it } from 'vitest'

import { safeStem, uniqueNames } from './filename'

describe('safeStem', () => {
  it('leaves an ordinary name alone', () => {
    expect(safeStem('PC 2')).toBe('PC 2')
    expect(safeStem('Vision 4')).toBe('Vision 4')
  })

  it('keeps spaces and hyphens — they are legal and people type them', () => {
    expect(safeStem('Lectern Laptop - HDMI 2')).toBe('Lectern Laptop - HDMI 2')
  })

  it('strips path separators and the Windows-illegal set', () => {
    expect(safeStem('A/B\\C:D*E?F"G<H>I|J')).toBe('ABCDEFGHIJ')
  })

  it('strips control characters', () => {
    expect(safeStem('PC\u00002\u001f')).toBe('PC2')
  })

  it('drops trailing dots and spaces, which Windows silently discards', () => {
    // Otherwise "Vision 4." and "Vision 4" collide after extraction, past the
    // point where uniqueNames could have caught it.
    expect(safeStem('Vision 4.')).toBe('Vision 4')
    expect(safeStem('Vision 4   ')).toBe('Vision 4')
  })

  it('escapes reserved device names', () => {
    expect(safeStem('CON')).toBe('CON_')
    expect(safeStem('lpt1')).toBe('lpt1_')
    expect(safeStem('console')).toBe('console')
  })

  it('never returns an empty stem', () => {
    expect(safeStem('')).toBe('source')
    expect(safeStem('///')).toBe('source')
    expect(safeStem('...')).toBe('source')
  })

  it('collapses runs of whitespace', () => {
    expect(safeStem('PC    2')).toBe('PC 2')
  })

  it('truncates very long names', () => {
    expect(safeStem('x'.repeat(400)).length).toBe(120)
  })

  describe('strict mode', () => {
    it('folds accents to their base letter instead of deleting them', () => {
      expect(safeStem('Régie Café', true)).toBe('Regie_Cafe')
    })

    it('uses underscores for spaces and drops anything left', () => {
      expect(safeStem('PC 2 — main', true)).toBe('PC_2__main')
      expect(safeStem('Caméra 大 1', true)).toBe('Camera__1')
    })

    it('keeps dots, hyphens and underscores', () => {
      expect(safeStem('vt-1_final.v2', true)).toBe('vt-1_final.v2')
    })
  })
})

describe('uniqueNames', () => {
  it('leaves distinct names alone', () => {
    expect(uniqueNames(['a.png', 'b.png'])).toEqual(['a.png', 'b.png'])
  })

  it('suffixes duplicates before the extension', () => {
    expect(uniqueNames(['Laptop.png', 'Laptop.png', 'Laptop.png'])).toEqual([
      'Laptop.png',
      'Laptop-2.png',
      'Laptop-3.png',
    ])
  })

  it('is case-insensitive, because the targets are', () => {
    expect(uniqueNames(['PC 1.png', 'pc 1.png'])).toEqual(['PC 1.png', 'pc 1-2.png'])
  })

  it('does not collide with a suffix somebody typed by hand', () => {
    const out = uniqueNames(['Laptop.png', 'Laptop-2.png', 'Laptop.png'])
    expect(out).toEqual(['Laptop.png', 'Laptop-2.png', 'Laptop-3.png'])
    expect(new Set(out).size).toBe(3)
  })

  it('always returns as many names as it was given, all unique', () => {
    const input = Array.from({ length: 50 }, () => 'Same.png')
    const out = uniqueNames(input)
    expect(out).toHaveLength(50)
    expect(new Set(out.map((n) => n.toLowerCase())).size).toBe(50)
  })
})
