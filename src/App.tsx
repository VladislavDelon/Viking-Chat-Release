import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { AuthScreen } from './components/AuthScreen'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { Toasts } from './components/Toasts'

export default function App() {
  const { ready, user, theme, activeChatId, init, chats, messages } = useStore()

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const unread = chats.reduce((acc, c) => {
      const me = user?.id
      if (!me) return acc
      const marker = useStore.getState().reads.find(r => r.chatId === c.id && r.userId === me)
      const at = marker?.lastReadAt ?? 0
      return acc + (messages[c.id] ?? []).filter(m => m.createdAt > at && m.senderId !== me).length
    }, 0)
    document.title = unread > 0 ? `(${unread}) Frozen Chat` : 'Frozen Chat'
  }, [chats, messages, user?.id])

  if (!ready)
    return (
      <div className="boot">
        <span className="boot-flake">❄</span>
      </div>
    )
  if (!user) return <AuthScreen />

  return (
    <div className={`app ${activeChatId ? 'chat-open' : ''}`}>
      <Sidebar />
      <ChatWindow />
      <Toasts />
    </div>
  )
}
