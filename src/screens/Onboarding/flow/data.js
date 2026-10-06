// Content and rules for the onboarding flow. Copy is final: edit it here, not
// in the screens.

import { UNIVERSAL_NEEDS } from '../../../lib/constants'

// The 13 needs, in the order the sort deals them. `mandatory` needs can never
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
  { id: 'information', name: 'information' },
  { id: 'touch',       name: 'touch' },
  { id: 'thrill',      name: 'thrill' },
]

export const NEED_BY_ID = Object.fromEntries(FLOW_NEEDS.map(n => [n.id, n]))

// Only "passion" (exploration) is capped live, at drop time. The other buckets
// take as many as land in them; `cap` there is the real target, enforced by
// the rank-and-cut pass afterward.
export const ZONES = [
  { key: 'exploration',  label: 'It’s my passion.',                   cap: 1, liveCapped: true },
  { key: 'appreciation', label: 'It brings me joy.',                       cap: 2 },
  { key: 'nourishment',  label: 'It needs to be part of my routine.',      cap: 3 },
  { key: 'survival',     label: 'Just need to get it done.',               cap: 4 },
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

// Sample draft shown on the "What's on your mind?" screen, matched to the band
// just picked on the check-in. Demo only: it is never saved.
export const DRAFT_SAMPLES = {
  good: 'Woke up early and actually had time to sit with my coffee. Feeling like I have room today. I want to protect that and not fill every gap.',
  mid:  'Not bad, not great. Got through the morning on autopilot. I think I skipped lunch again, which probably explains the flat feeling.',
  bad:  'Woke up already behind. My chest has been tight all morning over a meeting that is probably fine. Going to walk before lunch and see if that loosens things up.',
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
  intro: 0.04, hypotheses: 0.10, how: 0.16,
  rank: 0.58, recap: 0.62, checkin: 0.70,
  almanac: 0.78, draftEntry: 0.86, drafts: 0.92,
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

// Buckets that came out over their real target and need trimming, in the
// order they are asked. A bucket that is over only because of always-kept
// needs has nothing to decide, so it is skipped.
export function rankQueueFor(placed) {
  return ZONES.filter(z =>
    z.cap !== Infinity && !z.liveCapped && placed[z.key].length > z.cap &&
    placed[z.key].some(id => !NEED_BY_ID[id].mandatory))
}

// How many of a bucket's optional needs can stay once the always-kept ones
// are counted.
export function rankKeepFor(zone, placed) {
  const pinned = placed[zone.key].filter(id => NEED_BY_ID[id].mandatory).length
  return Math.max(zone.cap - pinned, 0)
}

// The picked needs stay in the bucket; everything else moves to
// "doesn't matter".
export function applyRank(placed, zoneKey, keepIds) {
  const members = placed[zoneKey]
  const pinned = members.filter(id => NEED_BY_ID[id].mandatory)
  const cut = members.filter(id => !NEED_BY_ID[id].mandatory && keepIds.indexOf(id) === -1)
  return {
    ...placed,
    [zoneKey]: pinned.concat(keepIds),
    unassigned: placed.unassigned.concat(cut),
  }
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
