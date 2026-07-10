'use client'

import { useMemo } from 'react'

interface CircleProps {
  rotateX?: number
  rotateY?: number
  translateY?: number
  scale?: number
  dashOffset?: number
  color?: string
  edges?: number
  offset?: number
  edgeWidth?: number | string
}

function Circle({ rotateX = 0, rotateY = 0, translateY = 0, scale = 1, dashOffset = 0, color, edges = 16, offset = 0, edgeWidth = '.2' }: CircleProps) {
  const { pathD, vertices } = useMemo(() => {
    const cx = 30
    const cy = 30
    const r = 20
    const verts: { x: number; y: number }[] = []

    const PRECISION = 1e12

    for (let i = 0; i < edges; i++) {
      const angle = (2 * Math.PI * i) / edges + offset
      verts.push({
        x: Math.round((cx + r * Math.sin(angle)) * PRECISION) / PRECISION,
        y: Math.round((cy + r * Math.cos(angle)) * PRECISION) / PRECISION,
      })
    }

    const d = verts.map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`).join(' ') + ' Z'
    return { pathD: d, vertices: verts }
  }, [edges, offset])

  return (
    <div style={{ width: '30rem', height: '30rem', position: 'absolute', transformStyle: 'preserve-3d' }}>
      <svg
        width="30rem"
        height="30rem"
        viewBox="0 0 60 60"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          transition: 'transform 0.5s',
          transformOrigin: 'center center',
          transform:
            `translateY(${translateY}rem) ` +
            `rotateX(${rotateX}deg) ` +
            `rotateY(${rotateY}deg) ` +
            `scale(${scale})`,
        }}
      >
        <defs>
          <linearGradient id="gradient">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={edgeWidth}
          fill="none"
          pathLength={1000}
          strokeDasharray={'950 50'}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        >
          <animate attributeName="stroke-dashoffset" from={dashOffset} to={1000 + dashOffset} dur="10s" repeatCount="indefinite" />
        </path>
        {vertices.map((v, i) => (
          <circle key={i} cx={v.x} cy={v.y} r=".4" fill={color}>
            <animate
              attributeName="opacity"
              values="1;0;1"
              dur="5s"
              begin={`${(i / edges) * 5}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
    </div>
  )
}

export default function Sphere({
  color = '#60a5fa',
  className,
  wrapperClassName,
  edges = 16,
  edgeWidth = '.2',
}: {
  color?: string
  className?: string
  wrapperClassName?: string
  edges?: number
  edgeWidth?: number | string
}) {
  const sphereRadius = 10 // rem（SVG viewBox 60→30rem，球半径 20 SVG单位 = 10rem）

  const circles = useMemo(() => {
    const result: React.ReactNode[] = []
    const dashStep = 1000 / edges

    // 经线: edges 条，均匀环绕 360°
    const longitudeStep = 360 / edges
    for (let i = 0; i < edges; i++) {
      result.push(
        <Circle
          key={`lon-${i}`}
          rotateY={i * longitudeStep}
          dashOffset={i * dashStep}
          color={color}
          edges={edges}
          edgeWidth={edgeWidth}
        />,
      )
    }

    // 纬线: floor(edges/2)-1 条，从北极到南极均匀分布（不含两极）
    const latitudeCount = Math.floor(edges / 2) - 1
    const latStep = 180 / (latitudeCount + 1)
    // 当 edges = 2*(2n-1) 即 edges % 4 !== 0 时（如 6、10、14），
    // 纬线顶点需偏移半个步长才能与经线交点对齐
    const latOffset = edges % 4 !== 0 ? Math.PI / edges : 0
    // 纬线 dashOffset 整体偏移，与经线错开动画相位
    const latDashBase = edges * dashStep
    for (let i = 1; i <= latitudeCount; i++) {
      const latAngle = i * latStep
      const rad = (latAngle * Math.PI) / 180

      // translateY: 球心为原点，Y 轴向下为正
      // 纬度角 φ 从北极起算，Y = -R·cos(φ)
      const translateY = -sphereRadius * Math.cos(rad)
      // scale: 纬线半径 / 球半径 = sin(φ)
      const scale = Math.sin(rad)

      result.push(
        <Circle
          key={`lat-${i}`}
          rotateX={90}
          translateY={translateY}
          scale={scale}
          dashOffset={latDashBase + i * dashStep}
          color={color}
          edges={edges}
          offset={latOffset}
          edgeWidth={edgeWidth}
        />,
      )
    }

    return result
  }, [color, edges, edgeWidth])

  return (
    <>
      <style>{`
        @keyframes sphere-spin {
          0% { transform: rotateY(0deg) rotateX(-0deg); }
          25% { transform: rotateY(180deg) rotateX(-180deg); }
          50% { transform: rotateY(360deg) rotateX(-360deg); }
          75% { transform: rotateY(180deg) rotateX(-180deg); }
          100% { transform: rotateY(-0deg) rotateX(0deg); }
        }
      `}</style>
      <div
        className={`fixed inset-0 overflow-hidden flex justify-center items-center ${wrapperClassName ?? ''}`}
        style={{ perspective: '200rem', transformStyle: 'preserve-3d' }}
      >
        <div
          className={className}
          style={{
            width: '30rem',
            height: '30rem',
            position: 'relative',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              animation: 'sphere-spin 30s linear infinite',
              transformStyle: 'preserve-3d',
            }}
          >
            {circles}
          </div>
        </div>
      </div>
    </>
  )
}
