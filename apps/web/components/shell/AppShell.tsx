import type { ReactNode } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Purchases', href: '/purchases' },
  { label: 'Insights', href: '/insights' },
  { label: 'Settings', href: '/settings' },
] as const

const mobileLabels: Record<string, string> = {
  Dashboard: 'Home',
  Invoices: 'Inv',
  Purchases: 'Purch',
  Insights: 'Stats',
  Settings: 'Setup',
}

function Header() {
  return (
    <header className="h-14 bg-raised border-b border-border px-6 flex items-center justify-between sticky top-0 z-10">
      <span className="text-[18px] leading-[1.3] font-semibold text-primary">Shulka</span>
      <div
        className="w-8 h-8 rounded-pill bg-primary-50 flex items-center justify-center
          text-[13px] leading-[1.5] font-medium text-primary"
        aria-label="User account"
      >
        U
      </div>
    </header>
  )
}

function SideNavItem({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="px-4 py-2.5 text-[15px] leading-[1.55] text-ink-soft
        hover:bg-surface hover:text-ink rounded-md mx-2 transition-colors duration-[150ms]
        flex items-center"
    >
      {label}
    </a>
  )
}

function SideNav() {
  return (
    <>
      {/* Desktop sidebar: ≥1024px, 240px wide */}
      <aside className="w-60 bg-raised border-r border-border flex-shrink-0 hidden lg:flex flex-col pt-4 gap-1">
        {navItems.map((item) => (
          <SideNavItem key={item.href} label={item.label} href={item.href} />
        ))}
      </aside>

      {/* Tablet icon rail: 768–1023px, ~60px wide */}
      <aside className="w-[60px] bg-raised border-r border-border flex-shrink-0 hidden md:flex lg:hidden flex-col items-center pt-4 gap-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            title={item.label}
            className="w-10 h-10 flex items-center justify-center rounded-md
              text-[11px] leading-none text-ink-soft hover:bg-surface hover:text-ink
              transition-colors duration-[150ms]"
          >
            {item.label.slice(0, 2)}
          </a>
        ))}
      </aside>
    </>
  )
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-raised border-t border-border flex md:hidden z-10">
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex-1 flex flex-col items-center justify-center gap-0.5
            text-[11px] leading-none text-ink-muted hover:text-primary
            transition-colors duration-[150ms]"
        >
          <span className="text-[13px] leading-none font-medium">
            {mobileLabels[item.label] ?? item.label.slice(0, 4)}
          </span>
        </a>
      ))}
    </nav>
  )
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <div className="max-w-[1280px] mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
