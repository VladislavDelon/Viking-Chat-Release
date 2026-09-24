import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Pin, PinOff, Search, Snowflake, Users, X, Lock } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'
import { dayLabel } from '../lib/format'

export function ChatWindow() {
  const {
    chats,
    users,
    user,
    messages,
    activeChatId,
    typing,
    openChat,
    send,
    togglePin,
    toast,
  } = useStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const chat = chats.find(c => c.id === activeChatId)

  const list = useMemo(() => {
    const all = messages[chat?.id ?? ''] ?? []
    const needle = q.trim().toLowerCase()
    return needle ? all.filter(m => m.payload?.t.toLowerCase().includes(needle)) : all
  }, [messages, chat?.id, q])

  const otherUser = useMemo(() => {
    if (!chat || chat.kind !== 'direct') return null
    const otherId = chat.memberIds.find(id => id !== user?.id)
    return users.find(u => u.id === otherId) ?? null
  }, [chat, users, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [list.length, typing])

  useEffect(() => {
    setSearchOpen(false)
    setQ('')
  }, [activeChatId])

  if (!chat) {
    return (
      <main className="chat-empty">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="empty-hero"
        >
          <Snowflake size={64} />
          <h2>Frozen Chat</h2>
          <p>Выберите чат или создайте новый</p>
          <span className="e2e-note">
            <Lock size={13} /> Сквозное шифрование · данные хранятся в облаке
          </span>
        </motion.div>
      </main>
    )
  }

  const isSaved = chat.kind === 'direct' && chat.memberIds.length === 1
  const subtitle =
    chat.id in typing
      ? `${typing[chat.id]} печатает…`
      : chat.kind === 'group'
        ? `${chat.memberIds.length} участн.`
        : chat.kind === 'channel'
          ? `${chat.memberIds.length} подписч.`
          : isSaved
            ? 'облачное хранилище'
            : otherUser?.bot
              ? 'бот · онлайн'
              : 'онлайн'
  const canWrite = chat.kind !== 'channel' || chat.ownerId === user?.id

  let lastDay = ''
  let lastSender = ''

  return (
    <main className="chat-window">
      <div className="chat-head">
        <button className="icon-btn back-btn" onClick={() => openChat(null)}>
          <ArrowLeft size={20} />
        </button>
        <Avatar name={chat.title} color={chat.color} size={40} saved={isSaved} />
        <div className="chat-head-info">
          <div className="chat-head-title">{chat.title}</div>
          <div className={`chat-head-sub ${chat.id in typing ? 'typing' : ''}`}>{subtitle}</div>
        </div>
        <div className="chat-head-actions">
          <button
            className={`icon-btn ${searchOpen ? 'on' : ''}`}
            title="Поиск по чату"
            onClick={() => {
              setSearchOpen(v => !v)
              setQ('')
            }}
          >
            <Search size={18} />
          </button>
          <button className="icon-btn" title="Закрепить" onClick={() => togglePin(chat.id)}>
            {chat.pinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="inchat-search"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <Search size={15} />
            <input
              autoFocus
              placeholder="Поиск в этом чате"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && <span className="search-count">{list.length}</span>}
            <button
              className="icon-btn"
              onClick={() => {
                setSearchOpen(false)
                setQ('')
              }}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="messages">
        {chat.description && <div className="chat-desc">{chat.description}</div>}
        <AnimatePresence initial={false}>
          {list.map(m => {
            const day = dayLabel(m.createdAt)
            const showDay = day !== lastDay
            lastDay = day
            const mine = m.senderId === user?.id
            const sender = users.find(u => u.id === m.senderId)
            const showSender =
              chat.kind === 'group' && !mine && (showDay || lastSender !== m.senderId)
            lastSender = m.senderId
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="day-sep">
                    <span>{day}</span>
                  </div>
                )}
                <MessageBubble
                  m={m}
                  mine={mine}
                  showSender={showSender}
                  senderName={sender?.name ?? '—'}
                  senderColor={sender?.color ?? '#888'}
                  highlight={!!q.trim()}
                />
              </div>
            )
          })}
        </AnimatePresence>

        {chat.id in typing && (
          <motion.div className="msg-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bubble typing-bubble">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {canWrite ? (
        <Composer
          placeholder={chat.kind === 'channel' ? 'Новая публикация…' : 'Сообщение'}
          onSend={(t, a) => void send(chat.id, t, a)}
          onFileTooBig={name => toast('Файл слишком большой', `${name}: максимум 8 МБ`)}
        />
      ) : (
        <div className="readonly-bar">
          <Users size={15} /> Писать в канал могут только владельцы
        </div>
      )}
    </main>
  )
}
