import { describe, expect, it } from 'vitest'

import { ICON_BOX, ICONS, iconBounds, iconById } from './icons'

describe('the icon set', () => {
  it('has unique ids', () => {
    const ids = ICONS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a label and a group for every icon', () => {
    for (const i of ICONS) {
      expect(i.label, i.id).toBeTruthy()
      expect(i.group, i.id).toBeTruthy()
    }
  })

  it('draws every icon inside the 24x24 box', () => {
    // Anything outside gets scaled down to fit, so one stray coordinate would
    // silently shrink that icon relative to all the others on a card.
    for (const icon of ICONS) {
      const b = iconBounds(icon)
      if (!b) continue
      expect(b.x, icon.id).toBeGreaterThanOrEqual(0)
      expect(b.y, icon.id).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w, icon.id).toBeLessThanOrEqual(ICON_BOX)
      expect(b.y + b.h, icon.id).toBeLessThanOrEqual(ICON_BOX)
    }
  })

  it('gives every drawable icon real extent', () => {
    for (const icon of ICONS) {
      const b = iconBounds(icon)
      if (icon.id === 'none') {
        expect(b).toBeNull()
        continue
      }
      expect(b, icon.id).not.toBeNull()
      expect(b!.w, icon.id).toBeGreaterThan(4)
      expect(b!.h, icon.id).toBeGreaterThan(4)
    }
  })

  it('fills a decent share of the box, so icons look consistent next to each other', () => {
    for (const icon of ICONS) {
      const b = iconBounds(icon)
      if (!b) continue
      // Icons are fitted by their ink, so this is about none of them being a
      // tiny mark floating in the middle of the box.
      expect(Math.max(b.w, b.h), icon.id).toBeGreaterThan(ICON_BOX * 0.6)
    }
  })
})

describe('iconBounds', () => {
  it('ignores holes that reach outside the filled shapes', () => {
    // The microphone squares off the top of its cradle with a rectangle that
    // pokes out past the ring. Counting it would inflate the box and shrink
    // the icon on the card for no visible reason.
    const mic = iconById('mic')
    const b = iconBounds(mic)!
    expect(b.y).toBeGreaterThan(0)
    expect(b.x + b.w).toBeLessThanOrEqual(ICON_BOX)
  })

  it('covers all of a multi-part icon, not just the first part', () => {
    // The monitor's stand is a separate part below the screen.
    const monitor = iconById('monitor')
    const b = iconBounds(monitor)!
    expect(b.y + b.h).toBeGreaterThan(20)
  })
})

describe('iconById', () => {
  it('resolves known ids', () => {
    expect(iconById('camera').id).toBe('camera')
    expect(iconById('usb').id).toBe('usb')
  })

  it('falls back rather than throwing, so a stale saved batch still renders', () => {
    expect(iconById('no-such-icon').id).toBe('camera')
  })
})
