import { useState } from 'react'
import { useStore, liveRecords, yearsOf, daysBetween } from '../store'
import { REGIONS } from '../regions'
import {
  SEVERITY_LABELS,
  TENDERNESS_LABELS,
  DEFAULT_TENDERNESS,
  recordColor,
  type AcneRecord,
} from '../types'

/** 历史条目的标签：痘痘显示严重程度，压痛点显示痛感 */
function recordLabel(r: AcneRecord): string {
  if (r.kind === 'tender') return `压痛点 · ${TENDERNESS_LABELS[r.tenderness ?? DEFAULT_TENDERNESS]}`
  return SEVERITY_LABELS[r.severity]
}

type YearScope = number | 'all'

function monthlyCounts(records: AcneRecord[], year: YearScope): number[] {
  const counts = Array(12).fill(0) as number[]
  for (const r of records) {
    if (year !== 'all' && Number(r.startDate.slice(0, 4)) !== year) continue
    counts[Number(r.startDate.slice(5, 7)) - 1]++
  }
  return counts
}

function regionCounts(records: AcneRecord[]): { region: string; count: number }[] {
  const map = new Map<string, number>()
  for (const r of records) map.set(r.region, (map.get(r.region) ?? 0) + 1)
  return REGIONS.filter((r) => map.has(r))
    .map((region) => ({ region, count: map.get(region)! }))
    .sort((a, b) => b.count - a.count)
}

export default function StatsView() {
  const records = liveRecords(useStore((s) => s.records))
  const years = yearsOf(useStore((s) => s.records))
  const [year, setYear] = useState<YearScope>(new Date().getFullYear())
  const [region, setRegion] = useState<string | null>(null)

  const scoped = records.filter(
    (r) => year === 'all' || Number(r.startDate.slice(0, 4)) === year,
  )
  const months = monthlyCounts(records, year)
  const maxMonth = Math.max(1, ...months)
  const regions = regionCounts(scoped)
  const maxRegion = Math.max(1, ...regions.map((r) => r.count))
  const active = scoped.filter((r) => !r.endDate)

  // 选中区域的历史（不受年份限制，便于看长期规律）
  const history = region
    ? records
        .filter((r) => r.region === region)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
    : []
  const intervals: number[] = []
  if (history.length >= 2) {
    const asc = [...history].reverse()
    for (let i = 1; i < asc.length; i++) {
      intervals.push(daysBetween(asc[i - 1].startDate, asc[i].startDate))
    }
  }
  const avgInterval = intervals.length
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : null

  return (
    <div className="page">
      <h2>统计</h2>

      <div className="form-row">
        <label>统计范围</label>
        <select
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      <div className="cards">
        <div className="card"><b>{scoped.length}</b><span>记录总数</span></div>
        <div className="card"><b>{active.length}</b><span>进行中</span></div>
        <div className="card"><b>{regions[0]?.region ?? '—'}</b><span>高发区域</span></div>
      </div>

      <h3>{year === 'all' ? '历年' : `${year}年`}每月新增</h3>
      <div className="bar-chart">
        {months.map((c, i) => (
          <div key={i} className="bar-col">
            <span className="bar-val">{c > 0 ? c : ''}</span>
            <div className="bar" style={{ height: `${(c / maxMonth) * 100}%` }} />
            <span className="bar-label">{i + 1}</span>
          </div>
        ))}
      </div>

      <h3>区域分布 <small>（点击区域查看历史）</small></h3>
      {regions.length === 0 && <p className="muted">该范围内暂无记录</p>}
      <div className="region-bars">
        {regions.map((r) => (
          <button
            key={r.region}
            className={region === r.region ? 'region-row active' : 'region-row'}
            onClick={() => setRegion(region === r.region ? null : r.region)}
          >
            <span className="region-name">{r.region}</span>
            <span className="region-bar" style={{ width: `${(r.count / maxRegion) * 100}%` }} />
            <span className="region-count">{r.count}</span>
          </button>
        ))}
      </div>

      {region && (
        <div className="history">
          <h3>「{region}」历史记录（全部年份，共 {history.length} 次）</h3>
          {avgInterval !== null && (
            <p className="muted">相邻两次平均间隔约 {avgInterval} 天</p>
          )}
          {history.map((r) => (
            <div key={r.id} className="history-item">
              <span
                className={r.kind === 'tender' ? 'dot ring' : 'dot'}
                style={r.kind === 'tender' ? { borderColor: recordColor(r) } : { background: recordColor(r) }}
              />
              <div className="history-main">
                <div>
                  {r.startDate}
                  {r.endDate
                    ? ` ~ ${r.endDate}（${daysBetween(r.startDate, r.endDate)} 天）`
                    : '（进行中）'}
                </div>
                <div className="muted">
                  {recordLabel(r)}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
