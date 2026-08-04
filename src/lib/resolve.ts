/**
 * Filling in what a card inherits from its batch.
 *
 * Cards carry `null` for size and colour when they have not been overridden,
 * which is what makes a forty-source batch bearable to fill in. Nothing
 * downstream should ever see a null: this is the single place that resolves
 * them, so a painter cannot accidentally invent its own default and disagree
 * with the preview about what colour a card is.
 */

import { paletteColour } from './colour'
import { resolveRaster } from '../render/layout'
import type { Batch, Card, Raster } from '../types'

export type ResolvedCard = {
  card: Card
  raster: Raster
  colour: string
  /** True when the colour came from the auto palette rather than a choice. */
  colourIsAuto: boolean
}

/**
 * The index matters: with `autoPalette` on, an un-coloured card takes its hue
 * from its position, so the same card at a different row is a different colour.
 * That is intentional — it is what stops a freshly pasted list of twenty
 * sources from being twenty identical cards — but it does mean reordering the
 * list recolours it, which the UI has to not be surprising about.
 */
export function resolveCard(card: Card, batch: Batch, index: number): ResolvedCard {
  const colourIsAuto = card.colour === null && batch.autoPalette
  return {
    card,
    raster: resolveRaster(card.size ?? batch.defaultSize),
    colour: card.colour ?? (batch.autoPalette ? paletteColour(index) : batch.defaultColour),
    colourIsAuto,
  }
}

export function resolveAll(batch: Batch): ResolvedCard[] {
  return batch.cards.map((c, i) => resolveCard(c, batch, i))
}
