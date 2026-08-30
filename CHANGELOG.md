# Changelog

本项目所有重要变更均记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.0] - 2026-08-30

### 新增
- AI 形象工坊：照片上传 → AI 三视图 / 真·3D 模型，支持本机 ComfyUI 与云端免费路径
- 云端生成（无需 GPU）：Forge（NVIDIA NIM + TRELLIS，全自动 GLB）与 Hunyuan3D 网页版双通道
- 队列进度回传：realtime 状态（queued/processing/eta/队列位置）+ 进度条展示
- 错误重试与回退：Forge 提交失败自动重试 1 次；失败后可一键改用 Hunyuan3D
- Hunyuan3D 一键导入：下载 GLB 后直接上传至工坊预览，无需退回手动模式
- 文档与工程规范：新增 `docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/DEPLOYMENT.md`
- 新增 `LICENSE`（MIT）、`.editorconfig`、GitHub Issue / PR 模板

### 修复
- 移除 Google Fonts 外部依赖，改用系统字体栈（解决国内首屏阻塞/白屏）
- 移除 bridge 注释中的外部域名，避免排查混淆
- EdgeOne Pages 401 自定义域名绑定完整步骤文档

## [0.1.0] - 2026-08-29

首个 MVP 版本。六大核心功能全部可用，零服务器、零 API 费、可离线运行。

### 新增
- 照片上传与端侧去背（零依赖洪水填充算法）
- 归一化锚点标定与手动微调，适配任意宠物照片
- 四维心情（快乐/精力/亲密度/饥饿）+ 滞后情绪状态机
- 程序化肢体动作（摇尾、睡觉、跳跃、伸懒腰、打滚等）与情绪联动
- 本地规则对话引擎 + 主动搭话，LLM 可选接入层（默认关闭）
- 换装系统（帽子/围巾/衣服/包包/蝴蝶结，支持位置/缩放/旋转微调）
- 化妆系统（眼影/腮红/唇彩，BlendMode 自然融入）
- PWA（manifest + service worker）「添加到主屏幕」
- 双轨持久化：Zustand→localStorage + IndexedDB 照片资产
- 亲密度等级成长系统
- 部署配置：GitHub Pages Actions、Vercel、Capacitor Android；本地 HTTPS 体验服务
