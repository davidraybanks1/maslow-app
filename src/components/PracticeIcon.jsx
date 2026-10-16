import { useId } from 'react'
import { UNLIT_DARK } from './Bloom'

// The six practice-type icons, drawn in Loam's orb vocabulary: shiny black
// when unlit (the same material as the mode shapes), filled with the tier's
// colour when the practice is done today.
//
// check      one orb
// timed      an orb inside a running ring
// checklist  three orbs beside three lines
// ritual     four orbs growing in order
// stretch    a dashed square with an orb pushing out of it
// boundary   half an orb, half a dashed edge, and a line down the middle

function shapes(kind, fill) {
  switch (kind) {
    case 'timed':
      return (
        <>
          <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="2.5" />
          <path d="M20 6A14 14 0 1 1 6 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="20" cy="20" r="6.5" fill={fill} />
        </>
      )
    case 'checklist':
      return (
        <>
          <circle cx="9" cy="9" r="4.3" fill={fill} />
          <circle cx="9" cy="20" r="4.3" fill={fill} />
          <circle cx="9" cy="31" r="4.3" fill={fill} />
          <rect x="18" y="7.5" width="16" height="3" rx="1.5" fill="currentColor" fillOpacity=".28" />
          <rect x="18" y="18.5" width="12" height="3" rx="1.5" fill="currentColor" fillOpacity=".28" />
          <rect x="18" y="29.5" width="15" height="3" rx="1.5" fill="currentColor" fillOpacity=".28" />
        </>
      )
    case 'ritual':
      return (
        <>
          <circle cx="5.5" cy="28" r="2.6" fill={fill} />
          <circle cx="13" cy="25" r="3.7" fill={fill} />
          <circle cx="22" cy="20.5" r="5.2" fill={fill} />
          <circle cx="32" cy="14" r="7" fill={fill} />
        </>
      )
    case 'stretch':
      return (
        <>
          <rect x="5" y="15" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 3" />
          <circle cx="26" cy="14" r="8.5" fill={fill} />
        </>
      )
    case 'boundary':
      return (
        <>
          <path d="M20 7A13 13 0 0 0 20 33Z" fill={fill} />
          <path d="M20 7A13 13 0 0 1 20 33" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 3" />
          <path d="M20 4V36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )
    default:
      return <circle cx="20" cy="20" r="11" fill={fill} />
  }
}

// lit: null (unlit, shiny black) | [hi, lo] gradient pair for a lit tier colour
export default function PracticeIcon({ kind = 'check', size = 24, lit = null, className }) {
  const gid = useId().replace(/:/g, '')
  const id = `pi-${gid}`
  const stops = lit
    ? [[0, lit[0]], [100, lit[1]]]
    : [[0, UNLIT_DARK[0]], [45, UNLIT_DARK[1]], [100, UNLIT_DARK[2]]]
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', color: 'var(--ink)' }}
    >
      <defs>
        <radialGradient id={id} cx="34%" cy="26%">
          {stops.map(([o, c]) => <stop key={o} offset={`${o}%`} stopColor={c} />)}
        </radialGradient>
      </defs>
      {shapes(kind, `url(#${id})`)}
    </svg>
  )
}
