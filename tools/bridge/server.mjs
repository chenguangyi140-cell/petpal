/**
 * PetPal 本机 AI 桥接服务（零依赖，Node 18+）
 *
 * 作用：把浏览器里的「上传一张照片」请求，转发到你本机运行的 ComfyUI，
 * 由 ComfyUI 上的多视图 / 3D 工作流推理，再把结果（三视图图片 或 GLB 模型）
 * 回传前端。照片只在你自己的机器上经 localhost 流转，绝不外传。
 *
 * 用法：
 *   node server.mjs
 * 环境变量（均可选）：
 *   PORT=8787              本服务端口（前端「AI 形象服务」地址填这个）
 *   COMFY_URL=http://127.0.0.1:8188   ComfyUI 地址
 *   CONFIG=./bridge.config.json        节点映射配置
 *
 * 前端填：http://localhost:8787
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188'
const CONFIG_PATH = process.env.CONFIG || join(__dirname, 'bridge.config.json')

let CONFIG = {}
if (existsSync(CONFIG_PATH)) {
  CONFIG = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'))
}

const CLIENT_ID = randomUUID()

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function dataUrlToBuffer(dataUrl) {
  const [, body] = dataUrl.split(',')
  return Buffer.from(body, 'base64')
}

/** 上传图片到 ComfyUI 输入队列，返回 ComfyUI 内部的文件名 */
async function uploadImage(buffer, filename) {
  const boundary = `----petpal${randomUUID()}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([head, buffer, tail])
  const res = await fetch(`${COMFY}/upload/image`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`ComfyUI 上传失败 ${res.status}`)
  const j = await res.json()
  return j.name
}

/** 提交工作流，返回 prompt_id */
async function submitPrompt(prompt) {
  const res = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: CLIENT_ID }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`ComfyUI 提交失败 ${res.status}: ${txt}`)
  }
  const j = await res.json()
  return j.prompt_id
}

/** 轮询历史，直到该 prompt 完成 */
async function waitHistory(promptId, timeoutMs = 600000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${COMFY}/history/${promptId}`)
    if (res.ok) {
      const j = await res.json()
      if (j[promptId]) return j[promptId]
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('ComfyUI 推理超时')
}

/** 把历史输出节点里的图片/模型文件拉回并转成 dataURL */
async function fetchOutput(nodeId, output) {
  // 图片类型
  if (output.images && output.images.length) {
    const img = output.images[0]
    const url = `${COMFY}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(
      img.subfolder || '',
    )}&type=${encodeURIComponent(img.type || 'output')}`
    const r = await fetch(url)
    const buf = Buffer.from(await r.arrayBuffer())
    const mime = img.filename.endsWith('.png')
      ? 'image/png'
      : img.filename.endsWith('.jpg') || img.filename.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  }
  // GLB / GLTF 模型
  const modelKey = output.gltf ? 'gltf' : output.glb ? 'glb' : null
  if (modelKey) {
    const fname = output[modelKey]
    const url = `${COMFY}/view?filename=${encodeURIComponent(fname)}&type=output`
    const r = await fetch(url)
    const buf = Buffer.from(await r.arrayBuffer())
    const mime = fname.endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json'
    return `data:${mime};base64,${buf.toString('base64')}`
  }
  throw new Error(`未知的输出格式（节点 ${nodeId}）`)
}

async function runGeneration(cfg, imageDataUrl) {
  if (!cfg || !cfg.workflow) throw new Error('桥接配置缺失该模式的 workflow')
  const wfPath = join(__dirname, cfg.workflow)
  if (!existsSync(wfPath)) throw new Error(`找不到工作流文件：${wfPath}`)
  const workflow = JSON.parse(await readFile(wfPath, 'utf-8'))

  // 注入输入图片
  const inputNode = workflow[cfg.inputNode]
  if (!inputNode) throw new Error(`工作流缺少输入节点 ${cfg.inputNode}`)
  const buffer = dataUrlToBuffer(imageDataUrl)
  const filename = `petpal_${randomUUID()}.png`
  const comfyName = await uploadImage(buffer, filename)
  inputNode.inputs[cfg.inputField || 'image'] = comfyName

  const promptId = await submitPrompt(workflow)
  const history = await waitHistory(promptId)
  const outputs = history.outputs || {}

  // 收集各输出节点（nodeId 为 null 表示该视角暂未接入，回退留空）
  const result = {}
  for (const [key, nodeId] of Object.entries(cfg.outputNodes)) {
    if (!nodeId) {
      result[key] = null
      continue
    }
    const out = outputs[nodeId]
    if (!out) throw new Error(`推理结果缺少输出节点 ${nodeId}`)
    result[key] = await fetchOutput(nodeId, out)
  }
  return result
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '')
  const url = new URL(req.url, `http://localhost:${PORT}`)

  try {
    if (url.pathname === '/health') {
      // 顺便探测 ComfyUI 是否在线
      let comfyOk = false
      try {
        const r = await fetch(`${COMFY}/system_stats`)
        comfyOk = r.ok
      } catch {}
      return send(res, 200, { ok: true, comfy: comfyOk, comfyUrl: COMFY })
    }

    if (url.pathname === '/api/generate3view' && req.method === 'POST') {
      const { image, type } = await readBody(req)
      if (!image) return send(res, 400, { error: '缺少 image' })
      const result = await runGeneration(CONFIG.threeView, image)
      // 归一化为 {front, side, back}
      return send(res, 200, {
        front: result.front || null,
        side: result.side || null,
        back: result.back || null,
      })
    }

    if (url.pathname === '/api/generate3d' && req.method === 'POST') {
      const { image, type } = await readBody(req)
      if (!image) return send(res, 400, { error: '缺少 image' })
      const result = await runGeneration(CONFIG.model3d, image)
      return send(res, 200, { glb: result.glb || result.model || null })
    }

    return send(res, 404, { error: 'not found' })
  } catch (e) {
    console.error('[bridge] 错误', e)
    return send(res, 500, { error: String(e?.message || e) })
  }
})

server.listen(PORT, () => {
  console.log(`[PetPal 桥接] 监听 http://localhost:${PORT}`)
  console.log(`[PetPal 桥接] 转发到 ComfyUI: ${COMFY}`)
  console.log(`[PetPal 桥接] 配置: ${CONFIG_PATH}`)
})
