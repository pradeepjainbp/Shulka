export const dynamic = 'force-dynamic'

/**
 * DELETE /api/trusts/:id  — revoke trust (status → 'revoked')
 *
 * The :id is the business_trusts.id (UUID). Trust is directional: only the truster
 * business (the one who granted trust) can revoke it.
 *
 * On revoke:
 *  - business_trusts.status → 'revoked', revoked_at = now, revoked_by_user_id = userId
 *  - audit event: 'business_trust.revoked'
 *  - Existing purchase_invoices mirrors are NOT deleted (append-only audit trail, Rule #3).
 *
 * Sacred rules enforced:
 *  - Zod schema at every API boundary (Rule #11)
 *  - Every financial mutation calls recordEvent (Rule #3)
 *  - DPDP: ownership check before any mutation (Rule #8)
 *  - withErrorReporting wraps the handler
 */

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businessTrusts, businesses, db, recordEvent } from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Route context
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// DELETE /api/trusts/:id
// ---------------------------------------------------------------------------

export const DELETE = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id: trustId } = await (ctx as RouteContext).params

  // --- Fetch the trust row ---
  const [trust] = await db
    .select()
    .from(businessTrusts)
    .where(eq(businessTrusts.id, trustId))
    .limit(1)

  if (!trust) {
    return NextResponse.json({ error: 'Trust not found' }, { status: 404 })
  }

  // --- DPDP ownership check: caller must own the truster business ---
  const [ownedBiz] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, trust.trusterBusinessId),
        eq(businesses.ownerUserId, userId),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)

  if (!ownedBiz) {
    // Return 404 rather than 403 to avoid leaking trust row existence (DPDP)
    return NextResponse.json({ error: 'Trust not found' }, { status: 404 })
  }

  // --- Guard: already revoked ---
  if (trust.status === 'revoked') {
    return NextResponse.json({ error: 'Trust is already revoked' }, { status: 409 })
  }

  const priorStatus = trust.status

  // --- UPDATE status to 'revoked' ---
  const [revokedTrust] = await db
    .update(businessTrusts)
    .set({
      status: 'revoked',
      revokedAt: new Date(),
      revokedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(businessTrusts.id, trustId))
    .returning()

  if (!revokedTrust) {
    return NextResponse.json({ error: 'Failed to revoke trust' }, { status: 500 })
  }

  // --- Audit event (Sacred Rule #3) ---
  await recordEvent({
    actorUserId: userId,
    businessId: trust.trusterBusinessId,
    kind: 'business_trust.revoked',
    refTable: 'business_trusts',
    refId: trustId,
    payload: {
      trusted_business_id: trust.trustedBusinessId,
      prior_status: priorStatus,
    },
  })

  return NextResponse.json({ trust: revokedTrust })
})
