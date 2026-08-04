/**
 * The live preview.
 *
 * Renders the selected card at its FULL raster and scales the canvas down with
 * CSS. Rendering at a convenient screen size instead would be faster and would
 * be a lie: the layout scale is derived from the raster height, so a card
 * previewed at 480px and exported at 2160 would not be the same card. What is
 * on screen here is what lands in the ZIP, pixel for pixel.
 *
 * The cost of that is a 4K preview is an 8-megapixel canvas, so redraws are
 * debounced rather than run on every keystroke.
 */

import { useEffect, useRef, useState } from 'react'

import { canvasLimitProblem } from '../lib/encode'
import { resolveCard } from '../lib/resolve'
import { renderCardTo } from '../render/render'
import { useStore } from '../state/store'
import { APP_VERSION } from '../version'

const DEBOUNCE_MS = 140

export function Preview() {
  const ref = useRef<HTMLCanvasElement>(null)
  const batch = useStore((s) => s.batch)
  const selectedId = useStore((s) => s.selectedId)
  const [problem, setProblem] = useState<string | null>(null)

  const index = Math.max(
    0,
    batch.cards.findIndex((c) => c.id === selectedId),
  )
  const card = batch.cards.find((c) => c.id === selectedId) ?? batch.cards[0] ?? null

  useEffect(() => {
    if (!card) return
    const timer = setTimeout(() => {
      const canvas = ref.current
      if (!canvas) return
      const rc = resolveCard(card, batch, index)
      const limit = canvasLimitProblem(rc.raster.w, rc.raster.h)
      setProblem(limit)
      if (limit) return
      canvas.width = rc.raster.w
      canvas.height = rc.raster.h
      try {
        renderCardTo(canvas, rc, batch, APP_VERSION)
      } catch (err) {
        setProblem((err as Error).message)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [card, batch, index])

  if (!card) {
    return (
      <div className="preview empty">
        <p>Add a source to see a preview.</p>
      </div>
    )
  }

  const rc = resolveCard(card, batch, index)

  return (
    <div className="preview">
      <div className="preview-stage">
        {problem ? (
          <p className="problem">{problem}</p>
        ) : (
          <canvas ref={ref} aria-label={`Preview of ${card.name || 'untitled source'}`} />
        )}
      </div>
      <p className="preview-meta">
        <strong>{card.name || 'Untitled'}</strong>
        <span>
          {rc.raster.w} × {rc.raster.h}
        </span>
        <span className="swatch" style={{ background: rc.colour }} aria-hidden="true" />
        <span>{rc.colour}</span>
      </p>
    </div>
  )
}
