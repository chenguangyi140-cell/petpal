import type { MakeupItem, WearableType } from '@/types'

/** 服装分类展示顺序与中文标签（UI 共享元数据，不绑定具体皮肤） */
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
