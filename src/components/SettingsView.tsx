import { useEffect, useRef, useState } from 'react'
import { useStore, liveRecords, mergeRecords } from '../store'
import {
  getSyncConfig,
  saveSyncConfig,
  hasBuiltinConfig,
  getUserEmail,
  signIn,
  signUp,
  signOut,
  syncRecords,
  SETUP_SQL,
} from '../sync'
import { triggerSync } from '../autosync'
import type { AcneRecord } from '../types'

export default function SettingsView() {
  const records = useStore((s) => s.records)
  const replaceAll = useStore((s) => s.replaceAll)

  const builtin = hasBuiltinConfig()
  const saved = getSyncConfig()
  const [url, setUrl] = useState(saved?.url ?? '')
  const [anonKey, setAnonKey] = useState(saved?.anonKey ?? '')
  const [configured, setConfigured] = useState(saved !== null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (configured) getUserEmail().then(setUserEmail)
  }, [configured])

  const saveConfig = () => {
    if (!url.trim() || !anonKey.trim()) {
      setMsg('请填写 Supabase URL 和 anon key')
      return
    }
    saveSyncConfig({ url: url.trim(), anonKey: anonKey.trim() })
    setConfigured(true)
    setMsg('配置已保存，请登录')
  }

  const clearConfig = () => {
    saveSyncConfig(null)
    setConfigured(false)
    setUserEmail(null)
    setMsg('已清除云同步配置（本地数据保留）')
  }

  const doAuth = async (mode: 'in' | 'up') => {
    setBusy(true)
    const err = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (err) {
      setMsg(`失败：${err}`)
    } else if (mode === 'up') {
      setMsg('注册成功。若 Supabase 开启了邮箱验证，请先到邮箱确认再登录。')
    } else {
      setUserEmail(await getUserEmail())
      setMsg('登录成功，正在自动同步…')
      triggerSync()
    }
  }

  const doSync = async () => {
    setBusy(true)
    try {
      const result = await syncRecords(records)
      replaceAll(result.merged)
      setMsg(`同步完成：上传 ${result.pushed} 条，下载 ${result.pulled} 条`)
    } catch (e) {
      setMsg(`同步失败：${e instanceof Error ? e.message : String(e)}`)
    }
    setBusy(false)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `doudou-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result)) as AcneRecord[]
        if (!Array.isArray(incoming)) throw new Error('格式不正确')
        const beforeLive = liveRecords(records).length
        const merged = mergeRecords(records, incoming)
        replaceAll(merged)
        const afterLive = liveRecords(merged).length
        setMsg(`导入完成：原有 ${beforeLive} 条，合并后共 ${afterLive} 条（新增 ${afterLive - beforeLive} 条）`)
      } catch (e) {
        setMsg(`导入失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page">
      <h2>设置</h2>

      <h3>云同步（Supabase）</h3>
      {!configured && !builtin && (
        <>
          <p className="muted">
            在 supabase.com 免费创建项目后，把项目的 URL 和 anon key 填到这里，
            并在 SQL 编辑器里执行下方的建表语句（仅需一次）。
          </p>
          <div className="form-row">
            <label>URL</label>
            <input
              type="url"
              placeholder="https://xxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>anon key</label>
            <input
              type="text"
              placeholder="eyJhbGciOi..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
            />
          </div>
          <button className="primary-btn" onClick={saveConfig}>保存配置</button>
          <details className="sql-details">
            <summary>建表 SQL（在 Supabase SQL 编辑器执行一次）</summary>
            <pre>{SETUP_SQL}</pre>
          </details>
        </>
      )}

      {builtin && !userEmail && (
        <p className="muted">本应用已内置云同步配置，直接用邮箱和密码登录即可。</p>
      )}

      {configured && !userEmail && (
        <>
          <div className="form-row">
            <label>邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="primary-btn" disabled={busy} onClick={() => doAuth('in')}>登录</button>
            <button className="ghost-btn" disabled={busy} onClick={() => doAuth('up')}>注册</button>
            {!builtin && <button className="ghost-btn" onClick={clearConfig}>清除配置</button>}
          </div>
        </>
      )}

      {configured && userEmail && (
        <>
          <p>已登录：{userEmail}</p>
          <div className="btn-row">
            <button className="primary-btn" disabled={busy} onClick={doSync}>
              {busy ? '同步中…' : '立即同步'}
            </button>
            <button
              className="ghost-btn"
              onClick={async () => {
                await signOut()
                setUserEmail(null)
              }}
            >
              退出登录
            </button>
          </div>
        </>
      )}

      {msg && <p className="msg">{msg}</p>}

      <h3>数据备份</h3>
      <p className="muted">当前共 {liveRecords(records).length} 条记录（本地始终保留一份）</p>
      <div className="btn-row">
        <button className="ghost-btn" onClick={exportJson}>导出 JSON</button>
        <button className="ghost-btn" onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJson(f)
            e.target.value = ''
          }}
        />
      </div>

      <h3>关于</h3>
      <p className="muted">
        痘痘记录 v0.1 · 数据仅存于本设备与你自己的 Supabase 项目中，不经过任何第三方。
        看医生时打开「身体」页，旋转模型即可展示分布；「统计」页可按年月和区域回顾历史。
      </p>
    </div>
  )
}
