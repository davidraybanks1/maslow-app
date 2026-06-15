import { useState, useEffect } from 'react'
import { loadDebriefs, loadDebriefTypes, saveDebriefType, deleteDebriefType } from '../lib/store'
import {
  BUILTIN_NATURE_TYPES,
  BUILTIN_ENVIRONMENT_TYPES,
  ENVIRONMENT_TAG_STYLE,
  CUSTOM_TYPE_SWATCHES,
  natureTagStyle,
} from '../lib/debriefTypes'
import DebriefForm from '../components/DebriefForm'
import styles from './Debriefs.module.css'

const SECTION_LABELS = ['1. NAME IT', '2. FEEL IT', '3. EXAMINE IT', '4. RECLAIM IT']

function formatEpisodeDate(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
}

function formatFullDate(dateKey) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()
}

function groupByMonth(debriefs) {
  const groups = []
  let current = null
  for (const d of debriefs) {
    const label = new Date(d.date_key + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
    if (!current || current.label !== label) {
      current = { label, items: [] }
      groups.push(current)
    }
    current.items.push(d)
  }
  return groups
}

function splitEntry(entry) {
  const parts = (entry || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const sections = ['', '', '', '']
  for (let i = 0; i < Math.min(parts.length, 3); i++) sections[i] = parts[i]
  if (parts.length > 3) sections[3] = parts.slice(3).join('\n\n')
  return sections
}

function DetailOverlay({ debrief, debriefTypes, onClose }) {
  const sections = splitEntry(debrief.entry)
  return (
    <div className={styles.overlay}>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={onClose}>← debriefs</button>
        <div className={styles.overlayTags}>
          <span className={styles.tag} style={natureTagStyle(debrief.nature, debriefTypes.nature)}>{debrief.nature}</span>
          <span className={styles.tag} style={ENVIRONMENT_TAG_STYLE}>{debrief.environment}</span>
        </div>
      </div>
      <div className={styles.overlayContent}>
        <div className={styles.detailDate}>{formatFullDate(debrief.date_key)}</div>
        {SECTION_LABELS.map((label, i) => (
          <div key={label}>
            {i > 0 && <div className={styles.hairline} />}
            <div className={styles.detailSectionLabel}>{label}</div>
            {sections[i]
              ? <div className={styles.detailSectionBody}>{sections[i]}</div>
              : <div className={styles.detailSectionEmpty}>—</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function TypeCard({ title, builtins, customs, colorPickerOpen, onToggleColorPicker, onChangeColor, onRemove, addValue, onAddChange, onAddSubmit }) {
  return (
    <div className={styles.typeCard}>
      <div className={styles.typeCardLabel}>{title}</div>
      {builtins.map(t => (
        <div key={t.name} className={styles.typeRow}>
          <div className={styles.typeSwatch} style={{ background: t.color }} />
          <span className={styles.typeName}>{t.name}</span>
          <span className={styles.builtinTag}>built-in</span>
        </div>
      ))}
      {customs.map(t => (
        <div key={t.id}>
          <div className={styles.typeRow}>
            <div className={styles.typeSwatch} style={{ background: t.color }} />
            <span className={styles.typeName}>{t.name}</span>
            <button className={styles.typeAction} onClick={() => onToggleColorPicker(t.name)}>color</button>
            <button className={styles.typeAction} onClick={() => onRemove(t.name)}>remove</button>
          </div>
          {colorPickerOpen === t.name && (
            <div className={styles.swatchRow}>
              {CUSTOM_TYPE_SWATCHES.map(c => (
                <button key={c} className={styles.swatch} style={{ background: c }} onClick={() => onChangeColor(t.name, c)} />
              ))}
            </div>
          )}
        </div>
      ))}
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="add a type…"
          value={addValue}
          onChange={onAddChange}
          onKeyDown={e => { if (e.key === 'Enter') onAddSubmit() }}
        />
        <button className={styles.addBtn} onClick={onAddSubmit} disabled={!addValue.trim()}>add</button>
      </div>
    </div>
  )
}

export default function Debriefs({ state }) {
  const [debriefs, setDebriefs] = useState([])
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [] })
  const [newOpen, setNewOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [colorPickerFor, setColorPickerFor] = useState(null)
  const [addInputs, setAddInputs] = useState({ nature: '', environment: '' })

  useEffect(() => {
    if (state.userId) refresh()
  }, [state.userId])

  async function refresh() {
    const [d, t] = await Promise.all([loadDebriefs(state.userId), loadDebriefTypes(state.userId)])
    setDebriefs(d)
    setDebriefTypes(t)
  }

  async function handleAddType(category) {
    const name = addInputs[category].trim().toLowerCase()
    if (!name) return
    const used = new Set(debriefTypes[category].map(t => t.color))
    const color = CUSTOM_TYPE_SWATCHES.find(c => !used.has(c)) || CUSTOM_TYPE_SWATCHES[0]
    await saveDebriefType(state.userId, { category, name, color })
    setAddInputs(prev => ({ ...prev, [category]: '' }))
    refresh()
  }

  async function handleRemoveType(category, name) {
    await deleteDebriefType(state.userId, { category, name })
    refresh()
  }

  async function handleChangeColor(category, name, color) {
    await saveDebriefType(state.userId, { category, name, color })
    setColorPickerFor(null)
    refresh()
  }

  const natureBuiltins = BUILTIN_NATURE_TYPES.map(t => ({ name: t.name, color: t.bg }))
  const environmentBuiltins = BUILTIN_ENVIRONMENT_TYPES.map(name => ({ name, color: ENVIRONMENT_TAG_STYLE.background }))

  const groups = groupByMonth(debriefs)

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>YOUR DEBRIEFS</div>
        <div className={styles.title}>debriefs</div>
        <div className={styles.sub}>a record of your anxiety episodes and what you made of them.</div>
      </div>

      <div className={styles.list}>
        <button className={styles.newBtn} onClick={() => setNewOpen(true)}>
          <span className={styles.newBtnLabel}>→ new debrief</span>
          <span className={styles.newBtnSub}>log an episode from earlier today</span>
        </button>

        <div className={styles.card}>
          {debriefs.length === 0 ? (
            <div className={styles.empty}>your first debrief will appear here.</div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <div className={styles.monthLabel}>{group.label}</div>
                {group.items.map(d => (
                  <div key={d.id} className={styles.episodeRow} onClick={() => setDetail(d)}>
                    <div className={styles.episodeTop}>
                      <span className={styles.episodeDate}>{formatEpisodeDate(d.date_key)}</span>
                      <div className={styles.episodeTags}>
                        <span className={styles.tag} style={natureTagStyle(d.nature, debriefTypes.nature)}>{d.nature}</span>
                        <span className={styles.tag} style={ENVIRONMENT_TAG_STYLE}>{d.environment}</span>
                      </div>
                    </div>
                    <div className={styles.episodeExcerpt}>{(d.entry || '').slice(0, 80)}</div>
                    <div className={styles.dotsRow}>
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={styles.stepDot}
                          style={i < (d.steps_completed || 0) ? { background: '#1B3A2D' } : {}}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className={styles.sectionLabel}>customize</div>

        <TypeCard
          title="NATURE OF ANXIETY"
          builtins={natureBuiltins}
          customs={debriefTypes.nature}
          colorPickerOpen={colorPickerFor && colorPickerFor[0] === 'nature' ? colorPickerFor[1] : null}
          onToggleColorPicker={name => setColorPickerFor(prev => (prev && prev[0] === 'nature' && prev[1] === name) ? null : ['nature', name])}
          onChangeColor={(name, color) => handleChangeColor('nature', name, color)}
          onRemove={name => handleRemoveType('nature', name)}
          addValue={addInputs.nature}
          onAddChange={e => setAddInputs(prev => ({ ...prev, nature: e.target.value }))}
          onAddSubmit={() => handleAddType('nature')}
        />

        <TypeCard
          title="ENVIRONMENT"
          builtins={environmentBuiltins}
          customs={debriefTypes.environment}
          colorPickerOpen={colorPickerFor && colorPickerFor[0] === 'environment' ? colorPickerFor[1] : null}
          onToggleColorPicker={name => setColorPickerFor(prev => (prev && prev[0] === 'environment' && prev[1] === name) ? null : ['environment', name])}
          onChangeColor={(name, color) => handleChangeColor('environment', name, color)}
          onRemove={name => handleRemoveType('environment', name)}
          addValue={addInputs.environment}
          onAddChange={e => setAddInputs(prev => ({ ...prev, environment: e.target.value }))}
          onAddSubmit={() => handleAddType('environment')}
        />
      </div>

      {newOpen && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button className={styles.backBtn} onClick={() => setNewOpen(false)}>← debriefs</button>
          </div>
          <div className={styles.overlayContent}>
            <DebriefForm userId={state.userId} debriefTypes={debriefTypes} onSaved={() => { setNewOpen(false); refresh() }} />
          </div>
        </div>
      )}

      {detail && (
        <DetailOverlay debrief={detail} debriefTypes={debriefTypes} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
