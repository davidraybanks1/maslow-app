/* Banned visible-copy strings for the loam 2b redesign (HANDOFF §7).
   Purpose: catch NEW uses of "vibration(s)" and "shapes" being added to
   visible user-facing copy. Existing violations are in KNOWN_VIOLATIONS
   and are removed stage-by-stage. The check fails only if a file NOT in
   the allowlist contains a banned string in a user-facing context.

   Internal kind values (e.g. 'vibration' as a data key), import paths,
   event names, and CSS class names are NOT flagged (decision §0 item 4). */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const SRC = new URL('../src', import.meta.url).pathname

/* Files with known existing violations, cleared stage-by-stage.
   Remove a file from this list when its violations are cleaned up. */
const KNOWN_VIOLATIONS = new Set([
  'components/DeskShell.jsx',
  'components/GlobalComposer.jsx',
  'components/JournalTags.jsx',
  'components/shapes/ShapesFlow.jsx',
  'lib/shapeFacts.js',
  'screens/Log.jsx',
  'screens/Onboarding/OnboardingFlow.jsx',
  'screens/Write.jsx',
])

/* Match visible copy: JSX text node content and string literal button/label text.
   Exclude: import/export lines, event names, comments, file/path strings. */
const VISIBLE_TEXT_PATTERNS = [
  /* JSX text between tags: >…vibration…< */
  { re: />\s*[^<{]*\bvibrations?\b[^<{]*\s*</gi, label: '"vibration" in JSX text' },
  /* JSX text between tags: >…shapes…< */
  { re: />\s*[^<{]*\bshapes\b[^<{]*\s*</gi,       label: '"shapes" in JSX text' },
  /* String literal used as alt text, aria-label, or rendered label (not import paths or event names) */
  { re: /(?:alt|placeholder|title)=["']([^"']*\bvibrations?\b[^"']*)['"]/gi, label: '"vibration" in alt/placeholder/title' },
]

function isImportOrComment(line) {
  const t = line.trim()
  return t.startsWith('import ') || t.startsWith('export ') || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

function walk(dir) {
  const results = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) results.push(...walk(f))
    else if (/\.(jsx|js|tsx|ts)$/.test(e.name)) results.push(f)
  }
  return results
}

const bad = []
for (const file of walk(SRC)) {
  const rel = file.replace(SRC + '/', '')
  if (KNOWN_VIOLATIONS.has(rel)) continue
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (isImportOrComment(line)) return
    for (const { re, label } of VISIBLE_TEXT_PATTERNS) {
      re.lastIndex = 0
      if (re.test(line)) bad.push(`${rel}:${i + 1}  [${label}]  ${line.trim().slice(0, 120)}`)
    }
  })
}

if (bad.length) {
  console.error(`check-banned: ${bad.length} new banned string${bad.length === 1 ? '' : 's'} in visible copy:\n  ` + bad.join('\n  '))
  process.exit(1)
}
console.log('check-banned: no new banned strings in visible copy ✓')
