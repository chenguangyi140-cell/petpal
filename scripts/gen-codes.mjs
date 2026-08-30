/**
 * 激活码批量生成器（与 src/services/license.ts 算法严格一致）
 * 用法: node scripts/gen-codes.mjs [数量] [天数]
 */
const SALT = 'petpal-license-v1'

function hash(input) {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0
  }
  return h.toString(36).padStart(6, '0').slice(-6)
}

function generateCode(days = 30, issue = Date.now()) {
  const raw = (days.toString(36).padStart(3, '0') + issue.toString(36)).toUpperCase()
  const sum = hash(raw + SALT).toUpperCase()
  const groups = (raw + sum).match(/.{1,4}/g) ?? [raw + sum]
  return 'PP-' + groups.join('-')
}

const count = parseInt(process.argv[2] || '8', 10)
const days = parseInt(process.argv[3] || '365', 10)

console.log(`# PetPal 体验码 — ${count} 个, 有效期 ${days} 天`)
console.log(`# 生成时间: ${new Date().toISOString()}`)
console.log('# 域名: https://mypetpal.cn')
console.log('')
for (let i = 1; i <= count; i++) {
  // 每码递增 60s，确保时间戳唯一（避免毫秒级碰撞导致码重复）
  console.log(`体验码 #${String(i).padStart(2, '0')}: ${generateCode(days, Date.now() + i * 60_000)}`)
}
