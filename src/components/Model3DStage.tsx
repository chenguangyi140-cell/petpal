import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModelViewer } from '@/three/modelViewer'
import { usePetStore } from '@/store/petStore'
import { useSettingsStore } from '@/store/settingsStore'

/** 真·3D 模型舞台：加载本机生成的 GLB，可自由拖拽旋转 */
export function Model3DStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<ModelViewer | null>(null)
  const model3dUrl = usePetStore((s) => s.model3dUrl)
  const reduceMotion = useSettingsStore((s) => s.shouldReduceMotion())
  const action = usePetStore((s) => s.action)
  const emotion = usePetStore((s) => s.emotion)
  const isSleeping = usePetStore((s) => s.isSleeping)
  const tap = usePetStore((s) => s.tap)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model3dUrl) return

    let cancelled = false
    const viewer = new ModelViewer(canvas)
    viewerRef.current = viewer

    const parent = canvas.parentElement
    const applySize = () => {
      const rect = parent?.getBoundingClientRect()
      const size = Math.max(200, Math.min(rect?.width ?? 360, rect?.height ?? 360))
      viewer.resize(size, size)
    }

    viewer
      .init()
      .then(() => {
        if (cancelled) return
        applySize()
        return viewer.load(model3dUrl)
      })
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((err) => {
        console.warn('[Model3DStage] 加载失败', err)
        if (!cancelled) setStatus('error')
      })

    const ro = new ResizeObserver(applySize)
    if (parent) ro.observe(parent)

    return () => {
      cancelled = true
      ro.disconnect()
      viewer.dispose()
      viewerRef.current = null
    }
  }, [model3dUrl])

  useEffect(() => {
    viewerRef.current?.setState({ reduceMotion })
  }, [reduceMotion])

  // 订阅宠物状态 → 驱动 3D 模型表演
  useEffect(() => {
    viewerRef.current?.setAction(action)
  }, [action])
  useEffect(() => {
    viewerRef.current?.setEmotion(emotion)
  }, [emotion])
  useEffect(() => {
    viewerRef.current?.setSleeping(isSleeping)
  }, [isSleeping])

  // 点击模型本体：轻互动 + 气泡（由 PetStage 统一展示/朗读）
  const handleTap = () => {
    const reply = tap()
    window.dispatchEvent(new CustomEvent('petpal:pet-bubble', { detail: { text: reply } }))
  }

  return (
    <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-amber-50">
      <div className="relative flex h-[380px] w-full items-center justify-center sm:h-[420px]">
        <canvas
          ref={canvasRef}
          onClick={handleTap}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label="3D 模型形象，可拖拽旋转，点击互动"
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">正在生成立体形象…</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-cta">
            3D 模型加载失败，请确认文件为有效的 GLB，或回到设置重新生成。
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-ink-muted shadow-[var(--shadow-clay-sm)] backdrop-blur">
          拖拽旋转 · 滚轮缩放
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-t-[50%] bg-gradient-to-b from-amber-100 to-amber-200" />
    </section>
  )
}
