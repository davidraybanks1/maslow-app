import { useState, useEffect } from 'react'
import { loadDebriefs, loadDebriefTypes, saveDebriefType, deleteDebriefType } from '../lib/store'
import {
  BUILTIN_NATURE_TYPES,
  BUILTIN_PEAK_TYPES,
  BUILTIN_ENVIRONMENT_TYPES,
  ENVIRONMENT_TAG_STYLE,
  CUSTOM_TYPE_SWATCHES,
  natureTagStyle,
  peakTagStyle,
} from '../lib/debriefTypes'
import { createDataStats } from '../lib/dataStats'
import { AnxietyEpisodesCard, PeakMomentsCard } from '../components/DebriefStatsCards'
import DebriefForm from '../components/DebriefForm'
import PeakDebriefForm from '../components/PeakDebriefForm'
import styles from './Debriefs.module.css'

const ANXIETY_SECTION_LABELS = ['1. NAME IT', '2. FEEL IT', '3. EXAMINE IT', '4. RECLAIM IT']
const PEAK_SECTION_LABELS = ['1. NAME IT', '2. FEEL IT', '3. EXAMINE IT', '4. ANCHOR IT']
const FILTERS = ['all', 'anxiety', 'peak']

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
  const isPeak = debrief.type === 'peak'
  const tagStyle = isPeak ? peakTagStyle(debrief.nature, debriefTypes.peak) : natureTagStyle(debrief.nature, debriefTypes.nature)
  const sectionLabels = isPeak ? PEAK_SECTION_LABELS : ANXIETY_SECTION_LABELS
  return (
    <div className={styles.overlay}>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={onClose}>← debriefs</button>
        <div className={styles.overlayTags}>
          <span className={styles.tag} style={tagStyle}>{debrief.nature}</span>
          <span className={styles.tag} style={ENVIRONMENT_TAG_STYLE}>{debrief.environment}</span>
        </div>
      </div>
      <div className={styles.overlayContent}>
        <div className={styles.detailDateRow}>
          <span className={styles.detailDate}>{formatFullDate(debrief.date_key)}</span>
          <span className={styles.detailTypeLabel}>{isPeak ? 'peak debrief' : 'anxiety debrief'}</span>
        </div>
        {sectionLabels.map((label, i) => (
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
  const [debriefTypes, setDebriefTypes] = useState({ nature: [], environment: [], peak: [] })
  const [filter, setFilter] = useState('all')
  const [newStep, setNewStep] = useState(null) // null | 'choose' | 'anxiety' | 'peak'
  const [detail, setDetail] = useState(null)
  const [colorPickerFor, setColorPickerFor] = useState(null)
  const [addInputs, setAddInputs] = useState({ nature: '', environment: '', peak: '' })

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
    const used = new Set((debriefTypes[category] || []).map(t => t.color))
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
  const peakBuiltins = BUILTIN_PEAK_TYPES.map(t => ({ name: t.name, color: t.bg }))
  const environmentBuiltins = BUILTIN_ENVIRONMENT_TYPES.map(name => ({ name, color: ENVIRONMENT_TAG_STYLE.background }))

  const filteredDebriefs = debriefs.filter(d => {
    if (filter === 'anxiety') return d.type === 'anxiety' || !d.type
    if (filter === 'peak') return d.type === 'peak'
    return true
  })
  const groups = groupByMonth(filteredDebriefs)

  // Data cards always reflect all debriefs, regardless of the history filter.
  const stats = createDataStats({ canvas: state.canvas || {}, checkins: state.checkins || {}, moods: state.moods || [], practices: state.practices || {} })
  const { byNatureAnxiety, byTypePeak, byEnvironment, patternAnxiety, patternPeak } = stats.getDebriefStats(debriefs)
  const anxietyCount = debriefs.filter(d => d.type === 'anxiety' || !d.type).length
  const peakCount = debriefs.filter(d => d.type === 'peak').length

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>your debriefs.</div>
        <div className={styles.sub}>revisit your debriefs or modify the attributes you associate with them.</div>
      </div>

      <div className={styles.list}>
        <button className={styles.newBtn} onClick={() => setNewStep('choose')}>
          <span className={styles.newBtnLabel}>→ new debrief</span>
          <span className={styles.newBtnSub}>log an episode or moment from earlier today</span>
        </button>

        <div className={styles.filterRow}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.filterPill} ${filter === f ? styles.filterPillActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className={styles.card}>
          {filteredDebriefs.length === 0 ? (
            <div className={styles.empty}>
              {debriefs.length === 0 ? 'your first debrief will appear here.' : 'no debriefs match this filter.'}
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <div className={styles.monthLabel}>{group.label}</div>
                {group.items.map(d => {
                  const isPeak = d.type === 'peak'
                  return (
                    <div key={d.id} className={styles.episodeRow} onClick={() => setDetail(d)}>
                      <div className={styles.episodeTop}>
                        <span className={styles.episodeDate}>{formatEpisodeDate(d.date_key)}</span>
                        <div className={styles.episodeTags}>
                          <span className={styles.tag} style={isPeak ? peakTagStyle(d.nature, debriefTypes.peak) : natureTagStyle(d.nature, debriefTypes.nature)}>{d.nature}</span>
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
                  )
                })}
              </div>
            ))
          )}
        </div>

        <AnxietyEpisodesCard byNatureAnxiety={byNatureAnxiety} byEnvironment={byEnvironment} pattern={patternAnxiety} anxietyCount={anxietyCount} />
        <PeakMomentsCard byTypePeak={byTypePeak} byEnvironment={byEnvironment} pattern={patternPeak} peakCount={peakCount} />

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
          title="TYPE OF PEAK"
          builtins={peakBuiltins}
          customs={debriefTypes.peak || []}
          colorPickerOpen={colorPickerFor && colorPickerFor[0] === 'peak' ? colorPickerFor[1] : null}
          onToggleColorPicker={name => setColorPickerFor(prev => (prev && prev[0] === 'peak' && prev[1] === name) ? null : ['peak', name])}
          onChangeColor={(name, color) => handleChangeColor('peak', name, color)}
          onRemove={name => handleRemoveType('peak', name)}
          addValue={addInputs.peak}
          onAddChange={e => setAddInputs(prev => ({ ...prev, peak: e.target.value }))}
          onAddSubmit={() => handleAddType('peak')}
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
        <div className={styles.envNote}>environment applies to both anxiety and peak debriefs.</div>
      </div>

      {newStep === 'choose' && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button className={styles.backBtn} onClick={() => setNewStep(null)}>← debriefs</button>
          </div>
          <div className={styles.overlayContent}>
            <div className={styles.chooseTitle}>what kind of debrief?</div>
            <div className={styles.chooseCardAnxiety} onClick={() => setNewStep('anxiety')}>
              <div className={styles.chooseCardLabel}>anxiety episode</div>
              <div className={styles.chooseCardDesc}>turn an anxiety episode into a growth moment.</div>
            </div>
            <div className={styles.chooseCardPeak} onClick={() => setNewStep('peak')}>
              <div className={styles.chooseCardLabel}>peak moment</div>
              <div className={styles.chooseCardDesc}>capture a moment when you felt fully alive.</div>
            </div>
          </div>
        </div>
      )}

      {(newStep === 'anxiety' || newStep === 'peak') && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button className={styles.backBtn} onClick={() => setNewStep('choose')}>← back</button>
          </div>
          <div className={styles.overlayContent}>
            {newStep === 'anxiety'
              ? <DebriefForm userId={state.userId} debriefTypes={debriefTypes} onSaved={() => { setNewStep(null); refresh() }} />
              : <PeakDebriefForm userId={state.userId} debriefTypes={debriefTypes} onSaved={() => { setNewStep(null); refresh() }} />}
          </div>
        </div>
      )}

      {detail && (
        <DetailOverlay debrief={detail} debriefTypes={debriefTypes} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
