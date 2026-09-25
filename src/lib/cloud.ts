import type { Chat, Message, ReadMarker, User } from '../types'
import { GitHubStore, type SyncConfig } from './github'

/**
 * CloudRepository — the app's only gateway to persisted data.
 * Two backends with an identical interface:
 *  - GitHub Contents API (private repo = encrypted vault) when sync is configured
 *  - localStorage fallback for offline / no-sync mode
 * All message payloads are ciphertext by the time they reach this layer.
 */

const NS = 'vikingcloud'
const key = (c: string) => `${NS}.${c}`

function readLocal<T>(c: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(c))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(c: string, v: T) {
  try {
    localStorage.setItem(key(c), JSON.stringify(v))
  } catch {
    // quota exceeded
  }
}

// ---- GitHub backend state ----
let gh: GitHubStore | null = null
let meLogin: string | null = null
const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastVersion = 0
let syncError: string | null = null

const up = (p: string) => `u/${meLogin}/${p}` // per-account namespace

interface Index {
  v: number
  files: Record<string, number>
}

async function bumpIndex(file: string) {
  if (!gh || !meLogin) return
  try {
    const cur = (await gh.read<Index>(up('index.json')))?.data ?? { v: 0, files: {} }
    cur.v = Date.now()
    cur.files[file] = Date.now()
    await gh.write(up('index.json'), cur, (remote, local) => ({
      v: Math.max(remote?.v ?? 0, local.v),
      files: { ...remote?.files, ...local.files },
    }))
    lastVersion = cur.v
  } catch {
    /* index bump is best-effort */
  }
}

function startPoller() {
  if (pollTimer) clearInterval(pollTimer)
  if (!gh || !meLogin) return
  pollTimer = setInterval(async () => {
    try {
      const idx = await gh!.read<Index>(up('index.json'))
      syncError = null
      if (idx && idx.data.v > lastVersion) {
        lastVersion = idx.data.v
        listeners.forEach(f => f())
      }
    } catch (e) {
      syncError = String(e)
    }
  }, 15_000)
}

// array merge helpers for conflict resolution
const mergeById =
  <T extends { id: string }>(sort?: (a: T, b: T) => number) =>
  (remote: T[] | null, local: T[]): T[] => {
    const map = new Map<string, T>()
    for (const x of remote ?? []) map.set(x.id, x)
    for (const x of local) map.set(x.id, x)
    const arr = [...map.values()]
    if (sort) arr.sort(sort)
    return arr
  }

const byTime = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt

export const cloud = {
  configure(cfg: SyncConfig | null, login: string | null) {
    gh = cfg ? new GitHubStore(cfg) : null
    meLogin = login
    lastVersion = 0
    syncError = null
    startPoller()
  },

  get synced() {
    return !!gh
  },
  get syncError() {
    return syncError
  },

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
    if (gh) {
      const r = await gh.read<User[]>('users.json')
      return r?.data ?? []
    }
    return readLocal<User[]>('users', [])
  },
  async saveUser(u: User) {
    if (gh) {
      const list = (await gh.read<User[]>('users.json'))?.data ?? []
      const i = list.findIndex(x => x.id === u.id || x.login === u.login)
      if (i >= 0) list[i] = u
      else list.push(u)
      await gh.write('users.json', list, mergeById<User>())
      return
    }
    const users = readLocal<User[]>('users', [])
    const i = users.findIndex(x => x.id === u.id)
    if (i >= 0) users[i] = u
    else users.push(u)
    writeLocal('users', users)
  },
  async userByLogin(login: string): Promise<User | undefined> {
    return (await this.users()).find(u => u.login.toLowerCase() === login.toLowerCase())
  },

  async chats(): Promise<Chat[]> {
    if (gh && meLogin) {
      const r = await gh.read<Chat[]>(up('chats.json'))
      return r?.data ?? []
    }
    return readLocal<Chat[]>('chats', [])
  },
  async saveChat(c: Chat) {
    if (gh && meLogin) {
      const list = (await gh.read<Chat[]>(up('chats.json')))?.data ?? []
      const i = list.findIndex(x => x.id === c.id)
      if (i >= 0) list[i] = c
      else list.push(c)
      await gh.write(up('chats.json'), list, mergeById<Chat>(byTime))
      await bumpIndex('chats.json')
      return
    }
    const chats = readLocal<Chat[]>('chats', [])
    const i = chats.findIndex(x => x.id === c.id)
    if (i >= 0) chats[i] = c
    else chats.push(c)
    writeLocal('chats', chats)
  },
  async deleteChat(chatId: string) {
    if (gh && meLogin) {
      const list = ((await gh.read<Chat[]>(up('chats.json')))?.data ?? []).filter(
        c => c.id !== chatId,
      )
      // local-wins merge: a union merge would resurrect the deleted chat on conflict
      await gh.write(up('chats.json'), list, (_r, l) => l)
      try {
        await gh.delete(up(`m/${chatId}.json`))
      } catch {
        /* file may not exist */
      }
      await bumpIndex('chats.json')
      return
    }
    writeLocal(
      'chats',
      readLocal<Chat[]>('chats', []).filter(c => c.id !== chatId),
    )
    writeLocal(
      'messages',
      readLocal<Message[]>('messages', []).filter(m => m.chatId !== chatId),
    )
  },

  async messages(chatId?: string): Promise<Message[]> {
    if (gh && meLogin) {
      if (chatId) {
        const r = await gh.read<Message[]>(up(`m/${chatId}.json`))
        return r?.data ?? []
      }
      const chats = await this.chats()
      const parts = await Promise.all(
        chats.map(c => gh!.read<Message[]>(up(`m/${c.id}.json`)).then(r => r?.data ?? [])),
      )
      return parts.flat()
    }
    const all = readLocal<Message[]>('messages', [])
    return chatId ? all.filter(m => m.chatId === chatId) : all
  },
  async appendMessage(m: Message) {
    if (gh && meLogin) {
      const path = up(`m/${m.chatId}.json`)
      const list = (await gh.read<Message[]>(path))?.data ?? []
      list.push(m)
      await gh.write(path, list, mergeById<Message>(byTime))
      await bumpIndex(`m/${m.chatId}.json`)
      return
    }
    const all = readLocal<Message[]>('messages', [])
    all.push(m)
    writeLocal('messages', all)
  },
  async deleteMessage(id: string) {
    if (gh && meLogin) {
      const chats = await this.chats()
      for (const c of chats) {
        const path = up(`m/${c.id}.json`)
        const list = (await gh.read<Message[]>(path))?.data ?? []
        const next = list.filter(m => m.id !== id)
        if (next.length !== list.length) {
          await gh.write(path, next, (_r, l) => l)
          await bumpIndex(`m/${c.id}.json`)
          break
        }
      }
      return
    }
    writeLocal(
      'messages',
      readLocal<Message[]>('messages', []).filter(m => m.id !== id),
    )
  },
  async updateMessage(m: Message) {
    if (gh && meLogin) {
      const path = up(`m/${m.chatId}.json`)
      const list = (await gh.read<Message[]>(path))?.data ?? []
      const i = list.findIndex(x => x.id === m.id)
      if (i >= 0) {
        list[i] = m
        await gh.write(path, list, mergeById<Message>(byTime))
        await bumpIndex(`m/${m.chatId}.json`)
      }
      return
    }
    const all = readLocal<Message[]>('messages', [])
    const i = all.findIndex(x => x.id === m.id)
    if (i >= 0) {
      all[i] = m
      writeLocal('messages', all)
    }
  },

  async reads(): Promise<ReadMarker[]> {
    if (gh && meLogin) {
      const r = await gh.read<ReadMarker[]>(up('reads.json'))
      return r?.data ?? []
    }
    return readLocal<ReadMarker[]>('reads', [])
  },
  async markRead(chatId: string, userId: string, at: number) {
    if (gh && meLogin) {
      const list = (await gh.read<ReadMarker[]>(up('reads.json')))?.data ?? []
      const i = list.findIndex(r => r.chatId === chatId && r.userId === userId)
      if (i >= 0) list[i].lastReadAt = at
      else list.push({ chatId, userId, lastReadAt: at })
      await gh.write(up('reads.json'), list, (remote, local) => {
        const map = new Map<string, ReadMarker>()
        for (const r of remote ?? []) map.set(`${r.chatId}:${r.userId}`, r)
        for (const r of local) {
          const k = `${r.chatId}:${r.userId}`
          const ex = map.get(k)
          if (!ex || ex.lastReadAt < r.lastReadAt) map.set(k, r)
        }
        return [...map.values()]
      })
      return
    }
    const reads = readLocal<ReadMarker[]>('reads', [])
    const i = reads.findIndex(r => r.chatId === chatId && r.userId === userId)
    if (i >= 0) reads[i].lastReadAt = at
    else reads.push({ chatId, userId, lastReadAt: at })
    writeLocal('reads', reads)
  },

  /** Remove account + all its data from the backend. */
  async deleteAccount(userId: string) {
    if (gh && meLogin) {
      const users = ((await gh.read<User[]>('users.json'))?.data ?? []).filter(
        u => u.id !== userId,
      )
      await gh.write('users.json', users, (_r, l) => l)
      const chats = (await gh.read<Chat[]>(up('chats.json')))?.data ?? []
      for (const c of chats) {
        try {
          await gh.delete(up(`m/${c.id}.json`))
        } catch {
          /* may not exist */
        }
      }
      for (const f of ['chats.json', 'reads.json', 'index.json']) {
        try {
          await gh.delete(up(f))
        } catch {
          /* may not exist */
        }
      }
      return
    }
    writeLocal(
      'users',
      readLocal<User[]>('users', []).filter(u => u.id !== userId),
    )
    writeLocal('chats', [])
    writeLocal('messages', [])
    writeLocal('reads', [])
  },

  /** One-time upload of everything we have locally (first sync of this account). */
  async uploadAll(user: User) {
    if (!gh || !meLogin) return
    await this.saveUser(user)
    const localChats = readLocal<Chat[]>('chats', [])
    if (localChats.length) await gh.write(up('chats.json'), localChats, mergeById<Chat>(byTime))
    const localMsgs = readLocal<Message[]>('messages', [])
    const byChat = new Map<string, Message[]>()
    for (const m of localMsgs) {
      const arr = byChat.get(m.chatId) ?? []
      arr.push(m)
      byChat.set(m.chatId, arr)
    }
    for (const [cid, msgs] of byChat)
      await gh.write(up(`m/${cid}.json`), msgs, mergeById<Message>(byTime))
    const localReads = readLocal<ReadMarker[]>('reads', [])
    if (localReads.length) await gh.write(up('reads.json'), localReads)
    await bumpIndex('*')
  },
}
