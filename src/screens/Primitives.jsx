/* /primitives — visual test route for all loam Stage 1 components.
   Navigate to localhost:5173/primitives to see the full set.
   Not linked in production navigation; shown only during development. */
import { useState } from 'react'
import {
  Dateline, ProfileBadge, ProgressRule, PullQuote, CheckIn,
  ChapterRow, PracticeDot, IndexRow, EntryRow, LoamTabBar,
} from '../components/loam'
import styles from './Primitives.module.css'

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function PracticeDotDemo() {
  const [count, setCount] = useState(0)
  return (
    <div className={styles.dotRow}>
      <PracticeDot
        count={count}
        color="var(--loam-nourishment)"
        onCheck={() => setCount(c => (c + 1) % 3)}
        onOpen={() => alert('open practice')}
      />
      <span className={styles.dotLabel}>
        {count === 0 ? 'resting — hold to check' : count === 1 ? 'done — hold to ×2' : '×2 — hold to clear'}
      </span>
      <button
        type="button"
        className={styles.reset}
        onClick={() => setCount(0)}
      >reset</button>
    </div>
  )
}

function PracticeDotUndoDemo() {
  const [count, setCount] = useState(1)
  return (
    <div className={styles.dotRow}>
      <PracticeDot
        count={count}
        color="var(--loam-exploration)"
        onCheck={() => setCount(c => (c + 1) % 3)}
        onOpen={() => {}}
      />
      <span className={styles.dotLabel}>done — hold to undo / count {count}</span>
    </div>
  )
}

function CheckInDemo() {
  const [band, setBand] = useState(null)
  const [feeling, setFeeling] = useState(null)
  return (
    <CheckIn
      band={band}
      feeling={feeling}
      onBand={b => { setBand(b); setFeeling(null) }}
      onFeeling={setFeeling}
    />
  )
}

export default function Primitives() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>loam primitives — stage 1</h1>

      <Section title="Dateline + ProfileBadge">
        <Dateline onboardedAt="2024-01-15">
          <ProfileBadge initial="D" onClick={() => {}} />
        </Dateline>
        <Dateline onboardedAt="2024-01-15" docked>
          <ProfileBadge initial="D" docked onClick={() => {}} />
        </Dateline>
      </Section>

      <Section title="ProgressRule">
        <ProgressRule pct={0} />
        <ProgressRule pct={25} />
        <ProgressRule pct={62} />
        <ProgressRule pct={100} />
      </Section>

      <Section title="PullQuote">
        <PullQuote
          text="the work is never finished, only abandoned"
          folio="NOTE TO SELF · 1 / 4 →"
        />
        <PullQuote
          text="i keep returning to this idea every few weeks"
          folio="NOTE TO SELF · 2 / 4 →"
          noTopRule
        />
      </Section>

      <Section title="CheckIn (interactive)">
        <CheckInDemo />
      </Section>

      <Section title="ChapterRow">
        <ChapterRow numeral="i" name="exploration" met={1} total={3} color="var(--loam-exploration-text)" />
        <ChapterRow numeral="ii" name="appreciation" met={2} total={2} color="var(--loam-appreciation-text)" complete />
        <ChapterRow numeral="iii" name="nourishment" met={0} total={3} color="var(--loam-nourishment-text)" />
        <ChapterRow numeral="iv" name="survival" met={1} total={1} color="var(--loam-survival-text)" complete />
      </Section>

      <Section title="PracticeDot — press and hold">
        <PracticeDotDemo />
        <PracticeDotUndoDemo />
        <div className={styles.dotRow}>
          <PracticeDot count={0} color="var(--loam-appreciation)" onCheck={() => {}} onOpen={() => {}} />
          <span className={styles.dotLabel}>resting (appreciation)</span>
        </div>
        <div className={styles.dotRow}>
          <PracticeDot count={1} color="var(--loam-survival)" onCheck={() => {}} onOpen={() => {}} />
          <span className={styles.dotLabel}>done (survival)</span>
        </div>
        <div className={styles.dotRow}>
          <PracticeDot count={2} color="var(--loam-nourishment)" onCheck={() => {}} onOpen={() => {}} />
          <span className={styles.dotLabel}>×2 (nourishment)</span>
        </div>
      </Section>

      <Section title="IndexRow">
        <IndexRow name="sleep quality" value="↑ 8%" onClick={() => {}} />
        <IndexRow name="movement" value="↓ 2%" onClick={() => {}} />
        <IndexRow name="hydration" value="→ steady" />
      </Section>

      <Section title="EntryRow">
        <EntryRow
          dateLabel="WED · OCT 14 · MIDDAY"
          text="I keep coming back to this idea that the best work happens when you're not trying to do your best work."
          tags={['midday', 'creative', 'exploration']}
          onRevisit={() => {}}
          onFavorite={() => {}}
        />
        <EntryRow
          dateLabel="TUE · OCT 13 · MORNING"
          text="Something shifted today. Hard to name it yet."
          tags={['morning', 'steady']}
          onRevisit={() => {}}
          onFavorite={() => {}}
          favorite
        />
      </Section>

      <Section title="TabBar (loam)">
        <div className={styles.tabBarPreview}>
          <LoamTabBar />
        </div>
      </Section>

      <div style={{ height: 80 }} />
    </div>
  )
}
