import { cloud } from './cloud'
import { colorFor, uid, Vault } from './crypto'
import type { Chat, User } from '../types'

export const BOT_REPLIES = [
  'Принято, воин ⚔️',
  'Сколь! 🍺',
  'Интересно! Расскажи подробнее.',
  'Согласен, отличная идея 🛡',
  'Ха, классно 😄',
  'За Одина и Вальгаллу!',
  'Давай обсудим это у костра?',
  'Ок, записал на рунном камне.',
  'Круто! А что дальше?',
  '👍',
]

interface BotDef {
  login: string
  name: string
  greet: string
}

const BOTS: BotDef[] = [
  { login: 'lagertha', name: 'Лагерта', greet: 'Привет, воин! Я Лагерта ⚔️ Добро пожаловать в Viking Chat!' },
  { login: 'ragnar', name: 'Рагнар', greet: 'Сколь! Здесь вся переписка под шифром и хранится в облаке 🛡' },
  { login: 'floki', name: 'Флоки', greet: 'Хей! Я построил этот чат из драккаров и шифров 😄 Пиши, если что-то нужно!' },
]

/** Creates demo contacts, a group and a channel for a freshly registered account. */
export async function seedFor(user: User, vault: Vault): Promise<Chat[]> {
  const now = Date.now()
  const chats: Chat[] = []

  const saved: Chat = {
    id: uid(),
    kind: 'direct',
    title: 'Избранное',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#4fc3f7',
    pinned: true,
    createdAt: now,
  }
  chats.push(saved)

  for (const [i, b] of BOTS.entries()) {
    const bot: User = {
      id: uid(),
      login: `${b.login}.${user.login}`,
      name: b.name,
      color: colorFor(b.login),
      passwordHash: '',
      salt: '',
      bot: true,
      createdAt: now,
    }
    await cloud.saveUser(bot)
    const chat: Chat = {
      id: uid(),
      kind: 'direct',
      title: b.name,
      memberIds: [user.id, bot.id],
      ownerId: user.id,
      color: bot.color,
      createdAt: now + i,
    }
    await cloud.saveChat(chat)
    const payload = { t: b.greet }
    await cloud.appendMessage({
      id: uid(),
      chatId: chat.id,
      senderId: bot.id,
      createdAt: now - (BOTS.length - i) * 60_000,
      enc: await vault.encryptJson(payload),
      status: 'delivered',
      payload,
    })
    chats.push(chat)
  }

  const group: Chat = {
    id: uid(),
    kind: 'group',
    title: 'Команда Viking',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#7c5bff',
    description: 'Общий чат команды',
    createdAt: now,
  }
  const channel: Chat = {
    id: uid(),
    kind: 'channel',
    title: 'Viking News',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#3fb6b2',
    description: 'Новости и обновления Viking Chat',
    createdAt: now,
  }
  await cloud.saveChat(group)
  await cloud.saveChat(channel)

  const gPayload = { t: `Добро пожаловать в команду, ${user.name}! ❄️` }
  await cloud.appendMessage({
    id: uid(),
    chatId: group.id,
    senderId: user.id,
    createdAt: now - 30_000,
    enc: await vault.encryptJson(gPayload),
    status: 'read',
    payload: gPayload,
  })
  const cPayload = {
    t: 'Viking Chat запущен! ⚔️ Сквозное шифрование, облачная синхронизация и северный дизайн — уже здесь.',
  }
  await cloud.appendMessage({
    id: uid(),
    chatId: channel.id,
    senderId: user.id,
    createdAt: now - 15_000,
    enc: await vault.encryptJson(cPayload),
    status: 'read',
    payload: cPayload,
  })

  await cloud.saveChat(saved)
  chats.push(group, channel)
  return chats
}
