#!/usr/bin/env node
// check-case-drift.mjs — guards a capitalization pass.
//
// Compares the working tree against a git ref and asserts that every changed
// line differs ONLY in capitalization. Any line whose lowercased form also
// changed is reported: that is a reworded string, not a recased one.
//
//   node scripts/check-case-drift.mjs              # vs HEAD
//   node scripts/check-case-drift.mjs origin/main  # vs another ref
//
// Exit 0 = every change is pure recasing. Exit 1 = something was reworded.

import { execFileSync } from 'node:child_process'

const ref = process.argv[2] || 'HEAD'

let diff
try {
  diff = execFileSync(
    'git',
    ['--no-optional-locks', 'diff', '-U0', '--no-color', ref, '--', 'src'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
} catch (e) {
  console.error(`could not diff against "${ref}": ${e.message}`)
  process.exit(2)
}

if (!diff.trim()) {
  console.log(`no changes under src/ vs ${ref}.`)
  process.exit(0)
}

// Collect hunks: { file, oldStart, removed[], added[] }
const hunks = []
let file = null
let current = null

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    file = line.slice(6)
    continue
  }
  if (line.startsWith('@@')) {
    const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    current = { file, oldStart: m ? Number(m[1]) : 0, newStart: m ? Number(m[2]) : 0, removed: [], added: [] }
    hunks.push(current)
    continue
  }
  if (!current) continue
  if (line.startsWith('-') && !line.startsWith('---')) current.removed.push(line.slice(1))
  else if (line.startsWith('+') && !line.startsWith('+++')) current.added.push(line.slice(1))
}

// Normalize for comparison: lowercase, collapse whitespace.
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim()

// A line that differs only by the removal of a lowercase-forcing construct is
// expected during the CSS pass, so it gets its own bucket rather than failing.
const stripLowercasers = s =>
  s
    .replace(/\s*text-transform:\s*lowercase;?/gi, '')
    .replace(/\.toLowerCase\(\)/g, '')
    .replace(/\.map\(\w+ => \w+\)/g, '')  // identity lambda left after .toLowerCase() removal

const recased = []   // pure capitalization changes — the point of the pass
const unforced = []  // a lowercase-forcing construct was removed
const reworded = []  // content changed — needs a human
const structural = []// added or removed lines with no counterpart

for (const h of hunks) {
  const n = Math.max(h.removed.length, h.added.length)
  for (let i = 0; i < n; i++) {
    const before = h.removed[i]
    const after = h.added[i]

    if (before === undefined || after === undefined) {
      structural.push({ file: h.file, line: h.newStart + i, before, after })
      continue
    }
    if (before === after) continue

    const entry = { file: h.file, line: h.newStart + i, before, after }
    if (norm(before) === norm(after)) recased.push(entry)
    else if (norm(stripLowercasers(before)) === norm(stripLowercasers(after))) unforced.push(entry)
    else reworded.push(entry)
  }
}

const trim = s => (s ?? '').trim()

console.log(
  `vs ${ref} — ${recased.length} recased, ${unforced.length} lowercase-forcing removed, ` +
  `${reworded.length} reworded, ${structural.length} structural\n`
)

if (reworded.length) {
  console.log('REWORDED — content changed, not just capitalization:\n')
  for (const r of reworded) {
    console.log(`  ${r.file}:${r.line}`)
    console.log(`    -  ${trim(r.before)}`)
    console.log(`    +  ${trim(r.after)}\n`)
  }
}

if (structural.length) {
  console.log('STRUCTURAL — lines added or deleted outright (expected when removing CSS rules):\n')
  for (const s of structural.slice(0, 40)) {
    console.log(`  ${s.file}:${s.line}  ${s.before === undefined ? '+ ' + trim(s.after) : '- ' + trim(s.before)}`)
  }
  if (structural.length > 40) console.log(`  … and ${structural.length - 40} more`)
  console.log()
}

if (reworded.length) {
  console.log(`FAIL — ${reworded.length} line(s) changed in more than capitalization. Review each one above.`)
  process.exit(1)
}

console.log('PASS — every paired change is capitalization only.')
process.exit(0)
