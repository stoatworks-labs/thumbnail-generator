/**
 * Turning a finished canvas into file bytes.
 *
 * WHY THIS IS A REGISTRY AND NOT A `toBlob` CALL
 * ==============================================
 * It is not yet confirmed what Eventmaster and RCS2 will actually accept. PNG
 * is the safe assumption and the only format proven against real hardware so
 * far — which is to say, none of them are. So the encoder is a lookup rather
 * than a hardcoded call, and adding BMP (LiveCore serves its own input
 * snapshots as BMP, so it is the likeliest addition) is a new entry here plus
 * one line in `FormatId`. Nothing else in the app knows what a PNG is.
 *
 * TO ADD A FORMAT
 * ---------------
 * 1. Add its id to `FormatId` in `types.ts`.
 * 2. Add an `Encoder` below. If the browser cannot produce it natively, write
 *    the bytes yourself from `getImageData` — see the note on BMP.
 * 3. That is all. The UI enumerates `ENCODERS`; the exporter asks for bytes.
 */

import type { FormatId } from '../types'

export type Encoder = {
  id: FormatId
  label: string
  mime: string
  /** Including the leading dot. */
  ext: string
  /**
   * 0..1, or null if the format has no quality knob. Surfaced in the UI only
   * for the formats that have one.
   */
  defaultQuality: number | null
  /** Shown next to the format in the UI. Keep it to one line. */
  note?: string
  encode(canvas: RenderTarget, quality: number | null): Promise<Uint8Array>
}

/** Either canvas flavour. Export uses Offscreen where available; preview does not. */
export type RenderTarget = HTMLCanvasElement | OffscreenCanvas

/**
 * The one place that copes with the two canvas APIs having different names for
 * the same operation, and with `toBlob` reporting failure by handing back null
 * instead of rejecting.
 */
async function canvasToBytes(
  canvas: RenderTarget,
  mime: string,
  quality: number | null,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    if ('convertToBlob' in canvas) {
      canvas
        .convertToBlob(quality === null ? { type: mime } : { type: mime, quality })
        .then(resolve, reject)
      return
    }
    if (quality === null) canvas.toBlob(resolve, mime)
    else canvas.toBlob(resolve, mime, quality)
  })

  if (!blob) {
    throw new Error(`The browser refused to encode ${mime}.`)
  }
  // A browser that does not know the MIME type silently falls back to PNG
  // rather than failing, so a "JPEG" export would quietly be a PNG with the
  // wrong extension. Catch it here, where the type is still checkable.
  if (blob.type !== mime) {
    throw new Error(
      `The browser encoded ${blob.type || 'an unknown type'} when ${mime} was asked for.`,
    )
  }
  return new Uint8Array(await blob.arrayBuffer())
}

export const ENCODERS: Record<FormatId, Encoder> = {
  png: {
    id: 'png',
    label: 'PNG',
    mime: 'image/png',
    ext: '.png',
    defaultQuality: null,
    // Measured, not guessed: a 2056×1329 gradient card is ~2.5 MB as PNG and
    // ~93 KB as JPEG at 0.92. The dithering browsers apply across a smooth
    // gradient gives PNG's filters almost nothing to work with. Switching the
    // gradient off brings PNG back down to a few KB.
    note: 'Lossless, but a gradient card is ~25× bigger than JPEG.',
    encode: (canvas) => canvasToBytes(canvas, 'image/png', null),
  },
  jpeg: {
    id: 'jpeg',
    label: 'JPEG',
    mime: 'image/jpeg',
    ext: '.jpg',
    defaultQuality: 0.92,
    note: 'Smaller files. Flat colour and hard edges show ringing.',
    encode: (canvas, q) => canvasToBytes(canvas, 'image/jpeg', q ?? 0.92),
  },
}

export function encoderFor(id: FormatId): Encoder {
  const e = ENCODERS[id]
  if (!e) throw new Error(`No encoder registered for "${id}".`)
  return e
}

/**
 * Browsers return a BLANK canvas above their size limit rather than throwing,
 * so an oversized batch would export a folder of empty files that look
 * perfectly fine in a listing and are discovered on site.
 *
 * The real limits are per-browser and undocumented; these are the conservative
 * intersection (Safari is the tight one, at 16777216 px total on iOS). Returns
 * a message to show the user, or null if the raster is fine.
 */
export function canvasLimitProblem(w: number, h: number): string | null {
  const MAX_EDGE = 16384
  const MAX_AREA = 16777216
  if (w < 1 || h < 1 || !Number.isFinite(w) || !Number.isFinite(h)) {
    return 'Raster must be at least 1 × 1 pixel.'
  }
  if (w > MAX_EDGE || h > MAX_EDGE) {
    return `${w} × ${h} exceeds the ${MAX_EDGE}px maximum edge a browser canvas can hold.`
  }
  if (w * h > MAX_AREA) {
    return `${w} × ${h} is ${(((w * h) / MAX_AREA) * 100).toFixed(0)}% over the area a browser canvas can hold.`
  }
  return null
}
