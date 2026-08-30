/**
 * 浏览器端文字转语音（TTS）
 *
 * 使用 Web Speech API 的 speechSynthesis，零依赖、零 API Key、隐私端侧。
 * 用于让宠物「开口说话」：聊天回复、点击/互动气泡均可朗读。
 */

let cachedVoices: SpeechSynthesisVoice[] = []

const loadVoices = (): void => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  cachedVoices = window.speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  // 部分浏览器首次仅返回空列表，需等 voiceschanged 再补全
  window.speechSynthesis.onvoiceschanged = loadVoices
}

/** 优先匹配中文音色，回落到首个可用音色 */
function pickVoice(lang = 'zh-CN'): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) loadVoices()
  return (
    cachedVoices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase())) ??
    cachedVoices[0] ??
    null
  )
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  volume?: number
}

/** 朗读文本。会打断上一条，避免语句堆积。 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const t = text.trim()
  if (!t) return
  // 去除表情符号等不可朗读字符，减少出错
  const clean = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
  if (!clean) return

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  const v = pickVoice('zh-CN')
  if (v) u.voice = v
  u.lang = 'zh-CN'
  u.rate = opts.rate ?? 1.05
  u.pitch = opts.pitch ?? 1.12
  u.volume = opts.volume ?? 1

  // iOS / 部分 WebKit 需要延迟一帧才能稳定触发
  window.speechSynthesis.speak(u)
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis)
}
