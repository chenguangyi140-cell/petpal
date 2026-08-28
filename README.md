# PetPal 🐾 — 你的专属宠物陪伴伙伴

用自家宠物照片打造的交互式虚拟宠物 App。零服务器、零 API 费、完全本地。

## 功能

- **照片上传**：端侧去背，自动估算五官锚点
- **情绪系统**：开心/难过/生气/撒娇/困倦，四维心情值实时演化
- **智能对话**：默认离线规则引擎，可选接 LLM（DeepSeek/通义等）
- **换装系统**：帽子、围巾、衣服、包包、蝴蝶结，支持位置微调
- **化妆功能**：眼影、腮红、唇彩，BlendMode 自然融入照片
- **PWA 支持**：「添加到主屏幕」离线使用，无需安装商店

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind v4 · Zustand · Capacitor · Canvas 2D

## 部署

### GitHub Pages（推荐，免费 HTTPS）

```bash
npm run build
# 推送后在仓库 Settings → Pages → Source: main / dist
```

### Vercel（零配置自动部署）

```bash
npx vercel --prod --yes
```

### Android APK 侧载（免年费）

```bash
npx cap add android
npx cap sync
npx cap build android  # 生成 APK 直装
```

## 本地运行

```bash
npm install
npm run dev
```

## 隐私

所有照片与数据仅存储在本机 IndexedDB，永不上传。
