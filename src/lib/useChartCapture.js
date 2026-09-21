import { useEffect, useRef } from 'react'
import { registerChart, unregisterChart, setChartInView } from './chartRegistry'

// Marks the element the returned ref is attached to as a "chart" the sticky
// global composer can offer to attach as an image when it's in view. Call
// unconditionally, before any early `return null` in the component.
export function useChartCapture(id, label) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    registerChart(id, label, node)
    const io = new IntersectionObserver(
      ([entry]) => setChartInView(id, entry.isIntersecting),
      { threshold: 0.5 }
    )
    io.observe(node)
    return () => {
      io.disconnect()
      unregisterChart(id)
    }
  }, [id, label])

  return ref
}
