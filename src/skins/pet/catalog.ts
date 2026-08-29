import type { PetWearable } from '@/types'

/**
 * 宠物皮肤专属服装目录（不再引用共享常量，完全自含）
 *
 * 锚点语义（归一化坐标，相对 attachTo 部件的包围盒）：
 * - (0,0) 为部件左上角，(1,1) 为右下角
 * - 允许负值 / >1，表示溢出部件边界（如帽子戴在头顶之上）
 *
 * MVP 阶段用 emoji 承载资产以零美术依赖跑通链路；
 * 生产环境只需把 asset 换成贴图 URL 并把 isEmoji 置 false，渲染层无需改动。
 */
export const PET_WEARABLES: readonly PetWearable[] = [
  // ── 头部：帽子 ──────────────────────────────────────────────
  {
    id: 'hat-party',
    name: '派对礼帽',
    type: 'hat',
    asset: '🎩',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.18 }, scale: 0.55, rotation: 0, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'hat-crown',
    name: '闪耀皇冠',
    type: 'hat',
    asset: '👑',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.16 }, scale: 0.5, rotation: 0, attachTo: 'head' },
    rarity: 'epic',
    unlockLevel: 5,
  },
  {
    id: 'hat-bucket',
    name: '休闲渔夫帽',
    type: 'hat',
    asset: '🧢',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.14 }, scale: 0.52, rotation: 0, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'hat-winter',
    name: '冬日毛线帽',
    type: 'hat',
    asset: '🎅',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.17 }, scale: 0.48, rotation: 0, attachTo: 'head' },
    rarity: 'rare',
    unlockLevel: 3,
  },

  // ── 头部：蝴蝶结 ────────────────────────────────────────────
  {
    id: 'bow-pink',
    name: '粉色蝴蝶结',
    type: 'bow',
    asset: '🎀',
    isEmoji: true,
    anchor: { relativePos: { x: 0.22, y: 0.08 }, scale: 0.32, rotation: -0.2, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'bow-ribbon',
    name: '缎带发饰',
    type: 'bow',
    asset: '💝',
    isEmoji: true,
    anchor: { relativePos: { x: 0.78, y: 0.08 }, scale: 0.3, rotation: 0.2, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },

  // ── 颈部：围巾 ──────────────────────────────────────────────
  {
    id: 'scarf-red',
    name: '红色围巾',
    type: 'scarf',
    asset: '🧣',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.12 }, scale: 0.62, rotation: 0, attachTo: 'neck' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'scarf-star',
    name: '星星围脖',
    type: 'scarf',
    asset: '⭐',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.14 }, scale: 0.34, rotation: 0, attachTo: 'neck' },
    rarity: 'rare',
    unlockLevel: 2,
  },

  // ── 身体：衣服 ──────────────────────────────────────────────
  {
    id: 'clothes-sweater',
    name: '针织毛衣',
    type: 'clothes',
    asset: '🧥',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.55 }, scale: 0.8, rotation: 0, attachTo: 'body' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'clothes-dress',
    name: '优雅小裙',
    type: 'clothes',
    asset: '👗',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.6 }, scale: 0.75, rotation: 0, attachTo: 'body' },
    rarity: 'rare',
    unlockLevel: 4,
  },

  // ── 身体：包包（挂身体侧后方） ───────────────────────────────
  {
    id: 'bag-hand',
    name: '小手袋',
    type: 'bag',
    asset: '👜',
    isEmoji: true,
    anchor: { relativePos: { x: 0.88, y: 0.52 }, scale: 0.36, rotation: 0, attachTo: 'body' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'bag-backpack',
    name: '探险背包',
    type: 'bag',
    asset: '🎒',
    isEmoji: true,
    anchor: { relativePos: { x: 0.12, y: 0.55 }, scale: 0.42, rotation: 0, attachTo: 'body' },
    rarity: 'rare',
    unlockLevel: 3,
  },
] as const

/** 宠物皮肤的服装目录（SkinConfig.wearables 直接消费） */
export const wearables = PET_WEARABLES
