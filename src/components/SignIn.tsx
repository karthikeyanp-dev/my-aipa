import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  )
}

export default function SignIn() {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 pb-[env(safe-area-inset-bottom)]">
      <div className="rise-enter flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-xl shadow-accent-600/30">
          <Sparkles size={38} />
        </div>
        <h1 className="mt-7 text-3xl font-bold tracking-tight">My AIPA</h1>
        <p className="mt-2 text-center text-zinc-500 dark:text-zinc-400">
          Write anything. Ask anything.
          <br />
          AI keeps your notes organized for you.
        </p>
      </div>

      <button
        onClick={async () => {
          setBusy(true)
          try {
            await signIn()
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy}
        className="mt-12 flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-3.5 font-semibold text-zinc-800 shadow-sm transition active:scale-[0.98] disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <GoogleLogo />
        {busy ? 'Signing in…' : 'Continue with Google'}
      </button>

      <p className="mt-6 max-w-xs text-center text-xs text-zinc-400 dark:text-zinc-500">
        Your notes are private and stored only in your account.
      </p>
    </div>
  )
}
