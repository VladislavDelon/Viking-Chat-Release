import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Пароль',
  onEnter,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onEnter?: () => void
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pwd-wrap">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
      />
      <button
        type="button"
        className="pwd-eye"
        tabIndex={-1}
        onClick={() => setShow(v => !v)}
        title={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
