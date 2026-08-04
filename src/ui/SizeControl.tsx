/**
 * Editing a `SizeMode`. Used for the batch default and, with `allowInherit`,
 * for a per-card override.
 *
 * The three modes are kept as separate committed state rather than one shared
 * width/height pair, so switching from "aspect" to "exact" and back does not
 * lose what you typed.
 */

import { useState } from 'react'

import { PRESETS, resolveRaster } from '../render/layout'
import type { PresetId, SizeMode } from '../types'

type Props = {
  value: SizeMode | null
  onChange: (v: SizeMode | null) => void
  allowInherit?: boolean
  id: string
}

const COMMON_RATIOS: { label: string; w: number; h: number }[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '16:10', w: 16, h: 10 },
  { label: '4:3', w: 4, h: 3 },
  { label: '1:1', w: 1, h: 1 },
  { label: '21:9', w: 21, h: 9 },
  { label: '9:16', w: 9, h: 16 },
]

export function SizeControl({ value, onChange, allowInherit, id }: Props) {
  const [exact, setExact] = useState({ w: 1920, h: 1080 })
  const [aspect, setAspect] = useState({ wRatio: 16, hRatio: 9, longEdge: 1920 })

  const kind = value === null ? 'inherit' : value.kind

  function pick(next: string) {
    if (next === 'inherit') return onChange(null)
    if (next === 'preset') return onChange({ kind: 'preset', id: 'hd1080' })
    if (next === 'exact') return onChange({ kind: 'exact', ...exact })
    return onChange({ kind: 'aspect', ...aspect })
  }

  const resolved = value ? resolveRaster(value) : null

  return (
    <div className="size-control">
      <select
        aria-label="Size mode"
        value={kind}
        onChange={(e) => pick(e.target.value)}
        id={`${id}-mode`}
      >
        {allowInherit && <option value="inherit">Use batch default</option>}
        <option value="preset">Preset</option>
        <option value="exact">Exact pixels</option>
        <option value="aspect">Aspect ratio</option>
      </select>

      {value?.kind === 'preset' && (
        <select
          aria-label="Preset"
          value={value.id}
          onChange={(e) => onChange({ kind: 'preset', id: e.target.value as PresetId })}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}

      {value?.kind === 'exact' && (
        <span className="pair">
          <input
            type="number"
            min={1}
            max={16384}
            aria-label="Width in pixels"
            value={value.w}
            onChange={(e) => {
              const w = Number(e.target.value) || 1
              setExact((s) => ({ ...s, w }))
              onChange({ kind: 'exact', w, h: value.h })
            }}
          />
          <span aria-hidden="true">×</span>
          <input
            type="number"
            min={1}
            max={16384}
            aria-label="Height in pixels"
            value={value.h}
            onChange={(e) => {
              const h = Number(e.target.value) || 1
              setExact((s) => ({ ...s, h }))
              onChange({ kind: 'exact', w: value.w, h })
            }}
          />
        </span>
      )}

      {value?.kind === 'aspect' && (
        <span className="pair">
          <select
            aria-label="Ratio"
            value={`${value.wRatio}:${value.hRatio}`}
            onChange={(e) => {
              const found = COMMON_RATIOS.find((r) => `${r.w}:${r.h}` === e.target.value)
              if (!found) return
              setAspect((s) => ({ ...s, wRatio: found.w, hRatio: found.h }))
              onChange({ ...value, wRatio: found.w, hRatio: found.h })
            }}
          >
            {COMMON_RATIOS.map((r) => (
              <option key={r.label} value={`${r.w}:${r.h}`}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={16}
            max={16384}
            aria-label="Long edge in pixels"
            value={value.longEdge}
            onChange={(e) => {
              const longEdge = Number(e.target.value) || 16
              setAspect((s) => ({ ...s, longEdge }))
              onChange({ ...value, longEdge })
            }}
          />
          <span className="unit">px long edge</span>
        </span>
      )}

      {resolved && value?.kind !== 'exact' && (
        <span className="resolved">
          → {resolved.w} × {resolved.h}
        </span>
      )}
    </div>
  )
}
