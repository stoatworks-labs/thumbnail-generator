# Thumbnail Generator

> **AI-assisted project.** This codebase was created with [Claude Code](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author. The cards are built and checked in a
> browser, with 71 tests behind them: they render at their true raster, long names shrink and then
> wrap to two lines inside the margins, odd rasters such as 2056×1329 lay out correctly, and the PNG
> encoder produces a valid file whose header matches the canvas. **No output has ever been loaded
> onto an Eventmaster or a LiveCore frame.** PNG is a reasonable assumption about what those accept
> rather than a measurement, and the size presets are generic rather than taken from either vendor's
> documentation — which is why the encoder is a format registry, so a different format is one entry
> rather than a rewrite.

Bulk-build labelled source thumbnails for **Barco Eventmaster** and **Analog Way
RCS2**. Type a list of sources, pick an icon, a size and a colour for each, and
download the lot as a ZIP with one image per source, named after it.

Runs entirely in the browser. Nothing is uploaded; the batch you build is saved
in the browser's local storage so it survives closing the tab.

## What a card looks like

A radial gradient in the source's colour, a white knockout icon, and the source
name below it. Optionally a dimension label along the top (`1920 x 1080`) and a
footer bottom-right. Both are on by default and can be turned off.

## Using it

1. **Add sources.** One at a time, or *Paste a list* and drop in a column
   straight out of a patch sheet — newline or comma separated.
2. **Set the icon** per source: camera, video camera, projector, monitor,
   laptop, desktop, tablet, phone, USB stick, drive, playback, clip, slides,
   microphone, speaker, server, network, web, or none.
3. **Set the size.** 1080p by default. Per source you can override with a
   preset, an exact pixel size, or an aspect ratio plus a long edge.
4. **Set the colour**, or leave *Give each source its own colour* on and let it
   spread them around the hue wheel.
5. **Generate.** You get a ZIP of images plus a `manifest.csv` listing which
   file went with which source, at what size and colour.

## Filenames

The label on the card and the name of the file are the same string. Names are
made unique before packing — two sources called "Laptop" become `Laptop.png` and
`Laptop-2.png`, because a ZIP with duplicate names extracts to one file and
silently loses a card.

**Safe filenames** (in Export) folds everything to ASCII with underscores for
spaces. Use it when the files are going straight onto a frame rather than onto a
computer.

## Formats

PNG by default; JPEG with a quality slider is also there.

Be aware that **a gradient card is about 25× bigger as a PNG than as a JPEG** —
a 2056×1329 card measures ~2.5 MB against ~93 KB. Browsers dither smooth
gradients, which leaves PNG's compression nothing to work with. A 48-source
batch of PNGs is around 100 MB. The export tells you the archive size. Turning
the gradient off brings PNG back down to a few kilobytes.

Adding another format (BMP, say) is a small, contained change — see
`src/lib/encode.ts`.

## What has and has not been verified

Built and checked in a browser: the cards render at their true raster, the
gradient runs light-centre to dark-corner, long names shrink and then wrap to
two lines inside the margins, odd rasters like 2056×1329 lay out correctly, and
the PNG encoder produces a valid file whose header matches the canvas.

**No output has been loaded onto an Eventmaster or a LiveCore frame.** PNG is a
reasonable assumption about what those accept, not a measurement, and the size
presets are generic rather than taken from either vendor's documentation. If the
gear turns out to want something else, the encoder registry is where it goes.

Output is also not byte-identical across machines, because the card uses a
system font stack rather than a bundled one. Immaterial for labels like "PC 2";
worth knowing if you ever diff two machines' output.

## Development

```bash
npm install
npm run dev
npm test
```

71 tests, all offline. The pure layers — layout geometry, colour derivation,
filename policy, icon bounds, the ZIP writer — are unit tested, and
`export.test.ts` drives the real export end to end against a stubbed canvas and
reads the resulting archive back with Python's `zipfile`.

See [AGENTS.md](AGENTS.md) for the model, the invariants and the traps.

<!-- attributions:start -->
This project is built on other people's work — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
<!-- attributions:end -->

## Licence

MIT. Not a distributable product — this repo exists to feed the deployed web
app, so it has no releases and no installers.
