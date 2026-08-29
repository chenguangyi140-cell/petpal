# PetPal 部署手册

> 覆盖三种部署形态：GitHub Pages（静态托管）、Vercel（零配置）、Capacitor → Android APK（侧载）。并附 PWA 安装、国内访问问题与本地体验方案。

构建产物统一为 `dist/`，由 `npm run build` 生成（含 `tsc` 类型检查）。

---

## 0. 通用：构建

```bash
npm install
npm run build      # 输出到 dist/
```

部署前务必确认 `npm run build` 通过且 `dist/` 内含 `index.html`、`manifest.webmanifest`、`sw.js`。

---

## 1. GitHub Pages（免费 HTTPS 静态托管）

**适合**：永久公开访问、零成本。

### 方式 A：GitHub Actions 自动部署（已配置 ✅）

仓库已包含 `.github/workflows/deploy-pages.yml`，推送 `master` 即触发自动构建并部署。

首次启用需手动开启一次 Pages：
```bash
# 需 gh 已登录（gh auth login / gh auth setup-git）
gh api -X POST /repos/<owner>/<repo>/pages \
  -f build_type=legacy \
  -f source='{"branch":"gh-pages","path":"/"}'
```
> 关键：API 参数必须含 `build_type` 与 `source.path`（只能填 `/` 或 `/docs`），否则 Actions 部署会报 404。

推送后等待 Actions 跑完，访问 `https://<owner>.github.io/<repo>/`。

### 方式 B：手动部署
```bash
npm run build
npx gh-pages -d dist      # 需安装 gh-pages
```

---

## 2. Vercel（零配置自动部署）

**适合**：国内桌面/海外访问、自动 HTTPS、预览环境。

- 网页端：导入 GitHub 仓库 `petpal`，Framework 选「Vite」，Build 命令 `npm run build`，Output `dist`。
- CLI 方式：
  ```bash
  npx vercel --prod --yes
  ```
- 已包含 `vercel.json`：强制 `sw.js` 不缓存、强制 `manifest.webmanifest` 的 `Content-Type: application/manifest+json`（保证 PWA 可安装）。

> ⚠️ 注意：Vercel 域名为境外域名，中国大陆手机网络可能不稳定（见 §5）。

---

## 3. Capacitor → Android APK 侧载（免应用商店年费）

**适合**：安装到手机像原生 App、可离线、无商店审核。

```bash
npm install @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npx cap sync              # 把 dist/ 同步进原生工程
npx cap build android     # 生成 APK（需本地 Android SDK）
```

- `capacitor.config.ts` 已配置 `appId: com.petpal.app`、`appName: PetPal`、Web 资源指向 `https://localhost`（Capacitor 本地服务）。
- 生成 APK 后直装手机即可，免去 Google Play / 国内商店年费。
- 进阶：接入 `@capacitor/haptics`（已安装）做触觉反馈、`@capacitor/filesystem` 做本地文件读写。

---

## 4. PWA：添加到主屏幕

1. 用 **HTTPS** 域名（GitHub Pages / Vercel / 国内托管）打开 App。
2. 浏览器菜单 → 「添加到主屏幕」（iOS Safari 分享面板 / Android Chrome 三点菜单）。
3. 桌面即出现 PetPal 图标，点击全屏离线运行。

校验 PWA 是否就绪：
- `manifest.webmanifest` 可访问且 `Content-Type` 正确。
- `sw.js` 已注册（DevTools → Application → Service Workers）。
- 离线后仍可打开（service worker 缓存了壳资源）。

---

## 5. 国内手机访问问题（重要）

### 现象
手机访问 GitHub Pages 与 Vercel 两个域名均「一直转圈」。

### 根因（已服务器侧验证）
两个均为**境外域名**，受中国大陆网络环境影响不稳定。GitHub Pages / Vercel **服务器侧均正常**（HTTP 200、资源 200），问题**不在应用代码或 PWA 配置**。

### 解决方案

**方案 1 · 国内托管（长期推荐，需用户操作）**
- 腾讯云 **EdgeOne Pages**（最贴近 Vercel 体验，Git 联动自动部署）
- 腾讯云 **COS** + CDN
- 阿里云 **OSS** + CDN
- 三者均需**实名认证**（政策强制，AI 无法代做）。选定后我可准备对应部署配置/脚本。

**方案 2 · 本地 HTTPS 临时体验（已就绪）**
```bash
node serve-local.js
```
手机连同一 Wi-Fi，访问 `https://<电脑局域网IP>:4174`（点「继续」忽略自签证书警告）。
- 限制：电脑不能关、需同 Wi-Fi、自签证书可能拦 PWA 安装（仅交互体验）。
- 电脑重启后需重跑 `node serve-local.js`。

---

## 6. 部署检查清单

- [ ] `npm run build` 通过，`dist/` 完整
- [ ] 目标平台已启用并绑定域名
- [ ] HTTPS 可访问，`index.html` / `manifest.webmanifest` / `sw.js` 均 200
- [ ] 手机端实测可打开（国内用户优先选国内托管）
- [ ] PWA「添加到主屏幕」验证通过
- [ ] 照片上传 → 去背 → 锚点 → 换装/化妆 全流程自测
