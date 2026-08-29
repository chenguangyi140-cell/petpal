import { useState } from 'react'
import {
  Bell,
  Bot,
  ChevronDown,
  KeyRound,
  Link2,
  Moon,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { usePetStore, selectBond } from '@/store/petStore'
import { useLicenseStore } from '@/store/licenseStore'
import { getSkin } from '@/skins/registry'

export function SettingsPanel() {
  const settings = useSettingsStore()
  const bond = usePetStore(selectBond)
  const profile = usePetStore((s) => s.profile)
  const skin = getSkin(profile?.skin)
  const removePet = usePetStore((s) => s.removePet)

  const active = useLicenseStore((s) => s.active)
  const expiresAt = useLicenseStore((s) => s.expiresAt)
  const deviceId = useLicenseStore((s) => s.deviceId)
  const daysLeft = useLicenseStore((s) => s.daysLeft)()
  const openActivation = useLicenseStore((s) => s.openActivation)

  const [showLLM, setShowLLM] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="space-y-4">
      {/* 智能对话 */}
      <Section icon={<Bot size={16} />} title="智能对话">
        <Toggle
          label="启用 AI 大模型（关闭则使用内置离线语料）"
          checked={settings.llm.enabled}
          onChange={(v) => settings.setLLM({ enabled: v })}
        />
        {!settings.llm.enabled && (
          <p className="mt-1 text-[11px] text-ink-muted">
            当前为零成本离线模式，对话基于本地规则引擎，无需任何 API 费用。
          </p>
        )}

        <button
          onClick={() => setShowLLM((s) => !s)}
          className="mt-2 flex w-full items-center justify-between rounded-[10px] bg-canvas px-3 py-2 text-xs font-bold text-ink-muted"
        >
          <span className="flex items-center gap-1.5">
            <KeyRound size={13} /> 配置模型接口
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${showLLM ? 'rotate-180' : ''}`}
          />
        </button>

        {showLLM && (
          <div className="mt-2 space-y-2 rounded-[10px] bg-canvas p-3">
            <Field label="接口地址">
              <input
                value={settings.llm.baseUrl}
                onChange={(e) => settings.setLLM({ baseUrl: e.target.value })}
                className="input-sm"
                placeholder="https://api.deepseek.com/v1"
              />
            </Field>
            <Field label="模型名">
              <input
                value={settings.llm.model}
                onChange={(e) => settings.setLLM({ model: e.target.value })}
                className="input-sm"
                placeholder="deepseek-chat"
              />
            </Field>
            <Field label="API Key（仅存于内存，不落盘）">
              <input
                type="password"
                value={settings.llm.apiKey}
                onChange={(e) => settings.setLLM({ apiKey: e.target.value })}
                className="input-sm"
                placeholder="sk-..."
              />
            </Field>
            <p className="text-[10px] text-ink-muted">
              <Link2 size={10} className="mr-0.5 inline" />
              前端直连会暴露 Key，正式发布请走后端代理。
            </p>
          </div>
        )}
      </Section>

      {/* 主动对话 */}
      <Section icon={<Bell size={16} />} title="主动互动">
        <Toggle
          label={skin.strings.proactiveToggleLabel}
          checked={settings.proactiveEnabled}
          onChange={(v) => settings.update({ proactiveEnabled: v })}
        />
        <Field label={`每日主动上限：${settings.dailyProactiveLimit} 条`}>
          <input
            type="range"
            min={0}
            max={20}
            value={settings.dailyProactiveLimit}
            onChange={(e) => settings.update({ dailyProactiveLimit: Number(e.target.value) })}
            className="w-full accent-pink-500"
          />
        </Field>

        <Toggle
          label="勿扰时段"
          checked={settings.quietHours.enabled}
          onChange={(v) => settings.update({ quietHours: { ...settings.quietHours, enabled: v } })}
        />
        {settings.quietHours.enabled && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>从</span>
            <HourSelect
              value={settings.quietHours.startHour}
              onChange={(h) => settings.update({ quietHours: { ...settings.quietHours, startHour: h } })}
            />
            <span>到</span>
            <HourSelect
              value={settings.quietHours.endHour}
              onChange={(h) => settings.update({ quietHours: { ...settings.quietHours, endHour: h } })}
            />
            <span>不主动打扰</span>
          </div>
        )}
      </Section>

      {/* 体验 */}
      <Section icon={<Moon size={16} />} title="体验">
        <Toggle
          label="减少动画（低能耗/无障碍）"
          checked={settings.reduceMotion}
          onChange={(v) => settings.update({ reduceMotion: v })}
        />
      </Section>

      {/* 会员 */}
      <Section icon={<KeyRound size={16} />} title="会员">
        {active && expiresAt ? (
          <div className="rounded-[10px] bg-canvas p-3 text-xs text-ink-muted">
            <p>
              状态：<span className="font-bold text-mint">已激活</span>
            </p>
            <p className="mt-0.5">
              有效期至 {new Date(expiresAt).toLocaleDateString('zh-CN')}（剩余 {daysLeft} 天）
            </p>
            <p className="mt-0.5 break-all">本机设备：{deviceId.slice(0, 8)}…</p>
          </div>
        ) : (
          <p className="rounded-[10px] bg-canvas p-3 text-xs text-ink-muted">
            尚未激活，激活后可长期使用并每月续费。
          </p>
        )}
        <button
          onClick={openActivation}
          className="clay-press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-cta py-2.5 text-sm font-bold text-white"
        >
          {active ? '续费 / 重新激活' : '立即激活'}
        </button>
        <p className="mt-1.5 text-center text-[10px] text-ink-muted">
          ¥99 首次 · ¥10/月 · 一个设备一授权
        </p>
      </Section>

      {/* 危险区 */}
      <Section icon={<Trash2 size={16} />} title="数据">
        <div className="rounded-[10px] bg-canvas p-3 text-xs text-ink-muted">
          <p>
            {skin.strings.entityWord}：<span className="font-bold text-ink">{profile?.name}</span> · Lv.{bond.level}
          </p>
          <p className="mt-0.5">所有照片与状态均仅存储在本机，不会上传任何服务器。</p>
        </div>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="clay-press mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-surface py-2.5 text-sm font-bold text-cta"
          >
            <RotateCcw size={15} /> {skin.strings.resetButtonLabel}
          </button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setConfirmReset(false)}
              className="clay-press flex-1 rounded-[var(--radius-clay-sm)] bg-surface py-2.5 text-sm font-bold text-ink-muted"
            >
              取消
            </button>
            <button
              onClick={() => void removePet()}
              className="clay-press flex-1 rounded-[var(--radius-clay-sm)] bg-cta py-2.5 text-sm font-bold text-white"
            >
              确认重置
            </button>
          </div>
        )}
      </Section>

      <p className="pt-2 text-center text-[11px] text-ink-muted">PetPal · 你的零成本陪伴 · v0.1.0</p>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[var(--radius-clay-sm)] bg-surface p-4 shadow-[var(--shadow-clay-sm)]">
      <div className="mb-3 flex items-center gap-2 font-heading text-base text-primary">
        <span className="text-candy">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1 text-sm text-ink">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
          checked ? 'bg-candy' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <span className="mb-1 block text-[11px] font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

function HourSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-[10px] border-2 border-line bg-surface px-2 py-1 font-bold text-ink outline-none focus:border-candy"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  )
}
