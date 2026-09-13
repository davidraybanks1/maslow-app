export const BANDS = ['good', 'mid', 'bad']

export const FEELINGS = {
  good: ['calm', 'curious', 'creative', 'confident'],
  mid:  ['steady', 'flat', 'restless', 'braced'],
  bad:  ['overwhelmed', 'apathetic', 'frenetic', 'fearful'],
}

export const THREADS = ['capacity', 'engagement', 'drive', 'safety']

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
