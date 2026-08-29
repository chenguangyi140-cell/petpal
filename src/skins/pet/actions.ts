import type { PetAction, PetEmotion } from '@/types'

/** 宠物：愉悦时摇尾，困倦时睡眠，其余收敛为待机 */
export function petActionForEmotion(emotion: PetEmotion): PetAction {
  switch (emotion) {
    case 'happy':
    case 'sweet':
      return 'wagTail'
    case 'sleepy':
      return 'sleep'
    default:
      return 'idle'
  }
}
