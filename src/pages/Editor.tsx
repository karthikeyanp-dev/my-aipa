import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { ChevronLeft, Loader2, Sparkles, Tag, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate } from '../lib/utils'
import ConfirmSheet from '../components/ConfirmSheet'
import MicButton from '../components/MicButton'
import type { Note } from '../lib/types'

export default function Editor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [original, setOriginal] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [loadingNote, setLoadingNote] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const dirty = text.trim() !== original.trim() && text.trim().length > 0
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const bypassRef = useRef(false)

  // Load existing note (served from offline cache when no signal).
  useEffect(() => {
    if (!id || !user) return
    getDoc(doc(db, 'users', user.uid, 'notes', id))
      .then((snap) => {
        if (!snap.exists()) return navigate('/', { replace: true })
        const data = snap.data({ serverTimestamps: 'estimate' })
        const loaded: Note = {
          id: snap.id,
          text: (data.text as string) ?? '',
          createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
          category: (data.category as string | null) ?? null,
          tags: (data.tags as string[]) ?? [],
          status: (data.status as Note['status']) ?? 'pending',
        }
        setNote(loaded)
        setText(loaded.text)
        setOriginal(loaded.text)
      })
      .finally(() => setLoadingNote(false))
  }, [id, user, navigate])

  // Auto-grow the textarea like a document, not a form field.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, loadingNote])

  // Block in-app/browser back while there are unsaved changes.
  const blocker = useBlocker(
    useCallback(() => dirtyRef.current && !bypassRef.current, []),
  )

  // Warn on tab close / refresh too.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function persist() {
    if (!user || !dirty) return
    setSaving(true)
    const trimmed = text.trim()
    // Don't await: Firestore queues the write offline; leaving immediately is safe.
    if (isNew) {
      void addDoc(collection(db, 'users', user.uid, 'notes'), {
        text: trimmed,
        createdAt: serverTimestamp(),
        category: null,
        tags: [],
        status: 'pending',
      })
    } else {
      void updateDoc(doc(db, 'users', user.uid, 'notes', id!), {
        text: trimmed,
        status: 'pending',
      })
    }
    setOriginal(trimmed)
    dirtyRef.current = false
  }

  async function saveAndClose() {
    await persist()
    bypassRef.current = true
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate(-1)
  }

  function discardAndClose() {
    bypassRef.current = true
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate(-1)
  }

  function deleteNote() {
    if (!user || !id) return
    bypassRef.current = true
    void deleteDoc(doc(db, 'users', user.uid, 'notes', id))
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col lg:max-w-3xl">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-zinc-50/80 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-xl dark:bg-[#0b0712]/80 lg:px-6">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-white/5"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-1">
          {!isNew && (
            <button
              onClick={() => setShowDeleteSheet(true)}
              aria-label="Delete note"
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            >
              <Trash2 size={19} />
            </button>
          )}
          <MicButton
            onTranscript={(t) =>
              setText((prev) => (prev ? `${prev.trimEnd()} ${t}` : t))
            }
          />
          <button
            onClick={saveAndClose}
            disabled={!dirty || saving}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-semibold transition active:scale-95',
              dirty
                ? 'bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/25'
                : 'bg-zinc-200/70 text-zinc-400 dark:bg-white/5 dark:text-zinc-600',
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </header>

      {loadingNote ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-6 pt-2 pb-10 lg:px-8 lg:pb-12">
          {note && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {formatDate(note.createdAt)}
              </span>
              {note.status === 'pending' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                  <Loader2 size={11} className="animate-spin" />
                  Organizing…
                </span>
              ) : (
                <>
                  {note.category && (
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                      {note.category}
                    </span>
                  )}
                  {note.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-500 dark:bg-white/5 dark:text-zinc-400"
                    >
                      <Tag size={9} />
                      {t}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            autoFocus={isNew}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write anything…"
            rows={1}
            className="w-full resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />

          {isNew && (
            <p className="mt-auto flex items-center justify-center gap-1.5 pt-10 text-xs text-zinc-300 dark:text-zinc-600">
              <Sparkles size={12} />
              AI will categorize and tag this note after you save
            </p>
          )}
        </div>
      )}

      <ConfirmSheet
        open={blocker.state === 'blocked'}
        title="Save this note?"
        description="You have unsaved changes. Save them, or discard and go back?"
        onDismiss={() => blocker.reset?.()}
        actions={[
          { label: 'Save note', kind: 'primary', onClick: saveAndClose },
          { label: 'Discard', kind: 'destructive', onClick: discardAndClose },
          { label: 'Keep editing', kind: 'ghost', onClick: () => blocker.reset?.() },
        ]}
      />

      <ConfirmSheet
        open={showDeleteSheet}
        title="Delete this note?"
        description="This can't be undone."
        onDismiss={() => setShowDeleteSheet(false)}
        actions={[
          { label: 'Delete note', kind: 'destructive', onClick: deleteNote },
          { label: 'Cancel', kind: 'ghost', onClick: () => setShowDeleteSheet(false) },
        ]}
      />
    </div>
  )
}
