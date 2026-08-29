# 🐾 PetPal — 你的专属宠物陪伴伙伴

> 用**自家宠物照片**打造的交互式虚拟宠物 App。零服务器、零 API 费、完全本地运行，支持 PWA 离线使用与「添加到主屏幕」。

PetPal 把一张普通的宠物照片，变成会开心、会撒娇、会主动找你聊天、能换装化妆、还会随时间「饿肚子」的数字伙伴。所有照片与数据都留在你的设备里，不上传任何服务器。

---

## ✨ 功能特性

| 功能 | 说明 | 状态 |
| --- | --- | --- |
| 📷 照片上传与端侧去背 | 上传宠物照片，本地洪水填充算法自动去背，无需任何模型下载 | ✅ |
| 📍 智能锚点标定 | 归一化包围盒锚点（五官/身体/尾巴），适配任意照片，支持手动微调 | ✅ |
| 💗 情绪系统 | 四维心情（快乐/精力/亲密度/饥饿）实时衰减，滞后状态机推导情绪，防表情闪烁 | ✅ |
| 💬 智能对话 | 默认离线规则引擎（零配置开箱即用），可选接入 LLM（DeepSeek / 通义等兼容接口） | ✅ |
| 🐾 肢体动作 | 摇尾、跳跃、伸懒腰、打滚、睡觉等程序化动画，情绪联动 | ✅ |
| 👗 换装系统 | 帽子 / 围巾 / 衣服 / 包包 / 蝴蝶结，支持位置、缩放、旋转微调 | ✅ |
| 💄 化妆功能 | 眼影 / 腮红 / 唇彩，BlendMode 自然融入照片 | ✅ |
| 📱 PWA 体验 | 「添加到主屏幕」即可像原生 App 一样离线使用，无需应用商店 | ✅ |
| ✨ 互动特效 | 点击宠物迸发粒子、亲密度等级成长系统 | ✅ |

---

## 🧱 技术架构

```
┌──────────────────────────────────────────────────────────┐
│                       React 19 UI 层                       │
│  PetStage · Onboarding · panels(Chat/Action/Wardrobe/…)   │
└───────────────┬──────────────────────────┬───────────────┘
                │                           │
        ┌───────▼────────┐          ┌──────▼─────────────┐
        │  Zustand Store │          │   Canvas 2D 渲染    │
        │ pet/settings/  │─────────▶│  8 层分层引擎       │
        │   chat         │  RendererState  │  (renderer)   │
        └───────┬────────┘          └──────┬─────────────┘
                │                           │
   ┌────────────▼──────────┐     ┌─────────▼──────────────┐
   │ 引擎层(纯函数/类)      │     │ 服务层                │
   │ emotion · animation · │     │ chatEngine · llm ·     │
   │ expression            │     │ segmentation · storage │
   └───────────────────────┘     └─────────┬──────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │ localStorage(Zustand) +    │
                              │ IndexedDB(照片资产) 双轨    │
                              └───────────────────────────┘
```

- **分层渲染引擎**（`src/engine/renderer.ts`）：背景阴影 → 身体 → 可动部件 → 服装 → 化妆 → 表情 → 特效，变换矩阵继承，DPR 自适应，60fps。
- **情绪引擎**（`src/engine/emotion.ts`）：四维心情值按真实时间衰减（离线也演化），滞后阈值推导情绪，表情与动作联动。
- **状态管理**（`src/store/`）：Zustand + persist 中间件，轻量状态进 localStorage，大体积照片走 IndexedDB 单独管理。
- **对话引擎**（`src/services/chatEngine.ts`）：本地规则优先，LLM 开关开启时无缝降级/升级。
- **端侧去背**（`src/services/segmentation.ts`）：零依赖洪水填充，替代重型 ML 模型。

> 完整架构、数据流与关键设计决策见 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

---

## 📂 项目结构

```
petpal/
├── src/
│   ├── types/            核心类型（PetProfile / PetEmotion / Wearable / Makeup / Anchor…）
│   ├── engine/           renderer · emotion · animation · expression（纯逻辑，可单测）
│   ├── store/            petStore · settingsStore · chatStore（Zustand）
│   ├── services/         chatEngine · llm · segmentation · storage
│   ├── components/       PetStage · Onboarding · panels/*
│   ├── hooks/            usePetRenderer · useMoodTicker · useProactiveChat
│   ├── constants/        catalog（服装/化妆目录）· interactions（互动定义）
│   └── main.tsx / App.tsx
├── public/              manifest.webmanifest · sw.js · 图标（手写 PWA）
├── .github/workflows/   deploy-pages.yml（GitHub Pages 自动部署）
├── capacitor.config.ts  Android 侧载配置
├── vercel.json          Vercel 部署配置
└── serve-local.js       本地 HTTPS 体验服务（自签证书）
```

---

## 🚀 快速开始

### 环境要求
- Node.js ≥ 22（推荐 22 LTS）
- 任意现代浏览器（Chrome / Edge / Safari）

### 本地开发

```bash
npm install
npm run dev          # 启动开发服务器 (默认 http://localhost:5173)
```

### 构建与预览

```bash
npm run build        # tsc 类型检查 + vite 生产构建 → dist/
npm run preview      # 本地预览构建产物
npm run lint         # oxlint 静态检查
```

构建产物 `dist/` 可直接托管到任意静态服务器 / 对象存储 / CDN。

---

## 🌐 部署

| 平台 | 用途 | 说明 |
| --- | --- | --- |
| **GitHub Pages** | 免费 HTTPS 静态托管 | 推送即触发 Actions 自动构建部署 |
| **Vercel** | 零配置自动部署 | 导入仓库即可 |
| **Capacitor → Android APK** | 免应用商店年费侧载 | 生成 APK 直装手机 |

> 详细步骤、PWA 添加到主屏幕、国内访问问题与方案，见 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**。

---

## 🗺️ 路线图

当前版本 **v0.1.0（MVP）**：六大核心功能均已实现。后续规划（真实美术资产、AI 多表情、APK 打包、云备份等）见 **[docs/ROADMAP.md](docs/ROADMAP.md)**。

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。提交前请：

1. `npm run lint` 与 `npm run build` 均通过；
2. 遵循现有代码风格（已配置 oxlint / .editorconfig）；
3. 在 PR 中说明改动背景与验证方式。

Bug 反馈与功能建议请使用仓库 Issue 模板。

---

## 🔒 隐私

- 所有宠物照片与用户数据**仅存储在本机**（localStorage + IndexedDB），永不上传任何服务器。
- LLM 对话默认关闭；开启后由用户自行配置兼容接口地址，对话内容经用户指定的网关传输。

---

## 📄 许可证

[MIT](LICENSE) © 2026 PetPal Contributors

---

<p align="center">用 ❤️ 为你家毛孩子打造</p>
