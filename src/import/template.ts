/**
 * The starter file.
 *
 * A blank "here are the four column names" file is not much help — what people
 * actually need is to see one filled-in row per thing the columns accept, so
 * the format is legible without reading any documentation. So the template is
 * a working example: import it unchanged and you get eight real cards.
 *
 * The same rows are the fixture the round-trip test uses, which means the
 * template cannot drift away from what the parser accepts without a test going
 * red.
 */

import { ICONS } from '../render/icons'
import { toCsv } from './csv'

export const TEMPLATE_HEADERS = ['name', 'icon', 'colour', 'size'] as const

/**
 * Each row demonstrates a different accepted spelling, on purpose:
 * an icon id, an icon label, a synonym; a hex with and without the hash, and a
 * colour name; an exact raster, a preset, a bare ratio, and a ratio with a long
 * edge. Blank cells mean "inherit the batch default", which is also shown.
 */
export const TEMPLATE_ROWS: string[][] = [
  ['PC 1', 'laptop', '#1f6fd0', '1920x1080'],
  ['PC 2', 'Laptop', '1f6fd0', '1080p'],
  ['Camera 1', 'camera', 'red', ''],
  ['Camera 2', 'cam', '', '16:9'],
  ['Vision 4', 'video camera', 'teal', '16:9@2560'],
  ['VT 1', 'vt', '#7d3c98', '2056x1329'],
  ['Slido', 'monitor', 'amber', '4K'],
  ['Lectern, stage left', 'usb stick', 'green', ''],
]

export function templateCsv(): string {
  return toCsv([[...TEMPLATE_HEADERS], ...TEMPLATE_ROWS])
}

/** Every icon name the importer will accept, for the help text and the docs. */
export function iconNamesForHelp(): string[] {
  return ICONS.map((i) => i.id)
}

/** Trigger a download of the template. */
export function downloadTemplate(filename = 'thumbnail-generator-template.csv'): void {
  // BOM: without it Excel opens a UTF-8 CSV as the local 8-bit codepage and
  // "Régie" becomes "RÃ©gie" in the very file we are telling people to edit.
  const blob = new Blob(['﻿' + templateCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Step-by-step for the Sheets side. Kept here rather than in the component so
 * the wording is in one place and can be asserted on.
 */
export const SHEETS_STEPS: string[] = [
  'Download the template and open it in Google Sheets (File ▸ Import ▸ Upload), or make a sheet with the same four column headings.',
  'Fill in a row per source. Leave a cell blank to use the batch default.',
  'File ▸ Share ▸ Publish to web. Choose the tab, and pick Comma-separated values (.csv).',
  'Copy the published link and paste it above. A normal /edit link will not work — Google blocks other sites from reading it.',
]
