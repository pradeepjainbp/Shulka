import { auditEvents, db } from '@shulka/db'
import { eq } from 'drizzle-orm'
// @integration — requires a real DATABASE_URL to run
import { describe, expect, it } from 'vitest'

describe.skipIf(!process.env.DATABASE_URL)('audit_events immutability trigger', () => {
  it('rejects UPDATE on audit_events', async () => {
    // First insert a test event
    const [inserted] = await db
      .insert(auditEvents)
      .values({
        actorUserId: '00000000-0000-0000-0000-000000000001',
        kind: 'business.created',
        payload: { fields_changed: ['name'] },
      })
      .returning({ id: auditEvents.id })

    if (!inserted) throw new Error('Insert failed')

    // Attempt UPDATE — trigger should throw
    await expect(
      db.update(auditEvents).set({ kind: 'tampered' }).where(eq(auditEvents.id, inserted.id)),
    ).rejects.toThrow()
  })
})
