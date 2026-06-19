import { useRef, useEffect } from 'react'

export default function DonutChart({ data, className }) {
  const canvasRef = useRef(null)
  const total = data.reduce((s, d) => s + d.count, 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || total === 0) return
    const ctx = canvas.getContext('2d')
    const size = 100
    const cx = size / 2
    const cy = size / 2
    const outerRadius = size / 2
    const innerRadius = 22

    ctx.clearRect(0, 0, size, size)

    let angle = -Math.PI / 2
    for (const d of data) {
      const sliceAngle = (d.count / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, outerRadius, angle, angle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = d.color
      ctx.fill()
      angle += sliceAngle
    }

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    if (data.length > 1) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      angle = -Math.PI / 2
      for (const d of data) {
        const sliceAngle = (d.count / total) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + innerRadius * Math.cos(angle), cy + innerRadius * Math.sin(angle))
        ctx.lineTo(cx + outerRadius * Math.cos(angle), cy + outerRadius * Math.sin(angle))
        ctx.stroke()
        angle += sliceAngle
      }
    }
  }, [data, total])

  return <canvas ref={canvasRef} width={100} height={100} className={className} />
}
