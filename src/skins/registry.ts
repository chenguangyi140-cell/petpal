import type { SkinConfig } from './types'
import { petSkin } from './pet'
import { humanSkin } from './human'

/**
 * 皮肤注册表
 * 新增第三种形象只需在此登记一份 SkinConfig，核心引擎零改动。
 */
const REGISTRY: Record<string, SkinConfig> = {
  pet: petSkin,
  human: humanSkin,
}

/** 全部皮肤 id（可用于「切换皮肤」入口） */
export const SKIN_IDS = ['pet', 'human'] as const

/** 按 id 取皮肤；未知 id 回退到宠物皮肤 */
export function getSkin(id: string | undefined | null): SkinConfig {
  if (!id) return petSkin
  return REGISTRY[id] ?? petSkin
}

export { petSkin, humanSkin }
