import { useRef } from 'react'
import { RotateCw } from 'lucide-react'
import { useThreeViewRenderer } from '@/hooks/useThreeViewRenderer'
import { getSkin } from '@/skins/registry'
import { usePetStore } from '@/store/petStore'

/** 三视图转盘舞台：拖拽可旋转查看动态 3D 形象 */
export function ThreeViewStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skinId = usePetStore((s) => s.profile?.skin)
  const skin = getSkin(skinId)
  useThreeViewRenderer(canvasRef)

  return (
    <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-amber-50">
      <div className="flex h-[380px] w-full items-center justify-center sm:h-[420px]">
        <canvas
          ref={canvasRef}
          className="cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label={`${skin.strings.entityWord}三视图形象，可拖拽旋转`}
        />
      </div>

      {/* 旋转提示 */}
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-ink-muted shadow-[var(--shadow-clay-sm)] backdrop-blur">
        <RotateCw size={13} className="text-pink-400" />
        拖拽旋转 · 查看前/侧/后
      </div>

      {/* 地面 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-t-[50%] bg-gradient-to-b from-amber-100 to-amber-200" />
    </section>
  )
}
