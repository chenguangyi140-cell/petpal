/**
 * 真·3D 模型查看器（three.js）
 *
 * 动态 import 'three'，避免拖入主包；仅在用户真正使用 3D 模型时才加载。
 * 加载本机 ComfyUI 生成的 GLB，渲染可自由拖拽旋转、带待机浮动的动态 3D 形象。
 *
 * 动作系统：订阅 store 的 action / emotion / sleep / tap，对无骨骼的 GLB 做
 * 伪 3D 表演（呼吸、跳跃、低头吃、睡觉歪头、开心弹跳、点击脉冲），让模型「活」起来。
 */
import type { PetAction, PetEmotion } from '@/types'

// 注：服装/化妆精灵挂点（WEAR_POS / MAKEUP_POS 等）将在 P3「换装/化妆作用于 GLB」
// 阶段接入，届时由 setWearables/setMakeup 驱动 three.js 精灵挂载。

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

    // 灯光：半球光给与环境色，方向光制造体积感
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9b7b53, 1.1)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(2, 4, 3)
    this.scene.add(dir)
    const fill = new THREE.DirectionalLight(0xffe6c0, 0.5)
    fill.position.set(-3, 1, -2)
    this.scene.add(fill)

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
  }

  /**
   * 加载「照片 3D」：把一张（已去背的）照片渲染成可旋转的 3D 平面形象。
   *
   * 用于手机端无电脑用户：无需混元 3D / 桌面，本地 three.js 即可获得一个
   * 会呼吸、会跳、会吃、会睡的「2.5D」宠物。后续导入 GLB 时由 load() 替换。
   */
  async loadBillboard(imageUrl: string): Promise<void> {
    if (!this.three) await this.init()
    const THREE = this.three!

    const tex = await new THREE.TextureLoader().loadAsync(imageUrl)
    tex.colorSpace = THREE.SRGBColorSpace
    const img = tex.image as { width?: number; height?: number } | undefined
    const aspect = img && img.width && img.height ? img.width / img.height : 0.8
    const height = 1.6
    const width = Math.max(0.6, height * aspect)

    const geo = new THREE.PlaneGeometry(width, height)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    // 轻微前倾，更像站立而非贴墙
    mesh.rotation.x = -0.05

    if (this.modelGroup) this.scene.remove(this.modelGroup)
    this.modelGroup = new THREE.Group()
    this.modelGroup.add(mesh)
    this.modelGroup.position.y = 0.4
    this.scene.add(this.modelGroup)
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
