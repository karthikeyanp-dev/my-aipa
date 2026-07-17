import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronDown, Circle, Plus, Trash2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { cn } from '../lib/utils'
import type { Task } from '../lib/types'

function dateLabel(date: Date | null) {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const due = dateLabel(task.dueAt)
  const overdue = task.dueAt && !task.completed && task.dueAt < new Date(new Date().setHours(0, 0, 0, 0))
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-3.5 py-3 shadow-sm transition hover:border-accent-200 dark:border-white/5 dark:bg-zinc-900 dark:hover:border-accent-500/30">
      <button
        onClick={onToggle}
        aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition active:scale-90',
          task.completed
            ? 'border-accent-600 bg-accent-600 text-white'
            : 'border-zinc-300 text-transparent hover:border-accent-500 dark:border-zinc-600',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', task.completed && 'text-zinc-400 line-through dark:text-zinc-500')}>
          {task.title}
        </p>
        {due && (
          <p className={cn('mt-0.5 flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500', overdue && 'text-red-500 dark:text-red-400')}>
            <CalendarDays size={12} />
            {due}
          </p>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete ${task.title}`}
        className="rounded-lg p-1.5 text-zinc-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100 dark:text-zinc-600 dark:hover:bg-red-500/10"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const { openTasks, completedTasks, loading, addTask, toggleTask, removeTask } = useTasks()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldFocus = searchParams.get('new') === '1'

  useEffect(() => {
    if (shouldFocus) inputRef.current?.focus()
  }, [shouldFocus])

  const orderedOpenTasks = useMemo(
    () => [...openTasks].sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)),
    [openTasks],
  )

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    const parsedDate = dueDate ? new Date(`${dueDate}T12:00:00`) : null
    await addTask(title, parsedDate)
    setTitle('')
    setDueDate('')
    inputRef.current?.focus()
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-3xl flex-col px-5 pb-8 lg:min-h-dvh lg:px-8">
      <header className="sticky top-0 z-10 -mx-5 bg-zinc-50/80 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 backdrop-blur-xl dark:bg-[#0b0712]/80 lg:-mx-8 lg:px-8">
        <p className="text-sm font-medium text-accent-600 dark:text-accent-400">Focus list</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">What needs your attention?</h1>
      </header>

      <form onSubmit={(event) => void createTask(event)} className="rounded-3xl border border-accent-200/80 bg-accent-50/70 p-3 shadow-sm dark:border-accent-500/15 dark:bg-accent-500/10">
        <div className="flex items-center gap-2">
          <Circle size={21} className="shrink-0 text-accent-500" />
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task…"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] font-medium outline-none placeholder:text-zinc-400"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Add task"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm transition active:scale-90 disabled:bg-accent-200 disabled:text-accent-400 dark:disabled:bg-white/10"
          >
            <Plus size={19} strokeWidth={2.5} />
          </button>
        </div>
        <div className="ml-7 mt-1 flex items-center gap-2">
          <CalendarDays size={14} className="text-accent-500" />
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="min-w-0 bg-transparent text-xs font-medium text-zinc-600 outline-none dark:text-zinc-300"
          />
        </div>
      </form>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Open tasks</h2>
          <span className="rounded-full bg-zinc-200/70 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
            {openTasks.length}
          </span>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2.5">{[0, 1, 2].map((item) => <div key={item} className="h-[58px] animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-white/5" />)}</div>
        ) : orderedOpenTasks.length ? (
          <div className="flex flex-col gap-2.5">
            {orderedOpenTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => void toggleTask(task)} onDelete={() => void removeTask(task.id)} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-200 px-5 py-9 text-center dark:border-white/10">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-white/5"><Check size={21} /></div>
            <p className="mt-3 text-sm font-semibold">Your list is clear</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Add a small next step to keep your momentum.</p>
          </div>
        )}
      </section>

      {completedTasks.length > 0 && (
        <section className="mt-6">
          <button onClick={() => setShowCompleted((open) => !open)} className="flex w-full items-center justify-between rounded-xl py-2 text-left text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <span>Completed · {completedTasks.length}</span>
            <ChevronDown size={18} className={cn('transition-transform', showCompleted && 'rotate-180')} />
          </button>
          {showCompleted && <div className="mt-2 flex flex-col gap-2.5">{completedTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => void toggleTask(task)} onDelete={() => void removeTask(task.id)} />)}</div>}
        </section>
      )}
    </div>
  )
}
