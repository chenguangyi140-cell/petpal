import { useEffect, useMemo, useRef } from 'react'
import { PetRenderer } from '@/engine/renderer'
import { usePetStore } from '@/store/petStore'
import { useSettingsStore } from '@/store/settingsStore'
import { getSkin } from '@/skins/registry'
import type { PetWearable } from '@/types'

/**
 * 管理 PetRenderer 生命周期并与 store 状态同步
 *
 * 设计要点：渲染器实例不参与 React 渲染，仅通过命令式 setState 更新——
 * 若把每帧动画状态放进 React state，会导致 60fps 重渲染整个组件树。
 */
export function usePetRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<PetRenderer | null>(null)
  /** 点击画布时的回调（归一化坐标） */
  const onTapRef = useRef<((x: number, y: number) => void) | null>(null)

  const emotion = usePetStore((s) => s.emotion)
  const action = usePetStore((s) => s.action)
  const makeup = usePetStore((s) => s.makeup)
  const skinId = usePetStore((s) => s.profile?.skin)
  const cutout = usePetStore((s) => s.profile?.cutoutDataUrl ?? null)
  const anchors = usePetStore((s) => s.profile?.anchors ?? null)
  const equippedMap = usePetStore((s) => s.equipped)
  const offsets = usePetStore((s) => s.wearableOffsets)
  const reduceMotion = useSettingsStore((s) => s.shouldReduceMotion())

  // 本地用 useMemo 解析已穿戴单品（避免把「每次都返回新数组」的选择器直接喂给
  // usePetStore —— 否则 zustand 默认 Object.is 比较永远不等 → 无限重渲染白屏）
  const skin = getSkin(skinId)
  const equipped = useMemo<PetWearable[]>(() => {
    return Object.values(equippedMap)
      .filter((id): id is string => Boolean(id))
      .map((id) => skin.wearables.find((w) => w.id === id))
      .filter((w): w is PetWearable => Boolean(w))
      .map((w) => {
        const off = offsets[`${w.type}@${w.id}`]
        return off ? { ...w, anchor: { ...w.anchor, userOffset: off } } : w
      })
  }, [equippedMap, offsets, skin])

  // 皮肤切换：profile?.skin 变化时通知渲染器切换 SkinConfig
  // （动作映射、默认锚点、尾巴开关等都由皮肤决定，引擎本身无感）
  useEffect(() => {
    rendererRef.current?.setSkin(getSkin(skinId))
  }, [skinId])

  // 初始化渲染器与尺寸监听
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new PetRenderer(canvas)
    rendererRef.current = renderer

    const parent = canvas.parentElement
    if (!parent) return

    // 响应式尺寸：跟随容器而非固定值，保证多端自适应
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

    // 点击宠物：转换归一化坐标并触发特效与互动
    const handleClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      renderer.burst(x, y, 6)
      onTapRef.current?.(x, y)
    }
    canvas.addEventListener('click', handleClick)

    // 指针移动：归一化到 -1..1，驱动视差与眼神跟随
    const handleMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1
      renderer.setPointer(nx, ny)
    }
    const handleLeave = () => renderer.setPointer(0, 0)
    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseleave', handleLeave)

    return () => {
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseleave', handleLeave)
      ro.disconnect()
      renderer.destroy()
      rendererRef.current = null
    }
  }, [canvasRef])

  // 照片资源同步
  useEffect(() => {
    void rendererRef.current?.setCutout(cutout)
  }, [cutout])

  // 锚点同步
  useEffect(() => {
    rendererRef.current?.setAnchors(anchors)
  }, [anchors])

  // 情绪 / 动作 / 服装 / 妆容同步
  useEffect(() => {
    rendererRef.current?.setState({ emotion, action, wearables: equipped, makeup, reduceMotion })
  }, [emotion, action, equipped, makeup, reduceMotion])

  return useMemo(
    () => ({
      /** 播放一次性动作（如跳跃），不修改 store 的持久状态 */
      playAction: (a: Parameters<PetRenderer['playAction']>[0]) =>
        rendererRef.current?.playAction(a),
      burst: (x: number, y: number, n?: number) => rendererRef.current?.burst(x, y, n),
      exportImage: () => rendererRef.current?.exportImage() ?? '',
      /** 注册点击回调 */
      setTapHandler: (fn: (x: number, y: number) => void) => {
        onTapRef.current = fn
      },
      /** 从麦克风启动音频同步 */
      startAudioFromMic: () => rendererRef.current?.startAudioFromMic(),
      /** 停止音频同步 */
      stopAudio: () => rendererRef.current?.stopAudio(),
      /** 是否正在音频同步模式 */
      isAudioSyncActive: () => rendererRef.current?.isAudioSyncActive ?? false,
      /** 附着外部音频元素 */
      attachAudioElement: (el: HTMLAudioElement) => rendererRef.current?.attachAudioElement(el),
      /** 获取音频分析器状态 */
      getAudioAnalyzer: () => rendererRef.current?.getAudioAnalyzer(),
      /** 渲染器实例（供外部直接调用） */
      getRenderer: () => rendererRef.current,
    }),
    [],
  )
}
