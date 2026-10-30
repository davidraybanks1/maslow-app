import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MODES, allNeeds, needName } from '../lib/constants'
import { BAND_LABEL, normalizeBand } from '../lib/frequency'
import { shapeLabel, clip } from '../lib/shapeFacts'
import { loadJournalArchive, toggleJournalFavorite, toggleJournalRevisit, deleteJournalEntry, todayKey } from '../lib/store'
import { useIsDesktop } from '../lib/useIsDesktop'
import { MOOD_PIP_COLOR } from '../components/FrequencyCard'
import EntryText from '../components/EntryText'
import SignedImg from '../components/SignedImg'
import RevisitSheet from '../components/shapes/RevisitSheet'
import styles from './DeskDrafts.module.css'

/* The desktop home for everything you have written: a list you can search and
   narrow, a page to read it on, and a side panel that helps you find your way
   back to older ones (a month of dots, one draft from the past, the ones you
   marked to come back to).

   It reads and changes the same drafts the phone's Drafts screen does. The
   day-by-day log (check-ins, moods, debriefs) is still its own screen, one
   link away. */

const DOW = ['s', 'm', 't', 'w', 't', 'f', 's']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const DEFAULT_ASK = 'what would you tell a friend who wrote this?'

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parse(key) { return new Date(`${key}T12:00:00`) }
function daysBetween(aKey, bKey) { return Math.round((parse(aKey) - parse(bKey)) / 86400000) }
function words(t) { const s = (t || '').trim(); return s ? s.split(/\s+/).length : 0 }
function longDate(key) {
  return parse(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()
}
function shortDate(key) {
  return parse(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

function groupLabel(key, today) {
  const d = daysBetween(today, key)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return 'earlier this week'
  const dt = parse(key)
  const m = MONTHS[dt.getMonth()]
  return dt.getFullYear() === parse(today).getFullYear() ? m : `${m} ${dt.getFullYear()}`
}

export default function DeskDrafts({ state }) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const today = todayKey()

  const [entries, setEntries] = useState(null)
  const [query, setQuery] = useState('')
  const [needF, setNeedF] = useState('')
  const [bandF, setBandF] = useState('')
  const [onlyRevisit, setOnlyRevisit] = useState(false)
  const [onlyFav, setOnlyFav] = useState(false)
  const [dayF, setDayF] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [month, setMonth] = useState(() => { const n = parse(today); return { y: n.getFullYear(), m: n.getMonth() } })
  const [wildSeed, setWildSeed] = useState(0)
  const [revisitFor, setRevisitFor] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const load = useCallback(() => {
    if (!state.userId) return
    loadJournalArchive(state.userId).then(rows => setEntries(rows))
  }, [state.userId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    window.addEventListener('maslow:entry-added', load)
    window.addEventListener('maslow:revisit-changed', load)
    return () => { window.removeEventListener('maslow:entry-added', load); window.removeEventListener('maslow:revisit-changed', load) }
  }, [load])

  const all = entries || []
  const needsUsed = useMemo(() => {
    const ids = new Set(all.map(e => e.need_id).filter(Boolean))
    return allNeeds().filter(n => ids.has(n.id))
  }, [all])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(e => {
      if (q && !(e.entry || '').toLowerCase().includes(q)) return false
      if (needF && e.need_id !== needF) return false
      if (bandF && normalizeBand(e.mood_band) !== bandF) return false
      if (onlyRevisit && !e.revisit) return false
      if (onlyFav && !e.favorite) return false
      if (dayF && e.date_key !== dayF) return false
      return true
    })
  }, [all, query, needF, bandF, onlyRevisit, onlyFav, dayF])

  const groups = useMemo(() => {
    const out = []
    for (const e of filtered) {
      const g = groupLabel(e.date_key, today)
      const last = out[out.length - 1]
      if (last && last.label === g) last.items.push(e)
      else out.push({ label: g, items: [e] })
    }
    return out
  }, [filtered, today])

  const selected = filtered.find(e => e.id === selectedId) || filtered[0] || null
  useEffect(() => { setConfirmDel(false) }, [selected?.id])

  // the month panel
  const dayCounts = useMemo(() => {
    const m = new Map()
    for (const e of all) m.set(e.date_key, (m.get(e.date_key) || 0) + 1)
    return m
  }, [all])
  const cal = useMemo(() => {
    const first = new Date(month.y, month.m, 1)
    const lead = first.getDay()
    const len = new Date(month.y, month.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < lead; i++) cells.push(null)
    for (let d = 1; d <= len; d++) cells.push(keyOf(new Date(month.y, month.m, d)))
    return cells
  }, [month])
  const monthPrefix = `${month.y}-${String(month.m + 1).padStart(2, '0')}`
  const monthEntries = all.filter(e => e.date_key.startsWith(monthPrefix))
  const monthWords = monthEntries.reduce((s, e) => s + words(e.entry), 0)

  // one draft from the past — the same rule the phone uses: old enough, long enough
  const wild = useMemo(() => {
    const pool = all.filter(e => daysBetween(today, e.date_key) >= 7 && (e.entry || '').trim().length >= 20)
    if (!pool.length) return null
    return pool[(wildSeed + Math.floor(pool.length / 3)) % pool.length]
  }, [all, today, wildSeed])
  const comingBack = all.filter(e => e.revisit).slice(0, 4)

  // ── changes ─────────────────────────────────────────────────────────────
  async function toggleFav(e) {
    const next = !e.favorite
    setEntries(prev => prev.map(x => (x.id === e.id ? { ...x, favorite: next } : x)))
    const { error } = await toggleJournalFavorite(e.id, next)
    if (error) setEntries(prev => prev.map(x => (x.id === e.id ? { ...x, favorite: e.favorite } : x)))
  }
  async function applyRevisit(e, on, question) {
    setEntries(prev => prev.map(x => (x.id === e.id ? { ...x, revisit: on, revisit_question: on ? (question || null) : null } : x)))
    const { error } = await toggleJournalRevisit(e.id, on, question)
    if (error) setEntries(prev => prev.map(x => (x.id === e.id ? { ...x, revisit: e.revisit, revisit_question: e.revisit_question } : x)))
    else window.dispatchEvent(new CustomEvent('maslow:revisit-changed'))
  }
  async function remove(e) {
    const { error } = await deleteJournalEntry(e.id, e.image_url)
    if (!error) { setEntries(prev => prev.filter(x => x.id !== e.id)); setConfirmDel(false) }
  }
  function answer(e) {
    navigate('/write', { state: { shape: 'continue', source: e, at: Date.now() } })
  }

  if (!isDesktop) return <Navigate to="/log" replace />

  const needDot = id => (id && state.canvas?.[id] ? MODES[state.canvas[id]]?.pip : null) || 'var(--ink4)'
  const filtersOn = !!(query || needF || bandF || onlyRevisit || onlyFav || dayF)
  function clearFilters() { setQuery(''); setNeedF(''); setBandF(''); setOnlyRevisit(false); setOnlyFav(false); setDayF(null) }

  return (
    <div className={styles.wrap}>
      {/* ── the list ─────────────────────────────────────────────────────── */}
      <section className={styles.list} aria-label="Your drafts">
        <div className={styles.listHead}>
          <h1 className={styles.title}>drafts.</h1>
          <button type="button" className={styles.newBtn} onClick={() => navigate('/write')}>+ new</button>
        </div>
        <input
          id="drafts-search"
          className={styles.search}
          type="search"
          placeholder="search your drafts…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="search your drafts"
        />
        <div className={styles.filters}>
          <select className={`${styles.chipSel} ${needF ? styles.chipSelOn : ''}`} value={needF} onChange={e => setNeedF(e.target.value)} aria-label="filter by need">
            <option value="">need</option>
            {needsUsed.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <select className={`${styles.chipSel} ${bandF ? styles.chipSelOn : ''}`} value={bandF} onChange={e => setBandF(e.target.value)} aria-label="filter by mood">
            <option value="">mood</option>
            {['good', 'mid', 'bad'].map(b => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
          </select>
          <button type="button" className={`${styles.chipBtn} ${onlyRevisit ? styles.chipBtnOn : ''}`} aria-pressed={onlyRevisit} onClick={() => setOnlyRevisit(v => !v)}>revisit</button>
          <button type="button" className={`${styles.chipBtn} ${onlyFav ? styles.chipBtnOn : ''}`} aria-pressed={onlyFav} onClick={() => setOnlyFav(v => !v)}>★ favorites</button>
          {dayF && <button type="button" className={`${styles.chipBtn} ${styles.chipBtnOn}`} onClick={() => setDayF(null)}>{shortDate(dayF)} ×</button>}
        </div>

        <div className={styles.items}>
          {entries === null && <p className={styles.hint}>loading your drafts…</p>}
          {entries !== null && all.length === 0 && (
            <p className={styles.hint}>nothing written yet. <button type="button" className={styles.link} onClick={() => navigate('/write')}>start a page</button></p>
          )}
          {entries !== null && all.length > 0 && filtered.length === 0 && (
            <p className={styles.hint}>nothing matches. <button type="button" className={styles.link} onClick={clearFilters}>clear filters</button></p>
          )}
          {groups.map(g => (
            <div key={g.label}>
              <div className={styles.group}>{g.label}</div>
              {g.items.map(e => {
                const band = normalizeBand(e.mood_band)
                const sh = shapeLabel(e.shape)
                return (
                  <button
                    key={e.id} type="button"
                    className={`${styles.item} ${selected?.id === e.id ? styles.itemOn : ''}`}
                    aria-current={selected?.id === e.id}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <span className={styles.itemText}>{(e.entry || '').trim() || '(photo)'}</span>
                    <span className={styles.itemMeta}>
                      {(e.need_id || e.custom) && <><i className={styles.dot} style={{ background: needDot(e.need_id) }} />{e.need_id ? needName(e.need_id) : e.custom}</>}
                      <span>{e.slot}</span>
                      {band && <i className={styles.pip} style={{ background: MOOD_PIP_COLOR[band] }} title={BAND_LABEL[band]} />}
                      <span>{sh || `${words(e.entry)} words`}</span>
                      {e.favorite && <span className={styles.star} aria-label="favorite">★</span>}
                      {e.revisit && <span className={styles.rv}>revisit{e.revisit_marked_at ? ` ${shortDate(e.revisit_marked_at.slice(0, 10))}` : ''}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ── the page ─────────────────────────────────────────────────────── */}
      <main className={styles.read}>
        {selected ? (
          <article className={styles.sheet} key={selected.id}>
            <div className={styles.readTop}>
              <span className={styles.when}>{longDate(selected.date_key)}</span>
              <span className={styles.spacer} />
              <button type="button" className={`${styles.act} ${selected.favorite ? styles.actOn : ''}`} aria-pressed={!!selected.favorite} onClick={() => toggleFav(selected)}>
                {selected.favorite ? '★ favorite' : '☆ favorite'}
              </button>
              <button
                type="button" className={`${styles.act} ${selected.revisit ? styles.actOn : ''}`} aria-pressed={!!selected.revisit}
                onClick={() => (selected.revisit ? applyRevisit(selected, false) : setRevisitFor(selected))}
              >{selected.revisit ? 'will revisit ✓' : 'mark to revisit'}</button>
            </div>
            <div className={styles.chips}>
              <span className={styles.chip}>{selected.slot}</span>
              {normalizeBand(selected.mood_band) && (
                <span className={styles.chip}><i className={styles.pip} style={{ background: MOOD_PIP_COLOR[normalizeBand(selected.mood_band)] }} />{selected.mood_feeling || BAND_LABEL[normalizeBand(selected.mood_band)]}</span>
              )}
              {selected.need_id && <span className={styles.chip}><i className={styles.dot} style={{ background: needDot(selected.need_id) }} />{needName(selected.need_id)}</span>}
              {selected.custom && <span className={styles.chip}>{selected.custom}</span>}
              {shapeLabel(selected.shape) && <span className={styles.chip}>{shapeLabel(selected.shape)}</span>}
            </div>

            {selected.quoted_text && (
              <blockquote className={styles.quote}>
                <span className={styles.lbl}>↩ you wrote{selected.quoted_date ? ` · ${shortDate(selected.quoted_date)}` : ''}</span>
                {clip(selected.quoted_text, 400)}
              </blockquote>
            )}
            {selected.image_url && <SignedImg src={selected.image_url} alt="" className={styles.photo} />}
            <div className={styles.body}><EntryText text={selected.entry} shape={selected.shape} /></div>

            {selected.revisit && (
              <div className={styles.rq}>
                <span className={styles.lbl}>revisit question</span>
                <p className={styles.q}>{selected.revisit_question || DEFAULT_ASK}</p>
                <button type="button" className={styles.answer} onClick={() => answer(selected)}>answer your earlier self →</button>
              </div>
            )}

            <div className={styles.foot}>
              <span>{words(selected.entry)} words</span>
              {confirmDel ? (
                <span>delete this draft for good?
                  <button type="button" className={styles.link} onClick={() => remove(selected)}>delete</button>
                  <button type="button" className={styles.link} onClick={() => setConfirmDel(false)}>keep</button>
                </span>
              ) : (
                <span>
                  {!selected.revisit && <button type="button" className={styles.link} onClick={() => answer(selected)}>continue this →</button>}
                  <button type="button" className={styles.link} onClick={() => setConfirmDel(true)}>delete</button>
                </span>
              )}
            </div>
          </article>
        ) : (
          <p className={styles.empty}>{entries === null ? '' : 'pick a draft to read it here.'}</p>
        )}
      </main>

      {/* ── the side panel ───────────────────────────────────────────────── */}
      <aside className={styles.side} aria-label="Find your way back">
        <section className={styles.card}>
          <div className={styles.calHead}>
            <button type="button" className={styles.nav} aria-label="previous month" onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>‹</button>
            <span className={styles.calTitle}>{MONTHS[month.m]} {month.y}</span>
            <button type="button" className={styles.nav} aria-label="next month" onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>›</button>
          </div>
          <div className={styles.cal} role="grid">
            {DOW.map((d, i) => <span key={i} className={styles.dow}>{d}</span>)}
            {cal.map((k, i) => k ? (
              <button
                key={k} type="button"
                className={`${styles.day} ${dayCounts.has(k) ? styles.dayHas : ''} ${dayF === k ? styles.dayOn : ''} ${k === today ? styles.dayToday : ''}`}
                disabled={!dayCounts.has(k)}
                aria-pressed={dayF === k}
                aria-label={`${shortDate(k)}${dayCounts.has(k) ? `, ${dayCounts.get(k)} drafts` : ''}`}
                onClick={() => setDayF(d => (d === k ? null : k))}
              >{Number(k.slice(8))}</button>
            ) : <span key={`b${i}`} />)}
          </div>
          <p className={styles.calFoot}>{monthEntries.length} {monthEntries.length === 1 ? 'draft' : 'drafts'} · {monthWords.toLocaleString()} words</p>
        </section>

        {wild && (
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.lbl}>from the past</span>
              <button type="button" className={styles.link0} onClick={() => setWildSeed(s => s + 1)}>another</button>
            </div>
            <button type="button" className={styles.wild} onClick={() => { clearFilters(); setSelectedId(wild.id) }}>
              <span className={styles.wildMeta}>{shortDate(wild.date_key)}{wild.mood_feeling ? ` · ${wild.mood_feeling}` : ''}</span>
              <span className={styles.wildText}>{clip(wild.entry, 150)}</span>
            </button>
          </section>
        )}

        <section className={styles.card}>
          <div className={styles.cardHead}><span className={styles.lbl}>coming back to</span></div>
          {comingBack.length === 0 && <p className={styles.hint0}>nothing marked yet. mark a draft to revisit and it waits here.</p>}
          {comingBack.map(e => (
            <button key={e.id} type="button" className={styles.cb} onClick={() => { clearFilters(); setSelectedId(e.id) }}>
              <span className={styles.cbText}>{clip(e.entry, 70)}</span>
              <span className={styles.cbMeta}>{shortDate(e.date_key)}</span>
            </button>
          ))}
        </section>

        <button type="button" className={styles.logLink} onClick={() => navigate('/log')}>the day-by-day log →</button>
      </aside>

      {revisitFor && (
        <RevisitSheet
          entry={revisitFor.entry}
          onClose={() => setRevisitFor(null)}
          onSave={q => { const e = revisitFor; setRevisitFor(null); applyRevisit(e, true, q) }}
        />
      )}
    </div>
  )
}
