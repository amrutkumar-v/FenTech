/** Compress an uploaded image before storing/syncing (photos are sensitive + backed up per COL-006). */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<{ blob: Blob; fileName: string }> {
  const maxDim = opts.maxDim ?? 1280
  const quality = opts.quality ?? 0.82

  if (!file.type.startsWith('image/')) {
    return { blob: file, fileName: file.name }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: file, fileName: file.name }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return { blob: file, fileName: file.name }
    const base = file.name.replace(/\.[^.]+$/, '')
    return { blob, fileName: `${base}.jpg` }
  } catch {
    return { blob: file, fileName: file.name }
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
