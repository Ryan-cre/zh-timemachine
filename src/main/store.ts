import { app, safeStorage } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import type { Provider, Research, Settings } from '../shared/types'
import type { RateState } from '../shared/rate-limit'
let db: DatabaseSync
export function initStore() {
  db = new DatabaseSync(join(app.getPath('userData'), 'timemachine.db'))
  db.exec(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS secrets (id TEXT PRIMARY KEY, value BLOB NOT NULL);',
  )
  for (const r of researches())
    if (r.status === 'running') {
      r.status = 'cancelled'
      r.message = '上次运行已中断，可继续分析'
      saveResearch(r)
    }
}
function list<T>(kind: string): T[] {
  return db
    .prepare('SELECT data FROM records WHERE kind=? ORDER BY rowid DESC')
    .all(kind)
    .map((r) => JSON.parse(r.data as string))
}
function put(kind: string, id: string, value: unknown) {
  db.prepare(
    'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
  ).run(kind, id, JSON.stringify(value))
}
export function secureStorage() {
  return (
    safeStorage.isEncryptionAvailable() &&
    !(
      process.platform === 'linux' &&
      safeStorage.getSelectedStorageBackend() === 'basic_text'
    )
  )
}
export function hasSecret(id: string): boolean {
  return !!db.prepare('SELECT id FROM secrets WHERE id=?').get(id)
}
export function setSecret(id: string, value: string) {
  if (!secureStorage())
    throw new Error('系统密钥存储不可用，请启用系统钥匙串后重试')
  db.prepare(
    'INSERT INTO secrets VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
  ).run(id, safeStorage.encryptString(value))
}
export function getSecret(id: string): string {
  const row = db.prepare('SELECT value FROM secrets WHERE id=?').get(id)
  if (!row) throw new Error('请先在设置中配置 API Key')
  try {
    return safeStorage.decryptString(Buffer.from(row.value as Uint8Array))
  } catch {
    throw new Error('无法解密凭证，请在设置中重新填写')
  }
}
export function settings(): Settings {
  return {
    providers: list<Provider>('provider').map((p) => ({
      ...p,
      hasKey: hasSecret(p.id),
    })),
    hasZhihuKey: hasSecret('zhihu'),
    secureStorage: secureStorage(),
  }
}
export function saveProvider(p: Provider) {
  put('provider', p.id, p)
}
export function deleteProvider(id: string) {
  db.prepare('DELETE FROM records WHERE kind=? AND id=?').run('provider', id)
  db.prepare('DELETE FROM secrets WHERE id=?').run(id)
}
export function researches(): Research[] {
  return list<Research>('research')
}
export function saveResearch(r: Research) {
  put('research', r.id, r)
}
export function removeResearch(id: string) {
  db.prepare('DELETE FROM records WHERE kind=? AND id=?').run('research', id)
}
export function cacheGet(id: string): unknown | undefined {
  const row = db
    .prepare('SELECT data FROM records WHERE kind=? AND id=?')
    .get('cache', id)
  if (!row) return
  const entry = JSON.parse(row.data as string)
  if (Date.now() - entry.at > 3600000) return
  return entry.data
}
export function cacheSet(id: string, data: unknown) {
  put('cache', id, { at: Date.now(), data })
}
export function getRateState(id: string): RateState {
  const row = db.prepare('SELECT data FROM records WHERE kind=? AND id=?').get('rate', id)
  return row ? JSON.parse(row.data as string) : { nextAt: 0, retryAt: 0, strikes: 0 }
}
export function saveRateState(id: string, state: RateState) {
  put('rate', id, state)
}
