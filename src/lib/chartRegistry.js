// Lightweight module-level registry so the globally-mounted composer can ask
// "which chart(s) has the user scrolled past, on whatever screen is
// showing?" without prop-drilling state up through the app shell. Charts
// register themselves (via the useChartCapture hook) while their screen is
// mounted, and the registry tracks both which are in view right now and
// which have been scrolled into view at any point this visit.
//
// "Seen" only grows while the screen is mounted — scroll past a chart and
// it stays offered even after it scrolls back out of view, so by the time
// someone reaches the bottom of the Almanac they can pick from everything
// they passed on the way down, not just whatever's on screen right now.
// It resets the moment every chart unregisters (the screen itself
// unmounted, i.e. the user navigated away), so the next visit starts clean.
//
// Visibility changes are broadcast on the app's existing window-event bus
// (see maslow:entry-added, maslow:demo-ring, etc.) so GlobalComposer can
// simply listen rather than reach into this module reactively.

const charts = new Map() // id -> { label, node }
let inViewIds = []
let seenIds = []

function notify() {
  window.dispatchEvent(new CustomEvent('maslow:chart-visibility', { detail: { inViewIds: [...inViewIds], seenIds: [...seenIds] } }))
}

export function registerChart(id, label, node) {
  charts.set(id, { label, node })
}

export function unregisterChart(id) {
  charts.delete(id)
  const nextInView = inViewIds.filter(x => x !== id)
  const inViewChanged = nextInView.length !== inViewIds.length
  inViewIds = nextInView
  // Every chart on the screen has unregistered — the screen itself
  // unmounted — so forget what was scrolled past. The next mount (the next
  // visit to this screen) should start fresh, not remember last time.
  if (charts.size === 0 && seenIds.length) {
    seenIds = []
    notify()
    return
  }
  if (inViewChanged) notify()
}

export function setChartInView(id, visible) {
  const wasInView = inViewIds.includes(id)
  if (visible === wasInView) return
  if (visible) {
    inViewIds = [...inViewIds, id]
    if (!seenIds.includes(id)) seenIds = [...seenIds, id]
  } else {
    inViewIds = inViewIds.filter(x => x !== id)
  }
  notify()
}

function resolve(ids) {
  return ids
    .map(id => {
      const entry = charts.get(id)
      return entry ? { id, label: entry.label, node: entry.node } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top)
}

// Charts currently in view, ordered top-to-bottom by their position on
// screen right now — the topmost one is what the user was just looking at.
export function getInViewCharts() {
  return resolve(inViewIds)
}

// Every chart scrolled past so far this visit to the screen, ordered
// top-to-bottom by where it sits on the page. This is the pool the composer
// offers: it only grows as the user scrolls further down, so by the bottom
// of the screen everything above is still available to pick from.
export function getSeenCharts() {
  return resolve(seenIds)
}
