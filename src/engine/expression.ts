import type { PetEmotion } from '@/types'

/** 眼睛形态 */
export type EyeStyle = 'normal' | 'happy' | 'sad' | 'angry' | 'closed' | 'sparkle'

/** 嘴巴形态 */
export type MouthStyle = 'smile' | 'frown' | 'open' | 'line' | 'wavy'

/** 表情风格组合 */
export interface ExpressionStyle {
  eye: EyeStyle
  mouth: MouthStyle
  /** 是否绘制腮红（妆容层的独立腮红由化妆系统控制，此处为情绪性泛红） */
  blush: boolean
  /** 眉毛倾斜角度（弧度），正值表示外侧上扬 */
  browAngle: number
}

/**
 * 情绪 → 表情映射表
 *
 * 迁移自早期 CSS 原型并做了增强：新增 sparkle 眼（愉悦时的高光眼）
 * 与 wavy 嘴（撒娇时的波浪嘴），强化情绪辨识度。
 */
export const EXPRESSION_MAP: Readonly<Record<PetEmotion, ExpressionStyle>> = {
  neutral: { eye: 'normal', mouth: 'line', blush: false, browAngle: 0 },
  happy: { eye: 'happy', mouth: 'smile', blush: true, browAngle: 0 },
  sweet: { eye: 'sparkle', mouth: 'wavy', blush: true, browAngle: -0.12 },
  sad: { eye: 'sad', mouth: 'frown', blush: false, browAngle: 0.3 },
  angry: { eye: 'angry', mouth: 'line', blush: false, browAngle: -0.35 },
  sleepy: { eye: 'closed', mouth: 'line', blush: false, browAngle: 0 },
  hungry: { eye: 'sad', mouth: 'open', blush: false, browAngle: 0.22 },
}

/** 线条颜色：深灰而非纯黑，避免叠加在照片上显得生硬 */
const INK = 'rgba(30, 41, 59, 0.85)'

/**
 * 绘制眼睛
 * @param size 眼睛基准尺寸（像素），通常由脸部包围盒推导
 * @param openFactor 睁眼程度 0（全闭）→ 1（全睁），用于程序化眨眼
 * @param look 眼神朝向，归一化 {-1..1}，用于瞳孔/高光跟随光标
 */
export function drawEyes(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number },
  right: { x: number; y: number },
  style: EyeStyle,
  size: number,
  openFactor = 1,
  look: { x: number; y: number } = { x: 0, y: 0 },
): void {
  const r = size / 2
  // 眨眼幅度限制：睡眠/闭眼态由 style 决定，此处不再额外压扁
  const open = style === 'closed' ? 1 : Math.max(0.08, openFactor)
  const lx = look.x * size * 0.28
  const ly = look.y * size * 0.22
  ctx.save()
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = Math.max(1.5, size * 0.12)
  ctx.lineCap = 'round'

  const drawEye = (cx: number, cy: number, mirror = 1) => {
    // 以眼心为原点做纵向缩放实现眨眼（闭眼时压扁为一条线）
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, open)
    ctx.translate(-cx, -cy)
    switch (style) {
      case 'happy': {
        // 弯月眼：向上凸起的弧线
        ctx.beginPath()
        ctx.arc(cx, cy + r * 0.4, r, Math.PI, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'sad': {
        // 下垂眼：半圆 + 上眼睑下压
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.9, cy - r * 0.25)
        ctx.lineTo(cx + r * 0.6 * mirror, cy - r * 0.75 * mirror)
        ctx.stroke()
        break
      }
      case 'angry': {
        // 三角眼：锐利的折角
        ctx.beginPath()
        ctx.moveTo(cx - r, cy + r * 0.5)
        ctx.lineTo(cx + r * 0.8 * mirror, cy - r * 0.6)
        ctx.lineTo(cx + r, cy + r * 0.6)
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'closed': {
        // 闭眼：向下弯的弧
        ctx.beginPath()
        ctx.arc(cx, cy - r * 0.3, r * 0.9, 0, Math.PI)
        ctx.stroke()
        break
      }
      case 'sparkle': {
        // 高光眼：实心椭圆 + 白色高光点（随眼神偏移）+ 小星星
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * 0.85, r, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.beginPath()
        ctx.arc(cx + r * 0.3 + lx, cy - r * 0.35 + ly, r * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = INK
        break
      }
      default: {
        // 常态眼：实心圆 + 高光（随眼神偏移，形成「看向你」的观感）
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(cx + r * 0.28 + lx, cy - r * 0.3 + ly, r * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = INK
      }
    }
    ctx.restore()
  }

  drawEye(left.x, left.y, 1)
  drawEye(right.x, right.y, -1)
  ctx.restore()
}

/** 绘制眉毛（仅 sad / angry 时明显） */
export function drawBrows(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number },
  right: { x: number; y: number },
  angle: number,
  size: number,
): void {
  if (Math.abs(angle) < 0.05) return
  const len = size * 1.1
  const offsetY = size * 0.85
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(1.5, size * 0.12)
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(left.x - len / 2, left.y - offsetY - Math.sin(angle) * len * 0.3)
  ctx.lineTo(left.x + len / 2, left.y - offsetY + Math.sin(angle) * len * 0.3)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(right.x - len / 2, right.y - offsetY + Math.sin(angle) * len * 0.3)
  ctx.lineTo(right.x + len / 2, right.y - offsetY - Math.sin(angle) * len * 0.3)
  ctx.stroke()
  ctx.restore()
}

/** 绘制嘴巴 */
export function drawMouth(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  style: MouthStyle,
  size: number,
): void {
  const w = size
  ctx.save()
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = Math.max(1.5, size * 0.14)
  ctx.lineCap = 'round'

  switch (style) {
    case 'smile': {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y - w * 0.25, w * 0.5, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
      break
    }
    case 'frown': {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y + w * 0.45, w * 0.5, 1.15 * Math.PI, 1.85 * Math.PI)
      ctx.stroke()
      break
    }
    case 'open': {
      // 张嘴：填充的椭圆（讨食/哈欠）
      ctx.beginPath()
      ctx.ellipse(pos.x, pos.y + w * 0.15, w * 0.36, w * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'wavy': {
      // 波浪嘴：撒娇时的抖动感
      ctx.beginPath()
      ctx.moveTo(pos.x - w * 0.45, pos.y)
      ctx.quadraticCurveTo(pos.x - w * 0.22, pos.y - w * 0.22, pos.x, pos.y)
      ctx.quadraticCurveTo(pos.x + w * 0.22, pos.y + w * 0.22, pos.x + w * 0.45, pos.y)
      ctx.stroke()
      break
    }
    default: {
      // 一字嘴
      ctx.beginPath()
      ctx.moveTo(pos.x - w * 0.3, pos.y)
      ctx.lineTo(pos.x + w * 0.3, pos.y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** 情绪性腮红（区别于化妆系统的妆容腮红，此处为情绪驱动的泛红） */
export function drawEmotionBlush(
  ctx: CanvasRenderingContext2D,
  leftEye: { x: number; y: number },
  rightEye: { x: number; y: number },
  size: number,
): void {
  const rx = size * 0.55
  const ry = size * 0.34
  const offsetY = size * 1.35
  ctx.save()
  ctx.fillStyle = 'rgba(244, 114, 182, 0.35)'
  ctx.filter = 'blur(2px)'
  ctx.beginPath()
  ctx.ellipse(leftEye.x - size * 0.25, leftEye.y + offsetY, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(rightEye.x + size * 0.25, rightEye.y + offsetY, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
