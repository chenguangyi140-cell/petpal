import type { SkinId, ThreeViewSet } from '@/types'
import { useAiStore } from '@/store/aiStore'
import {
  generateCloud3D,
  getHunyuan3DInfo,
  type CloudProvider,
  type CloudGenerateResult,
} from './cloudService'

/**
 * AI 形象生成服务（调用本机桥接 → ComfyUI）
 *
 * 设计原则：照片只在本机经 localhost 传给用户自己的 ComfyUI，绝不外传云服务器，
 * 符合「零 API 费 / 隐私不出本机」的底线。本环境无 GPU，无法在此运行推理，
 * 推理由用户机器上的 ComfyUI + 桥接服务完成。
 */

/** 桥接不可达 / 推理失败时的统一错误，UI 据此提示如何启动本机服务 */
export class AIServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export type GenType = SkinId // 'pet' | 'human'

/** 将 base64 dataURL 转为 Blob（用于 GLB 等二进制资产） */
export function dataURLToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const head = parts[0] ?? ''
  const body = parts[1] ?? ''
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const endpoint = useAiStore.getState().endpoint
  let res: Response
  try {
    res = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new AIServiceError(
      '无法连接到本机 AI 服务。请确认已运行 tools/bridge/server.mjs 且 ComfyUI 已启动，或在「设置 → AI 形象服务」中检查地址。',
    )
  }
  if (!res.ok) {
    throw new AIServiceError(`本机 AI 服务返回错误（${res.status}）。请查看桥接服务日志。`)
  }
  return (await res.json()) as T
}

/** 探测桥接服务是否在线（用于 UI 提前提示） */
export async function pingBridge(): Promise<boolean> {
  const endpoint = useAiStore.getState().endpoint
  try {
    const res = await fetch(`${endpoint}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 由单张照片生成本机三视图（前/侧/后）
 * 实际推理在用户 ComfyUI 上由 IP-Adapter + Zero123Plus 等工作流完成。
 */
export async function generateThreeViews(
  image: string,
  type: GenType,
): Promise<ThreeViewSet> {
  const data = await postJSON<{ front: string; side?: string; back: string }>(
    '/api/generate3view',
    { image, type },
  )
  return {
    front: data.front ?? null,
    side: data.side ?? null,
    back: data.back ?? null,
  }
}

/**
 * 由单张照片生成本机 3D 模型（GLB）
 * 实际推理在用户 ComfyUI 上由 TripoSR 等工作流完成，返回 GLB 的 base64 dataURL。
 */
export async function generateModel3d(image: string, type: GenType): Promise<Blob> {
  const data = await postJSON<{ glb: string }>('/api/generate3d', { image, type })
  if (!data.glb) throw new AIServiceError('本机 AI 服务未返回 3D 模型数据。')
  return dataURLToBlob(data.glb)
}

// ─── 云端生成（无 GPU 用户专用） ───────────────────────────────

/**
 * 云端 3D 生成入口（无需 GPU、无需 Key）
 *
 * @param image   - 输入图片（base64 dataURL）
 * @param type    - 宠物/人物类型（仅用于生成提示词）
 * @param provider - 'forge'（自动）| 'hunyuan'（跳转网页手动）
 */
export async function generateModel3dCloud(
  image: string,
  type: GenType,
  provider: CloudProvider = 'forge',
): Promise<Blob> {
  const isPet = type === 'pet'
  const prompt = isPet
    ? 'a cute cartoon pet character, full body, T-pose, white background, stylized 3D render'
    : 'a cute cartoon human character, full body, T-pose, white background, stylized 3D render'

  let result: CloudGenerateResult
  try {
    result = await generateCloud3D(image, { provider, prompt })
  } catch (e) {
    if (e instanceof Error && e.message.includes('Hunyuan3D 需手动')) {
      throw new AIServiceError(getHunyuan3DInfo().webUrl) // 抛出网页 URL 让 UI 展示
    }
    throw e
  }
  return dataURLToBlob(result.glbDataUrl)
}

/**
 * 获取云端 Hunyuan3D 的使用引导（返回网页 URL 字符串）
 * 用于 UI 展示"请跳转到此链接手动操作"的提示。
 */
export function getHunyuan3DWebUrl(): string {
  return getHunyuan3DInfo().webUrl
}
