export type Theme = 'dark' | 'light'
export type ChatKind = 'direct' | 'group' | 'channel'

export interface User {
  id: string
  login: string
  name: string
  color: string
  passwordHash: string
  salt: string
  avatar?: string
  bio?: string
  bot?: boolean
  createdAt: number
}

export interface Chat {
  id: string
  kind: ChatKind
  title: string
  memberIds: string[]
  ownerId: string
  color: string
  description?: string
  pinned?: boolean
  createdAt: number
}

export interface Attachment {
  kind: 'image' | 'video' | 'file'
  name: string
  mime: string
  size: number
  dataUrl: string
}

/** What gets encrypted before it touches the "cloud". */
export interface MessagePayload {
  t: string
  a?: Attachment[]
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  createdAt: number
  /** base64(iv).base64(ciphertext) — payload is never stored in plaintext */
  enc: string
  status: 'sent' | 'delivered' | 'read'
  /** decrypted, in-memory only */
  payload?: MessagePayload
  failed?: boolean
}

export interface ReadMarker {
  chatId: string
  userId: string
  lastReadAt: number
}

export interface Toast {
  id: string
  title: string
  body: string
}
