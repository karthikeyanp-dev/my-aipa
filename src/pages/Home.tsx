import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, X, Tag, Loader2, Plus, Pencil, CheckCircle2, MessageCircle, ListPlus, ArrowUpRight, Lightbulb } from 'lucide-react'
import { useNotes } from '../hooks/useNotes'
import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../contexts/AuthContext'
import { cn, timeAgo } from '../lib/utils'
import type { Note } from '../lib/types'
import EditPanel from '../components/EditPanel'

function NoteCard({ note, onOpen, onEdit }: { note: Note; onOpen: () => void; onEdit: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="rise-enter relative w-full rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-white/5 dark:bg-zinc-900"
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="Edit note"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            e.preventDefault()
            onEdit()
          }
        }}
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 transition hover:bg-accent-50 hover:text-accent-500 dark:text-zinc-600 dark:hover:bg-accent-500/10 dark:hover:text-accent-400"
      >
        <Pencil size={14} />
      </span>
      <p className="line-clamp-4 pr-8 leading-relaxed whitespace-pre-wrap">{note.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            {note.tags.slice(0, 3).map((t) => (
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
        <span className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500">
          {timeAgo(note.createdAt)}
        </span>
      </div>
    </button>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function QuickAction({ label, description, icon: Icon, onClick }: { label: string; description: string; icon: typeof Sparkles; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-28 flex-col items-start rounded-2xl border border-zinc-200/80 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md active:scale-[0.98] dark:border-white/5 dark:bg-zinc-900 dark:hover:border-accent-500/30"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition group-hover:bg-accent-600 group-hover:text-white dark:bg-accent-500/10 dark:text-accent-400">
        <Icon size={18} />
      </span>
      <span className="mt-3 text-sm font-bold">{label}</span>
      <span className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{description}</span>
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notes, categories, loading } = useNotes()
  const { openTasks } = useTasks()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  const filtered = useMemo(() => {
    let list = notes
    if (activeCategory) list = list.filter((n) => n.category === activeCategory)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) =>
          n.text.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          (n.category ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [notes, activeCategory, search])

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col lg:min-h-dvh lg:mx-auto lg:max-w-5xl">
      <header className="sticky top-0 z-10 bg-zinc-50/80 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2 backdrop-blur-xl dark:bg-[#0b0712]/80 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-accent-600 dark:text-accent-400">{greeting()}{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Your second brain</h1>
          </div>
          <button
            onClick={() => {
              setSearchOpen((v) => !v)
              setSearch('')
            }}
            aria-label="Search notes"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-white/5"
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, tags, categories…"
            className="fade-enter mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent-400 dark:border-white/10 dark:bg-zinc-900"
          />
        )}

      </header>

      <div className="flex flex-1 flex-col gap-3 px-5 pt-4 lg:px-8">
        {!searchOpen && (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Start here</h2>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Make progress, one action at a time</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <QuickAction label="Capture" description="Save a thought" icon={Plus} onClick={() => navigate('/note/new')} />
                <QuickAction label="Ask notes" description="Find an answer" icon={MessageCircle} onClick={() => navigate('/ask')} />
                <QuickAction label="Add task" description="Plan a next step" icon={ListPlus} onClick={() => navigate('/tasks?new=1')} />
                <QuickAction label="Plan today" description="Use what you know" icon={Lightbulb} onClick={() => navigate('/ask?prompt=Help me plan today using my notes.')} />
              </div>
            </section>

            <section className="mt-3 rounded-3xl bg-gradient-to-br from-accent-600 to-violet-800 p-5 text-white shadow-lg shadow-accent-600/20">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/75"><CheckCircle2 size={16} /> Today&apos;s focus</div>
                  <p className="mt-2 text-xl font-bold tracking-tight">
                    {openTasks.length ? `${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'}` : 'Your list is clear'}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">
                    {openTasks.length ? openTasks.slice(0, 2).map((task) => task.title).join(' · ') : 'Turn a thought into a small, actionable next step.'}
                  </p>
                </div>
                <button onClick={() => navigate('/tasks')} aria-label="Open tasks" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 active:scale-90"><ArrowUpRight size={19} /></button>
              </div>
            </section>
          </>
        )}

        <section className="mt-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">{searchOpen ? 'Search results' : 'Recent notes'}</h2>
            {!searchOpen && <span className="text-xs text-zinc-400 dark:text-zinc-500">{notes.length} saved</span>}
          </div>
          {categories.length > 0 && (
            <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 lg:-mx-8 lg:px-8">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  !activeCategory ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10',
                )}
              >
                All · {notes.length}
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setActiveCategory(activeCategory === c.name ? null : c.name)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    activeCategory === c.name ? 'bg-accent-600 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10',
                  )}
                >
                  {c.name} · {c.count}
                </button>
              ))}
            </div>
          )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-white/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-20 flex flex-col items-center px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-50 text-accent-500 dark:bg-accent-500/10">
              <Sparkles size={28} />
            </div>
            <h2 className="mt-5 text-lg font-bold">
              {notes.length === 0 ? 'Capture your first thought' : 'No matching notes'}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {notes.length === 0
                ? 'Tap + and write anything — AI will file it under the right category for you.'
                : 'Try a different search or category.'}
            </p>
            {notes.length === 0 && (
              <button
                onClick={() => navigate('/note/new')}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/30 transition-transform active:scale-95"
              >
                <Plus size={18} strokeWidth={2.5} />
                Add your first note
              </button>
            )}
          </div>
        ) : (
          filtered.slice(0, searchOpen || activeCategory ? undefined : 6).map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => navigate(`/note/${n.id}`)} onEdit={() => setEditingNote(n)} />
          ))
        )}
        </section>
      </div>

      <EditPanel note={editingNote} onClose={() => setEditingNote(null)} />

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-end pr-5 lg:bottom-8 lg:pr-8">
        <button
          onClick={() => navigate('/note/new')}
          aria-label="Add note"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-lg shadow-accent-600/30 transition-transform active:scale-90"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
