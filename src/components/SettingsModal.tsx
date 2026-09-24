import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  ShieldCheck,
  Palette,
} from 'lucide-react'
import { accountKeyFor, useStore } from '../store/useStore'
import { Avatar } from './Avatar'
import { fileToAvatar } from '../lib/image'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, theme, setTheme, updateProfile, changeLogin, changePassword, logout, toast } =
    useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [login, setLogin] = useState(user?.login ?? '')
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [pwdErr, setPwdErr] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null
  const accountKey = accountKeyFor(user.login) ?? '—'

  async function pickAvatar(f: File | undefined) {
    if (!f) return
    try {
      const dataUrl = await fileToAvatar(f)
      await updateProfile({ avatar: dataUrl })
      toast('Фото обновлено', 'Аватар сохранён в облаке')
    } catch {
      toast('Ошибка', 'Не удалось прочитать изображение')
    }
  }

  async function saveProfile() {
    setBusy(true)
    setProfileErr(null)
    if (login.trim() !== user!.login) {
      const err = await changeLogin(login)
      if (err) {
        setProfileErr(err)
        setBusy(false)
        return
      }
    }
    await updateProfile({ name, bio })
    setBusy(false)
    toast('Профиль сохранён', 'Изменения применены')
  }

  async function savePassword() {
    setBusy(true)
    setPwdErr(null)
    const err = await changePassword(curPwd, newPwd)
    setBusy(false)
    if (err) setPwdErr(err)
    else {
      setCurPwd('')
      setNewPwd('')
      toast('Пароль изменён', 'При следующем входе используйте новый пароль')
    }
  }

  const copyKey = () => {
    void navigator.clipboard?.writeText(accountKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal settings"
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Настройки</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="set-section">
          <div className="set-title">
            <UserIcon size={15} /> Профиль
          </div>
          <div className="set-profile">
            <button className="avatar-edit" onClick={() => fileRef.current?.click()}>
              <Avatar name={user.name} color={user.color} size={76} src={user.avatar} />
              <span className="avatar-edit-badge">
                <Camera size={14} />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => void pickAvatar(e.target.files?.[0])}
            />
            <div className="set-profile-fields">
              <input
                className="input"
                placeholder="Имя"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="input"
                placeholder="О себе"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
              <input
                className="input mono"
                placeholder="Логин"
                value={login}
                onChange={e => setLogin(e.target.value)}
              />
            </div>
          </div>
          {profileErr && <div className="auth-error">{profileErr}</div>}
          <button className="btn primary" disabled={busy} onClick={saveProfile}>
            Сохранить профиль
          </button>
        </div>

        <div className="set-section">
          <div className="set-title">
            <ShieldCheck size={15} /> Безопасность
          </div>
          <input
            className="input"
            type="password"
            placeholder="Текущий пароль"
            value={curPwd}
            onChange={e => setCurPwd(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Новый пароль"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
          />
          {pwdErr && <div className="auth-error">{pwdErr}</div>}
          <button
            className="btn primary"
            disabled={busy || !curPwd || !newPwd}
            onClick={savePassword}
          >
            Сменить пароль
          </button>

          <div className="key-row">
            <KeyRound size={15} />
            <span className="mono key-value">{showKey ? accountKey : '•'.repeat(24)}</span>
            <button className="icon-btn" onClick={() => setShowKey(v => !v)} title="Показать ключ">
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button className="icon-btn" onClick={copyKey} title="Скопировать">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p className="modal-hint">
            Ключ аккаунта нужен для входа на новом устройстве — он расшифровывает облачные данные.
          </p>
        </div>

        <div className="set-section">
          <div className="set-title">
            <Palette size={15} /> Внешний вид
          </div>
          <div className="theme-switch">
            <button
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon size={15} /> Тёмная
            </button>
            <button
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun size={15} /> Светлая
            </button>
          </div>
        </div>

        <button className="btn danger" onClick={logout}>
          <LogOut size={16} /> Выйти из аккаунта
        </button>
      </motion.div>
    </motion.div>
  )
}
