import { Sparkles } from 'lucide-react'

export default function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white">
          <Sparkles size={24} />
        </div>
        <h1 className="mt-5 text-xl font-bold">Almost there — connect Firebase</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          The app isn't configured yet. Create a <code>.env</code> file from{' '}
          <code>.env.example</code> with your Firebase web app config, then restart the
          dev server. Full steps are in <code>README.md</code>.
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          <li>Create a Firebase project (Blaze plan)</li>
          <li>Enable Google Sign-In + Firestore</li>
          <li>Add a Web App and copy its config into <code>.env</code></li>
          <li>Deploy the Cloud Functions in <code>functions/</code></li>
        </ol>
      </div>
    </div>
  )
}
