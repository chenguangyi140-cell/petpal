/**
 * 轻量手动激活码编解码（v1，本地验证，无后端）
 *
 * 设计定位：货币化第一步的「手动模式」——作者用 gen-code 脚本生成激活码，
 * 卖给用户，用户填码解锁。码本身编码「授权天数 + 签发时间戳」，并用校验和
 * 防随机猜测。纯函数、无 DOM 依赖，浏览器与 Node 均可运行。
 *
 * ⚠️ 安全说明：本地校验意味着技术用户可逆向伪造。这是为「验证是否有人愿意付费」
 * 而设计的轻量方案，正式扣费与防破解必须接后端 + 支付商户号（见 docs/LICENSING.md）。
 */

const SALT = 'petpal-license-v1'

/** 确定性哈希，输出 6 位 base36 校验和 */
function hash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0
  }
  return h.toString(36).padStart(6, '0').slice(-6)
}

export interface LicensePayload {
  /** 授权天数（1-3660） */
  days: number
  /** 签发时间戳（仅用于完整性，不参与有效期计算） */
  issue: number
}

/**
 * 生成激活码。
 * 码结构：PP-<base36(天数,3位)><base36(时间戳)><校验和6位>，按 4 位分组。
 * 全程仅含 [0-9A-Z]，大小写不敏感，便于口述/手抄。
 */
export function generateCode(days = 30): string {
  // 先统一大写再算校验和，保证生成与解析的大小写一致
  const raw = (days.toString(36).padStart(3, '0') + Date.now().toString(36)).toUpperCase()
  const sum = hash(raw + SALT).toUpperCase()
  const groups = (raw + sum).match(/.{1,4}/g) ?? [raw + sum]
  return 'PP-' + groups.join('-')
}

/** 解析并校验激活码，无效返回 null */
export function parseCode(input: string): LicensePayload | null {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/^PP/, '')
    .replace(/[^0-9A-Z]/g, '')
  // 最少 3 位天数 + 至少 1 位时间戳 + 6 位校验和
  if (cleaned.length < 10) return null

  const sum = cleaned.slice(-6)
  const raw = cleaned.slice(0, -6)
  if (hash(raw + SALT).toUpperCase() !== sum) return null

  const days = parseInt(raw.slice(0, 3), 36)
  const issue = parseInt(raw.slice(3), 36)
  if (!Number.isFinite(days) || !Number.isFinite(issue)) return null
  if (days <= 0 || days > 3660) return null

  return { days, issue }
}
