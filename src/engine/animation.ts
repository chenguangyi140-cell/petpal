import type { PetAction } from '@/types'

/** 2D 仿射变换参数（位移单位为画布归一化比例，旋转为弧度） */
export interface Transform {
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  rotation: number
}

export const IDENTITY_TRANSFORM: Transform = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
}

/** 动作时长（毫秒） */
const DURATION: Readonly<Record<PetAction, number>> = {
  idle: 2400, // 循环周期
  wagTail: 1800, // 循环周期
  jump: 620,
  roll: 1000,
  stretch: 900,
  sleep: 3600, // 循环周期
}

/** 区分循环动作与一次性动作，决定播放完成后的回归策略 */
export const LOOPING_ACTIONS: ReadonlySet<PetAction> = new Set<PetAction>([
  'idle',
  'wagTail',
  'sleep',
])

export const isLooping = (action: PetAction): boolean => LOOPING_ACTIONS.has(action)

export const getDuration = (action: PetAction): number => DURATION[action]

/** 缓动函数 */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * 计算动作在给定进度下的身体变换
 *
 * @param action 动作类型
 * @param t 归一化进度 0–1（循环动作传入周期内的相位）
 * @param reduceMotion 是否尊重「减少动态效果」无障碍偏好
 */
export function computeBodyTransform(
  action: PetAction,
  t: number,
  reduceMotion = false,
): Transform {
  if (reduceMotion) {
    // 无障碍降级：仅保留极轻微的呼吸感，避免前庭不适
    return action === 'sleep'
      ? { ...IDENTITY_TRANSFORM, scaleY: 0.98 }
      : IDENTITY_TRANSFORM
  }

  const p = Math.min(1, Math.max(0, t))

  switch (action) {
    case 'idle': {
      // 呼吸：正弦驱动纵向缩放与轻微起伏，周期由 DURATION.idle 控制
      const wave = Math.sin(p * Math.PI * 2)
      return {
        translateX: 0,
        translateY: wave * -0.012,
        scaleX: 1 + wave * 0.008,
        scaleY: 1 - wave * 0.012,
        rotation: 0,
      }
    }

    case 'wagTail': {
      // 身体轻微左右摆动，尾巴摆动在渲染层单独叠加（见 computeTailRotation）
      const wave = Math.sin(p * Math.PI * 2)
      return {
        translateX: wave * 0.008,
        translateY: Math.abs(Math.sin(p * Math.PI * 2)) * -0.008,
        scaleX: 1,
        scaleY: 1,
        rotation: wave * 0.015,
      }
    }

    case 'jump': {
      // 三段式：蓄力下蹲 → 腾空 → 落地缓冲
      let translateY: number
      let scaleX = 1
      let scaleY = 1
      if (p < 0.22) {
        // 蓄力：压扁
        const k = easeOutCubic(p / 0.22)
        translateY = k * 0.03
        scaleX = 1 + k * 0.1
        scaleY = 1 - k * 0.12
      } else if (p < 0.68) {
        // 腾空：抛物线，起跳拉伸
        const k = (p - 0.22) / 0.46
        const arc = 4 * k * (1 - k) // 抛物线，峰值 1.0
        translateY = -arc * 0.28
        scaleX = 1 - arc * 0.06
        scaleY = 1 + arc * 0.08
      } else {
        // 落地：回弹缓冲
        const k = easeOutCubic((p - 0.68) / 0.32)
        const squash = (1 - k) * 0.12
        translateY = 0
        scaleX = 1 + squash
        scaleY = 1 - squash
      }
      return { translateX: 0, translateY, scaleX, scaleY, rotation: 0 }
    }

    case 'roll': {
      // 打滚：整周旋转 + 中途抬升避免「贴地摩擦」的廉价感
      const rotation = p * Math.PI * 2
      const lift = Math.sin(p * Math.PI) // 中途抬起
      return {
        translateX: 0,
        translateY: -lift * 0.06,
        scaleX: 1,
        scaleY: 1,
        rotation,
      }
    }

    case 'stretch': {
      // 伸懒腰：先横向拉长压低，再纵向舒展，最后回弹
      let scaleX: number
      let scaleY: number
      let translateY: number
      if (p < 0.4) {
        const k = easeInOutQuad(p / 0.4)
        scaleX = 1 + k * 0.14
        scaleY = 1 - k * 0.1
        translateY = k * 0.022
      } else if (p < 0.72) {
        const k = easeInOutQuad((p - 0.4) / 0.32)
        scaleX = 1.14 - k * 0.24
        scaleY = 0.9 + k * 0.16
        translateY = 0.022 - k * 0.05
      } else {
        const k = easeOutCubic((p - 0.72) / 0.28)
        scaleX = 0.9 + k * 0.1
        scaleY = 1.06 - k * 0.06
        translateY = -0.028 + k * 0.028
      }
      return { translateX: 0, translateY, scaleX, scaleY, rotation: 0 }
    }

    case 'sleep': {
      // 睡眠：慢频率大幅度呼吸，配合渲染层的 Z 符号
      const wave = Math.sin(p * Math.PI * 2)
      return {
        translateX: 0,
        translateY: wave * -0.008 + 0.01,
        scaleX: 1 + wave * 0.012,
        scaleY: 1 - wave * 0.018,
        rotation: 0,
      }
    }

    default:
      return IDENTITY_TRANSFORM
  }
}

/**
 * 尾巴摆动角度
 * 与身体变换分离，因为尾巴是相对身体的局部运动，不应跟随整体旋转
 */
export function computeTailRotation(
  action: PetAction,
  t: number,
  emotionBoost = 0,
  reduceMotion = false,
): number {
  if (reduceMotion) return 0

  const p = Math.min(1, Math.max(0, t))

  switch (action) {
    case 'wagTail': {
      // 正弦摆动，emotionBoost 让愉悦情绪下摆幅更大、频率更快
      const freq = 2 + emotionBoost * 1.5
      const amplitude = 0.35 + emotionBoost * 0.3
      return Math.sin(p * Math.PI * 2 * freq) * amplitude
    }
    case 'jump':
      // 跳跃时尾巴上扬保持平衡
      return -0.25 + Math.sin(p * Math.PI) * 0.4
    case 'roll':
      return Math.sin(p * Math.PI * 4) * 0.5
    case 'sleep':
      return 0.15 // 睡眠时尾巴自然垂落
    default:
      // 待机时若情绪愉悦，尾巴保持轻微摆动
      return emotionBoost > 0 ? Math.sin(p * Math.PI * 2) * 0.12 * emotionBoost : 0
  }
}

/**
 * 接地阴影缩放
 * 物体跳起时阴影应当缩小且变淡，这是建立空间纵深感的关键视觉线索
 */
export function computeShadowScale(
  action: PetAction,
  t: number,
  reduceMotion = false,
): { scale: number; opacity: number } {
  if (reduceMotion) return { scale: 1, opacity: 0.18 }

  const p = Math.min(1, Math.max(0, t))

  if (action === 'jump') {
    // 阴影随腾空高度反向缩放
    let height: number
    if (p < 0.22) {
      height = 0
    } else if (p < 0.68) {
      const k = (p - 0.22) / 0.46
      height = 4 * k * (1 - k)
    } else {
      height = 0
    }
    const scale = 1 - height * 0.35
    const opacity = 0.18 - height * 0.09
    return { scale: Math.max(0.5, scale), opacity: Math.max(0.06, opacity) }
  }

  if (action === 'roll') {
    const lift = Math.sin(p * Math.PI)
    return { scale: 1 - lift * 0.2, opacity: 0.18 - lift * 0.07 }
  }

  return { scale: 1, opacity: 0.18 }
}

/**
 * 动画调度器
 * 管理当前动作、进度推进与一次性动作完成后的自动回归
 */
export class AnimationScheduler {
  private action: PetAction = 'idle'
  private startedAt = 0
  private onComplete?: (action: PetAction) => void

  constructor() {
    this.startedAt = performance.now()
  }

  /** 切换动作；相同动作不重复触发（避免连续点击导致动画重启抖动） */
  play(action: PetAction, onComplete?: (action: PetAction) => void): void {
    if (this.action === action && !onComplete) return
    this.action = action
    this.startedAt = performance.now()
    this.onComplete = onComplete
  }

  get currentAction(): PetAction {
    return this.action
  }

  /** 推进到当前时刻，返回归一化进度；一次性动作结束时会触发回调 */
  tick(now: number): { progress: number; completed: boolean } {
    const duration = DURATION[this.action]
    const elapsed = now - this.startedAt

    if (isLooping(this.action)) {
      return { progress: (elapsed % duration) / duration, completed: false }
    }

    const progress = elapsed / duration
    if (progress >= 1) {
      const finished = this.action
      const cb = this.onComplete
      // 一次性动作结束后回归待机，保证状态机不会卡在非循环动作上
      this.action = 'idle'
      this.startedAt = now
      this.onComplete = undefined
      cb?.(finished)
      return { progress: 1, completed: true }
    }
    return { progress, completed: false }
  }
}
