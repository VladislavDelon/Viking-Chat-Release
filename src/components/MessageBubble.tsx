import { motion } from 'framer-motion'
import { Check, CheckCheck, Copy, Trash2, FileText, Download } from 'lucide-react'
import { useState } from 'react'
import { fileSize, timeShort } from '../lib/format'
import { useStore } from '../store/useStore'
import type { Attachment, Message } from '../types'

function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === 'image')
    return (
      <a href={a.dataUrl} target="_blank" rel="noreferrer">
        <img className="att-img" src={a.dataUrl} alt={a.name} />
      </a>
    )
  if (a.kind === 'video')
    return <video className="att-video" src={a.dataUrl} controls preload="metadata" />
  return (
    <a className="att-file" href={a.dataUrl} download={a.name}>
      <FileText size={22} />
      <span className="att-file-info">
        <span className="att-file-name">{a.name}</span>
        <span className="att-file-size">{fileSize(a.size)}</span>
      </span>
      <Download size={16} />
    </a>
  )
}

export function MessageBubble({
  m,
  mine,
  showSender,
  senderName,
  senderColor,
  highlight,
}: {
  m: Message
  mine: boolean
  showSender: boolean
  senderName: string
  senderColor: string
  highlight: boolean
}) {
  const { removeMessage } = useStore()
  const [menu, setMenu] = useState(false)

  return (
    <motion.div
      className={`msg-row ${mine ? 'mine' : ''}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      layout
    >
      <div
        className={`bubble ${mine ? 'mine' : ''} ${highlight ? 'highlight' : ''}`}
        onContextMenu={e => {
          e.preventDefault()
          setMenu(v => !v)
        }}
      >
        {showSender && !mine && (
          <div className="bubble-sender" style={{ color: senderColor }}>
            {senderName}
          </div>
        )}
        {m.payload?.a?.map((a, i) => <AttachmentView key={i} a={a} />)}
        {m.payload?.t && <div className="bubble-text">{m.payload.t}</div>}
        <div className="bubble-meta">
          <span>{timeShort(m.createdAt)}</span>
          {mine &&
            (m.status === 'read' ? (
              <CheckCheck size={14} className="tick read" />
            ) : m.status === 'delivered' ? (
              <CheckCheck size={14} className="tick" />
            ) : (
              <Check size={14} className="tick" />
            ))}
        </div>

        {menu && (
          <div className="msg-menu" onMouseLeave={() => setMenu(false)}>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(m.payload?.t ?? '')
                setMenu(false)
              }}
            >
              <Copy size={14} /> Копировать
            </button>
            {mine && (
              <button className="danger" onClick={() => removeMessage(m.id)}>
                <Trash2 size={14} /> Удалить
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
