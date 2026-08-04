/**
 * The icon set, as pure geometry.
 *
 * WHY HAND-BUILT DATA AND NOT AN ICON LIBRARY
 * ===========================================
 * Two reasons, in order of how much trouble they save. First, licensing: these
 * cards go into client-facing show files, and vendoring someone's icon set
 * drags its attribution requirements along behind them. Second, these are not
 * UI icons — they are painted 250px tall as a flat knockout on a coloured
 * field, and icon sets are drawn as strokes at 24px, which turns to mush at
 * that size and cannot be filled as a single silhouette.
 *
 * THE MODEL
 * ---------
 * Every icon is drawn in a 24×24 box and scaled from there. An icon is a list
 * of `parts`; each part is filled with the even-odd rule, so anything in its
 * `holes` is knocked back out to show the background through it — that is how
 * the camera gets its lens and the monitor gets its screen.
 *
 * Parts are filled in order and all in the same colour, so a later part can
 * paint back over an earlier part's hole. The globe uses that: a ring, then a
 * meridian ring, then a bar across the middle.
 *
 * No strokes anywhere. A stroke scales its width independently of the shape and
 * needs the half-pixel dance to stay crisp; a filled silhouette just works at
 * any size, which is the whole requirement here.
 */

export type Shape =
  | { t: 'rrect'; x: number; y: number; w: number; h: number; r: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'poly'; pts: readonly (readonly [number, number])[] }

export type IconPart = { shapes: Shape[]; holes?: Shape[] }

export type Icon = {
  id: string
  label: string
  /** Groups the picker. Purely presentational. */
  group: 'Vision' | 'Computer' | 'Playback' | 'Infrastructure' | 'Other'
  parts: IconPart[]
}

/** The box every icon is drawn in. Do not change without redrawing all of them. */
export const ICON_BOX = 24

const rr = (x: number, y: number, w: number, h: number, r: number): Shape => ({
  t: 'rrect', x, y, w, h, r,
})
const ci = (cx: number, cy: number, r: number): Shape => ({ t: 'circle', cx, cy, r })
const el = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  t: 'ellipse', cx, cy, rx, ry,
})
const po = (...pts: (readonly [number, number])[]): Shape => ({ t: 'poly', pts })

/** Evenly spaced small squares, for sprocket holes and rack vents. */
function repeat(n: number, fn: (i: number) => Shape): Shape[] {
  return Array.from({ length: n }, (_, i) => fn(i))
}

export const ICONS: Icon[] = [
  {
    id: 'camera',
    label: 'Camera',
    group: 'Vision',
    parts: [
      {
        shapes: [rr(2, 7, 20, 13, 2.2), rr(8.6, 4.2, 6.8, 4.2, 1.2)],
        holes: [ci(12, 13.6, 3.3)],
      },
    ],
  },
  {
    id: 'video-camera',
    label: 'Video camera',
    group: 'Vision',
    parts: [
      {
        shapes: [rr(2, 7, 13.5, 10.5, 1.8), po([16.5, 11], [22, 7.8], [22, 16.7], [16.5, 13.5])],
        holes: [ci(8.75, 12.25, 2.4)],
      },
    ],
  },
  {
    id: 'projector',
    label: 'Projector',
    group: 'Vision',
    parts: [
      {
        shapes: [rr(2, 7, 16, 9.5, 2), ci(18.6, 11.75, 3.4)],
        holes: [ci(18.6, 11.75, 1.5), ci(5.6, 10, 1.1)],
      },
      { shapes: [rr(4.2, 16.5, 2.6, 1.7, 0.4), rr(13.2, 16.5, 2.6, 1.7, 0.4)] },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    group: 'Vision',
    parts: [
      { shapes: [rr(2, 3.5, 20, 14, 2)], holes: [rr(4, 5.5, 16, 10, 0.7)] },
      { shapes: [rr(10.6, 17.5, 2.8, 2.2, 0.3), rr(6.5, 19.4, 11, 1.9, 0.95)] },
    ],
  },
  {
    id: 'laptop',
    label: 'Laptop',
    group: 'Computer',
    parts: [
      { shapes: [rr(4, 3.8, 16, 11.4, 1.4)], holes: [rr(5.5, 5.3, 13, 8.4, 0.6)] },
      { shapes: [rr(1.5, 16.2, 21, 2.5, 1.25)] },
    ],
  },
  {
    id: 'desktop',
    label: 'Desktop computer',
    group: 'Computer',
    parts: [
      { shapes: [rr(8, 4, 14, 10.2, 1.4)], holes: [rr(9.4, 5.4, 11.2, 7.4, 0.5)] },
      { shapes: [rr(13.6, 14.2, 2.8, 2.1, 0.3), rr(10.4, 16.3, 9.2, 1.7, 0.85)] },
      {
        shapes: [rr(1.6, 6, 4.8, 13, 1)],
        holes: [ci(4, 8.2, 0.62), ...repeat(3, (i) => rr(2.8, 10.4 + i * 1.7, 3.2, 0.75, 0.35))],
      },
    ],
  },
  {
    id: 'tablet',
    label: 'Tablet',
    group: 'Computer',
    parts: [
      {
        shapes: [rr(5, 2.4, 14, 19.2, 2)],
        holes: [rr(6.5, 4.6, 11, 13.6, 0.5), ci(12, 19.9, 0.85)],
      },
    ],
  },
  {
    id: 'phone',
    label: 'Phone',
    group: 'Computer',
    parts: [
      {
        shapes: [rr(7, 1.8, 10, 20.4, 2.2)],
        holes: [rr(8.3, 4.4, 7.4, 14.2, 0.5), rr(10.6, 3.1, 2.8, 0.7, 0.35)],
      },
    ],
  },
  {
    id: 'usb',
    label: 'USB stick',
    group: 'Computer',
    parts: [
      { shapes: [rr(9.4, 1.8, 5.2, 4.6, 0.4)], holes: [rr(10.4, 2.8, 1, 1.6, 0.2), rr(13.6, 2.8, 1, 1.6, 0.2)] },
      { shapes: [rr(7, 6, 10, 16.2, 1.6)], holes: [rr(9, 8.6, 6, 1.5, 0.4)] },
    ],
  },
  {
    id: 'disk',
    label: 'Drive',
    group: 'Computer',
    parts: [
      {
        shapes: [rr(2, 5, 20, 14, 2)],
        // Two nested holes: the outer knocks a disc out, the inner flips back
        // to filled and becomes the spindle.
        holes: [ci(12, 12, 4.8), ci(12, 12, 1.25)],
      },
    ],
  },
  {
    id: 'play',
    label: 'Playback',
    group: 'Playback',
    parts: [{ shapes: [ci(12, 12, 10)], holes: [po([9.6, 6.9], [17.4, 12], [9.6, 17.1])] }],
  },
  {
    id: 'film',
    label: 'Clip / VT',
    group: 'Playback',
    parts: [
      {
        shapes: [rr(2, 4.5, 20, 15, 1.8)],
        holes: [
          rr(7.4, 6.4, 9.2, 11.2, 0.5),
          ...repeat(4, (i) => rr(3.5, 6.4 + i * 3.05, 2.1, 2.1, 0.4)),
          ...repeat(4, (i) => rr(18.4, 6.4 + i * 3.05, 2.1, 2.1, 0.4)),
        ],
      },
    ],
  },
  {
    id: 'slides',
    label: 'Slides',
    group: 'Playback',
    parts: [
      { shapes: [rr(2.4, 3, 19.2, 13, 1.6)], holes: [rr(4, 4.6, 16, 9.8, 0.5)] },
      { shapes: [rr(10.8, 16, 2.4, 2.6, 0.3), rr(6.8, 18.4, 10.4, 1.8, 0.9)] },
    ],
  },
  {
    id: 'mic',
    label: 'Microphone',
    group: 'Playback',
    parts: [
      { shapes: [rr(9, 1.8, 6, 11.4, 3)] },
      // The cradle, as a half-ring: outer disc minus inner disc, with the top
      // half squared off so only the U remains.
      {
        shapes: [ci(12, 11.4, 7)],
        holes: [ci(12, 11.4, 5.4), rr(4.6, 3.6, 14.8, 7.8, 0)],
      },
      { shapes: [rr(11.1, 17.6, 1.8, 3.6, 0.3), rr(8, 21, 8, 1.7, 0.85)] },
    ],
  },
  {
    id: 'speaker',
    label: 'Speaker',
    group: 'Playback',
    parts: [
      {
        shapes: [rr(5, 2, 14, 20, 1.8)],
        holes: [ci(12, 8, 3.4), ci(12, 16.4, 2.1)],
      },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    group: 'Infrastructure',
    parts: [
      {
        shapes: repeat(3, (i) => rr(2.5, 4 + i * 5.7, 19, 4.6, 0.9)),
        holes: [
          ...repeat(3, (i) => ci(5.4, 6.3 + i * 5.7, 0.72)),
          ...repeat(3, (i) => rr(8.4, 5.7 + i * 5.7, 10, 1.2, 0.55)),
        ],
      },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    group: 'Infrastructure',
    parts: [
      {
        shapes: [rr(4, 4.6, 16, 14.4, 1.6), rr(9.6, 2.2, 4.8, 2.8, 0.5)],
        holes: [
          ...repeat(6, (i) => rr(6.3 + i * 2.2, 7, 1.1, 3.4, 0.3)),
          rr(8.4, 13.4, 7.2, 3.2, 0.5),
        ],
      },
    ],
  },
  {
    id: 'globe',
    label: 'Web',
    group: 'Infrastructure',
    parts: [
      { shapes: [ci(12, 12, 10)], holes: [ci(12, 12, 8.3)] },
      { shapes: [el(12, 12, 4.5, 8.3)], holes: [el(12, 12, 2.9, 8.3)] },
      { shapes: [rr(3.7, 11.15, 16.6, 1.7, 0.85)] },
    ],
  },
  {
    id: 'none',
    label: 'No icon',
    group: 'Other',
    parts: [],
  },
]

export const ICON_BY_ID: ReadonlyMap<string, Icon> = new Map(ICONS.map((i) => [i.id, i]))

/** Falls back to the camera rather than throwing — a stale saved batch should still render. */
export function iconById(id: string): Icon {
  return ICON_BY_ID.get(id) ?? ICON_BY_ID.get('camera')!
}

export type Bounds = { x: number; y: number; w: number; h: number }

function shapeBounds(s: Shape): Bounds {
  switch (s.t) {
    case 'rrect':
      return { x: s.x, y: s.y, w: s.w, h: s.h }
    case 'circle':
      return { x: s.cx - s.r, y: s.cy - s.r, w: s.r * 2, h: s.r * 2 }
    case 'ellipse':
      return { x: s.cx - s.rx, y: s.cy - s.ry, w: s.rx * 2, h: s.ry * 2 }
    case 'poly': {
      const xs = s.pts.map((p) => p[0])
      const ys = s.pts.map((p) => p[1])
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
  }
}

/**
 * The union of an icon's filled shapes, in 24×24 units.
 *
 * Holes are deliberately excluded: they are always inside a filled shape, and a
 * hole that pokes outside one (the microphone's cradle uses a big rectangle to
 * square off the top half of a ring) would otherwise inflate the box and shrink
 * the icon for no visible reason.
 *
 * Icons do not fill the 24×24 box evenly — the phone is tall and narrow, the
 * server short and wide — so drawing them scaled to a fixed box would make some
 * look far bigger than others. Measuring the real ink is what keeps them
 * optically consistent on the card.
 */
export function iconBounds(icon: Icon): Bounds | null {
  const boxes = icon.parts.flatMap((p) => p.shapes.map(shapeBounds))
  if (boxes.length === 0) return null
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.x + b.w))
  const bt = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: r - x, h: bt - y }
}
