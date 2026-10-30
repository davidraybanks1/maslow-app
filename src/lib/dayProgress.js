import { allNeeds, MODE_ORDER, MODE_MAX_BUBBLES } from './constants'

/* Today's progress per mode, and the practices that belong to each mode.
   The same rule Today's completion ring uses: every need has a target by mode
   (MODE_MAX_BUBBLES) and each practice done counts toward its need's target,
   capped there. Pure functions of app state, so the desktop rail and Today
   always agree. */

export function poolFor(state, need) {
  const db = state.practicesDB
  if (db && db.length > 0) return db.filter(p => p.need_id === need.id && !p.archived_at)
  return (state.practices?.[need.id] || []).map(label => ({ id: null, label }))
}

function countFor(checked, needId) {
  let n = 0
  for (const e of checked) if (e.need_id === needId) n += e.count || 1
  return n
}

/** [{ mode, done, target, fill, rows: [{ need, practice }] }] in MODE_ORDER. */
export function zonesFor(state, checked) {
  const canvas = state.canvas || {}
  return MODE_ORDER.map(mode => {
    const needs = allNeeds().filter(n => canvas[n.id] === mode)
    const cap = MODE_MAX_BUBBLES[mode] || 0
    const target = cap * needs.length
    let done = 0
    const rows = []
    for (const need of needs) {
      done += Math.min(countFor(checked, need.id), cap)
      for (const practice of poolFor(state, need)) rows.push({ need, practice })
    }
    return { mode, done, target, fill: target > 0 ? Math.min(done / target, 1) : 0, rows }
  })
}
