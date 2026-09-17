/* The type floor, enforced. Reads --type-floor from index.css and fails on
   any literal font-size beneath it, in CSS or in a JSX inline style. Runs
   before every build, so "the app never goes below" is a fact and not a
   hope. */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const SRC = new URL('../src', import.meta.url).pathname
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const f = join(d, e.name)
  return e.isDirectory() ? walk(f) : /\.(css|jsx)$/.test(e.name) ? [f] : []
})

const index = readFileSync(join(SRC, 'index.css'), 'utf8')
const floor = parseFloat((index.match(/--type-floor:\s*([0-9.]+)px/) || [])[1])
if (!floor) { console.error('check-type: --type-floor not found in index.css'); process.exit(1) }

const bad = []
for (const f of walk(SRC)) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g))
      if (parseFloat(m[1]) < floor) bad.push(`${f.replace(SRC, 'src')}:${i + 1}  ${m[0]}`)
    for (const m of line.matchAll(/fontSize:\s*['"]?([0-9.]+)(?:px)?['"]?(?=[,\s}])/g))
      if (parseFloat(m[1]) < floor) bad.push(`${f.replace(SRC, 'src')}:${i + 1}  ${m[0]}`)
  })
}

if (bad.length) {
  console.error(`check-type: ${bad.length} font-size${bad.length === 1 ? '' : 's'} below the ${floor}px floor:\n  ` + bad.join('\n  '))
  process.exit(1)
}
console.log(`check-type: nothing below ${floor}px`)
