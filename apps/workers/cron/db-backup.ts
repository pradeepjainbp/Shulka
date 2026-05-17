// Nightly DB backup stub.
// Phase 4 will wire the real pg_dump invocation. For now: writes a heartbeat
// file to R2 to prove the cron, Worker, and R2 path are all wired up Day 1.

export interface Env {
  BACKUP_BUCKET: R2Bucket
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const ts = new Date().toISOString()
    const key = `heartbeat/${ts.slice(0, 10)}/ping.txt`
    await env.BACKUP_BUCKET.put(key, `backup cron alive at ${ts}`)
  },
} satisfies ExportedHandler<Env>
