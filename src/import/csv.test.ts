import { describe, expect, it } from 'vitest'

import { parseDelimited, sniffDelimiter, stripBom, toCsv } from './csv'

describe('sniffDelimiter', () => {
  it('finds the obvious ones', () => {
    expect(sniffDelimiter('a,b,c')).toBe(',')
    expect(sniffDelimiter('a\tb\tc')).toBe('\t')
    expect(sniffDelimiter('a;b;c')).toBe(';')
  })

  it('prefers tab, because that is what a spreadsheet paste is', () => {
    expect(sniffDelimiter('a\tb,c\td')).toBe('\t')
  })

  it('ignores delimiters inside quoted fields', () => {
    // The comma here is DATA. Counting it would read a tab-delimited paste as
    // CSV and put the whole row in one column.
    expect(sniffDelimiter('"Lectern, stage left"\ticon\tcolour')).toBe('\t')
  })

  it('falls back to comma for a single column', () => {
    expect(sniffDelimiter('name')).toBe(',')
  })
})

describe('stripBom', () => {
  it('removes a UTF-8 BOM', () => {
    // Excel writes one, and without this the first header is "﻿name",
    // which matches no column and silently turns the file positional.
    expect(stripBom('﻿name,icon')).toBe('name,icon')
    expect(stripBom('name,icon')).toBe('name,icon')
  })
})

describe('parseDelimited', () => {
  it('parses a plain file', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps a delimiter inside quotes as data', () => {
    expect(parseDelimited('name,icon\n"Lectern, stage left",laptop')).toEqual([
      ['name', 'icon'],
      ['Lectern, stage left', 'laptop'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseDelimited('a\n"He said ""hi"""')).toEqual([['a'], ['He said "hi"']])
  })

  it('keeps a newline inside quotes in the same row', () => {
    expect(parseDelimited('a,b\n"one\ntwo",three')).toEqual([
      ['a', 'b'],
      ['one\ntwo', 'three'],
    ])
  })

  it('handles CRLF, LF and CR, mixed', () => {
    expect(parseDelimited('a\r\nb\nc\rd')).toEqual([['a'], ['b'], ['c'], ['d']])
  })

  it('does not invent a row from the trailing newline', () => {
    expect(parseDelimited('a,b\n1,2\n')).toHaveLength(2)
  })

  it('drops rows that are entirely empty', () => {
    // A spacer row in a spreadsheet, or a `,,,` line. Neither is a source.
    expect(parseDelimited('a,b\n1,2\n,,\n\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('treats a quote in the middle of a field as data', () => {
    // `6" monitor` is a real thing to type and is not a quoted field.
    expect(parseDelimited('a\n6" monitor')).toEqual([['a'], ['6" monitor']])
  })

  it('parses TSV', () => {
    expect(parseDelimited('name\ticon\nPC 1\tlaptop')).toEqual([
      ['name', 'icon'],
      ['PC 1', 'laptop'],
    ])
  })

  it('keeps empty cells, so column positions do not shift', () => {
    expect(parseDelimited('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })
})

describe('toCsv', () => {
  it('quotes only what needs it, and ends with a newline', () => {
    expect(toCsv([['a', 'b,c'], ['1', 'he said "hi"']])).toBe('a,"b,c"\n1,"he said ""hi"""\n')
  })

  it('round-trips through the parser', () => {
    const rows = [
      ['name', 'icon'],
      ['Lectern, stage left', 'usb'],
      ['He said "hi"', 'camera'],
      ['two\nlines', 'play'],
    ]
    expect(parseDelimited(toCsv(rows))).toEqual(rows)
  })
})
