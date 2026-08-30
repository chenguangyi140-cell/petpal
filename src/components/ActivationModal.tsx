import { useState } from 'react'
import { Check, AlertCircle, Sparkles, X } from 'lucide-react'
import { useLicenseStore } from '@/store/licenseStore'

interface Props {
  /** 是否可关闭：false = 未激活时强制激活，不可跳过 */
  dismissible?: boolean
  onClose?: () => void
}

const ADMIN_TAP_THRESHOLD = 7

export function ActivationModal({ dismissible = false, onClose }: Props) {
  const activate = useLicenseStore((s) => s.activate)
  const activateDemo = useLicenseStore((s) => s.activateDemo)
  const error = useLicenseStore((s) => s.error)
  const [code, setCode] = useState('')
  const [success, setSuccess] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  const handleActivate = () => {
    if (activate(code)) {
      setSuccess(true)
      // 续费场景：短暂提示后关闭弹层
      if (dismissible && onClose) setTimeout(onClose, 900)
    }
  }

  const handleTitleTap = () => {
    const next = tapCount + 1
    setTapCount(next)
    if (next >= ADMIN_TAP_THRESHOLD) {
      activateDemo(3650) // 管理员通道：10 年有效期
      setIsAdmin(true)
      setSuccess(true)
      setTapCount(0)
      if (dismissible && onClose) setTimeout(onClose, 900)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-canvas/95 px-5 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] rounded-[var(--radius-clay)] bg-surface p-6 shadow-[var(--shadow-clay)]">
        {dismissible && (
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-4 top-4 text-ink-muted transition-colors hover:text-ink"
          >
            <X size={20} />
          </button>
        )}

        {/* 品牌：标题连续点击 ADMIN_TAP_THRESHOLD 次触发管理员通道 */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="text-4xl leading-none">🐾</div>
          <h1
            onClick={handleTitleTap}
            className="mt-2 cursor-default select-none font-heading text-2xl text-primary"
            title="管理员通道"
          >
            PetPal 会员激活
          </h1>
          <p className="mt-1 text-xs text-ink-muted">用一张照片，养一个会陪你聊天、有情绪的专属伙伴</p>
        </div>

        {/* 定价卡 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-[var(--radius-clay-sm)] bg-candy-soft px-4 py-3">
            <div>
              <p className="text-sm font-bold text-pink-600">首次激活</p>
              <p className="text-[11px] text-pink-600/70">一次性费用</p>
            </div>
            <span className="font-heading text-2xl text-pink-600">¥99</span>
          </div>
          <div className="flex items-center justify-between rounded-[var(--radius-clay-sm)] bg-sunny-soft px-4 py-3">
            <div>
              <p className="text-sm font-bold text-amber-600">每月续费</p>
              <p className="text-[11px] text-amber-600/70">到期需重新激活</p>
            </div>
            <span className="font-heading text-2xl text-amber-600">¥10</span>
          </div>
          <p className="flex items-center justify-center gap-1 text-[11px] text-ink-muted">
            <Sparkles size={11} /> 一个手机一个授权 · 换设备需重新激活
          </p>
        </div>

        {/* 激活码输入 */}
        <div className="mt-5">
          <label className="mb-1 block text-[11px] font-bold text-ink-muted">激活码</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            placeholder="例如 PP-XXXX-XXXX-XXXX"
            className="input-sm w-full font-mono tracking-wider"
            autoFocus
          />
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-rose-500">
              <AlertCircle size={12} /> {error}
            </p>
          )}
          {success && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-mint">
              <Check size={12} /> {isAdmin ? '管理员模式已激活，正在进入…' : '激活成功，正在进入…'}
            </p>
          )}
        </div>

        <button
          onClick={handleActivate}
          disabled={!code.trim()}
          className="clay-press mt-4 w-full rounded-[var(--radius-clay-sm)] bg-cta py-3 text-base font-bold text-white transition-opacity disabled:opacity-40"
        >
          激活并体验
        </button>

        {/* 手动模式说明 */}
        <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-muted">
          手动激活模式：向作者获取激活码，每月到期需重新输入新码。
          <br />
          激活状态仅保存在本机，清缓存会失效。
        </p>
      </div>
    </div>
  )
}
