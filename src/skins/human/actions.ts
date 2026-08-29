import type { PetAction, PetEmotion } from '@/types'

/** 人物：愉悦时开心摇摆（无尾），困倦时睡眠，其余待机 */
export function humanActionForEmotion(emotion: PetEmotion): PetAction {
  switch (emotion) {
    case 'happy':
    case 'sweet':
      return 'cheer'
    case 'sleepy':
      return 'sleep'
    default:
      return 'idle'
  }
}
