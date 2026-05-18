import { z } from 'zod'

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: z.enum(['business_owner', 'chartered_accountant', 'rule_contributor', 'reviewer', 'admin']),
})

export type MeResponse = z.infer<typeof MeResponseSchema>
