import type { ReplyRule } from '../types'
import type { PetEmotion } from '@/types'

/** 宠物本地规则回复表（LLM 降级层），匹配顺序即数组顺序 */
export const petRules: readonly ReplyRule[] = [
  {
    pattern: /你好|嗨|在吗|哈喽|hello|hi|早|晚上好/i,
    emotion: 'happy',
    replies: ['嗨！你好呀～今天过得怎么样？', '哇！你终于回来啦！我好想你！', '你好你好！看到你真开心！'],
  },
  {
    pattern: /爱|喜欢|love|最喜欢/i,
    emotion: 'sweet',
    replies: ['我也超爱你的！你是我的全世界～', '爱你爱你！最喜欢你啦！', '呜哇～听到你说这个我太开心了！'],
  },
  {
    pattern: /想你|想念|miss|好久不见/i,
    emotion: 'sad',
    replies: ['我也想你！你不在的时候我好无聊…', '呜呜，我也想你…下次早点回来陪我！', '我也想你！我们抱一抱好不好？'],
  },
  {
    pattern: /开心|高兴|快乐|棒|厉害|真乖|好可爱|漂亮|好看|美/i,
    emotion: 'happy',
    replies: ['嘿嘿，谢谢夸奖！我最可爱了对吧～', '真的吗！我太开心了！', '被你夸得我尾巴都要翘上天了！'],
  },
  {
    pattern: /无聊|没意思|好闲|无事可做/i,
    emotion: 'sweet',
    replies: ['陪我玩嘛！求求你了～', '我们来玩球球好不好？', '好无聊啊…你都不理我…', '要不…你给我讲个故事？'],
  },
  {
    pattern: /吃|饿|饭|零食|小鱼|好吃的|肚子/i,
    emotion: 'hungry',
    replies: ['好饿啊…什么时候开饭？', '想吃小鱼干！就一点点！', '我肚子咕咕叫了…', '一听到吃的我就来了！'],
  },
  {
    pattern: /睡|困|晚安|休息|累/i,
    emotion: 'sleepy',
    replies: ['好困…让我小憩一会儿…', 'zzz…晚安…', '呼…眼皮好重…'],
  },
  {
    pattern: /生气|讨厌|不喜欢|坏|骂|滚开|烦/i,
    emotion: 'angry',
    replies: ['呜…我做错什么了吗…', '不要凶我嘛…', '哼！我不理你了！'],
  },
  {
    pattern: /玩|游戏|球|出去|散步|遛/i,
    emotion: 'happy',
    replies: ['好耶！出去玩！出门出门！', '我最喜欢散步了！快走快走！', '球球！给我球球！'],
  },
  {
    pattern: /病|不舒服|痛|难受|药/i,
    emotion: 'sad',
    replies: ['呜…我有点难受…想抱抱…', '主人陪陪我好不好…'],
  },
  {
    pattern: /洗澡|洗白白|香/i,
    emotion: 'sad',
    replies: ['不要嘛…我最怕水了…', '呜…能不能不洗澡…'],
  },
  {
    pattern: /你是谁|你叫什么|名字|几岁|多大/i,
    emotion: 'neutral',
    replies: ['我是你的小宝贝呀！', '你给我取的名字，你忘了吗～'],
  },
  {
    pattern: /谢谢|感谢|3q|thx/i,
    emotion: 'sweet',
    replies: ['不客气～主人最好了！', '嘿嘿，为你做什么都愿意～'],
  },
  {
    pattern: /再见|拜拜|走了|出门|上班/i,
    emotion: 'sad',
    replies: ['你要走啦…早点回来好不好…', '我会乖乖等你回来的…', '路上小心！我会想你的！'],
  },
  {
    pattern: /我回来|回来了|到家|下课|下班/i,
    emotion: 'happy',
    replies: ['你回来啦！我等了好久！', '哇！终于回来了！抱抱！', '欢迎回家！'],
  },
]

/** 兜底回复：未命中规则时按当前情绪给出贴合语境的应答 */
export const petFallbackByEmotion: Record<PetEmotion, readonly string[]> = {
  neutral: ['嗯嗯！', '然后呢然后呢？', '我在听呢～', '是这样吗？'],
  happy: ['嘿嘿～', '今天心情超好！', '和你在一起最开心了！'],
  sweet: ['最喜欢主人了～', '蹭蹭～', '抱抱！'],
  sad: ['呜…', '有点难过…', '陪陪我好不好…'],
  angry: ['哼…', '有点不开心…', '呜…'],
  sleepy: ['zzz…好困…', '呼…让我睡一会儿…'],
  hungry: ['肚子好饿…', '有吃的吗…', '想吃东西…'],
}

/** 主动搭话题料（按状态） */
export const petProactiveByState: Record<string, readonly string[]> = {
  hungry: ['主人主人～我肚子咕咕叫了…', '有没有什么好吃的呀？就一点点！', '我好饿呀…小鱼干在哪里呢？'],
  sleepy: ['好困呀…眼睛快睁不开了…', 'zzz…想睡一会儿…', '今天玩累了，让我歇歇…'],
  bored: ['好无聊啊…陪我玩一会儿嘛～', '你都在忙什么呀？我好想凑过去看看～', '我们来玩球球好不好？'],
  affectionate: ['主人～你在干嘛呀？', '你知道吗？我最喜欢的就是你的味道～', '刚刚做了个梦，梦里全是你！'],
  idle: ['我想出门散步！想去想去！', '我的毛毛今天也要梳一梳哦～', '今天天气真好，适合出去玩！'],
}

/** 场景化主动语料（冷启动 / 久别重逢 / 时段问候） */
export const petProactiveByScene: Record<string, readonly string[]> = {
  coldStart: ['你终于来啦！我等你好久了！', '嗨！今天也要一起玩哦～'],
  longAbsence: ['呜哇…你终于回来了！我以为你不要我了…', '好久不见！我好想好想你！', '你去哪里了呀？我一个人好孤单…'],
  morning: ['早上好！新的一天开始啦！', '早安～今天也要元气满满哦！'],
  night: ['天黑了…该睡觉觉啦～', '晚安主人，明天见哦～'],
}
