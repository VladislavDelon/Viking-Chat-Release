/**
 * End-to-end cloud sync smoke test — simulates two devices against the real
 * private repo. Run: node scripts/cloud-smoke.mjs  (GH_TOKEN env required)
 * Device A registers + writes encrypted chat data; Device B reads it back and
 * decrypts with the account key — the exact flow of logging in elsewhere.
 */
const TOKEN = process.env.GH_TOKEN
const REPO = process.env.GH_REPO || 'VladislavDelon/Viking-Chat-Closed'
if (!TOKEN) {
  console.error('GH_TOKEN required')
  process.exit(1)
}

const te = new TextEncoder()
const td = new TextDecoder()
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const b64enc = s => btoa(unescape(encodeURIComponent(s)))
const b64dec = s => decodeURIComponent(escape(atob(s)))

const url = p => `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(p)}`
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
}

async function ghRead(path) {
  const r = await fetch(url(path), { headers: H })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`)
  const j = await r.json()
  return { data: JSON.parse(b64dec(j.content.replace(/\n/g, ''))), sha: j.sha }
}
async function ghWrite(path, data) {
  const cur = await ghRead(path)
  const r = await fetch(url(path), {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({
      message: `smoke ${path}`,
      content: b64enc(JSON.stringify(data)),
      ...(cur?.sha ? { sha: cur.sha } : {}),
    }),
  })
  if (!r.ok) throw new Error(`PUT ${path} -> ${r.status}: ${await r.text()}`)
}
async function ghDelete(path) {
  const cur = await ghRead(path)
  if (!cur?.sha) return
  const r = await fetch(url(path), {
    method: 'DELETE',
    headers: H,
    body: JSON.stringify({ message: `smoke cleanup ${path}`, sha: cur.sha }),
  })
  if (!r.ok) throw new Error(`DELETE ${path} -> ${r.status}`)
}

// --- replicate src/lib/crypto.ts ---
const randomSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)))
const generateAccountKey = () =>
  `VKNG-${b64(crypto.getRandomValues(new Uint8Array(24)))
    .replace(/[+/=]/g, '')
    .toUpperCase()
    .slice(0, 20)
    .replace(/(.{4})/g, '$1-')
    .slice(0, -1)}`
const normalizeKey = k => k.trim().toUpperCase().replace(/\s+/g, '')

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 120_000 },
    key,
    256,
  )
  return b64(bits)
}

async function vaultKey(accountKey) {
  const digest = await crypto.subtle.digest('SHA-256', te.encode(normalizeKey(accountKey)))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}
async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(value)))
  return `${b64(iv)}.${b64(ct)}`
}
async function decryptJson(key, enc) {
  const [ivB, ctB] = enc.split('.')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB) }, key, unb64(ctB))
  return JSON.parse(td.decode(pt))
}

const login = `smoke_${Date.now().toString(36)}`
const password = 'test-parol-123'
const accountKey = generateAccountKey()
const userId = crypto.randomUUID()
const chatId = crypto.randomUUID()

console.log(`\n=== DEVICE A: register + write encrypted data ===`)
try {
  // register: user record in users.json
  const salt = randomSalt()
  const user = {
    id: userId,
    login,
    name: 'Smoke Test',
    color: '#5b8cff',
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: Date.now(),
  }
  const users = (await ghRead('users.json'))?.data ?? []
  users.push(user)
  await ghWrite('users.json', users)
  console.log(`✔ users.json updated (${users.length} users)`)

  // chat list
  const chat = {
    id: chatId,
    kind: 'direct',
    title: 'Smoke Chat',
    memberIds: [userId],
    ownerId: userId,
    color: '#5b8cff',
    createdAt: Date.now(),
  }
  await ghWrite(`u/${login}/chats.json`, [chat])
  console.log('✔ chats.json written')

  // encrypted message — only ciphertext touches the repo
  const key = await vaultKey(accountKey)
  const secret = 'Секретное сообщение викинга ⚔️'
  const msg = {
    id: crypto.randomUUID(),
    chatId,
    senderId: userId,
    createdAt: Date.now(),
    enc: await encryptJson(key, { t: secret }),
    status: 'sent',
  }
  await ghWrite(`u/${login}/m/${chatId}.json`, [msg])
  console.log('✔ message written — ciphertext:', msg.enc.slice(0, 44) + '…')

  console.log(`\n=== DEVICE B: fresh login elsewhere ===`)
  // 1. find user by login (what login() does)
  const remoteUsers = (await ghRead('users.json'))?.data ?? []
  const found = remoteUsers.find(u => u.login === login)
  if (!found) throw new Error('user not found remotely')
  console.log('✔ user found in remote registry')

  // 2. password check
  const ok = (await hashPassword(password, found.salt)) === found.passwordHash
  if (!ok) throw new Error('password hash mismatch')
  console.log('✔ password verified')

  // 3. pull chats + messages
  const chats = (await ghRead(`u/${login}/chats.json`))?.data ?? []
  const msgs = (await ghRead(`u/${login}/m/${chatId}.json`))?.data ?? []
  if (!chats.length || !msgs.length) throw new Error('remote data missing')
  console.log(`✔ pulled ${chats.length} chat(s), ${msgs.length} message(s)`)

  // 4. decrypt with the account key (what submitKey does on a new device)
  const key2 = await vaultKey(accountKey)
  const payload = await decryptJson(key2, msgs[0].enc)
  if (payload.t !== secret) throw new Error('decryption mismatch')
  console.log('✔ decrypted payload:', payload.t)

  console.log('\n=== cleanup: delete account (device-side flow) ===')
  const kept = remoteUsers.filter(u => u.id !== userId)
  await ghWrite('users.json', kept)
  await ghDelete(`u/${login}/m/${chatId}.json`)
  await ghDelete(`u/${login}/chats.json`)
  console.log('✔ test account + data removed')

  console.log('\nALL CHECKS PASSED — cross-device sync works end to end.')
} catch (e) {
  console.error('\n✘ FAILED:', e.message)
  process.exit(1)
}
