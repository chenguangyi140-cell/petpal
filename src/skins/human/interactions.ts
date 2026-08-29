import type { InteractionDef, InteractionKind } from '@/skins/types'

/** 人物互动：复用 8 个互动槽位，但文案与动作换成人物向（拍拍/请客/聊天…） */
export const humanInteractions: Record<InteractionKind, InteractionDef> = {
  pet: {
    label: '拍拍',
    glyph: '🤚',
    delta: { happiness: 8, affection: 6, energy: -1 },
    action: 'wave',
    xp: 6,
    emotion: 'happy',
    replies: ['嘿，你拍我啦～', '哈哈，好痒！', '朋友就是用来拍的！'],
  },
  feed: {
    label: '请客',
    glyph: '🍰',
    delta: { hunger: -28, happiness: 9, energy: 6 },
    action: 'jump',
    xp: 8,
    emotion: 'happy',
    replies: ['哇，谢谢款待！', '好吃好吃！', '你对我真好～'],
  },
  play: {
    label: '聊天',
    glyph: '💬',
    delta: { happiness: 15, energy: -8, affection: 5 },
    action: 'cheer',
    xp: 12,
    emotion: 'happy',
    replies: ['好啊！聊什么？', '我正想找你说话呢', '和你聊天真开心'],
  },
  groom: {
    label: '整理',
    glyph: '✨',
    delta: { happiness: 7, affection: 4 },
    action: 'stretch',
    xp: 6,
    emotion: 'sweet',
    replies: ['嗯，整齐多了', '谢谢帮我整理', '感觉精神了！'],
  },
  rest: {
    label: '休息',
    glyph: '😴',
    delta: { energy: 26, hunger: 4 },
    action: 'sleep',
    xp: 4,
    emotion: 'sleepy',
    replies: ['困了…歇会儿', '晚安～', '让我眯一会儿'],
  },
  bath: {
    label: '护肤',
    glyph: '🧴',
    delta: { happiness: 10, energy: -6 },
    action: 'jump',
    xp: 8,
    emotion: 'happy',
    replies: ['护肤时间到～', '皮肤水当当', '香香的！'],
  },
  photo: {
    label: '合照',
    glyph: '📸',
    delta: { happiness: 6, affection: 3 },
    action: 'cheer',
    xp: 5,
    emotion: 'sweet',
    replies: ['茄子！咔嚓～', '留个纪念！', '笑一个！'],
  },
  train: {
    label: '学习',
    glyph: '📚',
    delta: { happiness: 9, energy: -10, affection: 4 },
    action: 'stretch',
    xp: 14,
    emotion: 'happy',
    replies: ['又学到新知识！', '充实的一天', '谢谢你陪我进步'],
  },
}

export const humanInteractionOrder: readonly InteractionKind[] = [
  'pet',
  'feed',
  'play',
  'groom',
  'rest',
  'bath',
  'photo',
  'train',
]

export const humanTapFeedback = {
  delta: { happiness: 2, affection: 2 },
  xp: 1,
  replies: ['嘿，朋友！', '你戳我啦', '哈哈～', '在呢在呢！'],
}
