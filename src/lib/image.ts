/** Downscale an image file to a small JPEG data URL for storage (max 256px). */
export async function fileToSmallDataUrl(file: File, max = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPEG, PNG or WebP).')
  if (file.size > 10 * 1024 * 1024) throw new Error('Image is larger than 10 MB. Choose a smaller file.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read this image.')
  })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process this image.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
