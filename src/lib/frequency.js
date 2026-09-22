export const BANDS = ['good', 'mid', 'bad']

// Display labels. The stored token never changes; only this map does.
export const BAND_LABEL = { good: 'good', mid: 'fine', bad: 'bad' }

export const FEELINGS = {
  good: ['calm', 'curious', 'creative', 'confident'],
  mid:  ['steady', 'flat', 'restless', 'braced'],
  bad:  ['overwhelmed', 'apathetic', 'frenetic', 'small'],
}

export const THREADS = ['capacity', 'engagement', 'drive', 'posture']

// What each thread means, and what to do when you're leaning toward its
// bad-band word. The single source for this copy — Today's info reveal and
// the almanac's per-thread panel both read from here, so a wording change
// only ever happens in one place.
export const THREAD_COPY = {
  capacity: {
    definition: 'Capacity is how much energy you have for what the day asks of you. Calm means you have energy to spare. Steady means you have just enough. Overwhelmed means you are running on reserves.',
    guidance: 'If you are veering into overwhelmed, take a hard look at your to-do list and ask whether everything on it really warrants the energy you are giving it.',
  },
  engagement: {
    definition: 'Engagement is whether you find meaning in what you are doing. Curious means you are drawn to the things filling your life. Flat means they hold your attention without pulling you in. Apathetic means you are, at best, just going through the motions.',
    guidance: 'If you are veering into apathetic, ask yourself why you are doing what you are doing. Is it moving you toward something that matters, or could it be replaced or stopped?',
  },
  drive: {
    definition: 'Drive is where your energy is headed, not how much of it you have. Creative means it is moving with purpose. Restless means it has no clear outlet yet. Frenetic means it has started working against you.',
    guidance: 'If you are veering into frenetic, consider doing one thing that forces you into a creative state.',
  },
  posture: {
    definition: 'Posture is how big or small you feel standing in front of what is ahead. Confident means you are the immovable thing. Braced means you are waiting for the other shoe to drop. Small means you feel at the mercy of your circumstances.',
    guidance: 'If you are veering into small, consider devoting some energy to something you know you are good at. Confidence is transferable.',
  },
}

/** Thread name for a feeling — its index within its band. Not rendered; used by the Data screen. */
export function threadOf(feeling) {
  for (const b of BANDS) {
    const i = FEELINGS[b].indexOf(feeling)
    if (i !== -1) return THREADS[i]
  }
  return null
}

/**
 * Tolerant read. Rows written before the migration carry 'fine'.
 * EVERY read of a mood row's band must go through this.
 */
export function normalizeBand(band) {
  return band === 'fine' ? 'mid' : band
}
