import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Users, Megaphone, MessageCircle, Check, Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import { cloud } from '../lib/cloud'
import { Avatar } from './Avatar'
import type { Chat, ChatKind, User } from '../types'

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const { user, chats, createChat, joinChannel, openChat } = useStore()
  const [kind, setKind] = useState<ChatKind>('direct')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [channels, setChannels] = useState<Chat[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    void cloud.users().then(setAllUsers)
    void cloud.channels().then(setChannels)
  }, [])

  // people are private — they only appear after you actually search for them
  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '')
    if (!q) return []
    return allUsers
      .filter(
        u =>
          u.id !== user?.id &&
          !u.bot &&
          u.login.toLowerCase() !== user?.login.toLowerCase(),
      )
      .filter(u => u.login.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [allUsers, query, user?.id, user?.login])

  // public channels can be browsed — they are public by definition
  const channelList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return channels
      .filter(c => !q || c.title.toLowerCase().includes(q))
      .slice(0, 30)
  }, [channels, query])

  const existingDirect = (contactId: string) =>
    chats.find(
      c => c.kind === 'direct' && c.memberIds.includes(contactId) && c.memberIds.includes(user!.id),
    )

  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  async function create() {
    if (kind === 'direct') {
      const other = selected[0]
      if (!other) return
      const existing = existingDirect(other)
      if (existing) {
        openChat(existing.id)
        onClose()
        return
      }
      const contact = allUsers.find(c => c.id === other)
      await createChat('direct', contact?.name ?? 'Чат', [other])
    } else {
      await createChat(kind, title || (kind === 'group' ? 'Новая группа' : 'Новый канал'), selected)
    }
    onClose()
  }

  async function openChannel(c: Chat) {
    const mine = chats.find(x => x.id === c.id)
    if (mine) openChat(mine.id)
    else await joinChannel(c)
    onClose()
  }

  const canCreate =
    (kind === 'direct' && selected.length === 1) ||
    (kind === 'group' && selected.length >= 1) ||
    (kind === 'channel' && title.trim().length > 0)

  return createPortal(
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Новый чат</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="kind-tabs">
          <button className={kind === 'direct' ? 'active' : ''} onClick={() => setKind('direct')}>
            <MessageCircle size={15} /> Личный
          </button>
          <button className={kind === 'group' ? 'active' : ''} onClick={() => setKind('group')}>
            <Users size={15} /> Группа
          </button>
          <button className={kind === 'channel' ? 'active' : ''} onClick={() => setKind('channel')}>
            <Megaphone size={15} /> Канал
          </button>
        </div>

        <div className="search-box inset">
          <Search size={15} />
          <input
            placeholder={kind === 'channel' ? 'Поиск канала' : 'Поиск по никнейму'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {kind === 'group' && (
          <input
            className="input"
            placeholder="Название группы"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        )}

        {kind === 'channel' && (
          <input
            className="input"
            placeholder="Название нового канала"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        )}

        {kind !== 'channel' && (
          <div className="contact-list">
            {contacts.map(c => (
              <button
                key={c.id}
                className={`contact ${selected.includes(c.id) ? 'selected' : ''}`}
                onClick={() => (kind === 'direct' ? setSelected([c.id]) : toggle(c.id))}
              >
                <Avatar name={c.name} color={c.color} size={38} src={c.avatar} />
                <div className="contact-info">
                  <span>{c.name}</span>
                  <span className="contact-login">@{c.login}</span>
                </div>
                {selected.includes(c.id) && <Check size={17} className="check" />}
              </button>
            ))}
            {!query.trim() && (
              <p className="empty-list">Введите никнейм — подходящие люди появятся здесь</p>
            )}
            {query.trim() && contacts.length === 0 && (
              <p className="empty-list">Пользователь не найден</p>
            )}
          </div>
        )}

        {kind === 'channel' && channelList.length > 0 && (
          <div className="contact-list">
            {channelList.map(c => (
              <button key={c.id} className="contact" onClick={() => openChannel(c)}>
                <Avatar name={c.title} color={c.color} size={38} />
                <div className="contact-info">
                  <span>{c.title}</span>
                  <span className="contact-login">
                    {c.memberIds.length} подписчик(ов)
                  </span>
                </div>
                <Megaphone size={15} className="check" />
              </button>
            ))}
          </div>
        )}

        <button className="btn primary" disabled={!canCreate} onClick={create}>
          {kind === 'direct' ? 'Начать чат' : 'Создать'}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
