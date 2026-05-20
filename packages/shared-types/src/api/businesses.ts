import { z } from 'zod'

export const BusinessResponseSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  name: z.string(),
  legalName: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  stateCode: z.string().nullable(),
  address: z.object({ text: z.string() }).nullable(),
  registrationDate: z.string().nullable(),
  type: z.enum(['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd', 'huf', 'other']),
  compositionScheme: z.boolean(),
  upiVpa: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BusinessResponse = z.infer<typeof BusinessResponseSchema>
