import { useEffect, useRef, useState } from 'react'
import styles from '../Flow.module.css'
import ScreenLayout from '../ScreenLayout'
import Typed, { typingMs, REDUCED_MOTION } from '../Typed'
import useTimeline from '../useTimeline'
import BloomAnim from '../bloomAnim'

const HEAD = 'Loam is built on two hypotheses:'
const NUM1 = '1.'
const A1 = 'Anxiety fills the space we give it.'
const B1 = 'And we can give it less.'
const NUM2 = '2.'
const A2 = 'Our realities are defined by the stories we tell ourselves.'
const B2 = 'And we can edit them.'

const FILLS = { exploration: 0.55, appreciation: 0.7, nourishment: 0.55, survival: 0.5 }
const PAUSE = 1000 // the cursor blinks alone after "1." before the sentence

// The abstract draft field: rounded bars standing in for words. Each group is
// written left to right; "seg" is the stretch that gets redlined and "rep" is
// what's written over it.
const GROUPS = {
  pre:   [26, 36],
  seg:   [36, 28, 44],
  rep:   [32, 42],
  line2: [46, 30, 58],
}

// Beat by beat:
//   1. the lead-in line writes on
//   2. hypothesis 1, first half
//   3. the bloom (Today's, all black) pops up below
//   4. hypothesis 1, second half; the instant it finishes the bloom fills with color
//   5. the bloom clears; hypothesis 2 arrives with a draft field that "writes"
//      itself, a redline lands as "And we can edit them." finishes, and
//      the replacement is written
//   6. the arrow
export default function HypothesesScreen({ onNext }) {
  const at = useTimeline()
  const bloomHost = useRef(null)
  const bloom = useRef(null)
  const bars = useRef({})
  const [b, setB] = useState(REDUCED_MOTION
    ? { head: true, one: true, partB: true, two: true, partB2: true, bloomOut: true, draft: true, redline: true, arrow: true }
    : {})
  const set = patch => setB(prev => ({ ...prev, ...patch }))

  // The bloom lives outside React's tree: built into a host div once, torn
  // down with the screen.
  useEffect(() => {
    const host = bloomHost.current
    bloom.current = BloomAnim.create(host, 'hyp')
    if (REDUCED_MOTION) {
      bloom.current.showFinal(FILLS)
      Object.keys(bars.current).forEach(k => {
        const el = bars.current[k]
        if (el) { el.style.width = el.dataset.w + 'px'; el.classList.add(styles.hypBarW) }
      })
    }
    return () => { bloom.current = null; host.innerHTML = '' }
  }, [])

  useEffect(() => {
    if (REDUCED_MOTION) return

    // The caret rides the leading edge of whichever bar is being written.
    let carriedBy = null
    function moveCaret(el) {
      if (carriedBy) carriedBy.classList.remove(styles.hypBarCur)
      carriedBy = el
      if (el) el.classList.add(styles.hypBarCur)
    }

    // Writes a group's bars one after another.
    function writeGroup(group, done) {
      const els = GROUPS[group].map((_, i) => bars.current[`${group}${i}`])
      let i = 0
      function next() {
        if (i >= els.length) { if (done) done(); return }
        const el = els[i++]
        const w = Number(el.dataset.w)
        const ms = Math.round(w * 2.2)
        moveCaret(el)
        el.style.setProperty('--bw', `${ms}ms`)
        el.style.width = `${w}px`
        el.classList.add(styles.hypBarW)
        at(ms + 15, next)
      }
      next()
    }
    function writeAll(groups, done) {
      let k = 0
      ;(function nextGroup() {
        if (k >= groups.length) { if (done) done(); return }
        writeGroup(groups[k++], nextGroup)
      })()
    }

    // beat 1: lead-in (waits out the screen transition)
    at(620, () => set({ head: true }))
    // beat 2: hypothesis 1, first half: "1.", a pause with the cursor blinking, then the sentence
    at(2000, () => set({ one: true }))
    const S = PAUSE + 250
    // beat 3: the bloom pops up, all black
    at(3500 + S, () => bloom.current && bloom.current.popIn(85))
    // beat 4: hypothesis 1, second half
    at(5500 + S, () => {
      set({ partB: true })
      const dB = typingMs(B1)
      // color starts to populate the bloom right after the line finishes typing
      at(dB + 150, () => {
        const litMs = bloom.current ? bloom.current.lightTo(FILLS, 85, () => !bloom.current) : 0
        const T = litMs + 600 // let the finished bloom breathe
        // beat 5: the bloom clears away
        at(T, () => set({ bloomOut: true }))
        // beat 6: hypothesis 2, first half
        at(T + 800, () => set({ two: true }))
        // beat 7: the draft field takes the bloom's place
        at(T + 2500, () => set({ draft: true }))
        // beat 8: text is written out (as abstract bars, not readable words)
        at(T + 3500, () => {
          writeAll(['pre', 'seg', 'line2'], () => {
            // beat 9: hypothesis 2, second half
            at(700, () => {
              set({ partB2: true })
              const d = typingMs(B2)
              // beat 10: the redline lands the instant the line finishes typing,
              // then the replacement is written
              at(d, () => set({ redline: true }))
              at(d + 1200, () => {
                writeAll(['rep'], () => at(900, () => { moveCaret(null); set({ arrow: true }) }))
              })
            })
          })
        })
      })
    })
  }, [at])

  const bar = (group, i) => (
    <span key={`${group}${i}`} className={styles.hypBar} data-w={GROUPS[group][i]} ref={el => { bars.current[`${group}${i}`] = el }} />
  )

  return (
    <ScreenLayout cta={{ arrow: true, hidden: !b.arrow, onClick: onNext }}>
      <div className={`${styles.cardStage} ${styles.introStage}`}>
        <div className={`${styles.hypHalf} ${styles.hypTop}`}>
          <Typed as="div" className={styles.hypHead} text={HEAD} run={!!b.head} />
          <div className={styles.hypItem}>
            <Typed className={styles.hookListNum} text={NUM1} run={!!b.one} hold={PAUSE} />
            <span>
              <Typed text={A1} run={!!b.one} delay={typingMs(NUM1) + PAUSE} />
              <Typed className={styles.hypPartB} text={B1} run={!!b.partB} />
            </span>
          </div>
          <div className={styles.hypItem}>
            <Typed className={styles.hookListNum} text={NUM2} run={!!b.two} />
            <span>
              <Typed text={A2} run={!!b.two} delay={60} />
              <Typed className={styles.hypPartB} text={B2} run={!!b.partB2} />
            </span>
          </div>
        </div>

        <div className={`${styles.hypHalf} ${styles.hypBottom}`}>
          <div ref={bloomHost} className={`${styles.hypBloom}${b.bloomOut ? ` ${styles.hypBloomOut}` : ''}`} aria-hidden="true" />
          <div className={`${styles.hypDraft}${b.draft ? ` ${styles.hypDraftOn}` : ''}`} aria-hidden="true">
            <div className={styles.hypDraftLabel}><span className={styles.draftEchoDot} />draft</div>
            <div className={styles.hypLines}>
              <div className={styles.hypLine}>
                <span className={styles.hypGroup}>{GROUPS.pre.map((_, i) => bar('pre', i))}</span>
                <span className={`${styles.hypSeg}${b.redline ? ` ${styles.hypSegOn}` : ''}`}>{GROUPS.seg.map((_, i) => bar('seg', i))}</span>
                <span className={styles.hypGroup}>{GROUPS.rep.map((_, i) => bar('rep', i))}</span>
              </div>
              <div className={styles.hypLine}>{GROUPS.line2.map((_, i) => bar('line2', i))}</div>
            </div>
          </div>
        </div>
      </div>
    </ScreenLayout>
  )
}
