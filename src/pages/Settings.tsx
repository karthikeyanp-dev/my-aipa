import { useEffect, useState } from 'react'
import {
  Download,
  FileJson,
  LogOut,
  Mic,
  Moon,
  MonitorSmartphone,
  Sun,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotes } from '../hooks/useNotes'
import { cn } from '../lib/utils'
import ConfirmSheet from '../components/ConfirmSheet'
import { DICTATION_LANGUAGES, getDictationLang, setDictationLang } from '../lib/speech'

type Theme = 'system' | 'light' | 'dark'

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  if (theme === 'system') localStorage.removeItem('theme')
  else localStorage.setItem('theme', theme)
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { notes, categories } = useNotes()
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme | null) ?? 'system',
  )
  const [canInstall, setCanInstall] = useState(Boolean(window.deferredInstallPrompt))
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [dictationLang, setDictLang] = useState(() => getDictationLang())

  useEffect(() => applyTheme(theme), [theme])

  function exportNotes() {
    const payload = notes.map(({ id, ...rest }) => ({
      id,
      ...rest,
      createdAt: rest.createdAt.toISOString(),
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-aipa-notes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'Auto', icon: MonitorSmartphone },
    { value: 'dark', label: 'Dark', icon: Moon },
  ]

  return (
    <div className="flex flex-col gap-5 px-5 lg:mx-auto lg:max-w-3xl lg:px-8">
      <header className="sticky top-0 z-10 -mx-5 bg-zinc-50/80 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl dark:bg-[#0b0712]/80 lg:-mx-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="flex items-center gap-4 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-full"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-xl font-bold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
            {(user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-bold">{user?.displayName ?? 'You'}</p>
          <p className="truncate text-sm text-zinc-400 dark:text-zinc-500">{user?.email}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {notes.length} notes · {categories.length} categories
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
        <h2 className="text-sm font-bold">Appearance</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-white/5">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition',
                theme === value
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Mic size={15} className="text-accent-500" />
          Dictation language
        </h2>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Used for voice input on devices that support live speech. Other devices
          auto-detect the language.
        </p>
        <select
          value={dictationLang}
          onChange={(e) => {
            setDictLang(e.target.value)
            setDictationLang(e.target.value)
          }}
          className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-accent-400 dark:border-white/10 dark:bg-white/5"
        >
          {DICTATION_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm dark:border-white/5 dark:bg-zinc-900">
        {canInstall && (
          <button
            onClick={async () => {
              await window.deferredInstallPrompt?.prompt()
              window.deferredInstallPrompt = undefined
              setCanInstall(false)
            }}
            className="flex w-full items-center gap-3 px-5 py-4 text-left font-medium transition active:bg-zinc-50 dark:active:bg-white/5"
          >
            <Download size={19} className="text-accent-500" />
            Install app on this device
          </button>
        )}
        <button
          onClick={exportNotes}
          disabled={notes.length === 0}
          className="flex w-full items-center gap-3 border-t border-zinc-100 px-5 py-4 text-left font-medium transition active:bg-zinc-50 disabled:opacity-40 first:border-t-0 dark:border-white/5 dark:active:bg-white/5"
        >
          <FileJson size={19} className="text-accent-500" />
          Export notes as JSON
        </button>
        <button
          onClick={() => setConfirmSignOut(true)}
          className="flex w-full items-center gap-3 border-t border-zinc-100 px-5 py-4 text-left font-medium text-red-500 transition active:bg-red-50 dark:border-white/5 dark:active:bg-red-500/10"
        >
          <LogOut size={19} />
          Sign out
        </button>
      </section>

      <p className="pb-4 text-center text-xs text-zinc-300 dark:text-zinc-600">
        My AIPA · notes organized by Gemini · answers come only from your notes
      </p>

      <ConfirmSheet
        open={confirmSignOut}
        title="Sign out?"
        description="Your notes stay safe in your account. Unsynced offline notes will upload next time you sign in."
        onDismiss={() => setConfirmSignOut(false)}
        actions={[
          { label: 'Sign out', kind: 'destructive', onClick: () => void signOut() },
          { label: 'Cancel', kind: 'ghost', onClick: () => setConfirmSignOut(false) },
        ]}
      />
    </div>
  )
}
