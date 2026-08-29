import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Sparkles, Shirt, Palette, Settings } from 'lucide-react'
import { usePetStore, computeBondLevel } from '@/store/petStore'
import { useLicenseStore, useLicenseActive } from '@/store/licenseStore'
import { ActivationModal } from '@/components/ActivationModal'
import { PetStage } from '@/components/PetStage'
import { ChatPanel } from '@/components/panels/ChatPanel'
import { ActionPanel } from '@/components/panels/ActionPanel'
import { WardrobePanel } from '@/components/panels/WardrobePanel'
import { MakeupPanel } from '@/components/panels/MakeupPanel'
import { SettingsPanel } from '@/components/panels/SettingsPanel'
import { Onboarding } from '@/components/Onboarding'
import { getSkin } from '@/skins/registry'
import { useMoodTicker } from '@/hooks/useMoodTicker'
import { useProactiveChat } from '@/hooks/useProactiveChat'

type TabId = 'chat' | 'play' | 'wardrobe' | 'makeup' | 'settings'

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: typeof MessageCircle }> = [
  { id: 'chat', label: '聊天', Icon: MessageCircle },
  { id: 'play', label: '互动', Icon: Sparkles },
  { id: 'wardrobe', label: '换装', Icon: Shirt },
  { id: 'makeup', label: '化妆', Icon: Palette },
  { id: 'settings', label: '设置', Icon: Settings },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('chat')
  const profile = usePetStore((s) => s.profile)
  const hydrated = usePetStore((s) => s.hydrated)
  const xp = usePetStore((s) => s.xp)
  const bond = useMemo(() => computeBondLevel(xp), [xp])
  const skin = getSkin(profile?.skin)

  const licenseOk = useLicenseActive()
  const showActivation = useLicenseStore((s) => s.showActivation)
  const closeActivation = useLicenseStore((s) => s.closeActivation)

  // 启动时从 IndexedDB 恢复照片资产（dataURL 过大不进 localStorage）
  useEffect(() => {
    void usePetStore.getState().hydrate()
  }, [])

  // 开发/演示用一键激活：?demo=petpal（发布前请移除该分支）
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('demo') === 'petpal' && !useLicenseStore.getState().isActive()) {
      useLicenseStore.getState().activateDemo(30)
    }
  }, [])

  useMoodTicker()
  useProactiveChat()

  // 未激活：必须激活才能使用（手动收费模式 v1）
  if (!licenseOk) {
    return <ActivationModal dismissible={false} />
  }

  // 未完成引导时展示创建流程
  if (!profile) {
    return <Onboarding />
  }

  const appTree = (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-canvas">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-heading text-xl text-primary">
          <span className="text-2xl leading-none">{skin.strings.appEmoji}</span>
          <span>{profile.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-candy-soft px-3 py-1 text-xs font-bold text-pink-600">
            Lv.{bond.level}
          </span>
          <span className="rounded-full bg-sunny-soft px-3 py-1 text-xs font-bold text-amber-600">
            {bond.xp} XP
          </span>
        </div>
      </header>

      {/* 宠物舞台 */}
      <PetStage />

      {/* 底部功能面板 */}
      <div className="relative z-20 -mt-6 rounded-t-[28px] bg-surface px-4 pt-4 pb-6 shadow-[0_-4px_20px_rgba(30,41,59,0.06)]">
        <nav className="mb-4 flex gap-1 rounded-[14px] bg-canvas p-1" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-[10px] py-2.5 text-xs font-bold transition-all duration-200 ${
                tab === id
                  ? 'bg-surface text-primary shadow-[var(--shadow-clay-sm)]'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-h-[280px]">
          {tab === 'chat' && <ChatPanel />}
          {tab === 'play' && <ActionPanel />}
          {tab === 'wardrobe' && <WardrobePanel />}
          {tab === 'makeup' && <MakeupPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </div>

      {/* 资产水合前的遮罩：避免闪现无照片的空态 */}
      {!hydrated && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-canvas/60" aria-hidden />
      )}
    </div>
  )

  return (
    <>
      {appTree}
      {showActivation && <ActivationModal dismissible onClose={closeActivation} />}
    </>
  )
}
