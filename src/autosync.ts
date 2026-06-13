import { useStore } from './store'
import { getClient, syncRecords } from './sync'
import type { AcneRecord } from './types'

/**
 * 自动同步：
 *  - App 启动 / 重新可见时，若已登录则拉取并合并云端数据
 *  - 本地记录变更后，防抖 2 秒在后台双向同步（上传新改动）
 * 全部静默执行，失败不打扰用户（手动「立即同步」仍可看到结果）。
 */

let running = false
let queued = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function isLoggedIn(): Promise<boolean> {
  const c = getClient()
  if (!c) return false
  const { data } = await c.auth.getUser()
  return !!data.user
}

/** 执行一次同步；并发时排队，结束后如有新变更再补一次 */
async function runSync() {
  if (running) {
    queued = true
    return
  }
  running = true
  try {
    if (!(await isLoggedIn())) return
    const local = useStore.getState().records
    const result = await syncRecords(local)
    // 仅当云端带来变化时才写回，避免无谓的状态更新
    if (result.pulled > 0 || result.merged.length !== local.length) {
      useStore.getState().replaceAll(result.merged)
    }
  } catch {
    /* 静默：网络/未登录等，下次触发再试 */
  } finally {
    running = false
    if (queued) {
      queued = false
      void runSync()
    }
  }
}

/** 启动自动同步：登录后立即拉取，并监听记录变更与页面可见性 */
export function startAutoSync() {
  // 初次：稍等客户端就绪后拉取一次
  void runSync()

  // 记录数组引用变化时（新增/编辑/删除/导入）防抖后台同步
  let prevRecords: AcneRecord[] = useStore.getState().records
  useStore.subscribe((state) => {
    if (state.records === prevRecords) return
    prevRecords = state.records
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void runSync(), 2000)
  })

  // 回到前台时拉取最新（多设备场景下及时看到对方改动）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runSync()
  })

  // 登录/登出后触发一次
  const client = getClient()
  client?.auth.onAuthStateChange(() => void runSync())
}

/** 供登录成功后立即调用 */
export function triggerSync() {
  void runSync()
}
