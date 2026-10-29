// A zip archive of files stored without compression (method 0), which every unzip tool and operating system reads, so
// that a download can hold several files without a library. Names are UTF-8 (general purpose flag bit 11), and every
// file has the time given. Imports nothing, so the unit tests can load it.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** The CRC-32 of bytes, as zip and gzip compute it */
export function crc32 (bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// MS-DOS time and date, in local time, as zip keeps them; the date from 1980
const dosTime = (d) => (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
const dosDate = (d) => (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()

const UTF8_NAMES = 0x0800
const VERSION = 20

/** The bytes of a zip archive of files [{ name, data }], data a string (written as UTF-8) or bytes */
export function zipStored (files, date = new Date()) {
  const encoder = new TextEncoder()
  const time = dosTime(date)
  const day = dosDate(date)
  const parts = []
  const central = []
  let offset = 0

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name)
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    const crc = crc32(bytes)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, VERSION, true)
    local.setUint16(6, UTF8_NAMES, true)
    local.setUint16(8, 0, true)
    local.setUint16(10, time, true)
    local.setUint16(12, day, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, bytes.length, true)
    local.setUint32(22, bytes.length, true)
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, bytes)

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, VERSION, true)
    entry.setUint16(6, VERSION, true)
    entry.setUint16(8, UTF8_NAMES, true)
    entry.setUint16(10, 0, true)
    entry.setUint16(12, time, true)
    entry.setUint16(14, day, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, bytes.length, true)
    entry.setUint32(24, bytes.length, true)
    entry.setUint16(28, nameBytes.length, true)
    // extra field, comment, disk, internal and external attributes: none
    entry.setUint32(42, offset, true)
    central.push(new Uint8Array(entry.buffer), nameBytes)

    offset += 30 + nameBytes.length + bytes.length
  }

  const centralSize = central.reduce((size, part) => size + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((size, part) => size + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}
