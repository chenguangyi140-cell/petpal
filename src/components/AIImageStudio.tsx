import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Cloud,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { SkinId, ThreeViewSet } from '@/types'
import { usePetStore } from '@/store/petStore'
import { compressImage, removeBackground } from '@/services/segmentation'
import { getHunyuan3DInfo } from '@/services/cloudService'
import { ThreeViewRenderer } from '@/engine/threeViewRenderer'
import { ModelViewer } from '@/three/modelViewer'
import { SKIN_IDS, getSkin } from '@/skins/registry'

type StudioMode = 'create' | 'edit'
type Step = 'source' | 'method' | 'preview'
type Method = 'cloud' | 'manual'

/** 高质量在线抠图站（无公开 API，作为本地自动抠图的增强入口） */
const KOUKOUTU_URL = 'https://www.koukoutu.com/removebgtool/all'

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

  const [method, setMethod] = useState<Method>('manual')
  const [error, setError] = useState<string | null>(null)
  const [hunyuanInfo, setHunyuanInfo] = useState<{ webUrl: string; steps: string[]; fallbackNote: string } | null>(null)

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

  // 云端生成：Hunyuan3D（跳转网页版手动操作）
  const onRunCloudHunyuan = useCallback(() => {
    setHunyuanInfo(getHunyuan3DInfo())
    setError(null)
    // 不跳转步骤，直接展示引导卡片
  }, [])

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
              error={error}
              onRunCloudHunyuan={onRunCloudHunyuan}
              hunyuanInfo={hunyuanInfo}
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
              setResultGlb={setResultGlb}
              setResultViews={setResultViews}
              setStep={setStep}
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
  error,
  hunyuanInfo,
  onRunCloudHunyuan,
  manFront,
  setManFront,
  manSide,
  setManSide,
  manBack,
  setManBack,
  manGlb,
  setManGlb,
  onUseManual,
  setResultGlb,
  setResultViews,
  setStep,
}: {
  method: Method
  setMethod: (m: Method) => void
  error: string | null
  hunyuanInfo: { webUrl: string; steps: string[]; fallbackNote: string } | null
  onRunCloudHunyuan: () => void
  manFront: string | null
  setManFront: (v: string | null) => void
  manSide: string | null
  setManSide: (v: string | null) => void
  manBack: string | null
  setManBack: (v: string | null) => void
  manGlb: Blob | null
  setManGlb: (v: Blob | null) => void
  onUseManual: () => void
  setResultGlb: (v: Blob | null) => void
  setResultViews: (v: ThreeViewSet | null) => void
  setStep: (v: Step) => void
}) {
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">选择生成方式</h3>
      <p className="mt-1 text-sm text-ink-muted">
        手机端无需电脑：可直接用云端生成，或上传已有的三视图 / GLB 模型。
      </p>

      {/* 云端免费生成（无需 GPU） */}
      <CloudMethodCard
        method={method}
        setMethod={setMethod}
        onRunCloudHunyuan={onRunCloudHunyuan}
        hunyuanInfo={hunyuanInfo}
        onGlbImported={(blob) => {
          setResultGlb(blob)
          setResultViews(null)
          setStep('preview')
        }}
      />

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
            <a
              href={KOUKOUTU_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-sky-300 bg-sky-50 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
            >
              <Sparkles size={14} /> 本地抠图不干净？去 koukoutu 高清抠图 ↗
            </a>
            <p className="text-center text-[10px] text-ink-muted">
              在站内处理后可下载透明 PNG，再上传到上方三视图即可
            </p>
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

// 云端免费生成卡片（无需 GPU）
function CloudMethodCard({
  method,
  setMethod,
  hunyuanInfo,
  onRunCloudHunyuan,
  onGlbImported,
}: {
  method: Method
  setMethod: (m: Method) => void
  hunyuanInfo: { webUrl: string; steps: string[]; fallbackNote: string } | null
  onRunCloudHunyuan: () => void
  onGlbImported: (blob: Blob) => void
}) {
  const selected = method === 'cloud'

  return (
    <div className="mt-3">
      <button
        onClick={() => setMethod('cloud')}
        className={`clay-press w-full rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          selected ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Cloud size={18} className="text-pink-500" /> 云端免费生成（无需 GPU）
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          浏览器直连腾讯 Hunyuan3D，照片不出本机。每天免费 20 次，生成后导入 GLB 即可。
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          {/* Hunyuan3D 网页版 */}
          <div className="rounded-[10px] border-2 border-line bg-surface p-3">
            <div className="flex items-center gap-2 font-bold text-ink">
              <Box size={14} className="text-sky-500" /> Hunyuan3D（腾讯混元 · 网页版）
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              每天免费 20 次，无需账号，质量更高。需手动在网页生成后导入 GLB。
            </p>
            <button
              onClick={onRunCloudHunyuan}
              className="clay-press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-sky-500 py-2.5 font-bold text-white"
            >
              <ArrowRight size={16} /> 查看 Hunyuan3D 使用指引
            </button>

            {hunyuanInfo && (
              <div className="mt-3 space-y-3">
                <div className="rounded-[10px] bg-sky-50 p-3">
                  <a
                    href={hunyuanInfo.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block break-all rounded-[8px] bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    {hunyuanInfo.webUrl} ↗
                  </a>
                  <ol className="mt-2 space-y-1 text-[11px] text-ink">
                    {hunyuanInfo.steps.map((s, i) => (
                      <li key={i}>
                        {i + 1}. {s}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[10px] text-ink-muted">{hunyuanInfo.fallbackNote}</p>
                </div>
                {/* 已下载 GLB 的快捷导入入口 */}
                <GLBDirectImport onGlbLoaded={onGlbImported} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Hunyuan3D 下载完成后的 GLB 直接导入入口 */
function GLBDirectImport({ onGlbLoaded }: { onGlbLoaded: (blob: Blob) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (file: File) => {
    const blob = file
    onGlbLoaded(blob)
  }
  return (
    <div className="rounded-[10px] border-2 border-dashed border-sky-300 bg-sky-50 p-3 text-center">
      <p className="text-[11px] font-semibold text-sky-700 mb-2">已下载 GLB ？点此直接导入</p>
      <button
        onClick={() => ref.current?.click()}
        className="clay-press inline-flex items-center gap-1.5 rounded-[8px] bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"
      >
        <Upload size={14} /> 选择 GLB 文件
      </button>
      <input
        ref={ref}
        type="file"
        accept=".glb,.gltf"
        hidden
        onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
      />
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
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const raw = await fileToDataUrl(file)
      // 先自动扣图，保证三视图背景干净（非纯色背景也能得到透明前景）
      const cut = await removeBackground(raw)
      const cutDataUrl = cut.dataUrl
      // 缩放并保留透明通道（PNG），控制体积的同时不丢失去背结果
      const compressed = await compressImage(cutDataUrl, 1024, 0.92, 'image/png')
      onChange(compressed)
    } catch (err) {
      console.error('自动扣图失败，回退为仅压缩原图:', err)
      // 兜底：扣图异常时不丢图，直接压缩原图
      try {
        const raw = await fileToDataUrl(file)
        onChange(await compressImage(raw, 1024, 0.85))
      } catch (e2) {
        console.error('图片处理失败:', e2)
        onChange(null)
      }
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <button
      onClick={() => ref.current?.click()}
      disabled={busy}
      className="flex flex-col items-center gap-1 rounded-[10px] border-2 border-line bg-surface p-1 disabled:opacity-60"
    >
      <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[8px] bg-canvas">
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : busy ? (
          <Loader2 size={18} className="animate-spin text-ink-muted" />
        ) : (
          <ImagePlus size={18} className="text-ink-muted" />
        )}
      </div>
      <span className="text-[10px] font-bold text-ink-muted">{busy ? '处理中…' : label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
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
