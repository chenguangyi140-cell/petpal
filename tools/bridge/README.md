# PetPal 本机 AI 形象桥接（ComfyUI）

把你在 PetPal 里上传的一张照片，交给**你自己电脑上的 ComfyUI** 推理，自动生成
**前/侧/后三视图**或**真·3D 模型（GLB）**。照片只在本机经 `localhost` 流转，**不出设备、零 API 费**。

```
浏览器(PetPal)  ──HTTP──▶  本桥接服务(server.mjs)  ──HTTP──▶  ComfyUI(你本机)
  上传1张照片                转发工作流+回传结果                IP-Adapter / Zero123Plus / TripoSR 推理
```

本运行环境（WorkBuddy 沙箱）**没有 GPU、连不上你的 ComfyUI**，无法在此真正跑推理；
下面这套代码与说明是给你在本机一键部署用的。

---

## 1. 前置条件
- 已安装并跑通 **ComfyUI**（你机器上已有 MiniMax-H3 + ComfyUI 链路）。
- **Node.js 18+**（用 PetPal 自带的 managed 运行时亦可）。
- 推荐自定义节点（生成三视图 / 3D 需要，按需安装）：
  - 三视图：`ComfyUI-IPAdapter-Plus`（锁定身份，让生成的侧/背面还是同一只宠物/人物）
    + `ComfyUI-Zero123Plus`（单图→多角度）+ `ComfyUI-Image-Crop` 等裁剪节点
  - 3D 模型：`ComfyUI-TripoSR` 或 `ComfyUI_3dpack`（单图→GLB）

---

## 2. 启动桥接（连通性自测）
```bash
cd tools/bridge
node server.mjs
# 终端应显示：监听 http://localhost:8787，转发到 http://127.0.0.1:8188
```
此时 `workflows/3view.json` 只是「加载图片」脚手架，所以 AI 生成会**原样把上传图作为正面**返回——
这正好用来验证整条链路通了。在 PetPal → 设置 → AI 形象，把地址填 `http://localhost:8787`，
回到引导页点「✨ AI 生成 3D 三视图形象」→ 上传照片 → AI 自动生成（选三视图），应能立即看到正面图转盘。

> 想跳过 ComfyUI 先体验 UI？在工坊里选「手动上传前/侧/后 或 3D 模型」即可，零依赖。

---

## 3. 搭建真正的「三视图」工作流
1. 在 ComfyUI 里新建画布，加载 `workflows/3view.json`（API 格式），会得到一个 `LoadImage` 节点。
2. 接上你的多视图链路，常见接法：
   `LoadImage` → `IPAdapterUnifiedLoader` → `IPAdapter`(image=上传图, model=基础模型)
   → `Zero123Plus`(输入 IPAdapter 输出) → 用 3 个 `ImageCrop` 把 2×N 网格裁成「正面 / 侧面 / 背面」
   → 3 个 `PreviewImage`（或 `SaveImage`）。
3. 跑通一张图确认效果。
4. 菜单「Save (API Format)」导出，覆盖 `workflows/3view.json`。
5. 记下 3 个裁剪输出节点的 **节点 id**，改 `bridge.config.json`：
   ```json
   "threeView": {
     "inputNode": "10",            // LoadImage 的节点 id（注入上传图）
     "inputField": "image",
     "outputNodes": { "front": "<正面节点id>", "side": "<侧面节点id>", "back": "<背面节点id>" }
   }
   ```
   重启 `node server.mjs`，App 里再生成即得到可旋转的真实三视图。

---

## 4. 搭建「真·3D 模型(GLB)」工作流
1. 同理加载 `workflows/3d.json`，接上 `LoadImage` → `IPAdapter` → `TripoSR`（或 3dpack 的
   single-image-to-3D 节点）→ 导出/保存 GLB 的节点。
2. 导出覆盖 `workflows/3d.json`，并把导出 GLB 的节点 id 填进 `bridge.config.json` 的
   `"model3d".outputNodes.glb`。
3. App 工坊选「AI 自动生成 → 真·3D 模型」，即可得到可自由拖拽旋转的立体形象（three.js 渲染）。

---

## 5. 配置说明
| 环境变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8787` | 桥接服务端口（前端填的地址） |
| `COMFY_URL` | `http://127.0.0.1:8188` | 你的 ComfyUI 地址 |
| `CONFIG` | `./bridge.config.json` | 节点映射配置 |

前端设置位置：PetPal → 设置 → **AI 形象** → 「本机 AI 桥接地址」。

---

## 6. 隐私
照片仅在你的设备内、经 `localhost` 传给本机 ComfyUI，绝不经过任何外部服务器。
生成的模型/图片也只存你手机/电脑的 IndexedDB。符合 PetPal「零 API 费、隐私不出本机」的底线。

> 卡在某一步？把你在 ComfyUI 里实际安装的节点名/报错贴给我，我可以把工作流与
> `bridge.config.json` 直接按你的环境调准。
