// Content and rules for the onboarding flow. Copy is final: edit it here, not
// in the screens.

import { UNIVERSAL_NEEDS } from '../../../lib/constants'

// The 11 needs the onboarding sort deals, in order. (information and touch live
// in the app's need library but are left out of onboarding on purpose.) `mandatory` needs can never
// be parked in "doesn't matter"; `restrict` limits which buckets a need can
// land in (rest tops out at routine).
export const FLOW_NEEDS = [
  { id: 'movement',    name: 'movement',    mandatory: true },
  { id: 'nutrition',   name: 'nutrition',   mandatory: true },
  { id: 'rest',        name: 'rest',        mandatory: true, restrict: ['nourishment', 'survival'] },
  { id: 'community',   name: 'community' },
  { id: 'beauty',      name: 'beauty' },
  { id: 'intimacy',    name: 'intimacy' },
  { id: 'reflection',  name: 'reflection',  mandatory: true },
  { id: 'play',        name: 'play' },
  { id: 'money',       name: 'money' },
  { id: 'dwelling',    name: 'dwelling' },
  { id: 'thrill',      name: 'thrill' },
]

export const NEED_BY_ID = Object.fromEntries(FLOW_NEEDS.map(n => [n.id, n]))

// Only "passion" (exploration) is capped live, at drop time. The other buckets
// take as many as land in them; `cap` there is the real target, enforced by
// the rank-and-cut pass afterward.
export const ZONES = [
  { key: 'exploration',  label: 'It’s my passion.',                   cap: 1, liveCapped: true },
  { key: 'appreciation', label: 'It brings me joy.',                       cap: 2 },
  { key: 'nourishment',  label: 'I need it to function.',                  cap: 3 },
  { key: 'survival',     label: 'It’s just something I need to survive.', cap: 4 },
  { key: 'unassigned',   label: 'It doesn’t matter to me right now.', cap: Infinity },
]

export const ZONE_BY_KEY = Object.fromEntries(ZONES.map(z => [z.key, z]))

export const MODE_KEYS = ['exploration', 'appreciation', 'nourishment', 'survival']

export const NEED_DESCS = {
  movement:    'Like actual physical activity.',
  nutrition:   'Like what you put into your body.',
  rest:        'Like…sleep.',
  community:   'Like interactions with people.',
  beauty:      'Like art and nature.',
  intimacy:    'Like secure vulnerability with another.',
  reflection:  'Like journaling and processing your experiences.',
  play:        'Like hobbies and things you do just for fun.',
  money:       'Like your career, saving, and financial security.',
  dwelling:    'Like cleaning, designing, and making your living space your own.',
  information: 'Like staying up on current events, consuming media, and learning new things.',
  touch:       'Like physical touch, whatever that means for you.',
  thrill:      'Like stepping outside of your comfort zone in big and small ways.',
}

// Intro sentence on the "select your top N" trim screen, one per rankable
// bucket (exploration never ranks: it is capped live).
export const RANK_INTRO = {
  appreciation: 'You have a lot of needs that bring you joy.',
  nourishment:  'You have a lot of needs you want to make routine.',
  survival:     'You have a lot of needs you just check the box on.',
}
export const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four']

// Where the others go, in words, for the trim screen.
export const DROP_LABEL = {
  nourishment: 'I need it to function.',
  survival: 'It’s just something I need to survive.',
  unassigned: 'It doesn’t matter to me right now.',
}

export const NOTES_NEEDED = 3
// The deck table rejects more than five active cards (DB trigger).
export const NOTES_MAX = 5
export const NOTE_LIBRARY = [
  'Everything you want is on the other side of discomfort.',
  'Don’t downgrade your aspirations to match your reality. Upgrade your beliefs to match your vision.',
  'If you feel like you are doing too much, you are not doing enough of what matters.',
  'Anxiety is just meaning before we understand it. Take the time to understand it',
  'Take up space',
]

// Resting progress value for each non-sorting screen. The sort fills
// continuously between SORT_FROM and SORT_TO; the notes screen goes 0.96 -> 1
// once three notes are chosen.
export const PROGRESS_AT = {
  welcome: 0, intro: 0.04, hypotheses: 0.10, how: 0.16,
  rank: 0.58, recap: 0.62, almanac: 0.78,
}
export const SORT_FROM = 0.16
export const SORT_TO = 0.56

// ── Sorting rules ─────────────────────────────────────────────────────────

export function emptyPlaced() {
  return { exploration: [], appreciation: [], nourishment: [], survival: [], unassigned: [] }
}

export function isZoneDisabled(need, zone) {
  if (!need) return false
  if (zone.key === 'unassigned') return !!need.mandatory
  if (need.restrict) return need.restrict.indexOf(zone.key) === -1
  return false
}

export function isZoneFull(zone, placed) {
  return !!zone.liveCapped && placed[zone.key].length >= zone.cap
}

// Where a need lands when it doesn't make the cut in its bucket: the next mode
// down. Survival is the last mode, so what doesn't fit there is parked in
// "doesn't matter".
export const NEXT_ZONE = { appreciation: 'nourishment', nourishment: 'survival', survival: 'unassigned' }

// The first bucket that is over its real target and has something to decide.
// A bucket that is over only because of always-kept needs has nothing to
// decide, so it is skipped.
function overflowZone(placed) {
  return ZONES.find(z =>
    z.cap !== Infinity && !z.liveCapped && placed[z.key].length > z.cap &&
    placed[z.key].some(id => !NEED_BY_ID[id].mandatory)) || null
}

// How many of a bucket's optional needs can stay once the always-kept ones
// are counted.
export function rankKeepFor(zone, placed) {
  const pinned = placed[zone.key].filter(id => NEED_BY_ID[id].mandatory).length
  return Math.max(zone.cap - pinned, 0)
}

// The picked needs stay in the bucket; everything else drops to the next mode
// down (and may be trimmed again there).
export function applyRank(placed, zoneKey, keepIds) {
  const members = placed[zoneKey]
  const pinned = members.filter(id => NEED_BY_ID[id].mandatory)
  const cut = members.filter(id => !NEED_BY_ID[id].mandatory && keepIds.indexOf(id) === -1)
  const to = NEXT_ZONE[zoneKey] || 'unassigned'
  return {
    ...placed,
    [zoneKey]: pinned.concat(keepIds),
    [to]: placed[to].concat(cut),
  }
}

// Walk the trimming forward. A bucket with no room at all has nothing for the
// person to choose, so its needs drop straight down and the choice happens in
// the next bucket, where they compete with what is already there. Returns the
// placement so far and the bucket that needs a pick (null when done). Survival
// always gets its screen, since what doesn't fit there leaves the modes.
export function settleRanks(placed) {
  let cur = placed
  for (let guard = 0; guard < 8; guard++) {
    const zone = overflowZone(cur)
    if (!zone) return { placed: cur, zone: null }
    if (rankKeepFor(zone, cur) === 0 && zone.key !== 'survival') {
      cur = applyRank(cur, zone.key, [])
      continue
    }
    return { placed: cur, zone }
  }
  return { placed: cur, zone: null }
}

// How many trim screens the person will see from here. The count of needs
// that drop, not which ones, decides it, so it can be known up front.
export function countRankScreens(placed) {
  let cur = placed
  let n = 0
  for (let guard = 0; guard < 8; guard++) {
    const s = settleRanks(cur)
    if (!s.zone) return n
    n += 1
    const keep = rankKeepFor(s.zone, s.placed)
    const optional = s.placed[s.zone.key].filter(id => !NEED_BY_ID[id].mandatory)
    cur = applyRank(s.placed, s.zone.key, optional.slice(0, keep))
  }
  return n
}

// { universal: {needId: mode}, personal: {needId: mode} } — what the account
// step and the canvas expect. Needs left in "doesn't matter" are omitted.
export function recommendationFrom(placed) {
  const universal = {}
  const personal = {}
  for (const mode of MODE_KEYS) {
    for (const id of placed[mode]) {
      if (UNIVERSAL_NEEDS.includes(id)) universal[id] = mode
      else personal[id] = mode
    }
  }
  return { universal, personal }
}
