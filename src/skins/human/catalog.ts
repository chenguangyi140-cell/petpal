import type { PetWearable } from '@/types'

/**
 * 人物皮肤专属服装目录（与宠物目录完全独立，互不再引用）
 *
 * 复用 SkinConfig 的 WearableType 分类（hat/bow/scarf/clothes/bag），
 * 但单品与锚点均为人物向；进阶可继续追加人物专属资产（如首饰、眼镜链）。
 *
 * 锚点语义同宠物：归一化坐标相对 attachTo 部件包围盒，(0,0) 左上、(1,1) 右下。
 */
export const HUMAN_WEARABLES: readonly PetWearable[] = [
  // ── 头部：帽子 / 墨镜 ───────────────────────────────────────
  {
    id: 'hat-cap',
    name: '休闲鸭舌帽',
    type: 'hat',
    asset: '🧢',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.16 }, scale: 0.5, rotation: 0, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'hat-top',
    name: '绅士礼帽',
    type: 'hat',
    asset: '🎩',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: -0.18 }, scale: 0.52, rotation: 0, attachTo: 'head' },
    rarity: 'epic',
    unlockLevel: 5,
  },
  {
    id: 'hat-sunglasses',
    name: '酷感墨镜',
    type: 'hat',
    asset: '🕶️',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.02 }, scale: 0.42, rotation: 0, attachTo: 'head' },
    rarity: 'rare',
    unlockLevel: 3,
  },

  // ── 头部：发饰 ──────────────────────────────────────────────
  {
    id: 'bow-flower',
    name: '花朵发夹',
    type: 'bow',
    asset: '🌸',
    isEmoji: true,
    anchor: { relativePos: { x: 0.24, y: 0.06 }, scale: 0.3, rotation: -0.15, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'bow-ribbon',
    name: '缎带发带',
    type: 'bow',
    asset: '🎀',
    isEmoji: true,
    anchor: { relativePos: { x: 0.78, y: 0.05 }, scale: 0.3, rotation: 0.15, attachTo: 'head' },
    rarity: 'common',
    unlockLevel: 0,
  },

  // ── 颈部：围巾 / 领带 ───────────────────────────────────────
  {
    id: 'scarf-knit',
    name: '针织围巾',
    type: 'scarf',
    asset: '🧣',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.12 }, scale: 0.6, rotation: 0, attachTo: 'neck' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'scarf-tie',
    name: '商务领带',
    type: 'scarf',
    asset: '👔',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.14 }, scale: 0.36, rotation: 0, attachTo: 'neck' },
    rarity: 'rare',
    unlockLevel: 2,
  },

  // ── 身体：服装 ──────────────────────────────────────────────
  {
    id: 'clothes-coat',
    name: '气质风衣',
    type: 'clothes',
    asset: '🧥',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.55 }, scale: 0.82, rotation: 0, attachTo: 'body' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'clothes-shirt',
    name: '清爽衬衫',
    type: 'clothes',
    asset: '👚',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.55 }, scale: 0.78, rotation: 0, attachTo: 'body' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'clothes-dress',
    name: '优雅连衣裙',
    type: 'clothes',
    asset: '👗',
    isEmoji: true,
    anchor: { relativePos: { x: 0.5, y: 0.6 }, scale: 0.78, rotation: 0, attachTo: 'body' },
    rarity: 'rare',
    unlockLevel: 4,
  },

  // ── 身体：包袋 ──────────────────────────────────────────────
  {
    id: 'bag-hand',
    name: '手提包',
    type: 'bag',
    asset: '👜',
    isEmoji: true,
    anchor: { relativePos: { x: 0.86, y: 0.52 }, scale: 0.36, rotation: 0, attachTo: 'body' },
    rarity: 'common',
    unlockLevel: 0,
  },
  {
    id: 'bag-backpack',
    name: '通勤双肩包',
    type: 'bag',
    asset: '🎒',
    isEmoji: true,
    anchor: { relativePos: { x: 0.14, y: 0.55 }, scale: 0.42, rotation: 0, attachTo: 'body' },
    rarity: 'rare',
    unlockLevel: 3,
  },
] as const

/** 人物皮肤的服装目录（SkinConfig.wearables 直接消费） */
export const wearables = HUMAN_WEARABLES
