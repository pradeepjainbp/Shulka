/**
 * GET  /api/trusts?businessId=<uuid>  — list business trusts where truster = current business
 * POST /api/trusts                    — proactively elevate trust (without invoice context)
 *
 * The POST here is a trust-only elevation: it does NOT create purchase_invoice mirrors.
 * That happens either via POST /api/incoming/:id/accept (invoice-triggered) or automatically
 * when the sender creates their next sales invoice (auto-mirror path in POST /api/sales).
 *
 * Sacred rules enforced:
 *  - Zod schema at every API boundary (Rule #11)
 *  - Every financial mutation calls recordEvent (Rule #3)
 *  - DPDP: ownership check before returning any data (Rule #8)
 *  - withErrorReporting wraps every handler
 */

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businessTrusts, businesses, db, recordEvent } from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const ListTrustsSchema = z.object({
  businessId: z.string().uuid(),
})

export const ElevateTrustSchema = z.object({
  trusterBusinessId: z.string().uuid(),
  trustedBusinessId: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Ownership helper
// ---------------------------------------------------------------------------

async function getOwnedBusiness(businessId: string, userId: string) {
  const [biz] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, businessId),
        eq(businesses.ownerUserId, userId),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)
  return biz ?? null
}

// ---------------------------------------------------------------------------
// GET /api/trusts
// ---------------------------------------------------------------------------

export const GET = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // --- Zod validation at API boundary ---
  const rawBusinessId = req.nextUrl.searchParams.get('businessId')
  const parsed = ListTrustsSchema.safeParse({ businessId: rawBusinessId })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { businessId } = parsed.data

  // --- DPDP ownership check ---
  const biz = await getOwnedBusiness(businessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const rows = await db
    .select()
    .from(businessTrusts)
    .where(eq(businessTrusts.trusterBusinessId, businessId))

  return NextResponse.json(rows)
})

// ---------------------------------------------------------------------------
// POST /api/trusts — proactive trust elevation (no invoice context)
// ---------------------------------------------------------------------------

export const POST = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // --- Zod validation at API boundary ---
  const body: unknown = await req.json()
  const parsed = ElevateTrustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { trusterBusinessId, trustedBusinessId } = parsed.data

  // --- DPDP ownership check: caller must own the truster business ---
  const biz = await getOwnedBusiness(trusterBusinessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // --- Guard: cannot trust yourself ---
  if (trusterBusinessId === trustedBusinessId) {
    return NextResponse.json({ error: 'A business cannot trust itself' }, { status: 422 })
  }

  // --- Verify the target business exists ---
  const [targetBiz] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, trustedBusinessId), isNull(businesses.deletedAt)))
    .limit(1)

  if (!targetBiz) {
    return NextResponse.json({ error: 'Target business not found' }, { status: 404 })
  }

  // --- Check for existing trust row ---
  const [existingTrust] = await db
    .select({ id: businessTrusts.id, status: businessTrusts.status })
    .from(businessTrusts)
    .where(
      and(
        eq(businessTrusts.trusterBusinessId, trusterBusinessId),
        eq(businessTrusts.trustedBusinessId, trustedBusinessId),
      ),
    )
    .limit(1)

  // --- Guard: already trusted ---
  if (existingTrust?.status === 'trusted') {
    return NextResponse.json(
      { error: 'Trust already exists for this business pair' },
      { status: 409 },
    )
  }

  const priorStatus = existingTrust?.status ?? 'none'

  // --- Upsert trust ---
  let trust: typeof businessTrusts.$inferSelect

  if (existingTrust) {
    const [updated] = await db
      .update(businessTrusts)
      .set({
        status: 'trusted',
        elevatedAt: new Date(),
        elevatedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(businessTrusts.id, existingTrust.id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update trust' }, { status: 500 })
    }
    trust = updated
  } else {
    const [inserted] = await db
      .insert(businessTrusts)
      .values({
        trusterBusinessId,
        trustedBusinessId,
        status: 'trusted',
        elevatedAt: new Date(),
        elevatedByUserId: userId,
      })
      .returning()

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create trust' }, { status: 500 })
    }
    trust = inserted
  }

  // --- Audit event (Sacred Rule #3) ---
  await recordEvent({
    actorUserId: userId,
    businessId: trusterBusinessId,
    kind: 'business_trust.elevated',
    refTable: 'business_trusts',
    refId: trust.id,
    payload: {
      trusted_business_id: trustedBusinessId,
      prior_status: priorStatus,
    },
  })

  return NextResponse.json({ trust }, { status: 201 })
})
