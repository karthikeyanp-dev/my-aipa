import { Sparkles } from 'lucide-react'

export default function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-xl shadow-accent-600/30">
        <Sparkles size={30} />
      </div>
    </div>
  )
}
