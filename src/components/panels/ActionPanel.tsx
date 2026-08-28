import { useState } from 'react'
import { usePetStore } from '@/store/petStore'
import { useChatStore } from '@/store/chatStore'
import { INTERACTIONS, INTERACTION_ORDER, type InteractionKind } from '@/constants/interactions'

export function ActionPanel() {
  const interact = usePetStore((s) => s.interact)
  const pushPetMessage = useChatStore((s) => s.pushPetMessage)
  const [lastReply, setLastReply] = useState<string | null>(null)

  const handle = (kind: InteractionKind) => {
    const reply = interact(kind)
    setLastReply(reply)
    pushPetMessage(reply, { emotion: INTERACTIONS[kind].emotion, proactive: 'event' })
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5">
        {INTERACTION_ORDER.map((kind) => {
          const def = INTERACTIONS[kind]
          return (
            <button
              key={kind}
              onClick={() => handle(kind)}
              aria-label={def.label}
              className="clay-press flex cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-clay-sm)] bg-canvas p-3"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {def.glyph}
              </span>
              <span className="text-[11px] font-bold text-ink-muted">{def.label}</span>
            </button>
          )
        })}
      </div>

      {lastReply && (
        <p className="mt-4 rounded-[var(--radius-clay-sm)] bg-primary-soft px-4 py-3 text-center text-sm font-semibold text-ink">
          {lastReply}
        </p>
      )}
    </div>
  )
}
