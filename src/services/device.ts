/**
 * 设备指纹：生成本机唯一 ID 并持久化。
 * 用于「一个手机一个授权」——激活状态与设备绑定（手动模式下存于 localStorage，
 * 清缓存会丢失授权，需重新填码；这正是轻量模式的预期行为）。
 */

const DEVICE_KEY = 'petpal.deviceId'

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    // localStorage 不可用（极端隐私模式）时退化为固定标识
    return 'device-unknown'
  }
}
