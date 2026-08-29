# PetPal 架构文档

> 面向开发者的技术纵深说明。本文档与代码严格对应，定位为「代码导读 + 设计决策记录」。

---

## 1. 设计原则

| 原则 | 落地方式 |
| --- | --- |
| **零成本可运行** | 不依赖任何付费 API / 服务器；LLM 默认关闭，离线规则引擎兜底 |
| **隐私优先** | 照片与数据仅存本地（localStorage + IndexedDB），绝不上传 |
| **自家照片即形象** | 程序化叠加（去背 + 分层）而非 3D 建模，保住「用真实宠物照」的核心诉求 |
| **引擎与 UI 解耦** | `engine/` 为纯函数 / 纯类，无 React 依赖，可独立单测 |
| **离线状态连续** | 心情按真实经过时间衰减，隔天打开宠物仍在「饿肚子」而非满状态重置 |
| **可降级** | 无照片 → 内置矢量宠物；无 LLM → 规则引擎；渲染失败 → 静默回退 |

---

## 2. 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React | 19 |
| 语言 | TypeScript | ~6.0 |
| 构建 | Vite | 8 |
| 样式 | Tailwind CSS | v4（经 `@tailwindcss/vite` 插件） |
| 状态 | Zustand（persist 中间件） | 5 |
| 渲染 | Canvas 2D | — |
| 跨端 | Capacitor | 8 |
| Lint | oxlint | 1.x |
| 本地存储 | `idb`（IndexedDB 封装） | 8 |

---

## 3. 模块职责

```
src/
├── types/index.ts        所有跨模块共享类型（PetProfile, PetEmotion, Wearable, Makeup, Anchor…）
├── engine/              纯逻辑层（无 React / 无 DOM 之外的副作用）
│   ├── emotion.ts       四维心情衰减、滞后情绪状态机、情绪→动作、亲密度换算
│   ├── animation.ts     动画调度 AnimationScheduler、身体/尾巴/阴影变换计算
│   ├── expression.ts    表情绘制（眉/眼/嘴/腮红）EXPRESSION_MAP
│   └── renderer.ts      PetRenderer 8 层 Canvas 渲染主引擎
├── store/               Zustand store
│   ├── petStore.ts      宠物核心状态（profile/mood/emotion/xp/equipped/makeup…）
│   ├── settingsStore.ts LLM 开关 / 勿扰 / 主动对话上限
│   └── chatStore.ts     对话历史
├── services/
│   ├── chatEngine.ts    本地规则回复 + 主动搭话料库
│   ├── llm.ts           LLM 接入抽象（兼容 OpenAI 风格接口）
│   ├── segmentation.ts  端侧去背（洪水填充）
│   └── storage.ts       IndexedDB 资产读写（照片 dataURL）
├── components/
│   ├── PetStage.tsx     主舞台，挂载 Canvas + 绑定 PetRenderer
│   ├── Onboarding.tsx   引导：命名→物种→上传→去背→锚点标定
│   └── panels/          ChatPanel / ActionPanel / WardrobePanel / MakeupPanel / SettingsPanel
├── hooks/
│   ├── usePetRenderer.ts  把 store 状态同步进 PetRenderer 的桥接
│   ├── useMoodTicker.ts   定时推进心情衰减（tick）
│   └── useProactiveChat.ts 主动对话调度
└── constants/
    ├── catalog.ts       服装 / 化妆目录与预设
    └── interactions.ts  互动类型定义与心情增量表
```

---

## 4. 核心子系统

### 4.1 分层渲染引擎（`engine/renderer.ts`）

`PetRenderer` 是一个有状态的渲染器，由 `usePetRenderer` 桥接 store 状态驱动。每帧绘制顺序：

| 层级 | 内容 | 关键实现 |
| --- | --- | --- |
| L1 | 接地阴影 | `computeShadowScale`：随腾空高度缩放，**不**随身体旋转，提供纵深线索 |
| L2 | 身体主体 | 有去背图则 `drawCutout()`，否则 `drawDefaultPet()` 内置矢量宠物 |
| L2.1 | 尾巴（可动部件） | `computeTailRotation`：相对身体独立摆动，强度受情绪影响（`EMOTION_WAG_BOOST`） |
| L5 | 化妆层 | `globalCompositeOperation = blendMode` + 高斯模糊柔化，画在表情**之下**以贴合皮毛 |
| L6 | 表情层 | `drawExpression`：眉 / 眼 / 嘴 / 腮红，按 `EXPRESSION_MAP[emotion]` |
| L3/L4 | 服装 / 配饰 | `drawWearables`：画在表情**之上**，避免帽子被表情线条压住 |
| L7 | 粒子特效 | 独立坐标系，不随身体旋转；点击迸发，含上限保护（≤60）防堆积 |

**坐标系统**：所有锚点用归一化坐标 `(0–1)`，渲染时乘逻辑宽高 `px()` 转像素。身体层建立变换栈（translate→rotate→scale），后续子层继承，保证换装/化妆随身体一起动。

**DPR 自适应**：`resize()` 取 `min(devicePixelRatio, 3)` 上限，避免超高 DPR 设备过度绘制。

**导出**：`exportImage()` 把当前画面 `toDataURL` 供「拍照分享」。

### 4.2 情绪引擎（`engine/emotion.ts`）

- **四维心情**：`happiness / energy / affection / hunger`，范围 0–100。
- **时间衰减** `decayMood()`：按真实 `elapsedMs` 换算小时数衰减，rates：`happiness 3.2 / energy 4.5 / affection 0.8 / hunger 6.5`（点/小时）。饥饿增长最快以驱动喂食循环。
- **滞后状态机** `deriveEmotion()`：每个情绪有 `enter/exit` 双阈值（hysteresis），防止边界抖动导致表情闪烁。优先级：**睡眠 > 饥饿 > 困倦 > 开心 > 难过 > 撒娇 > 平静**（生理需求优先于情感表达）。
- **情绪→动作联动** `suggestAction()`：开心/撒娇→摇尾，困倦→睡觉，负面→收敛为 idle，避免「哭着跳跃」的违和组合。
- **亲密度** `computeBondLevel()`：XP 累进阈值（等差数列），每级所需递增，保留成长感。

### 4.3 动画调度（`engine/animation.ts`）

`AnimationScheduler` 用时间戳驱动的程序化动画（非骨骼）。支持：
- 循环动作（idle / wagTail / sleep）
- 一次性动作（jump / stretch / roll…），播放完毕回调
- `pendingFallback`：一次性动作结束后回到当前情绪对应的常态动作，而非硬切 idle

### 4.4 状态管理（`store/`）

三个独立 store：
- `petStore`：宠物核心状态机，`interact()/tap()/tick()` 统一走 `applyMoodDelta → deriveEmotion → suggestAction` 闭环。
- `settingsStore`：`llmEnabled`（默认 **false**）、勿扰、主动对话上限。
- `chatStore`：对话历史。

**双轨持久化**：
- Zustand `persist` 中间件写 localStorage（`name: 'petpal.pet'`，`version: 1`）。
- `partialize` 剥离 `cutoutDataUrl / originalDataUrl`（照片体积大），改由 `services/storage.ts` 存入 IndexedDB。
- `hydrate()` 在启动时从 IndexedDB 拉回照片并回填 `profile`，`hydrated` 标记防止首帧空白。

### 4.5 对话引擎

`services/chatEngine.ts` **本地规则优先**：
- `RULES`：正则匹配表，越具体越靠前，命中即返回建议情绪 + 回复。
- `FALLBACK_BY_EMOTION`：未命中时沿用当前情绪给出贴合语境的应答，保持连贯。
- 主动搭话：`PROACTIVE_BY_STATE`（饿/困/无聊/撒娇/idle）+ `PROACTIVE_BY_SCENE`（冷启动/久别/早/晚），由 `useProactiveChat` 调度。

`services/llm.ts`：当 `settingsStore.llmEnabled` 为真时，走用户配置的兼容接口（DeepSeek / 通义等），失败可降级回规则引擎。

### 4.6 去背与锚点

`services/segmentation.ts`：**零依赖端侧洪水填充**，替代 `@imgly/background-removal`（该依赖在 Windows 上安装失败）。`Onboarding` 流程：上传 → 去背 → 锚点标定（自动估算 + 手动微调，`DEFAULT_ANCHORS` 兜底）。锚点存 `profile.anchors`，渲染时驱动所有图层定位。

### 4.7 换装与化妆

- **换装**：`equipped: Record<WearableType, id>`，渲染时解析为 `WEARABLE_CATALOG` 对象 + `wearableOffsets`（用户微调：dx/dy/scale/rotation）。同类仅保留一项。
- **化妆**：`makeup: MakeupItem[]`，`drawMakeup` 用 `blendMode`（如 `multiply`/`screen`）+ 模糊柔化自然融入照片；同类同取最后一项覆盖。

---

## 5. 数据流闭环

```
用户互动 / 定时 tick
      │
      ▼
petStore.interact() / tap() / tick()
      │  applyMoodDelta → deriveEmotion → suggestAction
      ▼
Zustand state 变更 ──persist──▶ localStorage
      │                              │
      │ (照片资产)                   │
      └──▶ storage.ts ─IndexedDB──▶ 照片 dataURL
      │
      ▼
usePetRenderer 监听 state → renderer.setState()
      │
      ▼
PetRenderer.renderFrame()  ──每帧 requestAnimationFrame──▶ Canvas
      │
      ▼
用户看到宠物表情 / 动作变化 → 再次互动（闭环）
```

---

## 6. 关键设计决策（ADR 摘要）

| 决策 | 选项 | 选择 | 理由 |
| --- | --- | --- | --- |
| 形象方案 | 3D 建模 / 照片+程序化叠加 | **照片+程序化叠加** | 保住「自家宠物照」诉求，零建模成本 |
| 去背 | ML 模型 / 洪水填充 | **洪水填充** | ML 依赖在本机安装失败，洪水填充零依赖可跑 |
| 对话 | 纯 LLM / 规则+LLM 可选 | **规则优先 + LLM 可选** | 零 API 费、离线可用、默认开箱即用 |
| 状态持久化 | 单 localStorage / 双轨 | **双轨** | 照片过大不宜进 localStorage |
| PWA | vite-plugin-pwa / 手写 | **手写 manifest+sw** | 插件依赖链（workbox→babel）在 Windows 断裂 |
| 情绪推导 | 即时映射 / 滞后状态机 | **滞后状态机** | 避免边界抖动导致表情闪烁 |

---

## 7. 性能与可访问性

- DPR 上限 3，避免 4K/Retina 过度绘制。
- `reduceMotion`：关闭粒子与尾巴摆动，照顾前庭敏感用户。
- 粒子数量硬上限 60，防连续点击堆积拖慢帧率。
- 图片加载失败静默回退内置矢量宠物，避免整页崩溃。

---

## 8. 扩展点

- **接新 LLM**：在 `llm.ts` 增加适配器，`settingsStore` 加配置项即可。
- **加服装/化妆**：往 `constants/catalog.ts` 增条目，渲染层自动消费。
- **加情绪**：在 `types` 增 `PetEmotion`、补 `EMOTION_THRESHOLDS` 与 `EXPRESSION_MAP`。
- **加端侧 AI 表情**：替换 `drawDefaultPet` / `drawCutout` 为 AI 生成多表情帧序列（见路线图 v2.0）。
