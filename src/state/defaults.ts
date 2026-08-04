import type { Batch, Card, Style } from '../types'

export const DEFAULT_STYLE: Style = {
  showDimensions: true,
  showFooter: true,
  // `{version}` is substituted at render time. The default names the tool that
  // made the card, which is what the reference cards do and what makes a
  // thumbnail traceable a year later when nobody remembers where it came from.
  footerText: 'Thumbnail Generator {version}',
  gradient: true,
  textTone: 'light',
  showIcon: true,
}

export const DEFAULT_COLOUR = '#1f6fd0'

let seq = 0
/**
 * Ids only need to be unique within a session — they key React lists and
 * nothing persists them as a reference. `crypto.randomUUID` is not available
 * over plain http on some LAN addresses, which is exactly where this tool gets
 * used from a laptop on a show network, so a counter it is.
 */
export function newId(): string {
  seq += 1
  return `c${Date.now().toString(36)}${seq.toString(36)}`
}

export function newCard(name = '', iconId = 'camera'): Card {
  return { id: newId(), name, iconId, colour: null, size: null }
}

export const INITIAL_BATCH: Batch = {
  cards: [newCard('PC 1', 'laptop'), newCard('PC 2', 'laptop'), newCard('Camera 1', 'camera')],
  defaultSize: { kind: 'preset', id: 'hd1080' },
  defaultColour: DEFAULT_COLOUR,
  autoPalette: true,
  style: DEFAULT_STYLE,
  format: 'png',
}
