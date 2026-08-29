#!/usr/bin/env node
/**
 * 生成 PetPal 手动激活码（与 src/services/license.ts 算法保持一致）。
 *
 * 用法：
 *   node scripts/gen-code.mjs          # 默认 30 天
 *   node scripts/gen-code.mjs 30       # 指定天数
 *
 * ⚠️ 算法须与 src/services/license.ts 中的 generateCode 同步修改，否则生成的码无法被 App 识别。
 */
const SALT = 'petpal-license-v1'

function hash(input) {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0
  }
  return h.toString(36).padStart(6, '0').slice(-6)
}

function generateCode(days = 30) {
  // 先统一大写再算校验和，保证生成与解析的大小写一致
  const raw = (days.toString(36).padStart(3, '0') + Date.now().toString(36)).toUpperCase()
  const sum = hash(raw + SALT).toUpperCase()
  const groups = (raw + sum).match(/.{1,4}/g) || [raw + sum]
  return 'PP-' + groups.join('-')
}

const days = Number(process.argv[2] || 30)
if (!Number.isFinite(days) || days <= 0 || days > 3660) {
  console.error('用法：node scripts/gen-code.mjs [天数(1-3660)]')
  process.exit(1)
}

const code = generateCode(days)
console.log(`\n  激活码（有效期 ${days} 天）：\n  ${code}\n`)
console.log('  把这一串发给已付款的用户，在 App「会员激活」里填入即可。\n')
