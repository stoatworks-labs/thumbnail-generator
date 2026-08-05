import { describe, expect, it } from 'vitest'

import { fetchSheetCsv, looksLikeHtml, normaliseSheetUrl, SheetFetchError } from './sheets'

const PUB =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vABCDEF/pubhtml?gid=123456&single=true'
const EDIT = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit#gid=987654'

describe('normaliseSheetUrl', () => {
  it('turns a published link into a CSV one, keeping the tab', () => {
    const n = normaliseSheetUrl(PUB)!
    expect(n.kind).toBe('published')
    expect(n.warning).toBeNull()
    const u = new URL(n.url)
    expect(u.pathname).toBe('/spreadsheets/d/e/2PACX-1vABCDEF/pub')
    expect(u.searchParams.get('output')).toBe('csv')
    expect(u.searchParams.get('gid')).toBe('123456')
    expect(u.searchParams.get('single')).toBe('true')
  })

  it('converts an edit link but flags that it will be blocked', () => {
    // The important half: this URL is real CSV and is still unreadable from
    // another origin, so the user has to be told to publish rather than left
    // to retry.
    const n = normaliseSheetUrl(EDIT)!
    expect(n.kind).toBe('export')
    expect(n.url).toContain('/export?format=csv')
    expect(n.url).toContain('gid=987654')
    expect(n.warning).toMatch(/publish/i)
  })

  it('reads the tab out of the fragment as well as the query', () => {
    expect(normaliseSheetUrl(EDIT)!.url).toContain('987654')
  })

  it('passes any other https CSV URL straight through', () => {
    const n = normaliseSheetUrl('https://example.com/sources.csv')!
    expect(n.kind).toBe('raw')
    expect(n.url).toBe('https://example.com/sources.csv')
    expect(n.warning).toBeNull()
  })

  it('rejects what is not a URL', () => {
    expect(normaliseSheetUrl('')).toBeNull()
    expect(normaliseSheetUrl('not a url')).toBeNull()
    expect(normaliseSheetUrl('ftp://example.com/a.csv')).toBeNull()
  })
})

describe('looksLikeHtml', () => {
  it('spots a sign-in page', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html><head><title>Google Sign-in</title>')).toBe(true)
    expect(looksLikeHtml('<html lang="en"><body>')).toBe(true)
  })

  it('does not mistake CSV for a page', () => {
    expect(looksLikeHtml('name,icon\nPC 1,laptop')).toBe(false)
    // A source could legitimately be called this.
    expect(looksLikeHtml('name\n<html> demo screen')).toBe(false)
  })
})

const ok = (body: string) =>
  Object.assign(async () => new Response(body, { status: 200 }), {}) as unknown as typeof fetch

describe('fetchSheetCsv', () => {
  it('returns the CSV for a published sheet', async () => {
    const { csv, normalised } = await fetchSheetCsv(PUB, ok('name,icon\nPC 1,laptop'))
    expect(csv).toContain('PC 1')
    expect(normalised.kind).toBe('published')
  })

  it('turns a CORS refusal into advice, not a stack trace', async () => {
    // fetch rejects with an opaque TypeError for a CORS block, by design —
    // indistinguishable from being offline, so the message has to cover both.
    const boom = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(fetchSheetCsv(EDIT, boom)).rejects.toMatchObject({
      name: 'SheetFetchError',
      advice: expect.stringMatching(/Publish to web/i),
    })
  })

  const notFound = (async () =>
    new Response('nope', { status: 404, statusText: 'Not Found' })) as unknown as typeof fetch

  async function rejection(p: Promise<unknown>): Promise<SheetFetchError> {
    try {
      await p
    } catch (e) {
      return e as SheetFetchError
    }
    throw new Error('expected a rejection')
  }

  it('reports an HTTP error with its status', async () => {
    const err = await rejection(fetchSheetCsv(PUB, notFound))
    expect(err).toBeInstanceOf(SheetFetchError)
    expect(err.message).toContain('404')
  })

  it('gives 404 advice that fits the link shape', async () => {
    // The same status means different things: a published link that has been
    // unpublished, versus an edit link with a typo or a private sheet. The
    // generic "check publishing" line is actively wrong for the second.
    const pub = await rejection(fetchSheetCsv(PUB, notFound))
    expect(pub.advice).toMatch(/publishing is turned off/i)

    const edit = await rejection(fetchSheetCsv(EDIT, notFound))
    expect(edit.advice).toMatch(/not readable without signing in/i)
  })

  it('catches the 200-OK sign-in page instead of parsing it as CSV', async () => {
    // The silent failure this whole file exists for: Google answers a request
    // for a sheet you cannot read with 200 and a login page.
    await expect(
      fetchSheetCsv(PUB, ok('<!DOCTYPE html><html><head><title>Google Sheets</title></head>')),
    ).rejects.toMatchObject({
      name: 'SheetFetchError',
      message: expect.stringMatching(/web page rather than CSV/i),
    })
  })

  it('rejects an empty response', async () => {
    await expect(fetchSheetCsv(PUB, ok('   '))).rejects.toMatchObject({
      message: expect.stringMatching(/empty/i),
    })
  })

  it('rejects a non-URL before touching the network', async () => {
    let called = false
    const spy = (async () => {
      called = true
      return new Response('')
    }) as unknown as typeof fetch
    await expect(fetchSheetCsv('nonsense', spy)).rejects.toBeInstanceOf(SheetFetchError)
    expect(called).toBe(false)
  })
})
