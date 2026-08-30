/**
 * 真·3D 模型查看器（three.js）
 *
 * 动态 import 'three'，避免拖入主包；仅在用户真正使用 3D 模型时才加载。
 * 加载本机 ComfyUI 生成的 GLB，渲染可自由拖拽旋转、带待机浮动的动态 3D 形象。
 *
 * 动作系统：订阅 store 的 action / emotion / sleep / tap，对无骨骼的 GLB 做
 * 伪 3D 表演（呼吸、跳跃、低头吃、睡觉歪头、开心弹跳、点击脉冲），让模型「活」起来。
 */
import type { PetAction, PetEmotion, WearableType, MakeupItem } from '@/types'

/** 已解析的配饰（由上层从 store 的 equipped 映射得到，避免查看器直接依赖皮肤目录） */
export interface ResolvedWearable {
  asset: string
  type: WearableType
  offset?: { dx: number; dy: number; scale: number; rotation: number }
}

// 服装精灵在模型局部坐标（模型归一化到高 ~1.6，y∈[-0.8,0.8]）的挂点
const WEAR_ANCHOR: Record<WearableType, [number, number, number]> = {
  hat: [0, 0.92, 0.04],
  bow: [0.34, 0.62, 0.06],
  scarf: [0, 0.34, 0.05],
  clothes: [0, 0.04, 0.04],
  bag: [0.46, 0.0, 0.06],
}
const WEAR_SIZE: Record<WearableType, number> = {
  hat: 0.5,
  bow: 0.3,
  scarf: 0.55,
  clothes: 0.78,
  bag: 0.36,
}

/** hex → rgba 字符串（支持 #rgb / #rrggbb） */
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

/** 把 emoji 渲染成透明画布贴图 */
function makeEmojiTexture(emoji: string, THREE: any): any {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.font = '200px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + 12)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 加载图片元素（支持 dataURL / blob），用于化妆烘焙 */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * 从图片 alpha 通道提取主体外轮廓（Moore-Neighbor 追踪 + 稀疏采样）。
 * 用于把平面照片升级成有厚度的立体剪纸手办。
 */
function traceAlphaContour(
  img: HTMLImageElement,
  threshold = 128,
  targetPoints = 140,
): { x: number; y: number }[] {
  const canvas = document.createElement('canvas')
  const w = 128
  const h = Math.max(1, Math.round(w * (img.height / img.width)))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  // 找最上方第一个不透明像素作为起点
  let sx = -1
  let sy = -1
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > threshold) {
        sx = x
        sy = y
        break outer
      }
    }
  }
  if (sx === -1) return []

  const dirs: Array<[number, number]> = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ]

  let x = sx
  let y = sy
  let dir = 6 // 向上，保持不透明区域在右侧
  const path: { x: number; y: number }[] = [{ x, y }]

  do {
    let found = false
    for (let i = 0; i < 8; i++) {
      const d = (dir + i) % 8
      const delta = dirs[d]!
      const nx = x + delta[0]
      const ny = y + delta[1]
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && data[(ny * w + nx) * 4 + 3]! > threshold) {
        x = nx
        y = ny
        dir = (d + 5) % 8
        path.push({ x, y })
        found = true
        break
      }
    }
    if (!found) break
    if (path.length > w * h * 2) break
  } while (!(x === sx && y === sy))

  if (path.length <= targetPoints) return path
  const step = path.length / targetPoints
  const sampled: { x: number; y: number }[] = []
  for (let i = 0; i < targetPoints; i++) {
    sampled.push(path[Math.min(path.length - 1, Math.round(i * step))]!)
  }
  return sampled
}

/** 采样图片不透明边缘的平均颜色，用作立体剪纸侧面/底座色调 */
function sampleEdgeColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = Math.max(1, Math.round(64 * (img.height / img.width)))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const w = canvas.width
  const h = canvas.height
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const alpha = data[i + 3]!
      if (alpha < 80) continue
      // 只保留边缘：至少有一个邻居透明
      const neighbors = [
        data[((y - 1) * w + x) * 4 + 3]!,
        data[((y + 1) * w + x) * 4 + 3]!,
        data[(y * w + (x - 1)) * 4 + 3]!,
        data[(y * w + (x + 1)) * 4 + 3]!,
      ]
      if (neighbors.some((a) => a < 80)) {
        r += data[i]!
        g += data[i + 1]!
        b += data[i + 2]!
        n++
      }
    }
  }
  if (n === 0) {
    // 退回到整体平均色
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 80) {
        r += data[i]!
        g += data[i + 1]!
        b += data[i + 2]!
        n++
      }
    }
  }
  if (n === 0) return '#c49a78'
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
}

/**
 * 从去背照片生成「高度图」：主体区域按亮度起伏（亮处更凸），
 * 透明边缘平滑归零，用于让正面网格产生真实的体积起伏（非纸片）。
 * 返回的画布同时保留原始 alpha，便于做 alphaTest 丢弃透明区。
 */
function buildHeightMap(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.width || 512
  const h = img.height || 640
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h).data
  const out = ctx.createImageData(w, h)
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]! / 255
    let height = 0
    if (a > 0.04) {
      const r = src[i]!
      const g = src[i + 1]!
      const b = src[i + 2]!
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const soft = Math.min(1, a * 2.5) // 透明边缘平滑归零，与挤出体边缘衔接
      height = (0.42 + 0.58 * lum) * soft
    }
    const v = Math.round(height * 255)
    out.data[i] = v
    out.data[i + 1] = v
    out.data[i + 2] = v
    out.data[i + 3] = src[i + 3]!
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

/**
 * 给挤出体/盒体几何加「沿厚度方向的明暗顶点色」：
 * 前表面亮、后表面暗，伪造环境光遮蔽（AO）与体积感，避免侧边像纯色塑料片。
 */
function applyThicknessAO(THREE: any, geo: any, hex: string): void {
  const pos = geo.attributes.position
  let zMin = Infinity
  let zMax = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    if (z < zMin) zMin = z
    if (z > zMax) zMax = z
  }
  const ec = new THREE.Color(hex)
  const range = zMax - zMin || 1
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const zn = (pos.getZ(i) - zMin) / range
    const shade = 0.5 + 0.5 * zn // 前=1 亮，后=0 暗
    colors[i * 3] = ec.r * shade
    colors[i * 3 + 1] = ec.g * shade
    colors[i * 3 + 2] = ec.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** 在照片画布上烘焙妆容（blush/eyeshadow/lipgloss 按脸部比例定位） */
function bakeMakeup(ctx: CanvasRenderingContext2D, item: MakeupItem, w: number, h: number): void {
  // 主体已裁剪居中，脸部中心约在照片上方 ~42% 处
  const faceX = w * 0.5
  const faceY = h * 0.42
  const unit = Math.min(w, h)
  ctx.save()
  ctx.globalCompositeOperation = item.blendMode || 'source-over'
  ctx.globalAlpha = item.opacity
  const color = item.color || '#ff9bb3'
  if (item.type === 'blush') {
    const rx = unit * 0.12 * item.scale
    const ry = unit * 0.08 * item.scale
    for (const sx of [-1, 1]) {
      const cx = faceX + sx * w * 0.16
      const cy = faceY + h * 0.04
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
      g.addColorStop(0, hexToRgba(color, 0.9))
      g.addColorStop(1, hexToRgba(color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (item.type === 'eyeshadow') {
    const rx = unit * 0.14 * item.scale
    const ry = unit * 0.06 * item.scale
    const cy = faceY - h * 0.06
    const g = ctx.createRadialGradient(faceX, cy, 0, faceX, cy, rx)
    g.addColorStop(0, hexToRgba(color, 0.85))
    g.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(faceX, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (item.type === 'lipgloss') {
    const rx = unit * 0.07 * item.scale
    const ry = unit * 0.04 * item.scale
    const cy = faceY + h * 0.13
    const g = ctx.createRadialGradient(faceX, cy, 0, faceX, cy, rx)
    g.addColorStop(0, hexToRgba(color, 0.95))
    g.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(faceX, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

interface ViewerState {
  reduceMotion: boolean
}

export class ModelViewer {
  private canvas: HTMLCanvasElement
  private state: ViewerState = { reduceMotion: false }

  // three 相关字段在 init 后才存在，故用可选 + any 以避免静态依赖
  private three: typeof import('three') | null = null
  private scene: any = null
  private camera: any = null
  private renderer: any = null
  private controls: any = null
  private modelGroup: any = null
  private rafId: number | null = null
  private clock: any = null
  private dpr = 1
  private disposed = false

  // 表演状态：由 store 订阅驱动
  private action: PetAction = 'idle'
  private emotion: PetEmotion = 'neutral'
  private sleeping = false
  /** 瞬时动作起点（elapsedTime），用于一次性动画计时 */
  private actionStart = 0
  /** 上次点击时刻（elapsedTime），用于点击脉冲 */
  private tapAt = -10

  // ── 换装 / 化妆状态（由 store 订阅驱动）──
  private wearables: ResolvedWearable[] = []
  private makeup: MakeupItem[] = []
  private wearGroup: any = null
  private mode: 'glb' | 'billboard' | null = null
  private billboardSrc: string | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  async init(): Promise<void> {
    if (this.three) return
    const THREE = await import('three')
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    this.three = THREE
    this.GLTFLoader = GLTFLoader

    const w = this.canvas.clientWidth || 360
    const h = this.canvas.clientHeight || 360
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100)
    this.camera.position.set(0, 0.6, 3.2)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    })
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // 程序化柔和环境的反射，让材质有体积与质感（不依赖任何外部资源）
    try {
      const envCanvas = document.createElement('canvas')
      envCanvas.width = 32
      envCanvas.height = 128
      const ectx = envCanvas.getContext('2d')!
      const grad = ectx.createLinearGradient(0, 0, 0, 128)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.45, '#e3ebf5')
      grad.addColorStop(0.55, '#cfd6e0')
      grad.addColorStop(1, '#7d6f5c')
      ectx.fillStyle = grad
      ectx.fillRect(0, 0, 32, 128)
      const envTex = new THREE.CanvasTexture(envCanvas)
      envTex.mapping = THREE.EquirectangularReflectionMapping
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      pmrem.compileEquirectangularShader()
      const envRT = pmrem.fromEquirectangular(envTex)
      this.scene.environment = envRT.texture
      ;(this.scene as any).environmentIntensity = 0.55
      envTex.dispose()
      pmrem.dispose()
    } catch (e) {
      // 环境贴图生成失败时退回默认光照，不影响主流程
    }

    // 灯光：半球光给与环境色，方向光制造体积感
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9b7b53, 1.0)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(2, 4, 3)
    this.scene.add(dir)
    const fill = new THREE.DirectionalLight(0xffe6c0, 0.45)
    fill.position.set(-3, 1, -2)
    this.scene.add(fill)

    // 轮廓光：从后侧打亮边缘，让浮雕体从背景中分离
    const rim = new THREE.SpotLight(0xcceeff, 1.5)
    rim.position.set(0, 2.2, -2.6)
    rim.lookAt(0, 0.4, 0)
    rim.angle = Math.PI / 4
    rim.penumbra = 0.6
    this.scene.add(rim)

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.autoRotate = !this.state.reduceMotion
    this.controls.autoRotateSpeed = 1.2
    this.controls.enablePan = false
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 6
    this.controls.target.set(0, 0.4, 0)

    this.clock = new THREE.Clock()
    this.loop = this.loop.bind(this)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private GLTFLoader: any = null

  /** 加载 GLB 模型，自动居中并按高度归一化到 ~1.6 单位 */
  async load(url: string): Promise<void> {
    if (!this.three || !this.GLTFLoader) await this.init()
    const loader = new this.GLTFLoader()
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene

    // 计算包围盒以居中并缩放
    const box = new this.three!.Box3().setFromObject(model)
    const size = box.getSize(new this.three!.Vector3())
    const center = box.getCenter(new this.three!.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scale = 1.6 / maxDim
    model.position.sub(center)
    model.scale.setScalar(scale)

    // 替换旧模型
    if (this.modelGroup) this.scene.remove(this.modelGroup)
    this.modelGroup = new this.three!.Group()
    this.modelGroup.add(model)
    this.modelGroup.position.y = 0.4
    this.scene.add(this.modelGroup)
    this.mode = 'glb'
    this.rebuildWearables()
    this.applyGlbMakeup()
  }

  /**
   * 加载「照片 3D」：把一张已去背的照片升级成有厚度的立体剪纸手办。
   *
   * 不再是一张薄纸片，而是根据 alpha 轮廓挤出体积：
   * 正面是原照片贴图，侧面/背面是实色厚度，底部加底座，带轮廓光与软阴影。
   * 手机端无电脑用户也能得到一个像模像样的 3D 形象。
   */
  async loadBillboard(imageUrl: string, makeup: MakeupItem[] = this.makeup): Promise<void> {
    if (!this.three) await this.init()
    const THREE = this.three!

    const img = await loadImageElement(imageUrl)
    const w = img.width || 512
    const h = img.height || 640
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    for (const m of makeup) bakeMakeup(ctx, m, w, h)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const aspect = w / h || 0.8
    const height = 1.6
    const width = Math.max(0.6, height * aspect)

    const group = new THREE.Group()

    // ── 体积感核心：正面按亮度/轮廓做 CPU 位移，形成真实起伏的浮雕 ──
    const contour = traceAlphaContour(img)
    const edgeColor = sampleEdgeColor(img)
    const extrudeDepth = 0.2
    const bevel = 0.03
    const frontZ = extrudeDepth / 2 + bevel + 0.002

    // 高度图（含透明 alpha 以做 discard）
    const heightCanvas = buildHeightMap(img)
    const hctx = heightCanvas.getContext('2d')!
    const hdata = hctx.getImageData(0, 0, heightCanvas.width, heightCanvas.height).data

    let bodyMesh: any
    if (contour.length >= 8) {
      const shape = new THREE.Shape()
      const toX = (px: number) => (px / 128 - 0.5) * width
      const toY = (py: number) => (0.5 - py / (128 * (h / w))) * height
      const first = contour[0]!
      shape.moveTo(toX(first.x), toY(first.y))
      for (let i = 1; i < contour.length; i++) {
        const p = contour[i]!
        shape.lineTo(toX(p.x), toY(p.y))
      }
      shape.closePath()
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeDepth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        steps: 1,
      })
      applyThicknessAO(THREE, geo, edgeColor)
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.04,
      })
      bodyMesh = new THREE.Mesh(geo, mat)
      bodyMesh.position.z = -extrudeDepth / 2 - bevel
    } else {
      // 轮廓提取失败：退回到厚矩形板（仍带厚度明暗渐变）
      const geo = new THREE.BoxGeometry(width, height, extrudeDepth)
      applyThicknessAO(THREE, geo, edgeColor)
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.04,
      })
      bodyMesh = new THREE.Mesh(geo, mat)
      bodyMesh.position.z = -extrudeDepth / 2
    }
    group.add(bodyMesh)

    // ── 正面：细分网格 + CPU 亮度位移，做出有起伏的立体浮雕（非纸片）──
    const segX = Math.min(220, Math.max(80, Math.round(width * 150)))
    const segY = Math.min(260, Math.max(100, Math.round(height * 150)))
    const frontGeo = new THREE.PlaneGeometry(width, height, segX, segY)
    const fpos = frontGeo.attributes.position!
    const fuv = frontGeo.attributes.uv!
    const hw = heightCanvas.width
    const hh = heightCanvas.height
    for (let i = 0; i < fpos.count; i++) {
      const u = fuv.getX(i)
      const v = fuv.getY(i)
      const px = Math.min(hw - 1, Math.max(0, Math.floor(u * (hw - 1))))
      const py = Math.min(hh - 1, Math.max(0, Math.floor((1 - v) * (hh - 1))))
      const li = (py * hw + px) * 4
      const a = hdata[li + 3]! / 255
      const hv = a > 0.04 ? hdata[li]! / 255 : 0
      fpos.setZ(i, hv * 0.17)
    }
    fpos.needsUpdate = true
    frontGeo.computeVertexNormals()
    const frontMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.0,
    })
    const frontMesh = new THREE.Mesh(frontGeo, frontMat)
    frontMesh.position.z = frontZ
    frontMesh.rotation.x = -0.05 // 微微前倾，更像站立
    group.add(frontMesh)

    // ── 背面：同色调实色，受光一致，旋转时不穿帮 ──
    const backGeo = new THREE.PlaneGeometry(width, height)
    const backMat = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.75,
      metalness: 0.03,
      side: THREE.DoubleSide,
    })
    const backMesh = new THREE.Mesh(backGeo, backMat)
    backMesh.position.z = -extrudeDepth / 2 - bevel - 0.002
    backMesh.rotation.y = Math.PI
    group.add(backMesh)

    // ── 底座：让形象站在一个平台上，更像手办 ──
    const pedW = width * 0.9
    const pedH = 0.16
    const pedestalGeo = new THREE.CylinderGeometry(pedW * 0.55, pedW * 0.64, pedH, 40)
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: '#efe6d8',
      roughness: 0.45,
      metalness: 0.02,
    })
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat)
    pedestal.position.y = -height / 2 - pedH / 2 + 0.02
    pedestal.position.z = 0
    group.add(pedestal)

    // 地面投影（扁平黑色圆盘）
    const shadowGeo = new THREE.CircleGeometry(pedW * 0.78, 40)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.16,
    })
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -height / 2 - pedH - 0.01
    group.add(shadow)

    // 整体居中
    group.position.y = 0.4

    if (this.modelGroup) this.scene.remove(this.modelGroup)
    this.modelGroup = group
    this.scene.add(this.modelGroup)
    this.mode = 'billboard'
    this.billboardSrc = imageUrl
    this.rebuildWearables()
  }

  setState(next: Partial<ViewerState>): void {
    this.state = { ...this.state, ...next }
    if (this.controls) this.controls.autoRotate = !this.state.reduceMotion
  }

  /** 设定当前肢体动作；瞬时动作（跳/滚/伸）记录起点由 loop 自动回落 */
  setAction(action: PetAction): void {
    if (action === 'jump' || action === 'roll' || action === 'stretch') {
      this.actionStart = this.clock?.elapsedTime ?? 0
    }
    this.action = action
  }

  setEmotion(emotion: PetEmotion): void {
    this.emotion = emotion
  }

  setSleeping(v: boolean): void {
    this.sleeping = v
    if (v) this.action = 'sleep'
  }

  /** 点击宠物：触发一个短促的缩放脉冲 */
  triggerTap(): void {
    this.tapAt = this.clock?.elapsedTime ?? 0
  }

  /** 设定已穿戴的配饰（emoji 精灵挂到头/颈/身锚点） */
  setWearables(list: ResolvedWearable[]): void {
    this.wearables = list
    this.rebuildWearables()
  }

  /** 设定妆容：照片模式重新烘焙贴图，GLB 模式整体轻微染色近似 */
  setMakeup(list: MakeupItem[]): void {
    this.makeup = list
    if (this.mode === 'billboard' && this.billboardSrc) {
      void this.loadBillboard(this.billboardSrc, list)
    } else if (this.mode === 'glb') {
      this.applyGlbMakeup()
    }
  }

  /** 重建配饰精灵组（在 modelGroup 局部坐标内） */
  private rebuildWearables(): void {
    if (!this.three || !this.modelGroup) return
    const THREE = this.three
    if (this.wearGroup) {
      this.modelGroup.remove(this.wearGroup)
      this.wearGroup.traverse((o: any) => {
        o.material?.map?.dispose?.()
        o.material?.dispose?.()
      })
      this.wearGroup = null
    }
    if (this.wearables.length === 0) return
    this.wearGroup = new THREE.Group()
    for (const w of this.wearables) {
      const tex = makeEmojiTexture(w.asset, THREE)
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      })
      const sprite = new THREE.Sprite(mat)
      const base = WEAR_ANCHOR[w.type] ?? [0, 0.4, 0.04]
      const sz = WEAR_SIZE[w.type] ?? 0.4
      const off = w.offset
      const s = sz * (off?.scale ?? 1)
      sprite.scale.set(s, s, 1)
      sprite.position.set(base[0] + (off?.dx ?? 0), base[1] + (off?.dy ?? 0), base[2])
      sprite.material.rotation = off?.rotation ?? 0
      this.wearGroup.add(sprite)
    }
    this.modelGroup.add(this.wearGroup)
  }

  /** GLB 无面部 landmark，妆容以整体轻微染色近似呈现 */
  private applyGlbMakeup(): void {
    if (!this.modelGroup) return
    this.modelGroup.traverse((o: any) => {
      if (!o.isMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (!m.emissive) continue // MeshBasicMaterial 等无 emissive，跳过
        if (m.userData.__petpalOrigEmissive === undefined) {
          m.userData.__petpalOrigEmissive = m.emissive.getHex()
          m.userData.__petpalOrigEmissiveIntensity = m.emissiveIntensity ?? 1
        }
        if (this.makeup.length === 0) {
          m.emissive.setHex(m.userData.__petpalOrigEmissive)
          m.emissiveIntensity = m.userData.__petpalOrigEmissiveIntensity
          continue
        }
        const item = this.makeup[0]!
        const col = item.color || '#ff9bb3'
        const inten = Math.min(0.4, (item.opacity || 0.5) * 0.4)
        m.emissive.set(col)
        m.emissiveIntensity = inten
      }
    })
  }

  resize(w: number, h: number): void {
    if (!this.three || !this.renderer || !this.camera) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop(): void {
    if (this.disposed) return
    if (this.modelGroup && !this.state.reduceMotion) {
      const t = this.clock.elapsedTime
      const baseY = 0.4

      let y = baseY
      let rotX = 0
      let scale = 1
      let spin = 0

      if (this.sleeping) {
        // 睡觉：压低、歪头、缓慢起伏
        y = 0.26 + Math.sin(t * 0.8) * 0.012
        rotX = 0.5
        scale = 0.96
      } else {
        const a = String(this.action)
        if (a === 'jump') {
          const dt = t - this.actionStart
          const dur = 0.6
          if (dt < dur) y = baseY + Math.sin((dt / dur) * Math.PI) * 0.55
          else this.action = 'idle'
        } else if (a === 'happy' || a === 'cheer' || a === 'wagTail') {
          // 开心：高频弹跳 + 轻微缩放脉动
          y = baseY + Math.abs(Math.sin(t * 6)) * 0.13
          scale = 1 + Math.sin(t * 6) * 0.05
        } else if (a === 'eat') {
          // 低头吃：前后点头
          rotX = Math.sin(t * 4) * 0.18
          y = baseY - 0.03
        } else if (a === 'stretch' || a === 'roll') {
          const dt = t - this.actionStart
          if (dt < 1) rotX = Math.sin(dt * Math.PI) * 0.45
          else this.action = 'idle'
        } else {
          // 待机呼吸
          y = baseY + Math.sin(t * 1.6) * 0.04
          const emo = String(this.emotion)
          if (emo === 'sad') {
            y -= 0.05
            rotX = -0.12
          } else if (emo === 'happy') {
            scale = 1 + Math.sin(t * 2) * 0.03
          } else if (emo === 'angry') {
            rotX = Math.sin(t * 3) * 0.06
          }
        }
      }

      // 点击脉冲：0.4s 内放大回落
      const tapDt = t - this.tapAt
      if (tapDt >= 0 && tapDt < 0.4) {
        scale *= 1 + (1 - tapDt / 0.4) * 0.14
        spin = (1 - tapDt / 0.4) * 0.3
      }

      this.modelGroup.position.y = y
      this.modelGroup.rotation.x = rotX
      this.modelGroup.rotation.y = spin
      this.modelGroup.scale.setScalar(Math.max(0.4, scale))
    }
    this.controls?.update()
    this.renderer?.render(this.scene, this.camera)
    this.rafId = requestAnimationFrame(this.loop)
  }

  dispose(): void {
    this.disposed = true
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.controls?.dispose?.()
    this.renderer?.dispose?.()
    if (this.scene) {
      this.scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.()
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m: any) => m.dispose?.())
        }
      })
    }
    this.modelGroup = null
  }
}
