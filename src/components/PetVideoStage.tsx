import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { usePetStore } from '@/store/petStore'

/**
 * 宠物短片舞台：即梦生成的会动/会说的视频作为动态形象。
 *
 * 设计取舍：
 * - 默认静音循环自动播放，保证「活起来」的观感（浏览器禁止带声自动播放）。
 * - 提供「开声」按钮：用户主动点击后才用声音播放，绕过自动播放限制；
 *   即梦视频自带口型同步+配音，开声后就是会说话的宠物。
 * - 与扁平/3D 舞台共用 PetStage 的情绪气泡与心情指标层，无需重复实现。
 */
export function PetVideoStage() {
  const videoUrl = usePetStore((s) => s.petVideoUrl)
  const videoName = usePetStore((s) => s.profile?.petVideoName)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  // 切换视频源时同步静音态并触发播放
  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl) return
    setMuted(true)
    v.muted = true
    void v.play().catch(() => {
      /* 自动播放被拦截时静默失败，用户可点开声按钮 */
    })
  }, [videoUrl])

  const toggleSound = () => {
    const v = videoRef.current
    if (!v) return
    const next = !v.muted
    v.muted = next
    setMuted(next)
    if (!next) void v.play().catch(() => {})
  }

  if (!videoUrl) return null

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-amber-50">
      <video
        ref={videoRef}
        src={videoUrl}
        className="max-h-full max-w-full rounded-[var(--radius-clay)] object-contain shadow-[var(--shadow-clay)]"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* 开声按钮 */}
      <button
        onClick={toggleSound}
        aria-label={muted ? '开启声音' : '静音'}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-ink shadow-[var(--shadow-clay-sm)] backdrop-blur transition-transform active:scale-95"
      >
        {muted ? <VolumeX size={16} className="text-ink-muted" /> : <Volume2 size={16} className="text-candy" />}
        {muted ? '开声' : '静音'}
      </button>

      {/* 来源标记 */}
      <div className="absolute bottom-4 left-4 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
        即梦 AI · {videoName ?? '宠物短片'}
      </div>
    </div>
  )
}
