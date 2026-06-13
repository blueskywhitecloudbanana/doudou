import { Suspense, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore, liveRecords, inFilter, yearsOf } from '../store'
import {
  SEVERITY_COLORS,
  HEALED_COLOR,
  TENDER_COLORS,
  DEFAULT_TENDERNESS,
  recordColor,
  sizeToRadius,
  type AcneRecord,
} from '../types'
import BodyModel from './BodyModel'
import RecordSheet from './RecordSheet'

/** 计算标记沿表面法线抬起后的位置 */
function lifted(
  pos: [number, number, number],
  normal: [number, number, number],
  d: number,
): [number, number, number] {
  return [pos[0] + normal[0] * d, pos[1] + normal[1] * d, pos[2] + normal[2] * d]
}

/** 使标记的 +Y 轴对齐到表面法线的四元数（压痛环平贴皮肤用） */
function useAlignToNormal(normal: [number, number, number]) {
  return useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...normal).normalize())
    return q
  }, [normal[0], normal[1], normal[2]])
}

/** 压痛点：平贴皮肤的空心环（甜甜圈），表示表面无明显凸起但深层有硬结 */
function TenderRing({
  pos,
  normal,
  radius,
  color,
  emissive,
}: {
  pos: [number, number, number]
  normal: [number, number, number]
  radius: number
  color: string
  emissive: number
}) {
  const quat = useAlignToNormal(normal)
  return (
    <mesh position={lifted(pos, normal, radius * 0.25)} quaternion={quat}>
      <torusGeometry args={[radius, radius * 0.32, 10, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.4} />
    </mesh>
  )
}

/** 新建标记的实时预览，类型/大小/痛感跟随表单 */
function PendingMarker() {
  const pending = useStore((s) => s.pending)
  const pendingSize = useStore((s) => s.pendingSize)
  const pendingKind = useStore((s) => s.pendingKind)
  if (!pending) return null
  const radius = sizeToRadius(pendingSize)
  // 新建预览统一用绿色，便于和已有标记区分
  if (pendingKind === 'tender') {
    return (
      <TenderRing pos={pending.pos} normal={pending.normal} radius={radius} color="#4caf50" emissive={1.4} />
    )
  }
  return (
    <mesh position={lifted(pending.pos, pending.normal, radius * 0.6)}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial color="#4caf50" emissive="#4caf50" emissiveIntensity={1.4} />
    </mesh>
  )
}

/** 快捷视角：[目标点, 相机位置] */
const VIEW_PRESETS: Record<string, { label: string; target: [number, number, number]; cam: [number, number, number] }> = {
  full: { label: '全身', target: [0, 0.95, 0], cam: [0, 1.25, 2.4] },
  upper: { label: '上身', target: [0, 1.3, 0], cam: [0, 1.35, 1.15] },
  head: { label: '头部', target: [0, 1.52, 0], cam: [0, 1.56, 0.55] },
}

function Marker({ rec, selected, onSelect }: { rec: AcneRecord; selected: boolean; onSelect: () => void }) {
  const baseRadius = sizeToRadius(rec.size)
  const radius = selected ? baseRadius * 1.5 : baseRadius
  const color = recordColor(rec)
  const emissive = selected ? 1.2 : 0.55
  const onClick = (e: { stopPropagation: () => void; delta: number }) => {
    e.stopPropagation()
    if (e.delta > 6) return
    onSelect()
  }
  const quat = useAlignToNormal(rec.normal)

  if (rec.kind === 'tender') {
    // 压痛点用空心环；选中时叠加一个半透明实心盘，便于点击
    return (
      <group onClick={onClick}>
        <mesh position={lifted(rec.pos, rec.normal, radius * 0.25)} quaternion={quat}>
          <torusGeometry args={[radius, radius * 0.32, 10, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.4} />
        </mesh>
        <mesh position={lifted(rec.pos, rec.normal, radius * 0.1)} quaternion={quat}>
          <circleGeometry args={[radius, 24]} />
          <meshBasicMaterial color={color} transparent opacity={selected ? 0.28 : 0.12} side={THREE.DoubleSide} />
        </mesh>
      </group>
    )
  }

  return (
    <mesh position={lifted(rec.pos, rec.normal, radius * 0.6)} onClick={onClick}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.4} />
    </mesh>
  )
}

export default function BodyView() {
  const records = useStore((s) => s.records)
  const modelKey = useStore((s) => s.modelKey)
  const setModelKey = useStore((s) => s.setModelKey)
  const addMode = useStore((s) => s.addMode)
  const setAddMode = useStore((s) => s.setAddMode)
  const filterYear = useStore((s) => s.filterYear)
  const filterMonth = useStore((s) => s.filterMonth)
  const setFilter = useStore((s) => s.setFilter)
  const pending = useStore((s) => s.pending)
  const setPending = useStore((s) => s.setPending)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const goToView = (key: keyof typeof VIEW_PRESETS) => {
    const c = controlsRef.current
    if (!c) return
    const { target, cam } = VIEW_PRESETS[key]
    c.target.set(...target)
    c.object.position.set(...cam)
    c.update()
  }

  const visible = liveRecords(records).filter((r) => inFilter(r, filterYear, filterMonth))
  const years = yearsOf(records)
  const activeCount = visible.filter((r) => !r.endDate).length

  return (
    <div className="body-view">
      <Canvas camera={{ position: [0, 1.25, 2.4], fov: 45 }}>
        <color attach="background" args={['#16161f']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <directionalLight position={[-2, 2, -3]} intensity={0.45} />
        <Suspense fallback={null}>
          <BodyModel modelKey={modelKey} pickEnabled={addMode} onPick={setPending} />
        </Suspense>
        {/* 地面阴影圆盘 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <circleGeometry args={[0.55, 48]} />
          <meshBasicMaterial color="#0d0d14" transparent opacity={0.6} />
        </mesh>
        {visible.map((r) => (
          <Marker key={r.id} rec={r} selected={r.id === selectedId} onSelect={() => setSelected(r.id)} />
        ))}
        {pending && <PendingMarker />}
        <OrbitControls
          ref={controlsRef}
          target={[0, 0.95, 0]}
          enablePan
          zoomToCursor
          minDistance={0.2}
          maxDistance={5}
          maxPolarAngle={Math.PI * 0.95}
        />
      </Canvas>

      {/* 顶部筛选条 */}
      <div className="overlay-top">
        <select
          className="chip-select"
          value={String(filterYear)}
          onChange={(e) => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value), filterMonth)}
        >
          <option value="all">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          className="chip-select"
          value={String(filterMonth)}
          onChange={(e) => setFilter(filterYear, e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">全部月份</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
        <span className="count-badge">{visible.length} 条 · {activeCount} 进行中</span>
        <button
          className="chip-select model-toggle"
          title="切换体型"
          onClick={() => setModelKey(modelKey === 'female' ? 'male' : 'female')}
        >
          {modelKey === 'female' ? '体型 ♀' : '体型 ♂'}
        </button>
        <button
          className={addMode ? 'add-btn active' : 'add-btn'}
          onClick={() => setAddMode(!addMode)}
        >
          {addMode ? '✕ 取消' : '＋ 标记'}
        </button>
      </div>

      {addMode && !pending && <div className="hint">旋转到目标角度后，点击身体表面添加标记</div>}

      {/* 快捷视角 */}
      <div className="view-presets">
        {(Object.keys(VIEW_PRESETS) as (keyof typeof VIEW_PRESETS)[]).map((key) => (
          <button key={key} className="preset-btn" onClick={() => goToView(key)}>
            {VIEW_PRESETS[key].label}
          </button>
        ))}
      </div>

      {/* 图例 */}
      <div className="legend">
        <span><i style={{ background: SEVERITY_COLORS[1] }} /> 痘·轻</span>
        <span><i style={{ background: SEVERITY_COLORS[5] }} /> 痘·重</span>
        <span><i className="ring" style={{ borderColor: TENDER_COLORS[DEFAULT_TENDERNESS] }} /> 压痛点</span>
        <span><i style={{ background: HEALED_COLOR }} /> 已消退</span>
      </div>

      <RecordSheet />
    </div>
  )
}
