/**
 * Turning a source name into a filename.
 *
 * The card's label and its filename are the same string by design, so this is
 * the only place allowed to change one into the other, and it has to be
 * conservative: the files land on embedded gear (an Eventmaster chassis, a
 * LiveCore frame) whose file handling is not a desktop OS's. A name that works
 * in Finder and silently fails to import is the failure mode to avoid.
 */

/** Reserved on Windows regardless of extension — a `CON.png` cannot be written. */
const RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
])

/**
 * Path separators, the Windows-illegal set, and C0/DEL controls.
 *
 * Spaces and hyphens are NOT in here on purpose — they are legal everywhere and
 * stripping them would mangle every name a user actually types. Only `strict`
 * mode touches spaces.
 */
// eslint-disable-next-line no-control-regex
const HOSTILE = /[/\\:*?"<>|\x00-\x1f\x7f]/g

/** Combining diacritics, so NFD-then-strip leaves the base letter behind. */
const COMBINING = /[̀-ͯ]/g

const MAX_STEM = 120

/**
 * Sanitise a label into a filename stem.
 *
 * `strict` folds to ASCII [A-Za-z0-9._-] with underscores for spaces, which is
 * what to use when the target is a device rather than a computer. Without it,
 * spaces and accented letters survive — nicer to read on a patch sheet, and
 * fine for a desktop workflow.
 *
 * Note the trailing dot/space strip: Windows discards those when creating a
 * file, so "Vision 4." and "Vision 4" would collide *after* extraction, past
 * the point where `uniqueNames` could have caught it.
 */
export function safeStem(label: string, strict = false): string {
  let s = label.normalize('NFC').replace(HOSTILE, '').trim()

  if (strict) {
    s = s
      .normalize('NFD')
      .replace(COMBINING, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]/g, '')
  } else {
    s = s.replace(/\s+/g, ' ')
  }

  s = s.replace(/[. ]+$/, '')
  if (!s) return 'source'
  if (s.length > MAX_STEM) s = s.slice(0, MAX_STEM).replace(/[. ]+$/, '') || 'source'
  if (RESERVED.has(s.toLowerCase())) s = `${s}_`
  return s
}

/**
 * Make a list of filenames unique, preserving order.
 *
 * Two sources called the same thing is normal — a rig routinely has two
 * "Laptop" inputs — and a ZIP with duplicate names extracts to one file with
 * the last one winning, silently losing a card. Collisions get a numeric
 * suffix inserted before the extension.
 *
 * Comparison is case-insensitive because the targets are: "PC 1.png" and
 * "pc 1.png" are two entries in a ZIP and one file on the other end.
 */
export function uniqueNames(names: string[]): string[] {
  const taken = new Set<string>()
  return names.map((raw) => {
    const dot = raw.lastIndexOf('.')
    const stem = dot > 0 ? raw.slice(0, dot) : raw
    const ext = dot > 0 ? raw.slice(dot) : ''

    let candidate = raw
    let n = 1
    while (taken.has(candidate.toLowerCase())) {
      n += 1
      candidate = `${stem}-${n}${ext}`
    }
    taken.add(candidate.toLowerCase())
    return candidate
  })
}
