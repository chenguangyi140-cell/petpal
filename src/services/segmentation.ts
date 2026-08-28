import type { SegmentationOptions } from '@/types'

/**
 * 端侧去背（零依赖）
 *
 * 方案选择说明：原计划使用 @imgly/background-removal（u2netp 量化模型 ~5MB），
 * 但该库安装失败且会显著增加包体积与首屏加载时间。改为实现扫描线洪水填充：
 *
 * 优势：
 * - 零依赖、零模型下载，包体积几乎不增加
 * - 完全端侧，隐私性更好（照片不出设备）
 * - 对「宠物在纯色/简单背景」这一最高频场景效果足够好
 *
 * 局限：复杂背景（如宠物趴在花纹地毯上）效果有限，
 * 因此保留容差滑块供用户调节，并在失败时提供手动裁剪兜底。
 */

interface RGB {
  r: number
  g: number
  b: number
}

/** 处理尺寸上限：超过则降采样，避免大图导致主线程长时间阻塞 */
const MAX_PROCESSING_SIZE = 900

/** 默认容差（RGB 欧氏距离） */
export const DEFAULT_TOLERANCE = 42

const colorDistance = (a: RGB, b: RGB): number => {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * 从图像四边多点采样，取出现频次最高的颜色作为背景基准色
 * 单点采样容易被宠物身上的同色区域误导，多点众数更稳健
 */
function sampleBackgroundColor(data: Uint8ClampedArray, w: number, h: number): RGB {
  const samples: RGB[] = []
  const step = Math.max(1, Math.floor(Math.min(w, h) / 24))

  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r !== undefined && g !== undefined && b !== undefined) {
      samples.push({ r, g, b })
    }
  }

  // 上边与下边
  for (let x = 0; x < w; x += step) {
    push(x, 0)
    push(x, h - 1)
  }
  // 左边与右边
  for (let y = 0; y < h; y += step) {
    push(0, y)
    push(w - 1, y)
  }

  if (samples.length === 0) return { r: 255, g: 255, b: 255 }

  // 众数近似：按量化后的颜色分桶，取最大桶的均值
  const buckets = new Map<string, { sum: RGB; count: number }>()
  for (const s of samples) {
    // 量化到 16 级，合并相近颜色
    const key = `${s.r >> 4},${s.g >> 4},${s.b >> 4}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.sum.r += s.r
      bucket.sum.g += s.g
      bucket.sum.b += s.b
      bucket.count += 1
    } else {
      buckets.set(key, { sum: { ...s }, count: 1 })
    }
  }

  let best: { sum: RGB; count: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return samples[0] ?? { r: 255, g: 255, b: 255 }

  return {
    r: Math.round(best.sum.r / best.count),
    g: Math.round(best.sum.g / best.count),
    b: Math.round(best.sum.b / best.count),
  }
}

/**
 * 扫描线洪水填充标记背景像素
 *
 * 用显式栈 + 水平 span 扩展，避免递归导致的栈溢出；
 * 相比逐像素 BFS，span 填充将栈操作减少约一个数量级。
 */
function floodFillBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: RGB,
  tolerance: number,
): Uint8Array {
  const isBg = new Uint8Array(w * h)
  const stack: number[] = []

  const matches = (i: number): boolean => {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (r === undefined || g === undefined || b === undefined || a === undefined) return false
    if (a < 8) return true // 已透明视为背景
    return colorDistance({ r, g, b }, bg) <= tolerance
  }

  const seed = (x: number, y: number) => {
    const idx = y * w + x
    if (isBg[idx]) return
    if (!matches(idx * 4)) return
    isBg[idx] = 1
    stack.push(x, y)
  }

  // 从四边播种
  for (let x = 0; x < w; x++) {
    seed(x, 0)
    seed(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    seed(0, y)
    seed(w - 1, y)
  }

  while (stack.length > 0) {
    const y = stack.pop()
    const x0 = stack.pop()
    if (y === undefined || x0 === undefined) break

    // 向左扩展
    let left = x0
    while (left > 0 && matches((y * w + (left - 1)) * 4) && !isBg[y * w + (left - 1)]) {
      left -= 1
      isBg[y * w + left] = 1
    }
    // 向右扩展
    let right = x0
    while (right < w - 1 && matches((y * w + (right + 1)) * 4) && !isBg[y * w + (right + 1)]) {
      right += 1
      isBg[y * w + right] = 1
    }

    // 上下相邻行入栈
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= h) continue
      for (let x = left; x <= right; x++) {
        const idx = ny * w + x
        if (!isBg[idx] && matches(idx * 4)) {
          isBg[idx] = 1
          stack.push(x, ny)
        }
      }
    }
  }

  return isBg
}

/**
 * 边缘羽化：对保留区域的外缘像素做部分透明，消除硬边锯齿
 * 逐像素检查 3x3 邻域，邻域内背景像素越多则越透明
 */
function featherEdges(data: Uint8ClampedArray, w: number, h: number, isBg: Uint8Array): void {
  const alphaCopy = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) alphaCopy[i] = data[i * 4 + 3] ?? 255

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      if (isBg[idx]) continue

      let bgNeighbors = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (isBg[(y + dy) * w + (x + dx)]) bgNeighbors += 1
        }
      }
      // 邻域背景占比越高，说明越靠近边缘，透明度按梯度衰减
      if (bgNeighbors > 0) {
        const factor = 1 - bgNeighbors / 8 * 0.85
        const a = alphaCopy[idx] ?? 255
        data[idx * 4 + 3] = Math.round(a * Math.max(0.15, factor))
      }
    }
  }
}

export interface SegmentationResult {
  dataUrl: string
  /** 被判定为背景的像素占比，用于让用户判断抠图质量 */
  backgroundRatio: number
}

/**
 * 执行去背
 * @param source 图片 dataURL 或 URL
 * @param options 容差等参数
 */
export async function removeBackground(
  source: string,
  options: SegmentationOptions = {},
): Promise<SegmentationResult> {
  const { tolerance = DEFAULT_TOLERANCE, feather = true } = options

  const img = await loadImage(source)

  // 降采样到处理上限，保持宽高比
  const scale = Math.min(1, MAX_PROCESSING_SIZE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布上下文')

  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const bg = sampleBackgroundColor(data, w, h)
  const isBg = floodFillBackground(data, w, h, bg, tolerance)

  let bgCount = 0
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0
      bgCount += 1
    }
  }

  if (feather) featherEdges(data, w, h, isBg)

  ctx.putImageData(imageData, 0, 0)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    backgroundRatio: bgCount / (w * h),
  }
}

/**
 * 手动裁剪兜底：用户框选矩形区域直接裁切
 * 自动去背失败（复杂背景）时的保底方案
 */
export async function cropToRegion(
  source: string,
  region: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(region.width))
  canvas.height = Math.max(1, Math.round(region.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(
    img,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas.toDataURL('image/png')
}

/** 压缩图片：控制 dataURL 体积，避免 IndexedDB 膨胀 */
export async function compressImage(
  source: string,
  maxSize = 1024,
  quality = 0.9,
): Promise<string> {
  const img = await loadImage(source)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  if (scale === 1 && source.startsWith('data:image/jpeg')) return source

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}
