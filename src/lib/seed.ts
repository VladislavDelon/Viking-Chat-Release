import { cloud } from './cloud'
import { colorFor, uid, Vault } from './crypto'
import type { Chat, User } from '../types'

export const BOT_REPLIES = [
  'Принято ❄️',
  'Интересно! Расскажи подробнее.',
  'Согласен, отличная идея 🧊',
  'Ха, классно 😄',
  'Я как раз об этом думал.',
  'Давай обсудим это в группе?',
  'Ок, записал себе.',
  'Круто! А что дальше?',
  'Морозно сегодня, правда? 🥶',
  '👍',
]

interface BotDef {
  login: string
  name: string
  greet: string
}

const BOTS: BotDef[] = [
  { login: 'snowflake', name: 'Снежинка', greet: 'Привет! Я Снежинка ❄️ Рада видеть тебя в Frozen Chat!' },
  { login: 'iceberg', name: 'Айсберг', greet: 'Йо! Добро пожаловать. Тут всё хранится в облаке и под шифром 🧊' },
  { login: 'fox', name: 'Полярный Лис', greet: 'Привет-привет! Пиши, если что-то понадобится 🦊' },
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
    title: 'Команда Frozen',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#7c5bff',
    description: 'Общий чат команды',
    createdAt: now,
  }
  const channel: Chat = {
    id: uid(),
    kind: 'channel',
    title: 'Frozen News',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#3fb6b2',
    description: 'Новости и обновления Frozen Chat',
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
    t: 'Frozen Chat запущен! 🚀 Сквозное шифрование, облачная синхронизация и морозный дизайн — уже здесь.',
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
