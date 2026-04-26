import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Lightbulb, Zap, Clock, Settings, DoorOpen, Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/devices', label: 'Devices', icon: Lightbulb },
  { path: '/quick-actions', label: 'Quick Actions', icon: Zap },
  { path: '/schedules', label: 'Schedules', icon: Clock },
  { path: '/rooms-zones', label: 'Rooms & Zones', icon: DoorOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function NavLink({ path, label, icon: Icon, active }: { path: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link to={path} className={`flex items-center gap-3 px-3 py-2 3xl:px-4 3xl:py-3 tv:px-5 tv:py-4 rounded-lg transition-colors text-sm 3xl:text-base tv:text-xl ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
      <Icon className="size-5 3xl:size-6 tv:size-8 shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function DesktopSidebar() {
  const location = useLocation()
  return (
    <aside className="hidden md:flex flex-col w-64 3xl:w-72 4xl:w-80 tv:w-[22rem] border-r border-border bg-[var(--surface-1)]/80 backdrop-blur-md p-4 3xl:p-5 tv:p-6 gap-1 3xl:gap-2">
      <h1 className="text-lg 3xl:text-xl tv:text-3xl font-bold mb-6 3xl:mb-8 tv:mb-10 px-3 3xl:px-4 text-[var(--color-amber)] tracking-tight">Lighting Control</h1>
      {NAV_ITEMS.map((item) => <NavLink key={item.path} {...item} active={location.pathname === item.path} />)}
    </aside>
  )
}

function MobileBottomNav() {
  const location = useLocation()
  const items = NAV_ITEMS.slice(0, 5)
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface-1)]/90 backdrop-blur-md border-t border-border flex justify-around py-2 z-50">
      {items.map(({ path, label, icon: Icon }) => (
        <Link key={path} to={path} className={`flex flex-col items-center gap-1 px-2 py-1 text-xs ${location.pathname === path ? 'text-primary' : 'text-muted-foreground'}`}>
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}

function MobileHeader() {
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-border">
      <h1 className="text-lg font-bold text-[var(--color-amber)]">Lighting Control</h1>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" />}><Menu size={20} /></SheetTrigger>
        <SheetContent side="right" className="bg-[var(--surface-1)] w-64">
          <div className="flex flex-col gap-1 mt-8">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <item.icon size={20} /><span>{item.label}</span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div className="flex h-screen">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 3xl:p-8 tv:p-12 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-[140rem] tv:max-w-none">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
