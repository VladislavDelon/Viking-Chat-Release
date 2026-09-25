import { create } from 'zustand'
import { cloud } from '../lib/cloud'
import {
  loadSyncConfig,
  saveSyncConfig,
  disableSync,
  type SyncConfig,
} from '../lib/github'
import {
  Vault,
  generateAccountKey,
  hashPassword,
  normalizeAccountKey,
  randomSalt,
  uid,
  colorFor,
} from '../lib/crypto'
import { helpReply, seedFor } from '../lib/seed'
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

const LS_KEY = (login: string) => `viking.key.${login.toLowerCase()}`
const LS_SESSION = 'viking.session'
const LS_THEME = 'viking.theme'

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
  joinChannel: (channel: Chat) => Promise<void>
  togglePin: (chatId: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  updateProfile: (patch: { name?: string; bio?: string; avatar?: string }) => Promise<void>
  changeLogin: (newLogin: string, password: string) => Promise<string | null>
  changePassword: (current: string, next: string) => Promise<string | null>
  connectSync: (cfg: SyncConfig | null) => Promise<string | null>
  disconnectSync: () => Promise<void>
  deleteAccount: (password: string) => Promise<string | null>
  setTheme: (t: Theme) => void
  toast: (title: string, body: string) => void
  dismissToast: (id: string) => void
  refresh: () => Promise<void>
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<State>((set, get) => {
  const chatVaults = new Map<string, Promise<Vault>>()
  const chatVault = (chatId: string) => {
    let p = chatVaults.get(chatId)
    if (!p) {
      p = Vault.forChat(chatId)
      chatVaults.set(chatId, p)
    }
    return p
  }

  async function decryptAll(
    accountVault: Vault,
    msgs: Message[],
  ): Promise<Record<string, Message[]>> {
    const byChat: Record<string, Message[]> = {}
    for (const m of msgs) {
      try {
        // shared per-chat key — every member of the chat can decrypt
        m.payload = await (await chatVault(m.chatId)).decryptJson<MessagePayload>(m.enc)
      } catch {
        try {
          // legacy messages were sealed with the account vault
          m.payload = await accountVault.decryptJson<MessagePayload>(m.enc)
        } catch {
          m.failed = true
          m.payload = { t: '🔒 Не удалось расшифровать сообщение' }
        }
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

    // one-time migration: rewrite the old tech-jargon news post
    const { chats: cs, messages: mm } = get()
    const news = cs.find(c => c.kind === 'channel' && c.title === 'Viking News')
    if (news) {
      for (const m of mm[news.id] ?? []) {
        if (m.payload?.t?.includes('AES-256-GCM')) {
          const t =
            '⚔️ Viking Chat запущен! Личные чаты, группы и каналы, медиа, поиск, тёмная и светлая темы и сезонные анимации — уже здесь.'
          m.payload = { t }
          m.enc = await (await chatVault(news.id)).encryptJson({ t })
          void cloud.updateMessage(m, news.ownerLogin)
        }
      }
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void loadAll(), 150)
  }

  function notify(title: string, body: string) {
    get().toast(title, body)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/viking.svg' })
      } catch {
        /* unsupported */
      }
    }
  }

  async function pushMessage(
    chat: Chat,
    senderId: string,
    payload: MessagePayload,
    status: Message['status'] = 'sent',
  ): Promise<Message> {
    const { user } = get()
    const v = await chatVault(chat.id)
    const m: Message = {
      id: uid(),
      chatId: chat.id,
      senderId,
      createdAt: Date.now(),
      enc: await v.encryptJson(payload),
      status,
      payload,
    }
    await cloud.appendMessage(m, chat.ownerLogin ?? user?.login)
    set(s => ({
      messages: {
        ...s.messages,
        [chat.id]: [...(s.messages[chat.id] ?? []), m],
      },
    }))
    return m
  }

  function scheduleBotReply(chat: Chat, myId: string, userText: string) {
    const bot = get().users.find(u => u.bot && chat.memberIds.includes(u.id) && u.id !== myId)
    if (!bot) return
    set(s => ({ typing: { ...s.typing, [chat.id]: bot.name } }))
    setTimeout(
      async () => {
        set(s => {
          const t = { ...s.typing }
          delete t[chat.id]
          return { typing: t }
        })
        const text = helpReply(userText)
        await pushMessage(chat, bot.id, { t: text }, 'delivered')
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
      cloud.configure(loadSyncConfig(), null)
      cloud.onExternalChange(scheduleRefresh)
      const login = localStorage.getItem(LS_SESSION)
      const accountKey = login ? localStorage.getItem(LS_KEY(login)) : null
      if (login && accountKey) {
        cloud.configure(loadSyncConfig(), login)
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
      cloud.configure(loadSyncConfig(), login)
      await cloud.saveUser(user)
      localStorage.setItem(LS_KEY(login), accountKey)
      const vault = await Vault.fromAccountKey(accountKey)
      set({ user, vault, authError: null })
      await seedFor(user)
      await loadAll()
      localStorage.setItem(LS_SESSION, login)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
      return { ok: true, key: accountKey }
    },

    async login(login, password) {
      const u = await cloud.userByLogin(login.trim())
      if (!u) {
        cloud.configure(loadSyncConfig(), null)
        return 'Пользователь не найден'
      }
      cloud.configure(loadSyncConfig(), u.login)
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
      if (!/^(VKNG|FRZN)(-[A-Z0-9]{4,6})+$/.test(normalized) && normalized.length < 10)
        return false
      const u = await cloud.userByLogin(needKeyFor)
      if (!u) return false
      cloud.configure(loadSyncConfig(), u.login)
      const vault = await Vault.fromAccountKey(normalized)
      localStorage.setItem(LS_KEY(u.login), normalized)
      set({ user: u, vault, needKeyFor: null, authError: null })
      await loadAll()
      localStorage.setItem(LS_SESSION, u.login)
      return true
    },

    logout() {
      localStorage.removeItem(LS_SESSION)
      cloud.configure(loadSyncConfig(), null)
      set({ user: null, vault: null, activeChatId: null, chats: [], messages: {}, reads: [] })
    },

    async connectSync(cfg) {
      saveSyncConfig(cfg)
      const { user } = get()
      cloud.configure(cfg, user?.login ?? null)
      if (cfg && user) {
        try {
          await cloud.uploadAll(user)
          await loadAll()
          return null
        } catch (e) {
          saveSyncConfig(null)
          cloud.configure(null, user.login)
          return `Не удалось подключиться: ${String(e)}`
        }
      }
      if (user) await loadAll()
      return null
    },

    async disconnectSync() {
      disableSync()
      const { user } = get()
      cloud.configure(null, user?.login ?? null)
      if (user) await loadAll()
    },

    async deleteAccount(password) {
      const { user } = get()
      if (!user) return 'Нет сессии'
      if ((await hashPassword(password, user.salt)) !== user.passwordHash)
        return 'Неверный пароль'
      try {
        await cloud.deleteAccount(user.id)
      } catch {
        /* remote cleanup best-effort */
      }
      localStorage.removeItem(LS_KEY(user.login))
      localStorage.removeItem(LS_SESSION)
      for (const k of Object.keys(localStorage))
        if (k.startsWith('vikingcloud.')) localStorage.removeItem(k)
      set({ user: null, vault: null, activeChatId: null, chats: [], messages: {}, reads: [] })
      return null
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
      try {
        await pushMessage(chat, user.id, payload)
      } catch (e) {
        get().toast('Не отправлено', `Сообщение не сохранилось: ${String(e)}`)
        return
      }
      await cloud.markRead(chatId, user.id, Date.now())
      set({ reads: await cloud.reads() })
      if (chat.kind !== 'channel') scheduleBotReply(chat, user.id, text)
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
        ownerLogin: user.login,
        color: colorFor(uid()),
        createdAt: Date.now(),
      }
      await cloud.saveChat(chat)
      if (kind === 'channel') await cloud.registerChannel(chat)
      if (kind !== 'direct') {
        const label = kind === 'group' ? 'группу' : 'канал'
        await pushMessage(chat, user.id, { t: `${user.name} создал(а) ${label} «${chat.title}» ⚔️` })
      }
      await loadAll()
      set({ activeChatId: chat.id })
      return chat
    },

    async joinChannel(channel) {
      const { user } = get()
      if (!user) return
      if (!channel.memberIds.includes(user.id)) {
        channel.memberIds = [...channel.memberIds, user.id]
      }
      await cloud.saveChat(channel) // lands in every member's namespace, incl. mine
      await loadAll()
      set({ activeChatId: channel.id })
    },

    async deleteChat(chatId) {
      await cloud.deleteChat(chatId)
      set(s => {
        const messages = { ...s.messages }
        delete messages[chatId]
        return {
          chats: s.chats.filter(c => c.id !== chatId),
          messages,
          activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
        }
      })
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

    async updateProfile(patch) {
      const { user } = get()
      if (!user) return
      if (patch.name !== undefined) user.name = patch.name.trim() || user.name
      if (patch.bio !== undefined) user.bio = patch.bio.trim()
      if (patch.avatar !== undefined) user.avatar = patch.avatar
      await cloud.saveUser(user)
      set(s => ({
        user: { ...user },
        users: s.users.map(u => (u.id === user.id ? { ...user } : u)),
      }))
    },

    async changeLogin(newLogin, password) {
      const { user } = get()
      if (!user) return 'Нет сессии'
      if ((await hashPassword(password, user.salt)) !== user.passwordHash)
        return 'Неверный пароль — смена логина требует подтверждения'
      const login = newLogin.trim()
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(login))
        return 'Логин: 3–24 символа, латиница, цифры, _ . -'
      if (login.toLowerCase() === user.login.toLowerCase()) return null
      if (await cloud.userByLogin(login)) return 'Такой логин уже занят'
      const oldLogin = user.login
      const accountKey = localStorage.getItem(LS_KEY(oldLogin))
      user.login = login
      await cloud.saveUser(user)
      if (accountKey) {
        localStorage.setItem(LS_KEY(login), accountKey)
        localStorage.removeItem(LS_KEY(oldLogin))
      }
      localStorage.setItem(LS_SESSION, login)
      set({ user: { ...user } })
      return null
    },

    async changePassword(current, next) {
      const { user } = get()
      if (!user) return 'Нет сессии'
      const key = localStorage.getItem(LS_KEY(user.login))
      const pwdOk = (await hashPassword(current, user.salt)) === user.passwordHash
      const keyOk = !!key && normalizeAccountKey(current) === key
      if (!pwdOk && !keyOk) return 'Введите текущий пароль или ключ аккаунта'
      if (next.length < 4) return 'Новый пароль: минимум 4 символа'
      user.salt = randomSalt()
      user.passwordHash = await hashPassword(next, user.salt)
      await cloud.saveUser(user)
      set({ user: { ...user } })
      return null
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

export function accountKeyFor(login: string): string | null {
  return localStorage.getItem(LS_KEY(login))
}

export function useUnread(chatId: string): number {
  return useStore(s => {
    const me = s.user?.id
    if (!me) return 0
    const marker = s.reads.find(r => r.chatId === chatId && r.userId === me)
    const at = marker?.lastReadAt ?? 0
    return (s.messages[chatId] ?? []).filter(m => m.createdAt > at && m.senderId !== me).length
  })
}
