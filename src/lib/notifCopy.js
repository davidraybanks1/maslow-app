export const DEFAULT_NOTIF_TYPES = { streaks: true, skips: true, plain: true }

export function practiceNotifCopy({ labels, streak, daysSinceLast, types }) {
  const t = { ...DEFAULT_NOTIF_TYPES, ...(types || {}) }

  if (labels.length > 1) {
    if (t.plain === false) return null
    const lower = labels.map(l => l.toLowerCase())
    const title = labels.length === 2
      ? `${lower[0]} and ${lower[1]}`
      : `${lower[0]}, ${lower[1]} and ${lower[2]}`
    return { title, body: 'this is usually about when you do them.' }
  }

  const label = labels[0].toLowerCase()

  if (streak >= 3) {
    if (t.streaks === false) return null
    return {
      title: `streak · ${label}`,
      body: `${streak} days so far. today makes ${streak + 1}, if you're up for it.`,
    }
  }

  if (daysSinceLast !== null && daysSinceLast >= 3) {
    if (t.skips === false) return null
    return {
      title: `skipping? · ${label}`,
      body: `${daysSinceLast} days since the last one. sometimes that's just the season.`,
    }
  }

  if (t.plain === false) return null
  return { title: label, body: 'this is usually about when you do it.' }
}
