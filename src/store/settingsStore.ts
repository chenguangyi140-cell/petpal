import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, LLMSettings } from '@/types'

/** 检测系统「减少动态效果」无障碍偏好 */
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    enabled: false,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    // 0.85 而非 1.0：宠物人设需要稳定性，温度过高容易跳出角色
    temperature: 0.85,
  },
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 7,
  },
  dailyProactiveLimit: 8,
  proactiveEnabled: true,
  reduceMotion: false,
  voice: {
    enabled: true,
    rate: 1.05,
    pitch: 1.12,
    volume: 1,
  },
}

interface SettingsStore extends AppSettings {
  update: (patch: Partial<AppSettings>) => void
  setLLM: (patch: Partial<LLMSettings>) => void
  /** 当前是否处于勿扰时段 */
  isQuietNow: () => boolean
  /** 是否应当减少动画（用户设置 OR 系统偏好，取并集更保守） */
  shouldReduceMotion: () => boolean
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      update: (patch) => set(patch),

      setLLM: (patch) => set((s) => ({ llm: { ...s.llm, ...patch } })),

      /**
       * 勿扰时段判定
       * 需处理跨午夜区间（如 23:00–07:00），不能用简单的 start < now < end
       */
      isQuietNow: () => {
        const { quietHours } = get()
        if (!quietHours.enabled) return false
        const hour = new Date().getHours()
        const { startHour, endHour } = quietHours
        return startHour > endHour
          ? hour >= startHour || hour < endHour // 跨午夜
          : hour >= startHour && hour < endHour
      },

      shouldReduceMotion: () => get().reduceMotion || prefersReducedMotion(),

      reset: () => set({ ...DEFAULT_SETTINGS, reduceMotion: prefersReducedMotion() }),
    }),
    {
      name: 'petpal.settings',
      version: 1,
      // API Key 不落盘：避免写入 localStorage 被第三方脚本读取
      partialize: (s) => ({
        llm: { ...s.llm, apiKey: '' },
        quietHours: s.quietHours,
        dailyProactiveLimit: s.dailyProactiveLimit,
        proactiveEnabled: s.proactiveEnabled,
        reduceMotion: s.reduceMotion,
        voice: s.voice,
      }),
    },
  ),
)
