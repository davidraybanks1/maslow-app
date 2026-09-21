import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { NEEDS } from '../lib/constants'
import { currentSlot } from '../lib/slots'
import { todayKey, addJournalEntry, uploadNoteImage, loadCustomTags, loadRevisitQueue } from '../lib/store'
import { normalizeBand } from '../lib/frequency'
import { useIsDesktop } from '../lib/useIsDesktop'
import { getSeenCharts } from '../lib/chartRegistry'
import FrequencyCard, { MOOD_PIP_COLOR } from './FrequencyCard'
// Reuses Today's composer chip/picker/attach/quote styling verbatim so the
// global composer is pixel-identical to the one it replaces there — see
// GlobalComposer.module.css for the sheet/modal chrome that is new here.
import todayStyles from '../screens/Today.module.css'
import styles from './GlobalComposer.module.css'

function formatQuoteDate(dateKey) {
  if (!dateKey) return ''
  const d = new Date(dateKey + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* The sticky "add a draft" entry point — same spot on every screen. Mobile
   gets a floating circle centered above the tab bar; the desktop button
   lives inline in DesktopNav's footer (see DesktopNav.jsx). */
export function ComposerFab({ onClick }) {
  return (
    <button className={styles.fab} onClick={onClick} aria-label="Add a draft">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/* The full draft composer — mood/need/custom tags, photo or quote attach,
   textarea — available from anywhere in the app, always saving to today.
   Extracted out of Today.jsx so the sticky button opens the same thing on
   Today, the Almanac, and Drafts alike. */
export default function GlobalComposer({ state, logMood, open, onClose }) {
  const isDesktop = useIsDesktop()
  const today = todayKey()
  const slot = currentSlot()

  const [draftText, setDraftText] = useState('')
  const [draftNeedId, setDraftNeedId] = useState(null)
  const [draftCustom, setDraftCustom] = useState(null)
  const [draftMoodBand, setDraftMoodBand] = useState(null)
  const [draftMoodFeeling, setDraftMoodFeeling] = useState(null)
  const [draftMoodInherited, setDraftMoodInherited] = useState(true)
  const [draftImage, setDraftImage] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [quotedText, setQuotedText] = useState(null)
  const [quotedDate, setQuotedDate] = useState(null)
  const [quotePicker, setQuotePicker] = useState(false)
  const [quoteEntries, setQuoteEntries] = useState([])
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [needPickerOpen, setNeedPickerOpen] = useState(false)
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const [freqPickerOpen, setFreqPickerOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [customTags, setCustomTags] = useState([])
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  // The one smart, context-aware attach trigger: every chart on the screen
  // behind the composer that's been scrolled past so far (e.g. on the
  // Almanac — the pool only grows as you scroll further down, so by the
  // bottom everything above is still offered) shows up as a row of tappable
  // thumbnails right above the tag chips — not tucked behind the attach
  // menu, since the whole point is that it's something you were just
  // looking at.
  const [chartThumbs, setChartThumbs] = useState([])
  const [chartThumbsLoading, setChartThumbsLoading] = useState(false)
  const [selectedChartId, setSelectedChartId] = useState(null)
  const [attachingChartId, setAttachingChartId] = useState(null)

  const freqPickerNewSlot = useRef(false)
  const fileInputRef = useRef(null)
  const attachMenuRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!open || !state.userId) return
    loadCustomTags(state.userId).then(setCustomTags)
  }, [open, state.userId])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), isDesktop ? 80 : 320)
  }, [open, isDesktop])

  // Offer every chart scrolled past so far on the screen behind the
  // composer, not just whatever's in view the instant it opens — scroll
  // past the first chart and it's offered; scroll past the second and both
  // are offered; by the bottom of the Almanac everything above is still
  // there to pick from. Opening the sheet covers (mobile) or dims (desktop)
  // the screen behind it, so there's no further scrolling to track once
  // it's up — this just snapshots the accumulated pool and captures a
  // thumbnail for each right away so they're ready to tap.
  useEffect(() => {
    if (!open) { setChartThumbs([]); setSelectedChartId(null); return }
    const seen = getSeenCharts()
    if (seen.length === 0) { setChartThumbs([]); return }
    setChartThumbsLoading(true)
    let cancelled = false
    // Chart cards don't paint their own background — it's the paper color
    // behind them — so a capture of just the card, in isolation, otherwise
    // comes back on a plain white canvas.
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#fff'
    Promise.all(seen.map(async c => {
      try {
        const blob = await toBlob(c.node, { pixelRatio: 2, backgroundColor: paper })
        return blob ? { id: c.id, label: c.label, url: URL.createObjectURL(blob), blob } : null
      } catch {
        return null
      }
    })).then(thumbs => {
      if (cancelled) return
      setChartThumbs(thumbs.filter(Boolean))
      setChartThumbsLoading(false)
    })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!attachMenuOpen) return
    function onDown(e) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setAttachMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [attachMenuOpen])

  function resetDraft() {
    setDraftText('')
    setDraftNeedId(null)
    setDraftCustom(null)
    setDraftImage(null)
    setQuotedText(null)
    setQuotedDate(null)
    setSaveError(null)
    setNeedPickerOpen(false)
    setCustomPickerOpen(false)
    setAttachMenuOpen(false)
    setFreqPickerOpen(false)
    setDraftMoodInherited(true)
    setDraftMoodBand(null)
    setDraftMoodFeeling(null)
    chartThumbs.forEach(t => URL.revokeObjectURL(t.url))
    setChartThumbs([])
    setSelectedChartId(null)
  }

  function handleClose() {
    resetDraft()
    onClose()
  }

  const todayMoods = (state.moods || []).filter(m => m.date_key === today)
  const slotMood = todayMoods.find(m => m.prompt_time === slot)
  const inheritedBand = slotMood ? normalizeBand(slotMood.mood) : null
  const inheritedFeeling = slotMood?.feeling || null
  const chipBand = draftMoodInherited ? inheritedBand : draftMoodBand
  const chipFeeling = draftMoodInherited ? inheritedFeeling : draftMoodFeeling
  const activeNeeds = NEEDS.filter(n => state.canvas?.[n.id])

  function openFreqPicker() {
    freqPickerNewSlot.current = !inheritedBand
    setFreqPickerOpen(o => !o)
    setNeedPickerOpen(false)
    setCustomPickerOpen(false)
  }

  async function handleAddEntry() {
    const text = draftText.trim()
    if (!text || !state.userId || saving) return
    setSaving(true)
    const { data, error } = await addJournalEntry(state.userId, today, {
      entry: text,
      slot,
      needId: draftNeedId,
      custom: draftCustom,
      imageUrl: draftImage,
      quotedText,
      quotedDate,
      moodBand: chipBand,
      moodFeeling: chipFeeling,
    })
    setSaving(false)
    if (error) { setSaveError('save failed — try again'); return }
    window.dispatchEvent(new CustomEvent('maslow:entry-added', { detail: { entry: data, dateKey: today } }))
    handleClose()
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const { url } = await uploadNoteImage(state.userId, file)
    if (url) { setDraftImage(url); setSelectedChartId(null) }
    setUploadingImage(false)
    e.target.value = ''
  }

  async function openQuotePicker() {
    setQuotePicker(true)
    if (state.userId) {
      setQuoteLoading(true)
      setQuoteEntries(await loadRevisitQueue(state.userId))
      setQuoteLoading(false)
    }
  }

  async function selectChart(t) {
    if (!state.userId || attachingChartId) return
    setAttachingChartId(t.id)
    const file = new File([t.blob], `chart-${t.id}-${Date.now()}.png`, { type: 'image/png' })
    const { url } = await uploadNoteImage(state.userId, file)
    setAttachingChartId(null)
    if (url) { setDraftImage(url); setSelectedChartId(t.id) }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleAddEntry() }
    if (e.key === 'Escape') { attachMenuOpen ? setAttachMenuOpen(false) : handleClose() }
  }

  function renderAttachControl() {
    const hasPhoto = !!draftImage
    const hasQuote = !!quotedText
    const offerPhoto = !hasPhoto
    const offerQuote = !hasQuote
    const noItems = !offerPhoto && !offerQuote
    return (
      <div className={todayStyles.attachWrap} ref={attachMenuRef}>
        {attachMenuOpen && !noItems && (
          <div className={todayStyles.attachMenu}>
            {offerPhoto && (
              <button className={todayStyles.attachMenuItem} onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false) }}>
                {uploadingImage ? 'uploading…' : 'photo'}
              </button>
            )}
            {offerQuote && (
              <button className={todayStyles.attachMenuItem} onClick={() => { openQuotePicker(); setAttachMenuOpen(false) }}>revisit</button>
            )}
          </div>
        )}
        <button className={todayStyles.attachBtn} onClick={() => !noItems && setAttachMenuOpen(o => !o)} aria-label="attach photo or quote" disabled={noItems}>⊕</button>
        {hasPhoto && (
          <button className={todayStyles.attachChip} onClick={() => { setDraftImage(null); setSelectedChartId(null) }}>
            <img src={draftImage} className={todayStyles.attachThumb} alt="" />×
          </button>
        )}
        {hasQuote && (
          <button className={todayStyles.attachChip} onClick={() => { setQuotedText(null); setQuotedDate(null) }}>
            ↩ {formatQuoteDate(quotedDate)} ×
          </button>
        )}
      </div>
    )
  }

  if (!open) return null

  const body = (
    <>
      {(chartThumbsLoading || chartThumbs.length > 0) && (
        <div className={styles.chartSuggestRow}>
          <span className={styles.chartSuggestLabel}>from the almanac</span>
          <div className={styles.chartSuggestThumbs}>
            {chartThumbsLoading && <span className={styles.chartSuggestLoading}>capturing…</span>}
            {chartThumbs.map(t => (
              <button
                key={t.id}
                className={`${styles.chartThumb}${t.id === selectedChartId ? ` ${styles.chartThumbActive}` : ''}`}
                onClick={() => selectChart(t)}
                disabled={attachingChartId === t.id}
                aria-label={`attach ${t.label}`}
                title={t.label}
              >
                <img src={t.url} alt="" />
                {attachingChartId === t.id && <span className={styles.chartThumbBusy}>…</span>}
                {t.id === selectedChartId && <span className={styles.chartThumbCheck}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={todayStyles.composerChips}>
        <span className={todayStyles.composerSlotChip}>{slot}</span>
        {chipBand ? (
          <button className={todayStyles.composerTagActive} onClick={openFreqPicker}>
            <span className={todayStyles.composerFreqDot} style={draftMoodInherited ? { border: `1.5px solid ${MOOD_PIP_COLOR[chipBand]}` } : { background: MOOD_PIP_COLOR[chipBand] }} />
            {chipFeeling || chipBand}
            {!draftMoodInherited && (
              <span className={todayStyles.composerFreqClear} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDraftMoodInherited(true); setDraftMoodBand(null); setDraftMoodFeeling(null); setFreqPickerOpen(false) }}>×</span>
            )}
          </button>
        ) : (
          <button className={todayStyles.composerTagBtn} onClick={openFreqPicker}>+ vibration</button>
        )}
        {draftNeedId ? (
          <button className={todayStyles.composerTagActive} onClick={() => setDraftNeedId(null)}>{draftNeedId} ×</button>
        ) : (
          <button className={todayStyles.composerTagBtn} onClick={() => { setNeedPickerOpen(o => !o); setCustomPickerOpen(false); setFreqPickerOpen(false) }}>+ need</button>
        )}
        {customTags.length > 0 && (draftCustom ? (
          <button className={todayStyles.composerTagActive} onClick={() => setDraftCustom(null)}>{draftCustom} ×</button>
        ) : (
          <button className={todayStyles.composerTagBtn} onClick={() => { setCustomPickerOpen(o => !o); setNeedPickerOpen(false); setFreqPickerOpen(false) }}>+ custom</button>
        ))}
      </div>

      {freqPickerOpen && (
        <div className={todayStyles.composerFreqPicker}>
          <FrequencyCard
            initialBand={chipBand}
            initialFeeling={chipFeeling}
            compact
            onSettle={(band, feeling) => {
              setDraftMoodBand(band)
              setDraftMoodFeeling(feeling || null)
              setDraftMoodInherited(false)
              if (feeling) setFreqPickerOpen(false)
              if (freqPickerNewSlot.current) logMood?.(state.userId, slot, band, null, today, feeling || null)
            }}
          />
        </div>
      )}
      {needPickerOpen && activeNeeds.length > 0 && (
        <div className={todayStyles.composerPicker}>
          {activeNeeds.map(n => (
            <button key={n.id} className={todayStyles.composerPickerItem} onClick={() => { setDraftNeedId(n.id); setNeedPickerOpen(false) }}>{n.name}</button>
          ))}
        </div>
      )}
      {customPickerOpen && customTags.length > 0 && (
        <div className={todayStyles.composerPicker}>
          {customTags.map(t => (
            <button key={t.id} className={todayStyles.composerPickerItem} onClick={() => { setDraftCustom(t.label); setCustomPickerOpen(false) }}>{t.label}</button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className={todayStyles.journalInput}
        placeholder="what's on your mind?"
        value={draftText}
        onChange={e => setDraftText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
      />
      <div className={todayStyles.composerMobileFooter}>
        {renderAttachControl()}
        <button className={todayStyles.composerCancelBtn} onClick={handleClose}>cancel</button>
        <button className={todayStyles.journalAddBtn} onClick={handleAddEntry} disabled={!draftText.trim() || saving}>add</button>
      </div>
      {saveError && <div className={todayStyles.journalSaveError}>{saveError}</div>}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} />

      {quotePicker && (
        <div className={todayStyles.quotePicker} onClick={() => setQuotePicker(false)}>
          <div className={todayStyles.quotePickerPanel} onClick={e => e.stopPropagation()}>
            <div className={todayStyles.quotePickerHeader}>
              <span className={todayStyles.quotePickerTitle}>revisit queue</span>
              <button className={todayStyles.quotePickerClose} onClick={() => setQuotePicker(false)}>×</button>
            </div>
            <div className={todayStyles.quotePickerList}>
              {quoteLoading && <div className={todayStyles.quotePickerEmpty}>loading…</div>}
              {!quoteLoading && quoteEntries.length === 0 && (
                <div className={todayStyles.quotePickerEmpty}>mark entries ↩ on Reflect to queue them here</div>
              )}
              {!quoteLoading && quoteEntries.map(e => (
                <button key={e.id} className={todayStyles.quotePickerItem} onClick={() => { setQuotedText(e.entry); setQuotedDate(e.date_key); setQuotePicker(false) }}>
                  <span className={todayStyles.quotePickerItemDate}>{formatQuoteDate(e.date_key)}</span>
                  <span className={todayStyles.quotePickerItemText}>{(e.entry || '').length > 120 ? (e.entry || '').slice(0, 120) + '…' : (e.entry || '')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (isDesktop) {
    return (
      <div className={styles.deskScrim} onClick={handleClose}>
        <div className={styles.deskSheet} onClick={e => e.stopPropagation()}>
          <div className={styles.sheetHead}>
            <span className={styles.sheetDate}>new draft · today</span>
            <button className={styles.sheetClose} onClick={handleClose} aria-label="close">✕</button>
          </div>
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.mobileScrim} onClick={handleClose}>
      <div className={styles.mobileSheet} onClick={e => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <span className={styles.sheetDate}>new draft · today</span>
          <button className={styles.sheetClose} onClick={handleClose} aria-label="close">✕</button>
        </div>
        {body}
      </div>
    </div>
  )
}
