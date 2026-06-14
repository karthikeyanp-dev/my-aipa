import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { ArrowUp, Sparkles, History, Plus, Trash2, X } from 'lucide-react'
import { functions } from '../lib/firebase'
import { cn, timeAgo } from '../lib/utils'
import type { ChatMessage, ChatSource } from '../lib/types'
import { useConversations } from '../hooks/useConversations'
import MicButton from '../components/MicButton'

const askNotes = httpsCallable<
  { question: string; history?: { role: string; text: string }[] },
  { answer: string; sources: ChatSource[] }
>(functions, 'askNotes')

const suggestions = [
  'Which credit card should I use for fuel?',
  'What did I note about work last week?',
  'Any ideas I saved recently?',
]

function Sources({ sources }: { sources: ChatSource[] }) {
  const navigate = useNavigate()
  if (sources.length === 0) return null
  return (
    <div className="mt-2.5 flex flex-col gap-2">
      <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        Sources
      </span>
      {sources.map((s, i) => (
        <button
          key={s.id}
          onClick={() => navigate(`/note/${s.id}`)}
          className="rounded-xl border border-zinc-200/80 bg-white p-3 text-left text-sm shadow-sm transition active:scale-[0.99] dark:border-white/5 dark:bg-zinc-900"
        >
          <p className="line-clamp-2 text-zinc-700 dark:text-zinc-200">
            <span className="mr-1.5 font-semibold text-accent-600 dark:text-accent-400">
              [{i + 1}]
            </span>
            {s.text}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            {s.category && (
              <span className="rounded-full bg-accent-50 px-2 py-0.5 font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                {s.category}
              </span>
            )}
            {timeAgo(new Date(s.createdAt))}
          </div>
        </button>
      ))}
    </div>
  )
}

export default function Ask() {
  const {
    conversations,
    activeConversation,
    loading: convLoading,
    loadConversation,
    createConversation,
    appendMessage,
    deleteConversation,
    setActiveConversation,
    activeIdRef,
  } = useConversations()

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const messages = activeConversation?.messages ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy])

  async function send(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)

    let convId = activeIdRef.current
    const userMsg: ChatMessage = { role: 'user', text: q }

    if (!convId) {
      // Auto-create conversation on first message
      convId = await createConversation(q)
    }

    // Persist user message (hook handles optimistic UI update)
    await appendMessage(convId, userMsg)

    try {
      // Build history from current conversation (last 8 messages)
      const history = (activeConversation?.messages ?? [])
        .concat(userMsg)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }))

      const res = await askNotes({ question: q, history })
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        text: res.data.answer,
        sources: res.data.sources,
      }
      await appendMessage(convId!, assistantMsg)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      const errorMsg: ChatMessage = {
        role: 'assistant',
        text:
          code === 'functions/unavailable'
            ? 'The AI service is busy right now. Give it a moment and try again.'
            : "I couldn't reach your notes right now. Check your connection and try again.",
        error: true,
      }
      await appendMessage(convId!, errorMsg)
    } finally {
      setBusy(false)
    }
  }

  function startNewChat() {
    setActiveConversation(null)
    setShowHistory(false)
  }

  async function handleSelectConversation(id: string) {
    await loadConversation(id)
    setShowHistory(false)
  }

  async function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await deleteConversation(id)
  }

  const hasHistory = !convLoading && conversations.length > 0

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col lg:mx-auto lg:min-h-dvh lg:max-w-4xl">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-zinc-50/80 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl dark:bg-[#0b0712]/80 lg:px-8">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Ask your notes</h1>
        {hasHistory && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Toggle conversation history"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition',
              showHistory
                ? 'bg-accent-100 text-accent-600 dark:bg-accent-500/20 dark:text-accent-400'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-300',
            )}
          >
            {showHistory ? <X size={20} /> : <History size={20} />}
          </button>
        )}
      </header>

      {/* Conversation history panel */}
      {showHistory && (
        <div className="border-b border-zinc-200/70 px-5 py-3 dark:border-white/5 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-1">
            <button
              onClick={startNewChat}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-accent-600 transition hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-500/10"
            >
              <Plus size={16} />
              New chat
            </button>
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className={cn(
                  'group flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition',
                  activeConversation?.id === c.id
                    ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{c.title || 'New chat'}</span>
                <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {timeAgo(c.updatedAt)}
                </span>
                <button
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  aria-label="Delete conversation"
                  className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 px-5 pt-2 pb-24 lg:px-8 lg:pb-32">
        {messages.length === 0 && (
          <div className="mt-16 flex flex-col items-center px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-50 text-accent-500 dark:bg-accent-500/10">
              <Sparkles size={28} />
            </div>
            <h2 className="mt-5 text-lg font-bold">Ask anything you've written</h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Answers come only from your own notes, with sources.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-600 shadow-sm transition active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="rise-enter ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2.5 text-white shadow-md shadow-accent-600/20"
            >
              {m.text}
            </div>
          ) : (
            <div key={i} className="rise-enter max-w-[92%]">
              <p
                className={cn(
                  'leading-relaxed whitespace-pre-wrap',
                  m.error && 'text-zinc-400 italic dark:text-zinc-500',
                )}
              >
                {m.text}
              </p>
              {m.sources && <Sources sources={m.sources} />}
            </div>
          ),
        )}

        {busy && (
          <div className="flex gap-1.5 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="typing-dot h-2 w-2 rounded-full bg-accent-400" />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent px-5 pt-4 pb-3 dark:from-[#0b0712] dark:via-[#0b0712]/95 lg:left-64 lg:bottom-0 lg:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="mx-auto flex max-w-lg items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pr-1.5 pl-2 shadow-lg shadow-zinc-900/5 dark:border-white/10 dark:bg-zinc-900 lg:max-w-2xl"
        >
          <MicButton
            onTranscript={(t) =>
              setInput((prev) => (prev ? `${prev.trimEnd()} ${t}` : t))
            }
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your notes…"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90',
              input.trim() && !busy
                ? 'bg-gradient-to-br from-accent-500 to-accent-700 text-white'
                : 'bg-zinc-100 text-zinc-300 dark:bg-white/5 dark:text-zinc-600',
            )}
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  )
}
