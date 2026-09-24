export function timeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (sameDay) return 'Сегодня'
  if (d.toDateString() === y.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function listTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return timeShort(ts)
  const diff = (now.getTime() - d.getTime()) / 86400000
  if (diff < 7)
    return d.toLocaleDateString('ru-RU', { weekday: 'short' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

import type { Chat, User } from '../types'

/** Resolves how a chat looks in lists/headers — direct chats mirror the other member's profile. */
export function chatDisplay(
  chat: Chat,
  users: User[],
  myId: string | undefined,
): { title: string; color: string; avatar?: string; saved: boolean } {
  const saved = chat.kind === 'direct' && chat.memberIds.length === 1
  if (chat.kind === 'direct' && !saved) {
    const other = users.find(u => u.id === chat.memberIds.find(id => id !== myId))
    if (other) return { title: other.name, color: other.color, avatar: other.avatar, saved }
  }
  return { title: chat.title, color: chat.color, saved }
}
