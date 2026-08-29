/**
 * AudioAnalyzer — 基于 Web Audio API 的实时音频分析引擎
 *
 * 职责：
 *  - 从麦克风或 <audio> 元素中提取音频流
 *  - 实时计算音量包络、节拍检测、频段能量
 *  - 输出归一化信号供 LipSync / BodySync 消费
 *
 * 设计要点：
 *  - 零外部依赖，纯 Web API
 *  - 支持 getUserMedia 麦克风与 HTMLAudioElement 两种源
 *  - 分析步长 ~23ms（1024 sample @ 44.1kHz），避免过度 CPU
 */

// ── 公共接口 ────────────────────────────────────────────────────

/** 音量包络（0–1，平滑后的 RMS 能量） */
export interface AudioEnvelope {
  /** 当前帧 RMS，范围 0–1 */
  amplitude: number
  /** 峰值保持（0–1），反映瞬时响度 */
  peak: number
  /** 低频能量占比 0–1（0=全是高频，1=全是低频） */
  bassRatio: number
  /** 是否检测到节拍（能量突增超过阈值） */
  beat: boolean
}

/** 口型驱动参数（由 amplitude 推导） */
export interface LipSyncSignal {
  /** 嘴巴开合度 0（闭合）– 1（大张） */
  mouthOpen: number
  /** 当前音高类别（影响情绪映射） */
  pitchClass: 'low' | 'mid' | 'high'
}

/** 身体节奏信号 */
export interface BodySyncSignal {
  /** 节拍触发时的身体弹跳量 0–1 */
  bounce: number
  /** 当前帧整体振幅缩放（0–1） */
  amplitudeScale: number
}

// ── 内部状态 ────────────────────────────────────────────────────

type AudioSource =
  | { type: 'mic'; stream: MediaStream }
  | { type: 'file'; audioEl: HTMLAudioElement }

interface AnalyzerState {
  ctx: AudioContext
  source: AudioNode
  analyser: AnalyserNode
  fftSize: number
  micStream?: MediaStream
  audioEl?: HTMLAudioElement
  /** 上次帧的 amplitude，用于平滑 */
  prevAmplitude: number
  /** 峰值保持衰减 */
  peakDecay: number
  lastPeak: number
  /** 节拍检测：上次节拍时间戳（ms） */
  lastBeatTime: number
  /** 连续低能量帧计数（用于静音检测） */
  silentFrames: number
}

// ── 常量 ────────────────────────────────────────────────────────

const FFT_SIZE = 1024
const SMOOTHING = 0.8
const AMP_THRESHOLD_BEAT = 1.4 // 当前帧超过前一帧多少倍算节拍
const AMP_MIN_FOR_BEAT = 0.18  // 最低振幅阈值（过滤底噪）
const BEAT_COOLDOWN_MS = 180  // 节拍冷却时间（避免连击）
const PEAK_DECAY_RATE = 0.96 // 每帧峰值衰减系数
const AMP_SMOOTH_FACTOR = 0.35 // 包络平滑因子（越大越平滑）

/** 频段划分索引（fftSize=1024 → bin 0~511，采样率 44.1kHz 时每 bin ≈ 43Hz） */
const BASS_END_BIN = 8   // ~344 Hz

// ── 构造函数 ────────────────────────────────────────────────────

export class AudioAnalyzer {
  private state: AnalyzerState | null = null
  private rafId: number | null = null
  private onFrame?: (signal: AudioEnvelope) => void

  /** 当前音频时长（秒），仅文件模式有效 */
  get duration(): number {
    return this.state?.audioEl?.duration ?? 0
  }

  /** 当前播放位置（秒），仅文件模式有效 */
  get currentTime(): number {
    return this.state?.audioEl?.currentTime ?? 0
  }

  /** 是否正在分析音频流 */
  get isActive(): boolean {
    return this.state !== null
  }

  /**
   * 从麦克风采集音频并启动分析
   * @param options 媒体约束
   */
  async startMicrophone(options?: MediaStreamConstraints): Promise<void> {
    if (this.state) await this.stop()
    const stream = await navigator.mediaDevices.getUserMedia(
      options ?? { audio: { sampleRate: 44100, channelCount: 1 } },
    )
    await this._initSource({ type: 'mic', stream })
  }

  /**
   * 从一个 <audio> 元素启动分析
   * @param audioEl 已有的 <audio> DOM 节点（autoplay 后调此方法）
   */
  startFromAudioElement(audioEl: HTMLAudioElement): void {
    if (this.state) void this.stop()
    audioEl.play()
    void this._initSource({ type: 'file', audioEl })
  }

  /**
   * 直接传入已经播放的 <audio> 元素（不自动 play）
   */
  attachAudioElement(audioEl: HTMLAudioElement): void {
    if (this.state) void this.stop()
    void this._initSource({ type: 'file', audioEl })
  }

  /** 设置帧回调（每帧调用一次） */
  setOnFrame(cb: (signal: AudioEnvelope) => void): void {
    this.onFrame = cb
  }

  /** 停止分析，释放所有资源 */
  async stop(): Promise<void> {
    if (!this.state) return
    const { ctx, micStream } = this.state
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.state.audioEl) {
      this.state.audioEl.pause()
      this.state.audioEl.src = ''
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop())
    }
    await ctx.close()
    this.state = null
    this.onFrame = undefined
  }

  // ── 内部方法 ──────────────────────────────────────────────────

  private async _initSource(source: AudioSource): Promise<void> {
    const ctx = new AudioContext({ sampleRate: 44100 })
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = SMOOTHING

    let srcNode: AudioNode
    let micStream: MediaStream | undefined
    let audioEl: HTMLAudioElement | undefined

    if (source.type === 'mic') {
      const mediaSource = ctx.createMediaStreamSource(source.stream)
      srcNode = mediaSource
      micStream = source.stream
    } else {
      audioEl = source.audioEl
      const mediaSource = ctx.createMediaElementSource(audioEl)
      srcNode = mediaSource
    }

    srcNode.connect(analyser)
    // 麦克风不需要再连到 destination（避免回授）
    if (source.type === 'mic') {
      analyser.connect(ctx.destination)
    }

    this.state = {
      ctx,
      source: srcNode,
      analyser,
      fftSize: FFT_SIZE,
      micStream,
      audioEl,
      prevAmplitude: 0,
      peakDecay: PEAK_DECAY_RATE,
      lastPeak: 0,
      lastBeatTime: 0,
      silentFrames: 0,
    }

    this._tick()
  }

  private _tick = (): void => {
    if (!this.state) return
    const { analyser, prevAmplitude, lastPeak, lastBeatTime, silentFrames } = this.state
    if (!analyser) return
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const freqArray = new Uint8Array(bufferLength)

    analyser.getByteTimeDomainData(dataArray)
    analyser.getByteFrequencyData(freqArray)

    // ── RMS 能量 ──
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      const v = ((dataArray?.[i] ?? 128) - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / bufferLength)
    // 归一化到 0–1（RMS 理论上限 ≈ 0.707，乘 1.4 让峰值接近 1）
    const amplitude = Math.min(1, rms * 1.4)
    // 一阶低通平滑
    const smoothed = prevAmplitude + AMP_SMOOTH_FACTOR * (amplitude - prevAmplitude)

    // ── 峰值保持 ──
    const peak = amplitude > lastPeak ? amplitude : lastPeak * (this.state?.peakDecay ?? PEAK_DECAY_RATE)

    // ── 低频能量比 ──
    let bassEnergy = 0
    let totalEnergy = 0
    for (let i = 0; i < bufferLength; i++) {
      const v = (freqArray?.[i] ?? 0) / 255
      totalEnergy += v
      if (i <= BASS_END_BIN) bassEnergy += v
    }
    const bassRatio = totalEnergy > 0 ? bassEnergy / totalEnergy : 0

    // ── 节拍检测 ──
    const now = performance.now()
    const isNewBeat =
      smoothed > AMP_MIN_FOR_BEAT &&
      smoothed > prevAmplitude * AMP_THRESHOLD_BEAT &&
      now - lastBeatTime > BEAT_COOLDOWN_MS

    const newSilentFrames = smoothed < 0.04 ? silentFrames + 1 : 0

    this.state.prevAmplitude = smoothed
    this.state.lastPeak = peak
    this.state.lastBeatTime = isNewBeat ? now : lastBeatTime
    this.state.silentFrames = newSilentFrames

    const env: AudioEnvelope = {
      amplitude: smoothed,
      peak,
      bassRatio,
      beat: isNewBeat,
    }

    this.onFrame?.(env)

    this.rafId = requestAnimationFrame(this._tick)
  }

  /**
   * 根据当前音频包络推导口型驱动参数
   * 应在每一帧回调中调用，传入当前的 AudioEnvelope
   */
  static computeLipSyncSignal(env: AudioEnvelope): LipSyncSignal {
    const amp = env.amplitude
    // 非线性的开合映射：低音量时开口小，高音量时开口大
    const mouthOpen = Math.pow(amp, 0.65) // 压缩低段，强调高段

    // 音高类别：根据 bassRatio 判断
    const { bassRatio } = env
    let pitchClass: LipSyncSignal['pitchClass']
    if (bassRatio > 0.55) pitchClass = 'low'
    else if (bassRatio < 0.25) pitchClass = 'high'
    else pitchClass = 'mid'

    return { mouthOpen, pitchClass }
  }

  /**
   * 根据当前包络推导身体节奏信号
   */
  static computeBodySyncSignal(
    env: AudioEnvelope,
    prevBounce: number,
  ): { signal: BodySyncSignal; nextBounce: number } {
    const { amplitude, beat } = env
    // 弹跳：节拍触发时瞬间弹起，然后指数衰减
    const targetBounce = beat ? 0.18 : 0
    const bounce = prevBounce * 0.82 + targetBounce * 0.18 // 平滑过渡
    const nextBounce = beat ? 0.18 : bounce * 0.82

    return {
      signal: {
        bounce,
        amplitudeScale: 1 + amplitude * 0.06, // 最大 6% 的振幅缩放
      },
      nextBounce,
    }
  }
}

/**
 * 创建一段静音的 AudioContext 测试信号（用于调试）
 * 返回一个可播放的 440Hz 正弦波 audio URL
 */
export async function createTestTone(durationSec = 2): Promise<string> {
  const ctx = new AudioContext({ sampleRate: 44100 })
  const sampleRate = ctx.sampleRate
  const numSamples = Math.floor(sampleRate * durationSec)
  const buffer = ctx.createBuffer(1, numSamples, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    // 包络：fade in 50ms，fade out 50ms
    const envelope =
      i < sampleRate * 0.05
        ? i / (sampleRate * 0.05)
        : i > numSamples - sampleRate * 0.05
          ? (numSamples - i) / (sampleRate * 0.05)
          : 1
    data[i] = Math.sin(2 * Math.PI * 440 * t) * envelope * 0.5
  }
  const wavBlob = await bufferToWav(buffer)
  return URL.createObjectURL(wavBlob)
}

/** OfflineAudioContext 转 WAV Blob */
async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = 2 // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const headerSize = 44
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  // fmt subchunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // subchunk1Size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  // data subchunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // 写入 PCM 数据
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch)
      const sample = Math.max(-1, Math.min(1, channelData[i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
