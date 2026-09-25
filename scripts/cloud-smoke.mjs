/**
 * End-to-end cloud sync smoke test — simulates two DEVICES/USERS against the
 * real private repo. A registers, creates a DM with B, writes an encrypted
 * message into the shared (owner's) file; B finds the chat in his own
 * namespace, reads the owner's message file and decrypts with the chat key.
 * Run: GH_TOKEN=... node scripts/cloud-smoke.mjs
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
const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' }

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
async function aesKey(seedStr) {
  const digest = await crypto.subtle.digest('SHA-256', te.encode(seedStr))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}
const vaultKey = ak => aesKey(ak.trim().toUpperCase().replace(/\s+/g, ''))
const chatKey = id => aesKey(`viking.chatkey.${id}`)

async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(JSON.stringify(value)),
  )
  return `${b64(iv)}.${b64(ct)}`
}
async function decryptJson(key, enc) {
  const [ivB, ctB] = enc.split('.')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB) }, key, unb64(ctB))
  return JSON.parse(td.decode(pt))
}

const suffix = Date.now().toString(36)
const A = { login: `smoke_a_${suffix}`, password: 'pw-a', key: generateAccountKey() }
const B = { login: `smoke_b_${suffix}`, password: 'pw-b', key: generateAccountKey() }
const chatId = crypto.randomUUID()

async function registerUser(u) {
  const salt = randomSalt()
  u.id = crypto.randomUUID()
  u.record = {
    id: u.id,
    login: u.login,
    name: `Smoke ${u.login.slice(-4)}`,
    color: '#5b8cff',
    passwordHash: await hashPassword(u.password, salt),
    salt,
    createdAt: Date.now(),
  }
  const users = (await ghRead('users.json'))?.data ?? []
  users.push(u.record)
  await ghWrite('users.json', users)
}

console.log('\n=== REGISTER A and B ===')
try {
  await registerUser(A)
  await registerUser(B)
  console.log('✔ both users in registry')

  console.log('\n=== A creates a DM with B (member namespaces) ===')
  const chat = {
    id: chatId,
    kind: 'direct',
    title: 'DM',
    memberIds: [A.id, B.id],
    ownerId: A.id,
    ownerLogin: A.login,
    color: '#5b8cff',
    createdAt: Date.now(),
  }
  for (const login of [A.login, B.login]) {
    const path = `u/${login}/chats.json`
    const list = (await ghRead(path))?.data ?? []
    list.push(chat)
    await ghWrite(path, list)
  }
  console.log('✔ chat record written to u/A and u/B')

  console.log('\n=== A sends a message (owner namespace, chat key) ===')
  const secret = 'Привет от викинга A ⚔️'
  const ck = await chatKey(chatId)
  await ghWrite(`u/${A.login}/m/${chatId}.json`, [
    {
      id: crypto.randomUUID(),
      chatId,
      senderId: A.id,
      createdAt: Date.now(),
      enc: await encryptJson(ck, { t: secret }),
      status: 'sent',
    },
  ])
  console.log('✔ ciphertext in u/A/m/', chatId.slice(0, 8), '…')

  console.log('\n=== B logs in elsewhere: registry → password → chats → decrypt ===')
  const users = (await ghRead('users.json'))?.data ?? []
  const foundB = users.find(u => u.login === B.login)
  if (!foundB) throw new Error('B missing from registry')
  if ((await hashPassword(B.password, foundB.salt)) !== foundB.passwordHash)
    throw new Error('B password check failed')
  console.log('✔ B authenticated')

  const bChats = (await ghRead(`u/${B.login}/chats.json`))?.data ?? []
  const dm = bChats.find(c => c.id === chatId)
  if (!dm) throw new Error('chat did not reach B')
  console.log('✔ B sees the chat in his own namespace')

  const msgs = (await ghRead(`u/${dm.ownerLogin}/m/${chatId}.json`))?.data ?? []
  if (!msgs.length) throw new Error('owner message file empty')
  const payload = await decryptJson(await chatKey(chatId), msgs[0].enc)
  if (payload.t !== secret) throw new Error('decrypt mismatch')
  console.log('✔ B decrypts with the chat key:', payload.t)

  console.log('\n=== cleanup ===')
  const kept = users.filter(u => u.id !== A.id && u.id !== B.id)
  await ghWrite('users.json', kept)
  for (const login of [A.login, B.login]) {
    await ghDelete(`u/${login}/chats.json`)
    await ghDelete(`u/${login}/m/${chatId}.json`)
  }
  console.log('✔ test data removed')

  console.log('\nALL CHECKS PASSED — real user↔user messaging works over the repo.')
} catch (e) {
  console.error('\n✘ FAILED:', e.message)
  process.exit(1)
}
