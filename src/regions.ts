import type { BodyPart } from './types'

/** 统计维度使用的区域列表（展示顺序） */
export const REGIONS = [
  '面部',
  '头部',
  '颈前',
  '颈后',
  '肩部',
  '胸部',
  '腹部',
  '下腹',
  '后背上部',
  '后背下部',
  '臀部',
  '左臂',
  '右臂',
  '左腿',
  '右腿',
] as const

/**
 * 根据部位（来自模型顶点色烘焙的 UV 岛分类）+ 归一化身高位置 + 前后侧判定区域。
 * @param yn 点击点高度 / 模型总身高（0=脚底 1=头顶）
 * @param front 是否身体前侧（模型面向 +z）
 */
export function detectRegion(part: BodyPart, yn: number, front: boolean): string {
  switch (part) {
    case 'head':
      // 头部 UV 岛包含颈部，按下巴高度分界
      if (yn < 0.865) return front ? '颈前' : '颈后'
      return front ? '面部' : '头部'
    case 'torso':
      if (yn > 0.83) return '肩部'
      if (front) return yn > 0.72 ? '胸部' : '腹部'
      return yn > 0.72 ? '后背上部' : '后背下部'
    case 'hips':
      return front ? '下腹' : '臀部'
    case 'armL':
      return '左臂'
    case 'armR':
      return '右臂'
    case 'legL':
      return '左腿'
    case 'legR':
      return '右腿'
  }
}
