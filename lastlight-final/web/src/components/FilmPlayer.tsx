import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'

/** The 30-second film, in a quiet overlay. Sound starts on the click that opened it. */
export function FilmPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.activeElement as HTMLElement | null
    return () => {
      window.removeEventListener('keydown', k)
      prev?.focus?.()
    }
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="film-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="LASTLIGHT, the 30 second film"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          onClick={onClose}
        >
          <motion.div
            className="film-frame"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <video ref={video} src="/film/lastlight.mp4" poster="/film/poster.jpg" controls autoPlay playsInline preload="auto" onEnded={onClose} />
            <p className="film-note">30 s · English subtitles · AI-generated voice · real app footage</p>
          </motion.div>
          <button className="film-close" onClick={onClose} aria-label="Close the film" autoFocus>
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
