import { Eraser, Palette, Sparkles } from 'lucide-react'
import type { MakeupItem, MakeupType } from '@/types'
import { usePetStore } from '@/store/petStore'
import { MAKEUP_COLOR_SWATCHES, MAKEUP_PRESETS, MAKEUP_TYPES } from '@/constants/catalog'

/** 每类妆容的默认渲染参数（blendMode/scale），避免每次手动拼装 */
const DEFAULTS: Record<MakeupType, { blendMode: GlobalCompositeOperation; scale: number }> = {
  eyeshadow: { blendMode: 'multiply', scale: 0.24 },
  blush: { blendMode: 'multiply', scale: 0.28 },
  lipgloss: { blendMode: 'soft-light', scale: 0.2 },
}

const buildItem = (type: MakeupType, color: string, opacity: number): MakeupItem => ({
  id: `custom-${type}`,
  type,
  name: `${MAKEUP_TYPES.find((t) => t.type === type)?.label ?? ''}自定义`,
  color,
  opacity,
  blendMode: DEFAULTS[type].blendMode,
  scale: DEFAULTS[type].scale,
})

export function MakeupPanel() {
  const makeup = usePetStore((s) => s.makeup)
  const applyPreset = usePetStore((s) => s.applyMakeupPreset)
  const setItem = usePetStore((s) => s.setMakeupItem)
  const clear = usePetStore((s) => s.clearMakeup)

  const get = (type: MakeupType) => makeup.find((m) => m.type === type)

  return (
    <div>
      {/* 预设一键妆容 */}
      <p className="mb-2 text-xs font-bold text-ink-muted">风格预设</p>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {MAKEUP_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className="clay-press flex shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3.5 py-1.5 text-xs font-bold text-ink transition-colors hover:border-candy"
          >
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{ background: p.swatch }}
              aria-hidden
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* 分项自定义 */}
      <p className="mb-2 text-xs font-bold text-ink-muted">精细调节</p>
      <div className="space-y-3">
        {MAKEUP_TYPES.map(({ type, label }) => {
          const current = get(type)
          const color = current?.color ?? MAKEUP_COLOR_SWATCHES[0] ?? '#F472B6'
          const opacity = current?.opacity ?? 0.3
          return (
            <div key={type} className="rounded-[var(--radius-clay-sm)] bg-canvas p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-ink">{label}</span>
                <button
                  onClick={() => clear()}
                  aria-label={`清除${label}`}
                  className="rounded-full bg-surface p-1.5 text-ink-muted transition-colors hover:text-cta"
                >
                  <Eraser size={14} />
                </button>
              </div>

              {/* 色板 */}
              <div className="mb-2 grid grid-cols-10 gap-1.5">
                {MAKEUP_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setItem(buildItem(type, c, opacity))}
                    aria-label={`选择颜色 ${c}`}
                    className={`aspect-square cursor-pointer rounded-full transition-transform hover:scale-110 ${
                      color === c ? 'ring-2 ring-offset-2 ring-candy' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              {/* 浓度 */}
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-ink-muted" />
                <input
                  type="range"
                  min={0.1}
                  max={0.7}
                  step={0.02}
                  value={opacity}
                  onChange={(e) => setItem(buildItem(type, color, Number(e.target.value)))}
                  className="w-full accent-pink-500"
                  aria-label={`${label}浓度`}
                />
                <span className="w-8 text-right text-xs font-bold text-ink-muted">
                  {Math.round(opacity * 100)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={clear}
        className="clay-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-surface py-3 text-sm font-bold text-cta shadow-[var(--shadow-clay-sm)]"
      >
        <Palette size={16} /> 卸妆（清除全部）
      </button>

      <p className="mt-3 text-center text-[11px] text-ink-muted">
        妆容以色彩混合自然融入照片，不会浮于表面
      </p>
    </div>
  )
}
