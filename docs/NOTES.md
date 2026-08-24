# Notes

Working notes for this repo: status, decisions, and the traps that have actually bitten.
Migrated out of Claude Code's memory on 2026-08-24, so they are written in the first
person and dated by when each thing was learned — that date is usually the useful part.

Cross-cutting notes that are not specific to this repo live in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).

*Thumbnail Generator — browser app bulk-building labelled source thumbnails (name/icon/colour/raster) for Eventmaster and RCS2, out as a ZIP; PNG only so far and never tested on real hardware*

**PUBLIC since 2026-08-05** — the private-repo statements below are historical; the repo, its Docker packaging and its `/software` page are all live. See [browser tools published](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/project_browser_tools_published.md).

**Thumbnail Generator** — turn a list of source names into a folder of labelled
thumbnail cards, downloaded as a ZIP. React/TS/Vite static SPA, no backend.
`~/Projects/thumbnail-generator`, MIT. Built 2026-08-05.

**LIVE at thumbnail-generator.stoatworks-labs.com** — static-assets Worker,
custom domain attached in `wrangler.toml` as a `**routes**` entry with
`custom_domain = true`. `stoatworks-labs/thumbnail-generator`, **PUBLIC**.
On the website (projects.json + webtools.json + page copy in web-tools.astro +
`/thumbs/thumbnail-generator.png`, cropped via `scripts/shots.json`). Docker
packaging added from stoatworks-unraid. Dev server on **port 5210** in both
`~/.claude/launch.json` and the repo's own `.claude/launch.json`.

Cards are modelled on an existing tool called **Kards** (reference images the
user supplied): radial gradient in one colour, white knockout icon, source name
under it, optional `1920 x 1080` header and optional footer bottom-right. Both
overlays toggleable, on by default.

**The intended targets are Barco Eventmaster and Analog Way RCS2 — and nothing
has ever been loaded onto either.** PNG is an assumption, not a measurement; so
are the size presets (generic, not from vendor docs) and the filename policy.
That is why `src/lib/encode.ts` is a **format registry**: adding BMP (the
likeliest addition — LiveCore serves its own input snapshots as BMP, see
[db oca aes70 protocol](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_db_oca_aes70_protocol.md) siblings and [openrcs](https://github.com/stoatworks-labs/openrcs/blob/main/docs/NOTES.md) (`openrcs`)) is one
entry there plus one line in `FormatId`. Nothing else knows what a PNG is.

**Measured trap: a gradient PNG is ~25× a JPEG.** A 2056×1329 card is ~2.5 MB as
PNG against ~93 KB as JPEG q0.92 — browsers dither smooth gradients, leaving
PNG's filters nothing to work with. A 48-source batch is ~100 MB of PNGs. The
export reports archive size for this reason; turning the gradient off drops PNG
to a few KB.

**Layout scale tracks raster HEIGHT, not a contained 1920×1080 design box.**
Containing is the obvious move and is wrong — on a 1080×1920 portrait card it
paints a small landscape-proportioned island in the middle. Clamped by a
`w/420` term so a tall narrow card cannot draw the icon wider than the card.

**Icon geometry is ours, as pure data** (`src/render/icons.ts`, 19 icons in a
24×24 box, `Shape[]` with even-odd holes). Not a vendored icon set: these go
into client-facing show files so attribution would follow them, and icon sets
are drawn as 24px strokes that turn to mush filled at 250px. `iconBounds`
ignores holes on purpose — the mic's cradle uses a rectangle poking outside the
ring.

Gradient stops are **derived from the base colour, never tabulated**
(`gradientStops`, multipliers fitted against the three reference cards). Text
colour auto-picks on gamma-decoded Rec.709 luminance with a 0.45 threshold —
deliberately above the 0.1791 WCAG crossover, to match the reference cards using
white on a saturated yellow.

`src/lib/zip.ts` is **copied from [test card](https://github.com/stoatworks-labs/test-card/blob/main/docs/NOTES.md) (`test-card`)**, minus its
`uniqueNames`. No internal registry in the fleet, so it is a copy — fix a bug in
one and fix it in the other.

128 tests, all offline. `export.test.ts` stubs `OffscreenCanvas`/`Path2D`, drives
the real `exportBatch` and reads the archive back with Python's `zipfile` —
covers naming, de-duplication, manifest agreement, per-card raster overrides and
one-bad-card-does-not-sink-the-batch.

**Import (CSV / paste / Google Sheets)** — `src/import/`. Four columns, only
`name` required; headings matched loosely and read positionally when none is
recognised. **Nothing is applied until a staged preview is shown** listing every
value that could not be read, with the spreadsheet row number — silent coercion
is the failure this feature exists to prevent. `1920x1080` vs `16x9` is told
apart by **magnitude, not separator**. The template CSV is also a test fixture,
asserted to import with zero warnings. Hand-rolled RFC 4180 parser: delimiter
sniffing ignores quoted content, or a TSV paste containing `"Lectern, stage
left"` parses as CSV.

**Google Sheets findings (measured 2026-08-05 from the deployed origin)**: BOTH
`/d/e/<token>/pub?output=csv` and `/d/<id>/export?format=csv` passed CSP and
CORS and returned readable 404s for made-up ids — so neither is CORS-blocked,
they fail on **authorisation**. An earlier assumption that `/export` was
categorically blocked was wrong. The real trap: Google answers a request for an
unreadable sheet with **200 OK and an HTML sign-in page**, so `looksLikeHtml()`
runs before parsing. `connect-src` needs `docs.google.com` **and**
`*.googleusercontent.com` (the redirect target; CSP checks every hop). Never
tried against a genuinely published sheet — needs a real Google account.

Generated, never hand-edited: `ATTRIBUTIONS.md` + the README marker block
(`sync-attributions.py --only thumbnail-generator`), `public/about.js` +
`about-data.js` (`sync-about.py --apply --only thumbnail-generator`; registered
in that script's `TARGETS` map). about-data picked up the repo URL and MIT
licence **by itself** when the repo went public, which is the argument for
generating it rather than hardcoding a link.

Fonts are a **system stack**, so output is not byte-identical across machines;
the fix (vendor an OFL woff2, await `document.fonts.ready`) is written up at the
top of `src/render/draw.ts`.

Related: [agents md convention](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_agents_md_convention.md), [pages demo hosting](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_pages_demo_hosting.md),
[cloudflare access](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_cloudflare_access.md), [test card](https://github.com/stoatworks-labs/test-card/blob/main/docs/NOTES.md) (`test-card`).
