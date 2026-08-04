/**
 * Choosing an icon, and drawing one at UI size.
 *
 * `IconGlyph` paints through the same `drawIcon` the cards use. That is
 * deliberate: an icon that renders wrong on a card renders wrong in the picker
 * too, which is far easier to notice than exporting forty of them first.
 */

import { useEffect, useRef } from 'react'

import { drawIcon } from '../render/draw'
import { ICONS, type Icon, iconById } from '../render/icons'

export function IconGlyph({
  iconId,
  size = 26,
  colour = '#e8ecf3',
}: {
  iconId: string
  size?: number
  colour?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // Draw at device resolution and scale down with CSS, or the icon is soft on
    // a Retina display.
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const pad = 1 * dpr
    drawIcon(
      ctx,
      iconById(iconId),
      { x: pad, y: pad, w: canvas.width - pad * 2, h: canvas.height - pad * 2 },
      colour,
    )
  }, [iconId, size, colour])

  return (
    <canvas
      ref={ref}
      className="icon-glyph"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

const GROUPS = ['Vision', 'Computer', 'Playback', 'Infrastructure', 'Other'] as const

function byGroup(g: Icon['group']): Icon[] {
  return ICONS.filter((i) => i.group === g)
}

export function IconPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <span className="icon-picker">
      <IconGlyph iconId={value} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {byGroup(g).map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </span>
  )
}
