/**
 * The store. Zustand, persisted to localStorage so a batch survives the tab
 * being closed — these lists get built up over an afternoon while the rest of
 * the patch is being worked out.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Batch, Card, FormatId, SizeMode, Style } from '../types'
import { INITIAL_BATCH, newCard } from './defaults'

export type ExportOpts = {
  strictNames: boolean
  quality: number
  includeManifest: boolean
}

type State = {
  batch: Batch
  exportOpts: ExportOpts
  /** Which card the preview is showing. Falls back to the first. */
  selectedId: string | null

  addCard: () => void
  /** Paste-a-list: one source per line. The reason this tool exists. */
  addMany: (text: string, iconId: string) => number
  updateCard: (id: string, patch: Partial<Card>) => void
  removeCard: (id: string) => void
  moveCard: (id: string, delta: number) => void
  duplicateCard: (id: string) => void
  clearCards: () => void

  setDefaultSize: (size: SizeMode) => void
  setDefaultColour: (colour: string) => void
  setAutoPalette: (on: boolean) => void
  setStyle: (patch: Partial<Style>) => void
  setFormat: (format: FormatId) => void
  setExportOpts: (patch: Partial<ExportOpts>) => void
  select: (id: string | null) => void
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      batch: INITIAL_BATCH,
      exportOpts: { strictNames: false, quality: 0.92, includeManifest: true },
      selectedId: null,

      addCard: () =>
        set((s) => {
          const card = newCard()
          return { batch: { ...s.batch, cards: [...s.batch.cards, card] }, selectedId: card.id }
        }),

      addMany: (text, iconId) => {
        // Split on newlines AND commas: people paste both a column out of a
        // spreadsheet and a comma-separated line out of an email.
        const names = text
          .split(/[\n,]/)
          .map((t) => t.trim())
          .filter(Boolean)
        if (names.length === 0) return 0
        set((s) => ({
          batch: { ...s.batch, cards: [...s.batch.cards, ...names.map((n) => newCard(n, iconId))] },
        }))
        return names.length
      },

      updateCard: (id, patch) =>
        set((s) => ({
          batch: {
            ...s.batch,
            cards: s.batch.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        })),

      removeCard: (id) =>
        set((s) => ({
          batch: { ...s.batch, cards: s.batch.cards.filter((c) => c.id !== id) },
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),

      moveCard: (id, delta) =>
        set((s) => {
          const cards = [...s.batch.cards]
          const i = cards.findIndex((c) => c.id === id)
          const j = i + delta
          if (i < 0 || j < 0 || j >= cards.length) return s
          ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
          return { batch: { ...s.batch, cards } }
        }),

      duplicateCard: (id) =>
        set((s) => {
          const i = s.batch.cards.findIndex((c) => c.id === id)
          if (i < 0) return s
          const copy = { ...s.batch.cards[i]!, id: newCard().id }
          const cards = [...s.batch.cards]
          cards.splice(i + 1, 0, copy)
          return { batch: { ...s.batch, cards }, selectedId: copy.id }
        }),

      clearCards: () => set((s) => ({ batch: { ...s.batch, cards: [] }, selectedId: null })),

      setDefaultSize: (defaultSize) => set((s) => ({ batch: { ...s.batch, defaultSize } })),
      setDefaultColour: (defaultColour) => set((s) => ({ batch: { ...s.batch, defaultColour } })),
      setAutoPalette: (autoPalette) => set((s) => ({ batch: { ...s.batch, autoPalette } })),
      setStyle: (patch) => set((s) => ({ batch: { ...s.batch, style: { ...s.batch.style, ...patch } } })),
      setFormat: (format) => set((s) => ({ batch: { ...s.batch, format } })),
      setExportOpts: (patch) => set((s) => ({ exportOpts: { ...s.exportOpts, ...patch } })),
      select: (selectedId) => set({ selectedId }),
    }),
    {
      name: 'thumbnail-generator.v1',
      // Only the batch and the export options. `selectedId` is view state and
      // restoring it points the preview at a card that may not exist.
      partialize: (s) => ({ batch: s.batch, exportOpts: s.exportOpts }),
      // A shape change here needs a migration rather than a bumped name, or
      // everyone silently loses the batch they were part way through.
      version: 1,
    },
  ),
)

/** The card the preview should show — the selection, or the first card. */
export function selectedCard(s: { batch: Batch; selectedId: string | null }): Card | null {
  return s.batch.cards.find((c) => c.id === s.selectedId) ?? s.batch.cards[0] ?? null
}
