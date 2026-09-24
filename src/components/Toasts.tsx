import { motion, AnimatePresence } from 'framer-motion'
import { X, Ship } from 'lucide-react'
import { useStore } from '../store/useStore'

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            className="toast"
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
          >
            <Ship size={17} className="toast-icon" />
            <div className="toast-body">
              <b>{t.title}</b>
              <span>{t.body}</span>
            </div>
            <button className="icon-btn" onClick={() => dismissToast(t.id)}>
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
