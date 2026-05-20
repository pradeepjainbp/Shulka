import { type AuditKind, type AuditPayload, AuditPayloadSchemas } from '@shulka/shared-types'
import { db } from './client'
import { auditEvents } from './schema/index'

export type RecordEventInput<K extends AuditKind> = {
  actorUserId: string
  businessId?: string
  kind: K
  refTable?: string
  refId?: string
  payload: AuditPayload<K>
  ruleIds?: string[]
}

export async function recordEvent<K extends AuditKind>(input: RecordEventInput<K>): Promise<void> {
  // Validate payload against the kind's schema — throws ZodError on mismatch
  const schema = AuditPayloadSchemas[input.kind]
  schema.parse(input.payload)

  const values: {
    actorUserId: string
    businessId: string | null
    kind: string
    refTable: string | null
    refId: string | null
    payload: AuditPayload<K>
    ruleIds: string[] | null
  } = {
    actorUserId: input.actorUserId,
    businessId: input.businessId !== undefined ? input.businessId : null,
    kind: input.kind,
    refTable: input.refTable !== undefined ? input.refTable : null,
    refId: input.refId !== undefined ? input.refId : null,
    payload: input.payload,
    ruleIds: input.ruleIds !== undefined ? input.ruleIds : null,
  }

  await db.insert(auditEvents).values(values)
}
