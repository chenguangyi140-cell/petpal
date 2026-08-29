import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  MakeupItem,
  MoodState,
  PetAction,
  PetAnchors,
  PetEmotion,
  PetProfile,
  PetSpecies,
  SkinId,
  WearableOffset,
  WearableType,
} from '@/types'
import {
  DEFAULT_MOOD,
  applyMoodDelta,
  decayMood,
  deriveEmotion,
} from '@/engine/emotion'
export { computeBondLevel } from '@/engine/emotion'
import type { InteractionKind } from '@/skins/types'
import { MAKEUP_PRESETS } from '@/constants/catalog'
import { ASSET_KEYS, deleteAsset, loadAsset, saveAsset } from '@/services/storage'
import { getSkin } from '@/skins/registry'

/** 随机取一项（数组为空时返回兜底值，避免 undefined 扩散） */
const pick = <T,>(arr: readonly T[], fallback: T): T =>
  arr.length === 0 ? fallback : (arr[Math.floor(Math.random() * arr.length)] as T)

interface PetState {
  profile: PetProfile | null
  mood: MoodState
  emotion: PetEmotion
  action: PetAction
  xp: number
  /** 已穿戴：分类 → 单品 id（存 id 而非对象，避免目录更新后数据错位） */
  equipped: Partial<Record<WearableType, string>>
  /** 单品微调偏移：键为 `${type}@${id}` */
  wearableOffsets: Record<string, WearableOffset>
  makeup: MakeupItem[]
  isSleeping: boolean
  /** 上次衰减时间戳，用于离线期间的状态补算 */
  lastTickAt: number
  /** 资产是否已完成 IndexedDB 水合 */
  hydrated: boolean
}

interface PetActions {
  hydrate: () => Promise<void>
  createProfile: (name: string, skin?: SkinId, species?: PetSpecies) => void
  updateProfile: (patch: Partial<Omit<PetProfile, 'cutoutDataUrl' | 'originalDataUrl'>>) => void
  setCutout: (dataUrl: string | null, original?: string | null) => Promise<void>
  setAnchors: (anchors: PetAnchors) => void
  renamePet: (name: string) => void
  removePet: () => Promise<void>

  tick: () => void
  interact: (kind: InteractionKind) => string
  tap: () => string
  playAction: (action: PetAction) => void
  setEmotion: (emotion: PetEmotion) => void
  setSleeping: (v: boolean) => void
  addXp: (n: number) => void

  equip: (wearableId: string) => void
  unequip: (type: WearableType) => void
  adjustWearable: (type: WearableType, offset: { dx?: number; dy?: number; scale?: number; rotation?: number }) => void

  applyMakeupPreset: (presetId: string | null) => void
  setMakeupItem: (item: MakeupItem) => void
  clearMakeup: () => void

  reset: () => void
}

export type PetStore = PetState & PetActions

const createInitialProfile = (
  name: string,
  skin: SkinId = 'pet',
  species: PetSpecies = 'cat',
): PetProfile => ({
  id: crypto.randomUUID(),
  name,
  skin,
  species,
  cutoutDataUrl: null,
  originalDataUrl: null,
  anchors: null,
  calibrated: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const initialState: PetState = {
  profile: null,
  mood: DEFAULT_MOOD,
  emotion: 'neutral',
  action: 'idle',
  xp: 0,
  equipped: {},
  wearableOffsets: {},
  makeup: [],
  isSleeping: false,
  lastTickAt: Date.now(),
  hydrated: false,
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      /** 从 IndexedDB 恢复照片资产（dataURL 过大，不进 localStorage） */
      hydrate: async () => {
        const [cutout, original] = await Promise.all([
          loadAsset(ASSET_KEYS.cutout),
          loadAsset(ASSET_KEYS.original),
        ])
        set((s) => ({
          hydrated: true,
          profile: s.profile
            ? { ...s.profile, cutoutDataUrl: cutout, originalDataUrl: original }
            : null,
        }))
      },

      createProfile: (name, skin = 'pet', species = 'cat') =>
        set({
          profile: createInitialProfile(name, skin, species),
          mood: DEFAULT_MOOD,
          emotion: 'happy',
          xp: 0,
          lastTickAt: Date.now(),
        }),

      updateProfile: (patch) =>
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch, updatedAt: Date.now() } } : s)),

      setCutout: async (dataUrl, original = null) => {
        if (dataUrl) await saveAsset(ASSET_KEYS.cutout, dataUrl)
        else await deleteAsset(ASSET_KEYS.cutout)

        if (original) await saveAsset(ASSET_KEYS.original, original)

        set((s) =>
          s.profile
            ? {
                profile: {
                  ...s.profile,
                  cutoutDataUrl: dataUrl,
                  originalDataUrl: original ?? s.profile.originalDataUrl,
                  updatedAt: Date.now(),
                },
              }
            : s,
        )
      },

      setAnchors: (anchors) =>
        set((s) =>
          s.profile
            ? { profile: { ...s.profile, anchors, calibrated: true, updatedAt: Date.now() } }
            : s,
        ),

      renamePet: (name) =>
        set((s) => (s.profile ? { profile: { ...s.profile, name, updatedAt: Date.now() } } : s)),

      removePet: async () => {
        await Promise.all([deleteAsset(ASSET_KEYS.cutout), deleteAsset(ASSET_KEYS.original)])
        set({ ...initialState, hydrated: true })
      },

      /**
       * 时间推进：按真实经过时间衰减，而非固定步长。
       * 这保证了隔天打开 App 时宠物状态是连续演化的（离线也饥饿/低落），
       * 而不是「每次打开都从满状态重新开始」这种破坏沉浸感的做法。
       */
      tick: () => {
        const { lastTickAt, mood, emotion, isSleeping } = get()
        const now = Date.now()
        const elapsed = now - lastTickAt
        if (elapsed < 1000) return

        const nextMood = decayMood(mood, elapsed)
        const nextEmotion = deriveEmotion(nextMood, emotion, isSleeping)
        set({
          mood: nextMood,
          emotion: nextEmotion,
          action: isSleeping ? 'sleep' : getSkin(get().profile?.skin ?? 'pet').actionForEmotion(nextEmotion),
          lastTickAt: now,
        })
      },

      interact: (kind) => {
        const skin = getSkin(get().profile?.skin ?? 'pet')
        const def = skin.interactions[kind]
        const { mood, emotion, xp, isSleeping } = get()

        // 睡眠中仅允许「休息」唤醒之外的互动被忽略，避免状态机冲突
        if (isSleeping && kind !== 'rest') {
          return 'zzz…让我再睡一会儿…'
        }

        const nextMood = applyMoodDelta(mood, def.delta)
        const nextEmotion = deriveEmotion(nextMood, emotion)

        set({
          mood: nextMood,
          emotion: nextEmotion,
          action: def.action,
          xp: xp + def.xp,
          isSleeping: kind === 'rest',
          lastTickAt: Date.now(),
        })

        // 休息：5 秒后自动醒来，避免卡在睡眠态
        if (kind === 'rest') {
          setTimeout(() => {
            const s = get()
            if (!s.isSleeping) return
            const woken = applyMoodDelta(s.mood, { energy: 6 })
            set({
              isSleeping: false,
              mood: woken,
              emotion: deriveEmotion(woken, s.emotion, false),
              action: 'idle',
            })
          }, 5000)
        }

        return pick(def.replies, '…')
      },

      tap: () => {
        const skin = getSkin(get().profile?.skin ?? 'pet')
        const { mood, emotion, xp, isSleeping } = get()
        if (isSleeping) return 'zzz…'

        const nextMood = applyMoodDelta(mood, skin.tapFeedback.delta)
        set({
          mood: nextMood,
          emotion: deriveEmotion(nextMood, emotion),
          xp: xp + skin.tapFeedback.xp,
        })
        return pick(skin.tapFeedback.replies, '…')
      },

      playAction: (action) => set({ action }),

      setEmotion: (emotion) => set({ emotion, action: getSkin(get().profile?.skin ?? 'pet').actionForEmotion(emotion) }),

      setSleeping: (v) =>
        set((s) => ({
          isSleeping: v,
          action: v ? 'sleep' : 'idle',
          emotion: v ? 'sleepy' : deriveEmotion(s.mood, s.emotion, false),
        })),

      addXp: (n) => set((s) => ({ xp: s.xp + n })),

      equip: (wearableId) => {
        const skin = getSkin(get().profile?.skin ?? 'pet')
        const item = skin.wearables.find((w) => w.id === wearableId)
        if (!item) return
        set((s) => ({
          equipped: { ...s.equipped, [item.type]: wearableId },
        }))
      },

      unequip: (type) =>
        set((s) => {
          const next = { ...s.equipped }
          delete next[type]
          return { equipped: next }
        }),

      /** 服装微调：合并到已有的 userOffset，支持渐进调整 */
      adjustWearable: (type, offset) =>
        set((s) => {
          const id = s.equipped[type]
          if (!id) return s
          const key = `${type}@${id}`
          const prev = s.wearableOffsets[key] ?? { dx: 0, dy: 0, scale: 1, rotation: 0 }
          return {
            wearableOffsets: {
              ...s.wearableOffsets,
              [key]: {
                dx: prev.dx + (offset.dx ?? 0),
                dy: prev.dy + (offset.dy ?? 0),
                scale: Math.min(2, Math.max(0.4, prev.scale * (offset.scale ?? 1))),
                rotation: prev.rotation + (offset.rotation ?? 0),
              },
            },
          }
        }),

      applyMakeupPreset: (presetId) => {
        if (!presetId) {
          set({ makeup: [] })
          return
        }
        const preset = MAKEUP_PRESETS.find((p) => p.id === presetId)
        set({ makeup: preset ? [...preset.items] : [] })
      },

      setMakeupItem: (item) =>
        set((s) => {
          // 同类型替换，保持「一类妆容只有一项」的渲染假设
          const rest = s.makeup.filter((m) => m.type !== item.type)
          return { makeup: [...rest, item] }
        }),

      clearMakeup: () => set({ makeup: [] }),

      reset: () => set({ ...initialState, hydrated: true }),
    }),
    {
      name: 'petpal.pet',
      version: 1,
      // 照片不进 localStorage：体积大且已由 IndexedDB 单独管理
      partialize: (s) => ({
        profile: s.profile
          ? { ...s.profile, cutoutDataUrl: null, originalDataUrl: null }
          : null,
        mood: s.mood,
        emotion: s.emotion,
        xp: s.xp,
        equipped: s.equipped,
        wearableOffsets: s.wearableOffsets,
        makeup: s.makeup,
        isSleeping: s.isSleeping,
        lastTickAt: s.lastTickAt,
      }),
    },
  ),
)
