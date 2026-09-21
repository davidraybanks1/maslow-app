// Lightweight module-level registry so the globally-mounted composer can ask
// "which chart(s) are currently in view, on whatever screen is showing?"
// without prop-drilling state up through the app shell. Charts register
// themselves (via the useChartCapture hook) while their screen is mounted,
// and the registry tracks which of them are actually scrolled into view.
//
// Visibility changes are broadcast on the app's existing window-event bus
// (see maslow:entry-added, maslow:demo-ring, etc.) so GlobalComposer can
// simply listen rather than reach into this module reactively.

const charts = new Map() // id -> { label, node }
let inViewIds = []

function notify() {
  window.dispatchEvent(new CustomEvent('maslow:chart-visibility', { detail: { inViewIds: [...inViewIds] } }))
}

export function registerChart(id, label, node) {
  charts.set(id, { label, node })
}

export function unregisterChart(id) {
  charts.delete(id)
  const next = inViewIds.filter(x => x !== id)
  if (next.length !== inViewIds.length) {
    inViewIds = next
    notify()
  }
}

export function setChartInView(id, visible) {
  const has = inViewIds.includes(id)
  if (visible && !has) inViewIds = [...inViewIds, id]
  else if (!visible && has) inViewIds = inViewIds.filter(x => x !== id)
  else return
  notify()
}

// Charts currently in view, ordered top-to-bottom by their position on
// screen right now — the topmost one is what the user was just looking at.
export function getInViewCharts() {
  return inViewIds
    .map(id => {
      const entry = charts.get(id)
      return entry ? { id, label: entry.label, node: entry.node } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top)
}
