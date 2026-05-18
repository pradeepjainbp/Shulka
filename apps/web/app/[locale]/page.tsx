import { AppShell } from '@/components/shell/AppShell'

export default function Home() {
  return (
    <AppShell>
      <div className="p-8">
        <h1 className="text-[32px] leading-[1.15] tracking-[-0.015em] font-medium text-ink">
          Shulka
        </h1>
        <p className="text-[15px] leading-[1.55] text-ink-muted mt-2">Setup in progress.</p>
      </div>
    </AppShell>
  )
}
