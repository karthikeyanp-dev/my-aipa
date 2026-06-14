import { useEffect, useRef, useState } from 'react'
import {
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { Trash2, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import ConfirmSheet from './ConfirmSheet'
import MicButton from './MicButton'
import type { Note } from '../lib/types'

interface EditPanelProps {
  note: Note | null
  onClose: () => void
}

export default function EditPanel({ note, onClose }: EditPanelProps) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [original, setOriginal] = useState('')
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const dirty = text.trim() !== original.trim() && text.trim().length > 0

  // Initialize text when note changes
  useEffect(() => {
    if (!note) return
    setText(note.text)
    setOriginal(note.text)
    setShowDeleteSheet(false)
  }, [note?.id])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, note])

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (note) {
      // Small delay to let the animation start
      const timer = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [note?.id])

  // Escape key to close
  useEffect(() => {
    if (!note) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [note, onClose])

  if (!note) return null

  function handleSave() {
    if (!user || !note || !dirty) return
    const trimmed = text.trim()
    void updateDoc(doc(db, 'users', user.uid, 'notes', note.id), {
      text: trimmed,
      status: 'pending',
    })
    onClose()
  }

  function handleDelete() {
    if (!user || !note) return
    void deleteDoc(doc(db, 'users', user.uid, 'notes', note.id))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      {/* Backdrop */}
      <div
        className="fade-enter absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="sheet-enter relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-zinc-900 lg:max-w-lg lg:rounded-3xl">
        {/* Drag handle (mobile) */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 lg:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">Edit Note</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-zinc-100 px-5 py-4 dark:border-white/5">
          <button
            onClick={() => setShowDeleteSheet(true)}
            aria-label="Delete note"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            <Trash2 size={18} />
          </button>
          <MicButton
            onTranscript={(t) =>
              setText((prev) => (prev ? `${prev.trimEnd()} ${t}` : t))
            }
          />
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={cn(
              'rounded-2xl px-5 py-2.5 text-sm font-semibold transition active:scale-95',
              dirty
                ? 'bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/25'
                : 'bg-zinc-200/70 text-zinc-400 dark:bg-white/5 dark:text-zinc-600',
            )}
          >
            Save
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmSheet
        open={showDeleteSheet}
        title="Delete this note?"
        description="This can't be undone."
        onDismiss={() => setShowDeleteSheet(false)}
        actions={[
          { label: 'Delete note', kind: 'destructive', onClick: handleDelete },
          { label: 'Cancel', kind: 'ghost', onClick: () => setShowDeleteSheet(false) },
        ]}
      />
    </div>
  )
}
