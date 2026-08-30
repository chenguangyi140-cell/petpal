import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Cloud,
  ExternalLink,
  Film,
  ImagePlus,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react'
import type { SkinId, ThreeViewSet } from '@/types'
import { usePetStore } from '@/store/petStore'
import { compressImage, removeBackground, trimTransparent } from '@/services/segmentation'
import { getHunyuan3DInfo } from '@/services/cloudService'
import { ThreeViewRenderer } from '@/engine/threeViewRenderer'
import { ModelViewer } from '@/three/modelViewer'
import { SKIN_IDS, getSkin } from '@/skins/registry'

type StudioMode = 'create' | 'edit'
type Step = 'source' | 'method' | 'preview'
type Method = 'photo3d' | 'real3d' | 'video' | 'manual'

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
  const setPetVideo = usePetStore((s) => s.setPetVideo)
  const existingName = usePetStore((s) => s.profile?.name)
  const existingSkin = usePetStore((s) => s.profile?.skin)

  const [step, setStep] = useState<Step>('source')
  const [name, setName] = useState(existingName ?? '')
  const [type, setType] = useState<SkinId>(existingSkin ?? 'pet')
  const [photo, setPhoto] = useState<string | null>(null)

  const [method, setMethod] = useState<Method>('photo3d')
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
  const [resultVideo, setResultVideo] = useState<Blob | null>(null)
  const [resultVideoName, setResultVideoName] = useState<string | null>(null)

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
    else if (resultVideo) await setPetVideo(resultVideo, resultVideoName)
    onClose()
  }, [name, type, mode, createProfile, resultViews, resultGlb, resultVideo, resultVideoName, setThreeViews, setModel3d, setPetVideo, onClose])

  const hasResult = Boolean(resultViews || resultGlb || resultVideo)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] bg-canvas shadow-[var(--shadow-clay)]">
        {/* 头部：始终可见的返回入口，避免用户找不到退出 */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-ink-muted hover:bg-surface"
          >
            <ArrowLeft size={18} /> 返回
          </button>
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
              photo={photo}
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
              setResultVideo={setResultVideo}
              setResultVideoName={setResultVideoName}
              setStep={setStep}
            />
          )}

          {step === 'preview' && hasResult && (
            <PreviewStep views={resultViews} glb={resultGlb} video={resultVideo} videoName={resultVideoName} />
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
              className="clay-press flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-clay)] bg-candy py-3 font-heading font-bold text-white shadow-[var(--shadow-clay)]"
            >
              {photo ? '下一步' : '跳过，下一步'} <ArrowRight size={18} />
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
      <h3 className="font-heading text-xl text-primary">选择形象</h3>
      <p className="mt-1 text-sm text-ink-muted">
        上传一张照片即可一键生成本地立体 3D 形象；想更逼真可去 Tripo AI / Meshy 生成真 3D 模型再导入。
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
            <span className="text-sm font-bold text-ink-muted">点击上传参考照片（可选）</span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
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
  photo,
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
  setResultVideo,
  setResultVideoName,
  setStep,
}: {
  method: Method
  setMethod: (m: Method) => void
  error: string | null
  photo: string | null
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
  setResultVideo: (v: Blob | null) => void
  setResultVideoName: (v: string | null) => void
  setStep: (v: Step) => void
}) {
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">选择生成方式</h3>
      <p className="mt-1 text-sm text-ink-muted">
        手机端首选「本地立体照片 3D」；想要真 3D 模型再去 Tripo AI / Meshy，混元只适合电脑端。
      </p>

      {/* 1. 本地立体照片 3D（手机端默认推荐） */}
      <Photo3DMethodCard
        method={method}
        setMethod={setMethod}
        photo={photo}
        onResult={(front) => {
          setResultViews({ front, side: null, back: null })
          setResultGlb(null)
          setResultVideo(null)
          setStep('preview')
        }}
      />

      {/* 2. 真 3D 模型：Tripo AI / Meshy / Hunyuan（电脑端） */}
      <Real3DMethodCard
        method={method}
        setMethod={setMethod}
        onRunCloudHunyuan={onRunCloudHunyuan}
        hunyuanInfo={hunyuanInfo}
        onGlbImported={(blob) => {
          setResultGlb(blob)
          setResultViews(null)
          setResultVideo(null)
          setStep('preview')
        }}
      />

      {/* 3. 宠物短片（即梦生成，手动回流） */}
      <PetVideoMethodCard
        method={method}
        setMethod={setMethod}
        setResultVideo={setResultVideo}
        setResultVideoName={setResultVideoName}
        setStep={setStep}
      />

      {/* 4. 手动上传（高级 / 已有素材） */}
      <ManualMethodCard
        method={method}
        setMethod={setMethod}
        manFront={manFront}
        setManFront={setManFront}
        manSide={manSide}
        setManSide={setManSide}
        manBack={manBack}
        setManBack={setManBack}
        manGlb={manGlb}
        setManGlb={setManGlb}
        onUseManual={onUseManual}
      />

      {error && (
        <p className="mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>
      )}
    </div>
  )
}

/** 本地立体照片 3D：从当前照片一键生成，手机端默认推荐 */
function Photo3DMethodCard({
  method,
  setMethod,
  photo,
  onResult,
}: {
  method: Method
  setMethod: (m: Method) => void
  photo: string | null
  onResult: (front: string) => void
}) {
  const selected = method === 'photo3d'
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    if (!photo) return
    setBusy(true)
    try {
      // 先自动扣图 → 裁透明边 → 压成 PNG，保证背景干净、主体居中
      const cut = await removeBackground(photo)
      const trimmed = await trimTransparent(cut.dataUrl, 16)
      const compressed = await compressImage(trimmed, 1024, 0.92, 'image/png')
      onResult(compressed)
    } catch (err) {
      console.error('立体照片 3D 处理失败:', err)
      // 兜底：直接拿原照
      onResult(photo)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setMethod('photo3d')}
        className={`clay-press w-full rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          selected ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Sparkles size={18} className="text-pink-500" /> 本地立体照片 3D（推荐）
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          一键把照片变成立体手办：自动扣图、挤出厚度、加底座和轮廓光，手机上直接可用。
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          {photo ? (
            <div className="flex flex-col items-center gap-2 rounded-[10px] border-2 border-line bg-surface p-3">
              <img src={photo} alt="参考照片" className="max-h-40 rounded-[8px] object-contain shadow-sm" />
              <button
                onClick={() => void generate()}
                disabled={busy}
                className="clay-press flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-candy py-2.5 font-bold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                {busy ? '正在处理…' : '一键生成立体 3D 形象'}
              </button>
            </div>
          ) : (
            <div className="rounded-[10px] border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center">
              <p className="text-xs font-semibold text-amber-700">还没有照片</p>
              <p className="mt-1 text-[11px] text-amber-600">请返回上一步上传参考照片，或选手动上传 / 真 3D 模型。</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 真 3D 模型入口：Tripo AI（首推）/ Meshy / Hunyuan3D（电脑端） */
function Real3DMethodCard({
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
  const selected = method === 'real3d'

  return (
    <div className="mt-3">
      <button
        onClick={() => setMethod('real3d')}
        className={`clay-press w-full rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          selected ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Box size={18} className="text-pink-500" /> 真 3D 模型（Tripo / Meshy）
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          想要 360° 可旋转的真 3D，推荐 Tripo AI；手机端也有 App，生成后导入 GLB。
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          {/* 首推：Tripo AI */}
          <div className="rounded-[10px] border-2 border-candy bg-candy-soft/40 p-3">
            <div className="flex items-center gap-2 font-bold text-ink">
              <Star size={14} className="text-candy" /> Tripo AI（首推 · 手机可用）
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              免费 300 积分/月，生成快（10–60 秒），支持图生 3D，可导出 GLB。有 Android / iOS App，手机体验最好。
            </p>
            <a
              href="https://www.tripo3d.ai"
              target="_blank"
              rel="noreferrer"
              className="clay-press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 font-bold text-white"
            >
              打开 Tripo AI 生成 3D ↗ <ExternalLink size={14} />
            </a>
            <ol className="mt-2 space-y-1 text-[11px] text-ink">
              <li>1. 点上方按钮进入 Tripo，选「Image to 3D」上传宠物照片</li>
              <li>2. 生成后下载 GLB 模型，回到这里点下方「导入 GLB」</li>
            </ol>
          </div>

          {/* 备选：Meshy */}
          <div className="rounded-[10px] border-2 border-line bg-surface p-3">
            <div className="flex items-center gap-2 font-bold text-ink">
              <Cloud size={14} className="text-sky-500" /> Meshy（备选）
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              免费 100 积分/月（约 5 次完整生成），支持图生 3D 和多种导出格式。
            </p>
            <a
              href="https://www.meshy.ai"
              target="_blank"
              rel="noreferrer"
              className="clay-press mt-2 inline-flex items-center gap-1.5 rounded-[8px] bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              打开 Meshy ↗ <ExternalLink size={14} />
            </a>
          </div>

          {/* 电脑端：Hunyuan3D（折叠，标注手机难用） */}
          <details className="rounded-[10px] border border-dashed border-ink-muted/30 bg-surface p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-muted">
              <Monitor size={14} /> 腾讯 Hunyuan3D（电脑端专用，手机端布局难用）
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-ink-muted">
                每天免费 20 次，质量稳定，但手机端操作区被压得很小（如你截图所示），建议用电脑浏览器打开。
              </p>
              <button
                onClick={onRunCloudHunyuan}
                className="clay-press flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-sky-500 py-2 font-bold text-white"
              >
                <ArrowRight size={16} /> 查看 Hunyuan3D 使用指引
              </button>

              {hunyuanInfo && (
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
              )}
            </div>
          </details>

          {/* 已下载 GLB 的快捷导入入口 */}
          <GLBDirectImport onGlbLoaded={onGlbImported} />
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

/** 手动上传：已有前/侧/后三视图或 GLB 模型时直接导入 */
function ManualMethodCard({
  method,
  setMethod,
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
  const selected = method === 'manual'
  return (
    <div className="mt-3">
      <button
        onClick={() => setMethod('manual')}
        className={`clay-press w-full rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          selected ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Upload size={18} className="text-pink-500" /> 手动上传（高级）
        </div>
        <p className="mt-1 text-xs text-ink-muted">直接上传你已有的前/侧/后三视图图片，或 GLB / GLTF 模型。</p>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          <a
            href={KOUKOUTU_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-sky-300 bg-sky-50 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
          >
            <Sparkles size={14} /> 本地抠图不干净？去 koukoutu 高清抠图 ↗
          </a>
          <p className="text-center text-[10px] text-ink-muted">在站内处理后可下载透明 PNG，再上传到上方三视图即可</p>
          <div className="grid grid-cols-3 gap-2">
            <MiniUpload label="正面" value={manFront} onChange={setManFront} />
            <MiniUpload label="侧面" value={manSide} onChange={setManSide} />
            <MiniUpload label="背面" value={manBack} onChange={setManBack} />
          </div>
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-pink-300 bg-surface py-3 text-xs font-bold text-ink-muted">
              <Box size={18} className="text-pink-400" />
              {manGlb ? `已选模型：${(manGlb.size / 1024 / 1024).toFixed(1)} MB` : '或上传 GLB / GLTF 3D 模型'}
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
    </div>
  )
}

/** 宠物短片（即梦生成，手动回流）：引导用户去即梦生成视频，再上传当动态形象 */
function PetVideoMethodCard({
  method,
  setMethod,
  setResultVideo,
  setResultVideoName,
  setStep,
}: {
  method: Method
  setMethod: (m: Method) => void
  setResultVideo: (v: Blob | null) => void
  setResultVideoName: (v: string | null) => void
  setStep: (v: Step) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ blob: Blob; name: string; url: string } | null>(null)
  const setPetVideo = usePetStore((s) => s.setPetVideo)
  const currentName = usePetStore((s) => s.profile?.petVideoName)
  const hasCurrent = usePetStore((s) => s.profile?.hasPetVideo)
  const selected = method === 'video'

  const handleFile = (file: File) => {
    setPending({ blob: file, name: file.name, url: URL.createObjectURL(file) })
  }

  const goPreview = () => {
    if (!pending) return
    setResultVideo(pending.blob)
    setResultVideoName(pending.name)
    setStep('preview')
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setMethod('video')}
        className={`clay-press w-full rounded-[var(--radius-clay)] border-2 p-4 text-left transition-all ${
          selected ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-ink">
          <Film size={18} className="text-pink-500" /> 宠物短片 · 即梦 AI 视频
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          用即梦生成会动、会说话的宠物视频，上传回来当动态形象。每天免费积分，无需 API。
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          <div className="rounded-[10px] border-2 border-line bg-surface p-3">
            <a
              href="https://jimeng.jianying.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-1.5 text-xs font-bold text-white"
            >
              打开即梦 AI 生成视频 ↗ <ExternalLink size={13} />
            </a>
            <ol className="mt-2 space-y-1 text-[11px] text-ink">
              <li>1. 进入「AI 视频」→「图生视频」，上传宠物照片</li>
              <li>2. 想要会说话：用「故事模式」开启口型同步 + 配音</li>
              <li>3. 生成后下载视频（mp4 / webm），回到这里上传</li>
            </ol>
            <p className="mt-2 text-[10px] text-ink-muted">
              即梦的「3D」是白模渲染成视频（需先有 3D 模型）；这里我们用它的强项——视频，做会动的宠物。
            </p>
          </div>

          {hasCurrent && (
            <button
              onClick={() => void setPetVideo(null)}
              className="clay-press flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-600"
            >
              移除当前短片（{currentName ?? '视频'}），换回 3D / 平面
            </button>
          )}

          <div className="rounded-[10px] border-2 border-dashed border-pink-300 bg-surface p-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
            {pending ? (
              <div className="flex flex-col items-center gap-2">
                <video src={pending.url} className="max-h-40 rounded-[8px]" muted controls />
                <span className="text-[11px] font-semibold text-ink">{pending.name}</span>
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => setPending(null)}
                    className="clay-press flex-1 rounded-[8px] bg-surface py-1.5 text-xs font-bold text-ink-muted"
                  >
                    重选
                  </button>
                  <button
                    onClick={goPreview}
                    className="clay-press flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-candy py-1.5 text-xs font-bold text-white"
                  >
                    <ArrowRight size={14} /> 预览
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1 py-3 text-xs font-bold text-ink-muted"
              >
                <Film size={20} className="text-pink-400" />
                选择宠物视频（mp4 / webm）
              </button>
            )}
          </div>
        </div>
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
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const raw = await fileToDataUrl(file)
      // 先自动扣图，保证三视图背景干净（非纯色背景也能得到透明前景）
      const cut = await removeBackground(raw)
      // 裁切透明边框：手机拍照主体常在画面一角，contain 缩放后显得极小
      const trimmed = await trimTransparent(cut.dataUrl, 16)
      // 缩放并保留透明通道（PNG），控制体积的同时不丢失去背结果
      const compressed = await compressImage(trimmed, 1024, 0.92, 'image/png')
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
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />
    </button>
  )
}

function PreviewStep({
  views,
  glb,
  video,
  videoName,
}: {
  views: ThreeViewSet | null
  glb: Blob | null
  video: Blob | null
  videoName: string | null
}) {
  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-xl text-primary">预览动态形象</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {video ? '即梦生成的宠物短片，点下方「保存」设为动态形象。' : '拖拽可旋转。满意后点下方「保存」。'}
      </p>
      <div className="mt-4 overflow-hidden rounded-[var(--radius-clay)] bg-gradient-to-b from-sky-100 to-amber-100">
        {video ? (
          <VideoPreview blob={video} name={videoName} />
        ) : views ? (
          <ThreeViewPreview views={views} />
        ) : glb ? (
          <Model3DPreview blob={glb} />
        ) : null}
      </div>
    </div>
  )
}

function VideoPreview({ blob, name }: { blob: Blob; name: string | null }) {
  const [url] = useState(() => URL.createObjectURL(blob))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="flex flex-col items-center gap-2 p-3">
      <video
        src={url}
        className="max-h-[320px] w-full rounded-[10px] object-contain shadow-[var(--shadow-clay-sm)]"
        autoPlay
        loop
        muted
        controls
      />
      <span className="text-[11px] font-semibold text-ink-muted">{name ?? '宠物短片'}</span>
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
