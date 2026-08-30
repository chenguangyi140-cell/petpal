/**
 * 云端 AI 形象生成服务（零 GPU 依赖）
 *
 * 为没有 NVIDIA 显卡的用户提供两条免费路径：
 *
 * 1. Forge（three.ws）—— 浏览器直连，无需 Key，自动生成立体模型
 *    - 底层：NVIDIA NIM + Microsoft TRELLIS
 *    - 免费额度：完全免费（draft 层级）
 *    - 限制：队列可能排队，生成质量中等
 *
 * 2. Hunyuan3D（腾讯混元）—— 通过本桥接转发到云端或用户提供链接
 *    - 免费额度：每天 20 次生成（web 版 3d.hunyuan.tencent.com）
 *    - 注意：Hunyuan3D 无公开 API，本服务仅支持直接返回网页链接，
 *      用户手动操作后回填 GLB。
 *
 * 设计原则：所有图片经浏览器直连云端，照片不出本机。
 */

export type CloudProvider = 'forge' | 'hunyuan'

/** 云端生成时的进度通知 */
export type ForgeProgressStatus = 'queued' | 'processing' | 'done' | 'failed'

export interface ForgeProgress {
  /** 任务当前状态（未确定时为 null） */
  status: ForgeProgressStatus | null
  /** 队列中的位置（未返回时为 null） */
  queuePosition: number | null
  /** 预计剩余毫秒数（未返回时为 null） */
  etaMs: number | null
  /** 错误信息（status=failed 时有值） */
  errorMessage?: string
}

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

// ─── Forge（three.ws） ────────────────────────────────────────

type Json = Record<string, any>

/**
 * 调用 three.ws Forge API 生成 3D 模型（免费 draft 档，无需 Key）
 *
 * - 端点：https://three.ws/api/forge （auth-free，支持浏览器 fetch / CORS）
 * - 免费档走 NVIDIA NIM + TRELLIS，返回持久化 GLB 的 CDN 链接
 * - 可能为异步任务：若返回 job_id 则轮询直至 status=done
 * - 图片以 data URI 直接放入 images 数组，照片不出浏览器（不依赖 Node Buffer）
 * - 若提交步骤因网络抖动失败，自动重试 1 次
 */
export async function generateViaForge(
  imageBase64: string,
  prompt: string = 'a cute cartoon pet character, full body, T-pose, white background',
  /** 可选：进度回调，每次轮询结果都触发（含初始 status=null 的占位） */
  onProgress?: (p: ForgeProgress) => void,
): Promise<CloudGenerateResult> {
  const t0 = performance.now()
  const FORGE_URL = 'https://three.ws/api/forge'

  const body = {
    prompt,
    tier: 'draft', // 免费档
    path: 'image', // 图生 3D
    backend: 'nvidia', // 免费 keyless 通道
    images: [imageBase64], // 官方 SDK 字段名
    image_urls: [imageBase64], // REST 文档字段名（兼容性兜底）
  }

  /** 提交一次 Forge 请求（含单次自动重试） */
  const trySubmit = async (attempt: number): Promise<Response> => {
    let res: Response
    try {
      res = await fetch(FORGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      })
    } catch (e) {
      // 提交阶段网络抖动：尝试 1 次重试
      if (attempt > 0) throw e
      await new Promise((r) => setTimeout(r, 1500))
      return trySubmit(attempt + 1)
    }
    if (!res.ok && attempt === 0) {
      // 服务端 5xx 也试一次
      await new Promise((r) => setTimeout(r, 2000))
      return trySubmit(attempt + 1)
    }
    return res
  }

  // 1) 提交任务（带自动重试）
  const submit = await trySubmit(0)
  if (!submit.ok) {
    const txt = await submit.text().catch(() => '')
    throw new Error(`Forge 提交失败 ${submit.status}: ${txt.slice(0, 200)}`)
  }
  const data = (await submit.json()) as Json

  // 2) 解析 GLB 链接（可能同步返回，也可能返回 job_id 需轮询）
  let glbUrl = extractGlbUrl(data)
  const jobId = extractJobId(data)
  if (!glbUrl && jobId) {
    glbUrl = await pollForgeJob(jobId, onProgress)
  }
  if (!glbUrl) {
    throw new Error('Forge 未返回 GLB 链接，队列可能已满，请稍后重试或改用 Hunyuan3D 网页版。')
  }

  // 3) 下载 GLB 并转为 dataURL（浏览器原生，无 Node Buffer 依赖）
  const glbDataUrl = await downloadGlbAsDataUrl(glbUrl)
  return {
    glbDataUrl,
    engine: 'forge',
    durationMs: Math.round(performance.now() - t0),
  }
}

/** 从多种可能的响应结构中提取 GLB URL */
function extractGlbUrl(data: Json): string | null {
  return (
    data?.glbUrl ||
    data?.glb_url ||
    data?.result?.glbUrl ||
    data?.result?.glb_url ||
    data?.output?.glbUrl ||
    data?.output?.glb_url ||
    data?.model?.glbUrl ||
    null
  )
}

/** 从响应中提取异步任务 ID */
function extractJobId(data: Json): string | null {
  return data?.jobId || data?.job_id || data?.creation_id || data?.id || null
}

/** 轮询异步任务直至完成，返回 GLB URL */
async function pollForgeJob(jobId: string, onProgress?: (p: ForgeProgress) => void): Promise<string> {
  const url = `https://three.ws/api/forge?job=${encodeURIComponent(jobId)}`
  const deadline = Date.now() + 280_000 // 总计约 5 分钟
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (res.ok) {
        const data = (await res.json()) as Json
        const statusRaw = data?.status
        let status: ForgeProgressStatus | null = null
        if (statusRaw === 'queued' || statusRaw === 'processing' || statusRaw === 'done' || statusRaw === 'failed') {
          status = statusRaw
        }
        // 尝试解析队列位置 / ETA（不同字段名兜底）
        const queuePosition = typeof data?.queue_position === 'number'
          ? data.queue_position
          : typeof data?.queuePosition === 'number'
            ? data.queuePosition
            : null
        const etaMs = typeof data?.eta_ms === 'number'
          ? data.eta_ms
          : typeof data?.etaMs === 'number'
            ? data.etaMs
            : null
        const errorMessage = (data?.message && status === 'failed') ? String(data.message) : undefined

        onProgress?.({ status, queuePosition, etaMs, errorMessage })

        if (status === 'done') {
          const glb = extractGlbUrl(data)
          if (glb) return glb
        }
        if (status === 'failed') {
          throw new Error(`Forge 生成失败：${data?.message ?? '任务失败'}`)
        }
      }
    } catch (e) {
      // 网络抖动或轮询超时：继续下一次，直到总超时（生成失败则直接抛出）
      if (e instanceof Error && e.message.startsWith('Forge 生成失败')) throw e
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  onProgress?.({ status: 'failed', queuePosition: null, etaMs: null, errorMessage: '超时' })
  throw new Error('Forge 生成超时（超过 5 分钟），请稍后在网页版重试。')
}

/** 下载 GLB 并转为 base64 dataURL（浏览器原生，无 Node Buffer 依赖） */
async function downloadGlbAsDataUrl(glbUrl: string): Promise<string> {
  const res = await fetch(glbUrl, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error('GLB 下载失败')
  const buf = await res.arrayBuffer()
  return `data:model/gltf-binary;base64,${arrayBufferToBase64(buf)}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

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
      'Hunyuan3D 每天免费 20 次，无需账号。若今天次数用完，可换用 Forge（上方选项）。',
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
  /** 可选：自定义提示词，影响生成风格 */
  prompt?: string
  /** 仅 Hunyuan3D 网页版模式使用 */
  hunyuanWebUrl?: string
}

/**
 * 云端 3D 生成统一入口
 *
 * @param imageBase64 - 输入图片（base64 dataURL，已去背更佳）
 * @param options     - 提供商选择及参数
 */
export async function generateCloud3D(
  imageBase64: string,
  options: CloudOptions,
): Promise<CloudGenerateResult> {
  switch (options.provider) {
    case 'forge':
      return generateViaForge(imageBase64, options.prompt)
    case 'hunyuan':
      // Hunyuan3D 无 API，返回网页引导
      throw new Error('Hunyuan3D 需手动网页操作，请使用 getHunyuan3DInfo() 获取链接。')
    default:
      throw new Error(`未知的云端提供商：${options.provider}`)
  }
}
