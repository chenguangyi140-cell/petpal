/**
 * 三视图转盘渲染器
 *
 * 输入最多三张去背图（前 / 侧 / 后），按当前偏航角在前↔侧↔后↔侧↔前之间
 * 交叉淡入淡出，叠加呼吸、待机轻摆、接地阴影、指针视差等「生命感」，
 * 形成可拖拽旋转的动态 3D 形象。
 *
 * 鲁棒性：任意视角缺失都不会崩——
 * - 三视图齐全：真实视角交叉淡入淡出（最像 3D）
 * - 仅有一张：退化为「平面卡片旋转」（按 cos 缩放+镜像），仍可转起来
 */

export interface ThreeViewImages {
  front?: HTMLImageElement | null
  side?: HTMLImageElement | null
  back?: HTMLImageElement | null
}

interface RenderState {
  reduceMotion: boolean
}

/** 三视图齐全判定：至少要有前+后，侧用于中段插值 */
function isFullSet(v: ThreeViewImages): boolean {
  return Boolean(v.front && v.back)
}

export class ThreeViewRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D

  private images: ThreeViewImages = {}
  private state: RenderState = { reduceMotion: false }

  private rafId: number | null = null

  /** 当前偏航角（弧度，0 = 正面朝向镜头），范围自然环绕 */
  private angle = 0
  /** 自动旋转速度（弧度/秒），拖拽时归零 */
  private autoSpeed = 0.35
  private dragging = false

  /** 指针归一化 -1..1，用于视差 */
  private pointer = { x: 0, y: 0 }
  private pointerTarget = { x: 0, y: 0 }

  private dpr = 1
  private logicalWidth = 360
  private logicalHeight = 360
  /** 上一帧时间戳，用于按真实时间推进（避免不同刷新率下转速不一致） */
  private lastTs = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
  }

  // ── 资源注入 ────────────────────────────────────────────

  /** 设置已加载好的图像元素 */
  setImages(images: ThreeViewImages): void {
    this.images = images
  }

  /** 从 dataURL 集合异步加载（缺失项留空，不影响其余视角） */
  async setViewDataUrls(views: {
    front: string | null
    side: string | null
    back: string | null
  }): Promise<void> {
    const load = async (src: string | null): Promise<HTMLImageElement | null> => {
      if (!src) return null
      try {
        return await loadImage(src)
      } catch {
        return null
      }
    }
    const [front, side, back] = await Promise.all([
      load(views.front),
      load(views.side),
      load(views.back),
    ])
    this.images = { front, side, back }
  }

  setState(next: Partial<RenderState>): void {
    this.state = { ...this.state, ...next }
  }

  /** 设置指针位置（归一化 -1..1），由上层 mousemove 调用 */
  setPointer(nx: number, ny: number): void {
    this.pointerTarget.x = Math.max(-1, Math.min(1, nx))
    this.pointerTarget.y = Math.max(-1, Math.min(1, ny))
  }

  /** 拖拽旋转：直接设置偏航角（弧度） */
  setAngle(rad: number): void {
    this.angle = rad
  }

  /** 读取当前偏航角（供拖拽手势初始化基准） */
  getAngle(): number {
    return this.angle
  }

  /** 拖拽状态：拖拽时暂停自动旋转，松手后恢复 */
  setDragging(v: boolean): void {
    this.dragging = v
  }

  /** 是否三视图齐全（供 UI 提示） */
  get hasFullSet(): boolean {
    return isFullSet(this.images)
  }

  // ── 尺寸与循环 ──────────────────────────────────────────

  resize(width: number, height: number): void {
    this.logicalWidth = width
    this.logicalHeight = height
    this.dpr = Math.min(window.devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  start(): void {
    if (this.rafId !== null) return
    this.lastTs = performance.now()
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
    this.images = {}
  }

  exportImage(): string {
    return this.canvas.toDataURL('image/png')
  }

  // ── 帧渲染 ──────────────────────────────────────────────

  private renderFrame(now: number): void {
    const dt = Math.min(0.05, (now - this.lastTs) / 1000)
    this.lastTs = now

    const { ctx } = this
    const W = this.logicalWidth
    const H = this.logicalHeight

    ctx.save()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    // 自动旋转（拖拽时暂停）
    if (!this.dragging && !this.state.reduceMotion) {
      this.angle += this.autoSpeed * dt
    }
    this.angle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

    // 指针缓动
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.08
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.08

    this.drawBackdrop(W, H)

    const t = now / 1000
    const breathing = this.state.reduceMotion ? 0 : Math.sin(t * 1.6) // 待机呼吸相位
    const bob = this.state.reduceMotion ? 0 : Math.sin(t * 1.1) * 0.012
    const sway = this.state.reduceMotion ? 0 : Math.sin(t * 0.7) * 0.02

    // 接地阴影随呼吸/起伏缩放
    const shadowScale = 1 + (this.state.reduceMotion ? 0 : breathing * 0.04)
    this.drawGroundShadow(W, H, shadowScale)

    ctx.save()
    // 整体居中并施加生命感变换
    const cx = W / 2
    const cy = H / 2
    const parX = this.state.reduceMotion ? 0 : this.pointer.x * W * 0.015
    const parY = this.state.reduceMotion ? 0 : this.pointer.y * H * 0.01
    ctx.translate(cx + parX, cy + parY)

    if (this.images.front || this.images.side || this.images.back) {
      if (isFullSet(this.images)) {
        this.drawFullTurntable(breathing, bob, sway)
      } else {
        this.drawCardTurn(breathing, bob, sway)
      }
    }
    ctx.restore()

    ctx.restore()
  }

  /** 完整三视图转盘：按角度在真实视角间交叉淡入淡出 */
  private drawFullTurntable(breathing: number, bob: number, sway: number): void {
    const a = this.angle
    const full = Math.PI * 2
    const seg = a / (full / 4) // 0..4，每段 90°
    const idx = Math.floor(seg) % 4
    const t = seg - Math.floor(seg) // 段内插值 0..1

    // 四个锚点对应的视角：正面→右侧→背面→左侧(=右侧镜像)→正面
    const order: Array<keyof ThreeViewImages> = ['front', 'side', 'back', 'side']
    const key = order[idx] ?? 'front'
    const nextKey = order[(idx + 1) % 4] ?? 'front'
    const base = this.images[key] ?? this.images.front ?? null
    const next = this.images[nextKey] ?? base
    // 270° 段（左侧）应镜像右侧，制造「转过去再转回来」的连贯感
    const mirrorNext = idx === 3

    const box = this.viewBox()
    // 待机：垂直呼吸 + 轻微上下浮动 + 微旋
    const scaleY = 1 + breathing * 0.02
    const scaleX = 1 + breathing * 0.012
    const ty = bob * this.logicalHeight

    // 底层（当前段视角）
    ctxSaveScale(this.ctx, box, scaleX, scaleY, ty, sway)
    this.drawContained(base, box, 1 - t, false)
    this.ctx.restore()
    // 上层（下一段视角，逐渐显现）
    if (t > 0.001 && next && next !== base) {
      ctxSaveScale(this.ctx, box, scaleX, scaleY, ty, sway)
      this.drawContained(next, box, t, mirrorNext)
      this.ctx.restore()
    }
  }

  /** 单图退化模式：平面卡片按 cos 缩放+镜像，模拟翻面 */
  private drawCardTurn(breathing: number, bob: number, sway: number): void {
    const base = this.images.front ?? this.images.side ?? this.images.back ?? null
    if (!base) return
    const a = this.angle
    // cos 决定可见宽度与正反面；<0 表示转到背面，用镜像表现
    const c = Math.cos(a)
    const facingBack = c < 0
    const widthScale = Math.max(0.12, Math.abs(c))
    const box = this.viewBox()
    const scaleX = widthScale * (1 + breathing * 0.012)
    const scaleY = 1 + breathing * 0.02
    const ty = bob * this.logicalHeight

    ctxSaveScale(this.ctx, box, scaleX, scaleY, ty, sway)
    this.drawContained(base, box, 1, facingBack)
    this.ctx.restore()
  }

  /** 计算主体绘制包围盒（居中，留边） */
  private viewBox(): { x: number; y: number; w: number; h: number } {
    const W = this.logicalWidth
    const H = this.logicalHeight
    const h = H * 0.82
    const w = W * 0.72
    return { x: (W - w) / 2, y: (H - h) / 2, w, h }
  }

  /** 在包围盒内以 contain 方式绘制去背图，近似居中 */
  private drawContained(
    img: HTMLImageElement | null,
    box: { x: number; y: number; w: number; h: number },
    alpha: number,
    mirror: boolean,
  ): void {
    if (!img) return
    const { ctx } = this
    const ir = img.width / img.height
    const br = box.w / box.h
    let dw = box.w
    let dh = box.h
    if (ir > br) dh = box.w / ir
    else dw = box.h * ir
    const dx = box.x + (box.w - dw) / 2
    const dy = box.y + (box.h - dh) / 2

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    // 投影光晕：让主体从背景浮起
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    if (mirror) {
      ctx.translate(dx + dw, dy)
      ctx.scale(-1, 1)
      ctx.drawImage(img, 0, 0, dw, dh)
    } else {
      ctx.drawImage(img, dx, dy, dw, dh)
    }
    ctx.restore()
  }

  private drawBackdrop(W: number, H: number): void {
    const { ctx } = this
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.12, W / 2, H * 0.5, H * 0.8)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.07)')
    ctx.save()
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  private drawGroundShadow(W: number, H: number, scale: number): void {
    const { ctx } = this
    const cy = H * 0.9
    const rx = W * 0.22 * scale
    const ry = W * 0.06 * scale
    ctx.save()
    ctx.fillStyle = 'rgba(15,15,20,0.20)'
    ctx.filter = 'blur(7px)'
    ctx.beginPath()
    ctx.ellipse(W / 2, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** 应用呼吸/浮动/微旋变换后绘制主体 */
function ctxSaveScale(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  scaleX: number,
  scaleY: number,
  translateY: number,
  sway: number,
): void {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  ctx.save()
  ctx.translate(cx, cy + translateY)
  ctx.rotate(sway)
  ctx.scale(scaleX, scaleY)
  ctx.translate(-cx, -cy)
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
