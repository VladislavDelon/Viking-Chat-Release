import { Bookmark } from 'lucide-react'
import { initials } from '../lib/format'

export function Avatar({
  name,
  color,
  size = 44,
  saved = false,
}: {
  name: string
  color: string
  size?: number
  saved?: boolean
}) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
      }}
    >
      {saved ? <Bookmark size={size * 0.45} fill="currentColor" /> : initials(name)}
    </div>
  )
}
