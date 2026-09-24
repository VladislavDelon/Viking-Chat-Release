import { Bookmark } from 'lucide-react'
import { initials } from '../lib/format'

export function Avatar({
  name,
  color,
  size = 44,
  saved = false,
  src,
}: {
  name: string
  color: string
  size?: number
  saved?: boolean
  src?: string
}) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: src ? undefined : `linear-gradient(135deg, ${color}, ${color}99)`,
      }}
    >
      {src ? (
        <img className="avatar-img" src={src} alt={name} />
      ) : saved ? (
        <Bookmark size={size * 0.45} fill="currentColor" />
      ) : (
        initials(name)
      )}
    </div>
  )
}
