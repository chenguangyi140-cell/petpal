import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart, Zap, Gift, Drumstick } from 'lucide-react'
import type { MoodState } from '@/types'
import { usePetStore } from '@/store/petStore'
import { useChatStore } from '@/store/chatStore'
import { usePetRenderer } from '@/hooks/usePetRenderer'
import { getSkin } from '@/skins/registry'
import { getMoodAlerts } from '@/engine/emotion'

/** 心情维度展示配置 */
const MOOD_META: ReadonlyArray<{
  key: keyof MoodState
  label: string
  Icon: typeof Heart
  barClass: string
  textClass: string
}> = [
  { key: 'happiness', label: '开心', Icon: Heart, barClass: 'bg-candy', textClass: 'text-pink-500' },
  { key: 'energy', label: '精力', Icon: Zap, barClass: 'bg-sunny', textClass: 'text-amber-500' },
  { key: 'affection', label: '亲密', Icon: Gift, barClass: 'bg-grape', textClass: 'text-violet-500' },
  { key: 'hunger', label: '饥饿', Icon: Drumstick, barClass: 'bg-cta', textClass: 'text-orange-500' },
]

export function PetStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const bubbleTimer = useRef<number | null>(null)

  const mood = usePetStore((s) => s.mood)
  const emotion = usePetStore((s) => s.emotion)
  const tap = usePetStore((s) => s.tap)
  const playAction = usePetStore((s) => s.playAction)
  const messages = useChatStore((s) => s.messages)
  const skinId = usePetStore((s) => s.profile?.skin)
  const skin = getSkin(skinId)

  const renderer = usePetRenderer(canvasRef)

  /** 展示临时气泡，4 秒后自动消失 */
  const showBubble = useCallback((text: string) => {
    setBubble(text)
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 4000)
  }, [])

  // 点击宠物本体：轻量互动 + 随机动作反馈
  useEffect(() => {
    renderer.setTapHandler(() => {
      const reply = tap()
      showBubble(reply)
      // 随机播放一个小动作，让反馈不呆板
      const actions = ['stretch', 'jump', 'roll'] as const
      const picked = actions[Math.floor(Math.random() * actions.length)]
      playAction(picked ?? 'idle')
    })
  }, [renderer, tap, showBubble, playAction])

  // 宠物主动发言时在头顶冒泡
  const lastPetMsg = [...messages].reverse().find((m) => m.role === 'pet')
  useEffect(() => {
    if (!lastPetMsg) return
    // 仅在最近 3 秒内的新消息才冒泡，避免历史消息回溯时刷屏
    if (Date.now() - lastPetMsg.timestamp < 3000) {
      showBubble(lastPetMsg.content)
    }
  }, [lastPetMsg, showBubble])

  useEffect(
    () => () => {
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    },
    [],
  )

  const alerts = getMoodAlerts(mood)

  return (
    <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-amber-50">
      {/* 心情指标 */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {MOOD_META.map(({ key, label, Icon, barClass, textClass }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Icon size={13} className={textClass} strokeWidth={2.5} />
            <div className="h-2 w-14 overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${barClass}`}
                style={{ width: `${Math.max(4, mood[key])}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-ink-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* 需求提示（饥饿/困倦等） */}
      {alerts.length > 0 && (
        <div className="absolute top-4 right-4 z-10 max-w-[45%] rounded-2xl bg-white/90 px-3 py-2 text-right shadow-[var(--shadow-clay-sm)] backdrop-blur">
          <p className="text-xs font-bold text-cta">{alerts[0]?.message}</p>
        </div>
      )}

      {/* 情绪气泡 */}
      {bubble && (
        <div className="absolute top-16 left-1/2 z-20 max-w-[78%] -translate-x-1/2 animate-[popIn_300ms_ease-out] rounded-2xl bg-surface px-4 py-2.5 text-center text-sm font-semibold text-ink shadow-[var(--shadow-clay)]">
          {bubble}
          <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-surface" />
        </div>
      )}

      {/* Canvas 渲染区 */}
      <div className="flex h-[380px] w-full items-center justify-center sm:h-[420px]">
        <canvas
          ref={canvasRef}
          className="cursor-pointer"
          role="img"
          aria-label={`${skin.strings.entityWord}${usePetStore.getState().profile?.name ?? ''}，当前情绪：${EMOTION_LABEL[emotion]}`}
        />
      </div>

      {/* 地面 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-t-[50%] bg-gradient-to-b from-amber-100 to-amber-200" />
    </section>
  )
}

const EMOTION_LABEL: Record<string, string> = {
  neutral: '平静',
  happy: '开心',
  sad: '难过',
  angry: '生气',
  sweet: '撒娇',
  sleepy: '困倦',
  hungry: '饥饿',
}
