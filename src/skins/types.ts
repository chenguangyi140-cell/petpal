import type { ComponentType } from 'react'
import type { PetAction, PetAnchors, PetEmotion, MoodState, PetWearable } from '@/types'

/**
 * 互动类型（两皮肤共用 8 个互动槽位，但具体定义由各自皮肤提供）
 * 放在框架层，使 pet/ 与 human/ 都从本文件取类型，互不依赖。
 */
export type InteractionKind = 'pet' | 'feed' | 'play' | 'groom' | 'rest' | 'bath' | 'photo' | 'train'

/** 互动定义：数值与文案集中管理，便于平衡性调优 */
export interface InteractionDef {
  label: string
  /** 图标（emoji 占位，UI 层统一换成 lucide SVG） */
  glyph: string
  /** 心情增量 */
  delta: Partial<MoodState>
  /** 触发的肢体动作 */
  action: PetAction
  /** 奖励经验 */
  xp: number
  /** 该互动下皮肤可能的情绪 */
  emotion: PetEmotion
  /** 候选回复文案 */
  replies: readonly string[]
}

/** 皮肤相关的 UI 文案（避免界面写死「宠物」字样） */
export interface SkinStrings {
  appTitle: string
  /** 顶栏装饰 emoji（宠物🐾 / 人物🧑），由皮肤提供 */
  appEmoji: string
  onboardingHero: string
  onboardingSub: string
  photoButton: string
  createButton: string
  tapHint: string
  memberLabel: string
  emptyHint: string
  anchorTuningHint: string
  /** 称呼词：宠物=「宠物」/ 人物=「伙伴」，用于无障碍标签、设置页档案行与重置按钮 */
  entityWord: string
  /** 主动互动开关文案 */
  proactiveToggleLabel: string
  /** 重置（重新引导）按钮文案 */
  resetButtonLabel: string
  /** 引导起名输入框占位符 */
  namePlaceholder: string
}

/** 引导阶段可选的「形象细分」（宠物=猫/狗；人物可留空=直接上传） */
export interface SpeciesOption {
  id: string
  label: string
  Icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

/** 本地规则回复的单条规则（LLM 降级层） */
export interface ReplyRule {
  pattern: RegExp
  emotion: PetEmotion
  replies: readonly string[]
}

/** 对话语料包：每个皮肤持有独立人格文案，引擎通过 skin.chat 读取 */
export interface ChatCorpus {
  rules: readonly ReplyRule[]
  fallbackByEmotion: Readonly<Record<PetEmotion, readonly string[]>>
  proactiveByState: Readonly<Record<string, readonly string[]>>
  proactiveByScene: Readonly<Record<string, readonly string[]>>
}

/**
 * 皮肤配置契约
 *
 * 通用形象框架（渲染引擎 / 情绪状态机 / 持久化）完全不感知「宠物还是人物」，
 * 所有差异都收敛到一份 SkinConfig：锚点比例、对话人格、互动表、动作映射、引导文案、服装目录。
 * 新增第三种形象只需再写一个 SkinConfig 注册进 registry，核心代码零改动。
 */
export interface SkinConfig {
  id: SkinId
  displayName: string
  strings: SkinStrings
  /** 默认锚点（无照片 / 自动标定失败时回退），由皮肤按自身比例提供 */
  defaultAnchors: PetAnchors
  /** 依据去背图估算锚点（不同形象的头身比不同，算法各异） */
  estimateAnchors: (dataUrl: string) => Promise<PetAnchors>
  /** 构建对话系统提示词，锁定人设与输出格式 */
  buildSystemPrompt: (name: string) => string
  /** 对话语料包（LLM 不可用时的降级与主动搭话） */
  chat: ChatCorpus
  /** 情绪 → 建议肢体动作 的映射（宠物摇尾、人物摇摆/挥手） */
  actionForEmotion: (emotion: PetEmotion) => PetAction
  /** 互动定义与展示顺序 */
  interactions: Record<InteractionKind, InteractionDef>
  interactionOrder: readonly InteractionKind[]
  /** 点击形象本体的轻量反馈 */
  tapFeedback: { delta: Partial<MoodState>; xp: number; replies: readonly string[] }
  /** 引导阶段物种细分选项（人物传空数组则跳过选择） */
  speciesOptions: readonly SpeciesOption[]
  /** 该皮肤的服装目录 */
  wearables: readonly PetWearable[]
}

import type { SkinId } from '@/types'
