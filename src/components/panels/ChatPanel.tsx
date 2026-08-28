import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { usePetStore } from '@/store/petStore'

const QUICK_PHRASES: readonly string[] = [
  '你好呀',
  '你爱我吗',
  '我想你了',
  '今天开心吗',
  '陪我玩',
  '该吃饭啦',
  '好可爱的宝贝',
  '晚安',
]

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const pending = useChatStore((s) => s.pending)
  const send = useChatStore((s) => s.send)
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const petName = usePetStore((s) => s.profile?.name ?? '小暖')

  // 新消息到达时自动滚动到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    await send(text)
  }

  return (
    <div className="flex flex-col">
      {/* 消息列表 */}
      <div
        ref={listRef}
        className="mb-3 flex h-[180px] flex-col gap-2 overflow-y-auto rounded-[var(--radius-clay)] bg-canvas p-3"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">
            和{petName}说点什么吧～
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed animate-[msgIn_250ms_ease-out] ${
              m.role === 'user'
                ? 'self-end rounded-br-md bg-primary text-white'
                : 'self-start rounded-bl-md bg-surface text-ink shadow-[var(--shadow-clay-sm)]'
            }`}
          >
            {m.content}
          </div>
        ))}

        {pending && (
          <div className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 shadow-[var(--shadow-clay-sm)]">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-xs text-ink-muted">思考中…</span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder={`对${petName}说点什么…`}
          maxLength={100}
          aria-label="聊天输入"
          className="min-w-0 flex-1 rounded-full border-2 border-line bg-canvas px-4 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-primary"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || pending}
          aria-label="发送"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-all duration-200 hover:bg-primary-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* 快捷短语 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_PHRASES.map((p) => (
          <button
            key={p}
            onClick={() => void send(p)}
            disabled={pending}
            className="cursor-pointer rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
