import styles from './EntryText.module.css'

// "gave and took" entries are saved as plain text with the prompts as lines
// ("gave me energy: <need>", "took it:", "tomorrow:"). When one is shown, the
// prompts are set off in mono with the colour of their step in the flow, so
// they read as the questions and the rest as the answers. Anything else is
// returned untouched.
const KEYS = [
  { re: /^(gave me energy:)(.*)$/i, color: 'var(--nour)' },
  { re: /^(took it:)(.*)$/i, color: 'var(--survival)' },
  { re: /^(tomorrow:)(.*)$/i, color: 'var(--exploration)' },
]

export default function EntryText({ text, shape }) {
  if (shape !== 'one_thing' || !text) return text
  const lines = String(text).split('\n')
  const out = []
  let afterKey = false
  lines.forEach((line, i) => {
    const t = line.trim()
    // older entries have a blank line after the first prompt; drop it so all three match
    if (afterKey && !t) { afterKey = false; return }
    afterKey = false
    if (out.length) out.push('\n')
    const hit = KEYS.map(k => ({ k, m: t.match(k.re) })).find(x => x.m)
    if (!hit) { out.push(line); return }
    out.push(<span key={i} className={styles.key} style={{ '--c': hit.k.color }}>{hit.m[1]}</span>)
    if (hit.m[2].trim()) out.push(' ' + hit.m[2].trim())
    else afterKey = true
  })
  return out
}
