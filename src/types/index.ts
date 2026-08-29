/**
 * PetPal 核心领域模型
 *
 * 设计要点：所有空间坐标一律采用「归一化」表示（0–1 相对比例），
 * 而非绝对像素。这是解决「任意姿态的照片都能正确佩戴服装」的关键——
 * 用户照片尺寸、宠物体型千差万别，绝对坐标必然穿模。
 */

/** 二维点（归一化坐标 0–1，相对参考包围盒） */
export interface Point {
  x: number
  y: number
}

/** 矩形包围盒（归一化 0–1，相对整块画布） */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 宠物种类（仅在宠物皮肤内用于引导阶段的物种细分） */
export type PetSpecies = 'cat' | 'dog' | 'other'

/**
 * 形象皮肤：通用形象框架之上的「宠物 / 人物」两套外观与人格。
 * 引擎与 UI 通过 profile.skin 从皮肤注册表读取对应配置，
 * 从而在不改写核心渲染/情绪逻辑的前提下切换形象类型。
 */
export type SkinId = 'pet' | 'human'

/** 身体挂靠部件 */
export type BodyPart = 'body' | 'head' | 'neck' | 'tail'

/**
 * 情绪枚举
 * 由 EmotionEngine 从四维心情值推导，同时驱动表情层、肢体动作与对话语气
 */
export type PetEmotion =
  | 'neutral' // 平静
  | 'happy' // 开心
  | 'sad' // 难过
  | 'angry' // 生气
  | 'sweet' // 撒娇
  | 'sleepy' // 困倦
  | 'hungry' // 饥饿

/**
 * 四维心情值（0–100）
 * 采用「时间衰减 + 互动增益 + 事件驱动」三重机制演进
 */
export interface MoodState {
  /** 开心度：随时间缓慢衰减，互动提升 */
  happiness: number
  /** 精力：互动消耗，休息恢复 */
  energy: number
  /** 亲密度：长期累积，极缓慢衰减 */
  affection: number
  /** 饥饿度：随时间增长，喂食清零 */
  hunger: number
}

/** 心情维度键 */
export type MoodDimension = keyof MoodState

/**
 * 锚点配置
 * 服装按归一化包围盒坐标定位，并提供用户微调偏移量
 */
export interface AnchorConfig {
  /** 相对挂靠部件包围盒的归一化坐标（0–1） */
  relativePos: Point
  /** 基准缩放系数（相对挂靠部件尺寸） */
  scale: number
  /** 基准旋转角度（弧度） */
  rotation: number
  /** 挂靠的部件，决定跟随哪个部件变换 */
  attachTo: BodyPart
  /**
   * 用户微调偏移（叠加在基准值之上）
   * 解决不同姿态照片的个体差异，由拖拽 UI 产生
   */
  userOffset?: {
    dx: number
    dy: number
    scale: number
    rotation: number
  }
}

/**
 * 用户微调偏移量（复用 AnchorConfig.userOffset 的结构）
 * 按 `${type}@${id}` 为键独立存储，使微调跟随单品而非分类
 */
export type WearableOffset = NonNullable<AnchorConfig['userOffset']>

/** 服装分类 */
export type WearableType = 'hat' | 'scarf' | 'clothes' | 'bag' | 'bow'

/** 稀有度（商业化阶段用于商城分层） */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

/** 服装/配饰单品 */
export interface PetWearable {
  id: string
  name: string
  type: WearableType
  /**
   * 资产内容：MVP 阶段为 emoji 字符，生产环境替换为贴图 URL / SVG dataURI。
   * 用 emoji 是为了零美术依赖地跑通完整交互链路。
   */
  asset: string
  /** 是否为彩色 emoji（决定渲染时是否追加变体选择符） */
  isEmoji: boolean
  anchor: AnchorConfig
  rarity: Rarity
  /** 解锁所需亲密度等级，0 表示默认解锁 */
  unlockLevel: number
}

/** 化妆分类 */
export type MakeupType = 'blush' | 'eyeshadow' | 'lipgloss'

/**
 * 化妆项
 * 渲染时用 Canvas 混合模式叠加以自然融入照片，而非浮于表面
 */
export interface MakeupItem {
  id: string
  type: MakeupType
  name: string
  /** 妆容颜色（hex） */
  color: string
  /** 浓度 0–1 */
  opacity: number
  /**
   * Canvas 全局混合模式
   * multiply 让深色妆容压在照片上，softLight 适合高光类（唇彩）
   */
  blendMode: GlobalCompositeOperation
  /** 尺寸相对脸部包围盒的比例 */
  scale: number
}

/**
 * 宠物五官与身体锚点
 * MVP 由用户手动框选标定，进阶版本接入 landmark 模型自动检测
 */
export interface PetAnchors {
  /** 身体包围盒（归一化，相对画布） */
  bodyBox: Rect
  /** 头部包围盒（归一化，相对画布） */
  headBox: Rect
  /** 左眼中心 */
  leftEye: Point
  /** 右眼中心 */
  rightEye: Point
  /** 嘴巴中心 */
  mouth: Point
  /** 鼻子中心（化妆层唇彩/腮红的定位基准） */
  nose: Point
  /** 尾巴根部挂点；无尾巴（如人物皮肤）或照片中不可见时为 null/undefined */
  tailRoot?: Point | null
}

/** 宠物档案 */
export interface PetProfile {
  id: string
  name: string
  /** 形象皮肤：决定锚点比例、人格、互动与服装配置 */
  skin: SkinId
  species: PetSpecies
  /** 去背后的主体图（dataURL，含 alpha 通道） */
  cutoutDataUrl: string | null
  /** 原始照片（用于重新标定锚点） */
  originalDataUrl: string | null
  anchors: PetAnchors | null
  /** 是否已通过引导流程完成标定 */
  calibrated: boolean
  createdAt: number
  updatedAt: number
}

/** 肢体动作 */
export type PetAction =
  | 'idle' // 待机呼吸
  | 'wagTail' // 摇尾巴（宠物）
  | 'cheer' // 开心摇摆（人物，无尾）
  | 'wave' // 挥手致意（人物）
  | 'stretch' // 伸懒腰
  | 'jump' // 跳跃
  | 'roll' // 打滚
  | 'sleep' // 睡觉

/** 主动对话触发源 */
export type ProactiveTrigger =
  | 'scheduled' // 定时
  | 'state' // 状态（饥饿/困倦）
  | 'scene' // 场景（冷启动/久别/时段）
  | 'event' // 事件（互动后延续）

/** 对话消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'pet'
  content: string
  /** 宠物发言时附带的情绪，用于回溯渲染 */
  emotion?: PetEmotion
  /** 主动消息标注触发源，便于埋点分析打扰率 */
  proactive?: ProactiveTrigger
  timestamp: number
}

/** 亲密度等级（由累计 XP 推导） */
export interface BondLevel {
  level: number
  xp: number
  /** 距离下一级所需 XP */
  xpToNext: number
}

/** LLM 服务配置 */
export interface LLMSettings {
  enabled: boolean
  /** OpenAI 兼容接口地址 */
  baseUrl: string
  apiKey: string
  model: string
  /** 温度：宠物人设需要稳定，默认偏低 */
  temperature: number
}

/** 勿扰时段配置 */
export interface QuietHours {
  enabled: boolean
  /** 起始小时 0–23 */
  startHour: number
  /** 结束小时 0–23 */
  endHour: number
}

/** 去背参数 */
export interface SegmentationOptions {
  /** 颜色容差（RGB 欧氏距离 0–255），越大去除越激进 */
  tolerance?: number
  /** 是否对边缘做羽化处理，消除硬边锯齿 */
  feather?: boolean
}

/** 应用全局设置 */
export interface AppSettings {
  llm: LLMSettings
  quietHours: QuietHours
  /** 每日主动消息上限，防止打扰 */
  dailyProactiveLimit: number
  /** 是否启用主动对话总开关 */
  proactiveEnabled: boolean
  /** 尊重系统「减少动态效果」偏好 */
  reduceMotion: boolean
}
