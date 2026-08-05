# AGENTS.md — Thumbnail Generator

LLM onboarding. Read this before changing anything. [CLAUDE.md](CLAUDE.md) is the
short command reference.

## What this is

A browser-only React/TS/Vite SPA that turns a list of source names into a folder
of labelled thumbnail images, downloaded as a ZIP. No backend. Deployed as a
**Cloudflare Worker serving static assets** — *not* a Pages project (see
`wrangler.toml`; the fleet does not use Pages, and `pages_build_output_dir` fails
in a way that reads like a missing build step).

The cards are modelled on an existing tool called Kards: a radial gradient in one
colour, a white knockout icon, the source name under it, an optional dimension
label along the top and an optional footer bottom-right.

The intended destinations are **Barco Eventmaster** and **Analog Way RCS2**
source thumbnails. See "What is not verified" — that intent is not yet tested
against either.

## The shape of it

The unit of work is a **`Card`**: one source name that becomes one image file.
A `Batch` holds the cards plus the defaults they inherit from.

```
src/types.ts          Card, Batch, SizeMode, Style, Layout — read this first
src/lib/colour.ts     hex/HSL, the gradient derivation, contrast decision
src/lib/resolve.ts    fills in what a card inherits from its batch
src/lib/filename.ts   label -> filename, and de-duplication
src/lib/encode.ts     the pluggable format registry + canvas size limits
src/lib/zip.ts        store-only ZIP writer (copied from ~/Projects/test-card)
src/lib/export.ts     render every card, name, pack, download
src/import/csv.ts     RFC 4180 parser, CSV/TSV/semicolon. Pure text
src/import/mapping.ts headers -> fields, values -> Card, with warnings
src/import/sheets.ts  Google Sheet URL shapes and their failure modes
src/import/template.ts the starter CSV, which is also a test fixture
src/render/icons.ts   icon geometry as pure data
src/render/layout.ts  where everything goes. Pure numbers. Test this.
src/render/draw.ts    the painters. The only file that touches a 2D context
src/render/render.ts  canvas creation and orchestration
src/state/            zustand store, persisted to localStorage
src/ui/               React
```

## Invariants — do not break these

**1. Geometry is pure; canvases are dumb.**
`layoutCard()` returns boxes and is unit tested. `draw.ts` fits content into
those boxes and makes no layout decisions. Do not move positioning maths into a
painter — it becomes untestable the moment it needs a `CanvasRenderingContext2D`.

**2. The preview and the export call the same painter.**
`Preview.tsx` goes through `renderCardTo`, at the card's **full raster**, and
scales down with CSS. Rendering the preview at a convenient screen size would be
faster and would be a lie: layout scale is derived from raster height, so a card
previewed at 480px and exported at 2160 is not the same card. Two painters drift,
and the bug you get is a card that looked right on screen and is wrong in the ZIP.

**3. Nothing downstream of `resolve.ts` sees a null.**
Cards carry `null` size and colour meaning "inherit". `resolveCard()` is the only
place that fills those in. A painter that invents its own default will disagree
with the preview about what colour a card is.

**4. The gradient is derived, never tabulated.**
`gradientStops()` turns one base colour into a light centre and a dark edge. The
multipliers were fitted against the reference cards and reproduce all three of
them. A per-colour table would be a hundred chances to get one wrong.

**5. Icon geometry is data, and it is ours.**
`icons.ts` holds shapes in a 24×24 box, not SVG lifted from an icon set. Two
reasons: these cards go into client-facing show files, so a vendored icon set
drags its attribution along; and icon sets are drawn as 24px strokes, which turn
to mush filled at 250px. Keep new icons as `Shape[]`, and inside the box — the
test enforces it.

**6. Adding an image format is `encode.ts` plus one line in `FormatId`.**
Nothing else in the app knows what a PNG is. It was built this way because it is
not yet confirmed what the target hardware accepts.

**7. An import never coerces silently.**
Every value `mapping.ts` cannot understand produces a warning naming the row,
the field and the text, and falls back to the batch default. A spreadsheet with
`1920*1080` in it must not quietly yield forty 1080p cards that look right.
Nothing reaches the batch until the user has seen the staged preview.

**8. The template CSV is a test fixture.**
`template.ts` is imported by `mapping.test.ts`, which asserts it parses with
**zero** warnings and demonstrates every size form. The template is the
documentation, so if it stops being importable a test goes red rather than the
docs quietly becoming wrong.

## What is NOT verified

Be honest about this in anything user-facing.

- **No output has ever been loaded onto an Eventmaster or a LiveCore frame.**
  PNG is an assumption, not a measurement. So is every filename policy decision.
  If the gear turns out to want BMP, that is a new entry in `ENCODERS`.
- **The preset list is generic**, not taken from either vendor's documentation.
- **Fonts are a system stack**, so output is not byte-identical across machines.
  See the long comment at the top of `draw.ts` for the fix if it ever matters.

## Traps that have already cost time

**A gradient PNG is enormous.** A 2056×1329 card is ~2.5 MB as PNG and ~93 KB as
JPEG at quality 0.92 — measured, a 27× difference. The dithering browsers apply
across a smooth gradient leaves PNG's filters nothing to work with. A 48-source
batch is therefore ~100 MB of PNGs. The export reports the archive size for this
reason; turning the gradient off drops PNG to a few KB.

**Browsers return a blank canvas over the size limit, they do not throw.** An
oversized batch would export a folder of correctly-sized empty files that look
fine in a listing. `canvasLimitProblem()` runs *before* anything is drawn. Do not
remove it.

**`toBlob` falls back to PNG for a MIME type it does not know**, rather than
failing — so a "JPEG" export would quietly be a PNG with a `.jpg` on it.
`canvasToBytes` checks `blob.type` against what was asked for.

**Windows silently discards trailing dots and spaces.** "Vision 4." and
"Vision 4" become the same file *after* extraction, past the point where
`uniqueNames` could have caught it. `safeStem` strips them first.

**macOS `unzip` is Info-ZIP 6.00 from 2009 and ignores the UTF-8 flag.** It
refuses to extract non-ASCII names at all with "Illegal byte sequence",
regardless of `LC_ALL`. That is the binary, not the archive. The tests verify
UTF-8 names with Python's `zipfile` and use `unzip` only for ASCII round-trips.

**Layout scale tracks height, not a contained design box.** Containing 1920×1080
inside the raster is the obvious move and it is wrong: on a 1080×1920 portrait
card it paints a small landscape-proportioned island in the middle. See the
comment at the top of `layout.ts`.

**`iconBounds` ignores holes on purpose.** The microphone squares off its cradle
with a rectangle that pokes outside the ring; counting it would inflate the box
and shrink that icon for no visible reason.

**Google answers a request for a sheet you cannot read with `200 OK` and an
HTML sign-in page**, not an error status. Fed to a CSV parser that is one absurd
row of markup and an import that looks like it half-worked. `looksLikeHtml()`
runs before parsing. Do not remove it.

**`/export?format=csv` is not categorically CORS-blocked.** An earlier comment
here claimed it was; real requests on 2026-08-05 — both `/export` and the
published `/d/e/…/pub` — passed CSP and CORS from the deployed origin and
returned readable 404s for made-up ids. Both endpoints send CORS headers; they
fail on *authorisation*, not on CORS. The published link is still the one to
recommend, but the wording must not tell users their link cannot possibly work.

**Splitting on commas outside quotes matters for delimiter sniffing too.** A
tab-separated paste containing `"Lectern, stage left"` would otherwise look
comma-heavy and be parsed as CSV, putting the whole row in one cell.

**`1920x1080` and `16x9` are told apart by magnitude, not separator.** `x` is a
legitimate ratio separator and people write `16x9`. Anything with both numbers
under 100 is a ratio.

## Testing

`npm test` — 128 tests, all offline, no browser needed.

`export.test.ts` stubs `OffscreenCanvas` and `Path2D` and drives the real
`exportBatch`, then reads the resulting archive back with Python's `zipfile`. It
covers the join — naming, de-duplication, the manifest agreeing with the
entries, per-card raster overrides, and one bad card not sinking the batch —
which is the part that actually breaks.

## Not doing, on purpose

- **No `diag` module.** Static browser page; nowhere for a rotating log to go.
  Same call as blend-calc and test-card.
- **No ZIP64.** Capped at 4 GiB and 65535 entries, and `buildZip` throws rather
  than emitting a corrupt archive.
- **No compression in the ZIP.** PNG and JPEG are already compressed; store-only
  saves a dependency and buys ~0%.
- **No releases or installers.** This repo exists to feed the deployed app.

## Generated files — never hand-edit

All four are written by `stoatworks-backend` and are overwritten by the next
sync:

- **`ATTRIBUTIONS.md`** and the marker block in `README.md` — from
  `scripts/sync-attributions.py --only thumbnail-generator`. Components are
  *detected* from the tree, not listed by hand.
- **`public/about.js` / `public/about-data.js`** — from
  `scripts/sync-about.py --apply --only thumbnail-generator`. The facts come
  from the website's `projects.json`; this repo is registered in that script's
  `TARGETS` map as `("thumbnail-generator", "web", "public")`.
- **`public/support-footer.js`** — from `scripts/sync-support-footer.sh`.

Where the project is registered, if any of it needs changing:

| What | Where |
| --- | --- |
| Project card, summary, thumbnail | `stoatworks-website/src/data/projects.json` |
| Nav entry and hosted URL | `stoatworks-website/src/data/webtools.json` |
| Page copy (headline, features, caveats) | `stoatworks-website/src/pages/web-tools.astro`, keyed by slug |
| Thumbnail source screenshot + crop | `stoatworks-website/scripts/shots.json` |
| Docker image / Unraid template | `stoatworks-unraid/fleet.json` + `unraid.json` |
| Dev server port (5210) | `~/.claude/launch.json` and `.claude/launch.json` |
