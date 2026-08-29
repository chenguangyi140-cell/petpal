import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ImagePlus,
  Layers,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { SkinId, ThreeViewSet } from '@/types'
import { usePetStore } from '@/store/petStore'
import { compressImage } from '@/services/segmentation'
import {
  AIServiceError,
  generateModel3d,
  generateThreeViews,
  pingBridge,
} from '@/services/aiService'
import { ThreeViewRenderer } from '@/engine/threeViewRenderer'
import { ModelViewer } from '@/three/modelViewer'
import { SKIN_IDS, getSkin } from '@/skins/registry'

type StudioMode = 'create' | 'edit'
type Step = 'source' | 'method' | 'preview'
type Method = 'ai' | 'manual'
type AiOutput = 'threeView' | 'model3d'

interface StudioProps {
  mode: StudioMode
  onClose: () => void
}

export function AIImageStudio({ mode, onClose }: StudioProps) {
  const createProfile = usePetStore((s) => s.createProfile)
  const setThreeViews = usePetStore((s) => s.setThreeViews)
  const setModel3d = usePetStore((s) => s.setModel3d)
  const existingName = usePetStore((s) => s.profile?.name)
  const existingSkin = usePetStore((s) => s.profile?.skin)

  const [step, setStep] = useState<Step>('source')
  const [name, setName] = useState(existingName ?? '')
  const [type, setType] = useState<SkinId>(existingSkin ?? 'pet')
  const [photo, setPhoto] = useState<string | null>(null)

  const [method, setMethod] = useState<Method>('ai')
  const [aiOutput, setAiOutput] = useState<AiOutput>('threeView')
  const [generating, setGenerating] = useState(false)
  const [aiOnline, setAiOnline] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 手动模式资产
  const [manFront, setManFront] = useState<string | null>(null)
  const [manSide, setManSide] = useState<string | null>(null)
  const [manBack, setManBack] = useState<string | null>(null)
  const [manGlb, setManGlb] = useState<Blob | null>(null)

  // 生成/预览结果
  const [resultViews, setResultViews] = useState<ThreeViewSet | null>(null)
  const [resultGlb, setResultGlb] = useState<Blob | null>(null)

  const onPickPhoto = useCallback(async (file: File) => {
    const raw = await fileToDataUrl(file)
    const compressed = await compressImage(raw, 1024, 0.9)
    setPhoto(compressed)
  }, [])

  const checkBridge = useCallback(async () => {
    setAiOnline(await pingBridge())
  }, [])

  useEffect(() => {
    if (method === 'ai') void checkBridge()
  }, [method, checkBridge])

  const runAi = useCallback(async () => {
    if (!photo) return
    setGenerating(true)
    setError(null)
    try {
      if (aiOutput === 'threeView') {
        const views = await generateThreeViews(photo, type)
        setResultViews(views)
        setResultGlb(null)
      } else {
        const blob = await generateModel3d(photo, type)
        setResultGlb(blob)
        setResultViews(null)
      }
      setStep('preview')
    } catch (e) {
      setError(e instanceof AIServiceError ? e.message : '生成失败，请重试。')
    } finally {
      setGenerating(false)
    }
  }, [photo, aiOutput, type])

  const useManual = useCallback(() => {
    setError(null)
    if (manGlb) {
      setResultGlb(manGlb)
      setResultViews(null)
    } else if (manFront || manSide || manBack) {
      setResultViews({ front: manFront, side: manSide, back: manBack })
      setResultGlb(null)
    } else {
      setError('请至少上传一张图片，或选择一个 GLB 模型。')
      return
    }
    setStep('preview')
  }, [manGlb, manFront, manSide, manBack])

  const save = useCallback(async () => {
    const finalName = name.trim() || (type === 'human' ? '我的伙伴' : '我的宠物')
    if (mode === 'create') createProfile(finalName, type)
    if (resultViews) await setThreeViews(resultViews)
    else if (resultGlb) await setModel3d(resultGlb)
    onClose()
  }, [name, type, mode, createProfile, resultViews, resultGlb, setThreeViews, setModel3d, onClose])

  const hasResult = Boolean(resultViews || resultGlb)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] bg-canvas shadow-[var(--shadow-clay)]">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-heading text-lg text-primary">AI 形象工坊</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-muted hover:bg-surface">
            <X size={20} />
          </button>
        </div>

        {/* 进度 */}
        <div className="flex items-center justify-center gap-2 px-5 py-3">
          {(['source', 'method', 'preview'] as const).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-all duration-300 ${
                step === s ? 'bg-candy' : i < (['source', 'method', 'preview'].indexOf(step)) ? 'bg-candy/40' : 'bg-line'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {step === 'source' && (
            <SourceStep
              name={name}
              setName={setName}
              type={type}
              setType={setType}
              photo={photo}
              onPickPhoto={onPickPhoto}
              showName={mode === 'create'}
            />
          )}

          {step === 'method' && (
            <MethodStep
              method={method}
              setMethod={setMethod}
              aiOutput={aiOutput}
              setAiOutput={setAiOutput}
              aiOnline={aiOnline}
              generating={generating}
              error={error}
              photo={photo}
              onRunAi={runAi}
              // 手动资产
              manFront={manFront}
              setManFront={setManFront}
              manSide={manSide}
              setManSide={setManSide}
              manBack={manBack}
              setManBack={setManBack}
              manGlb={manGlb}
              setManGlb={setManGlb}
              onUseManual={useManual}
            />
          )}

          {step === 'preview' && hasResult && (
            <PreviewStep views={resultViews} glb={resultGlb} />
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex gap-3 border-t border-line px-5 py-4">
          {step !== 'source' && (
            <button
              onClick={() => setStep(step === 'preview' ? 'method' : 'source')}
              className="clay-press flex items-center gap-1 rounded-[var(--radius-clay)] bg-surface px-5 py-3 font-bold text-ink shadow-[var(--shadow-clay-sm)]"
            >
              <ArrowLeft size={18} /> 返回
            </button>
          )}
          {step === 'source' && (
            <button
              onClick={() => setStep('method')}
              disabled={!photo}
              className="clay-press flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-clay)] bg-candy py-3 font-heading font-bold text-white shadow-[var(--shadow-clay)] disabled:opacity-50"
            >
              下一步 <ArrowRight size={18} />
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={save}
              className="clay-press flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-clay)] bg-candy py-3 font-heading font-bold text-white shadow-[var(--shadow-clay)]"
            >
              <Sparkles size={18} /> 保存为我的{type === 'human' ? '伙伴' : '宠物'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 子步骤 ────────────────────────────────────────────────

function SourceStep({
  name,
  setName,
  type,
  setType,
  photo,
  onPickPhoto,
  showName,
}: {
  name: string
  setName: (v: string) => void
  type: SkinId
  setType: (v: SkinId) => void
  photo: string | null
  onPickPhoto: (f: File) => void
  showName: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">上传一张照片</h3>
      <p className="mt-1 text-sm text-ink-muted">
        一张清晰的全身照最佳。AI 会自动生成前/侧/后三视图或直接生成立体模型。
      </p>

      {showName && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给 TA 起个名字"
          maxLength={12}
          className="mt-6 w-full rounded-[var(--radius-clay-sm)] border-2 border-line bg-surface px-4 py-3 text-center text-lg font-bold text-ink outline-none transition-colors focus:border-candy"
        />
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {SKIN_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setType(id)}
            className={`clay-press rounded-[var(--radius-clay-sm)] border-2 py-3 text-sm font-bold transition-all duration-200 ${
              type === id ? 'border-candy bg-candy-soft text-pink-600' : 'border-line bg-surface text-ink-muted'
            }`}
          >
            {getSkin(id).displayName}
          </button>
        ))}
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        className="clay-press mt-6 flex h-56 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-clay)] border-2 border-dashed border-pink-300 bg-gradient-to-b from-sky-100 to-amber-100"
      >
        {photo ? (
          <img src={photo} alt="预览" className="max-h-48 max-w-full object-contain drop-shadow-lg" />
        ) : (
          <>
            <ImagePlus size={36} className="text-pink-400" />
            <span className="text-sm font-bold text-ink-muted">点击上传照片</span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && void onPickPhoto(e.target.files[0])}
      />
    </div>
  )
}

function MethodStep({
  method,
  setMethod,
  aiOutput,
  setAiOutput,
  aiOnline,
  generating,
  error,
  photo,
  onRunAi,
  manFront,
  setManFront,
  manSide,
  setManSide,
  manBack,
  setManBack,
  manGlb,
  setManGlb,
  onUseManual,
}: {
  method: Method
  setMethod: (m: Method) => void
  aiOutput: AiOutput
  setAiOutput: (o: AiOutput) => void
  aiOnline: boolean | null
  generating: boolean
  error: string | null
  photo: string | null
  onRunAi: () => void
  manFront: string | null
  setManFront: (v: string | null) => void
  manSide: string | null
  setManSide: (v: string | null) => void
  manBack: string | null
  setManBack: (v: string | null) => void
  manGlb: Blob | null
  setManGlb: (v: Blob | null) => void
  onUseManual: () => void
}) {
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">选择生成方式</h3>
      <p className="mt-1 text-sm text-ink-muted">自动模式需本机运行 ComfyUI + 桥接；手动模式零依赖、立即可用。</p>

      {/* AI 自动 */}
      <button
        onClick={() => setMethod('ai')}
        className={`clay-press mt-5 rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          method === 'ai' ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Sparkles size={18} className="text-pink-500" /> AI 自动生成（本机 ComfyUI）
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          上传 1 张照片，本机 AI 自动产出三视图或立体模型，照片不出本机。
        </p>
        {method === 'ai' && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAiOutput('threeView')}
                className={`clay-press rounded-[10px] border py-2 text-xs font-bold ${
                  aiOutput === 'threeView' ? 'border-candy bg-surface text-pink-600' : 'border-line text-ink-muted'
                }`}
              >
                <Layers size={14} className="mr-1 inline" /> 三视图转盘
              </button>
              <button
                onClick={() => setAiOutput('model3d')}
                className={`clay-press rounded-[10px] border py-2 text-xs font-bold ${
                  aiOutput === 'model3d' ? 'border-candy bg-surface text-pink-600' : 'border-line text-ink-muted'
                }`}
              >
                <Box size={14} className="mr-1 inline" /> 真·3D 模型
              </button>
            </div>

            {aiOnline === false && (
              <p className="mt-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                未检测到本机 AI 服务。请先运行 tools/bridge/server.mjs 并启动 ComfyUI，或在设置中填写地址。也可改用下方「手动上传」。
              </p>
            )}

            <button
              onClick={onRunAi}
              disabled={!photo || generating}
              className="clay-press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-candy py-2.5 font-bold text-white disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'AI 生成中…（可能需数十秒）' : '开始生成'}
            </button>
          </div>
        )}
      </button>

      {/* 手动上传 */}
      <button
        onClick={() => setMethod('manual')}
        className={`clay-press mt-3 rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          method === 'manual' ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Upload size={18} className="text-pink-500" /> 手动上传前/侧/后 或 3D 模型
        </div>
        <p className="mt-1 text-xs text-ink-muted">无需任何 AI 服务，直接上传你已有的三视图图片或 GLB 模型。</p>

        {method === 'manual' && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniUpload label="正面" value={manFront} onChange={setManFront} />
              <MiniUpload label="侧面" value={manSide} onChange={setManSide} />
              <MiniUpload label="背面" value={manBack} onChange={setManBack} />
            </div>
            <div>
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-pink-300 bg-surface py-3 text-xs font-bold text-ink-muted">
                <Box size={18} className="text-pink-400" />
                {manGlb ? `已选模型：${(manGlb.size / 1024 / 1024).toFixed(1)} MB` : '或上传 GLB 3D 模型'}
                <input
                  type="file"
                  accept=".glb,.gltf"
                  hidden
                  onChange={(e) => e.target.files?.[0] && setManGlb(e.target.files[0])}
                />
              </label>
            </div>
            <button
              onClick={onUseManual}
              className="clay-press flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-candy py-2.5 font-bold text-white"
            >
              <ArrowRight size={16} /> 预览
            </button>
          </div>
        )}
      </button>

      {error && (
        <p className="mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>
      )}
    </div>
  )
}

function MiniUpload({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <button
      onClick={() => ref.current?.click()}
      className="flex flex-col items-center gap-1 rounded-[10px] border-2 border-line bg-surface p-1"
    >
      <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[8px] bg-canvas">
        {value ? <img src={value} alt={label} className="h-full w-full object-contain" /> : <ImagePlus size={18} className="text-ink-muted" />}
      </div>
      <span className="text-[10px] font-bold text-ink-muted">{label}</span>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) onChange(await fileToDataUrl(f))
        }}
      />
    </button>
  )
}

function PreviewStep({ views, glb }: { views: ThreeViewSet | null; glb: Blob | null }) {
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">预览动态形象</h3>
      <p className="mt-1 text-sm text-ink-muted">拖拽可旋转。满意后点下方「保存」。</p>
      <div className="mt-4 overflow-hidden rounded-[var(--radius-clay)] bg-gradient-to-b from-sky-100 to-amber-100">
        {views ? <ThreeViewPreview views={views} /> : glb ? <Model3DPreview blob={glb} /> : null}
      </div>
    </div>
  )
}

function ThreeViewPreview({ views }: { views: ThreeViewSet }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const r = new ThreeViewRenderer(canvas)
    const size = Math.max(200, Math.min(parent.clientWidth, parent.clientHeight || 360))
    r.resize(size, size)
    r.start()
    void r.setViewDataUrls(views)
    return () => r.destroy()
  }, [views])
  return <canvas ref={ref} className="h-[360px] w-full cursor-grab touch-none" />
}

function Model3DPreview({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    let cancelled = false
    const v = new ModelViewer(canvas)
    const apply = () => {
      const rect = parent.getBoundingClientRect()
      const s = Math.max(200, Math.min(rect.width, rect.height || 360))
      v.resize(s, s)
    }
    const url = URL.createObjectURL(blob)
    v.init()
      .then(() => {
        if (cancelled) return
        apply()
        return v.load(url)
      })
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('error'))
    const ro = new ResizeObserver(apply)
    ro.observe(parent)
    return () => {
      cancelled = true
      ro.disconnect()
      v.dispose()
      URL.revokeObjectURL(url)
    }
  }, [blob])
  return (
    <div className="relative h-[360px] w-full">
      <canvas ref={ref} className="h-full w-full cursor-grab touch-none" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">
          <Loader2 size={20} className="animate-spin" /> 正在加载 3D 模型…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-cta">
          3D 模型加载失败，请确认文件有效。
        </div>
      )}
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
