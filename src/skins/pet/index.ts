import type { SkinConfig } from '../types'
import { PET_DEFAULT_ANCHORS, estimatePetAnchors } from './anchors'
import { buildPetSystemPrompt } from './prompts'
import { petActionForEmotion } from './actions'
import { petSpeciesOptions, petStrings } from './onboarding'
import { wearables } from './catalog'
import { petRules, petFallbackByEmotion, petProactiveByState, petProactiveByScene } from './chat'
import { petInteractions, petInteractionOrder, petTapFeedback } from './interactions'

/** 宠物皮肤：复刻原 PetPal 全部宠物行为，作为通用框架的第一个皮肤 */
export const petSkin: SkinConfig = {
  id: 'pet',
  displayName: '宠物',
  strings: petStrings,
  defaultAnchors: PET_DEFAULT_ANCHORS,
  estimateAnchors: estimatePetAnchors,
  buildSystemPrompt: buildPetSystemPrompt,
  chat: {
    rules: petRules,
    fallbackByEmotion: petFallbackByEmotion,
    proactiveByState: petProactiveByState,
    proactiveByScene: petProactiveByScene,
  },
  actionForEmotion: petActionForEmotion,
  interactions: petInteractions,
  interactionOrder: petInteractionOrder,
  tapFeedback: petTapFeedback,
  speciesOptions: petSpeciesOptions,
  wearables,
}
