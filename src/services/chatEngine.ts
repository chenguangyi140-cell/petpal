import type { PetEmotion, MoodState } from '@/types'
import type { SkinConfig } from '@/skins/types'

export interface ChatContext {
  emotion: PetEmotion
  /** 当前形象皮肤，提供对话语料包（人设/规则/主动语料） */
  skin: SkinConfig
  /** 四维心情值，用于生成「有需求/有记忆」的动态兜底回复 */
  mood: MoodState
  /** 宠物名字，让动态回复更个性化 */
  petName: string
}

const pick = <T,>(arr: readonly T[], fallback: T): T =>
  arr.length === 0 ? fallback : (arr[Math.floor(Math.random() * arr.length)] as T)

/** 当前时段中文描述，用于生成更自然的情境语料 */
function timePhase(): string {
  const h = new Date().getHours()
  if (h < 5) return '半夜'
  if (h < 11) return '早上'
  if (h < 13) return '中午'
  if (h < 18) return '下午'
  if (h < 23) return '晚上'
  return '深夜'
}

/**
 * 生成本地规则回复
 *
 * 语料完全来自 skin.chat，因此宠物与人物各自持有独立人格文案；
 * 引擎本身不感知「宠物还是人物」。匹配顺序即数组顺序——
 * 越具体的规则越靠前，避免被宽泛规则抢先命中。
 *
 * 未命中关键词时，根据当前四维心情动态生成情境回复，
 * 制造「有需求/有记忆/会撒娇」的陪伴感，而非纯随机套话。
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

  // ── 情境兜底：基于当前状态动态生成，制造「有需求/有记忆」的陪伴感 ──
  const m = ctx.mood
  const name = ctx.petName
  const t = timePhase()

  if (m.hunger > 70) {
    return {
      text: pick(
        [
          `${name}～我好饿呀，想吃好吃的`,
          '肚子咕咕叫了…可以喂我一点东西吗？',
          '唔，嘴馋了，有零食吗？',
        ],
        '我饿啦',
      ),
      emotion: 'hungry',
    }
  }
  if (m.energy < 30) {
    return {
      text: pick(
        [
          `好困…${t}了，我想眯一会儿`,
          '呼…没力气了，想睡觉觉',
          '眼睛都睁不开啦，陪我休息一下好不好？',
        ],
        '好困',
      ),
      emotion: 'sleepy',
    }
  }
  if (m.affection > 75) {
    return {
      text: pick(
        ['最喜欢' + name + '了！', '我们永远在一起好不好？', '你今天也陪我玩，好幸福呀～'],
        '爱你',
      ),
      emotion: 'sweet',
    }
  }
  if (m.happiness > 70) {
    return {
      text: pick(['今天好开心呀～', '和你在一起真高兴！', '嘿嘿，心情超好！'], '嘿嘿'),
      emotion: 'happy',
    }
  }

  // 最终回落到情绪池，保持对话连贯而非突兀切换
  const pool = corpus.fallbackByEmotion[ctx.emotion]
  return { text: pick(pool, '嗯嗯！'), emotion: ctx.emotion }
}
