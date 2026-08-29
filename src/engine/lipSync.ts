/**
 * LipSync — 音频驱动的嘴唇同步引擎
 *
 * 职责：
 *  - 将 AudioAnalyzer 输出的包络信号映射到 MouthStyle
 *  - 处理静音 → 表情默认嘴型的平滑过渡
 *  - 与情绪表情共存，音频口型优先，静音时回落到表情嘴型
 *
 * 核心原则：
 *  - 音频开合度 > 情绪嘴巴形态的固有开合度时，取较大值
 *  - 静音超过 THRESHOLD_SILENT_MS 后，平滑回到表情默认嘴型
 *  - 说话时眼睛保持自然眨眼（不由本模块控制）
 */

import type { AudioEnvelope } from './audioAnalyzer'
import type { MouthStyle } from './expression'
import type { PetEmotion } from '@/types'

// ── 常量 ────────────────────────────────────────────────────────

/** 连续静音超过此毫秒数视为「停止说话」，开始回落到表情默认嘴型 */
const THRESHOLD_SILENT_MS = 280
/** 回落到表情嘴型的平滑速度（每帧衰减因子） */
const REVERT_SMOOTH = 0.12
/** 最低开合度（即使音量很小也要保留一丝张嘴感） */
const MIN_OPEN = 0.06

// ── 类型 ────────────────────────────────────────────────────────

/** 口型驱动器的运行状态（仅内部用，不暴露给外部 store） */
export interface LipSyncState {
  /** 当前目标 MouthStyle（由 amplitude 计算） */
  mouthStyle: MouthStyle
  /** 嘴巴开合度 0–1（用于精细控制） */
  mouthOpen: number
  /** 上一帧是否为静音（用于计算平滑回落到表情嘴型） */
  isSpeaking: boolean
  /** 上次有声音的时间戳（ms） */
  lastSoundTime: number
  /** 当前表情对应的基础嘴巴开合度 */
  baseOpen: number
}

// ── 公共接口 ────────────────────────────────────────────────────

export class LipSync {
  private state: LipSyncState
  private emotion: PetEmotion
  /** 自定义的嘴巴开合度覆盖（0–1，null 表示由音频自动计算） */
  private manualOverride: number | null = null

  constructor(emotion: PetEmotion = 'neutral') {
    this.emotion = emotion
    const baseOpen = this._emotionBaseOpen(emotion)
    this.state = {
      mouthStyle: this._openToStyle(baseOpen),
      mouthOpen: baseOpen,
      isSpeaking: false,
      lastSoundTime: 0,
      baseOpen,
    }
  }

  /** 更新情绪（影响静音时的回落脚点） */
  setEmotion(emotion: PetEmotion): void {
    this.emotion = emotion
    this.state.baseOpen = this._emotionBaseOpen(emotion)
    // 如果当前不是说话状态，立即更新嘴型到新的表情默认值
    if (!this.state.isSpeaking) {
      this.state.mouthOpen = this.state.baseOpen
      this.state.mouthStyle = this._openToStyle(this.state.baseOpen)
    }
  }

  /**
   * 设置手动开合度覆盖（0–1），用于 UI 手动控制嘴巴形状
   * 传 null 恢复音频自动模式
   */
  setManualOverride(open: number | null): void {
    this.manualOverride = open
    if (open !== null) {
      this.state.mouthOpen = open
      this.state.mouthStyle = this._openToStyle(open)
    }
  }

  /**
   * 消费一帧音频包络，更新内部状态
   * @returns 当前口型渲染参数
   */
  update(env: AudioEnvelope): { mouthStyle: MouthStyle; mouthOpen: number; isSpeaking: boolean } {
    const now = performance.now()

    if (this.manualOverride !== null) {
      return {
        mouthStyle: this.state.mouthStyle,
        mouthOpen: this.manualOverride,
        isSpeaking: this.manualOverride > 0.15,
      }
    }

    const isSpeaking = env.amplitude > 0.08 // 高于底噪即认为在说话

    if (isSpeaking) {
      this.state.lastSoundTime = now
      this.state.isSpeaking = true
      // 音频驱动的开口度：基于振幅的非线性映射
      const audioOpen = Math.pow(env.amplitude, 0.6) * 0.9 + MIN_OPEN
      // 与表情基础开合度取 max，确保表情态的嘴型不被完全压平
      const targetOpen = Math.max(this.state.baseOpen, audioOpen)
      // 平滑插值到目标值，避免瞬跳
      const currentOpen = this.state.mouthOpen
      this.state.mouthOpen = currentOpen + (targetOpen - currentOpen) * 0.4
      this.state.mouthStyle = this._openToStyle(this.state.mouthOpen)
    } else {
      // 静音状态：平滑回落到表情基础嘴型
      const timeSinceSound = now - this.state.lastSoundTime
      if (timeSinceSound > THRESHOLD_SILENT_MS) {
        const currentOpen = this.state.mouthOpen
        const targetOpen = this.state.baseOpen
        const diff = targetOpen - currentOpen
        if (Math.abs(diff) < 0.005) {
          this.state.mouthOpen = targetOpen
        } else {
          this.state.mouthOpen = currentOpen + diff * REVERT_SMOOTH
        }
        this.state.mouthStyle = this._openToStyle(this.state.mouthOpen)
        this.state.isSpeaking = false
      }
      // 否则保持当前口型，等待下一次声音帧
    }

    return {
      mouthStyle: this.state.mouthStyle,
      mouthOpen: this.state.mouthOpen,
      isSpeaking,
    }
  }

  /** 重置到初始状态（切换情绪时调用） */
  reset(): void {
    const baseOpen = this._emotionBaseOpen(this.emotion)
    this.state = {
      mouthStyle: this._openToStyle(baseOpen),
      mouthOpen: baseOpen,
      isSpeaking: false,
      lastSoundTime: 0,
      baseOpen,
    }
    this.manualOverride = null
  }

  // ── 内部方法 ──────────────────────────────────────────────────

  /** 将开合度映射到 MouthStyle */
  private _openToStyle(open: number): MouthStyle {
    if (open < 0.12) return 'line'
    if (open < 0.35) return 'smile'
    if (open < 0.6) return 'open'
    return 'open' // 大张
  }

  /** 获取情绪对应的嘴巴基础开合度 */
  private _emotionBaseOpen(emotion: PetEmotion): number {
    switch (emotion) {
      case 'happy':
        return 0.15 // 微笑，微张
      case 'sweet':
        return 0.2 // 撒娇，轻微张嘴
      case 'neutral':
        return 0.0 // 闭嘴
      case 'sad':
        return 0.05 // 微微下垂
      case 'angry':
        return 0.0 // 紧闭
      case 'sleepy':
        return 0.08 // 微张
      case 'hungry':
        return 0.25 // 张嘴讨食
      default:
        return 0.0
    }
  }
}
