import { Cat, Dog, PawPrint } from 'lucide-react'
import type { SkinStrings, SpeciesOption } from '../types'

/** 宠物引导阶段支持的物种细分（猫 / 狗 / 其他） */
export const petSpeciesOptions: readonly SpeciesOption[] = [
  { id: 'cat', label: '猫咪', Icon: Cat },
  { id: 'dog', label: '狗狗', Icon: Dog },
  { id: 'other', label: '其他', Icon: PawPrint },
]

/** 宠物皮肤 UI 文案 */
export const petStrings: SkinStrings = {
  appTitle: 'PetPal',
  appEmoji: '🐾',
  onboardingHero: '认识你的宠物伙伴',
  onboardingSub: '上传一张它的照片，它会成为能陪你聊天、有情绪、会撒娇的专属伙伴。',
  photoButton: '选择宠物照片',
  createButton: '完成创建',
  tapHint: '摸摸它，它会回应你～',
  memberLabel: '会员',
  emptyHint: '还没有宠物伙伴，先创建一个吧',
  anchorTuningHint: '微调（多数照片可跳过）',
  entityWord: '宠物',
  proactiveToggleLabel: '允许宠物主动找你聊天',
  resetButtonLabel: '重置宠物（重新引导）',
  namePlaceholder: '给它起个名字',
}
