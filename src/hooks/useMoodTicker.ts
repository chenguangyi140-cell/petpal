import { useEffect } from 'react'
import { usePetStore } from '@/store/petStore'

/**
 * 心情衰减驱动器
 *
 * 双节奏设计：
 * - 前台每 30s tick 一次，保证 UI 上的心情条平滑变化
 * - 监听 visibilitychange，从后台切回时立即补算离线期间的衰减
 *   否则会出现「挂着一小时回来，宠物还是满状态」的沉浸感断裂
 */
export function useMoodTicker(intervalMs = 30_000) {
  const tick = usePetStore((s) => s.tick)

  useEffect(() => {
    tick() // 挂载即补算

    const timer = setInterval(tick, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tick, intervalMs])
}
