import { useEffect, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { useSpeechInput } from '../hooks/useSpeechInput'
import { cn } from '../lib/utils'

interface MicButtonProps {
  // Receives finalized transcript chunks. Caller decides whether to append
  // (notes) or fill (Ask).
  onTranscript: (text: string) => void
  // Optional live interim text while the user is still speaking (Web Speech).
  onPartial?: (text: string) => void
  className?: string
}

export default function MicButton({ onTranscript, onPartial, className }: MicButtonProps) {
  const { listening, transcribing, error, start, stop } = useSpeechInput({
    onFinal: onTranscript,
    onPartial,
  })

  // Show errors as a brief bubble that auto-dismisses.
  const [showError, setShowError] = useState(false)
  useEffect(() => {
    if (!error) return
    setShowError(true)
    const t = setTimeout(() => setShowError(false), 4000)
    return () => clearTimeout(t)
  }, [error])

  const busy = transcribing
  const active = listening

  return (
    <span className="relative flex">
      {showError && error && (
        <span className="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[60vw] -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-1.5 text-center text-xs text-white shadow-lg dark:bg-zinc-700">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => (active ? stop() : start())}
        disabled={busy}
        aria-label={active ? 'Stop dictation' : 'Dictate with voice'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90',
          active
            ? 'animate-pulse bg-red-500 text-white shadow-md shadow-red-500/30'
            : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-300',
          busy && 'opacity-60',
          className,
        )}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : active ? (
          <Square size={16} fill="currentColor" />
        ) : (
          <Mic size={18} />
        )}
      </button>
    </span>
  )
}
