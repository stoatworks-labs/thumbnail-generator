/**
 * Importing from a Google Sheet.
 *
 * THE ONLY URL THAT RELIABLY WORKS CROSS-ORIGIN IS THE PUBLISHED ONE
 * =================================================================
 * A sheet has several URLs and they behave very differently from a browser on
 * another origin:
 *
 *   /d/<ID>/edit                     the normal one people copy out of the
 *                                    address bar. Not a data endpoint at all.
 *   /d/<ID>/export?format=csv        real CSV. Measured 2026-08-05: a request
 *                                    for a non-existent sheet came back as a
 *                                    readable 404, so this endpoint DOES send
 *                                    CORS headers — it is not categorically
 *                                    blocked, which an earlier version of this
 *                                    comment wrongly claimed. What it does do
 *                                    is answer with a sign-in page for a sheet
 *                                    the anonymous caller cannot read, so it
 *                                    only works when the sheet is shared to
 *                                    "anyone with the link".
 *   /d/e/2PACX-<TOKEN>/pub?output=csv   what File ▸ Share ▸ Publish to web
 *                                    produces. Purpose-built for anonymous
 *                                    reading, and the path to recommend.
 *
 * An edit URL is therefore converted and *flagged* rather than refused: it may
 * well work, and the flag says what to do when it does not.
 *
 * NOT VERIFIED AGAINST A REAL SHEET. Every path here is exercised by tests
 * with an injected `fetch`, and the 404 above is the only real-network
 * observation. Whether a genuinely published sheet returns readable CSV to
 * this origin has not been tried, because it needs somebody's actual Google
 * account.
 *
 * THE SILENT FAILURE THIS GUARDS
 * ------------------------------
 * Google answers a request for a non-public sheet with **200 OK and an HTML
 * sign-in page**, not an error. Fed to a CSV parser that produces one absurd
 * row of markup, and an import that looks like it half-worked. `looksLikeHtml`
 * catches it before parsing and says what actually happened.
 */

export type SheetUrlKind = 'published' | 'export' | 'raw'

export type NormalisedSheetUrl = {
  url: string
  kind: SheetUrlKind
  /** Set when the URL will probably be blocked, with what to do about it. */
  warning: string | null
}

const PUBLISH_ADVICE =
  'In the sheet: File ▸ Share ▸ Publish to web, choose the tab, pick Comma-separated values (.csv), then paste that link here.'

/**
 * Work out what to fetch from whatever the user pasted.
 *
 * Returns the URL to try even in the cases that probably will not work, so the
 * user can attempt it — some sheets are published in ways that do respond —
 * but always with the warning attached.
 */
export function normaliseSheetUrl(input: string): NormalisedSheetUrl | null {
  const raw = input.trim()
  if (!raw) return null

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null

  const isGoogle = /(^|\.)docs\.google\.com$/i.test(u.hostname)
  if (!isGoogle) {
    // Any other https URL that serves CSV is fine — a Worker, a share link,
    // a file on the same origin. It stands or falls on its own CORS headers.
    return { url: u.toString(), kind: 'raw', warning: null }
  }

  // Published: /spreadsheets/d/e/<token>/pub  (or /pubhtml)
  const published = /\/spreadsheets\/d\/e\/([^/]+)\/(pub|pubhtml)/i.exec(u.pathname)
  if (published) {
    const out = new URL(`https://docs.google.com/spreadsheets/d/e/${published[1]}/pub`)
    out.searchParams.set('output', 'csv')
    // Keep the tab if one was named; without it Google serves the first sheet.
    const gid = u.searchParams.get('gid') ?? gidFromHash(u.hash)
    if (gid) out.searchParams.set('gid', gid)
    // `single=true` keeps /pubhtml links from coming back as a whole workbook.
    out.searchParams.set('single', 'true')
    return { url: out.toString(), kind: 'published', warning: null }
  }

  // An ordinary /d/<ID>/edit link.
  const doc = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(u.pathname)
  if (doc) {
    const out = new URL(`https://docs.google.com/spreadsheets/d/${doc[1]}/export`)
    out.searchParams.set('format', 'csv')
    const gid = u.searchParams.get('gid') ?? gidFromHash(u.hash)
    if (gid) out.searchParams.set('gid', gid)
    return {
      url: out.toString(),
      kind: 'export',
      warning: `That is a normal sheet link rather than a published one. It only works if the sheet is shared so that anyone with the link can view it — otherwise Google answers with a sign-in page. ${PUBLISH_ADVICE}`,
    }
  }

  return { url: u.toString(), kind: 'raw', warning: null }
}

function gidFromHash(hash: string): string | null {
  const m = /gid=([0-9]+)/.exec(hash || '')
  return m ? m[1]! : null
}

/**
 * Does this look like a web page rather than CSV?
 *
 * Checked before parsing, because Google answers a request for a sheet you
 * cannot read with 200 and a sign-in page.
 */
export function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 1000).trim().toLowerCase()
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    (head.includes('<head') && head.includes('<meta')) ||
    head.includes('<title>google')
  )
}

export class SheetFetchError extends Error {
  constructor(
    message: string,
    /** What the user should do, if there is something. */
    readonly advice: string | null = null,
  ) {
    super(message)
    this.name = 'SheetFetchError'
  }
}

/**
 * Fetch the CSV behind a sheet URL.
 *
 * `fetchImpl` is injectable so the tests can drive every failure path without
 * a network — which matters, because the failure paths are the whole point of
 * this file.
 */
export async function fetchSheetCsv(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ csv: string; normalised: NormalisedSheetUrl }> {
  const normalised = normaliseSheetUrl(input)
  if (!normalised) {
    throw new SheetFetchError('That is not a URL.', 'Paste the full https:// link to the sheet.')
  }

  let res: Response
  try {
    res = await fetchImpl(normalised.url, { redirect: 'follow', credentials: 'omit' })
  } catch {
    // A CORS refusal is indistinguishable from an offline network here: fetch
    // rejects with an opaque TypeError either way, by design.
    throw new SheetFetchError(
      'The browser could not read that link.',
      normalised.kind === 'export'
        ? PUBLISH_ADVICE
        : `Either the link is not published, or you are offline. ${PUBLISH_ADVICE}`,
    )
  }

  if (!res.ok) {
    // 404 means different things for the two link shapes, and the generic
    // "check publishing" advice is actively misleading for an edit link that
    // simply has a typo in the document id.
    const advice =
      res.status === 404
        ? normalised.kind === 'published'
          ? 'Check the link — a published link stops working if publishing is turned off.'
          : `Check the link. If it is right, the sheet is probably not readable without signing in. ${PUBLISH_ADVICE}`
        : PUBLISH_ADVICE
    throw new SheetFetchError(
      `The sheet answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`,
      advice,
    )
  }

  const csv = await res.text()
  if (looksLikeHtml(csv)) {
    throw new SheetFetchError(
      'That link returned a web page rather than CSV — usually Google’s sign-in page, which means the sheet is not public.',
      PUBLISH_ADVICE,
    )
  }
  if (!csv.trim()) {
    throw new SheetFetchError('The sheet came back empty.', 'Check the right tab is published.')
  }

  return { csv, normalised }
}
