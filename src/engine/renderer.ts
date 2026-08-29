import type {
  AnchorConfig,
  BodyPart,
  MakeupItem,
  PetAction,
  PetAnchors,
  PetEmotion,
  PetWearable,
  Point,
  Rect,
} from '@/types'
import { MAKEUP_TYPES } from '@/constants/catalog'
import {
  computeBodyTransform,
  computeShadowScale,
  computeTailRotation,
  AnimationScheduler,
} from './animation'
import {
  EXPRESSION_MAP,
  drawBrows,
  drawEmotionBlush,
  drawEyes,
  drawMouth,
} from './expression'

/** 渲染器输入状态（由外部 store 驱动，渲染器本身无状态业务） */
export interface RendererState {
  emotion: PetEmotion
  action: PetAction
  wearables: readonly PetWearable[]
  makeup: readonly MakeupItem[]
  reduceMotion: boolean
}

/** 默认锚点：未标定时的兜底布局，保证未上传照片也能正常渲染 */
export const DEFAULT_ANCHORS: PetAnchors = {
  bodyBox: { x: 0.18, y: 0.3, width: 0.64, height: 0.58 },
  headBox: { x: 0.24, y: 0.08, width: 0.52, height: 0.42 },
  leftEye: { x: 0.38, y: 0.32 },
  rightEye: { x: 0.62, y: 0.32 },
  mouth: { x: 0.5, y: 0.42 },
  nose: { x: 0.5, y: 0.375 },
  tailRoot: { x: 0.8, y: 0.66 },
}

/** 情绪愉悦度 → 尾巴摆动强度 */
const EMOTION_WAG_BOOST: Readonly<Record<PetEmotion, number>> = {
  happy: 1,
  sweet: 0.85,
  neutral: 0.15,
  hungry: 0.2,
  sad: 0,
  angry: 0,
  sleepy: 0,
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  glyph: string
  size: number
}

const PARTICLE_GLYPHS = ['✨', '💕', '⭐', '🌟', '❤️', '🎉'] as const

export class PetRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly scheduler = new AnimationScheduler()

  private cutout: HTMLImageElement | null = null
  private anchors: PetAnchors = DEFAULT_ANCHORS
  private state: RendererState = {
    emotion: 'neutral',
    action: 'idle',
    wearables: [],
    makeup: [],
    reduceMotion: false,
  }

  private rafId: number | null = null
  private particles: Particle[] = []
  private logicalWidth = 360
  private logicalHeight = 360
  private dpr = 1
  /** 一次性动作完成后的回归动作 */
  private pendingFallback: PetAction = 'idle'

  /** 动作完成回调（供上层同步状态，如播放结束后触发对话） */
  onActionComplete?: (action: PetAction) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
  }

  // ── 资源与状态注入 ────────────────────────────────────────────

  /** 加载去背后的主体图；传 null 表示回退到内置矢量宠物 */
  async setCutout(dataUrl: string | null): Promise<void> {
    if (!dataUrl) {
      this.cutout = null
      return
    }
    try {
      this.cutout = await loadImage(dataUrl)
    } catch {
      // 图片损坏时静默回退，避免整个渲染崩溃
      this.cutout = null
    }
  }

  setAnchors(anchors: PetAnchors | null): void {
    this.anchors = anchors ?? DEFAULT_ANCHORS
  }

  setState(next: Partial<RendererState>): void {
    const prevAction = this.state.action
    this.state = { ...this.state, ...next }
    if (next.action && next.action !== prevAction) {
      this.scheduler.play(next.action, (done) => {
        // 一次性动作结束后回到情绪建议的常态动作，而非硬切 idle
        const fallback = this.pendingFallback
        this.scheduler.play(fallback)
        this.onActionComplete?.(done)
      })
    }
    if (next.emotion) {
      this.pendingFallback = next.emotion === 'sleepy' ? 'sleep' : next.emotion === 'happy' || next.emotion === 'sweet' ? 'wagTail' : 'idle'
    }
  }

  /** 播放一次性动作，结束后回归到当前情绪对应的常态动作 */
  playAction(action: PetAction): void {
    this.scheduler.play(action, (done) => {
      this.scheduler.play(this.pendingFallback)
      this.onActionComplete?.(done)
    })
  }

  // ── 画布尺寸管理 ──────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.logicalWidth = width
    this.logicalHeight = height
    this.dpr = Math.min(window.devicePixelRatio || 1, 3) // 上限 3 避免超高 DPR 设备性能浪费
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  // ── 渲染循环 ──────────────────────────────────────────────────

  start(): void {
    if (this.rafId !== null) return
    const loop = (now: number) => {
      this.renderFrame(now)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  destroy(): void {
    this.stop()
    this.particles = []
  }

  // ── 特效 ──────────────────────────────────────────────────────

  /** 在归一化坐标处迸发粒子（点击宠物、喂食等正反馈场景） */
  burst(normalizedX: number, normalizedY: number, count = 6): void {
    if (this.state.reduceMotion) return
    const px = normalizedX * this.logicalWidth
    const py = normalizedY * this.logicalHeight
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const speed = 0.6 + Math.random() * 1.1
      const glyph = PARTICLE_GLYPHS[Math.floor(Math.random() * PARTICLE_GLYPHS.length)] ?? '✨'
      this.particles.push({
        x: px + (Math.random() - 0.5) * 30,
        y: py + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 700 + Math.random() * 400,
        glyph,
        size: 14 + Math.random() * 12,
      })
    }
    // 上限保护：防止连续点击堆积粒子拖慢渲染
    if (this.particles.length > 60) this.particles.splice(0, this.particles.length - 60)
  }

  // ── 帧渲染 ────────────────────────────────────────────────────

  private renderFrame(now: number): void {
    const { ctx } = this
    const { width: W, height: H } = { width: this.logicalWidth, height: this.logicalHeight }

    ctx.save()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const { progress } = this.scheduler.tick(now)
    const action = this.scheduler.currentAction
    const { emotion, reduceMotion } = this.state

    // L1 接地阴影：不随身体旋转，仅随腾空高度缩放，是纵深感的关键线索
    const shadow = computeShadowScale(action, progress, reduceMotion)
    this.drawShadow(W, H, shadow)

    // L2 起：建立身体变换栈，后续所有子层继承此变换
    const body = computeBodyTransform(action, progress, reduceMotion)
    const center = this.bodyCenterPx()

    ctx.save()
    ctx.translate(center.x, center.y)
    if (body.rotation !== 0) ctx.rotate(body.rotation)
    if (body.scaleX !== 1 || body.scaleY !== 1) ctx.scale(body.scaleX, body.scaleY)
    ctx.translate(body.translateX * W, body.translateY * H)
    ctx.translate(-center.x, -center.y)

    // L2 身体主体（照片或内置矢量宠物）
    if (this.cutout) {
      this.drawCutout()
    } else {
      this.drawDefaultPet()
    }

    // L2.1 可动部件：尾巴相对身体独立摆动
    const tailRotation = computeTailRotation(
      action,
      progress,
      EMOTION_WAG_BOOST[emotion],
      reduceMotion,
    )
    this.drawTail(tailRotation)

    // L5 化妆层：在表情之下，让妆容贴合皮毛而非盖住五官线条
    this.drawMakeup()

    // L6 表情层
    this.drawExpression()

    // L3/L4 服装与配饰：绘制在表情之上，避免帽子被表情线条压住
    this.drawWearables()

    ctx.restore()

    // L7 特效层：独立于身体变换，粒子不应跟随宠物旋转
    this.drawParticles()

    ctx.restore()
  }

  // ── 各图层绘制实现 ────────────────────────────────────────────

  private drawShadow(W: number, H: number, shadow: { scale: number; opacity: number }): void {
    const box = this.anchors.bodyBox
    const cx = (box.x + box.width / 2) * W
    const cy = (box.y + box.height) * H * 0.99
    const rx = box.width * 0.42 * W * shadow.scale
    const ry = box.width * 0.11 * W * shadow.scale

    this.ctx.save()
    this.ctx.fillStyle = `rgba(120, 90, 40, ${shadow.opacity})`
    this.ctx.filter = 'blur(4px)'
    this.ctx.beginPath()
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()
  }

  private drawCutout(): void {
    const { ctx } = this
    const box = this.px(this.anchors.bodyBox)
    ctx.save()
    // 高质量缩放，避免照片放大后模糊
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (this.cutout) {
      ctx.drawImage(this.cutout, box.x, box.y, box.width, box.height)
    }
    ctx.restore()
  }

  /** 无照片时的内置矢量宠物，保证零配置可用 */
  private drawDefaultPet(): void {
    const { ctx } = this
    const box = this.px(this.anchors.bodyBox)
    const head = this.px(this.anchors.headBox)
    const cx = box.x + box.width / 2

    ctx.save()

    // 耳朵
    const earW = head.width * 0.24
    const earH = head.height * 0.42
    ctx.fillStyle = '#EAB309'
    ctx.beginPath()
    ctx.ellipse(head.x + earW * 0.9, head.y + earH * 0.55, earW / 2, earH / 2, -0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(
      head.x + head.width - earW * 0.9,
      head.y + earH * 0.55,
      earW / 2,
      earH / 2,
      0.25,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // 身体
    ctx.fillStyle = '#F5C76E'
    ctx.beginPath()
    ctx.ellipse(cx, box.y + box.height * 0.62, box.width * 0.42, box.height * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头部
    ctx.beginPath()
    ctx.ellipse(
      head.x + head.width / 2,
      head.y + head.height * 0.58,
      head.width * 0.36,
      head.height * 0.4,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    ctx.restore()
  }

  private drawTail(rotation: number): void {
    const root = this.anchors.tailRoot
    if (!root) return

    const { ctx } = this
    const box = this.px(this.anchors.bodyBox)
    const px = root.x * this.logicalWidth
    const py = root.y * this.logicalHeight
    const len = box.height * 0.34
    const thick = Math.max(4, box.width * 0.055)

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rotation)
    ctx.strokeStyle = '#EAB309'
    ctx.lineWidth = thick
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(len * 0.5, -len * 0.35, len * 0.85, -len * 0.75)
    ctx.stroke()
    ctx.restore()
  }

  private drawMakeup(): void {
    const items = this.state.makeup
    if (items.length === 0) return

    const { ctx } = this
    const face = this.px(this.anchors.headBox)
    const leftEye = this.pxPoint(this.anchors.leftEye)
    const rightEye = this.pxPoint(this.anchors.rightEye)
    const mouth = this.pxPoint(this.anchors.mouth)

    for (const { type } of MAKEUP_TYPES) {
      // 同类妆容只取最后一项（后选覆盖先选）
      const item = [...items].reverse().find((m) => m.type === type)
      if (!item) continue

      ctx.save()
      ctx.globalCompositeOperation = item.blendMode
      ctx.globalAlpha = item.opacity
      ctx.fillStyle = item.color
      ctx.filter = 'blur(3px)' // 柔化边缘，避免色块感

      const size = face.width * item.scale
      if (type === 'eyeshadow') {
        for (const eye of [leftEye, rightEye]) {
          ctx.beginPath()
          ctx.ellipse(eye.x, eye.y - size * 0.35, size * 0.7, size * 0.42, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (type === 'blush') {
        const dx = (rightEye.x - leftEye.x) * 0.42
        const dy = size * 0.9
        for (const ex of [leftEye.x - dx, rightEye.x + dx]) {
          ctx.beginPath()
          ctx.ellipse(ex, leftEye.y + dy, size * 0.75, size * 0.5, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        ctx.beginPath()
        ctx.ellipse(mouth.x, mouth.y + size * 0.2, size * 0.6, size * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  private drawExpression(): void {
    const style = EXPRESSION_MAP[this.state.emotion]
    const face = this.px(this.anchors.headBox)
    const leftEye = this.pxPoint(this.anchors.leftEye)
    const rightEye = this.pxPoint(this.anchors.rightEye)
    const mouth = this.pxPoint(this.anchors.mouth)
    // 眼距决定五官尺寸，保证不同脸型比例协调
    const eyeSize = Math.max(6, Math.abs(rightEye.x - leftEye.x) * 0.3)

    if (style.blush) {
      drawEmotionBlush(this.ctx, leftEye, rightEye, eyeSize)
    }
    drawBrows(this.ctx, leftEye, rightEye, style.browAngle, eyeSize)
    drawEyes(this.ctx, leftEye, rightEye, style.eye, eyeSize)
    drawMouth(this.ctx, mouth, style.mouth, eyeSize * 1.15)

    // 睡觉时绘制 Z 符号
    if (this.state.emotion === 'sleepy' && !this.state.reduceMotion) {
      this.drawSleepZ(face)
    }
  }

  private drawSleepZ(face: Rect): void {
    const { ctx } = this
    const now = performance.now()
    ctx.save()
    ctx.fillStyle = 'rgba(167, 139, 250, 0.85)'
    ctx.font = '600 16px system-ui, -apple-system, sans-serif'
    for (let i = 0; i < 3; i++) {
      // 三个 Z 错峰上升淡出
      const phase = ((now / 2000 + i / 3) % 1)
      const alpha = Math.sin(phase * Math.PI)
      if (alpha <= 0.02) continue
      ctx.globalAlpha = alpha
      const size = 12 + i * 4
      ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`
      ctx.fillText('Z', face.x + face.width * (0.82 + i * 0.05), face.y - phase * 26 - i * 6)
    }
    ctx.restore()
  }

  private drawWearables(): void {
    if (this.state.wearables.length === 0) return
    const { ctx } = this

    for (const w of this.state.wearables) {
      const partBox = this.getPartBox(w.anchor.attachTo)
      const px = this.px(partBox)
      const off = w.anchor.userOffset
      const scale = w.anchor.scale * (off?.scale ?? 1)
      const rotation = w.anchor.rotation + (off?.rotation ?? 0)
      const cx = px.x + (w.anchor.relativePos.x + (off?.dx ?? 0)) * px.width
      const cy = px.y + (w.anchor.relativePos.y + (off?.dy ?? 0)) * px.height
      const size = Math.min(px.width, px.height) * scale

      ctx.save()
      ctx.translate(cx, cy)
      if (rotation !== 0) ctx.rotate(rotation)
      if (w.isEmoji) {
        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(w.asset, 0, 0)
      }
      ctx.restore()
    }
  }

  private drawParticles(): void {
    if (this.particles.length === 0) return
    const { ctx } = this
    const dt = 16

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.particles = this.particles.filter((p) => {
      p.life += dt
      if (p.life >= p.maxLife) return false
      p.x += p.vx * (dt / 16)
      p.y += p.vy * (dt / 16)
      p.vy += 0.012 * (dt / 16) // 轻微重力，避免直线上升的机械感

      const t = p.life / p.maxLife
      ctx.globalAlpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
      const scale = 0.6 + Math.sin(t * Math.PI) * 0.6
      ctx.font = `${p.size * scale}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
      ctx.fillText(p.glyph, p.x, p.y)
      return true
    })
    ctx.restore()
  }

  // ── 坐标工具 ──────────────────────────────────────────────────

  /** 归一化矩形 → 像素矩形 */
  private px(r: Rect): Rect & { x: number; y: number; width: number; height: number } {
    return {
      x: r.x * this.logicalWidth,
      y: r.y * this.logicalHeight,
      width: r.width * this.logicalWidth,
      height: r.height * this.logicalHeight,
    }
  }

  private pxPoint(p: Point): { x: number; y: number } {
    return { x: p.x * this.logicalWidth, y: p.y * this.logicalHeight }
  }

  /** 身体中心（像素），作为整体旋转/缩放的锚点 */
  private bodyCenterPx(): { x: number; y: number } {
    const b = this.anchors.bodyBox
    return {
      x: (b.x + b.width / 2) * this.logicalWidth,
      y: (b.y + b.height / 2) * this.logicalHeight,
    }
  }

  /** 获取挂靠部件的包围盒（归一化） */
  private getPartBox(part: BodyPart): Rect {
    const { bodyBox, headBox } = this.anchors
    switch (part) {
      case 'head':
        return headBox
      case 'neck':
        // 颈部：头底与身体顶之间的过渡带
        return {
          x: headBox.x + headBox.width * 0.15,
          y: headBox.y + headBox.height * 0.72,
          width: headBox.width * 0.7,
          height: Math.max(0.04, bodyBox.y - (headBox.y + headBox.height * 0.72) + bodyBox.height * 0.16),
        }
      case 'tail': {
        const t = this.anchors.tailRoot
        return t
          ? { x: t.x - 0.08, y: t.y - 0.1, width: 0.16, height: 0.2 }
          : bodyBox
      }
      default:
        return bodyBox
    }
  }

  /** 导出当前画面为图片（拍照分享功能） */
  exportImage(): string {
    return this.canvas.toDataURL('image/png')
  }
}

/** 加载图片为 HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** 导出锚点默认值供 UI 复用 */
export { DEFAULT_ANCHORS as FALLBACK_ANCHORS }

/** 锚点配置类型再导出，供换装微调 UI 使用 */
export type { AnchorConfig }
