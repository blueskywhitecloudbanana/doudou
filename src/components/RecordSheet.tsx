import { useEffect, useState } from 'react'
import { useStore, today, daysBetween } from '../store'
import { REGIONS } from '../regions'
import {
  DEFAULT_SIZE_MM,
  DEFAULT_TENDERNESS,
  MAX_SIZE_MM,
  MIN_SIZE_MM,
  SEVERITY_LABELS,
  TENDERNESS_LABELS,
  type RecordKind,
  type Severity,
  type Tenderness,
} from '../types'

/**
 * 底部面板：新建标记（pending 存在时）或查看/编辑已选记录。
 */
export default function RecordSheet() {
  const pending = useStore((s) => s.pending)
  const setPending = useStore((s) => s.setPending)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const records = useStore((s) => s.records)
  const setPendingSize = useStore((s) => s.setPendingSize)
  const setPendingKind = useStore((s) => s.setPendingKind)
  const setPendingTenderness = useStore((s) => s.setPendingTenderness)
  const addRecord = useStore((s) => s.addRecord)
  const updateRecord = useStore((s) => s.updateRecord)
  const removeRecord = useStore((s) => s.removeRecord)

  const selected = selectedId ? records.find((r) => r.id === selectedId) ?? null : null
  const open = pending !== null || selected !== null

  const [kind, setKind] = useState<RecordKind>('acne')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [severity, setSeverity] = useState<Severity>(3)
  const [tenderness, setTenderness] = useState<Tenderness>(DEFAULT_TENDERNESS)
  const [size, setSize] = useState(DEFAULT_SIZE_MM)
  const [region, setRegion] = useState<string>('面部')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 打开面板时填充表单
  useEffect(() => {
    if (pending) {
      const st = useStore.getState()
      setKind(st.pendingKind) // 沿用上次选的类型/大小
      setStartDate(today())
      setEndDate('')
      setSeverity(3)
      setTenderness(st.pendingTenderness)
      setSize(st.pendingSize)
      setRegion(pending.region)
      setNote('')
    } else if (selected) {
      setKind(selected.kind ?? 'acne')
      setStartDate(selected.startDate)
      setEndDate(selected.endDate ?? '')
      setSeverity(selected.severity)
      setTenderness(selected.tenderness ?? DEFAULT_TENDERNESS)
      setSize(selected.size ?? DEFAULT_SIZE_MM)
      setRegion(selected.region)
      setNote(selected.note)
    }
    setConfirmDelete(false)
  }, [pending, selected])

  const isTender = kind === 'tender'

  const changeKind = (k: RecordKind) => {
    setKind(k)
    if (pending) setPendingKind(k) // 3D 预览换形状
  }

  if (!open) return null

  const close = () => {
    setPending(null)
    setSelected(null)
  }

  const save = () => {
    if (pending) {
      addRecord({
        kind,
        startDate,
        endDate: endDate || null,
        severity,
        tenderness: isTender ? tenderness : undefined,
        size,
        note,
        part: pending.part,
        region,
        model: 'male',
        pos: pending.pos,
        normal: pending.normal,
      })
    } else if (selected) {
      updateRecord(selected.id, {
        kind,
        startDate,
        endDate: endDate || null,
        severity,
        tenderness: isTender ? tenderness : undefined,
        size,
        note,
        region,
      })
      setSelected(null)
    }
  }

  const duration =
    selected && selected.endDate ? daysBetween(selected.startDate, selected.endDate) : null

  return (
    <div className="sheet">
      <div className="sheet-header">
        <strong>
          {pending ? '新增记录' : `${isTender ? '压痛点' : '痘痘'} · ${region}`}
        </strong>
        {selected && (
          <span className="sheet-sub">
            {selected.endDate ? `已消退 · 持续 ${duration} 天` : '进行中'}
          </span>
        )}
        <button className="icon-btn" onClick={close}>✕</button>
      </div>

      <div className="form-row">
        <label>类型</label>
        <div className="kind-row">
          <button
            className={!isTender ? 'kind-btn active' : 'kind-btn'}
            onClick={() => changeKind('acne')}
          >
            ● 痘痘
          </button>
          <button
            className={isTender ? 'kind-btn active tender' : 'kind-btn'}
            onClick={() => changeKind('tender')}
          >
            ○ 压痛点
          </button>
        </div>
      </div>

      {isTender && (
        <p className="kind-hint">表面无明显痘痘、但按压有痛感的皮下硬结/炎症点</p>
      )}

      <div className="form-row">
        <label>区域</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>{isTender ? '出现日期' : '长痘日期'}</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      <div className="form-row">
        <label>消退日期</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        {!endDate && !pending && (
          <button className="mini-btn" onClick={() => setEndDate(today())}>今天消退</button>
        )}
      </div>

      <div className="form-row">
        <label>{isTender ? '范围' : '大小'}</label>
        <input
          type="range"
          min={MIN_SIZE_MM}
          max={MAX_SIZE_MM}
          step={1}
          value={size}
          onChange={(e) => {
            const mm = Number(e.target.value)
            setSize(mm)
            if (pending) setPendingSize(mm) // 3D 预览实时跟随
          }}
        />
        <span className="size-label">{size} mm</span>
      </div>

      {isTender ? (
        <div className="form-row">
          <label>压痛</label>
          <div className="severity-row">
            {([0, 1, 2, 3] as Tenderness[]).map((t) => (
              <button
                key={t}
                className={tenderness === t ? 'sev-btn active tender' : 'sev-btn'}
                onClick={() => {
                  setTenderness(t)
                  if (pending) setPendingTenderness(t)
                }}
              >
                {t}
              </button>
            ))}
            <span className="sev-label">{TENDERNESS_LABELS[tenderness]}</span>
          </div>
        </div>
      ) : (
        <div className="form-row">
          <label>严重程度</label>
          <div className="severity-row">
            {([1, 2, 3, 4, 5] as Severity[]).map((s) => (
              <button
                key={s}
                className={severity === s ? 'sev-btn active' : 'sev-btn'}
                data-sev={s}
                onClick={() => setSeverity(s)}
              >
                {s}
              </button>
            ))}
            <span className="sev-label">{SEVERITY_LABELS[severity]}</span>
          </div>
        </div>
      )}

      <div className="form-row">
        <label>备注</label>
        <input
          type="text"
          placeholder={isTender ? '例如：黄豆大硬结、连续几天痛…' : '例如：红肿、有脓头、经期前…'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="sheet-actions">
        {selected &&
          (confirmDelete ? (
            <button className="danger-btn" onClick={() => removeRecord(selected.id)}>
              确认删除？
            </button>
          ) : (
            <button className="ghost-btn" onClick={() => setConfirmDelete(true)}>删除</button>
          ))}
        <button className="primary-btn" onClick={save}>保存</button>
      </div>
    </div>
  )
}
