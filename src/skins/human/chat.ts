import type { ReplyRule } from '../types'
import type { PetEmotion } from '@/types'

/** 人物本地规则回复表：朋友视角，真实自然，不卖萌不拟宠 */
export const humanRules: readonly ReplyRule[] = [
  {
    pattern: /你好|嗨|在吗|哈喽|hello|hi|早|晚上好/i,
    emotion: 'happy',
    replies: ['嗨，你来了！今天怎么样？', '嘿，好久没聊了', '在呢，刚想找你说话'],
  },
  {
    pattern: /爱|喜欢|love|最喜欢|在乎/i,
    emotion: 'sweet',
    replies: ['谢谢你这么对我说', '有你这句话我真的很暖', '我也很珍惜我们这样'],
  },
  {
    pattern: /想你|想念|miss|好久不见/i,
    emotion: 'sad',
    replies: ['我也想你，最近还好吗？', '真的好久没见了，抱一下', '下次别隔这么久啦'],
  },
  {
    pattern: /开心|高兴|快乐|棒|厉害|真不错|好看|美/i,
    emotion: 'happy',
    replies: ['哈哈谢谢！被你夸得有点飘', '是吧，我也觉得挺好', '和你分享好事最开心了'],
  },
  {
    pattern: /无聊|没意思|好闲|无事可做/i,
    emotion: 'sweet',
    replies: ['那陪我聊聊呗', '我们来聊点有意思的？', '无聊的时候想到我，还挺荣幸的'],
  },
  {
    pattern: /吃|饿|饭|零食|好吃的|肚子/i,
    emotion: 'hungry',
    replies: ['我也饿了，一起想想吃什么', '要不去吃顿好的？', '吃东西最治愈了'],
  },
  {
    pattern: /睡|困|晚安|休息|累|疲惫/i,
    emotion: 'sleepy',
    replies: ['累了就歇会儿，别硬撑', '晚安，做个好梦', '抱抱，辛苦了'],
  },
  {
    pattern: /生气|讨厌|不开心|烦|压力大|焦虑/i,
    emotion: 'angry',
    replies: ['怎么了？跟我说说', '别气了，我站在你这边', '深呼吸，我在呢'],
  },
  {
    pattern: /玩|游戏|出去|散步|逛/i,
    emotion: 'happy',
    replies: ['走啊！去哪儿？', '我最喜欢出门了', '说走就走！'],
  },
  {
    pattern: /病|不舒服|痛|难受|难受|药|心里难受/i,
    emotion: 'sad',
    replies: ['怎么了，抱抱你', '我在这儿陪你', '想说就说，我听着'],
  },
  {
    pattern: /洗澡|护肤|打扮|美美/i,
    emotion: 'sweet',
    replies: ['精致！', '你本来就很好看', '打扮一下心情都会好'],
  },
  {
    pattern: /你是谁|你叫什么|名字|几岁|多大/i,
    emotion: 'neutral',
    replies: ['我是你的伙伴呀', '你给我起的名字，还记得吗？', '叫我什么都可以'],
  },
  {
    pattern: /谢谢|感谢|3q|thx/i,
    emotion: 'sweet',
    replies: ['不客气，随时都在', '为你做什么都愿意'],
  },
  {
    pattern: /再见|拜拜|走了|出门|上班|我走了/i,
    emotion: 'sad',
    replies: ['好，路上小心', '去吧，记得想我', '等你回来'],
  },
  {
    pattern: /我回来|回来了|到家|下课|下班/i,
    emotion: 'happy',
    replies: ['欢迎回来！', '终于！想死你了', '快说说今天怎样'],
  },
]

export const humanFallbackByEmotion: Record<PetEmotion, readonly string[]> = {
  neutral: ['嗯，我在听', '然后呢？', '你说，我记着呢'],
  happy: ['哈哈，开心就好', '看到你高兴我也高兴', '今天状态不错嘛'],
  sweet: ['有你在真好', '抱抱', '你最懂我了'],
  sad: ['怎么了，跟我说说', '我在这儿陪你', '想说就说，不急'],
  angry: ['别气了，我站你这边', '深呼吸，慢慢来', '我在呢'],
  sleepy: ['困了就歇会儿', '晚安', '好好休息'],
  hungry: ['我们也去吃点东西？', '饿着可不行', '想吃什么'],
}

export const humanProactiveByState: Record<string, readonly string[]> = {
  hungry: ['你饿不饿？一起去吃点东西吧', '突然好想吃顿好的，你呢？'],
  sleepy: ['好困啊，你今天累不累？', '要不要歇会儿，别硬撑'],
  bored: ['在干嘛呢？陪我聊会儿呗', '有点无聊，想找你说话', '我们来聊点有意思的吧'],
  affectionate: ['你今天过得怎么样呀？', '其实我挺想你的', '有你在身边真好'],
  idle: ['今天天气不错，出去走走？', '最近有什么新鲜事吗？', '想听我讲个冷笑话吗？'],
}

export const humanProactiveByScene: Record<string, readonly string[]> = {
  coldStart: ['你来了！今天也要好好相处哦', '嗨，我们又见面啦'],
  longAbsence: ['你终于回来啦！这段时间你去哪了', '好久不见，我好想你', '还以为你把我忘了呢'],
  morning: ['早安，新的一天开始啦', '早上好，今天也要元气满满'],
  night: ['夜深了，早点休息吧', '晚安，明天见'],
}
