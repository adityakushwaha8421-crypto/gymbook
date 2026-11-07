/**
 * gzip for the Google Drive backup, using the browser's own CompressionStream.
 *
 * Records are mostly repeated field names, so the backup shrinks to about a tenth before photos;
 * photos are already compressed and barely shrink. Browsers without CompressionStream (older than
 * about 2023) upload the backup as plain JSON, and both kinds can always be read back.
 */

export function canGzip(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined' && typeof ReadableStream !== 'undefined'
}

/** gzip data always starts with these two bytes; JSON never does. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

async function through(bytes: Uint8Array, transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      // Hand the data over in slices so a large backup is not held twice inside the stream.
      const step = 1 << 20
      for (let i = 0; i < bytes.length; i += step) controller.enqueue(bytes.subarray(i, i + step))
      controller.close()
    },
  })
  const reader = source.pipeThrough(transform).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

export function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return through(bytes, new CompressionStream('gzip') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> })
}

/** Rejects when the data is not valid gzip (a damaged or cut-off file). */
export function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return through(bytes, new DecompressionStream('gzip') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> })
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
