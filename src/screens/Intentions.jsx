import { useState } from 'react'
import { NEEDS, LAYERS } from '../lib/constants'
import { weekKey } from '../lib/store'
import styles from './Intentions.module.css'

const PRESETS = {
  movement: {
    survival:     ['Take a 10 min walk', 'Stretch for 5 minutes', 'Use the stairs'],
    nourishment:  ['30 min workout', 'Morning walk outside', 'Yoga or mobility session'],
    appreciation: ['Try a new sport or class', 'Hike somewhere new', 'Train for something specific'],
    play:         ['Daily training session', 'Compete or perform', 'Coach or lead others'],
  },
  community: {
    survival:     ['Text someone you care about', 'Reply to a message you have been avoiding'],
    nourishment:  ['Have a proper catch-up with a friend', 'Family dinner', 'Join a group activity'],
    appreciation: ['Plan something meaningful with people you love', 'Be fully present in a social setting'],
    play:         ['Invest deeply in a relationship', 'Build or lead a community'],
  },
  reflection: {
    survival:     ['5 min journaling', 'One honest check-in with yourself'],
    nourishment:  ['Morning pages', 'Weekly review', 'Meditation session', 'Therapy or coaching'],
    appreciation: ['Deep journaling on something that matters', 'Read something that challenges you'],
    play:         ['Daily contemplative practice', 'Share your reflections with others'],
  },
  purpose: {
    survival:     ['Do one thing that feels meaningful', 'Connect a task to a bigger why'],
    nourishment:  ['Work on a personal project', 'Learn something new', 'Contribute to something bigger'],
    appreciation: ['Dedicate focused time to meaningful work', 'Mentor or teach someone'],
    play:         ['Lead with purpose daily', 'Build something that matters to you'],
  },
  nutrition: {
    survival:     ['Eat at least two real meals', 'Drink enough water'],
    nourishment:  ['Cook a proper meal', 'Eat without screens', 'Plan your meals for the week'],
    appreciation: ['Try a new recipe', 'Make mealtime a ritual'],
    play:         ['Develop a deep relationship with food and how it fuels you'],
  },
  rest: {
    survival:     ['Get to bed before midnight', 'Take one real break during the day'],
    nourishment:  ['Consistent sleep schedule', 'No screens before bed', 'One full rest day'],
    appreciation: ['Create a wind-down ritual', 'Take a real day off'],
    play:         ['Protect sleep as a non-negotiable', 'Master your recovery'],
  },
  beauty: {
    survival:     ['Notice one beautiful thing today', 'Listen to music you love'],
    nourishment:  ['Spend time in nature', 'Visit a gallery or museum'],
    appreciation: ['Create something', 'Seek out beauty intentionally'],
    play:         ['Make beauty a daily practice', 'Create and share regularly'],
  },
  security: {
    survival:     ['Check your bank balance', 'Pay one outstanding bill'],
    nourishment:  ['Review your budget', 'Save something this week', 'Sort one financial task'],
    appreciation: ['Work toward a financial goal', 'Build a buffer'],
    play:         ['Build systems that create lasting security'],
  },
  dwelling: {
    survival:     ['Tidy one space', 'Do the dishes'],
    nourishment:  ['Deep clean one room', 'Declutter something'],
    appreciation: ['Improve something in your home', 'Create a space that restores you'],
    play:         ['Make your environment a true reflection of who you are'],
  },
  intimacy: {
    survival:     ['Be honest with someone close to you', 'Make time for physical closeness'],
    nourishment:  ['Have a real conversation with your partner', 'Be vulnerable with someone you trust'],
    appreciation: ['Plan something intentional with your partner', 'Deepen a close friendship'],
    play:         ['Invest deeply in your most important relationship'],
  },
}

export default function Intentions({ state, setIntention }) {
  const wk = weekKey()
  const currentIntentions = state.intentions[wk] || {}
  const [expanded, setExpanded] = useState(null)
  const [customInputs, setCustomInputs] = useState({})
  const [saved, setSaved] = useState({})

  const weekStart = new Date(wk)
  const weekEnd = new Date(wk)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  function handleSelectPreset(needId, action) {
    setIntention(wk, needId, action, 'daily')
    setSaved(prev => ({ ...prev, [needId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [needId]: false })), 1500)
    setExpanded(null)
  }

  function handleCustomSave(needId) {
    const action = customInputs[needId]?.trim()
    if (!action) return
    setIntention(wk, needId, action, 'daily')
    setSaved(prev => ({ ...prev, [needId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [needId]: false })), 1500)
    setExpanded(null)
  }

  const completedCount = Object.keys(currentIntentions).length

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.week}>{fmt(weekStart)} — {fmt(weekEnd)}</div>
        <div className={styles.title}>weekly intentions</div>
        <div className={styles.sub}>
          {completedCount === 0
            ? 'Set one intention for each need this week.'
            : completedCount === NEEDS.length
            ? 'All intentions set. Have a great week.'
            : `${completedCount} of ${NEEDS.length} set`}
        </div>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${(completedCount / NEEDS.length) * 100}%` }} />
        </div>
      </div>

      <div className={styles.list}>
        {NEEDS.map(n => {
          const mode = state.canvas[n.id] || 'nourishment'
          const lyr = LAYERS[mode]
          const current = currentIntentions[n.id]
          const isOpen = expanded === n.id
          const isSaved = saved[n.id]
          const presets = PRESETS[n.id]?.[mode] || []

          return (
            <div key={n.id} className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}>
              <div className={styles.row} onClick={() => setExpanded(isOpen ? null : n.id)}>
                <div className={styles.rowLeft}>
                  <div className={styles.pip} style={{ background: lyr.pip }} />
                  <div className={styles.rowBody}>
                    <div className={styles.needName}>{n.name}</div>
                    <div className={styles.modeLabel} style={{ color: lyr.text }}>{mode}</div>
                  </div>
                </div>
                <div className={styles.rowRight}>
                  {isSaved ? (
                    <div className={styles.savedBadge}>saved ✓</div>
                  ) : current ? (
                    <div className={styles.currentAction}>{current.action}</div>
                  ) : (
                    <div className={styles.setPrompt}>set intention</div>
                  )}
                  <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>›</div>
                </div>
              </div>

              {isOpen && (
                <div className={styles.panel}>
                  <div className={styles.panelLabel}>Presets for {mode}</div>
                  <div className={styles.presets}>
                    {presets.map((p, i) => (
                      <div
                        key={i}
                        className={`${styles.preset} ${current?.action === p ? styles.presetActive : ''}`}
                        style={current?.action === p ? { borderColor: lyr.border, color: lyr.text } : {}}
                        onClick={() => handleSelectPreset(n.id, p)}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className={styles.panelLabel} style={{ marginTop: 16 }}>Or write your own</div>
                  <div className={styles.customRow}>
                    <input
                      className={styles.customInput}
                      placeholder={`My intention for ${n.name.toLowerCase()} this week...`}
                      value={customInputs[n.id] || current?.action || ''}
                      onChange={e => setCustomInputs(prev => ({ ...prev, [n.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleCustomSave(n.id)}
                    />
                    <button className={styles.saveBtn} onClick={() => handleCustomSave(n.id)}>Save</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}