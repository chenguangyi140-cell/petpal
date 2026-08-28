import { useState } from 'react'
import { Check, Lock, MoveUp, MoveDown, MoveLeft, MoveRight, ZoomIn, ZoomOut } from 'lucide-react'
import { usePetStore, selectBond } from '@/store/petStore'
import { WEARABLE_CATALOG, WEARABLE_CATEGORIES } from '@/constants/catalog'
import type { WearableType } from '@/types'

export function WardrobePanel() {
  const [category, setCategory] = useState<WearableType | 'all'>('all')
  const equipped = usePetStore((s) => s.equipped)
  const equip = usePetStore((s) => s.equip)
  const unequip = usePetStore((s) => s.unequip)
  const adjust = usePetStore((s) => s.adjustWearable)
  const bond = usePetStore(selectBond)

  const visible = WEARABLE_CATALOG.filter(
    (w) => category === 'all' || w.type === category,
  )

  /** 当前正在微调的分类（每类最多一件已装备，故用类型即可定位） */
  const [adjusting, setAdjusting] = useState<WearableType | null>(null)

  return (
    <div>
      {/* 分类筛选 */}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {WEARABLE_CATEGORIES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setCategory(type)}
            className={`shrink-0 cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
              category === type
                ? 'border-candy bg-candy-soft text-pink-600'
                : 'border-line bg-surface text-ink-muted hover:border-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 服装网格 */}
      <div className="grid max-h-[190px] grid-cols-4 gap-2.5 overflow-y-auto p-1">
        {visible.map((item) => {
          const isEquipped = equipped[item.type] === item.id
          const locked = item.unlockLevel > bond.level

          return (
            <button
              key={item.id}
              disabled={locked}
              onClick={() => (isEquipped ? unequip(item.type) : equip(item.id))}
              onDoubleClick={() => setAdjusting(isEquipped ? item.type : null)}
              aria-label={`${item.name}${locked ? '（未解锁）' : isEquipped ? '（已穿戴）' : ''}`}
              aria-pressed={isEquipped}
              className={`clay-press relative flex aspect-square cursor-pointer items-center justify-center rounded-[var(--radius-clay-sm)] border-2 text-2xl transition-all duration-200 ${
                isEquipped
                  ? 'border-candy bg-candy-soft'
                  : 'border-line bg-canvas hover:border-primary'
              } ${locked ? 'cursor-not-allowed opacity-45' : ''}`}
            >
              <span aria-hidden>{locked ? '🔒' : item.asset}</span>

              {isEquipped && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-candy text-white">
                  <Check size={12} strokeWidth={3.5} />
                </span>
              )}
              {locked && (
                <span className="absolute -bottom-0.5 flex items-center gap-0.5 rounded-full bg-ink/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <Lock size={8} />
                  Lv.{item.unlockLevel}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 佩戴微调：解决不同姿态照片的个体差异 */}
      {adjusting && equipped[adjusting] && (
        <div className="mt-3 rounded-[var(--radius-clay-sm)] bg-canvas p-3">
          <p className="mb-2 text-xs font-bold text-ink-muted">微调位置（双击服装开启）</p>
          <div className="flex flex-wrap gap-2">
            <AdjustBtn onClick={() => adjust(adjusting, { dy: -0.02 })} label="上移">
              <MoveUp size={14} />
            </AdjustBtn>
            <AdjustBtn onClick={() => adjust(adjusting, { dy: 0.02 })} label="下移">
              <MoveDown size={14} />
            </AdjustBtn>
            <AdjustBtn onClick={() => adjust(adjusting, { dx: -0.02 })} label="左移">
              <MoveLeft size={14} />
            </AdjustBtn>
            <AdjustBtn onClick={() => adjust(adjusting, { dx: 0.02 })} label="右移">
              <MoveRight size={14} />
            </AdjustBtn>
            <AdjustBtn onClick={() => adjust(adjusting, { scale: 1.1 })} label="放大">
              <ZoomIn size={14} />
            </AdjustBtn>
            <AdjustBtn onClick={() => adjust(adjusting, { scale: 0.9 })} label="缩小">
              <ZoomOut size={14} />
            </AdjustBtn>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-ink-muted">
        单击穿戴 / 卸载 · 双击已穿戴项可微调位置
      </p>
    </div>
  )
}

function AdjustBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] bg-surface text-ink-muted shadow-[var(--shadow-clay-sm)] transition-all duration-200 hover:text-primary active:scale-95"
    >
      {children}
    </button>
  )
}
