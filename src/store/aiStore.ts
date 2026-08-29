import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AI 形象生成服务配置
 * 仅保存「本机桥接服务地址」，不保存任何照片/密钥（照片仅运行时经 localhost 传给你的 ComfyUI）。
 */
interface AiStore {
  /** 本机桥接服务地址（默认随仓库提供的 tools/bridge/server.mjs） */
  endpoint: string
  setEndpoint: (v: string) => void
}

const DEFAULT_ENDPOINT = 'http://localhost:8787'

export const useAiStore = create<AiStore>()(
  persist(
    (set) => ({
      endpoint: DEFAULT_ENDPOINT,
      setEndpoint: (v) => set({ endpoint: v.trim().replace(/\/+$/, '') }),
    }),
    { name: 'petpal.ai', version: 1 },
  ),
)
