import type { SkinStrings, SpeciesOption } from '../types'

/** 人物皮肤无需物种细分，直接上传照片，故选项为空（引导阶段跳过选择） */
export const humanSpeciesOptions: readonly SpeciesOption[] = []

/** 人物皮肤 UI 文案 */
export const humanStrings: SkinStrings = {
  appTitle: 'PetPal 人物版',
  appEmoji: '🧑',
  onboardingHero: '创建你的数字人伙伴',
  onboardingSub: '上传一张你的照片，它会成为能陪你聊天、有情绪、懂你的专属伙伴。',
  photoButton: '选择照片',
  createButton: '完成创建',
  tapHint: '点一点，它会回应你～',
  memberLabel: '会员',
  emptyHint: '还没有伙伴，先创建一个吧',
  anchorTuningHint: '微调（多数照片可跳过）',
  entityWord: '伙伴',
  proactiveToggleLabel: '允许TA主动找你聊天',
  resetButtonLabel: '重置伙伴（重新引导）',
  namePlaceholder: '给它起个名字',
}
