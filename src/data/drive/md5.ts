/**
 * MD5 of a byte array, as lowercase hex.
 *
 * Google Drive reports an `md5Checksum` for every stored file and the browser's Web Crypto has no MD5,
 * so this is here for one purpose: comparing what Drive says it stored with what was sent.
 * It is an integrity check against a damaged upload, not a security measure.
 */
export function md5Hex(bytes: Uint8Array): string {
  const n = bytes.length
  // Message, 0x80, zero padding, then the bit length as a 64-bit little-endian integer.
  const padded = new Uint8Array((((n + 8) >>> 6) + 1) << 6)
  padded.set(bytes)
  padded[n] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, (n << 3) >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(n / 0x20000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const m = new Uint32Array(16)

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(off + i * 4, true)
    let a = a0
    let b = b0
    let c = c0
    let d = d0
    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) & 15
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) & 15
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) & 15
      }
      const x = (a + f + K[i] + m[g]) | 0
      a = d
      d = c
      c = b
      b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) | 0
    }
    a0 = (a0 + a) | 0
    b0 = (b0 + b) | 0
    c0 = (c0 + c) | 0
    d0 = (d0 + d) | 0
  }

  const out = new DataView(new ArrayBuffer(16))
  out.setUint32(0, a0, true)
  out.setUint32(4, b0, true)
  out.setUint32(8, c0, true)
  out.setUint32(12, d0, true)
  let hex = ''
  for (let i = 0; i < 16; i++) hex += out.getUint8(i).toString(16).padStart(2, '0')
  return hex
}

const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21]
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0)

/** SHA-256 of a string, as lowercase hex. Used to tell whether the data changed since the last backup. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
