import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AcneRecord } from './types'
import { mergeRecords } from './store'

const CONFIG_KEY = 'doudou-supabase'

export interface SyncConfig {
  url: string
  anonKey: string
}

/** 构建时内置的默认配置（来自环境变量），新设备无需手填 */
const BUILTIN: SyncConfig | null =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      }
    : null

/** 是否存在内置配置（界面据此跳过 URL/key 填写步骤） */
export function hasBuiltinConfig(): boolean {
  return BUILTIN !== null
}

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw) as SyncConfig
  } catch {
    /* 忽略坏数据，回退到内置配置 */
  }
  return BUILTIN
}

export function saveSyncConfig(cfg: SyncConfig | null) {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  else localStorage.removeItem(CONFIG_KEY)
  client = null
}

let client: SupabaseClient | null = null

export function getClient(): SupabaseClient | null {
  if (client) return client
  const cfg = getSyncConfig()
  if (!cfg) return null
  client = createClient(cfg.url, cfg.anonKey)
  return client
}

export async function getUserEmail(): Promise<string | null> {
  const c = getClient()
  if (!c) return null
  const { data } = await c.auth.getUser()
  return data.user?.email ?? null
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const c = getClient()
  if (!c) return '请先填写 Supabase 配置'
  const { error } = await c.auth.signInWithPassword({ email, password })
  return error ? error.message : null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const c = getClient()
  if (!c) return '请先填写 Supabase 配置'
  const { error } = await c.auth.signUp({ email, password })
  return error ? error.message : null
}

export async function signOut() {
  await getClient()?.auth.signOut()
}

export interface SyncResult {
  merged: AcneRecord[]
  pushed: number
  pulled: number
}

/**
 * 双向同步：拉取云端全部记录，与本地按 updatedAt 合并（新者胜），
 * 再把本地较新的推送上去。删除以墓碑形式同步。
 */
export async function syncRecords(local: AcneRecord[]): Promise<SyncResult> {
  const c = getClient()
  if (!c) throw new Error('未配置云同步')
  const { data: userData, error: userErr } = await c.auth.getUser()
  if (userErr || !userData.user) throw new Error('请先登录')
  const userId = userData.user.id

  const { data: rows, error } = await c.from('acne_records').select('id, data')
  if (error) throw new Error(error.message)

  const remote = (rows ?? []).map((r) => r.data as AcneRecord)
  const remoteMap = new Map(remote.map((r) => [r.id, r]))
  const merged = mergeRecords(remote, local)

  const toPush = merged.filter((m) => {
    const r = remoteMap.get(m.id)
    return !r || m.updatedAt > r.updatedAt
  })
  const pulled = merged.filter((m) => {
    const l = local.find((x) => x.id === m.id)
    return !l || m.updatedAt > l.updatedAt
  }).length

  if (toPush.length > 0) {
    const { error: pushErr } = await c.from('acne_records').upsert(
      toPush.map((r) => ({
        id: r.id,
        user_id: userId,
        data: r,
        updated_at: r.updatedAt,
      })),
    )
    if (pushErr) throw new Error(pushErr.message)
  }

  return { merged, pushed: toPush.length, pulled }
}

/** 在 Supabase SQL 编辑器中执行一次即可 */
export const SETUP_SQL = `create table if not exists acne_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id),
  data jsonb not null,
  updated_at timestamptz not null
);
alter table acne_records enable row level security;
create policy "own rows" on acne_records
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`
