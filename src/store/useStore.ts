import { create } from 'zustand'
import { cloud } from '../lib/cloud'
import {
  Vault,
  generateAccountKey,
  hashPassword,
  normalizeAccountKey,
  randomSalt,
  uid,
  colorFor,
} from '../lib/crypto'
import { BOT_REPLIES, seedFor } from '../lib/seed'
import type {
  Attachment,
  Chat,
  ChatKind,
  Message,
  MessagePayload,
  ReadMarker,
  Theme,
  Toast,
  User,
} from '../types'

const LS_KEY = (login: string) => `frozen.key.${login.toLowerCase()}`
const LS_SESSION = 'frozen.session'
const LS_THEME = 'frozen.theme'

interface State {
  ready: boolean
  user: User | null
  vault: Vault | null
  users: User[]
  chats: Chat[]
  messages: Record<string, Message[]>
  reads: ReadMarker[]
  activeChatId: string | null
  theme: Theme
  toasts: Toast[]
  typing: Record<string, string> // chatId -> name
  needKeyFor: string | null // login waiting for account key (new device)
  authError: string | null

  init: () => Promise<void>
  register: (login: string, name: string, password: string) => Promise<{ ok: boolean; key?: string; error?: string }>
  login: (login: string, password: string) => Promise<string | null>
  submitKey: (key: string) => Promise<boolean>
  logout: () => void

  openChat: (chatId: string | null) => void
  send: (chatId: string, text: string, attachments: Attachment[]) => Promise<void>
  removeMessage: (id: string) => Promise<void>
  createChat: (kind: ChatKind, title: string, memberIds: string[]) => Promise<Chat>
  togglePin: (chatId: string) => Promise<void>
  setTheme: (t: Theme) => void
  toast: (title: string, body: string) => void
  dismissToast: (id: string) => void
  refresh: () => Promise<void>
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<State>((set, get) => {
  async function decryptAll(vault: Vault, msgs: Message[]): Promise<Record<string, Message[]>> {
    const byChat: Record<string, Message[]> = {}
    for (const m of msgs) {
      try {
        m.payload = await vault.decryptJson<MessagePayload>(m.enc)
      } catch {
        m.failed = true
        m.payload = { t: '🔒 Не удалось расшифровать сообщение' }
      }
      ;(byChat[m.chatId] ??= []).push(m)
    }
    for (const list of Object.values(byChat)) list.sort((a, b) => a.createdAt - b.createdAt)
    return byChat
  }

  async function loadAll() {
    const { vault } = get()
    if (!vault) return
    const [users, chats, msgs, reads] = await Promise.all([
      cloud.users(),
      cloud.chats(),
      cloud.messages(),
      cloud.reads(),
    ])
    set({
      users,
      chats: chats.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)),
      messages: await decryptAll(vault, msgs),
      reads,
    })
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void loadAll(), 150)
  }

  function notify(title: string, body: string) {
    get().toast(title, body)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/snowflake.svg' })
      } catch {
        /* unsupported */
      }
    }
  }

  async function pushMessage(
    chatId: string,
    senderId: string,
    payload: MessagePayload,
    status: Message['status'] = 'sent',
  ): Promise<Message> {
    const { vault } = get()
    const m: Message = {
      id: uid(),
      chatId,
      senderId,
      createdAt: Date.now(),
      enc: vault ? await vault.encryptJson(payload) : '',
      status,
      payload,
    }
    await cloud.appendMessage(m)
    set(s => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), m],
      },
    }))
    return m
  }

  function scheduleBotReply(chat: Chat, myId: string) {
    const botId = chat.memberIds.find(id => id !== myId)
    const bot = get().users.find(u => u.id === botId)
    if (!bot?.bot) return
    set(s => ({ typing: { ...s.typing, [chat.id]: bot.name } }))
    setTimeout(
      async () => {
        set(s => {
          const t = { ...s.typing }
          delete t[chat.id]
          return { typing: t }
        })
        const text = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)]
        await pushMessage(chat.id, bot.id, { t: text }, 'delivered')
        const st = get()
        if (st.activeChatId !== chat.id) {
          notify(bot.name, text)
        } else {
          await cloud.markRead(chat.id, myId, Date.now())
          set({ reads: await cloud.reads() })
        }
      },
      1400 + Math.random() * 1600,
    )
  }

  return {
    ready: false,
    user: null,
    vault: null,
    users: [],
    chats: [],
    messages: {},
    reads: [],
    activeChatId: null,
    theme: (localStorage.getItem(LS_THEME) as Theme) || 'dark',
    toasts: [],
    typing: {},
    needKeyFor: null,
    authError: null,

    async init() {
      cloud.onExternalChange(scheduleRefresh)
      const login = localStorage.getItem(LS_SESSION)
      const accountKey = login ? localStorage.getItem(LS_KEY(login)) : null
      if (login && accountKey) {
        const u = await cloud.userByLogin(login)
        if (u) {
          const vault = await Vault.fromAccountKey(accountKey)
          set({ user: u, vault, ready: true })
          await loadAll()
          return
        }
      }
      set({ ready: true })
    },

    async register(login, name, password) {
      login = login.trim()
      name = name.trim() || login
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(login))
        return { ok: false, error: 'Логин: 3–24 символа, латиница, цифры, _ . -' }
      if (password.length < 4) return { ok: false, error: 'Пароль: минимум 4 символа' }
      if (await cloud.userByLogin(login)) return { ok: false, error: 'Такой логин уже занят' }

      const accountKey = generateAccountKey()
      const salt = randomSalt()
      const user: User = {
        id: uid(),
        login,
        name,
        color: colorFor(login),
        passwordHash: await hashPassword(password, salt),
        salt,
        createdAt: Date.now(),
      }
      await cloud.saveUser(user)
      localStorage.setItem(LS_KEY(login), accountKey)
      const vault = await Vault.fromAccountKey(accountKey)
      set({ user, vault, authError: null })
      await seedFor(user, vault)
      await loadAll()
      localStorage.setItem(LS_SESSION, login)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
      return { ok: true, key: accountKey }
    },

    async login(login, password) {
      const u = await cloud.userByLogin(login.trim())
      if (!u) return 'Пользователь не найден'
      if ((await hashPassword(password, u.salt)) !== u.passwordHash) return 'Неверный пароль'
      const accountKey = localStorage.getItem(LS_KEY(u.login))
      if (!accountKey) {
        set({ needKeyFor: u.login, authError: null })
        return null // device has no key — ask for it (new-device restore flow)
      }
      const vault = await Vault.fromAccountKey(accountKey)
      set({ user: u, vault, authError: null })
      await loadAll()
      localStorage.setItem(LS_SESSION, u.login)
      return null
    },

    async submitKey(key) {
      const { needKeyFor } = get()
      if (!needKeyFor) return false
      const normalized = normalizeAccountKey(key)
      if (!/^FRZN(-[A-Z0-9]{4,6})+$/.test(normalized) && normalized.length < 10) return false
      const u = await cloud.userByLogin(needKeyFor)
      if (!u) return false
      const vault = await Vault.fromAccountKey(normalized)
      localStorage.setItem(LS_KEY(u.login), normalized)
      set({ user: u, vault, needKeyFor: null, authError: null })
      await loadAll()
      localStorage.setItem(LS_SESSION, u.login)
      return true
    },

    logout() {
      localStorage.removeItem(LS_SESSION)
      set({ user: null, vault: null, activeChatId: null, chats: [], messages: {}, reads: [] })
    },

    openChat(chatId) {
      set({ activeChatId: chatId })
      const { user } = get()
      if (chatId && user) {
        void cloud.markRead(chatId, user.id, Date.now()).then(async () => {
          set({ reads: await cloud.reads() })
        })
      }
    },

    async send(chatId, text, attachments) {
      const { user, chats } = get()
      const chat = chats.find(c => c.id === chatId)
      if (!user || !chat) return
      const payload: MessagePayload = { t: text.trim(), a: attachments.length ? attachments : undefined }
      await pushMessage(chatId, user.id, payload)
      await cloud.markRead(chatId, user.id, Date.now())
      set({ reads: await cloud.reads() })
      if (chat.kind === 'direct') scheduleBotReply(chat, user.id)
    },

    async removeMessage(id) {
      await cloud.deleteMessage(id)
      set(s => {
        const messages = { ...s.messages }
        for (const k of Object.keys(messages))
          messages[k] = messages[k].filter(m => m.id !== id)
        return { messages }
      })
    },

    async createChat(kind, title, memberIds) {
      const { user } = get()
      if (!user) throw new Error('not authed')
      const chat: Chat = {
        id: uid(),
        kind,
        title: title.trim() || 'Новый чат',
        memberIds: [...new Set([user.id, ...memberIds])],
        ownerId: user.id,
        color: colorFor(uid()),
        createdAt: Date.now(),
      }
      await cloud.saveChat(chat)
      if (kind !== 'direct') {
        const label = kind === 'group' ? 'группу' : 'канал'
        await pushMessage(chat.id, user.id, { t: `${user.name} создал(а) ${label} «${chat.title}» ❄️` })
      }
      await loadAll()
      set({ activeChatId: chat.id })
      return chat
    },

    async togglePin(chatId) {
      const chat = get().chats.find(c => c.id === chatId)
      if (!chat) return
      chat.pinned = !chat.pinned
      await cloud.saveChat(chat)
      set(s => ({
        chats: [...s.chats].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)),
      }))
    },

    setTheme(t) {
      localStorage.setItem(LS_THEME, t)
      set({ theme: t })
    },

    toast(title, body) {
      const id = uid()
      set(s => ({ toasts: [...s.toasts, { id, title, body }] }))
      setTimeout(() => get().dismissToast(id), 4200)
    },

    dismissToast(id) {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    },

    async refresh() {
      await loadAll()
    },
  }
})

export function useUnread(chatId: string): number {
  return useStore(s => {
    const me = s.user?.id
    if (!me) return 0
    const marker = s.reads.find(r => r.chatId === chatId && r.userId === me)
    const at = marker?.lastReadAt ?? 0
    return (s.messages[chatId] ?? []).filter(m => m.createdAt > at && m.senderId !== me).length
  })
}
