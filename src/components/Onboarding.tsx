import { useCallback, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  PawPrint,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react'
import type { PetAnchors, PetSpecies, SkinId } from '@/types'
import { usePetStore } from '@/store/petStore'
import { compressImage, removeBackground } from '@/services/segmentation'
import { getSkin, SKIN_IDS } from '@/skins/registry'

type Step = 'info' | 'photo' | 'anchor'

interface Adjust {
  bodyDx: number
  bodyDy: number
  bodyScale: number
  headDy: number
}

const NO_ADJUST: Adjust = { bodyDx: 0, bodyDy: 0, bodyScale: 1, headDy: 0 }

/**
 * 应用用户微调偏移（整体平移 + 身体缩放，面部随身体平移保持比例）
 * 与具体形象类型无关，通用逻辑。
 */
function applyAdjust(base: PetAnchors, a: Adjust): PetAnchors {
  const { bodyBox, headBox } = base
  const cx = bodyBox.x + bodyBox.width / 2
  const cy = bodyBox.y + bodyBox.height / 2
  const nw = bodyBox.width * a.bodyScale
  const nh = bodyBox.height * a.bodyScale
  const shifted = (p: { x: number; y: number }) => ({
    x: p.x + a.bodyDx,
    y: p.y + a.bodyDy,
  })

  return {
    bodyBox: { x: cx - nw / 2, y: cy - nh / 2, width: nw, height: nh },
    headBox: { x: headBox.x + a.bodyDx, y: headBox.y + a.bodyDy + a.headDy, width: headBox.width, height: headBox.height },
    leftEye: shifted(base.leftEye),
    rightEye: shifted(base.rightEye),
    mouth: shifted(base.mouth),
    nose: shifted(base.nose),
    tailRoot: base.tailRoot ? shifted(base.tailRoot) : null,
  }
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [skinId, setSkinId] = useState<SkinId>('pet')
  const [species, setSpecies] = useState<PetSpecies>('cat')

  const [processing, setProcessing] = useState(false)
  const [original, setOriginal] = useState<string | null>(null)
  const [cutout, setCutout] = useState<string | null>(null)
  const [tolerance, setTolerance] = useState(42)
  const [bgRatio, setBgRatio] = useState<number | null>(null)

  const skin = getSkin(skinId)
  const [baseAnchors, setBaseAnchors] = useState<PetAnchors>(skin.defaultAnchors)
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST)

  const fileRef = useRef<HTMLInputElement>(null)
  const createProfile = usePetStore((s) => s.createProfile)
  const setCutoutStore = usePetStore((s) => s.setCutout)
  const setAnchorsStore = usePetStore((s) => s.setAnchors)

  const runSegmentation = useCallback(
    async (src: string) => {
      setProcessing(true)
      try {
        const result = await removeBackground(src, { tolerance, feather: true })
        setCutout(result.dataUrl)
        setBgRatio(result.backgroundRatio)
        // 锚点估算交给当前皮肤（宠物/人物头身比不同）
        setBaseAnchors(await getSkin(skinId).estimateAnchors(result.dataUrl))
      } finally {
        setProcessing(false)
      }
    },
    [tolerance, skinId],
  )

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const raw = await fileToDataUrl(file)
      const compressed = await compressImage(raw, 1024, 0.9)
      setOriginal(compressed)
      setStep('photo')
      void runSegmentation(compressed)
    },
    [runSegmentation],
  )

  const finish = useCallback(async () => {
    const finalAnchors = applyAdjust(baseAnchors, adjust)
    const defaultName = skinId === 'human' ? '我的伙伴' : '我的宠物'
    createProfile(name.trim() || defaultName, skinId, species)
    await setCutoutStore(cutout, original)
    setAnchorsStore(finalAnchors)
  }, [baseAnchors, adjust, name, skinId, species, createProfile, setCutoutStore, setAnchorsStore, cutout, original])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-canvas px-5 py-8">
      {/* 进度指示 */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['info', 'photo', 'anchor'] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 w-10 rounded-full transition-all duration-300 ${
              step === s ? 'bg-candy' : i < (['info', 'photo', 'anchor'].indexOf(step)) ? 'bg-candy/40' : 'bg-line'
            }`}
          />
        ))}
      </div>

      {step === 'info' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-candy-soft text-4xl shadow-[var(--shadow-clay)]">
            <PawPrint className="text-pink-500" size={40} strokeWidth={2} />
          </div>
          <h1 className="font-heading text-2xl text-primary">{skin.strings.onboardingHero}</h1>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">{skin.strings.onboardingSub}</p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={skin.strings.namePlaceholder}
            maxLength={12}
            className="mt-8 w-full rounded-[var(--radius-clay-sm)] border-2 border-line bg-surface px-4 py-3 text-center text-lg font-bold text-ink outline-none transition-colors focus:border-candy"
          />

          {/* 形象类型选择：宠物 / 人物 */}
          <div className="mt-6 w-full">
            <div className="mb-2 text-left text-xs font-bold text-ink-muted">选择形象类型</div>
            <div className="grid w-full grid-cols-2 gap-3">
              {SKIN_IDS.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setSkinId(id)
                    setBaseAnchors(getSkin(id).defaultAnchors)
                  }}
                  className={`clay-press flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-clay-sm)] border-2 py-3 text-sm font-bold transition-all duration-200 ${
                    skinId === id ? 'border-candy bg-candy-soft text-pink-600' : 'border-line bg-surface text-ink-muted'
                  }`}
                >
                  {getSkin(id).displayName}
                </button>
              ))}
            </div>
          </div>

          {/* 物种细分（仅宠物皮肤提供，人物皮肤为空则跳过） */}
          {skin.speciesOptions.length > 0 && (
            <div className="mt-5 grid w-full grid-cols-3 gap-3">
              {skin.speciesOptions.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSpecies(id as PetSpecies)}
                  className={`clay-press flex cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-clay-sm)] border-2 py-4 transition-all duration-200 ${
                    species === id ? 'border-candy bg-candy-soft' : 'border-line bg-surface'
                  }`}
                >
                  <Icon size={28} className={species === id ? 'text-pink-500' : 'text-ink-muted'} />
                  <span className={`text-xs font-bold ${species === id ? 'text-pink-600' : 'text-ink-muted'}`}>{label}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            className="clay-press mt-8 flex w-full items-center justify-center gap-2 rounded-[var(--radius-clay)] bg-candy py-4 font-heading text-lg font-bold text-white shadow-[var(--shadow-clay)] transition-transform active:scale-95"
          >
            <Upload size={20} />
            {skin.strings.photoButton}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
      )}

      {step === 'photo' && (
        <div className="flex flex-1 flex-col">
          <h2 className="font-heading text-xl text-primary">处理照片</h2>
          <p className="mt-1 text-sm text-ink-muted">已自动抠除背景，可在预览中查看效果。</p>

          <div className="relative mt-4 flex flex-1 items-center justify-center rounded-[var(--radius-clay)] bg-gradient-to-b from-sky-100 to-amber-100 p-4">
            {cutout ? (
              <img src={cutout} alt="去背预览" className="max-h-[320px] max-w-full object-contain drop-shadow-lg" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <RefreshCw className="animate-spin" size={28} />
                <span className="text-sm">正在智能去背…</span>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[var(--radius-clay-sm)] bg-surface p-4">
            <label className="flex items-center justify-between text-xs font-bold text-ink-muted">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={14} /> 去背强度
              </span>
              <span>{tolerance}</span>
            </label>
            <input
              type="range"
              min={10}
              max={90}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="mt-2 w-full accent-pink-500"
            />
            <button
              onClick={() => original && runSegmentation(original)}
              disabled={processing || !original}
              className="clay-press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-canvas py-2 text-xs font-bold text-ink disabled:opacity-50"
            >
              <RefreshCw size={13} /> 重新处理
            </button>
            {bgRatio !== null && (
              <p className="mt-2 text-center text-[11px] text-ink-muted">
                已去除约 {Math.round(bgRatio * 100)}% 背景
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setStep('info')}
              className="clay-press flex items-center gap-1 rounded-[var(--radius-clay)] bg-surface px-5 py-3 font-bold text-ink shadow-[var(--shadow-clay-sm)]"
            >
              <ArrowLeft size={18} /> 返回
            </button>
            <button
              onClick={() => setStep('anchor')}
              disabled={!cutout}
              className="clay-press flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-clay)] bg-candy py-3 font-heading font-bold text-white shadow-[var(--shadow-clay)] disabled:opacity-50"
            >
              下一步 <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'anchor' && (
        <div className="flex flex-1 flex-col">
          <h2 className="font-heading text-xl text-primary">确认位置</h2>
          <p className="mt-1 text-sm text-ink-muted">预览佩戴效果，可微调身体与头部位置。</p>

          <div className="relative mt-4 flex flex-1 items-center justify-center rounded-[var(--radius-clay)] bg-gradient-to-b from-sky-100 to-amber-100 p-4">
            {cutout && (
              <div className="relative">
                <img src={cutout} alt="佩戴预览" className="max-h-[280px] max-w-full object-contain drop-shadow-lg" />
                {/* 锚点可视化：身体/头部包围盒叠加 */}
                <AnchorOverlay anchors={applyAdjust(baseAnchors, adjust)} />
              </div>
            )}
          </div>

          <div className="mt-3 rounded-[var(--radius-clay-sm)] bg-surface p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
              <Sparkles size={14} /> {skin.strings.anchorTuningHint}
            </div>
            <div className="mt-3 space-y-3">
              <AdjustRow
                label="身体"
                onUp={() => setAdjust((a) => ({ ...a, bodyDy: a.bodyDy - 0.02 }))}
                onDown={() => setAdjust((a) => ({ ...a, bodyDy: a.bodyDy + 0.02 }))}
                onPlus={() => setAdjust((a) => ({ ...a, bodyScale: Math.min(1.6, a.bodyScale * 1.06) }))}
                onMinus={() => setAdjust((a) => ({ ...a, bodyScale: Math.max(0.6, a.bodyScale * 0.94) }))}
              />
              <AdjustRow
                label="头部"
                onUp={() => setAdjust((a) => ({ ...a, headDy: a.headDy - 0.02 }))}
                onDown={() => setAdjust((a) => ({ ...a, headDy: a.headDy + 0.02 }))}
              />
            </div>
            <button
              onClick={() => setAdjust(NO_ADJUST)}
              className="mt-2 w-full rounded-[10px] bg-canvas py-2 text-xs font-bold text-ink-muted"
            >
              重置微调
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setStep('photo')}
              className="clay-press flex items-center gap-1 rounded-[var(--radius-clay)] bg-surface px-5 py-3 font-bold text-ink shadow-[var(--shadow-clay-sm)]"
            >
              <ArrowLeft size={18} /> 返回
            </button>
            <button
              onClick={finish}
              disabled={!cutout}
              className="clay-press flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-clay)] bg-candy py-3 font-heading font-bold text-white shadow-[var(--shadow-clay)] disabled:opacity-50"
            >
              <Camera size={18} /> {skin.strings.createButton}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** 锚点叠加可视化，帮助用户在引导阶段确认标定质量 */
function AnchorOverlay({ anchors }: { anchors: PetAnchors }) {
  const toPct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-lg border-2 border-dashed border-pink-400"
        style={{
          left: toPct(anchors.bodyBox.x),
          top: toPct(anchors.bodyBox.y),
          width: toPct(anchors.bodyBox.width),
          height: toPct(anchors.bodyBox.height),
        }}
      />
      <div
        className="absolute rounded-lg border-2 border-dashed border-violet-400"
        style={{
          left: toPct(anchors.headBox.x),
          top: toPct(anchors.headBox.y),
          width: toPct(anchors.headBox.width),
          height: toPct(anchors.headBox.height),
        }}
      />
    </div>
  )
}

function AdjustRow({
  label,
  onUp,
  onDown,
  onPlus,
  onMinus,
}: {
  label: string
  onUp: () => void
  onDown: () => void
  onPlus?: () => void
  onMinus?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs font-bold text-ink-muted">{label}</span>
      <button onClick={onUp} className="clay-press h-8 w-8 rounded-[10px] bg-canvas text-ink-muted">↑</button>
      <button onClick={onDown} className="clay-press h-8 w-8 rounded-[10px] bg-canvas text-ink-muted">↓</button>
      {onPlus && (
        <button onClick={onPlus} className="clay-press h-8 w-8 rounded-[10px] bg-canvas text-ink-muted">＋</button>
      )}
      {onMinus && (
        <button onClick={onMinus} className="clay-press h-8 w-8 rounded-[10px] bg-canvas text-ink-muted">－</button>
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
