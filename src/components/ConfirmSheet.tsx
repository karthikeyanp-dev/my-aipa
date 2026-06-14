import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export interface SheetAction {
  label: string
  kind: 'primary' | 'destructive' | 'ghost'
  onClick: () => void
}

interface Props {
  open: boolean
  title: string
  description?: ReactNode
  actions: SheetAction[]
  onDismiss: () => void
}

export default function ConfirmSheet({ open, title, description, actions, onDismiss }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onDismiss} />
      <div className="sheet-enter relative w-full max-w-lg rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <h2 className="text-lg font-bold">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
        <div className="mt-6 flex flex-col gap-2.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={cn(
                'w-full rounded-2xl px-5 py-3.5 font-semibold transition active:scale-[0.98]',
                a.kind === 'primary' &&
                  'bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/25',
                a.kind === 'destructive' &&
                  'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
                a.kind === 'ghost' &&
                  'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
