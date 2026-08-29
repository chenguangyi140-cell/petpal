import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Upload, Play, Pause, StopCircle } from 'lucide-react'

type AudioMode = 'idle' | 'recording' | 'playing' | 'uploading'

export function AudioPanel() {
  const [mode, setMode] = useState<AudioMode>('idle')
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSyncActive, setIsSyncActive] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentBlobUrl = useRef<string | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)

  // ── 监听渲染器状态变化 ──
  useEffect(() => {
    const onSyncStatus = (e: Event) => {
      setIsSyncActive((e as CustomEvent).detail?.isActive ?? false)
    }
    window.addEventListener('petpal:audio-sync-status' as any, onSyncStatus as any)
    return () => window.removeEventListener('petpal:audio-sync-status' as any, onSyncStatus as any)
  }, [])

  // ── 麦克风录音 ──
  const startRecording = useCallback(async () => {
    try {
      setPermissionError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      recordingStreamRef.current = stream
      setMode('recording')

      // 通知渲染器启动音频同步
      window.dispatchEvent(new CustomEvent('petpal:start-mic'))
    } catch (err) {
      setMode('idle')
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setPermissionError('请允许麦克风权限后重试')
        } else if (err.name === 'NotFoundError') {
          setPermissionError('未检测到麦克风设备')
        } else {
          setPermissionError('无法访问麦克风，请稍后重试')
        }
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    const stream = recordingStreamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      recordingStreamRef.current = null
    }
    setMode('idle')
    window.dispatchEvent(new CustomEvent('petpal:stop-audio'))
  }, [])

  // ── 上传音频文件 ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current)
    }

    const url = URL.createObjectURL(file)
    currentBlobUrl.current = url
    setMode('uploading')

    const audio = new Audio(url)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      setMode('idle')
    })

    audio.addEventListener('error', () => {
      setMode('idle')
      setPermissionError('音频文件加载失败，请尝试其他格式')
    })
  }, [])

  // ── 播放控制 ──
  const playAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.play()
    setMode('playing')
    window.dispatchEvent(new CustomEvent('petpal:play-audio', { detail: { audioEl: audio } }))

    const updateTime = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', updateTime)
    ;(audio as any)._updateTime = updateTime

    const onEnded = () => {
      setMode('idle')
      setCurrentTime(0)
      window.dispatchEvent(new CustomEvent('petpal:stop-audio'))
      audio.removeEventListener('timeupdate', updateTime)
      delete (audio as any)._updateTime
      audio.removeEventListener('ended', onEnded)
    }
    audio.addEventListener('ended', onEnded)
  }, [])

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setMode('idle')
    if ((audio as any)._updateTime) {
      audio.removeEventListener('timeupdate', (audio as any)._updateTime)
      delete (audio as any)._updateTime
    }
    window.dispatchEvent(new CustomEvent('petpal:stop-audio'))
  }, [])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setMode('idle')
    setCurrentTime(0)
    if ((audio as any)._updateTime) {
      audio.removeEventListener('timeupdate', (audio as any)._updateTime)
      delete (audio as any)._updateTime
    }
    window.dispatchEvent(new CustomEvent('petpal:stop-audio'))
  }, [])

  // ── 清理 ──
  useEffect(() => {
    return () => {
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current)
      }
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
      }
      const stream = recordingStreamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* 标题 */}
      <div>
        <h3 className="text-sm font-bold text-ink">声音同步</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          {isSyncActive
            ? '🎤 宠物正在跟随你的声音说话...'
            : mode === 'playing'
              ? '🎵 宠物正在跟随音乐摆动~'
              : '录音或上传音频，让宠物模仿你的声音'}
        </p>
      </div>

      {/* 录音按钮 */}
      <button
        onClick={mode === 'recording' ? stopRecording : startRecording}
        disabled={mode === 'playing' || mode === 'uploading'}
        className={`clay-press flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-clay)] bg-canvas p-3.5 transition-all duration-200 ${
          mode === 'recording'
            ? 'bg-red-50 ring-2 ring-red-300'
            : 'hover:shadow-[var(--shadow-clay-sm)]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={mode === 'recording' ? '停止录音' : '开始录音'}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
          mode === 'recording' ? 'bg-red-100' : 'bg-primary/10'
        }`}>
          {mode === 'recording' ? (
            <StopCircle size={20} className="text-red-500" strokeWidth={2.5} />
          ) : (
            <Mic size={20} className="text-primary" strokeWidth={2.5} />
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-ink">
            {mode === 'recording' ? '正在录音...' : '录音说话'}
          </p>
          <p className="text-xs text-ink-muted">
            {mode === 'recording'
              ? '点击停止，宠物会模仿你的口型'
              : '按住说话，让宠物模仿你的声音'}
          </p>
        </div>
        {mode === 'recording' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            录音中
          </span>
        )}
      </button>

      {/* 上传音频 */}
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="sr-only"
          aria-label="上传音频文件"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={mode === 'playing' || mode === 'recording'}
          className="clay-press flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-clay)] bg-canvas p-3.5 transition-all duration-200 hover:shadow-[var(--shadow-clay-sm)] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="上传音频文件"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-grape/10">
            <Upload size={20} className="text-violet-500" strokeWidth={2.5} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-ink">上传音频文件</p>
            <p className="text-xs text-ink-muted">支持 MP3、WAV、OGG 等格式</p>
          </div>
        </button>
      </div>

      {/* 播放控制（有音频时显示） */}
      {audioRef.current && mode !== 'uploading' && (
        <div className="rounded-[var(--radius-clay)] bg-canvas p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-bold text-ink-muted">
              {currentTime.toFixed(1)} / {duration.toFixed(1)}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-grape transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {mode === 'playing' ? (
              <button
                onClick={pauseAudio}
                className="clay-press flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-clay-sm)] bg-grape/10 py-2.5 text-sm font-bold text-violet-600 transition-all duration-200 hover:bg-grape/20"
                aria-label="暂停"
              >
                <Pause size={16} strokeWidth={2.5} />
                暂停
              </button>
            ) : (
              <button
                onClick={playAudio}
                className="clay-press flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-clay-sm)] bg-grape/10 py-2.5 text-sm font-bold text-violet-600 transition-all duration-200 hover:bg-grape/20"
                aria-label="播放"
              >
                <Play size={16} strokeWidth={2.5} />
                播放
              </button>
            )}
            <button
              onClick={stopAudio}
              className="clay-press cursor-pointer rounded-[var(--radius-clay-sm)] bg-ink/5 px-3 py-2.5 text-sm font-bold text-ink-muted transition-all duration-200 hover:bg-ink/10"
              aria-label="停止"
            >
              <StopCircle size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* 权限错误提示 */}
      {permissionError && (
        <div className="rounded-[var(--radius-clay-sm)] bg-red-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-red-500">{permissionError}</p>
          <button
            onClick={() => setPermissionError(null)}
            className="mt-2 text-xs text-red-400 underline"
          >
            忽略
          </button>
        </div>
      )}

      {/* 使用说明 */}
      <div className="rounded-[var(--radius-clay-sm)] bg-sunny/5 px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          💡 <strong>小贴士</strong>：录音或播放时，宠物会根据声音大小和节奏做出不同的口型和动作～
        </p>
      </div>
    </div>
  )
}
