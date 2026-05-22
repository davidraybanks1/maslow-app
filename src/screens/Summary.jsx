import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NEEDS, LAYERS } from '../lib/constants'
import { weekKey } from '../lib/store'
import styles from './Summary.module.css'

export default function Summary({ state }) {
  const [feelings, setFeelings] = useState([])
  const [loading, setLoading] = useState(true)

  const wk = weekKey()
  const weekStart = new Date(wk)
  const weekEnd = new Date(wk)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const currentIntentions = state.intentions[wk] || {}
  const checkins = state.checkins || {}

  const completedNeeds = NEEDS.filter(n => {
    const intention = currentIntentions[n.id]
    if (!intention) return false
    return Object.keys(checkins).some(dateKey => dateKey >= wk && checkins[dateKey]?.[n.id])
  })

  const intentionCount = Object.keys(currentIntentions).length
  const completedCount = completedNeeds.length

  useEffect(() => {
    async function loadFeelings() {
      if (!state.userId) { setLoading(false); return }
      const { data } = await supabase.from('feelings').select('*').eq('user_id', state.userId).gte('created_at', new Date(wk).toISOString()).order('created_at', { ascending: true })
      setFeelings(data || [])
      setLoading(false)
    }
    loadFeelings()
  }, [state.userId, wk])

  const avgEnergy = feelings.length ? Math.round(feelings.reduce((s,f) => s+f.energy, 0) / feelings.length * 10) / 10 : null
  const avgEase   = feelings.length ? Math.round(feelings.reduce((s,f) => s+f.ease,   0) / feelings.length * 10) / 10 : null
  const sortedTriggers = Object.entries(feelings.map(f=>f.trigger).filter(Boolean).reduce((acc,t) => { acc[t]=(acc[t]||0)+1; return acc }, {})).sort((a,b)=>b[1]-a[1]).slice(0,3)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.week}>{fmt(weekStart)} — {fmt(weekEnd)}</div>
        <div className={styles.title}>weekly summary</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>your canvas this week</div>
        <div className={styles.canvasSnap}>
          {NEEDS.map(n => {
            const mode = state.canvas[n.id] || 'nourishment'
            const lyr = LAYERS[mode]
            return (
              <div key={n.id} className={styles.snapTile} style={{ borderColor: lyr.border }}>
                <div className={styles.snapPip} style={{ background: lyr.pip }} />
                <div className={styles.snapName} style={{ color: lyr.text }}>{n.name}</div>
                <div className={styles.snapMode} style={{ color: lyr.text }}>{mode.slice(0,3)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>intentions</div>
        {intentionCount === 0 ? <div className={styles.empty}>No intentions set this week.</div> : (
          <>
            <div className={styles.statRow}>
              <div className={styles.stat}><div className={styles.statNum}>{intentionCount}</div><div className={styles.statLabel}>set</div></div>
              <div className={styles.statDivider} />
              <div className={styles.stat}><div className={styles.statNum}>{completedCount}</div><div className={styles.statLabel}>completed</div></div>
              <div className={styles.statDivider} />
              <div className={styles.stat}><div className={styles.statNum} style={{ color: completedCount===intentionCount?'#1B3A2D':'inherit' }}>{Math.round(completedCount/intentionCount*100)}%</div><div className={styles.statLabel}>rate</div></div>
            </div>
            <div className={styles.intentionsList}>
              {NEEDS.map(n => {
                const intention = currentIntentions[n.id]
                if (!intention) return null
                const done = completedNeeds.some(c => c.id === n.id)
                const lyr = LAYERS[state.canvas[n.id] || 'nourishment']
                return (
                  <div key={n.id} className={`${styles.intentionRow} ${done ? styles.intentionDone : ''}`}>
                    <div className={styles.intentionPip} style={{ background: lyr.pip }} />
                    <div className={styles.intentionBody}>
                      <div className={styles.intentionNeed}>{n.name}</div>
                      <div className={styles.intentionAction}>{intention.action}</div>
                    </div>
                    <div className={styles.intentionCheck}>{done ? '✓' : '·'}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>how you felt</div>
        {loading ? <div className={styles.empty}>Loading...</div> : feelings.length === 0 ? <div className={styles.empty}>No check-ins logged this week.</div> : (
          <>
            <div className={styles.statRow}>
              <div className={styles.stat}><div className={styles.statNum}>{avgEnergy}</div><div className={styles.statLabel}>avg energy</div></div>
              <div className={styles.statDivider} />
              <div className={styles.stat}><div className={styles.statNum}>{avgEase}</div><div className={styles.statLabel}>avg ease</div></div>
              <div className={styles.statDivider} />
              <div className={styles.stat}><div className={styles.statNum}>{feelings.length}</div><div className={styles.statLabel}>check-ins</div></div>
            </div>
            {sortedTriggers.length > 0 && (
              <div className={styles.triggers}>
                <div className={styles.triggersLabel}>most common drivers</div>
                {sortedTriggers.map(([t,count]) => (
                  <div key={t} className={styles.triggerItem}><span className={styles.triggerName}>{t}</span><span className={styles.triggerCount}>{count}×</span></div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>streak</div>
        <div className={styles.streakRow}>
          <div className={styles.streakNum}>{state.streak || 0}</div>
          <div className={styles.streakLabel}>{'weeks\nin a row'}</div>
        </div>
      </div>
    </div>
  )
}