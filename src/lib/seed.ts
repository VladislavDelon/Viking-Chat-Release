import { cloud } from './cloud'
import { uid, Vault } from './crypto'
import type { Chat, User } from '../types'

/** Keyword-matched answers for the "Viking помощь" support chat. */
const HELP_ANSWERS: [RegExp, string][] = [
  [
    /ключ|vkng/i,
    'Ключ аккаунта VKNG-… создаётся при регистрации и хранится на устройстве. Найти и скачать его можно в Настройках → Безопасность. Без него не расшифровать переписку на новом устройстве!',
  ],
  [
    /синхрон|облак|github|устройств/i,
    'Синхронизация между устройствами: Настройки → Облачная синхронизация → укажите приватный репозиторий и GitHub token. Данные хранятся там зашифрованными.',
  ],
  [/парол/i, 'Сменить пароль: Настройки → Безопасность. Понадобится текущий пароль.'],
  [
    /фото|аватар|имя|логин|профил/i,
    'Имя, фото и логин меняются в Настройках → Профиль. Фото обрежется до квадрата автоматически.',
  ],
  [/тема|тёмн|светл|оформлен/i, 'Тема переключается в Настройках → Внешний вид или иконкой в шапке.'],
  [
    /канал|групп|чат|написать|найти/i,
    'Новый чат (кнопка +) → личный, группа или канал. Личный можно найти по @логину пользователя.',
  ],
  [
    /шифр|безопас|защит/i,
    'Сообщения шифруются AES-256-GCM до записи в облако — на сервере лежит только шифротекст.',
  ],
  [/удал|стереть/i, 'Удалить чат — иконка корзины в шапке чата. Сообщение — правый клик → Удалить.'],
]

const HELP_FALLBACK =
  'Хороший вопрос! � Загляните в Настройки ⚙️ — там профиль, безопасность, облако и тема. Если не нашли ответ — уточните вопрос.'

export function helpReply(text: string): string {
  for (const [re, answer] of HELP_ANSWERS) if (re.test(text)) return answer
  return HELP_FALLBACK
}

const SUPPORT_LOGIN = 'viking.support'
const SUPPORT_NAME = 'Поддержка Viking'

export async function ensureSupportBot(): Promise<User> {
  const existing = await cloud.userByLogin(SUPPORT_LOGIN)
  if (existing) return existing
  const bot: User = {
    id: uid(),
    login: SUPPORT_LOGIN,
    name: SUPPORT_NAME,
    color: '#5b8cff',
    passwordHash: '',
    salt: '',
    bot: true,
    createdAt: Date.now(),
  }
  await cloud.saveUser(bot)
  return bot
}

/** Creates "Избранное", "Viking помощь" and "Viking News" for a new account. */
export async function seedFor(user: User, vault: Vault): Promise<Chat[]> {
  let now = Date.now()
  const support = await ensureSupportBot()

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

  const help: Chat = {
    id: uid(),
    kind: 'group',
    title: 'Viking помощь',
    memberIds: [user.id, support.id],
    ownerId: support.id,
    color: '#7c5bff',
    description: 'Вопросы о программе — отвечаем и помогаем',
    createdAt: now,
  }

  const news: Chat = {
    id: uid(),
    kind: 'channel',
    title: 'Viking News',
    memberIds: [user.id],
    ownerId: user.id,
    color: '#3fb6b2',
    description: 'Новости и обновления Viking Chat',
    createdAt: now,
  }

  for (const c of [saved, help, news]) await cloud.saveChat(c)

  const posts: [Chat, string, string][] = [
    [
      help,
      support.id,
      'Привет! 👋 Это чат поддержки Viking Chat. Задавайте любые вопросы о программе — про ключ, синхронизацию, настройки — я постараюсь помочь.',
    ],
    [
      news,
      user.id,
      '⚔️ Viking Chat запущен! Сквозное шифрование AES-256-GCM, облачная синхронизация, сезонные анимации и северный дизайн — уже здесь.',
    ],
    [news, user.id, '📱 Скачать Android-версию можно из раздела Releases репозитория Viking-Chat-Release.'],
  ]
  for (const [chat, sender, text] of posts) {
    const payload = { t: text }
    await cloud.appendMessage({
      id: uid(),
      chatId: chat.id,
      senderId: sender,
      createdAt: (now -= 60_000),
      enc: await vault.encryptJson(payload),
      status: 'delivered',
      payload,
    })
  }

  return [saved, help, news]
}
