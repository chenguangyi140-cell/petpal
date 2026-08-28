import type { MoodState, PetEmotion } from '@/types'

/** 心情维度合法区间 */
const MOOD_MIN = 0
const MOOD_MAX = 100

/** 各维度默认值 */
export const DEFAULT_MOOD: MoodState = {
  happiness: 70,
  energy: 80,
  affection: 60,
  hunger: 20,
}

/**
 * 每小时衰减速率（单位：点/小时）
 *
 * 数值依据：假设用户每天互动 3–4 次，宠物应当在约 8 小时未互动后
 * 明显表现出饥饿与低落，从而产生「被需要」的陪伴压力，但又不至于
 * 几小时就「饿死」导致负罪感。
 */
const DECAY_PER_HOUR: Readonly<Record<keyof MoodState, number>> = {
  happiness: 3.2, // 缓慢低落
  energy: 4.5, // 清醒时持续消耗
  affection: 0.8, // 情感纽带极缓慢淡化
  hunger: 6.5, // 饥饿增长最快，驱动喂食循环
}

/**
 * 情绪推导阈值
 * enter 为进入该情绪的阈值，exit 为退出阈值。
 * 两者之间存在滞后区间（hysteresis），防止心情值在边界抖动导致表情闪烁。
 */
const EMOTION_THRESHOLDS = {
  hungry: { enter: 70, exit: 58 },
  sleepy: { enter: 20, exit: 32 }, // energy 低于 20 进入困倦，回升到 32 才退出
  happy: { enter: 75, exit: 65 },
  sad: { enter: 28, exit: 38 },
  sweet: { enter: 70, exit: 60 }, // affection
} as const

const clamp = (v: number, min = MOOD_MIN, max = MOOD_MAX): number =>
  Math.min(max, Math.max(min, v))

/** 按时间衰减心情值 */
export function decayMood(mood: MoodState, elapsedMs: number): MoodState {
  const hours = elapsedMs / 3_600_000
  if (hours <= 0) return mood

  return {
    happiness: clamp(mood.happiness - DECAY_PER_HOUR.happiness * hours),
    energy: clamp(mood.energy - DECAY_PER_HOUR.energy * hours),
    affection: clamp(mood.affection - DECAY_PER_HOUR.affection * hours),
    hunger: clamp(mood.hunger + DECAY_PER_HOUR.hunger * hours),
  }
}

/** 应用互动带来的心情增量 */
export function applyMoodDelta(
  mood: MoodState,
  delta: Partial<Record<keyof MoodState, number>>,
): MoodState {
  return {
    happiness: clamp(mood.happiness + (delta.happiness ?? 0)),
    energy: clamp(mood.energy + (delta.energy ?? 0)),
    affection: clamp(mood.affection + (delta.affection ?? 0)),
    hunger: clamp(mood.hunger + (delta.hunger ?? 0)),
  }
}

/**
 * 推导当前情绪
 *
 * @param mood 当前四维心情值
 * @param currentEmotion 上一次的情绪，用于滞后判定
 * @param isSleeping 是否处于睡眠中（睡眠时情绪锁定为 sleepy）
 *
 * 优先级：睡眠 > 饥饿 > 困倦 > 开心 > 难过 > 撒娇 > 平静
 * 生理需求优先于情感表达——饿的时候不会撒娇，这是符合直觉的行为建模。
 */
export function deriveEmotion(
  mood: MoodState,
  currentEmotion: PetEmotion,
  isSleeping = false,
): PetEmotion {
  if (isSleeping) return 'sleepy'

  // 滞后判定：已进入某情绪时用 exit 阈值，否则用 enter 阈值
  const isIn = (e: PetEmotion) => currentEmotion === e
  const pass = (
    e: keyof typeof EMOTION_THRESHOLDS,
    value: number,
    /** true 表示「值越大越满足该情绪」，false 表示「值越小越满足」 */
    higherIsMore: boolean,
  ): boolean => {
    const { enter, exit } = EMOTION_THRESHOLDS[e]
    if (isIn(e as PetEmotion)) {
      return higherIsMore ? value > exit : value < exit
    }
    return higherIsMore ? value > enter : value < enter
  }

  if (pass('hungry', mood.hunger, true)) return 'hungry'
  if (pass('sleepy', mood.energy, false)) return 'sleepy'
  if (pass('happy', mood.happiness, true)) return 'happy'
  if (pass('sad', mood.happiness, false)) return 'sad'
  if (pass('sweet', mood.affection, true)) return 'sweet'

  return 'neutral'
}

/**
 * 由情绪推导建议的肢体动作
 * 让表情与动作联动，而不是各自随机——随机组合会出现「哭着跳跃」的违和感
 */
export function suggestAction(emotion: PetEmotion): 'idle' | 'wagTail' | 'sleep' {
  switch (emotion) {
    case 'happy':
    case 'sweet':
      return 'wagTail' // 尾巴是宠物表达愉悦最本能的部位
    case 'sleepy':
      return 'sleep'
    case 'sad':
    case 'hungry':
    case 'angry':
      return 'idle' // 负面情绪下动作收敛，形成情绪对比
    default:
      return 'idle'
  }
}

/** 心情值的健康度摘要，用于 UI 提示（如「该喂食了」） */
export function getMoodAlerts(mood: MoodState): ReadonlyArray<{
  dimension: keyof MoodState
  message: string
  severity: 'warning' | 'urgent'
}> {
  const alerts: Array<{ dimension: keyof MoodState; message: string; severity: 'warning' | 'urgent' }> = []

  if (mood.hunger >= 80) {
    alerts.push({ dimension: 'hunger', message: '快饿扁了…主人给点吃的吧', severity: 'urgent' })
  } else if (mood.hunger >= 60) {
    alerts.push({ dimension: 'hunger', message: '肚子有点饿了', severity: 'warning' })
  }

  if (mood.energy <= 15) {
    alerts.push({ dimension: 'energy', message: '好困…想睡一会儿', severity: 'urgent' })
  }

  if (mood.happiness <= 25) {
    alerts.push({ dimension: 'happiness', message: '有点无聊，陪我玩好不好', severity: 'warning' })
  }

  return alerts
}

/**
 * 亲密度等级换算
 * 每级所需 XP 递增（等差数列），避免后期升级过快导致成长感流失
 */
export function computeBondLevel(xp: number): { level: number; xp: number; xpToNext: number } {
  const BASE = 50
  const STEP = 30
  // 累计 XP 阈值：level n 需要 BASE*n + STEP*n*(n-1)/2
  let level = 1
  let cumulative = 0
  while (true) {
    const need = BASE * level + (STEP * level * (level - 1)) / 2
    if (cumulative + need > xp) {
      return { level, xp, xpToNext: cumulative + need - xp }
    }
    cumulative += need
    level += 1
    if (level > 99) break // 安全上限，防御异常 XP 导致死循环
  }
  return { level: 99, xp, xpToNext: 0 }
}
