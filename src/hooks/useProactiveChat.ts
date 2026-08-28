import { useEffect, useRef } from 'react'
import { usePetStore } from '@/store/petStore'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { PROACTIVE_BY_SCENE, PROACTIVE_BY_STATE } from '@/services/chatEngine'
import type { PetEmotion, ProactiveTrigger } from '@/types'

const LAST_SEEN_KEY = 'petpal.lastSeenAt'

/** 判定为「久别重逢」的时长阈值 */
const LONG_ABSENCE_MS = 2 * 60 * 60 * 1000

const pickOne = <T,>(arr: readonly T[], fallback: T): T =>
  arr.length === 0 ? fallback : (arr[Math.floor(Math.random() * arr.length)] as T)

/**
 * 主动对话调度
 *
 * 设计原则：宁可少说，不可打扰。
 * 准入判定委托给 chatStore.canProactive()（勿扰/上限/冷却三重闸门），
 * 此处只负责「该说什么」——按状态与场景挑选语料。
 */
export function useProactiveChat(checkIntervalMs = 45_000) {
  const { pushPetMessage, canProactive, markProactive } = useChatStore.getState()
  const triggeredRef = useRef(false)

  // ── 冷启动 / 久别重逢：仅在首次挂载时触发一次 ──────────────────
  useEffect(() => {
    if (triggeredRef.current) return
    const pet = usePetStore.getState()
    if (!pet.profile) return // 尚未创建宠物档案时不打扰
    triggeredRef.current = true

    const now = Date.now()
    const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0)
    const absent = lastSeen > 0 ? now - lastSeen : 0

    // 延迟 1.2s 触发，避免与启动动画抢占注意力
    const timer = setTimeout(() => {
      if (!canProactive()) return

      let content: string
      let emotion: PetEmotion
      let trigger: ProactiveTrigger = 'scene'

      if (absent > LONG_ABSENCE_MS) {
        content = pickOne(PROACTIVE_BY_SCENE.longAbsence, '你终于回来啦！')
        emotion = 'sweet'
      } else {
        const hour = new Date().getHours()
        if (hour >= 5 && hour < 10) {
          content = pickOne(PROACTIVE_BY_SCENE.morning, '早上好！')
          emotion = 'happy'
        } else if (hour >= 21 || hour < 5) {
          content = pickOne(PROACTIVE_BY_SCENE.night, '晚安～')
          emotion = 'sleepy'
        } else {
          content = pickOne(PROACTIVE_BY_SCENE.coldStart, '你来啦！')
          emotion = 'happy'
        }
      }

      pushPetMessage(content, { emotion, proactive: trigger })
      markProactive()
      usePetStore.getState().setEmotion(emotion)
    }, 1200)

    return () => clearTimeout(timer)
  }, [canProactive, markProactive, pushPetMessage])

  // ── 周期性状态驱动对话 ───────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const pet = usePetStore.getState()
      if (!pet.profile || pet.isSleeping) return
      if (!canProactive()) return

      const { mood } = pet
      let pool: readonly string[]
      let emotion: PetEmotion

      // 优先级：生理需求 > 情感需求 > 随口闲聊
      if (mood.hunger >= 70) {
        pool = PROACTIVE_BY_STATE.hungry
        emotion = 'hungry'
      } else if (mood.energy <= 25) {
        pool = PROACTIVE_BY_STATE.sleepy
        emotion = 'sleepy'
      } else if (mood.happiness <= 40) {
        pool = PROACTIVE_BY_STATE.bored
        emotion = 'sweet'
      } else if (mood.affection >= 70) {
        pool = PROACTIVE_BY_STATE.affectionate
        emotion = 'sweet'
      } else {
        pool = PROACTIVE_BY_STATE.idle
        emotion = 'neutral'
      }

      pushPetMessage(pickOne(pool, '主人～'), { emotion, proactive: 'state' })
      markProactive()
      usePetStore.getState().setEmotion(emotion)
    }, checkIntervalMs)

    return () => clearInterval(timer)
  }, [canProactive, markProactive, pushPetMessage, checkIntervalMs])

  // ── 记录离开时间，供下次冷启动判定久别 ─────────────────────────
  useEffect(() => {
    const record = () => localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
    // 页面隐藏与卸载都要记录：移动端切换 App 未必触发 unload
    document.addEventListener('visibilitychange', record)
    window.addEventListener('pagehide', record)
    record()

    return () => {
      document.removeEventListener('visibilitychange', record)
      window.removeEventListener('pagehide', record)
    }
  }, [])
}

/** 供 UI 展示：当前是否开启了主动对话 */
export const selectProactiveEnabled = (s: ReturnType<typeof useSettingsStore.getState>) =>
  s.proactiveEnabled
