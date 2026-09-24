import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ship,
  Search,
  Plus,
  Sun,
  Moon,
  Settings,
  Pin,
  Users,
  Megaphone,
  MessageCircle,
} from 'lucide-react'
import { useStore, useUnread } from '../store/useStore'
import { Avatar } from './Avatar'
import { chatDisplay, listTime } from '../lib/format'
import type { Chat, ChatKind } from '../types'
import { NewChatModal } from './NewChatModal'
import { SettingsModal } from './SettingsModal'

const FILTERS: { id: ChatKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'direct', label: 'Личные' },
  { id: 'group', label: 'Группы' },
  { id: 'channel', label: 'Каналы' },
]

function chatIcon(kind: ChatKind) {
  if (kind === 'group') return <Users size={12} />
  if (kind === 'channel') return <Megaphone size={12} />
  return null
}

function ChatItem({ chat, active }: { chat: Chat; active: boolean }) {
  const { openChat, messages, users, user } = useStore()
  const unread = useUnread(chat.id)
  const list = messages[chat.id] ?? []
  const last = list[list.length - 1]
  const disp = chatDisplay(chat, users, user?.id)
  const preview = last?.payload?.a?.length
    ? `📎 ${last.payload.a[0].kind === 'image' ? 'Фото' : last.payload.a[0].kind === 'video' ? 'Видео' : 'Файл'}`
    : (last?.payload?.t ?? '')
  const mine = last?.senderId === user?.id

  return (
    <motion.button
      className={`chat-item ${active ? 'active' : ''}`}
      onClick={() => openChat(chat.id)}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Avatar name={disp.title} color={disp.color} saved={disp.saved} src={disp.avatar} />
      <div className="chat-item-main">
        <div className="chat-item-top">
          <span className="chat-title">
            {chatIcon(chat.kind)} {disp.title}
          </span>
          {last && <span className="chat-time">{listTime(last.createdAt)}</span>}
        </div>
        <div className="chat-item-bottom">
          <span className="chat-preview">
            {mine && last ? 'Вы: ' : ''}
            {preview || 'Нет сообщений'}
          </span>
          {chat.pinned && <Pin size={13} className="pin-icon" />}
          {unread > 0 && <span className="unread">{unread}</span>}
        </div>
      </div>
    </motion.button>
  )
}

export function Sidebar() {
  const { user, users, chats, messages, activeChatId, theme, setTheme, openChat } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ChatKind | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chats
      .filter(c => (filter === 'all' ? true : c.kind === filter))
      .filter(c => !q || c.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned)
        const la = messages[a.id]?.at(-1)?.createdAt ?? a.createdAt
        const lb = messages[b.id]?.at(-1)?.createdAt ?? b.createdAt
        return lb - la
      })
  }, [chats, messages, query, filter])

  const msgResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: { chat: Chat; text: string; ts: number }[] = []
    for (const c of chats) {
      for (const m of messages[c.id] ?? []) {
        const t = m.payload?.t ?? ''
        if (t.toLowerCase().includes(q)) out.push({ chat: c, text: t, ts: m.createdAt })
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 30)
  }, [chats, messages, query])

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <Ship size={22} className="brand-icon" />
          <span>Viking Chat</span>
        </div>
        <div className="head-actions">
          <button className="icon-btn" title="Новый чат" onClick={() => setShowNew(true)}>
            <Plus size={19} />
          </button>
          <button
            className="icon-btn"
            title="Тема"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn" title="Настройки" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="search-box">
        <Search size={16} />
        <input
          placeholder="Поиск чатов и сообщений"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={filter === f.id ? 'chip active' : 'chip'}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="chat-list">
        <AnimatePresence>
          {sorted.map(c => (
            <ChatItem key={c.id} chat={c} active={c.id === activeChatId} />
          ))}
        </AnimatePresence>
        {sorted.length === 0 && (
          <div className="empty-list">
            <MessageCircle size={28} />
            <p>Чаты не найдены</p>
          </div>
        )}
      </div>

      {query.trim() && msgResults.length > 0 && (
        <div className="msg-results">
          <div className="msg-results-title">Сообщения ({msgResults.length})</div>
          {msgResults.map((r, i) => (
            <button key={i} className="msg-result" onClick={() => openChat(r.chat.id)}>
              <span className="msg-result-chat">
                {chatDisplay(r.chat, users, user?.id).title}
              </span>
              <span className="msg-result-text">
                {r.text.length > 90 ? r.text.slice(0, 90) + '…' : r.text}
              </span>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>{showNew && <NewChatModal onClose={() => setShowNew(false)} />}</AnimatePresence>
      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </aside>
  )
}
