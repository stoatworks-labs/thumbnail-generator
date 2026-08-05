/**
 * A delimited-text parser: CSV, and TSV for what Google Sheets puts on the
 * clipboard.
 *
 * WHY HAND-ROLLED
 * ===============
 * "Split on commas" is wrong the first time somebody names a source
 * `Lectern, stage left`, and that failure is silent — it shifts every column
 * after it by one and the import looks like it worked. A real parser is about
 * eighty lines and is fully testable, which is cheaper than a dependency and
 * much cheaper than the bug.
 *
 * Implements RFC 4180 plus the things real files actually do:
 *   - quoted fields containing the delimiter, quotes ("" escapes one) and
 *     newlines
 *   - CRLF, LF or CR line endings, mixed within one file
 *   - a UTF-8 BOM, which Excel writes and which otherwise becomes part of the
 *     first header name so no column matches
 *   - trailing newline, with no phantom empty row
 */

export type Delimiter = ',' | '\t' | ';'

/**
 * Guess the delimiter from the first line.
 *
 * Semicolon is in here because Excel writes it in locales where the comma is
 * the decimal separator, and a European colleague's export is otherwise a
 * single column with everything in it.
 *
 * Counting happens OUTSIDE quotes only — a single field like
 * `"Lectern, stage left"` should not make a comma-delimited file look
 * comma-heavy for the wrong reason, and more importantly a tab-delimited file
 * with a comma inside a field should not be read as CSV.
 */
export function sniffDelimiter(text: string): Delimiter {
  const line = firstLogicalLine(text)
  const counts: Record<Delimiter, number> = { ',': 0, '\t': 0, ';': 0 }
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') i++
      else inQuotes = !inQuotes
    } else if (!inQuotes && (c === ',' || c === '\t' || c === ';')) {
      counts[c as Delimiter]++
    }
  }
  // Tab wins ties: a pasted spreadsheet selection is tab-delimited, and that is
  // the paste path this tool cares most about.
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

/** The first line, respecting quoted newlines. */
function firstLogicalLine(text: string): string {
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') i++
      else inQuotes = !inQuotes
    } else if (!inQuotes && (c === '\n' || c === '\r')) {
      return text.slice(0, i)
    }
  }
  return text
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Parse into rows of raw string cells. No header handling and no coercion —
 * that is `mapping.ts`'s job, so this stays a pure text function.
 *
 * Rows where every cell is empty are dropped: they are what a trailing newline,
 * a blank spacer row in a spreadsheet, or a `,,,` line produce, and none of
 * them mean "a source with no name".
 */
export function parseDelimited(text: string, delimiter?: Delimiter): string[][] {
  const src = stripBom(text)
  const delim = delimiter ?? sniffDelimiter(src)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
  }

  while (i < src.length) {
    const c = src[i]!

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"' && field.trim() === '') {
      // Only opens a quoted field at the start of one. A stray quote mid-field
      // ( 6" monitor ) is data, not syntax.
      field = ''
      inQuotes = true
      i++
      continue
    }
    if (c === delim) {
      endField()
      i++
      continue
    }
    if (c === '\r') {
      endRow()
      if (src[i + 1] === '\n') i++
      i++
      continue
    }
    if (c === '\n') {
      endRow()
      i++
      continue
    }
    field += c
    i++
  }

  // Whatever is left after the last newline.
  if (field !== '' || row.length > 0) endRow()
  return rows
}

/** Quote a cell for output, per RFC 4180. */
export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Rows to a CSV string, with the trailing newline tools expect. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}
