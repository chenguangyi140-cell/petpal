# Changelog

本项目所有重要变更均记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 文档与工程规范
- 项目化：新增 `README.md`（产品/功能矩阵/架构概览/快速开始/部署/贡献）
- 新增 `docs/ARCHITECTURE.md` 架构与数据流文档
- 新增 `docs/ROADMAP.md` 版本路线图与已知问题（国内访问根因）
- 新增 `docs/DEPLOYMENT.md` 三平台部署手册
- 新增 `LICENSE`（MIT）、`CHANGELOG.md`、`.editorconfig`
- 新增 GitHub Issue / PR 模板

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
