import type { PetAnchors } from '@/types'

/** 宠物默认锚点（未标定兜底，复刻原 renderer.DEFAULT_ANCHORS 行为） */
export const PET_DEFAULT_ANCHORS: PetAnchors = {
  bodyBox: { x: 0.18, y: 0.3, width: 0.64, height: 0.58 },
  headBox: { x: 0.24, y: 0.08, width: 0.52, height: 0.42 },
  leftEye: { x: 0.38, y: 0.32 },
  rightEye: { x: 0.62, y: 0.32 },
  mouth: { x: 0.5, y: 0.42 },
  nose: { x: 0.5, y: 0.375 },
  tailRoot: { x: 0.8, y: 0.66 },
}

/** 宠物头身比估算：头部取主体上部较大比例，含尾根挂点 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export async function estimatePetAnchors(dataUrl: string): Promise<PetAnchors> {
  const img = await loadImage(dataUrl)
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return PET_DEFAULT_ANCHORS

  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const a = data[(y * w + x) * 4 + 3] ?? 0
      if (a > 12) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!found) return PET_DEFAULT_ANCHORS

  const bw = (maxX - minX) / w
  const bh = (maxY - minY) / h
  const bx = minX / w
  const by = minY / h

  const bodyBox = { x: bx, y: by, width: bw, height: bh }
  const headH = bh * 0.5
  const headBox = { x: bx, y: by, width: bw, height: headH }

  return {
    bodyBox,
    headBox,
    leftEye: { x: bx + bw * 0.34, y: by + headH * 0.42 },
    rightEye: { x: bx + bw * 0.66, y: by + headH * 0.42 },
    mouth: { x: bx + bw * 0.5, y: by + headH * 0.74 },
    nose: { x: bx + bw * 0.5, y: by + headH * 0.58 },
    tailRoot: { x: bx + bw * 1.02, y: by + bh * 0.62 },
  }
}
