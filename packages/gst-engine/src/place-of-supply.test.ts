import { describe, expect, it } from 'vitest'
import { PlaceOfSupplyError, isValidStateCode, placeOfSupply } from './place-of-supply'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const VALID_RULES = new Set([
  'section_7',
  'section_8',
  'section_12',
  'sez_special',
  'export_rule',
  'import_rule',
])

// ---------------------------------------------------------------------------
// 1. Four transaction types at a glance
// ---------------------------------------------------------------------------
describe('transaction type basics', () => {
  it('b2b same state → CGST_SGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '27',
      transactionType: 'b2b',
    })
    expect(result.taxType).toBe('CGST_SGST')
    expect(result.rule).toBe('section_8')
  })

  it('b2b different state → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '29',
      transactionType: 'b2b',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('section_7')
  })

  it('export → ZERO_RATED', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      transactionType: 'export',
    })
    expect(result.taxType).toBe('ZERO_RATED')
    expect(result.rule).toBe('export_rule')
  })

  it('import → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      transactionType: 'import',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('import_rule')
  })
})

// ---------------------------------------------------------------------------
// 2. SEZ cases
// ---------------------------------------------------------------------------
describe('SEZ handling', () => {
  it('isSupplierSez=true → IGST even if same state', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '27',
      transactionType: 'b2b',
      isSupplierSez: true,
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('sez_special')
  })

  it('isRecipientSez=true → IGST even if same state', () => {
    const result = placeOfSupply({
      supplierStateCode: '33',
      recipientStateCode: '33',
      transactionType: 'b2b',
      isRecipientSez: true,
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('sez_special')
  })

  it('transactionType=sez_supply → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '07',
      recipientStateCode: '07',
      transactionType: 'sez_supply',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('sez_special')
  })

  it('sez_supply inter-state → IGST (sez_special rule)', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '29',
      transactionType: 'sez_supply',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('sez_special')
  })
})

// ---------------------------------------------------------------------------
// 3. Export is always ZERO_RATED (export checked before SEZ)
// ---------------------------------------------------------------------------
describe('export priority over SEZ', () => {
  it('export + isRecipientSez=true → ZERO_RATED (export wins)', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      transactionType: 'export',
      isRecipientSez: true,
    })
    expect(result.taxType).toBe('ZERO_RATED')
    expect(result.rule).toBe('export_rule')
  })

  it('export + isSupplierSez=true → ZERO_RATED (export wins)', () => {
    const result = placeOfSupply({
      supplierStateCode: '29',
      transactionType: 'export',
      isSupplierSez: true,
    })
    expect(result.taxType).toBe('ZERO_RATED')
    expect(result.rule).toBe('export_rule')
  })
})

// ---------------------------------------------------------------------------
// 4. Import is always IGST
// ---------------------------------------------------------------------------
describe('import handling', () => {
  it('import regardless of states → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '29',
      transactionType: 'import',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('import_rule')
  })
})

// ---------------------------------------------------------------------------
// 5. B2B intra-state — 5 different states
// ---------------------------------------------------------------------------
describe('B2B intra-state', () => {
  const cases: [string, string][] = [
    ['27', 'Maharashtra'],
    ['29', 'Karnataka'],
    ['07', 'Delhi'],
    ['33', 'Tamil Nadu'],
    ['09', 'Uttar Pradesh'],
  ]

  for (const [code, name] of cases) {
    it(`intra-state ${code} (${name}) → CGST_SGST`, () => {
      const result = placeOfSupply({
        supplierStateCode: code,
        recipientStateCode: code,
        transactionType: 'b2b',
      })
      expect(result.taxType).toBe('CGST_SGST')
      expect(result.rule).toBe('section_8')
      expect(result.reasoning).toContain(name)
    })
  }
})

// ---------------------------------------------------------------------------
// 6. B2B inter-state — 5 state pairs
// ---------------------------------------------------------------------------
describe('B2B inter-state', () => {
  const pairs: [string, string][] = [
    ['27', '29'], // Maharashtra → Karnataka
    ['07', '27'], // Delhi → Maharashtra
    ['33', '36'], // Tamil Nadu → Telangana
    ['01', '27'], // Jammu & Kashmir → Maharashtra
    ['38', '27'], // Ladakh → Maharashtra
  ]

  for (const [from, to] of pairs) {
    it(`inter-state ${from} → ${to} → IGST`, () => {
      const result = placeOfSupply({
        supplierStateCode: from,
        recipientStateCode: to,
        transactionType: 'b2b',
      })
      expect(result.taxType).toBe('IGST')
      expect(result.rule).toBe('section_7')
    })
  }
})

// ---------------------------------------------------------------------------
// 7. B2C cases
// ---------------------------------------------------------------------------
describe('B2C supply', () => {
  it('b2c no recipient state → CGST_SGST (supplier state)', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      transactionType: 'b2c',
    })
    expect(result.taxType).toBe('CGST_SGST')
    expect(result.rule).toBe('section_12')
    expect(result.reasoning).toContain('Maharashtra')
  })

  it('b2c explicit same recipient state → CGST_SGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '33',
      recipientStateCode: '33',
      transactionType: 'b2c',
    })
    expect(result.taxType).toBe('CGST_SGST')
    expect(result.rule).toBe('section_8')
  })

  it('b2c different recipient state → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '29',
      transactionType: 'b2c',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('section_7')
  })
})

// ---------------------------------------------------------------------------
// 8. Validation errors
// ---------------------------------------------------------------------------
describe('validation errors', () => {
  it('invalid supplier state code → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '25',
        recipientStateCode: '27',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('invalid supplier state code (empty string) → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '',
        recipientStateCode: '27',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('invalid supplier state code (old AP 28) → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '28',
        recipientStateCode: '27',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('invalid recipient state code → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '27',
        recipientStateCode: '99X',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('invalid recipient state code (old DD 25) → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '27',
        recipientStateCode: '25',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('b2b missing recipientStateCode → throws PlaceOfSupplyError', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '27',
        transactionType: 'b2b',
      }),
    ).toThrow(PlaceOfSupplyError)
  })

  it('b2b missing recipientStateCode error message is specific', () => {
    expect(() =>
      placeOfSupply({
        supplierStateCode: '27',
        transactionType: 'b2b',
      }),
    ).toThrow('recipientStateCode is required for B2B transactions')
  })
})

// ---------------------------------------------------------------------------
// 9. isValidStateCode helper
// ---------------------------------------------------------------------------
describe('isValidStateCode helper', () => {
  it('valid state code 27 → true', () => {
    expect(isValidStateCode('27')).toBe(true)
  })

  it('valid state code 07 → true', () => {
    expect(isValidStateCode('07')).toBe(true)
  })

  it('valid state code 97 (Other Territory) → true', () => {
    expect(isValidStateCode('97')).toBe(true)
  })

  it('valid state code 99 (Centre) → true', () => {
    expect(isValidStateCode('99')).toBe(true)
  })

  it('invalid code 25 (old Daman & Diu) → false', () => {
    expect(isValidStateCode('25')).toBe(false)
  })

  it('invalid code 28 (old Andhra Pradesh) → false', () => {
    expect(isValidStateCode('28')).toBe(false)
  })

  it('empty string → false', () => {
    expect(isValidStateCode('')).toBe(false)
  })

  it('random string → false', () => {
    expect(isValidStateCode('ZZ')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. UT codes are valid
// ---------------------------------------------------------------------------
describe('Union Territory codes', () => {
  const utCodes: [string, string][] = [
    ['04', 'Chandigarh'],
    ['07', 'Delhi'],
    ['34', 'Puducherry'],
    ['35', 'Andaman & Nicobar Islands'],
    ['31', 'Lakshadweep'],
    ['38', 'Ladakh'],
    ['26', 'Dadra & Nagar Haveli and Daman & Diu'],
  ]

  for (const [code, name] of utCodes) {
    it(`UT ${code} (${name}) is valid and works intra-state`, () => {
      expect(isValidStateCode(code)).toBe(true)
      const result = placeOfSupply({
        supplierStateCode: code,
        recipientStateCode: code,
        transactionType: 'b2b',
      })
      expect(result.taxType).toBe('CGST_SGST')
    })
  }
})

// ---------------------------------------------------------------------------
// 11. '97' Other Territory — valid, treated same as state
// ---------------------------------------------------------------------------
describe('Other Territory (97)', () => {
  it('97 intra → CGST_SGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '97',
      recipientStateCode: '97',
      transactionType: 'b2b',
    })
    expect(result.taxType).toBe('CGST_SGST')
    expect(result.rule).toBe('section_8')
  })

  it('97 → 27 inter-state → IGST', () => {
    const result = placeOfSupply({
      supplierStateCode: '97',
      recipientStateCode: '27',
      transactionType: 'b2b',
    })
    expect(result.taxType).toBe('IGST')
    expect(result.rule).toBe('section_7')
  })
})

// ---------------------------------------------------------------------------
// 12. reasoning and rule fields are always populated
// ---------------------------------------------------------------------------
describe('output fields', () => {
  const cases = [
    placeOfSupply({ supplierStateCode: '27', recipientStateCode: '27', transactionType: 'b2b' }),
    placeOfSupply({ supplierStateCode: '27', recipientStateCode: '29', transactionType: 'b2b' }),
    placeOfSupply({ supplierStateCode: '27', transactionType: 'export' }),
    placeOfSupply({ supplierStateCode: '27', transactionType: 'import' }),
    placeOfSupply({
      supplierStateCode: '27',
      recipientStateCode: '27',
      transactionType: 'sez_supply',
    }),
    placeOfSupply({ supplierStateCode: '27', transactionType: 'b2c' }),
  ]

  for (const [i, result] of cases.entries()) {
    it(`case ${i + 1}: reasoning is non-empty string`, () => {
      expect(typeof result.reasoning).toBe('string')
      expect(result.reasoning.length).toBeGreaterThan(0)
    })

    it(`case ${i + 1}: rule is one of the valid values`, () => {
      expect(VALID_RULES.has(result.rule)).toBe(true)
    })
  }
})
