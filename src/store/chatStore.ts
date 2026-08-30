import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, PetEmotion, ProactiveTrigger } from '@/types'
import { usePetStore } from './petStore'
import { useSettingsStore } from './settingsStore'
import { generateLocalReply, type ChatContext } from '@/services/chatEngine'
import { chatWithLLM } from '@/services/llm'
import { getSkin } from '@/skins/registry'

const MAX_HISTORY = 100

interface ChatState {
  messages: ChatMessage[]
  /** 正在等待 LLM 响应 */
  pending: boolean
  /** 上次主动发言时间戳 */
  lastProactiveAt: number
  /** 今日已主动发言次数（跨日自动重置） */
  proactiveToday: number
  /** 计数归属日期（YYYY-MM-DD） */
  proactiveDate: string
  /** 上次 LLM 失败时间戳，用于冷却避免每次都卡超时 */
  lastLlmFailureAt: number
}

interface ChatActions {
  send: (text: string) => Promise<void>
  pushPetMessage: (
    content: string,
    opts?: { emotion?: PetEmotion; proactive?: ProactiveTrigger },
  ) => void
  /** 判断当前是否允许主动发言（综合勿扰/上限/冷却） */
  canProactive: () => boolean
  markProactive: () => void
  clear: () => void
}

export type ChatStore = ChatState & ChatActions

const todayKey = (): string => new Date().toISOString().slice(0, 10)

const makeMsg = (
  role: ChatMessage['role'],
  content: string,
  extra?: { emotion?: PetEmotion; proactive?: ProactiveTrigger },
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  ...(extra?.emotion ? { emotion: extra.emotion } : {}),
  ...(extra?.proactive ? { proactive: extra.proactive } : {}),
  timestamp: Date.now(),
})

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      pending: false,
      lastProactiveAt: 0,
      proactiveToday: 0,
      proactiveDate: todayKey(),
      lastLlmFailureAt: 0,

      /** 用户发送消息 → 生成宠物回复（LLM 优先，失败降级本地规则） */
      send: async (text) => {
        const content = text.trim()
        if (!content || get().pending) return

        const pet = usePetStore.getState()
        const settings = useSettingsStore.getState()
        const petName = pet.profile?.name ?? '小暖'
        const skinId = pet.profile?.skin ?? 'pet'
        const skin = getSkin(skinId)

        const ctx: ChatContext = {
          emotion: pet.emotion,
          skin,
          mood: pet.mood,
          petName,
        }

        const userMsg = makeMsg('user', content)
        const history = [...get().messages, userMsg]
        set({ messages: history, pending: true })

        let replyText: string
        let replyEmotion: PetEmotion

        // LLM 冷却：近期失败过则直接走本地规则，避免每次都要等超时
        const llmCoolingDown = Date.now() - get().lastLlmFailureAt < 60_000
        const useLLM = settings.llm.enabled && settings.llm.apiKey && !llmCoolingDown

        if (useLLM) {
          try {
            const reply = await chatWithLLM({
              messages: history,
              settings: settings.llm,
              petName,
              skinId,
            })
            replyText = reply.text
            replyEmotion = reply.emotion
          } catch {
            set({ lastLlmFailureAt: Date.now() })
            const fb = generateLocalReply(content, ctx)
            replyText = fb.text
            replyEmotion = fb.emotion
          }
        } else {
          const fb = generateLocalReply(content, ctx)
          replyText = fb.text
          replyEmotion = fb.emotion
        }

        const petMsg = makeMsg('pet', replyText, { emotion: replyEmotion })
        set((s) => ({
          messages: [...s.messages, petMsg].slice(-MAX_HISTORY),
          pending: false,
        }))

        // 对话本身也是互动：小幅提升亲密度
        pet.addXp(2)
        usePetStore.getState().setEmotion(replyEmotion)
      },

      pushPetMessage: (content, opts) =>
        set((s) => ({
          messages: [...s.messages, makeMsg('pet', content, opts)].slice(-MAX_HISTORY),
        })),

      /**
       * 主动发言准入判定
       * 三重闸门：总开关 → 勿扰时段 → 每日上限 + 最小冷却间隔
       * 任一不通过即静默跳过——宁可少说，不可打扰。
       */
      canProactive: () => {
        const s = get()
        const settings = useSettingsStore.getState()
        if (!settings.proactiveEnabled) return false
        if (settings.isQuietNow()) return false
        if (s.pending) return false

        // 跨日重置计数
        const today = todayKey()
        if (s.proactiveDate !== today) {
          set({ proactiveDate: today, proactiveToday: 0 })
          return true
        }

        if (s.proactiveToday >= settings.dailyProactiveLimit) return false
        // 最小冷却 3 分钟，避免连续轰炸
        return Date.now() - s.lastProactiveAt > 180_000
      },

      markProactive: () =>
        set((s) => ({
          lastProactiveAt: Date.now(),
          proactiveToday: s.proactiveToday + 1,
          proactiveDate: todayKey(),
        })),

      clear: () => set({ messages: [] }),
    }),
    {
      name: 'petpal.chat',
      version: 1,
      partialize: (s) => ({
        messages: s.messages.slice(-50),
        lastProactiveAt: s.lastProactiveAt,
        proactiveToday: s.proactiveToday,
        proactiveDate: s.proactiveDate,
      }),
    },
  ),
)
