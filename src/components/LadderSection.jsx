import { useMemo, useState } from 'react'
import { buildLadder, tierCounts, oneIn, TIER_COPY } from '../lib/ladder'
import { MODE_ORDER, MODE_DESCS } from '../lib/constants'
import styles from './LadderSection.module.css'

const LABEL = {
  significant: 'significant', close: 'close', testing: 'worth testing',
  quiet: 'quiet so far', new: 'too new',
}
const LEVELS = [
  { v: 'significant', label: 'significant only', shows: ['significant'] },
  { v: 'close', label: 'and close', shows: ['significant', 'close'] },
  { v: 'testing', label: 'and worth testing', shows: ['significant', 'close', 'testing'] },
]
const UP = ['#3FA87A', '#07301F']
const DOWN = ['#FF8A66', '#A81F06']
const LO = 40, HI = 92
const pos = v => Math.max(0, Math.min(100, ((v - LO) / (HI - LO)) * 100))

/** The mark carries the tier: filled when significant, half lit when close,
 *  a ring when it is only worth testing, faint when it is not. */
function orbStyle(node, lit) {
  const up = (node.gap || 0) >= 0
  const ramp = up ? UP : DOWN
  const ink = up ? '#0C5038' : '#A8290A'
  if (node.tier === 'new') return { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.16)', opacity: 0.55 }
  if (!lit) return { boxShadow: 'inset 0 0 0 1.3px rgba(0,0,0,.18)' }
  if (node.tier === 'significant') return { background: `radial-gradient(circle at 34% 26%,${ramp[0]},${ramp[1]})` }
  if (node.tier === 'close') return {
    background: `linear-gradient(90deg,${ramp[0]} 0 50%,transparent 50% 100%)`,
    boxShadow: `inset 0 0 0 1.4px ${ink}`,
  }
  return { boxShadow: `inset 0 0 0 1.4px ${ink}`, opacity: 0.85 }
}
function stemVars(node, lit) {
  if (node.tier === 'significant') return { '--stem': 'linear-gradient(180deg,#3FA87A,#0C5038)', '--sw': '2.4px' }
  if (node.tier === 'close' && lit) return { '--stem': 'rgba(12,80,56,.48)', '--sw': '1.7px' }
  if (lit) return { '--stem': 'rgba(12,80,56,.26)', '--sw': '1.2px' }
  return { '--stem': 'rgba(0,0,0,.11)', '--sw': '1px' }
}

function Row({ node, depth, lit, isLit, open, said, onToggle }) {
  const up = (node.gap || 0) >= 0
  const ink = lit ? (up ? '#0C5038' : '#A8290A') : 'rgba(0,0,0,.26)'
  const ramp = up ? UP : DOWN
  const kids = node.children || []
  const isNew = node.tier === 'new'
  const a = isNew ? 0 : pos(node.lo), b = isNew ? 0 : pos(node.hi)
  const sibs = Math.round(0.05 / node.floor)

  return (
    <div className={`${styles.node} ${styles[`node${depth}`]}`} style={stemVars(node, lit)}>
      <button
        className={`${styles.row}${isNew ? ` ${styles.rowNew}` : ''}`}
        type="button" disabled={isNew} onClick={() => onToggle(node)}
      >
        <span className={styles.orb} style={orbStyle(node, lit)} />
        <span className={styles.name}>{node.name}</span>
        {isNew ? (
          <>
            <span className={styles.days}>{node.days} days · too new</span>
            <span className={styles.slope} />
            <span className={styles.gap} />
          </>
        ) : (
          <>
            <span className={styles.days}>{node.days}d</span>
            <span className={styles.slope}>
              <span className={styles.slopeTrack} />
              <span className={styles.slopeRun} style={{
                left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%`,
                background: lit ? `linear-gradient(90deg,${ramp[0]},${ramp[1]})` : 'rgba(0,0,0,.16)',
              }} />
              <span className={styles.slopeDot} style={{ left: `${a}%`, background: 'rgba(0,0,0,.18)' }} />
              <span className={styles.slopeDot} style={{
                left: `${b}%`,
                background: lit ? `radial-gradient(circle at 34% 26%,${ramp[0]},${ramp[1]})` : ink,
                boxShadow: node.tier === 'significant' ? '0 0 0 2.5px var(--paper)' : undefined,
              }} />
            </span>
            <span className={styles.gap} style={{ color: ink }}>
              {up ? '+' : '−'}{Math.abs(Math.round(node.gap))}
            </span>
          </>
        )}
        <span className={styles.caret}>{kids.length ? '›' : ''}</span>
      </button>

      {said && !isNew && (
        <p className={styles.why}>
          <b>{up ? '+' : '−'}{Math.abs(Math.round(node.gap))} points</b>, somewhere between{' '}
          {node.ci[0] >= 0 ? '+' : '−'}{Math.abs(node.ci[0])} and {node.ci[1] >= 0 ? '+' : '−'}{Math.abs(node.ci[1])}{' '}
          on {node.days} days of evidence. Luck alone would do this <b>{oneIn(node.p)}</b>; against{' '}
          {sibs} sibling{sibs === 1 ? '' : 's'} it has to beat <b>{oneIn(node.floor)}</b>.
          <br />
          <span className={styles.whyTier}>{LABEL[node.tier]}</span> — {TIER_COPY[node.tier]}.
        </p>
      )}

      {open && kids.length > 0 && (
        <div className={styles.kids}>
          {!lit && (
            <p className={styles.stop}>
              This row sits below the line you have set. What follows is here because you opened
              it — description, not a finding.
            </p>
          )}
          {kids.map(k => (
            <LadderNode
              key={`${k.kind}-${k.name}`} node={k} depth={depth + 1} isLit={isLit}
              startOpen={k.tier === 'significant'}
              startSaid={k.tier === 'significant' && !(k.children || []).some(g => g.tier === 'significant')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Own its own open/said state so a tap reveals the reasoning, not just the branch. */
function LadderNode({ node, depth, isLit, startOpen = false, startSaid = false }) {
  const [open, setOpen] = useState(startOpen)
  const [said, setSaid] = useState(startSaid)
  const toggle = () => { const next = !open; setOpen(next); setSaid(next) }
  return (
    <Row node={node} depth={depth} lit={isLit(node)} isLit={isLit}
      open={open} said={said} onToggle={toggle} />
  )
}

export default function LadderSection({ canvas, checkins, moods, practicesDB }) {
  const [level, setLevel] = useState('testing')
  const tree = useMemo(
    () => buildLadder({ canvas, checkins, moods, practicesDB, modeOrder: MODE_ORDER }),
    [canvas, checkins, moods, practicesDB]
  )
  if (!tree.length) return null

  const shows = LEVELS.find(l => l.v === level).shows
  const isLit = node => shows.includes(node.tier)
  const counts = tierCounts(tree)
  const litCount = shows.reduce((s, t) => s + counts[t], 0)

  // the deepest surviving rung is the headline, and the mode it hangs off is the claim
  const top = tree[0]
  const bestNeed = (top.children || []).find(n => n.tier === 'significant')
  const hero = bestNeed || (top.tier === 'significant' ? top : null)
  const nSig = counts.significant

  return (
    <section className={styles.section}>
      <div className={styles.pad}>
        <h2 className={styles.title}>What carries it</h2>
        <p className={styles.sub}>{top.days + top.off} days · mode, then need, then practice</p>

        {hero ? (
          <>
            <p className={styles.claim}>
              {tree.filter(m => m.tier !== 'significant').length} of your {tree.length} modes stop at
              the first rung. <em>{top.name} keeps going</em>
              {bestNeed ? <> — and it keeps going through {(top.children || []).filter(n => n.tier === 'significant').length === 1 ? 'exactly one need' : 'more than one'}.</> : '.'}
            </p>
            <div className={styles.hero}>
              <span className={styles.heroBig}>
                +{Math.round(hero.gap)}<i>pts</i>
              </span>
              <span className={styles.heroCap}>
                more of your check-ins came out good on the <b>{hero.days} days</b> you met{' '}
                {hero.name} than on the <b>{hero.off}</b> you didn&rsquo;t. Luck would do that about{' '}
                <b>{oneIn(hero.p)}</b>.
              </span>
            </div>
          </>
        ) : (
          <p className={styles.claim}>
            Nothing has separated yet. Keep logging — the ladder needs a couple of months before it
            can tell a real difference from a run of luck.
          </p>
        )}
      </div>

      <div className={styles.tree}>
        {tree.map((n, i) => (
          <LadderNode
            key={n.name} node={n} depth={0} isLit={isLit}
            startOpen={i === 0 || n.tier === 'significant'}
            startSaid={n.tier === 'significant' && !(n.children || []).some(k => k.tier === 'significant')}
          />
        ))}
      </div>

      <div className={styles.pad}>
        <div className={styles.levels}>
          {LEVELS.map(l => (
            <button
              key={l.v} type="button" aria-pressed={level === l.v}
              className={`${styles.level}${level === l.v ? ` ${styles.levelOn}` : ''}`}
              onClick={() => setLevel(l.v)}
            >{l.label}</button>
          ))}
        </div>
        <p className={styles.lvlNote}>
          <b>{litCount} of {counts.total}</b> rows lit ·{' '}
          {level === 'significant' ? 'only what survives its correction'
            : level === 'close' ? 'plus what would count on its own'
            : 'plus every gap of ten points or more — the ones to experiment on'}
        </p>
        <div className={styles.key}>
          {['significant', 'close', 'testing', 'quiet', 'new'].map(t => (
            <span key={t}>
              <i style={orbStyle({ tier: t, gap: 1 }, t !== 'quiet' && t !== 'new')} />
              {LABEL[t]}
            </span>
          ))}
        </div>
      </div>

      {hero && bestNeed && (
        <div className={styles.verdict}>
          <span className={styles.verdictLabel}>what the ladder says to do</span>
          <p className={styles.verdictHead}>
            Move {bestNeed.name} out of {top.name}. It is the only need whose presence changes your
            day, and you have it filed under <em>{MODE_DESCS[top.name]}</em>.
          </p>
          <p className={styles.verdictBody}>
            Luck would produce {top.name}&rsquo;s gap about <b>{oneIn(top.p)}</b> and{' '}
            {bestNeed.name}&rsquo;s about <b>{oneIn(bestNeed.p)}</b>. The other needs in the same
            mode are quiet, so it is not {top.name} that matters — <b>it is {bestNeed.name}</b>.
          </p>
        </div>
      )}
    </section>
  )
}
