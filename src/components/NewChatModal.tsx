import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Users, Megaphone, MessageCircle, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Avatar } from './Avatar'
import type { ChatKind } from '../types'

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const { users, user, chats, createChat, openChat } = useStore()
  const [kind, setKind] = useState<ChatKind>('direct')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const contacts = users.filter(u => u.id !== user?.id)
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
      const contact = contacts.find(c => c.id === other)
      await createChat('direct', contact?.name ?? 'Чат', [other])
    } else {
      await createChat(kind, title || (kind === 'group' ? 'Новая группа' : 'Новый канал'), selected)
    }
    onClose()
  }

  const canCreate =
    (kind === 'direct' && selected.length === 1) ||
    (kind === 'group' && selected.length >= 1) ||
    (kind === 'channel' && title.trim().length > 0)

  return (
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

        {kind !== 'direct' && (
          <input
            className="input"
            placeholder={kind === 'group' ? 'Название группы' : 'Название канала'}
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
                <Avatar name={c.name} color={c.color} size={38} />
                <div className="contact-info">
                  <span>{c.name}</span>
                  <span className="contact-login">@{c.login.split('.')[0]}</span>
                </div>
                {selected.includes(c.id) && <Check size={17} className="check" />}
              </button>
            ))}
            {contacts.length === 0 && <p className="empty-list">Нет контактов</p>}
          </div>
        )}

        {kind === 'channel' && (
          <p className="modal-hint">
            Канал — для публикаций на неограниченную аудиторию. Писать могут только владельцы.
          </p>
        )}

        <button className="btn primary" disabled={!canCreate} onClick={create}>
          Создать
        </button>
      </motion.div>
    </motion.div>
  )
}
