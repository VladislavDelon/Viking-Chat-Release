import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, SendHorizonal, Smile, X } from 'lucide-react'
import { fileSize } from '../lib/format'
import type { Attachment } from '../types'

const EMOJI = [
  '😀', '😄', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😴',
  '😢', '😭', '😡', '🥶', '🤯', '😇', '🙃', '😉', '🤝', '👍',
  '👎', '👏', '🙏', '💪', '🔥', '❄️', '⛄', '🧊', '⭐', '✨',
  '🎉', '❤️', '💙', '💜', '🖤', '🤍', '💯', '✅', '❌', '⚡',
]

const MAX_FILE = 8 * 1024 * 1024

export function Composer({
  onSend,
  onFileTooBig,
  placeholder = 'Сообщение',
}: {
  onSend: (text: string, atts: Attachment[]) => void
  onFileTooBig: (name: string) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const [atts, setAtts] = useState<Attachment[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function pickFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) {
        onFileTooBig(f.name)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const kind: Attachment['kind'] = f.type.startsWith('image/')
          ? 'image'
          : f.type.startsWith('video/')
            ? 'video'
            : 'file'
        setAtts(prev => [
          ...prev,
          { kind, name: f.name, mime: f.type, size: f.size, dataUrl: String(reader.result) },
        ])
      }
      reader.readAsDataURL(f)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function submit() {
    const t = text.trim()
    if (!t && atts.length === 0) return
    onSend(t, atts)
    setText('')
    setAtts([])
    setEmojiOpen(false)
    taRef.current?.focus()
  }

  return (
    <div className="composer">
      <AnimatePresence>
        {atts.length > 0 && (
          <motion.div className="att-strip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {atts.map((a, i) => (
              <div className="att-chip" key={i}>
                {a.kind === 'image' ? (
                  <img src={a.dataUrl} alt="" />
                ) : (
                  <span className="att-chip-name">
                    {a.name} · {fileSize(a.size)}
                  </span>
                )}
                <button onClick={() => setAtts(p => p.filter((_, j) => j !== i))}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {emojiOpen && (
          <motion.div
            className="emoji-pop"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
          >
            {EMOJI.map(e => (
              <button key={e} onClick={() => setText(t => t + e)}>
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="composer-row">
        <button className="icon-btn" title="Эмодзи" onClick={() => setEmojiOpen(v => !v)}>
          <Smile size={21} />
        </button>
        <button className="icon-btn" title="Прикрепить" onClick={() => fileRef.current?.click()}>
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={e => pickFiles(e.target.files)}
        />
        <textarea
          ref={taRef}
          className="composer-input"
          placeholder={placeholder}
          value={text}
          rows={1}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <motion.button
          className="send-btn"
          onClick={submit}
          disabled={!text.trim() && atts.length === 0}
          whileTap={{ scale: 0.88 }}
        >
          <SendHorizonal size={19} />
        </motion.button>
      </div>
    </div>
  )
}
