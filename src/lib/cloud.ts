import type { Chat, Message, ReadMarker, User } from '../types'

/**
 * CloudRepository — the app's only gateway to persisted data.
 * Backed by localStorage so the demo runs with zero infrastructure;
 * every method is async and returns copies, so a real REST/WebSocket
 * backend can be dropped in without touching the rest of the app.
 * All message payloads are ciphertext by the time they reach this layer.
 */

const NS = 'vikingcloud'
const key = (c: string) => `${NS}.${c}`

function read<T>(c: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(c))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(c: string, v: T) {
  try {
    localStorage.setItem(key(c), JSON.stringify(v))
  } catch {
    // localStorage quota exceeded — attachments too large, etc.
  }
}

const listeners = new Set<() => void>()

export const cloud = {
  onExternalChange(cb: () => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(NS)) cb()
    }
    window.addEventListener('storage', handler)
    listeners.add(cb)
    return () => {
      window.removeEventListener('storage', handler)
      listeners.delete(cb)
    }
  },

  async users(): Promise<User[]> {
    return read<User[]>('users', [])
  },
  async saveUser(u: User) {
    const users = read<User[]>('users', [])
    const i = users.findIndex(x => x.id === u.id)
    if (i >= 0) users[i] = u
    else users.push(u)
    write('users', users)
  },
  async userByLogin(login: string): Promise<User | undefined> {
    return read<User[]>('users', []).find(
      u => u.login.toLowerCase() === login.toLowerCase(),
    )
  },

  async chats(): Promise<Chat[]> {
    return read<Chat[]>('chats', [])
  },
  async saveChat(c: Chat) {
    const chats = read<Chat[]>('chats', [])
    const i = chats.findIndex(x => x.id === c.id)
    if (i >= 0) chats[i] = c
    else chats.push(c)
    write('chats', chats)
  },

  async messages(chatId?: string): Promise<Message[]> {
    const all = read<Message[]>('messages', [])
    return chatId ? all.filter(m => m.chatId === chatId) : all
  },
  async appendMessage(m: Message) {
    const all = read<Message[]>('messages', [])
    all.push(m)
    write('messages', all)
  },
  async deleteMessage(id: string) {
    write(
      'messages',
      read<Message[]>('messages', []).filter(m => m.id !== id),
    )
  },
  async updateMessage(m: Message) {
    const all = read<Message[]>('messages', [])
    const i = all.findIndex(x => x.id === m.id)
    if (i >= 0) {
      all[i] = m
      write('messages', all)
    }
  },

  async reads(): Promise<ReadMarker[]> {
    return read<ReadMarker[]>('reads', [])
  },
  async markRead(chatId: string, userId: string, at: number) {
    const reads = read<ReadMarker[]>('reads', [])
    const i = reads.findIndex(r => r.chatId === chatId && r.userId === userId)
    if (i >= 0) reads[i].lastReadAt = at
    else reads.push({ chatId, userId, lastReadAt: at })
    write('reads', reads)
  },
}
