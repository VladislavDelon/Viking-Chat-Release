import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Snowflake, Copy, Check, KeyRound, LogIn, UserPlus, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { login, register, submitKey, needKeyFor } = useStore()
  const [mode, setMode] = useState<Mode>('login')
  const [loginV, setLoginV] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const flakes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 12,
        dur: 9 + Math.random() * 10,
        size: 8 + Math.random() * 16,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [],
  )

  async function doLogin() {
    setBusy(true)
    setError(null)
    const err = await login(loginV, password)
    setBusy(false)
    if (err) setError(err)
  }

  async function doRegister() {
    setBusy(true)
    setError(null)
    const res = await register(loginV, name, password)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Ошибка регистрации')
    else if (res.key) setNewKey(res.key)
  }

  async function doKey() {
    setBusy(true)
    const ok = await submitKey(keyInput)
    setBusy(false)
    if (!ok) setError('Неверный ключ аккаунта')
  }

  const copy = () => {
    if (newKey) {
      void navigator.clipboard?.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="auth-bg">
      {flakes.map(f => (
        <span
          key={f.id}
          className="snow"
          style={{
            left: `${f.left}%`,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.dur}s`,
            fontSize: f.size,
            opacity: f.opacity,
          }}
        >
          ❄
        </span>
      ))}

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="auth-logo">
          <Snowflake size={34} />
        </div>
        <h1>Frozen Chat</h1>
        <p className="auth-sub">Защищённый облачный мессенджер</p>

        <AnimatePresence mode="wait">
          {needKeyFor ? (
            <motion.div
              key="key"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="key-banner">
                <ShieldCheck size={18} />
                На этом устройстве нет ключа аккаунта <b>@{needKeyFor}</b>. Введите ключ, чтобы
                расшифровать облачные данные.
              </div>
              <input
                className="input mono"
                placeholder="FRZN-XXXX-XXXX-XXXX-XXXX-XXXX"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doKey()}
              />
              {error && <div className="auth-error">{error}</div>}
              <button className="btn primary" disabled={busy} onClick={doKey}>
                <KeyRound size={17} /> Расшифровать и войти
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="auth-tabs">
                <button
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                >
                  Вход
                </button>
                <button
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                >
                  Регистрация
                </button>
              </div>

              <input
                className="input"
                placeholder="Логин"
                value={loginV}
                autoFocus
                onChange={e => setLoginV(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? doLogin() : doRegister())}
              />
              {mode === 'register' && (
                <input
                  className="input"
                  placeholder="Имя (как вас видят другие)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              )}
              <input
                className="input"
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? doLogin() : doRegister())}
              />
              {error && <div className="auth-error">{error}</div>}

              <button
                className="btn primary"
                disabled={busy || !loginV || !password}
                onClick={mode === 'login' ? doLogin : doRegister}
              >
                {mode === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}
                {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </button>
              <div className="auth-hint">
                <KeyRound size={13} /> Ключ аккаунта создаётся при регистрации и хранится локально —
                он понадобится для входа на новом устройстве.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {newKey && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal key-modal"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <ShieldCheck size={40} className="key-icon" />
              <h2>Ваш ключ аккаунта</h2>
              <p>
                Он уже сохранён на этом устройстве. Запишите его — без него не восстановить доступ и
                не расшифровать переписку на новом устройстве.
              </p>
              <div className="key-box mono">
                {newKey}
                <button className="icon-btn" onClick={copy} title="Скопировать">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button className="btn primary" onClick={() => setNewKey(null)}>
                Я сохранил ключ
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
