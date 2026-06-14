import { NavLink, Outlet } from 'react-router-dom'
import { Home, Sparkles, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/ask', label: 'Ask', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavItem({ to, label, icon: Icon, desktop }: { to: string; label: string; icon: typeof Home; desktop?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center font-medium transition-colors',
          desktop
            ? 'w-full gap-3 rounded-xl px-4 py-3 text-sm'
            : 'flex-1 flex-col gap-1 pt-2.5 pb-2 text-[11px]',
          isActive
            ? 'text-accent-600 dark:text-accent-400'
            : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={desktop ? 20 : 22} strokeWidth={isActive ? 2.4 : 2} />
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-10 lg:flex lg:h-dvh lg:w-64 lg:flex-col lg:border-r lg:border-zinc-200/70 lg:bg-white/95 lg:dark:border-white/5 lg:dark:bg-[#13101c]/95">
        <nav className="flex flex-col gap-1 p-4">
          {tabs.map((t) => (
            <NavItem key={t.to} {...t} desktop />
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#13101c]/80 lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <NavItem key={t.to} {...t} />
          ))}
        </div>
      </nav>
    </div>
  )
}
