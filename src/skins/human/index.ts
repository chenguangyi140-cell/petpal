import type { SkinConfig } from '../types'
import { HUMAN_DEFAULT_ANCHORS, estimateHumanAnchors } from './anchors'
import { buildHumanSystemPrompt } from './prompts'
import { humanActionForEmotion } from './actions'
import { humanSpeciesOptions, humanStrings } from './onboarding'
import { wearables } from './catalog'
import { humanRules, humanFallbackByEmotion, humanProactiveByState, humanProactiveByScene } from './chat'
import { humanInteractions, humanInteractionOrder, humanTapFeedback } from './interactions'

/** 人物皮肤：通用形象框架之上的「数字人伙伴」皮肤，复用全部引擎 */
export const humanSkin: SkinConfig = {
  id: 'human',
  displayName: '人物',
  strings: humanStrings,
  defaultAnchors: HUMAN_DEFAULT_ANCHORS,
  estimateAnchors: estimateHumanAnchors,
  buildSystemPrompt: buildHumanSystemPrompt,
  chat: {
    rules: humanRules,
    fallbackByEmotion: humanFallbackByEmotion,
    proactiveByState: humanProactiveByState,
    proactiveByScene: humanProactiveByScene,
  },
  actionForEmotion: humanActionForEmotion,
  interactions: humanInteractions,
  interactionOrder: humanInteractionOrder,
  tapFeedback: humanTapFeedback,
  speciesOptions: humanSpeciesOptions,
  wearables,
}
