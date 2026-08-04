import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildZip, crc32 } from './zip'

const bytes = (s: string) => new TextEncoder().encode(s)

function writeZip(entries: { name: string; data: Uint8Array }[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-zip-'))
  const path = join(dir, 'out.zip')
  writeFileSync(path, buildZip(entries))
  return path
}

describe('crc32', () => {
  it('matches the published check value', () => {
    // "123456789" -> 0xCBF43926, the standard CRC-32/ISO-HDLC vector.
    expect(crc32(bytes('123456789')) >>> 0).toBe(0xcbf43926)
  })

  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('buildZip', () => {
  it('writes the three PKWARE signatures', () => {
    const zip = buildZip([{ name: 'a.txt', data: bytes('hello') }])
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    expect(dv.getUint32(0, true)).toBe(0x04034b50) // local header
    expect(zip.length).toBeGreaterThan(22)
    // End-of-central-directory is the last 22 bytes when there is no comment.
    const eocd = zip.length - 22
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50)
    expect(dv.getUint16(eocd + 8, true)).toBe(1) // entries on this disk
  })

  it('refuses to emit a corrupt archive rather than overflowing', () => {
    const many = Array.from({ length: 65536 }, (_, i) => ({
      name: `${i}.txt`,
      data: new Uint8Array(0),
    }))
    expect(() => buildZip(many)).toThrow(/65535|ZIP64/i)
  })

  it('round-trips through the system unzip', () => {
    const path = writeZip([
      { name: 'PC 1.png', data: bytes('one') },
      { name: 'PC 2.png', data: bytes('two') },
      { name: 'manifest.csv', data: bytes('file,name\n') },
    ])
    // -t is a structural check; it exits non-zero on a malformed archive.
    execFileSync('unzip', ['-t', path], { stdio: 'pipe' })

    const dir = mkdtempSync(join(tmpdir(), 'tg-out-'))
    execFileSync('unzip', ['-q', '-o', path, '-d', dir], { stdio: 'pipe' })
    expect(readFileSync(join(dir, 'PC 1.png'), 'utf8')).toBe('one')
    expect(readFileSync(join(dir, 'manifest.csv'), 'utf8')).toBe('file,name\n')
  })

  it('stores UTF-8 filenames that Python reads back intact', () => {
    // NOT checked with the system `unzip`: macOS ships Info-ZIP 6.00 from 2009,
    // which ignores the UTF-8 flag and then refuses to extract non-ASCII names
    // at all with "Illegal byte sequence". That is the binary, not the archive.
    const path = writeZip([{ name: 'Régie café.png', data: bytes('x') }])
    const out = execFileSync(
      'python3',
      ['-c', 'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', path],
      { encoding: 'utf8' },
    )
    expect(out.trim()).toBe('Régie café.png')
  })
})
