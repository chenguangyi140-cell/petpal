---
name: scroll-video-page
description: 用 intro-loop / main / outro-loop 三段视频做滚动叙事(scrollytelling)网页——滚动驱动主视频进度,首尾循环动画无缝衔接,文案排版复刻参考图。适用于电商产品推广页、宠物/IP 角色介绍、个人 3D 形象主页等纯 HTML/CSS/JS 单页。不适用于多页站点或需要 CMS/后端的项目。
---

# 滚动叙事视频页

把"三段视频 + 滚动驱动"做成一个完整单页:滚动 = 主视频进度,顶部/底部各一段循环动画,
文案按参考图排版语言逐段浮现。

## 流程总览

1. **素材体检**:运行 `scripts/probe_videos.sh <素材目录>`。HEVC 必须转 H.264,三段分辨率必须统一。
2. **叙事拆解**:运行 `scripts/storyboard_grid.sh main.mp4 grid.jpg` 抽帧拼图,按画面节奏划 6-10 个
   节奏点,各写一句 15-30 字文案;进度区间 = 时间秒 / main 总时长。
3. **衔接帧对齐**:抽四个衔接帧,用 `scripts/frame_bbox.py` 量主体占比,不一致就 scale+crop 重编码
   对应 loop——这是衔接处"突然放大缩小"的唯一根因。
4. **排版复刻**:分析参考图的字体/层级/颜色/装饰,套进模板的 eyebrow + 大标题 + 轻描述结构,
   左右交替布局,CTA 和标签只放最后一段。
5. **组装验证**:复制 `assets/template/index.html` 替换占位符;用支持 Range 的服务器预览并分段截图验证。

详细步骤、命令和验证清单见 [references/workflow.md](references/workflow.md)。

## 硬性约束(踩过的坑,别再踩)

- main 编码必须 H.264 + yuv420p + faststart;HEVC 在 Chrome 黑屏且无任何报错。
- 页面必须通过支持 HTTP Range 的服务器访问;Python `http.server` 会导致 seek 静默失效。
- 三段视频 object-fit:cover 全屏 fixed,分辨率/宽高比不一致 = 衔接处镜头跳变。
- 主视频 muted + playsinline + preload="auto",绝不 autoplay;iOS 需显式设置属性并 prime-play。
