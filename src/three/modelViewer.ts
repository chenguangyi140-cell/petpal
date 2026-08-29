/**
 * 真·3D 模型查看器（three.js）
 *
 * 动态 import 'three'，避免拖入主包；仅在用户真正使用 3D 模型时才加载。
 * 加载本机 ComfyUI 生成的 GLB，渲染可自由拖拽旋转、带待机浮动的动态 3D 形象。
 */

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

  setState(next: Partial<ViewerState>): void {
    this.state = { ...this.state, ...next }
    if (this.controls) this.controls.autoRotate = !this.state.reduceMotion
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
      // 待机浮动：轻微上下呼吸
      this.modelGroup.position.y = 0.4 + Math.sin(this.clock.elapsedTime * 1.6) * 0.04
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
