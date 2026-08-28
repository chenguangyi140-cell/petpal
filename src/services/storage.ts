import { openDB, type IDBPDatabase } from 'idb'

/**
 * 资产持久化（IndexedDB）
 *
 * 为什么不用 localStorage：宠物照片去背后是数 MB 的 dataURL，
 * localStorage 仅 5MB 配额且读写阻塞主线程，会让 UI 卡顿。
 * IndexedDB 配额充足且异步，是唯一合理选择。
 */

const DB_NAME = 'petpal'
const DB_VERSION = 1
const ASSET_STORE = 'assets'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE)
      }
    },
  })
  return dbPromise
}

/** 资产键名常量，避免散落字符串导致读写不一致 */
export const ASSET_KEYS = {
  cutout: 'pet.cutout',
  original: 'pet.original',
} as const

export async function saveAsset(key: string, value: string): Promise<void> {
  try {
    const db = await getDB()
    await db.put(ASSET_STORE, value, key)
  } catch (err) {
    // 配额不足时降级：仅记录，不阻断主流程（照片丢失可重新上传）
    console.warn('[storage] saveAsset failed', key, err)
  }
}

export async function loadAsset(key: string): Promise<string | null> {
  try {
    const db = await getDB()
    const value = await db.get(ASSET_STORE, key)
    return typeof value === 'string' ? value : null
  } catch (err) {
    console.warn('[storage] loadAsset failed', key, err)
    return null
  }
}

export async function deleteAsset(key: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(ASSET_STORE, key)
  } catch (err) {
    console.warn('[storage] deleteAsset failed', key, err)
  }
}

export async function clearAllAssets(): Promise<void> {
  try {
    const db = await getDB()
    await db.clear(ASSET_STORE)
  } catch (err) {
    console.warn('[storage] clearAllAssets failed', err)
  }
}
