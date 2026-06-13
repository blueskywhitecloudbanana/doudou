import { create } from 'zustand'
import {
  DEFAULT_SIZE_MM,
  DEFAULT_TENDERNESS,
  type AcneRecord,
  type ModelKey,
  type PendingPoint,
  type RecordKind,
  type Tenderness,
} from './types'

const STORAGE_KEY = 'doudou-records'
const MODEL_KEY = 'doudou-model'

function loadRecords(): AcneRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AcneRecord[]) : []
  } catch {
    return []
  }
}

function persist(records: AcneRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export type View = 'body' | 'stats' | 'settings'
export type YearFilter = number | 'all'
export type MonthFilter = number | 'all'

interface AppState {
  records: AcneRecord[]
  view: View
  modelKey: ModelKey
  addMode: boolean
  filterYear: YearFilter
  filterMonth: MonthFilter
  pending: PendingPoint | null
  /** 新建标记时的实时表单值，用于 3D 预览，并记住上次的选择 */
  pendingSize: number
  pendingKind: RecordKind
  pendingTenderness: Tenderness
  selectedId: string | null

  setView: (v: View) => void
  setPendingSize: (mm: number) => void
  setPendingKind: (k: RecordKind) => void
  setPendingTenderness: (t: Tenderness) => void
  setModelKey: (m: ModelKey) => void
  setAddMode: (on: boolean) => void
  setFilter: (year: YearFilter, month: MonthFilter) => void
  setPending: (p: PendingPoint | null) => void
  setSelected: (id: string | null) => void
  addRecord: (data: Omit<AcneRecord, 'id' | 'updatedAt' | 'deleted'>) => void
  updateRecord: (id: string, patch: Partial<AcneRecord>) => void
  removeRecord: (id: string) => void
  /** 同步 / 导入后整体替换（含墓碑） */
  replaceAll: (records: AcneRecord[]) => void
}

export const useStore = create<AppState>((set) => ({
  records: loadRecords(),
  view: 'body',
  modelKey: (localStorage.getItem(MODEL_KEY) as ModelKey) || 'female',
  addMode: false,
  filterYear: 'all',
  filterMonth: 'all',
  pending: null,
  pendingSize: DEFAULT_SIZE_MM,
  pendingKind: 'acne',
  pendingTenderness: DEFAULT_TENDERNESS,
  selectedId: null,

  setView: (view) => set({ view, pending: null, selectedId: null }),
  setPendingSize: (pendingSize) => set({ pendingSize }),
  setPendingKind: (pendingKind) => set({ pendingKind }),
  setPendingTenderness: (pendingTenderness) => set({ pendingTenderness }),
  setModelKey: (modelKey) => {
    localStorage.setItem(MODEL_KEY, modelKey)
    set({ modelKey, pending: null, selectedId: null })
  },
  setAddMode: (addMode) => set({ addMode, pending: null, selectedId: null }),
  setFilter: (filterYear, filterMonth) => set({ filterYear, filterMonth }),
  setPending: (pending) => set({ pending, selectedId: null }),
  setSelected: (selectedId) => set({ selectedId, pending: null }),

  addRecord: (data) =>
    set((s) => {
      const rec: AcneRecord = {
        ...data,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        deleted: false,
      }
      const records = [...s.records, rec]
      persist(records)
      return { records, pending: null, addMode: false }
    }),

  updateRecord: (id, patch) =>
    set((s) => {
      const records = s.records.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
      )
      persist(records)
      return { records }
    }),

  removeRecord: (id) =>
    set((s) => {
      const records = s.records.map((r) =>
        r.id === id ? { ...r, deleted: true, updatedAt: new Date().toISOString() } : r,
      )
      persist(records)
      return { records, selectedId: null }
    }),

  replaceAll: (records) => {
    persist(records)
    set({ records })
  },
}))

/** 未删除的记录 */
export function liveRecords(records: AcneRecord[]): AcneRecord[] {
  return records.filter((r) => !r.deleted)
}

/** 按年/月筛选（以长痘开始日期计） */
export function inFilter(rec: AcneRecord, year: YearFilter, month: MonthFilter): boolean {
  if (year !== 'all' && Number(rec.startDate.slice(0, 4)) !== year) return false
  if (month !== 'all' && Number(rec.startDate.slice(5, 7)) !== month) return false
  return true
}

/** 数据中出现过的年份（降序），至少包含今年 */
export function yearsOf(records: AcneRecord[]): number[] {
  const set = new Set<number>([new Date().getFullYear()])
  for (const r of liveRecords(records)) set.add(Number(r.startDate.slice(0, 4)))
  return [...set].sort((a, b) => b - a)
}

export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 两个 YYYY-MM-DD 间隔天数 */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

/** 合并两份记录集（按 id，取 updatedAt 较新者），用于同步与导入 */
export function mergeRecords(a: AcneRecord[], b: AcneRecord[]): AcneRecord[] {
  const map = new Map<string, AcneRecord>()
  for (const r of a) map.set(r.id, r)
  for (const r of b) {
    const cur = map.get(r.id)
    if (!cur || r.updatedAt > cur.updatedAt) map.set(r.id, r)
  }
  return [...map.values()]
}
