import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDeviceId } from '@/services/device'
import { parseCode, type LicensePayload } from '@/services/license'

const DAY = 86_400_000

interface LicenseState {
  /** 本机设备 ID（一个手机一个授权） */
  deviceId: string
  /** 是否已激活且在有效期内 */
  active: boolean
  /** 激活时录入的码（DEMO 模式为 'DEMO'） */
  code: string | null
  /** 过期时间戳（ms） */
  expiresAt: number | null
  /** 激活时间戳（ms） */
  activatedAt: number | null
  /** 最近一次激活的错误信息 */
  error: string | null
  /** 是否强制弹出激活层（用于续费） */
  showActivation: boolean

  /** 用激活码激活；成功返回 true */
  activate: (code: string) => boolean
  /** 开发/演示一键激活（发布前务必移除调用处） */
  activateDemo: (days?: number) => void
  openActivation: () => void
  closeActivation: () => void
  isActive: () => boolean
  /** 剩余天数（向上取整，过期为 0） */
  daysLeft: () => number
  reset: () => void
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      deviceId: getDeviceId(),
      active: false,
      code: null,
      expiresAt: null,
      activatedAt: null,
      error: null,
      showActivation: false,

      activate: (code) => {
        const payload: LicensePayload | null = parseCode(code)
        if (!payload) {
          set({ error: '激活码无效，请检查是否完整、含 PP- 前缀' })
          return false
        }
        const now = Date.now()
        set({
          active: true,
          code: code.trim().toUpperCase(),
          expiresAt: now + payload.days * DAY,
          activatedAt: now,
          error: null,
          showActivation: false,
        })
        return true
      },

      activateDemo: (days = 30) => {
        const now = Date.now()
        set({
          active: true,
          code: 'DEMO',
          expiresAt: now + days * DAY,
          activatedAt: now,
          error: null,
          showActivation: false,
        })
      },

      openActivation: () => set({ showActivation: true, error: null }),
      closeActivation: () => set({ showActivation: false, error: null }),

      isActive: () => {
        const { active, expiresAt } = get()
        return !!active && expiresAt != null && Date.now() < expiresAt
      },

      daysLeft: () => {
        const { expiresAt } = get()
        if (!expiresAt) return 0
        return Math.max(0, Math.ceil((expiresAt - Date.now()) / DAY))
      },

      reset: () =>
        set({
          active: false,
          code: null,
          expiresAt: null,
          activatedAt: null,
          error: null,
          showActivation: false,
        }),
    }),
    {
      name: 'petpal.license',
      version: 1,
      // 仅持久化授权状态，不存 error/showActivation 这类瞬时 UI 状态
      partialize: (s) => ({
        deviceId: s.deviceId,
        active: s.active,
        code: s.code,
        expiresAt: s.expiresAt,
        activatedAt: s.activatedAt,
      }),
    },
  ),
)

/**
 * 订阅式授权状态：除初始化外，每 30s 轮询一次过期时间，
 * 保证到期后能及时弹出续费层。
 */
export function useLicenseActive(): boolean {
  const active = useLicenseStore((s) => s.active)
  const expiresAt = useLicenseStore((s) => s.expiresAt)
  const [ok, setOk] = useState(() => !!active && expiresAt != null && Date.now() < expiresAt)

  useEffect(() => {
    const check = () => setOk(!!active && expiresAt != null && Date.now() < expiresAt)
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [active, expiresAt])

  return ok
}
