import { z } from 'zod'

// Payload schemas keyed by kind — matches ARCHITECTURE.md §3 audit_events table
export const AuditPayloadSchemas = {
  'business.created': z.object({ fields_changed: z.array(z.string()) }),
  'business.updated': z.object({ fields_changed: z.array(z.string()) }),
  'party.created': z.object({ fields_changed: z.array(z.string()) }),
  'party.updated': z.object({ fields_changed: z.array(z.string()) }),
  'sales_invoice.created': z.object({
    total_amount_paise: z.number().int(),
    party_id: z.string().uuid(),
    invoice_number: z.string(),
  }),
  'sales_invoice.status_changed': z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string().optional(),
  }),
  'sales_invoice.cancelled': z.object({
    reversing_invoice_id: z.string().uuid(),
    reason: z.string(),
  }),
  'sales_invoice.pos_overridden': z.object({
    auto_derived: z.string(), // state code that engine would have chosen
    overridden_to: z.string(), // state code user selected
    reason: z.string(),
    rule_id: z.string(), // e.g. 'POS_INTERSTATE_v1'
  }),
  'purchase_invoice.created': z.object({
    total_amount_paise: z.number().int(),
    party_id: z.string().uuid(),
    supplier_invoice_number: z.string(),
  }),
  'purchase_invoice.status_changed': z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string().optional(),
  }),
  'purchase_invoice.cancelled': z.object({
    reversing_invoice_id: z.string().uuid(),
    reason: z.string(),
  }),
  'business_trust.elevated': z.object({
    trusted_business_id: z.string().uuid(),
    prior_status: z.string(),
  }),
  'business_trust.revoked': z.object({
    trusted_business_id: z.string().uuid(),
    prior_status: z.string(),
  }),
  'itc.claimed': z.object({
    amount_paise: z.number().int(),
    period: z.string(),
  }),
  'itc.blocked_override': z.object({
    original_blocked_rule_id: z.string(),
    override_reason: z.string(),
  }),
  'user.deleted': z.object({ user_id: z.string().uuid() }),
} as const

export type AuditKind = keyof typeof AuditPayloadSchemas

export type AuditPayload<K extends AuditKind> = z.infer<(typeof AuditPayloadSchemas)[K]>
