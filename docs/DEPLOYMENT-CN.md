# PetPal · 腾讯云 EdgeOne Pages 部署指南（国内稳定访问）

> 适用场景：GitHub Pages / Vercel 等境外域名在中国大陆手机上访问不稳定（一直转圈），需要部署到**国内可稳定访问**的托管平台。
> 已选方案：**腾讯云 EdgeOne Pages**（最接近 Vercel 体验、自动 HTTPS、国内 CDN 加速、git 推送自动部署、免费额度足够个人项目）。

---

## 为什么选 EdgeOne Pages

| 维度 | GitHub Pages / Vercel | EdgeOne Pages |
| --- | --- | --- |
| 国内手机访问 | ❌ 境外域名常被限制，转圈 | ✅ 腾讯云国内节点，稳定 |
| 部署方式 | git push 自动部署 | git push 自动部署 |
| HTTPS | 自动 | 自动 |
| 框架识别 | 需配置 | 导入即自动识别 Vite |
| 备案要求 | 无（但访问不稳） | 选「不含中国大陆」加速区 → **免备案** |
| 费用 | 免费 | 免费额度足够个人项目 |

**关键决策**：加速区域选 **全球可用区（不含中国大陆）**。该选项无需 ICP 备案，且国内访问依旧正常（腾讯云边缘节点覆盖国内）。只有选「含中国大陆」加速区才需备案。

---

## 前置条件（必须，需你本人完成）

1. **腾讯云账号** + **完成实名认证**。
   - 实名是政策强制要求，AI 无法代做。
   - 入口：https://console.cloud.tencent.com/edgeone
   - 未实名无法创建 Pages 项目。
2. **PetPal 代码已推送到 GitHub**（`chenguangyi140-cell/petpal`，分支 `master`）。
   - EdgeOne 从 GitHub 拉取代码构建，所以代码必须在 GitHub 上。
   - 若本地有未推送的提交，需先 `git push -u origin master`（见下文步骤 1）。

---

## 操作步骤（控制台，约 5 分钟）

### 步骤 1 · 推送最新代码到 GitHub

本地当前有若干未推送的提交（含 `edgeone.json` 与文档）。先推送，EdgeOne 才能拉到最新代码：

```bash
cd /d/2026项目/workbuudy/2026-08-28-22-36-31/petpal
git push -u origin master
```

> 若提示 `could not read Username`：先执行 `gh auth setup-git` 配置凭证。
> 若提示 upstream 不存在/分叉：确认远程默认分支名（`gh repo view chenguangyi140-cell/petpal --json nameWithOwner` 看默认分支），再 `git push -u origin master`（或 `main`）。

### 步骤 2 · 进入 EdgeOne Pages 控制台

打开 https://console.cloud.tencent.com/edgeone/pages → 点击「**创建项目**」。

### 步骤 3 · 导入 GitHub 仓库

1. 选择「**导入 Git 仓库**」。
2. 首次需授权腾讯云访问你的 GitHub（OAuth，一次性）。
3. 在仓库列表中选择 `chenguangyi140-cell/petpal`。
4. 生产分支选择 **`master`**（PetPal 的默认分支）。

### 步骤 4 · 构建设置（关键，照填）

| 配置项 | 填写值 | 说明 |
| --- | --- | --- |
| 框架预设 | **Vite** | 选后自动填充，可改 |
| 构建命令 | `npm run build` | 实际跑 `tsc -b && vite build` |
| 输出目录 | `dist` | Vite 构建产物目录 |
| 安装命令 | `npm install` | 默认即可 |
| **Node.js 版本** | **22.17.1** | 仓库 `edgeone.json` 已锁定；Vite 8 需 ≥20.19，务必选 20+ |
| **加速区域** | **全球可用区（不含中国大陆）** | **免备案且国内可访问**，强烈推荐 |

> `edgeone.json` 已在仓库根目录，会自动应用 `nodeVersion` / `outputDirectory` / `headers`，控制台显示的值与之对应即可。

### 步骤 5 · 开始部署 & 获取域名

点击「**开始部署**」。几十秒到几分钟后完成，会得到：

- **生产域名**：形如 `petpal-xxxx.edgeone.app`（长期有效，手机直接访问）。
- 之后每次 `git push master` 都会**自动重新部署**。

### 步骤 6 · 手机验证 & 添加到主屏幕

1. 手机浏览器打开生产域名（`https://petpal-xxxx.edgeone.app`）。
2. 确认能正常加载、宠物形象出现、各面板可交互。
3. 浏览器菜单 → 「**添加到主屏幕**」，即可像 App 一样从桌面启动（PWA）。
   - 若「添加到主屏幕」不可用：`edgeone.json` 已为 `manifest.webmanifest` 强制 `Content-Type: application/manifest+json`，通常即可。仍不行则检查 `public/manifest.webmanifest` 内容是否完整。

---

## 配置文件说明（edgeone.json）

仓库根目录的 `edgeone.json` 已预置，无需手动改：

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "nodeVersion": "22.17.1",
  "headers": [
    { "source": "/*.webmanifest", "headers": [ { "key": "Content-Type", "value": "application/manifest+json; charset=utf-8" } ] },
    { "source": "/sw.js",          "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/index.html",     "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] }
  ]
}
```

- `nodeVersion`：锁定 22.17.1，规避构建环境默认 Node 过旧导致 Vite 8 构建失败。
- `/*.webmanifest` 头：确保 PWA manifest 的 Content-Type 正确（否则「添加到主屏幕」失败）。
- `/sw.js`、`/index.html` 头：`no-cache`，保证发版后 Service Worker 与首页即时更新。

---

## 自动部署

部署完成后，后续流程：

```bash
# 本地改完代码
git add -A
git commit -m "feat: ..."
git push origin master      # 自动触发 EdgeOne 重新构建部署
```

无需回控制台，push 即上线。

---

## 故障排查

| 现象 | 原因 / 解决 |
| --- | --- |
| 构建失败，报 Node/npm 版本相关 | 确认「Node.js 版本」选了 **22.17.1**（或 ≥20.19）；`edgeone.json` 已锁定，重新部署即可 |
| 构建报某依赖装不上 | 仓库残留 `vite-plugin-pwa`（已不再使用）；EdgeOne Linux 环境可正常安装、不影响构建。如本地 Windows `npm install` 失败，需先从 `package.json` 移除该依赖并重新生成 lock |
| 页面打开但「添加到主屏幕」无此选项 | 检查 `manifest.webmanifest` 的 `Content-Type`（已用 `edgeone.json` 强制为 `application/manifest+json`）；确认 manifest 字段完整（`display: standalone`、icons 齐全） |
| 国内仍打不开 | 确认加速区域选的是「不含中国大陆」（该选项国内可访问）；若选了「含中国大陆」则需完成 ICP 备案 |
| 改了代码手机没更新 | `sw.js` 已设 `no-cache`；可手机清缓存或重加主屏幕；也可在控制台「重新部署」 |

---

## 可选：绑定自定义域名

若想用自有域名（如 `petpal.example.com`）：

1. EdgeOne Pages 项目 → 设置 → 绑定自定义域名。
2. 按提示在域名 DNS 添加 CNAME 记录指向 EdgeOne。
3. 若加速区域选「含中国大陆」，绑定后需完成 **ICP 备案**；选「不含中国大陆」则无需备案，国内照常访问。

个人体验阶段建议先用默认的 `*.edgeone.app` 域名，无需自定义域名、无需备案。
