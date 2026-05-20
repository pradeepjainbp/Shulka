import { describe, expect, it } from 'vitest'
import { RuleEngine, RuleEngineError } from './engine'
import type { RuleFile } from './rule-schema'

// ---------------------------------------------------------------------------
// Helpers — minimal valid rule factories
// ---------------------------------------------------------------------------

function makeActor() {
  return { name: 'Test', membership_no: null, user_id: 'system' }
}

function makeSource() {
  return {
    type: 'notification' as const,
    id: 'TEST-001',
    council_meeting: null,
    url: null,
    archived_pdf: null,
    summary: 'Test rule',
  }
}

function makeRule(overrides: Partial<RuleFile> = {}): RuleFile {
  return {
    rule_id: 'TEST_RULE_v1',
    domain: 'test',
    key: 'test_key',
    effective_from: '2020-01-01',
    effective_to: null,
    supersedes: null,
    source: makeSource(),
    rule: { kind: 'test' },
    submitted_by: makeActor(),
    approved_by: makeActor(),
    interpretation_note: null,
    tests: [],
    hash: 'sha256-placeholder',
    ...overrides,
  }
}

// The two e-invoice threshold rules mirroring the seeded JSON files
const einvoice10cr: RuleFile = {
  rule_id: 'THRESHOLD_EINVOICE_10CR_v1',
  domain: 'threshold',
  key: 'einvoice_mandatory',
  effective_from: '2020-10-01',
  effective_to: '2023-07-31',
  supersedes: null,
  source: {
    type: 'notification',
    id: '88/2020-Central Tax',
    council_meeting: null,
    url: null,
    archived_pdf: null,
    summary: 'e-Invoice mandatory threshold ₹10 Cr',
  },
  rule: {
    kind: 'threshold',
    amount_paise: 1000000000,
    description: 'e-Invoice mandatory threshold ₹10 Cr',
  },
  submitted_by: makeActor(),
  approved_by: makeActor(),
  interpretation_note: null,
  tests: [],
  hash: 'sha256-placeholder',
}

const einvoice5cr: RuleFile = {
  rule_id: 'THRESHOLD_EINVOICE_5CR_v1',
  domain: 'threshold',
  key: 'einvoice_mandatory',
  effective_from: '2023-08-01',
  effective_to: null,
  supersedes: 'THRESHOLD_EINVOICE_10CR_v1',
  source: {
    type: 'notification',
    id: '10/2023-Central Tax',
    council_meeting: null,
    url: null,
    archived_pdf: null,
    summary: 'e-Invoice mandatory threshold ₹5 Cr',
  },
  rule: {
    kind: 'threshold',
    amount_paise: 500000000,
    description: 'e-Invoice mandatory threshold ₹5 Cr',
  },
  submitted_by: makeActor(),
  approved_by: makeActor(),
  interpretation_note: null,
  tests: [],
  hash: 'sha256-placeholder',
}

// ---------------------------------------------------------------------------
// 1. Date-range resolution
// ---------------------------------------------------------------------------

describe('date-range resolution', () => {
  const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

  it('resolves to 10cr rule for a date within its range', () => {
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_10CR_v1')
  })

  it('resolves to 5cr rule for a date after switchover', () => {
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2024-01-01')
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_5CR_v1')
  })

  it('resolves to 10cr rule on the last day of its range (effective_to inclusive)', () => {
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2023-07-31')
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_10CR_v1')
  })

  it('resolves to 5cr rule on the first day of its range (effective_from inclusive)', () => {
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2023-08-01')
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_5CR_v1')
  })

  it('returns correct rule fields', () => {
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')
    expect(result.domain).toBe('threshold')
    expect(result.key).toBe('einvoice_mandatory')
    expect(result.effective_from).toBe('2020-10-01')
    expect(result.effective_to).toBe('2023-07-31')
    expect(result.rule).toEqual(einvoice10cr.rule)
  })
})

// ---------------------------------------------------------------------------
// 2. Scheme election grandfathering
// ---------------------------------------------------------------------------

describe('scheme election grandfathering', () => {
  const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

  it('returns the elected rule_id regardless of transaction date', () => {
    // On 2024-01-01 the normal resolution would give the 5cr rule,
    // but the scheme election grandfathers the 10cr rule.
    const result = engine.resolveRule('threshold', 'einvoice_mandatory', '2024-01-01', {
      schemeElection: {
        threshold_rule_id: 'THRESHOLD_EINVOICE_10CR_v1',
        rate_rules: [],
      },
    })
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_10CR_v1')
  })

  it('falls through to date resolution if election rule_id is for a different (domain, key)', () => {
    // Election points to a rule_id that exists but is for domain 'gst_rate',
    // not 'threshold/einvoice_mandatory', so date resolution applies.
    const gstRate5: RuleFile = makeRule({
      rule_id: 'GST_RATE_5_v1',
      domain: 'gst_rate',
      key: 'rate_5',
      effective_from: '2017-07-01',
    })
    const engineWithExtra = RuleEngine.fromRules([einvoice10cr, einvoice5cr, gstRate5])

    const result = engineWithExtra.resolveRule('threshold', 'einvoice_mandatory', '2024-01-01', {
      schemeElection: {
        threshold_rule_id: 'GST_RATE_5_v1', // different domain — no effect
        rate_rules: [],
      },
    })
    expect(result.rule_id).toBe('THRESHOLD_EINVOICE_5CR_v1')
  })
})

// ---------------------------------------------------------------------------
// 3. Invariant: duplicate rule_id
// ---------------------------------------------------------------------------

describe('invariant: duplicate rule_id', () => {
  it('throws RuleEngineError with code DUPLICATE_RULE_ID', () => {
    const r1 = makeRule({
      rule_id: 'DUP_v1',
      effective_from: '2020-01-01',
      effective_to: '2020-12-31',
    })
    const r2 = makeRule({ rule_id: 'DUP_v1', effective_from: '2021-01-01', effective_to: null })

    expect(() => RuleEngine.fromRules([r1, r2])).toThrowError(RuleEngineError)
    try {
      RuleEngine.fromRules([r1, r2])
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('DUPLICATE_RULE_ID')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 4. Invariant: rule overlap
// ---------------------------------------------------------------------------

describe('invariant: rule overlap', () => {
  it('throws RuleEngineError with code RULE_OVERLAP for overlapping date ranges', () => {
    const r1 = makeRule({
      rule_id: 'OVERLAP_A_v1',
      domain: 'overlap_test',
      key: 'overlap_key',
      effective_from: '2020-01-01',
      effective_to: '2021-12-31',
    })
    const r2 = makeRule({
      rule_id: 'OVERLAP_B_v1',
      domain: 'overlap_test',
      key: 'overlap_key',
      effective_from: '2021-06-01', // overlaps with r1 which ends 2021-12-31
      effective_to: null,
    })

    try {
      RuleEngine.fromRules([r1, r2])
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('RULE_OVERLAP')
      }
    }
  })

  it('does NOT throw for adjacent non-overlapping ranges', () => {
    // e-invoice pair: 10cr ends 2023-07-31, 5cr starts 2023-08-01
    expect(() => RuleEngine.fromRules([einvoice10cr, einvoice5cr])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 5. Invariant: broken supersedes chain
// ---------------------------------------------------------------------------

describe('invariant: broken supersedes chain', () => {
  it('throws when supersedes references a non-existent rule_id', () => {
    const r = makeRule({
      rule_id: 'BROKEN_SUPER_v1',
      supersedes: 'NONEXISTENT_v1',
    })

    try {
      RuleEngine.fromRules([r])
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('BROKEN_SUPERSEDES_CHAIN')
      }
    }
  })

  it('throws when superseded rule effective_to overlaps with this rule effective_from', () => {
    const predecessor = makeRule({
      rule_id: 'PRED_v1',
      domain: 'chain_test',
      key: 'chain_key',
      effective_from: '2020-01-01',
      effective_to: '2022-12-31', // ends 2022-12-31
    })
    const successor = makeRule({
      rule_id: 'SUCC_v1',
      domain: 'chain_test',
      key: 'chain_key',
      effective_from: '2022-06-01', // starts while predecessor still active — OVERLAP
      effective_to: null,
      supersedes: 'PRED_v1',
    })

    try {
      RuleEngine.fromRules([predecessor, successor])
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      // Either RULE_OVERLAP or BROKEN_SUPERSEDES_CHAIN is acceptable here
      if (e instanceof RuleEngineError) {
        expect(['RULE_OVERLAP', 'BROKEN_SUPERSEDES_CHAIN']).toContain(e.code)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Invariant: hash mismatch
// ---------------------------------------------------------------------------

describe('invariant: hash mismatch', () => {
  it('throws RuleEngineError with code HASH_MISMATCH for non-placeholder bad hash', () => {
    const r = makeRule({ hash: 'bad-hash-value-that-will-not-match' })

    try {
      RuleEngine.fromRules([r])
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('HASH_MISMATCH')
      }
    }
  })

  it('does NOT throw for sha256-placeholder (development mode bypass)', () => {
    const r = makeRule({ hash: 'sha256-placeholder' })
    expect(() => RuleEngine.fromRules([r])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 7. No rule found
// ---------------------------------------------------------------------------

describe('no rule found', () => {
  it('throws RULE_NOT_FOUND when date is before any rule', () => {
    const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

    try {
      engine.resolveRule('threshold', 'einvoice_mandatory', '2010-01-01')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('RULE_NOT_FOUND')
      }
    }
  })

  it('throws RULE_NOT_FOUND for unknown domain', () => {
    const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

    try {
      engine.resolveRule('unknown_domain', 'some_key', '2022-01-01')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RuleEngineError)
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('RULE_NOT_FOUND')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 8. Memoization
// ---------------------------------------------------------------------------

describe('memoization', () => {
  it('returns the same object reference for repeated identical calls', () => {
    const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

    const first = engine.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')
    const second = engine.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')

    // Same object reference proves memoization
    expect(first).toBe(second)
  })

  it('returns different objects for different dates', () => {
    const engine = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

    const result10cr = engine.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')
    const result5cr = engine.resolveRule('threshold', 'einvoice_mandatory', '2024-01-01')

    expect(result10cr.rule_id).toBe('THRESHOLD_EINVOICE_10CR_v1')
    expect(result5cr.rule_id).toBe('THRESHOLD_EINVOICE_5CR_v1')
    expect(result10cr).not.toBe(result5cr)
  })

  it('different engines do not share cache (fromRules creates a fresh instance)', () => {
    const engineA = RuleEngine.fromRules([einvoice10cr, einvoice5cr])
    const engineB = RuleEngine.fromRules([einvoice10cr, einvoice5cr])

    const fromA = engineA.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')
    const fromB = engineB.resolveRule('threshold', 'einvoice_mandatory', '2022-06-15')

    // Same rule_id but different object references (different engine caches)
    expect(fromA.rule_id).toBe(fromB.rule_id)
    expect(fromA).not.toBe(fromB)
  })
})

// ---------------------------------------------------------------------------
// 9. RuleFileSchema validation
// ---------------------------------------------------------------------------

describe('RuleFileSchema', () => {
  it('parses a valid rule file', async () => {
    const { RuleFileSchema } = await import('./rule-schema')
    const valid = makeRule()
    const result = RuleFileSchema.parse(valid)
    expect(result.rule_id).toBe('TEST_RULE_v1')
  })

  it('safeParse returns success:false for invalid input', async () => {
    const { RuleFileSchema } = await import('./rule-schema')
    const result = RuleFileSchema.safeParse({ not: 'a rule' })
    expect(result.success).toBe(false)
  })

  it('throws for missing required fields', async () => {
    const { RuleFileSchema } = await import('./rule-schema')
    expect(() => RuleFileSchema.parse({ rule_id: 'X' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 10. fetchHsnMaster stub
// ---------------------------------------------------------------------------

describe('fetchHsnMaster stub', () => {
  it('rejects with RuleEngineError NOT_IMPLEMENTED', async () => {
    await expect(RuleEngine.fetchHsnMaster()).rejects.toBeInstanceOf(RuleEngineError)
    try {
      await RuleEngine.fetchHsnMaster()
    } catch (e) {
      if (e instanceof RuleEngineError) {
        expect(e.code).toBe('NOT_IMPLEMENTED')
      }
    }
  })
})
