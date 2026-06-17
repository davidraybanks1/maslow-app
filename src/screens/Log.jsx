import { useState, useEffect } from 'react'
import { NEEDS } from '../lib/constants'
import { loadJournalEntry } from '../lib/store'
import styles from './Log.module.css'

const MOOD_COLOR = { good: '#1B3A2D', fine: '#E8B81F', bad: '#D93B1C' }
const MOOD_PERIODS = ['morning', 'midday', 'evening']

function formatDateLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const month = d.toLocaleDateString('en-US', { month: 'long' }).toLowerCase()
  return `${day}, ${month} ${d.getDate()}`
}

export default function Log({ state }) {
  const [expandedDay, setExpandedDay] = useState(null)
  const [journalEntries, setJournalEntries] = useState({})
  const moods = state.moods || []
  const canvas = state.canvas || {}
  const checkins = state.checkins || {}

  const allDayKeys = [...new Set([
    ...Object.keys(checkins),
    ...moods.map(m => m.date_key),
  ])].sort((a, b) => b.localeCompare(a))

  const assignedNeeds = NEEDS.filter(n => canvas[n.id])
  const totalNeeds = assignedNeeds.length

  useEffect(() => {
    if (!expandedDay || !state.userId || journalEntries[expandedDay] !== undefined) return
    loadJournalEntry(state.userId, expandedDay).then(entry => {
      setJournalEntries(prev => ({ ...prev, [expandedDay]: entry || '' }))
    })
  }, [expandedDay, state.userId])

  function handleRowClick(dateKey) {
    setExpandedDay(prev => prev === dateKey ? null : dateKey)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>YOUR LOG</div>
        <div className={styles.title}>log</div>
        <div className={styles.sub}>tap any day to see what happened.</div>
      </div>
      <div className={styles.content}>
        {allDayKeys.length === 0 ? (
          <div className={styles.emptyState}>no data yet — start checking in on the today screen.</div>
        ) : (
          <div className={styles.card}>
            {allDayKeys.map((dateKey, idx) => {
              const dayCheckins = checkins[dateKey] || []
              const dayMoods = moods.filter(m => m.date_key === dateKey)
              const needsMet = assignedNeeds.filter(n => dayCheckins.some(c => c.startsWith(`${n.id}_`))).length
              const isExpanded = expandedDay === dateKey
              const journal = journalEntries[dateKey]

              const practicesByNeed = {}
              for (const c of dayCheckins) {
                const underscore = c.indexOf('_')
                if (underscore === -1) continue
                const needId = c.slice(0, underscore)
                const text = c.slice(underscore + 1)
                if (!practicesByNeed[needId]) practicesByNeed[needId] = []
                practicesByNeed[needId].push(text)
              }

              return (
                <div key={dateKey}>
                  {idx > 0 && <div className={styles.rowDivider} />}
                  <div className={styles.dayRow} onClick={() => handleRowClick(dateKey)}>
                    <span className={styles.dayLabel}>{formatDateLabel(dateKey)}</span>
                    {totalNeeds > 0 && (dayCheckins.length > 0 || dayMoods.length > 0) && (
                      <span className={styles.dayCount}>{needsMet} of {totalNeeds} needs</span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className={styles.dayDetail}>

                      {/* Mood */}
                      <div className={styles.detailLabel}>mood</div>
                      {dayMoods.length === 0 ? (
                        <div className={styles.detailEmpty}>no mood data</div>
                      ) : (
                        <div className={styles.moodList}>
                          {MOOD_PERIODS.map(period => {
                            const m = dayMoods.find(x => x.prompt_time === period)
                            if (!m) return null
                            return (
                              <div key={period}>
                                <div className={styles.moodRow}>
                                  <span className={styles.moodPeriod}>{period}</span>
                                  <span className={styles.moodBadge} style={{ background: MOOD_COLOR[m.mood] }}>{m.mood}</span>
                                </div>
                                {m.note && <div className={styles.moodNote}>{m.note}</div>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Practices */}
                      <div className={styles.detailLabel} style={{ marginTop: 14 }}>practices</div>
                      {Object.keys(practicesByNeed).length === 0 ? (
                        <div className={styles.detailEmpty}>no practices logged</div>
                      ) : (
                        <div className={styles.practiceList}>
                          {NEEDS.filter(n => practicesByNeed[n.id]).map(n => (
                            <div key={n.id} className={styles.practiceGroup}>
                              <span className={styles.practiceNeed}>{n.name}</span>
                              <span className={styles.practiceTexts}>{practicesByNeed[n.id].join(' · ')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Journal */}
                      {journal !== undefined && (
                        <>
                          <div className={styles.detailLabel} style={{ marginTop: 14 }}>thoughts</div>
                          {journal ? (
                            <div className={styles.journalText}>{journal}</div>
                          ) : (
                            <div className={styles.detailEmpty}>no journal entry</div>
                          )}
                        </>
                      )}

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
