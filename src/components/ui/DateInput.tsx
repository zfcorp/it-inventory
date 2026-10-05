import React, { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'

interface Props {
  value: string           // stored as YYYY-MM-DD
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  required?: boolean
}

// Parse whatever the user types into YYYY-MM-DD
function parseToISO(raw: string): string {
  if (!raw.trim()) return ''

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // DD-Mon-YY or DD-Mon-YYYY  e.g. "06-Feb-26" or "06-Feb-2026"
  const dmy = raw.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/)
  if (dmy) {
    const months: Record<string, string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
    }
    const m = months[dmy[2].toLowerCase().slice(0,3)]
    if (m) {
      const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]
      return `${y}-${m}-${dmy[1].padStart(2,'0')}`
    }
  }

  // DD/MM/YYYY or DD/MM/YY
  const dmy2 = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (dmy2) {
    const y = dmy2[3].length === 2 ? '20' + dmy2[3] : dmy2[3]
    return `${y}-${dmy2[2].padStart(2,'0')}-${dmy2[1].padStart(2,'0')}`
  }

  // MM/DD/YYYY (US style — only if month value ≤ 12 and day > 12)
  // Fallback: return as-is and let HTML5 validation catch it
  return raw
}

// Display stored YYYY-MM-DD as "06-Feb-26"
function formatDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const yr  = String(d.getFullYear()).slice(-2)
  return `${day}-${mon}-${yr}`
}

const DateInput: React.FC<Props> = ({
  value, onChange, placeholder = 'e.g. 06-Feb-26', className = '', required
}) => {
  const [text, setText] = useState(formatDisplay(value))
  const [error, setError] = useState(false)

  // Sync display when value prop changes externally
  useEffect(() => {
    setText(formatDisplay(value))
  }, [value])

  const handleBlur = () => {
    if (!text.trim()) {
      onChange('')
      setError(false)
      return
    }
    const iso = parseToISO(text)
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(new Date(iso).getTime())
    if (valid) {
      onChange(iso)
      setText(formatDisplay(iso))
      setError(false)
    } else {
      setError(true)
    }
  }

  return (
    <div className="relative">
      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={text}
        onChange={e => { setText(e.target.value); setError(false) }}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        className={`${className || 'input'} pl-9 ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1">
          Use DD-Mon-YY (e.g. 06-Feb-26) or YYYY-MM-DD
        </p>
      )}
    </div>
  )
}

export default DateInput
