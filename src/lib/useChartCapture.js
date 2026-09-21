import { useCallback, useRef } from 'react'
import { registerChart, unregisterChart, setChartInView } from './chartRegistry'

// Marks the element the returned ref is attached to as a "chart" the sticky
// global composer can offer to attach as an image when it's in view. Call
// unconditionally, before any early `return null` in the component.
//
// A callback ref, not the more usual ref-object-plus-effect pairing — on
// purpose. Some chart sections (e.g. ThreadsSection, which waits on an
// async loadAllJournalMeta before it can decide whether to render at all)
// return null on their first render and only mount the real <section> once
// data resolves a moment later. An effect keyed on this hook's own (id,
// label) args — both constant strings — only ever runs once, right after
// that first, contentless render, while ref.current is still null; it never
// gets a second chance once the section actually mounts. A callback ref
// doesn't have that gap: React invokes it again whenever the DOM node it's
// attached to changes, including from null to real on that later render, so
// registration happens whenever there's actually something to register.
export function useChartCapture(id, label) {
  const observerRef = useRef(null)

  const ref = useCallback(node => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
      unregisterChart(id)
    }
    if (node) {
      registerChart(id, label, node)
      const io = new IntersectionObserver(
        ([entry]) => setChartInView(id, entry.isIntersecting),
        { threshold: 0.5 }
      )
      io.observe(node)
      observerRef.current = io
    }
  }, [id, label])

  return ref
}
