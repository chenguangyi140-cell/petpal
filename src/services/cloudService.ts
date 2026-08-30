/**
 * 云端 AI 形象生成服务（零 GPU 依赖）
 *
 * 当前仅保留腾讯混元 Hunyuan3D 网页版入口：
 * - 免费额度：每天 20 次生成（https://3d.hunyuan.tencent.com）
 * - 注意：Hunyuan3D 没有公开 API，本服务仅返回网页使用引导，
 *   用户手动操作后回填 GLB 即可。
 *
 * 设计原则：照片不出本机，手机端无需电脑即可使用。
 */

export type CloudProvider = 'hunyuan'

export interface CloudGenerateResult {
  /** GLB 模型的 dataURL（base64），供 ModelViewer 加载 */
  glbDataUrl: string
  /** 生成来源引擎名称 */
  engine: string
  /** 耗时（毫秒） */
  durationMs: number
}

// 统一使用 aiService.ts 中的 dataURLToBlob，避免重复实现
export { dataURLToBlob } from './aiService'

// ─── Hunyuan3D（腾讯混元） ───────────────────────────────────

/**
 * 生成 Hunyuan3D 网页版的使用说明
 *
 * 由于 Hunyuan3D 没有公开 API（仅有 web 界面 https://3d.hunyuan.tencent.com），
 * 此函数返回一个「引导对象」，前端据此展示跳转链接和使用步骤。
 * 用户手动完成生成后，需自行将 GLB 文件拖入 PetPal（或通过"手动上传"入口）。
 *
 * 免费额度：每天 20 次（无需注册账号）
 */
export function getHunyuan3DInfo(): {
  webUrl: string
  steps: string[]
  fallbackNote: string
} {
  return {
    webUrl: 'https://3d.hunyuan.tencent.com',
    steps: [
      '打开上方链接（新标签页）',
      '上传你的宠物照片（建议去背、正面全身照）',
      '等待 30-60 秒，AI 自动生成 3D 模型',
      '点击「下载」保存 GLB 文件',
      '回到 PetPal → 工坊 → 手动上传 → 选择刚下载的 GLB',
    ],
    fallbackNote:
      'Hunyuan3D 每天免费 20 次，无需账号。若今天次数用完，可明天再试或改用「手动上传」。',
  }
}

/**
 * 尝试通过 ComfyUI 本地运行 Hunyuan3D-2（需要用户已安装 Hunyuan3D 节点）
 *
 * 注：此函数仅在当前 bridge 指向了 ComfyUI 且已安装 Hunyuan3D 节点时有意义。
 * 默认走云端路径，此处作为兜底。
 */
export async function generateViaHunyuanLocal(
  _imageBase64: string,
  _comfyUrl: string,
): Promise<CloudGenerateResult> {
  // Hunyuan3D ComfyUI 节点尚未普及，此路径保留接口，实际由 ComfyUI 桥接处理
  throw new Error('本地 Hunyuan3D 尚未配置，请使用云端 Forge 或 Hunyuan3D 网页版。')
}

// ─── 统一入口（供 aiService.ts 调用） ────────────────────────

export interface CloudOptions {
  provider: CloudProvider
  /** 可选：自定义提示词，影响生成风格（保留字段，当前仅作提示用） */
  prompt?: string
}

/**
 * 云端 3D 生成统一入口
 *
 * 当前仅支持腾讯 Hunyuan3D 网页版（无公开 API，需用户手动操作）。
 */
export async function generateCloud3D(
  _imageBase64: string,
  _options: CloudOptions,
): Promise<CloudGenerateResult> {
  throw new Error('Hunyuan3D 需手动网页操作，请使用 getHunyuan3DInfo() 获取链接。')
}
