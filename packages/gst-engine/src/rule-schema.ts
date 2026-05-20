/**
 * RuleFile schema — pure TypeScript, zero runtime deps.
 *
 * Implements a minimal Zod-like API (parse / safeParse) so callers can
 * validate rule JSON at load time without importing Zod.
 *
 * The `rule` field uses Record<string, unknown> — domain-specific sub-shapes
 * are validated by domain-specific schemas in later tickets.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleSource {
  type: 'notification' | 'circular' | 'amendment' | 'internal'
  id: string
  council_meeting: string | null
  url: string | null
  archived_pdf: string | null
  summary: string
}

export interface RuleActor {
  name: string
  membership_no: string | null
  user_id: string
}

export interface RuleTest {
  description: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

export interface RuleFile {
  rule_id: string
  domain: string
  key: string
  effective_from: string // ISO date YYYY-MM-DD
  effective_to: string | null
  supersedes: string | null
  source: RuleSource
  rule: Record<string, unknown>
  submitted_by: RuleActor
  approved_by: RuleActor
  interpretation_note: string | null
  tests: RuleTest[]
  hash: string
}

// ---------------------------------------------------------------------------
// Validation helpers (no runtime deps)
// ---------------------------------------------------------------------------

type ValidationError = { path: string; message: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNullOrString(v: unknown): v is string | null {
  return v === null || typeof v === 'string'
}

function validateRuleActor(v: unknown, path: string): ValidationError[] {
  const errs: ValidationError[] = []
  if (!isObject(v)) {
    errs.push({ path, message: 'must be an object' })
    return errs
  }
  if (typeof v.name !== 'string') errs.push({ path: `${path}.name`, message: 'must be a string' })
  if (!isNullOrString(v.membership_no))
    errs.push({ path: `${path}.membership_no`, message: 'must be string | null' })
  if (typeof v.user_id !== 'string')
    errs.push({ path: `${path}.user_id`, message: 'must be a string' })
  return errs
}

const VALID_SOURCE_TYPES = new Set(['notification', 'circular', 'amendment', 'internal'])
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateRuleSource(v: unknown, path: string): ValidationError[] {
  const errs: ValidationError[] = []
  if (!isObject(v)) {
    errs.push({ path, message: 'must be an object' })
    return errs
  }
  if (!VALID_SOURCE_TYPES.has(v.type as string))
    errs.push({
      path: `${path}.type`,
      message: 'must be notification | circular | amendment | internal',
    })
  if (typeof v.id !== 'string') errs.push({ path: `${path}.id`, message: 'must be a string' })
  if (!isNullOrString(v.council_meeting))
    errs.push({ path: `${path}.council_meeting`, message: 'must be string | null' })
  if (!isNullOrString(v.url)) errs.push({ path: `${path}.url`, message: 'must be string | null' })
  if (!isNullOrString(v.archived_pdf))
    errs.push({ path: `${path}.archived_pdf`, message: 'must be string | null' })
  if (typeof v.summary !== 'string')
    errs.push({ path: `${path}.summary`, message: 'must be a string' })
  return errs
}

function validateRuleTests(v: unknown, path: string): ValidationError[] {
  if (!Array.isArray(v)) return [{ path, message: 'must be an array' }]
  return []
}

function validateRuleFile(v: unknown): ValidationError[] {
  const errs: ValidationError[] = []
  if (!isObject(v)) return [{ path: '', message: 'must be an object' }]

  if (typeof v.rule_id !== 'string') errs.push({ path: 'rule_id', message: 'must be a string' })
  if (typeof v.domain !== 'string') errs.push({ path: 'domain', message: 'must be a string' })
  if (typeof v.key !== 'string') errs.push({ path: 'key', message: 'must be a string' })

  if (typeof v.effective_from !== 'string' || !ISO_DATE_RE.test(v.effective_from as string))
    errs.push({ path: 'effective_from', message: 'must be ISO date YYYY-MM-DD' })

  if (!isNullOrString(v.effective_to))
    errs.push({ path: 'effective_to', message: 'must be ISO date string or null' })
  if (typeof v.effective_to === 'string' && !ISO_DATE_RE.test(v.effective_to))
    errs.push({ path: 'effective_to', message: 'must be ISO date YYYY-MM-DD when not null' })

  if (!isNullOrString(v.supersedes))
    errs.push({ path: 'supersedes', message: 'must be string | null' })

  errs.push(...validateRuleSource(v.source, 'source'))

  if (!isObject(v.rule)) errs.push({ path: 'rule', message: 'must be an object' })

  errs.push(...validateRuleActor(v.submitted_by, 'submitted_by'))
  errs.push(...validateRuleActor(v.approved_by, 'approved_by'))

  if (!isNullOrString(v.interpretation_note))
    errs.push({ path: 'interpretation_note', message: 'must be string | null' })

  errs.push(...validateRuleTests(v.tests, 'tests'))

  if (typeof v.hash !== 'string') errs.push({ path: 'hash', message: 'must be a string' })

  return errs
}

// ---------------------------------------------------------------------------
// Schema object — Zod-compatible surface
// ---------------------------------------------------------------------------

export type SafeParseSuccess = { success: true; data: RuleFile }
export type SafeParseError = { success: false; error: { errors: ValidationError[] } }
export type SafeParseResult = SafeParseSuccess | SafeParseError

export const RuleFileSchema = {
  /** Throws if invalid; returns typed RuleFile if valid. */
  parse(input: unknown): RuleFile {
    const errs = validateRuleFile(input)
    if (errs.length > 0) {
      const msg = errs.map((e) => `  ${e.path}: ${e.message}`).join('\n')
      throw new Error(`RuleFile validation failed:\n${msg}`)
    }
    return input as RuleFile
  },

  /** Never throws; returns success/error discriminated union. */
  safeParse(input: unknown): SafeParseResult {
    const errs = validateRuleFile(input)
    if (errs.length > 0) {
      return { success: false, error: { errors: errs } }
    }
    return { success: true, data: input as RuleFile }
  },
} as const
