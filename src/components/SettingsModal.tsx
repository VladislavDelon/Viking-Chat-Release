import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  Cloud,
  Download,
  Trash2,
} from 'lucide-react'
import { accountKeyFor, useStore } from '../store/useStore'
import { isDefaultSync, loadSyncConfig } from '../lib/github'
import { downloadAccountKey } from '../lib/download'
import { Avatar } from './Avatar'
import { PasswordInput } from './PasswordInput'
import { fileToAvatar } from '../lib/image'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    user,
    theme,
    setTheme,
    updateProfile,
    changeLogin,
    changePassword,
    logout,
    toast,
    connectSync,
    disconnectSync,
    deleteAccount,
  } = useStore()
  const syncCfg = loadSyncConfig()
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
  const [syncRepo, setSyncRepo] = useState(syncCfg?.repo ?? 'VladislavDelon/Viking-Chat-Closed')
  const [syncToken, setSyncToken] = useState(syncCfg?.token ?? '')
  const [syncErr, setSyncErr] = useState<string | null>(null)
  const [synced, setSynced] = useState(!!syncCfg)
  const [isDefault, setIsDefault] = useState(isDefaultSync(syncCfg))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [delPwd, setDelPwd] = useState('')
  const [delErr, setDelErr] = useState<string | null>(null)
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

  async function doDelete() {
    setBusy(true)
    setDelErr(null)
    const err = await deleteAccount(delPwd)
    if (err) {
      setDelErr(err)
      setBusy(false)
    }
    // on success the store resets → modal unmounts with the app shell
  }

  const copyKey = () => {
    void navigator.clipboard?.writeText(accountKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  async function saveSync() {
    setBusy(true)
    setSyncErr(null)
    const err = await connectSync(
      syncToken.trim() && syncRepo.trim()
        ? { token: syncToken.trim(), repo: syncRepo.trim() }
        : null,
    )
    setBusy(false)
    if (err) setSyncErr(err)
    else {
      setSynced(true)
      setIsDefault(false)
      toast('Облако подключено', syncRepo.trim())
    }
  }

  async function disconnect() {
    setBusy(true)
    await disconnectSync()
    setSynced(false)
    setIsDefault(false)
    setBusy(false)
    toast('Синхронизация отключена', 'Данные хранятся только на этом устройстве')
  }

  return createPortal(
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
          <PasswordInput placeholder="Текущий пароль" value={curPwd} onChange={setCurPwd} />
          <PasswordInput
            placeholder="Новый пароль"
            value={newPwd}
            onChange={setNewPwd}
            onEnter={savePassword}
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
            <button
              className="icon-btn"
              onClick={() => downloadAccountKey(accountKey, user.login)}
              title="Скачать ключ файлом"
            >
              <Download size={15} />
            </button>
          </div>
          <p className="modal-hint">
            Ключ аккаунта нужен для входа на новом устройстве — он расшифровывает облачные данные.
            Автоматически не скачивается: хранится локально, скачать файлом можно кнопкой выше.
          </p>
        </div>

        <div className="set-section">
          <div className="set-title">
            <Cloud size={15} /> Облачная синхронизация
            <span className={`sync-dot ${synced ? 'on' : ''}`} />
          </div>
          {synced ? (
            <>
              <p className="modal-hint" style={{ marginTop: 0 }}>
                ✓ Данные хранятся в приватном репозитории <b className="mono">{syncRepo}</b> в
                зашифрованном виде и синхронизируются между устройствами каждые ~15 сек.
                {isDefault && ' Подключено по умолчанию — на другом устройстве просто войдите.'}
              </p>
              <details className="sync-details">
                <summary>Свои настройки облака</summary>
                <input
                  className="input mono"
                  placeholder="owner/repo"
                  value={syncRepo}
                  onChange={e => setSyncRepo(e.target.value)}
                />
                <PasswordInput
                  placeholder="GitHub token (repo)"
                  value={syncToken}
                  onChange={setSyncToken}
                />
                {syncErr && <div className="auth-error">{syncErr}</div>}
                <button className="btn primary" disabled={busy} onClick={saveSync}>
                  Обновить подключение
                </button>
              </details>
              <button className="btn danger" disabled={busy} onClick={disconnect}>
                Отключить синхронизацию
              </button>
            </>
          ) : (
            <>
              <p className="modal-hint" style={{ marginTop: 0 }}>
                Синхронизация отключена — данные хранятся только на этом устройстве.
              </p>
              <input
                className="input mono"
                placeholder="owner/repo"
                value={syncRepo}
                onChange={e => setSyncRepo(e.target.value)}
              />
              <PasswordInput
                placeholder="GitHub token (repo)"
                value={syncToken}
                onChange={setSyncToken}
                onEnter={saveSync}
              />
              {syncErr && <div className="auth-error">{syncErr}</div>}
              <button className="btn primary" disabled={busy} onClick={saveSync}>
                Подключить облако
              </button>
            </>
          )}
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

        <div className="set-section danger-zone">
          <div className="set-title">
            <Trash2 size={15} /> Опасная зона
          </div>
          {!confirmDelete ? (
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Удалить аккаунт
            </button>
          ) : (
            <>
              <p className="modal-hint">
                Аккаунт, все чаты и сообщения будут удалены из облака безвозвратно. Введите пароль
                для подтверждения.
              </p>
              <PasswordInput
                placeholder="Пароль"
                value={delPwd}
                onChange={setDelPwd}
                onEnter={doDelete}
              />
              {delErr && <div className="auth-error">{delErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
                  onClick={() => {
                    setConfirmDelete(false)
                    setDelPwd('')
                    setDelErr(null)
                  }}
                >
                  Отмена
                </button>
                <button
                  className="btn danger solid"
                  disabled={busy || !delPwd}
                  onClick={doDelete}
                >
                  Удалить навсегда
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
