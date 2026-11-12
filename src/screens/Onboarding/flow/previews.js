// The "after about a week" render. It is cut into short slices (<1000px) and
// stacked in the glimpse window: one very tall image can fail to paint inside a
// scrolling box on iOS Safari, a stack of small ones does not.
import a1 from './preview-almanac-1.jpg'
import a2 from './preview-almanac-2.jpg'
import a3 from './preview-almanac-3.jpg'
import a4 from './preview-almanac-4.jpg'
import a5 from './preview-almanac-5.jpg'
import a6 from './preview-almanac-6.jpg'
import a7 from './preview-almanac-7.jpg'
import a8 from './preview-almanac-8.jpg'

// width/height are the slices' pixel sizes, so the browser reserves the right
// space before a slice has loaded.
const W = 804
export const ALMANAC_PREVIEW = [
  { src: a1, width: W, height: 952 },
  { src: a2, width: W, height: 952 },
  { src: a3, width: W, height: 952 },
  { src: a4, width: W, height: 952 },
  { src: a5, width: W, height: 952 },
  { src: a6, width: W, height: 952 },
  { src: a7, width: W, height: 952 },
  { src: a8, width: W, height: 946 },
]

// Fetch the slices ahead of time (the flow calls this a few screens early) so
// the window is already full when the screen arrives.
const warmed = new Set()
export function warmPreviews(slices) {
  if (typeof Image === 'undefined') return
  slices.forEach(s => {
    if (warmed.has(s.src)) return
    warmed.add(s.src)
    const img = new Image()
    img.src = s.src
  })
}
