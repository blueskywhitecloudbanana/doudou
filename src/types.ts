export type Severity = 1 | 2 | 3 | 4 | 5

/** 0=无痛 1=轻按痛 2=明显痛 3=剧痛 */
export type Tenderness = 0 | 1 | 2 | 3

/** 记录类型：痘痘 / 压痛点（皮下硬结，表面轻微但按压痛） */
export type RecordKind = 'acne' | 'tender'

/** 身体部位，由模型顶点色（UV 岛分类）解码得到 */
export type BodyPart = 'head' | 'torso' | 'hips' | 'armL' | 'armR' | 'legL' | 'legR'

/** 人体模型体型 */
export type ModelKey = 'male' | 'female'

export interface AcneRecord {
  id: string
  /** 长痘日期 YYYY-MM-DD */
  startDate: string
  /** 消退日期 YYYY-MM-DD，进行中为 null */
  endDate: string | null
  /** 记录类型，缺省视为痘痘（兼容旧数据） */
  kind?: RecordKind
  severity: Severity
  /** 压痛点的按压痛感（0–3）；痘痘类型可不填 */
  tenderness?: Tenderness
  /** 痘痘直径 / 压痛点可触及范围，毫米（模型为真人比例，按真实尺寸渲染） */
  size?: number
  note: string
  /** 命中的身体部件 */
  part: BodyPart
  /** 自动判定（可手动修改）的区域名，用于统计 */
  region: string
  /** 记录时使用的模型体型（标记点坐标基于该模型表面） */
  model?: ModelKey
  /** 模型空间坐标 */
  pos: [number, number, number]
  /** 表面法线，用于标记点微微浮出皮肤 */
  normal: [number, number, number]
  /** 同步用：最后修改时间 ISO */
  updatedAt: string
  /** 同步用：软删除墓碑 */
  deleted: boolean
}

export interface PendingPoint {
  part: BodyPart
  region: string
  pos: [number, number, number]
  normal: [number, number, number]
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  1: '轻微',
  2: '较轻',
  3: '中等',
  4: '较重',
  5: '严重',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  1: '#ffd54f',
  2: '#ffb74d',
  3: '#ff8a65',
  4: '#f4511e',
  5: '#d32f2f',
}

export const HEALED_COLOR = '#6f8aa8'

export const TENDERNESS_LABELS: Record<Tenderness, string> = {
  0: '无痛',
  1: '轻按痛',
  2: '明显痛',
  3: '剧痛',
}

/** 压痛点（皮下）按痛感分级的紫色系 */
export const TENDER_COLORS: Record<Tenderness, string> = {
  0: '#b39ddb',
  1: '#9575cd',
  2: '#7e57c2',
  3: '#5e35b1',
}

export const DEFAULT_TENDERNESS: Tenderness = 2

/** 取记录在 3D / 图例中的显示颜色 */
export function recordColor(rec: Pick<AcneRecord, 'kind' | 'severity' | 'tenderness' | 'endDate'>): string {
  if (rec.endDate) return HEALED_COLOR
  if (rec.kind === 'tender') return TENDER_COLORS[rec.tenderness ?? DEFAULT_TENDERNESS]
  return SEVERITY_COLORS[rec.severity]
}

export const DEFAULT_SIZE_MM = 6
export const MIN_SIZE_MM = 2
export const MAX_SIZE_MM = 30

/** 毫米直径 → 模型空间半径（模型 1:1 真人比例，1 单位 = 1 米） */
export function sizeToRadius(sizeMm: number | undefined): number {
  return ((sizeMm ?? DEFAULT_SIZE_MM) / 1000) / 2
}
