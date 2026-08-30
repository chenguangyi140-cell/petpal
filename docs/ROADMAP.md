# PetPal 产品演进路线图（分阶段）

> 目标：把 PetPal 从「静态模型展示」升级为真正会动、会说话、有互动的 AI 宠物伴侣。
> 用户决策（2026-08-30）：**全都要，分阶段排期，逐步推进**。

## 现状核查（重要）
代码基线比"看起来"完整得多——状态系统、聊天气泡、换装/化妆、互动面板、LLM 接入骨架**都已存在**。真正缺失的只有两块：
1. **GLB 模型是死的**：`ModelViewer` 仅慢速自转+微浮动，不响应 `action`/`emotion`/`tap`。
2. **完全没有语音（TTS）**：全仓无 `speechSynthesis`，音频模块仅做麦克风可视化。

---

## P1 ✅ 让宠物"活"起来（已完成）
- `ModelViewer` 增加伪 3D 表演：待机呼吸、跳跃、低头吃、睡觉歪头、开心弹跳、点击脉冲，由 store 的 `action`/`emotion`/`sleep`/`tap` 驱动。
- `Model3DStage` 订阅 store 状态并转发给 viewer；点击模型本体触发 `tap()` 并冒泡。
- 新增 `services/speak.ts`（浏览器 TTS，免费无需 Key），宠物每次气泡/回复都朗读。
- `AudioPanel` 增加语音开关 + 语速/音调滑块 + 试听；`settingsStore` 增加 `voice` 配置。

## P2 ✅ 真正会聊（已完成）
- 设置页 LLM 区新增一键预设（DeepSeek/Qwen/OpenAI）与「连通性测试」按钮，降低配置门槛。
- 无 Key 时本地兜底引擎（`chatEngine`）按四维心情/名字/时段动态生成回复，对话有状态感而非死板。

## P3 换装/化妆作用于 3D 模型（进行中）
- **P3a ✅ 手机端单图 3D（photo billboard）**：`ModelViewer.loadBillboard` 用 three.js 把去背照片渲染成可旋转、会呼吸/跳/吃/睡的 3D 平面形象，**全程本地、不依赖混元、无需电脑**。手动上传三视图完成后即切到 3D 舞台，正面照作 billboard 源。解决「很多用户没电脑」的卡点。
- **P3b ✅ 换装/化妆作用于 3D 模型**：`ModelViewer` 把 `equipped` 的 emoji 配饰渲染为**朝向相机的精灵**，挂到头/颈/身锚点（GLB 与照片 3D 都生效）；`makeup` 在**照片 3D 上烘焙进贴图**（腮红/眼影/唇彩按脸部比例定位），GLB 上用整体轻微染色近似。`Model3DStage` 订阅 `equipped`/`wearableOffsets`/`makeup` 并实时转发，切换即时生效。

## P4 动画/表情/沉浸感打磨（待开始）
- 丰富动作库与表情；离线状态补算体验；整体节奏与细节打磨。
- 主动关怀（proactive chat）节奏与多样性打磨。

---
提交记录：P1 → `a492258`；P2 → `9237bd1`；P3a → `a19bf8b`；P3b → `765cd10`（均 master，已推 EdgeOne 自动部署）。
