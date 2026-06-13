import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { BodyPart, ModelKey, PendingPoint } from '../types'
import { detectRegion } from '../regions'

/** 顶点色 R 通道编码 id/7，与 scripts/export_bodies.py 中的 PART_IDS 对应 */
const PART_BY_ID: (BodyPart | null)[] = [null, 'head', 'torso', 'hips', 'armL', 'armR', 'legL', 'legR']

const skinMaterial = new THREE.MeshStandardMaterial({
  color: '#d8bda6',
  roughness: 0.62,
  metalness: 0.02,
})
const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#e6e6e6', roughness: 0.3 })

interface Props {
  modelKey: ModelKey
  pickEnabled: boolean
  onPick: (p: PendingPoint) => void
}

export default function BodyModel({ modelKey, pickEnabled, onPick }: Props) {
  const { scene } = useGLTF(`/models/body_${modelKey}.glb`)

  const { minY, height } = useMemo(() => {
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = /eye/i.test(o.name) ? eyeMaterial : skinMaterial
      }
    })
    const box = new THREE.Box3().setFromObject(scene)
    return { minY: box.min.y, height: box.max.y - box.min.y }
  }, [scene])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!pickEnabled) return
    // 拖拽旋转结束时也会触发 click，用位移阈值区分点按与拖拽
    if (e.delta > 6) return
    const mesh = e.object as THREE.Mesh
    const colorAttr = mesh.geometry?.getAttribute('color')
    if (!colorAttr || !e.face) return
    let r = colorAttr.getX(e.face.a)
    if (r > 1.001) r /= 255 // 兼容未反归一化的字节属性
    const part = PART_BY_ID[Math.round(r * 7)]
    if (!part) return
    const yn = (e.point.y - minY) / height
    const normal = e.face.normal.clone().transformDirection(e.object.matrixWorld)
    onPick({
      part,
      region: detectRegion(part, yn, e.point.z > 0),
      pos: [e.point.x, e.point.y, e.point.z],
      normal: [normal.x, normal.y, normal.z],
    })
  }

  return <primitive object={scene} onClick={handleClick} />
}

useGLTF.preload('/models/body_female.glb')
useGLTF.preload('/models/body_male.glb')
