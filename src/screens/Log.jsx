import { useState, useEffect } from 'react'
import { NEEDS, LAYERS } from '../lib/constants'
import { loadJournalEntry } from '../lib/store'
import styles from './Log.module.css'

const MOOD_COLOR = { good: '#1B3A2D', fine: '#E8B81F', bad: '#D93B1C' }

function LogCalendar({ checkins, canvas, moods, onSelectDay, currentMonth, setCurrentMonth }) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = (firstDay.getDay() + 6) % 7

  const totalBubbles = NEEDS.reduce((s, n) => {
    const mode = canvas[n.id]
    return s + (LAYERS[mode]?.bubbles || 0)
  }, 0)

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dateKeyFor(d) {
    const dt = new Date(year, month, d)
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarHeader}>
        <button className={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>←</button>
        <div className={styles.calMonthLabel}>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button className={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>→</button>
      </div>
      <div className={styles.calWeekdays}>
        {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className={styles.calWeekday}>{d}</div>)}
      </div>
      <div className={styles.calGrid}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className={styles.calCellEmpty} />
          const key = dateKeyFor(d)
          const dayCheckins = checkins[key] || []
          const pct = totalBubbles > 0 ? dayCheckins.length / totalBubbles : 0
          const hasData = dayCheckins.length > 0 || (moods || []).some(m => m.date_key === key)
          return (
            <div
              key={i}
              className={styles.calCell}
              style={{ background: hasData ? '#E8B81F' : 'var(--border)', opacity: hasData ? Math.max(0.2, pct) : 0.3 }}
              onClick={() => onSelectDay(key)}
            >
              <span className={styles.calCellNum}>{d}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayDetailModal({ dateKey, checkins, moods, canvas, journalEntry, onClose }) {
  const dayCheckins = checkins[dateKey] || []
  const dayMoods = (moods || []).filter(m => m.date_key === dateKey)
  const totalBubbles = NEEDS.reduce((s, n) => {
    const mode = canvas[n.id]
    return s + (LAYERS[mode]?.bubbles || 0)
  }, 0)
  const pct = totalBubbles > 0 ? Math.round(dayCheckins.length / totalBubbles * 100) : 0
  const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>×</button>
        <div className={styles.modalDate}>{dateLabel}</div>
        <div className={styles.modalScore}>{pct}% · {dayCheckins.length} of {totalBubbles}</div>

        <div className={styles.modalSectionLabel}>mood</div>
        {dayMoods.length === 0 ? (
          <div className={styles.modalEmpty}>No mood data for this day.</div>
        ) : (
          <div className={styles.modalMoodList}>
            {dayMoods.map((m, i) => (
              <div key={i} className={styles.modalMoodRow}>
                <span className={styles.modalMoodTime}>{m.prompt_time}</span>
                <span className={styles.modalMoodBadge} style={{ background: MOOD_COLOR[m.mood] }}>{m.mood}</span>
              </div>
            ))}
            {dayMoods.filter(m => m.note).map((m, i) => (
              <div key={'note'+i} className={styles.modalMoodNote}>{m.note}</div>
            ))}
          </div>
        )}

        <div className={styles.modalSectionLabel}>practices</div>
        {dayCheckins.length === 0 ? (
          <div className={styles.modalEmpty}>No practices logged for this day.</div>
        ) : (
          <div className={styles.modalPracticeList}>
            {dayCheckins.map((c, i) => {
              const [needId, ...rest] = c.split('_')
              const need = NEEDS.find(n => n.id === needId)
              return (
                <div key={i} className={styles.modalPracticeRow}>
                  <span className={styles.modalPracticeNeed}>{need?.name}</span>
                  <span className={styles.modalPracticeText}>{rest.join('_')}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.modalSectionLabel}>thoughts</div>
        {journalEntry ? (
          <div className={styles.modalJournal}>{journalEntry}</div>
        ) : (
          <div className={styles.modalEmpty}>No journal entry for this day.</div>
        )}
      </div>
    </div>
  )
}

export default function Log({ state }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [journalEntry, setJournalEntry] = useState('')
  const moods = state.moods || []

  useEffect(() => {
    if (selectedDay && state.userId) {
      loadJournalEntry(state.userId, selectedDay).then(setJournalEntry)
    }
  }, [selectedDay, state.userId])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>YOUR LOG</div>
        <div className={styles.title}>log</div>
        <div className={styles.sub}>tap any day to see what happened.</div>
      </div>
      <div className={styles.content}>
        <LogCalendar
          checkins={state.checkins}
          canvas={state.canvas}
          moods={moods}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          onSelectDay={setSelectedDay}
        />
      </div>
      {selectedDay && (
        <DayDetailModal
          dateKey={selectedDay}
          checkins={state.checkins}
          moods={moods}
          canvas={state.canvas}
          journalEntry={journalEntry}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
