import type { ChatMessage, LLMSettings, PetEmotion } from '@/types'
import { getSkin } from '@/skins/registry'

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

/** 系统提示词由皮肤提供（宠物/人物人设不同），不再在此硬编码 */

export interface LLMRequest {
  /** 历史消息（含最新一条用户输入） */
  messages: readonly ChatMessage[]
  settings: LLMSettings
  petName: string
  /** 形象皮肤 id，决定对话人设 */
  skinId: string
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
  const { messages, settings, petName, skinId, timeoutMs = 15000 } = req

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
          { role: 'system', content: getSkin(skinId).buildSystemPrompt(petName) },
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
