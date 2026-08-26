import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const SRC = new URL('../src', import.meta.url).pathname

function walk(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else if (entry.name.endsWith('.css')) results.push(full)
  }
  return results
}

const files = walk(SRC)

const defined = new Set()
const refs = new Map() // token -> [file, ...]

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  // Definitions: --token-name:
  for (const [, name] of text.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
    defined.add(name)
  }
}

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  // References: var(--token-name)
  for (const [, name] of text.matchAll(/var\(--([a-zA-Z0-9_-]+)\)/g)) {
    if (!refs.has(name)) refs.set(name, [])
    refs.get(name).push(file.replace(SRC + '/', ''))
  }
}

const undefined_tokens = []
for (const [token, usages] of refs) {
  if (!defined.has(token)) {
    undefined_tokens.push({ token, usages: [...new Set(usages)] })
  }
}

if (undefined_tokens.length === 0) {
  console.log('check:css — all var() tokens are defined ✓')
  process.exit(0)
} else {
  console.error('check:css — undefined CSS custom properties:')
  for (const { token, usages } of undefined_tokens) {
    console.error(`  --${token}`)
    for (const f of usages) console.error(`    ${f}`)
  }
  process.exit(1)
}
