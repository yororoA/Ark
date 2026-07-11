'use client'

import React, { useEffect, useRef } from 'react'

interface SphereCanvasProps {
  color?: string
  className?: string
  wrapperClassName?: string
  edges?: number
  edgeWidth?: number | string
  dotRadius?: number | string
  enableBlinking?: boolean // 新增：是否开启顶点闪烁
}

// 扩展顶点的类型定义
interface Point3D {
  x: number
  y: number
  z: number
  blinkPhase: number
  blinkSpeed: number
}

export default function SphereCanvas({
  color = '#60a5fa',
  className = '',
  wrapperClassName = '',
  edges = 16,
  edgeWidth = 2,
  dotRadius = 4,
  enableBlinking = true, // 默认开启闪烁
}: SphereCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 600
    const center = size / 2
    const sphereRadius = size * 0.35

    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let animationFrameId: number

    // 1. 生成 3D 几何数据，为每个点增加随机闪烁属性
    const circles: { points: Point3D[]; dashOffsetRatio: number; showDots: boolean }[] = []
    const dashStep = 1 / edges

    // 生成经线 (带顶点圆点)
    for (let i = 0; i < edges; i++) {
      const angleY = (i * 2 * Math.PI) / edges
      const points: Point3D[] = []
      for (let j = 0; j < edges; j++) {
        const alpha = (j * 2 * Math.PI) / edges
        const x = sphereRadius * Math.sin(alpha)
        const y = sphereRadius * Math.cos(alpha)
        points.push({
          x: x * Math.cos(angleY),
          y: y,
          z: -x * Math.sin(angleY),
          blinkPhase: Math.random() * Math.PI * 2,           // 随机初始相位 0 ~ 2π
          blinkSpeed: Math.random() * 0.0015 + 0.001,        // 随机闪烁频率
        })
      }
      circles.push({ points, dashOffsetRatio: i * dashStep, showDots: true })
    }

    // 生成纬线 (不带圆点，主要用于网格线)
    const latitudeCount = Math.floor(edges / 2) - 1
    const latStep = Math.PI / (latitudeCount + 1)
    const latOffset = edges % 4 !== 0 ? Math.PI / edges : 0
    const latDashBase = edges * dashStep

    for (let i = 1; i <= latitudeCount; i++) {
      const phi = i * latStep
      const y = -sphereRadius * Math.cos(phi)
      const r = sphereRadius * Math.sin(phi)
      const points: Point3D[] = []
      for (let j = 0; j < edges; j++) {
        const alpha = (j * 2 * Math.PI) / edges + latOffset
        points.push({
          x: r * Math.sin(alpha),
          y: y,
          z: r * Math.cos(alpha),
          blinkPhase: 0, 
          blinkSpeed: 0,
        })
      }
      circles.push({ points, dashOffsetRatio: latDashBase + i * dashStep, showDots: false })
    }

    // 2. 动画渲染循环
    const render = (time: number) => {
      ctx.clearRect(0, 0, size, size)

      // 整体自转
      const rotY = (time / 15000) * 2 * Math.PI
      const rotX = -(time / 15000) * 2 * Math.PI

      // 虚线流动
      const dashAnimProgress = time / 10000
      const perspective = size * 1.5

      ctx.lineWidth = Number(edgeWidth)
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 投影计算
      const projectedCircles = circles.map((circle) => {
        const projPoints = circle.points.map((p) => {
          const y1 = p.y * Math.cos(rotX) - p.z * Math.sin(rotX)
          const z1 = p.y * Math.sin(rotX) + p.z * Math.cos(rotX)
          
          const x2 = p.x * Math.cos(rotY) + z1 * Math.sin(rotY)
          const z2 = -p.x * Math.sin(rotY) + z1 * Math.cos(rotY)

          const scale = perspective / (perspective + z2)
          return {
            x: x2 * scale + center,
            y: y1 * scale + center,
            z: z2,
            scale,
            blinkPhase: p.blinkPhase,
            blinkSpeed: p.blinkSpeed
          }
        })
        return { ...circle, projPoints }
      })

      // 绘制线条 (保持完全不透明)
      ctx.globalAlpha = 1.0
      projectedCircles.forEach((circle) => {
        const pts = circle.projPoints
        if (pts.length === 0) return

        let perimeter = 0
        for (let i = 0; i < pts.length; i++) {
          const next = pts[(i + 1) % pts.length]
          perimeter += Math.hypot(next.x - pts[i].x, next.y - pts[i].y)
        }

        ctx.setLineDash([perimeter * 0.8, perimeter * 0.2])
        const totalOffset = (circle.dashOffsetRatio + dashAnimProgress) * perimeter
        ctx.lineDashOffset = -totalOffset

        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y)
        }
        ctx.closePath()
        ctx.stroke()
      })

      // 绘制闪烁圆点
      ctx.setLineDash([])
      projectedCircles.forEach((circle) => {
        if (!circle.showDots) return
        circle.projPoints.forEach((pt) => {
          // 如果开启闪烁，利用 Math.sin 和随机参数计算动态透明度
          if (enableBlinking) {
            // sin 的范围是 -1 到 1，我们将其映射为基础透明度 0.2 到最高 1.0
            const sineWave = Math.sin(time * pt.blinkSpeed + pt.blinkPhase)
            ctx.globalAlpha = 0.2 + 0.8 * ((sineWave + 1) / 2) 
          } else {
            ctx.globalAlpha = 1.0
          }

          ctx.beginPath()
          ctx.arc(pt.x, pt.y, Number(dotRadius) * pt.scale, 0, 2 * Math.PI)
          ctx.fill()
        })
      })

      // 恢复 Alpha（好习惯，不污染后续绘制）
      ctx.globalAlpha = 1.0

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [color, edges, edgeWidth, dotRadius, enableBlinking])

  return (
    <div
      className={`fixed inset-0 overflow-hidden flex justify-center items-center pointer-events-none ${wrapperClassName}`}
    >
      <div
        className={className}
        style={{ width: '30rem', height: '30rem', position: 'relative' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  )
}