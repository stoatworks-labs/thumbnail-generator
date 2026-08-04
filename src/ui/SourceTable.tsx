/**
 * The list of sources. One row per card: name, icon, colour, size.
 *
 * Colour and size are nullable per row and show "inherit" until they are
 * touched, which is what keeps a long batch quick to fill in — the common case
 * is forty sources that differ only in name and icon.
 */

import { useState } from 'react'

import { paletteColour } from '../lib/colour'
import { safeStem, uniqueNames } from '../lib/filename'
import { encoderFor } from '../lib/encode'
import { useStore } from '../state/store'
import { IconPicker } from './IconPicker'
import { SizeControl } from './SizeControl'

export function SourceTable() {
  const batch = useStore((s) => s.batch)
  const selectedId = useStore((s) => s.selectedId)
  const strictNames = useStore((s) => s.exportOpts.strictNames)
  const { addCard, addMany, updateCard, removeCard, moveCard, duplicateCard, clearCards, select } =
    useStore()

  const [bulk, setBulk] = useState('')
  const [bulkIcon, setBulkIcon] = useState('camera')
  const [showBulk, setShowBulk] = useState(false)

  const ext = encoderFor(batch.format).ext
  // Computed over the whole batch so a row can show the name it will ACTUALLY
  // get, suffix and all, rather than the name it would get on its own.
  const finalNames = uniqueNames(batch.cards.map((c) => `${safeStem(c.name, strictNames)}${ext}`))

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Sources</h2>
        <div className="head-actions">
          <button type="button" onClick={() => setShowBulk((v) => !v)}>
            {showBulk ? 'Hide paste' : 'Paste a list'}
          </button>
          <button type="button" onClick={addCard}>
            Add source
          </button>
          <button
            type="button"
            className="danger"
            disabled={batch.cards.length === 0}
            onClick={() => {
              if (confirm(`Remove all ${batch.cards.length} sources?`)) clearCards()
            }}
          >
            Clear
          </button>
        </div>
      </header>

      {showBulk && (
        <div className="bulk">
          <label htmlFor="bulk-text">One source per line (or comma separated)</label>
          <textarea
            id="bulk-text"
            rows={5}
            value={bulk}
            placeholder={'PC 1\nPC 2\nCamera 1\nVision 4'}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="bulk-actions">
            <IconPicker value={bulkIcon} onChange={setBulkIcon} label="Icon for pasted sources" />
            <button
              type="button"
              className="primary"
              disabled={!bulk.trim()}
              onClick={() => {
                const n = addMany(bulk, bulkIcon)
                if (n > 0) {
                  setBulk('')
                  setShowBulk(false)
                }
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {batch.cards.length === 0 ? (
        <p className="empty-note">
          No sources yet. Add one, or paste a list straight out of your patch sheet.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="sources">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Icon</th>
                <th scope="col">Colour</th>
                <th scope="col">Size</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batch.cards.map((card, i) => {
                const isSelected = card.id === (selectedId ?? batch.cards[0]?.id)
                const autoColour = batch.autoPalette ? paletteColour(i) : batch.defaultColour
                return (
                  <tr
                    key={card.id}
                    className={isSelected ? 'selected' : undefined}
                    onFocusCapture={() => select(card.id)}
                  >
                    <td data-label="Name">
                      <input
                        type="text"
                        aria-label={`Source ${i + 1} name`}
                        value={card.name}
                        placeholder="Source name"
                        onChange={(e) => updateCard(card.id, { name: e.target.value })}
                      />
                      <span className="filename" title="Filename in the ZIP">
                        {finalNames[i]}
                      </span>
                    </td>

                    <td data-label="Icon">
                      <IconPicker
                        value={card.iconId}
                        onChange={(iconId) => updateCard(card.id, { iconId })}
                        label={`Source ${i + 1} icon`}
                      />
                    </td>

                    <td data-label="Colour">
                      <span className="colour-cell">
                        <input
                          type="color"
                          aria-label={`Source ${i + 1} colour`}
                          value={card.colour ?? autoColour}
                          onChange={(e) => updateCard(card.id, { colour: e.target.value })}
                        />
                        {card.colour === null ? (
                          <span className="inherit">auto</span>
                        ) : (
                          <button
                            type="button"
                            className="link"
                            onClick={() => updateCard(card.id, { colour: null })}
                          >
                            reset
                          </button>
                        )}
                      </span>
                    </td>

                    <td data-label="Size">
                      <SizeControl
                        id={`size-${card.id}`}
                        value={card.size}
                        allowInherit
                        onChange={(size) => updateCard(card.id, { size })}
                      />
                    </td>

                    <td data-label="Actions">
                      <span className="row-actions">
                        <button
                          type="button"
                          title="Move up"
                          aria-label={`Move ${card.name || `source ${i + 1}`} up`}
                          disabled={i === 0}
                          onClick={() => moveCard(card.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          aria-label={`Move ${card.name || `source ${i + 1}`} down`}
                          disabled={i === batch.cards.length - 1}
                          onClick={() => moveCard(card.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="Duplicate"
                          aria-label={`Duplicate ${card.name || `source ${i + 1}`}`}
                          onClick={() => duplicateCard(card.id)}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="danger"
                          title="Remove"
                          aria-label={`Remove ${card.name || `source ${i + 1}`}`}
                          onClick={() => removeCard(card.id)}
                        >
                          ✕
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
