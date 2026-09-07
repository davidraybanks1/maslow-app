export const DEFAULT_NOTIF_TYPES = { streaks: true, skips: true, plain: true }

export function practiceNotifCopy({ labels, streak, daysSinceLast, types }) {
  const t = { ...DEFAULT_NOTIF_TYPES, ...(types || {}) }

  if (labels.length > 1) {
    if (t.plain === false) return null
    const title = labels.length === 2
      ? `${labels[0]} and ${labels[1]}`
      : `${labels[0]}, ${labels[1]} and ${labels[2]}`
    return { title, body: 'This is usually about when you do them.' }
  }

  const label = labels[0]

  if (streak >= 3) {
    if (t.streaks === false) return null
    return {
      title: `Streak · ${label}`,
      body: `${streak} days so far. Today makes ${streak + 1}, if you're up for it.`,
    }
  }

  if (daysSinceLast !== null && daysSinceLast >= 3) {
    if (t.skips === false) return null
    return {
      title: `Skipping? · ${label}`,
      body: `${daysSinceLast} days since the last one. Sometimes that's just the season.`,
    }
  }

  if (t.plain === false) return null
  return { title: label, body: 'This is usually about when you do it.' }
}
