import { useEffect, useState } from 'react'
import { signedNoteImageUrl } from '../lib/store'

// An <img> for a photo stored in the private note-images bucket. Fetches a
// short-lived signed URL, then shows the picture. Takes every <img> prop.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export default function SignedImg({ src, alt = '', ...rest }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (src) signedNoteImageUrl(src).then(u => { if (live) setUrl(u) })
    return () => { live = false }
  }, [src])
  return <img src={url || BLANK} alt={alt} {...rest} />
}
