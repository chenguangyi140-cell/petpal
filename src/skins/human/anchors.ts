import type { PetAnchors } from '@/types'

/** 人物默认锚点（无照片兜底）：头在上部、占比更小，无尾根 */
export const HUMAN_DEFAULT_ANCHORS: PetAnchors = {
  bodyBox: { x: 0.15, y: 0.2, width: 0.7, height: 0.7 },
  headBox: { x: 0.28, y: 0.12, width: 0.44, height: 0.3 },
  leftEye: { x: 0.4, y: 0.24 },
  rightEye: { x: 0.6, y: 0.24 },
  mouth: { x: 0.5, y: 0.34 },
  nose: { x: 0.5, y: 0.3 },
  tailRoot: undefined,
}

/** 人物头身比估算：头部占主体比例更小，且无尾根挂点 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export async function estimateHumanAnchors(dataUrl: string): Promise<PetAnchors> {
  const img = await loadImage(dataUrl)
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return HUMAN_DEFAULT_ANCHORS

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
  if (!found) return HUMAN_DEFAULT_ANCHORS

  const bw = (maxX - minX) / w
  const bh = (maxY - minY) / h
  const bx = minX / w
  const by = minY / h

  const bodyBox = { x: bx, y: by, width: bw, height: bh }
  // 人物头占比更小（约 1/3），与宠物（1/2）区分
  const headH = bh * 0.34
  const headBox = { x: bx, y: by, width: bw, height: headH }

  return {
    bodyBox,
    headBox,
    leftEye: { x: bx + bw * 0.38, y: by + headH * 0.42 },
    rightEye: { x: bx + bw * 0.62, y: by + headH * 0.42 },
    mouth: { x: bx + bw * 0.5, y: by + headH * 0.78 },
    nose: { x: bx + bw * 0.5, y: by + headH * 0.6 },
    tailRoot: undefined, // 人物无尾
  }
}
