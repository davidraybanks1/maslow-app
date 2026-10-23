import styles from './EntryText.module.css'

// Entries written in one of the writing spaces are saved as plain text with the
// space's own lines in front. When one is shown, those lines are set off from
// what the person wrote, so the prompt reads as the prompt and the rest as the
// answer. Each part is its own block (a display:block span, which is safe
// inside the <p> and <button> some screens wrap this in), so it reads the same
// whether or not the surrounding box keeps line breaks. Anything that is not
// one of these shapes is returned untouched.
//
//   one_thing     "gave me energy: <need>" / "took it:" / "tomorrow:" prompts
//   three_truths  "Three things that were true: A · B · C." then a blank line
//   tension       "Two things pulling at me: A — and B." then a blank line

const KEYS = [
  { label: 'gave me energy:', re: /^(gave me energy:)(.*)$/i, color: 'var(--nour)' },
  { label: 'took it:', re: /^(took it:)(.*)$/i, color: 'var(--survival)' },
  { label: 'tomorrow:', re: /^(tomorrow:)(.*)$/i, color: 'var(--exploration)' },
]

function Key({ label, color }) {
  return <span className={styles.key} style={{ '--c': color }}>{label}</span>
}

// everything after the first line, without the blank lines that follow the lead
function afterLead(lines) {
  return lines.slice(1).join('\n').replace(/^\s*\n/, '').trim()
}

function gaveAndTook(text) {
  const sections = []
  let cur = null
  let hasKey = false
  String(text).split('\n').forEach(line => {
    const t = line.trim()
    const hit = KEYS.map(k => ({ k, m: t.match(k.re) })).find(x => x.m)
    if (hit) {
      hasKey = true
      cur = { key: hit.k, rest: hit.m[2].trim(), lines: [] }
      sections.push(cur)
      return
    }
    if (!cur) { cur = { key: null, rest: '', lines: [] }; sections.push(cur) }
    cur.lines.push(line)
  })
  if (!hasKey) return text
  return sections.map((s, i) => {
    const body = s.lines.join('\n').replace(/^\s*\n+/, '').trim()
    return (
      <span key={i} className={styles.sec}>
        {s.key && (
          <span className={styles.head}>
            <Key label={s.key.label} color={s.key.color} />
            {s.rest ? ' ' + s.rest : ''}
          </span>
        )}
        {body && <span className={styles.ans}>{body}</span>}
      </span>
    )
  })
}

// a prompt block: the key, then each fact on its own line behind a small dot
function Facts({ label, facts }) {
  return (
    <span className={styles.sec}>
      <span className={styles.head}><Key label={label} color="var(--ink4)" /></span>
      {facts.map((f, i) => <span key={i} className={styles.fact}>{f}</span>)}
    </span>
  )
}

function withLead(lead, rest) {
  return (
    <>
      {lead}
      {rest && <span className={`${styles.sec} ${styles.ans}`}>{rest}</span>}
    </>
  )
}

function threeTruths(text) {
  const lines = String(text).split('\n')
  const m = lines[0].trim().match(/^Three things that were true:\s*(.+?)\.?$/i)
  if (!m) return text
  const facts = m[1].split(' · ').map(s => s.trim()).filter(Boolean)
  return withLead(<Facts label="three things that were true:" facts={facts} />, afterLead(lines))
}

function tension(text) {
  const lines = String(text).split('\n')
  const m = lines[0].trim().match(/^Two things pulling at me:\s*(.+?)\s+—\s+and\s+(.+?)\.?$/i)
  if (!m) return text
  return withLead(<Facts label="two things pulling at me:" facts={[m[1].trim(), m[2].trim()]} />, afterLead(lines))
}

export default function EntryText({ text, shape }) {
  if (!text) return text
  if (shape === 'one_thing') return gaveAndTook(text)
  if (shape === 'three_truths') return threeTruths(text)
  if (shape === 'tension') return tension(text)
  return text
}
