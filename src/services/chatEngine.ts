import type { PetEmotion } from '@/types'
import type { SkinConfig } from '@/skins/types'

export interface ChatContext {
  emotion: PetEmotion
  /** 当前形象皮肤，提供对话语料包（人设/规则/主动语料） */
  skin: SkinConfig
}

const pick = <T,>(arr: readonly T[], fallback: T): T =>
  arr.length === 0 ? fallback : (arr[Math.floor(Math.random() * arr.length)] as T)

/**
 * 生成本地规则回复
 *
 * 语料完全来自 skin.chat，因此宠物与人物各自持有独立人格文案；
 * 引擎本身不感知「宠物还是人物」。匹配顺序即数组顺序——
 * 越具体的规则越靠前，避免被宽泛规则抢先命中。
 *
 * @returns 回复文本与建议情绪
 */
export function generateLocalReply(
  input: string,
  ctx: ChatContext,
): { text: string; emotion: PetEmotion } {
  const text = input.trim()
  if (!text) {
    return { text: '嗯？你说什么？', emotion: ctx.emotion }
  }

  const corpus = ctx.skin.chat
  for (const rule of corpus.rules) {
    if (rule.pattern.test(text)) {
      return { text: pick(rule.replies, '嗯嗯！'), emotion: rule.emotion }
    }
  }

  // 未命中：沿用当前情绪，保持对话连贯而非突兀切换
  const pool = corpus.fallbackByEmotion[ctx.emotion]
  return { text: pick(pool, '嗯嗯！'), emotion: ctx.emotion }
}
