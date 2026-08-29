// PetPal 本地局域网 HTTPS 调试服务器（零依赖）
// 用途：手机连同一 Wi-Fi 即可访问，便于在真实设备上体验。
// 注意：使用自签名证书，手机浏览器会提示"不受信任"，点继续即可。
// 此模式下 PWA"添加到主屏幕"可能被拦截，仅用于交互体验验证。
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const distDir = path.resolve(__dirname, 'dist')
if (!fs.existsSync(distDir)) {
  console.error('✗ dist 目录不存在，请先运行: npm run build')
  process.exit(1)
}

const keyPath = path.join(__dirname, '.cert.key')
const pemPath = path.join(__dirname, '.cert.pem')
if (!fs.existsSync(keyPath) || !fs.existsSync(pemPath)) {
  console.log('· 生成自签证书 (7天有效)...')
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${pemPath}" -days 7 -nodes -subj "/CN=localhost"`,
      { stdio: 'inherit' },
    )
  } catch (e) {
    console.error('✗ 证书生成失败（openssl 不可用），回退到 HTTP 模式')
    keyPath.__failed = true
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

function handler(req, res) {
  const urlPath = (req.url || '/').split('?')[0]
  let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html') // SPA fallback
  }
  const ext = path.extname(filePath)
  try {
    const data = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const PORT = 4174
const useHttps = fs.existsSync(keyPath) && !keyPath.__failed
if (useHttps) {
  const server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(pemPath) },
    handler,
  )
  server.listen(PORT, '0.0.0.0', () => printReady(true))
} else {
  const http = require('http')
  http.createServer(handler).listen(PORT, '0.0.0.0', () => printReady(false))
}

function printReady(isHttps) {
  const nets = os.networkInterfaces()
  const ips = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address)
    }
  }
  const proto = isHttps ? 'https' : 'http'
  console.log('\n✓ PetPal 本地服务已启动')
  console.log('  本机访问 :', `${proto}://localhost:${PORT}`)
  for (const ip of ips) console.log('  手机访问 :', `${proto}://${ip}:${PORT}`)
  if (isHttps) console.log('\n  首次访问会提示"证书不受信任"，点"继续/高级→继续"即可\n')
}
