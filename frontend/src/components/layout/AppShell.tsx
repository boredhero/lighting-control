import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Lightbulb, Zap, Clock, Settings, DoorOpen, Menu } from 'lucide-react'
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
    <Link to={path} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  )
}

function DesktopSidebar() {
  const location = useLocation()
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-[var(--surface-1)] p-4 gap-1">
      <h1 className="text-lg font-bold mb-6 px-3 text-[var(--color-amber)]">Lighting Control</h1>
      {NAV_ITEMS.map((item) => <NavLink key={item.path} {...item} active={location.pathname === item.path} />)}
    </aside>
  )
}

function MobileBottomNav() {
  const location = useLocation()
  const items = NAV_ITEMS.slice(0, 5)
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface-1)] border-t border-border flex justify-around py-2 z-50">
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
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] border-b border-border">
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
  return (
    <div className="flex h-screen">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
