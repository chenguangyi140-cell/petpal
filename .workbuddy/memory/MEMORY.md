# PetPal 项目长期记忆

## 关键事实
- 部署：EdgeOne Pages，自定义域名 https://mypetpal.cn 。commit 推 origin/master 即自动部署。
- 构建注意：Windows 下 `vite build` 清 dist 会因 WorkBuddy safe-delete 回收站封装失败，需先 `rm -rf dist` 再用原生构建绕过。
- 沙箱 git 的 origin/master 跟踪引用偶尔显示过期（packed-refs 不持久化），实际远端以 `git ls-remote origin master` 为准，不影响线上部署。

## 外部环境坑（用户会反复踩）
- 腾讯混元 3D（3d.hunyuan.tencent.com）**手机端「添加多视图」弹窗布局错位**：弹窗比屏高、不可滚动，确认/返回按钮被裁掉点不到。解决：手机浏览器开「请求桌面站点」，或直接用电脑做 3D 生成这步，下载 GLB 后回 PetPal 导入。
- 混元免费额度：新账号需实名/新手引导后才下发，否则显示「剩余 0」像用完了。

## 演进方向（用户选 D：全都要，分阶段，慢慢做）
- P1 已完成：3D 模型活体化（呼吸/跳/吃/睡/开心弹跳/点击脉冲）+ 浏览器 TTS 语音。
- P2 已完成：无 Key 时本地兜底对话按四维心情动态生成 + 设置页 LLM 预设/连通性测试。
- P3a 已完成：手机端单图 3D（photo billboard）。`ModelViewer.loadBillboard` 把去背照片用 three.js 渲染成可旋转、会呼吸/跳/吃/睡的 3D 平面形象，全程本地、不依赖混元、无需电脑；手动上传三视图完成即切 3D 舞台，正面照作 billboard 源。commit `a19bf8b`。
- P3b 已完成：换装/化妆作用于 3D 模型。`ModelViewer` 把 `equipped` 的 emoji 配饰渲染为朝向相机的精灵挂到头/颈/身锚点（GLB 与照片 3D 都生效）；`makeup` 在照片 3D 上烘焙进贴图（腮红/眼影/唇彩按脸部比例），GLB 上用整体轻微染色近似。`Model3DStage` 订阅 `equipped`/`wearableOffsets`/`makeup` 实时转发。commit `765cd10`。
- P4 待做：动画/表情/主动关怀打磨。

## 协作偏好（用户明确）
- 小决策直接过，不要反复问；真正会丢数据/不可逆/付费才提示。
