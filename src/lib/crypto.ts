const te = new TextEncoder()
const td = new TextDecoder()

export const uid = () => crypto.randomUUID()

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

export function randomSalt(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)))
}

/** Account key shown once on registration, stored locally, needed to decrypt on a new device. */
export function generateAccountKey(): string {
  const raw = b64(crypto.getRandomValues(new Uint8Array(24)))
    .replace(/[+/=]/g, '')
    .toUpperCase()
  return `FRZN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}`
}

export function normalizeAccountKey(k: string): string {
  return k.trim().toUpperCase().replace(/\s+/g, '')
}

/** PBKDF2-SHA-256 password hash. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt) as BufferSource, iterations: 120_000 },
    key,
    256,
  )
  return b64(bits)
}

/** AES-GCM vault cipher — encrypts everything before it is written to the cloud repository. */
export class Vault {
  private constructor(private key: CryptoKey) {}

  static async fromAccountKey(accountKey: string): Promise<Vault> {
    const digest = await crypto.subtle.digest('SHA-256', te.encode(normalizeAccountKey(accountKey)))
    const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
    return new Vault(key)
  }

  async encryptJson(value: unknown): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      te.encode(JSON.stringify(value)),
    )
    return `${b64(iv)}.${b64(ct)}`
  }

  async decryptJson<T>(enc: string): Promise<T> {
    const [ivB64, ctB64] = enc.split('.')
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(ivB64) as BufferSource },
      this.key,
      unb64(ctB64) as BufferSource,
    )
    return JSON.parse(td.decode(pt)) as T
  }
}

const AVATAR_COLORS = [
  '#5b8cff', '#7c5bff', '#3fb6b2', '#43a6e8', '#e86a92',
  '#f0a04b', '#6fb457', '#b06cd8', '#4fc3f7', '#ef6c6c',
]

export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
