import { useState } from 'react'

const QUOTE_LIMIT = 160

export default function JournalQuote({ text, dateLabel, blockClass, dateClass, textClass, readMoreClass }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > QUOTE_LIMIT
  const display = isLong && !expanded ? text.slice(0, QUOTE_LIMIT) + '…' : text

  function handleClick(e) {
    e.stopPropagation()
    setExpanded(v => !v)
  }

  return (
    <span
      className={blockClass}
      onClick={isLong ? handleClick : undefined}
      style={isLong ? { cursor: 'pointer' } : undefined}
    >
      <span className={dateClass}>↩ {dateLabel}</span>
      <span className={textClass}>{display}</span>
      {isLong && <span className={readMoreClass}>{expanded ? 'collapse' : 'read more'}</span>}
    </span>
  )
}
