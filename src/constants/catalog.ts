import type { MakeupItem, PetWearable, WearableType } from '@/types'

/**
 * 服装目录
 *
 * 锚点语义说明（归一化坐标，相对 attachTo 部件的包围盒）：
 * - (0,0) 为部件左上角，(1,1) 为右下角
 * - 允许负值 / >1，表示溢出部件边界（如帽子戴在头顶之上）
 *
 * MVP 阶段用 emoji 承载资产以零美术依赖跑通链路；
 * 生产环境只需把 asset 换成贴图 URL 并把 isEmoji 置 false，渲染层无需改动。
 */
export const WEARABLE_CATALOG: readonly PetWearable[] = [
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

/** 服装分类展示顺序与中文标签 */
export const WEARABLE_CATEGORIES: ReadonlyArray<{ type: WearableType | 'all'; label: string }> = [
  { type: 'all', label: '全部' },
  { type: 'hat', label: '帽子' },
  { type: 'bow', label: '发饰' },
  { type: 'scarf', label: '颈部' },
  { type: 'clothes', label: '服装' },
  { type: 'bag', label: '包袋' },
]

/**
 * 化妆预设
 *
 * blendMode 选择依据：
 * - 腮红/眼影用 multiply：妆容作为「色彩叠加」压在照片上，保留毛发纹理
 * - 唇彩用 softLight：需要高光感，multiply 会显脏
 */
export const MAKEUP_PRESETS: ReadonlyArray<{
  id: string
  label: string
  swatch: string
  items: readonly MakeupItem[]
}> = [
  {
    id: 'natural',
    label: '自然裸妆',
    swatch: '#F9A8D4',
    items: [
      {
        id: 'natural-blush',
        type: 'blush',
        name: '自然腮红',
        color: '#F472B6',
        opacity: 0.32,
        blendMode: 'multiply',
        scale: 0.26,
      },
      {
        id: 'natural-lip',
        type: 'lipgloss',
        name: '裸色唇彩',
        color: '#FCA5A5',
        opacity: 0.25,
        blendMode: 'soft-light',
        scale: 0.18,
      },
    ],
  },
  {
    id: 'sweet',
    label: '甜美蜜桃',
    swatch: '#FB7185',
    items: [
      {
        id: 'sweet-blush',
        type: 'blush',
        name: '蜜桃腮红',
        color: '#FB7185',
        opacity: 0.45,
        blendMode: 'multiply',
        scale: 0.3,
      },
      {
        id: 'sweet-shadow',
        type: 'eyeshadow',
        name: '蜜桃眼影',
        color: '#F9A8D4',
        opacity: 0.35,
        blendMode: 'multiply',
        scale: 0.22,
      },
      {
        id: 'sweet-lip',
        type: 'lipgloss',
        name: '蜜桃唇彩',
        color: '#F87171',
        opacity: 0.35,
        blendMode: 'soft-light',
        scale: 0.2,
      },
    ],
  },
  {
    id: 'elegant',
    label: '优雅紫调',
    swatch: '#A78BFA',
    items: [
      {
        id: 'elegant-shadow',
        type: 'eyeshadow',
        name: '薰衣草眼影',
        color: '#A78BFA',
        opacity: 0.42,
        blendMode: 'multiply',
        scale: 0.26,
      },
      {
        id: 'elegant-blush',
        type: 'blush',
        name: '淡紫腮红',
        color: '#C4B5FD',
        opacity: 0.28,
        blendMode: 'multiply',
        scale: 0.24,
      },
    ],
  },
  {
    id: 'festive',
    label: '节日盛装',
    swatch: '#FBBF24',
    items: [
      {
        id: 'festive-shadow',
        type: 'eyeshadow',
        name: '鎏金眼影',
        color: '#FBBF24',
        opacity: 0.4,
        blendMode: 'multiply',
        scale: 0.28,
      },
      {
        id: 'festive-blush',
        type: 'blush',
        name: '暖阳腮红',
        color: '#F97316',
        opacity: 0.3,
        blendMode: 'multiply',
        scale: 0.28,
      },
      {
        id: 'festive-lip',
        type: 'lipgloss',
        name: '鎏金唇彩',
        color: '#F59E0B',
        opacity: 0.3,
        blendMode: 'soft-light',
        scale: 0.2,
      },
    ],
  },
]

/** 化妆分类元数据：渲染顺序与中文标签 */
export const MAKEUP_TYPES: ReadonlyArray<{
  type: MakeupItem['type']
  label: string
  /** 依赖的锚点，决定妆容绘制位置 */
  anchor: 'eyes' | 'cheeks' | 'mouth'
}> = [
  // 渲染顺序即数组顺序：眼影在最底层，唇彩覆盖在最上层
  { type: 'eyeshadow', label: '眼影', anchor: 'eyes' },
  { type: 'blush', label: '腮红', anchor: 'cheeks' },
  { type: 'lipgloss', label: '唇彩', anchor: 'mouth' },
]

/** 可单独调节的妆容色板 */
export const MAKEUP_COLOR_SWATCHES: readonly string[] = [
  '#F472B6',
  '#FB7185',
  '#FCA5A5',
  '#A78BFA',
  '#C4B5FD',
  '#FBBF24',
  '#F97316',
  '#34D399',
  '#60A5FA',
  '#F87171',
]
