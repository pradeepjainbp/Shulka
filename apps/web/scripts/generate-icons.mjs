import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.join(__dirname, '../public/icons')
mkdirSync(iconsDir, { recursive: true })

// CRC32 table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crc = crc32(Buffer.concat([typeBytes, data]))
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc)])
}

// Build a minimal valid 1x1 RGB PNG
function make1x1Png(r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width=1, height=1, bitDepth=8, colorType=2 (RGB)
  const ihdrData = Buffer.from([
    0,
    0,
    0,
    1, // width
    0,
    0,
    0,
    1, // height
    8, // bit depth
    2, // color type: RGB
    0,
    0,
    0, // compression, filter, interlace
  ])

  // IDAT: filter byte (0) + R + G + B, then zlib-deflate
  const raw = Buffer.from([0, r, g, b])
  const compressed = deflateSync(raw)

  const iend = Buffer.alloc(0)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ])
}

// Shulka primary green: #0F5C3F = rgb(15, 92, 63)
const png = make1x1Png(15, 92, 63)

writeFileSync(path.join(iconsDir, 'icon-192.png'), png)
writeFileSync(path.join(iconsDir, 'icon-512.png'), png)
console.info(
  'Icons generated (placeholder 1x1 PNG #0F5C3F) — replace with real icons before launch.',
)
