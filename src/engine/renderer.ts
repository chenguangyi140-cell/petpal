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
import type { SkinConfig } from '@/skins/types'
import { getSkin } from '@/skins/registry'
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
  type MouthStyle,
} from './expression'
import { AudioAnalyzer, type AudioEnvelope } from './audioAnalyzer'
import { LipSync } from './lipSync'
import { BodySync, type BodySyncOffset } from './bodySync'

/** 渲染器输入状态（由外部 store 驱动，渲染器本身无状态业务） */
export interface RendererState {
  emotion: PetEmotion
  action: PetAction
  wearables: readonly PetWearable[]
  makeup: readonly MakeupItem[]
  reduceMotion: boolean
}

/** 默认锚点：未标定时的兜底布局（取自宠物皮肤，保证未上传照片也能正常渲染） */
export const DEFAULT_ANCHORS: PetAnchors = getSkin('pet').defaultAnchors

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
  /** 当前皮肤：决定情绪→动作映射等皮肤专有行为 */
  private skin: SkinConfig = getSkin('pet')

  /** 指针位置（归一化 -1..1，0,0=中心），用于视差与眼神跟随 */
  private pointer = { x: 0, y: 0 }
  private pointerTarget = { x: 0, y: 0 }
  /** 上次环境微光发射时刻，用于节流（避免粒子堆积） */
  private lastAmbient = 0

  /** 音频分析引擎 */
  private audioAnalyzer: AudioAnalyzer | null = null
  /** 口型同步器 */
  private lipSync: LipSync
  /** 身体节奏同步 */
  private bodySync: BodySync
  /** 当前是否处于音频驱动模式 */
  private isAudioPlaying = false

  /** 切换皮肤（由上层在创建形象时调用） */
  setSkin(skin: SkinConfig): void {
    this.skin = skin
  }

  /** 更新指针位置（归一化 -1..1），由上层在画布 mousemove 时调用 */
  setPointer(nx: number, ny: number): void {
    this.pointerTarget.x = Math.max(-1, Math.min(1, nx))
    this.pointerTarget.y = Math.max(-1, Math.min(1, ny))
  }

  /** 动作完成回调（供上层同步状态，如播放结束后触发对话） */
  onActionComplete?: (action: PetAction) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.lipSync = new LipSync('neutral')
    this.bodySync = new BodySync(false)
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
      this.pendingFallback = this.skin.actionForEmotion(next.emotion)
      // 情绪变化时更新 LipSync 的默认嘴型
      this.lipSync.setEmotion(next.emotion)
    }
    // reduceMotion 变化时同步给 BodySync
    if (next.reduceMotion !== undefined) {
      this.bodySync.setReduceMotion(next.reduceMotion)
    }
  }

  /** 播放一次性动作，结束后回归到当前情绪对应的常态动作 */
  playAction(action: PetAction): void {
    this.scheduler.play(action, (done) => {
      this.scheduler.play(this.pendingFallback)
      this.onActionComplete?.(done)
    })
  }

  // ── 音频驱动接口 ────────────────────────────────────────────────

  /**
   * 从麦克风启动音频同步
   * @param options 媒体约束
   */
  async startAudioFromMic(options?: MediaStreamConstraints): Promise<void> {
    if (this.isAudioPlaying) await this.stopAudio()
    this.audioAnalyzer = new AudioAnalyzer()
    this.isAudioPlaying = true
    await this.audioAnalyzer.startMicrophone(options)
    this._bindAudioFrame()
  }

  /**
   * 从一个 <audio> 元素启动音频同步（不自动播放，需调用方先 play()）
   */
  attachAudioElement(audioEl: HTMLAudioElement): void {
    if (this.isAudioPlaying) void this.stopAudio()
    this.audioAnalyzer = new AudioAnalyzer()
    this.isAudioPlaying = true
    this.audioAnalyzer.attachAudioElement(audioEl)
    this._bindAudioFrame()
  }

  /** 停止音频同步，释放所有音频资源 */
  async stopAudio(): Promise<void> {
    if (!this.isAudioPlaying) return
    this.isAudioPlaying = false
    if (this.audioAnalyzer) {
      await this.audioAnalyzer.stop()
      this.audioAnalyzer = null
    }
    this.lipSync.reset()
    this.bodySync.reset()
  }

  /** 获取当前音频分析器（供外部查询状态） */
  getAudioAnalyzer(): AudioAnalyzer | null {
    return this.audioAnalyzer
  }

  /** 是否正在音频同步模式 */
  get isAudioSyncActive(): boolean {
    return this.isAudioPlaying
  }

  /** 内部：绑定音频帧回调 */
  private _bindAudioFrame(): void {
    if (!this.audioAnalyzer) return
    this.audioAnalyzer.setOnFrame((env: AudioEnvelope) => {
      this._onAudioFrame(env)
    })
  }

  /** 内部：每帧音频数据回调 */
  private _onAudioFrame(env: AudioEnvelope): void {
    // 更新口型
    const lipResult = this.lipSync.update(env)
    // 更新身体节奏（获取下一帧的 bounceVelocity）
    const bodyResult = this.bodySync.update(env)
    // 将结果暂存，在 renderFrame 中应用
    this._lastLipResult = lipResult
    this._lastBodyOffset = bodyResult.offset
  }

  /** 最近一帧的口型和身体偏移结果（在 renderFrame 中消费） */
  private _lastLipResult: ReturnType<LipSync['update']> | null = null
  private _lastBodyOffset: BodySyncOffset | null = null

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

    // 指针缓动：让视差与眼神跟随更顺滑，避免鼠标抖动造成生硬跳变
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.08
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.08

    // 场景暗角：制造「舞台感」，让主体从空白页面中浮出
    this.drawBackdrop(W, H)

    // 环境微光：缓慢上浮的星点，增加氛围生机（尊重 reduceMotion）
    if (!reduceMotion && now - this.lastAmbient > 1500 && this.particles.length < 44) {
      this.lastAmbient = now
      this.particles.push({
        x: Math.random() * W,
        y: H * (0.68 + Math.random() * 0.28),
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.16 - Math.random() * 0.14,
        life: 0,
        maxLife: 3500 + Math.random() * 2500,
        glyph: '✧',
        size: 4 + Math.random() * 5,
      })
    }

    // 眨眼：周期性闭眼约 140ms，是「活物」最关键的视觉信号
    let openFactor = 1
    if (!reduceMotion && emotion !== 'sleepy') {
      const BLINK_PERIOD = 4200
      const bp = (now % BLINK_PERIOD) / BLINK_PERIOD
      if (bp > 0.94) {
        const t = (bp - 0.94) / 0.06
        openFactor = Math.max(0.08, Math.abs(Math.cos(t * Math.PI)))
      }
    }

    // 眼神跟随：看向当前指针方向（已缓动）
    const look = reduceMotion ? { x: 0, y: 0 } : { x: this.pointer.x, y: this.pointer.y }

    // L1 接地阴影：不随身体旋转，仅随腾空高度缩放，是纵深感的关键线索
    const shadow = computeShadowScale(action, progress, reduceMotion)
    this.drawShadow(W, H, shadow)

    // L2 起：建立身体变换栈，后续所有子层继承此变换
    const body = computeBodyTransform(action, progress, reduceMotion)
    const center = this.bodyCenterPx()

    ctx.save()
    ctx.translate(center.x, center.y)
    // 应用音频驱动的身体偏移
    const bodyOffset = this._lastBodyOffset ?? { extraTranslateY: 0, extraScaleX: 0, extraScaleY: 0, extraRotation: 0, isBouncing: false }
    if (bodyOffset.extraRotation !== 0) ctx.rotate(body.rotation + bodyOffset.extraRotation)
    else if (body.rotation !== 0) ctx.rotate(body.rotation)
    const sx = body.scaleX + bodyOffset.extraScaleX
    const sy = body.scaleY + bodyOffset.extraScaleY
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy)
    // 指针视差：主体随光标轻微位移（与背景/阴影形成纵深），reduceMotion 时关闭
    const parX = reduceMotion ? 0 : this.pointer.x * W * 0.018
    const parY = reduceMotion ? 0 : this.pointer.y * H * 0.012
    ctx.translate(body.translateX * W + parX, body.translateY * H + parY + bodyOffset.extraTranslateY * H)
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

    // L6 表情层（传入眨眼与眼神跟随，音频驱动时覆盖嘴型）
    this.drawExpression(openFactor, look, this._lastLipResult?.mouthStyle)

    // L3/L4 服装与配饰：绘制在表情之上，避免帽子被表情线条压住
    this.drawWearables()

    ctx.restore()

    // L7 特效层：独立于身体变换，粒子不应跟随宠物旋转
    this.drawParticles()

    ctx.restore()
  }

  // ── 各图层绘制实现 ────────────────────────────────────────────

  /** 场景暗角：极淡的径向渐变，制造舞台聚光感而不与明暗主题冲突 */
  private drawBackdrop(W: number, H: number): void {
    const { ctx } = this
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.12, W / 2, H * 0.5, H * 0.78)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.07)')
    ctx.save()
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  private drawShadow(W: number, H: number, shadow: { scale: number; opacity: number }): void {
    const box = this.anchors.bodyBox
    const cx = (box.x + box.width / 2) * W
    const cy = (box.y + box.height) * H * 0.99
    const rx = box.width * 0.44 * W * shadow.scale
    const ry = box.width * 0.13 * W * shadow.scale

    this.ctx.save()
    // 中性深色、更大柔化，确保在浅色/深色背景上都能读出「落地阴影」
    this.ctx.fillStyle = `rgba(15, 15, 20, ${shadow.opacity})`
    this.ctx.filter = 'blur(7px)'
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
    // 投影光晕：沿去背图轮廓投出柔和阴影，让主体从背景「浮起」而非贴纸
    ctx.shadowColor = 'rgba(0, 0, 0, 0.30)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 7
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

  private drawExpression(openFactor: number, look: { x: number; y: number }, overrideMouth?: MouthStyle): void {
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
    drawEyes(this.ctx, leftEye, rightEye, style.eye, eyeSize, openFactor, look)
    // 音频驱动时优先使用 LipSync 计算的嘴型，否则使用情绪默认嘴型
    const mouthStyle = overrideMouth ?? style.mouth
    drawMouth(this.ctx, mouth, mouthStyle, eyeSize * 1.15)

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
