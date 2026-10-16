import { useId } from 'react'
import PracticeIcon, { TIER_LIT } from './PracticeIcon'
import { UNLIT_DARK } from './Bloom'

// Small pictures for the profile tiles, in the same orb vocabulary as the four
// mode spheres on the needs tile. All are 34px tall and decorative.

// Four of the six practice types, each lit in a mode's colour.
export function PracticesArt() {
  const shown = [['check', 'exploration'], ['timed', 'appreciation'], ['ritual', 'nourishment'], ['stretch', 'survival']]
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 0, height: 34, alignItems: 'center', marginLeft: -4 }}>
      {shown.map(([kind, mode]) => <PracticeIcon key={kind} kind={kind} size={30} lit={TIER_LIT[mode]} />)}
    </div>
  )
}

// A little stack of note cards, fanned, the front one with two lines of text.
export function NotesArt() {
  return (
    <svg width="54" height="34" viewBox="0 0 54 34" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <rect x="15" y="3" width="28" height="28" rx="6" fill="#ABBEA3" transform="rotate(10 29 17)" />
      <rect x="9" y="3" width="28" height="28" rx="6" fill="#F5B622" transform="rotate(-6 23 17)" />
      <rect x="2" y="3" width="28" height="28" rx="6" fill="#fff" stroke="#1d1b16" strokeOpacity=".18" />
      <rect x="7.5" y="11" width="17" height="3" rx="1.5" fill="#1d1b16" fillOpacity=".75" />
      <rect x="7.5" y="18" width="11" height="3" rx="1.5" fill="#1d1b16" fillOpacity=".3" />
    </svg>
  )
}

// Two tags: one shiny black, one lit yellow behind it, each with a string hole.
export function TagsArt() {
  const gid = `tg-${useId().replace(/:/g, '')}`
  const body = 'M11 7H27a4 4 0 0 1 4 4V23a4 4 0 0 1-4 4H11L2.6 17.6a1.4 1.4 0 0 1 0-1.8Z'
  return (
    <svg width="58" height="34" viewBox="0 0 58 34" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={gid} cx="34%" cy="26%">
          <stop offset="0%" stopColor={UNLIT_DARK[0]} />
          <stop offset="45%" stopColor={UNLIT_DARK[1]} />
          <stop offset="100%" stopColor={UNLIT_DARK[2]} />
        </radialGradient>
        <radialGradient id={`${gid}y`} cx="34%" cy="26%">
          <stop offset="0%" stopColor={TIER_LIT.nourishment[0]} />
          <stop offset="100%" stopColor={TIER_LIT.nourishment[1]} />
        </radialGradient>
      </defs>
      <g transform="translate(20 -1) rotate(16 16 17)">
        <path d={body} fill={`url(#${gid}y)`} />
        <circle cx="9" cy="17" r="2.1" fill="#fff" />
      </g>
      <g transform="translate(-1 3) rotate(-10 16 17)">
        <path d={body} fill={`url(#${gid})`} />
        <circle cx="9" cy="17" r="2.1" fill="#fff" />
      </g>
    </svg>
  )
}
