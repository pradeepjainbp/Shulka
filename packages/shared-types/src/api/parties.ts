import { z } from 'zod'

export const PartyResponseSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string(),
  legalName: z.string().nullable(),
  externalGstin: z.string().nullable(),
  linkedBusinessId: z.string().uuid().nullable(),
  isOnShulka: z.boolean(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.object({ text: z.string() }).nullable(),
  partyKind: z.enum(['customer', 'supplier', 'both']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PartyResponse = z.infer<typeof PartyResponseSchema>
