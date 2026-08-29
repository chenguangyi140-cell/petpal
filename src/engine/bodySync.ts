/**
 * BodySync — 音频驱动的身体节奏同步
 *
 * 职责：
 *  - 根据音频节拍/振幅驱动身体的微跳、摇摆
 *  - 与现有动作系统（idle/wagTail/jump 等）叠加，不冲突
 *  - 尊重 reduceMotion 无障碍设置
 *
 * 设计要点：
 *  - BodySync 输出的是「额外偏移量」，叠加到 animation.ts 的计算结果上
 *  - 节拍触发时身体轻微弹跳（y 轴 -0.015 ~ 0.015）
 *  - 整体振幅驱动 scaleX/scaleY 微缩放（最大 ±3%）
 *  - 静音时所有额外偏移归零，完全回归原有动画
 */

import type { AudioEnvelope } from './audioAnalyzer'

// ── 常量 ────────────────────────────────────────────────────────

/** 节拍弹跳的最大 y 偏移（归一化单位） */
const BOUNCE_MAX = 0.018
/** 振幅驱动的缩放上限（±3%） */
const AMP_SCALE_MAX = 0.03
/** 节拍冷却时间内不重复触发弹跳 */
const BEAT_COOLDOWN_MS = 200

// ── 类型 ────────────────────────────────────────────────────────

/**
 * BodySync 输出的额外变换偏移
 * 这些值会叠加到 animation.ts 的计算结果上
 */
export interface BodySyncOffset {
  /** Y 轴额外平移（归一化，正值向下） */
  extraTranslateY: number
  /** 额外 Y 轴缩放（在原有 scaleX/scaleY 基础上叠加） */
  extraScaleY: number
  /** 额外 X 轴缩放 */
  extraScaleX: number
  /** 额外旋转（弧度） */
  extraRotation: number
  /** 是否处于节拍弹跳中 */
  isBouncing: boolean
}

// ── 类 ──────────────────────────────────────────────────────────

export class BodySync {
  private bounceVelocity: number = 0
  private lastBeatTime: number = 0
  private prevAmplitude: number = 0
  private reduceMotion: boolean = false

  constructor(reduceMotion = false) {
    this.reduceMotion = reduceMotion
  }

  /** 更新 reduceMotion 设置 */
  setReduceMotion(v: boolean): void {
    this.reduceMotion = v
    if (v) {
      // 立即归零所有偏移
      this.bounceVelocity = 0
    }
  }

  /**
   * 消费一帧音频包络，返回当前身体额外偏移
   * @returns 偏移量 + 下一帧的 bounceVelocity（供连续调用时使用）
   */
  update(env: AudioEnvelope): { offset: BodySyncOffset; nextBounceVel: number } {
    if (this.reduceMotion) {
      return {
        offset: {
          extraTranslateY: 0,
          extraScaleY: 0,
          extraScaleX: 0,
          extraRotation: 0,
          isBouncing: false,
        },
        nextBounceVel: 0,
      }
    }

    const { beat, amplitude } = env
    const now = performance.now()
    let newBounceVel = this.bounceVelocity

    // ── 节拍弹跳 ──
    if (
      beat &&
      amplitude > 0.15 &&
      now - this.lastBeatTime > BEAT_COOLDOWN_MS
    ) {
      // 节拍触发：给予一个向上的瞬时速度
      newBounceVel = -BOUNCE_MAX * 1.8
      this.lastBeatTime = now
    }

    // 弹跳物理：速度 += 重力，位置 += 速度，速度 *= 阻尼
    const gravity = 0.003
    newBounceVel += gravity
    this.bounceVelocity = newBounceVel * 0.92 // 更强的阻尼让弹跳更快停止
    const translateY = this.bounceVelocity * 0.6

    // ── 振幅驱动的缩放 ──
    // 音量越大，身体微微"震"一下（模拟发声时的胸腔共鸣感）
    const ampDelta = Math.abs(amplitude - this.prevAmplitude)
    this.prevAmplitude = amplitude
    const scaleAmount = Math.min(AMP_SCALE_MAX, ampDelta * 2.5 + amplitude * 0.01)

    const offset: BodySyncOffset = {
      extraTranslateY: translateY,
      extraScaleX: scaleAmount * 0.5,
      extraScaleY: -scaleAmount, // 体积守恒：X 胀 Y 缩
      extraRotation: translateY * 0.08, // 弹跳时轻微倾斜
      isBouncing: Math.abs(translateY) > 0.002,
    }

    return { offset, nextBounceVel: newBounceVel }
  }

  /** 重置所有状态（切换音频源或停止时调用） */
  reset(): void {
    this.bounceVelocity = 0
    this.prevAmplitude = 0
    this.lastBeatTime = 0
  }
}
