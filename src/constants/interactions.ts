import type { MoodState, PetAction, PetEmotion } from '@/types'

/** 互动类型 */
export type InteractionKind = 'pet' | 'feed' | 'play' | 'groom' | 'rest' | 'bath' | 'photo' | 'train'

/** 互动定义：数值与文案集中管理，便于平衡性调优 */
export interface InteractionDef {
  label: string
  /** 图标（emoji 占位，UI 层统一换成 lucide SVG） */
  glyph: string
  /** 心情增量 */
  delta: Partial<MoodState>
  /** 触发的肢体动作 */
  action: PetAction
  /** 奖励经验 */
  xp: number
  /** 该互动下宠物可能的情绪 */
  emotion: PetEmotion
  /** 候选回复文案 */
  replies: readonly string[]
}

export const INTERACTIONS: Readonly<Record<InteractionKind, InteractionDef>> = {
  pet: {
    label: '抚摸',
    glyph: '🤚',
    delta: { happiness: 8, affection: 6, energy: -1 },
    action: 'stretch',
    xp: 6,
    emotion: 'happy',
    replies: ['嘿嘿～好舒服！再摸摸！', '呼噜呼噜…最喜欢你了', '主人的手好温暖～', '蹭蹭～还要还要！'],
  },
  feed: {
    label: '喂食',
    glyph: '🍖',
    delta: { hunger: -28, happiness: 9, energy: 6 },
    action: 'jump',
    xp: 8,
    emotion: 'happy',
    replies: ['哇！好吃好吃！谢谢主人！', '这是我吃过最棒的一餐！', '肚子终于不叫啦～', '还想再来一口…'],
  },
  play: {
    label: '玩耍',
    glyph: '🎾',
    delta: { happiness: 15, energy: -12, affection: 5, hunger: 6 },
    action: 'jump',
    xp: 12,
    emotion: 'happy',
    replies: ['太好了！我来啦！追球球！', '再快一点！我还能跑！', '接住啦！我是不是很厉害！', '好玩好玩！再来一次！'],
  },
  groom: {
    label: '梳毛',
    glyph: '✨',
    delta: { happiness: 7, affection: 4 },
    action: 'stretch',
    xp: 6,
    emotion: 'sweet',
    replies: ['好舒服～我的毛毛变漂亮了！', '梳得真好看，谢谢你～', '这样出门就帅气啦！'],
  },
  rest: {
    label: '休息',
    glyph: '😴',
    delta: { energy: 26, hunger: 4 },
    action: 'sleep',
    xp: 4,
    emotion: 'sleepy',
    replies: ['zzz…让我睡一会儿…', '好困…晚安主人…', '呼…做个好梦…'],
  },
  bath: {
    label: '洗澡',
    glyph: '🛁',
    delta: { happiness: 10, energy: -6 },
    action: 'jump',
    xp: 8,
    emotion: 'happy',
    replies: ['哗啦啦～洗澡澡好开心！', '泡泡好多呀！', '香喷喷的了！'],
  },
  photo: {
    label: '拍照',
    glyph: '📸',
    delta: { happiness: 6, affection: 3 },
    action: 'jump',
    xp: 5,
    emotion: 'sweet',
    replies: ['茄子！一二三！咔嚓～', '要拍得好看一点哦！', '我也想看看照片！'],
  },
  train: {
    label: '训练',
    glyph: '🎓',
    delta: { happiness: 9, energy: -10, affection: 4 },
    action: 'stretch',
    xp: 14,
    emotion: 'happy',
    replies: ['我学会啦！我好棒！', '握手！转圈！立正！', '主人快看我做到了！'],
  },
}

/** 互动展示顺序 */
export const INTERACTION_ORDER: readonly InteractionKind[] = [
  'pet',
  'feed',
  'play',
  'groom',
  'rest',
  'bath',
  'photo',
  'train',
]

/**
 * 点击宠物本体的轻量反馈
 * 与正式互动区分：增益更小，避免狂点刷满心情
 */
export const TAP_FEEDBACK: {
  delta: Partial<MoodState>
  xp: number
  replies: readonly string[]
} = {
  delta: { happiness: 2, affection: 2 },
  xp: 1,
  replies: ['嘿嘿～好痒！', '主人摸我了！', '好舒服～', '蹭蹭～', '还要还要！'],
}
