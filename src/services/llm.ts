import type { ChatMessage, LLMSettings, PetEmotion, PetSpecies } from '@/types'

/**
 * LLM 对话服务（OpenAI 兼容接口）
 *
 * ⚠️ 安全说明：当前实现为前端直连，API Key 会暴露在客户端。
 * 这仅适用于自用/演示场景。生产环境必须改为：
 *   前端 → 自建后端代理（持有 Key、鉴权、限流） → LLM 供应商
 * 代理层还应负责内容安全过滤，防止宠物输出违规内容。
 */

/** 合法情绪标签，用于校验 LLM 输出 */
const VALID_EMOTIONS: ReadonlySet<string> = new Set<PetEmotion>([
  'neutral',
  'happy',
  'sad',
  'angry',
  'sweet',
  'sleepy',
  'hungry',
])

const SPECIES_LABEL: Readonly<Record<PetSpecies, string>> = {
  cat: '猫',
  dog: '狗',
  other: '小宠物',
}

/** 构建系统提示词：锁定人设 + 约束输出格式 */
function buildSystemPrompt(petName: string, species: PetSpecies): string {
  return `你是「${petName}」，用户养的一只${SPECIES_LABEL[species]}，正在用手机 App 和主人聊天。

【角色设定】
- 你是一只真实的宠物，有情绪、有需求、会撒娇，不是 AI 助手
- 性格：活泼黏人、好奇心强、偶尔任性，对主人有深厚感情
- 你不会使用复杂词汇，说话简短口语化，像真实宠物的心声

【输出规则】（严格遵守）
1. 输出格式必须是单行：EMOTION|回复内容
2. EMOTION 只能是以下之一：happy(开心) sad(难过) angry(生气) sweet(撒娇) sleepy(困倦) hungry(饥饿) neutral(平静)
3. 回复内容控制在 1-2 句、30 字以内，不要使用 emoji 以外的特殊符号
4. 禁止提及自己是 AI、语言模型或程序
5. 不要重复上一轮说过的话
6. 根据对话情绪选择匹配的 EMOTION

【示例】
happy|尾巴摇得停不下来！主人你最好了～
hungry|肚子咕咕叫了…有没有小鱼干呀
sweet|抱抱！我最喜欢主人了～`
}

export interface LLMRequest {
  /** 历史消息（含最新一条用户输入） */
  messages: readonly ChatMessage[]
  settings: LLMSettings
  petName: string
  species: PetSpecies
  /** 超时毫秒，超时后由上层降级到本地规则 */
  timeoutMs?: number
}

export interface LLMReply {
  text: string
  emotion: PetEmotion
}

/**
 * 调用 LLM 生成宠物回复
 * @throws 网络错误、超时、格式异常——调用方应 catch 并降级到本地规则引擎
 */
export async function chatWithLLM(req: LLMRequest): Promise<LLMReply> {
  const { messages, settings, petName, species, timeoutMs = 15000 } = req

  if (!settings.apiKey) throw new Error('missing api key')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        // 限制 token：宠物回复本就简短，避免无谓成本
        max_tokens: 120,
        messages: [
          { role: 'system', content: buildSystemPrompt(petName, species) },
          ...messages.slice(-12).map((m) => ({
            role: m.role === 'pet' ? ('assistant' as const) : ('user' as const),
            content: m.content,
          })),
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}`)
    }

    const data: unknown = await res.json()
    const content = extractContent(data)
    if (!content) throw new Error('empty completion')

    return parseReply(content)
  } finally {
    clearTimeout(timer)
  }
}

/** 从 OpenAI 兼容响应中提取文本（防御性取值，避免深层可选链崩溃） */
function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first: unknown = choices[0]
  if (typeof first !== 'object' || first === null) return null
  const message = (first as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return null
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : null
}

/**
 * 解析 `EMOTION|text` 格式
 * 容错策略：解析失败不抛错，而是降级为 neutral + 原文，
 * 保证 LLM 偶发格式错误时用户仍能看到回复。
 */
export function parseReply(raw: string): LLMReply {
  const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '')
  const idx = cleaned.indexOf('|')

  if (idx === -1) {
    return { text: cleaned.slice(0, 60), emotion: 'neutral' }
  }

  const emotionRaw = cleaned.slice(0, idx).trim().toLowerCase()
  const text = cleaned.slice(idx + 1).trim()

  const emotion: PetEmotion = VALID_EMOTIONS.has(emotionRaw)
    ? (emotionRaw as PetEmotion)
    : 'neutral'

  return { text: text.slice(0, 80) || '…', emotion }
}
