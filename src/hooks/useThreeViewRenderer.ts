import { useEffect, useRef } from 'react'
import { ThreeViewRenderer } from '@/engine/threeViewRenderer'
import { usePetStore } from '@/store/petStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { ThreeViewSet } from '@/types'

/**
 * 管理 ThreeViewRenderer 生命周期并与 store 同步
 * 与 usePetRenderer 同构：渲染器实例不参与 React 渲染，仅命令式同步。
 */
export function useThreeViewRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<ThreeViewRenderer | null>(null)

  const threeViews = usePetStore((s) => s.profile?.threeViews)
  const reduceMotion = useSettingsStore((s) => s.shouldReduceMotion())

  // 视角资源同步
  useEffect(() => {
    if (!threeViews) return
    const v = threeViews as ThreeViewSet
    void rendererRef.current?.setViewDataUrls(v)
  }, [threeViews])

  // 无障碍偏好同步
  useEffect(() => {
    rendererRef.current?.setState({ reduceMotion })
  }, [reduceMotion])

  // 初始化 + 拖拽旋转 + 指针视差
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new ThreeViewRenderer(canvas)
    rendererRef.current = renderer
    if (threeViews) void renderer.setViewDataUrls(threeViews)

    const parent = canvas.parentElement
    if (!parent) return

    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect()
      const size = Math.max(200, Math.min(rect.width, rect.height || rect.width))
      renderer.resize(size, size)
    })
    ro.observe(parent)
    const rect = parent.getBoundingClientRect()
    const size = Math.max(200, Math.min(rect.width, rect.height || rect.width))
    renderer.resize(size, size)
    renderer.start()

    // 指针视差
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1
      renderer.setPointer(nx, ny)
    }
    const onLeave = () => renderer.setPointer(0, 0)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    // 拖拽旋转
    let dragging = false
    let startX = 0
    let startAngle = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      startAngle = renderer.getAngle()
      renderer.setDragging(true)
      canvas.setPointerCapture?.(e.pointerId)
    }
    const onDrag = (e: PointerEvent) => {
      if (!dragging) return
      const r = canvas.getBoundingClientRect()
      const dx = e.clientX - startX
      // 拖动一个画布宽度 ≈ 旋转 360°
      const delta = (dx / r.width) * Math.PI * 2
      renderer.setAngle(startAngle + delta)
    }
    const onUp = () => {
      dragging = false
      renderer.setDragging(false)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', onUp)

    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onDrag)
      window.removeEventListener('pointerup', onUp)
      ro.disconnect()
      renderer.destroy()
      rendererRef.current = null
    }
    // 仅初始化一次；视角/皮肤变化由各独立 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef])

  return rendererRef
}
