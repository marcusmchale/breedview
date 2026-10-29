// The files of a zip archive as BreedView writes them, stored (src/composables/system/zip.js): read and each checked
// against its CRC-32, for the tests of downloads. Text files only, decoded as UTF-8.
import assert from 'node:assert/strict'
import { crc32 } from 'node:zlib'

export function unzip (bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  assert.equal(view.getUint32(end, true), 0x06054b50, 'the end of central directory record ends the archive')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const files = {}
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50)
    assert.equal(view.getUint16(at + 8, true) & 0x0800, 0x0800, 'names are UTF-8')
    assert.equal(view.getUint16(at + 10, true), 0, 'stored')
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    const local = view.getUint32(at + 42, true)
    assert.equal(view.getUint32(local, true), 0x04034b50)
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = bytes.subarray(start, start + size)
    assert.equal(crc32(data), crc, `${name}'s CRC-32`)
    files[name] = decoder.decode(data)
    at += 46 + nameLength
  }
  return files
}
