// These are pure-function unit tests for the invoice computation logic
// Strategy: re-implement the private functions from apps/web/app/api/sales/route.ts
// verbatim here so they can be tested without importing the route (which pulls in DB,
// Auth.js, Next.js server internals, and other side-effectful dependencies).
// If the source implementation changes, update the copies below AND the tests.

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implementation: getCurrentFY
// Source: apps/web/app/api/sales/route.ts
// ---------------------------------------------------------------------------

function getCurrentFY(invoiceDate: Date): string {
  const year = invoiceDate.getFullYear()
  const month = invoiceDate.getMonth() + 1 // 1-indexed
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`
  return `${year - 1}-${String(year).slice(-2)}`
}

// ---------------------------------------------------------------------------
// Re-implementation: computeItemPaise
// Source: apps/web/app/api/sales/route.ts
// ---------------------------------------------------------------------------

type ItemInput = {
  quantity: string
  unitPricePaise: number
  discountPct: string
  cgstRatePct: string
  sgstRatePct: string
  igstRatePct: string
  cessRatePct: string
}

type ComputedItem = {
  taxableValue: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  cessPaise: number
  totalPaise: number
}

function computeItemPaise(item: ItemInput): ComputedItem {
  const qty = Number.parseFloat(item.quantity)
  const unitPrice = item.unitPricePaise
  const discountPct = Number.parseFloat(item.discountPct)
  const grossValue = Math.round(qty * unitPrice)
  const discountAmount = Math.round((grossValue * discountPct) / 100)
  const taxableValue = grossValue - discountAmount

  const cgstPaise = Math.round((taxableValue * Number.parseFloat(item.cgstRatePct)) / 100)
  const sgstPaise = Math.round((taxableValue * Number.parseFloat(item.sgstRatePct)) / 100)
  const igstPaise = Math.round((taxableValue * Number.parseFloat(item.igstRatePct)) / 100)
  const cessPaise = Math.round((taxableValue * Number.parseFloat(item.cessRatePct)) / 100)
  const totalPaise = taxableValue + cgstPaise + sgstPaise + igstPaise + cessPaise

  return { taxableValue, cgstPaise, sgstPaise, igstPaise, cessPaise, totalPaise }
}

// ---------------------------------------------------------------------------
// Re-implementation: computeRoundOff
// Source: apps/web/app/api/sales/route.ts (inline in POST handler)
// ---------------------------------------------------------------------------

function computeRoundOff(rawTotal: number): { roundOffPaise: number; totalAmountPaise: number } {
  const roundOffPaise = Math.round(rawTotal / 100) * 100 - rawTotal
  return { roundOffPaise, totalAmountPaise: rawTotal + roundOffPaise }
}

// ===========================================================================
// Tests: getCurrentFY
// ===========================================================================

describe('getCurrentFY', () => {
  it('April 1 of a year opens a new FY', () => {
    expect(getCurrentFY(new Date('2026-04-01'))).toBe('2026-27')
  })

  it('March 31 of a year is still in the previous FY', () => {
    expect(getCurrentFY(new Date('2026-03-31'))).toBe('2025-26')
  })

  it('January 15 mid-year is in the FY that started the previous April', () => {
    expect(getCurrentFY(new Date('2026-01-15'))).toBe('2025-26')
  })

  it('April 1 2025 opens FY 2025-26', () => {
    expect(getCurrentFY(new Date('2025-04-01'))).toBe('2025-26')
  })

  it('March 31 2027 is in FY 2026-27', () => {
    expect(getCurrentFY(new Date('2027-03-31'))).toBe('2026-27')
  })

  it('December 31 2025 is in FY 2025-26', () => {
    expect(getCurrentFY(new Date('2025-12-31'))).toBe('2025-26')
  })

  it('April 1 2000 opens FY 2000-01 (two-digit suffix zero-pads correctly)', () => {
    expect(getCurrentFY(new Date('2000-04-01'))).toBe('2000-01')
  })

  it('March 31 2000 is in FY 1999-00 (millennium boundary)', () => {
    expect(getCurrentFY(new Date('2000-03-31'))).toBe('1999-00')
  })

  it('First day of each Q1 month (April, May, June) belongs to current year FY', () => {
    expect(getCurrentFY(new Date('2025-04-01'))).toBe('2025-26')
    expect(getCurrentFY(new Date('2025-05-01'))).toBe('2025-26')
    expect(getCurrentFY(new Date('2025-06-01'))).toBe('2025-26')
  })

  it('First day of each Q4 month (January, February, March) belongs to previous year FY', () => {
    expect(getCurrentFY(new Date('2026-01-01'))).toBe('2025-26')
    expect(getCurrentFY(new Date('2026-02-01'))).toBe('2025-26')
    expect(getCurrentFY(new Date('2026-03-01'))).toBe('2025-26')
  })
})

// ===========================================================================
// Tests: computeItemPaise
// ===========================================================================

describe('computeItemPaise', () => {
  it('intra-state 18% GST (CGST 9% + SGST 9%), no discount, qty 1, ₹1000', () => {
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 100000, // ₹1000 in paise
      discountPct: '0',
      cgstRatePct: '9',
      sgstRatePct: '9',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.cgstPaise).toBe(9000)
    expect(result.sgstPaise).toBe(9000)
    expect(result.igstPaise).toBe(0)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(118000)
  })

  it('inter-state 18% IGST, no discount, qty 2, ₹500 each', () => {
    const result = computeItemPaise({
      quantity: '2',
      unitPricePaise: 50000, // ₹500 in paise
      discountPct: '0',
      cgstRatePct: '0',
      sgstRatePct: '0',
      igstRatePct: '18',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.igstPaise).toBe(18000)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(118000)
  })

  it('intra-state 18% GST with 10% discount, qty 1, ₹2000', () => {
    // grossValue = 200000, discount = 20000, taxable = 180000
    // cgst = round(180000 * 9 / 100) = 16200
    // sgst = 16200
    // total = 180000 + 16200 + 16200 = 212400
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 200000, // ₹2000 in paise
      discountPct: '10',
      cgstRatePct: '9',
      sgstRatePct: '9',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(180000)
    expect(result.cgstPaise).toBe(16200)
    expect(result.sgstPaise).toBe(16200)
    expect(result.igstPaise).toBe(0)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(212400)
  })

  it('fractional quantity: qty 2.5, ₹400 unit, IGST 18%', () => {
    // grossValue = round(2.5 * 40000) = round(100000) = 100000
    // taxable = 100000, igst = 18000, total = 118000
    const result = computeItemPaise({
      quantity: '2.5',
      unitPricePaise: 40000, // ₹400 in paise
      discountPct: '0',
      cgstRatePct: '0',
      sgstRatePct: '0',
      igstRatePct: '18',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.igstPaise).toBe(18000)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(118000)
  })

  it('zero-rated / exempt item: all rates 0%, qty 1, ₹500', () => {
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 50000, // ₹500 in paise
      discountPct: '0',
      cgstRatePct: '0',
      sgstRatePct: '0',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(50000)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.igstPaise).toBe(0)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(50000)
  })

  it('GST 5% slab: CGST 2.5% + SGST 2.5%, qty 1, ₹1000', () => {
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 100000, // ₹1000 in paise
      discountPct: '0',
      cgstRatePct: '2.5',
      sgstRatePct: '2.5',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.cgstPaise).toBe(2500)
    expect(result.sgstPaise).toBe(2500)
    expect(result.igstPaise).toBe(0)
    expect(result.cessPaise).toBe(0)
    expect(result.totalPaise).toBe(105000)
  })

  it('GST 28% IGST + cess 12%, qty 1, ₹1000', () => {
    // taxable = 100000, igst = 28000, cess = 12000, total = 140000
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 100000, // ₹1000 in paise
      discountPct: '0',
      cgstRatePct: '0',
      sgstRatePct: '0',
      igstRatePct: '28',
      cessRatePct: '12',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.igstPaise).toBe(28000)
    expect(result.cessPaise).toBe(12000)
    expect(result.totalPaise).toBe(140000)
  })

  it('100% discount collapses taxable value to zero', () => {
    const result = computeItemPaise({
      quantity: '1',
      unitPricePaise: 100000,
      discountPct: '100',
      cgstRatePct: '9',
      sgstRatePct: '9',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(0)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.totalPaise).toBe(0)
  })

  it('fractional paise result is Math.round-ed, not truncated', () => {
    // qty=3, unitPrice=33334 (₹333.34), discount=0, cgst=9%, sgst=9%
    // grossValue = round(3 * 33334) = round(100002) = 100002
    // cgst = round(100002 * 9 / 100) = round(9000.18) = 9000
    // sgst = 9000
    // total = 100002 + 9000 + 9000 = 118002
    const result = computeItemPaise({
      quantity: '3',
      unitPricePaise: 33334,
      discountPct: '0',
      cgstRatePct: '9',
      sgstRatePct: '9',
      igstRatePct: '0',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100002)
    expect(result.cgstPaise).toBe(9000) // 9000.18 rounds down
    expect(result.sgstPaise).toBe(9000)
    expect(result.totalPaise).toBe(118002)
  })

  it('GST 12% IGST, qty 5, ₹200 each, no discount', () => {
    // grossValue = 5 * 20000 = 100000, igst = 12000, total = 112000
    const result = computeItemPaise({
      quantity: '5',
      unitPricePaise: 20000, // ₹200 in paise
      discountPct: '0',
      cgstRatePct: '0',
      sgstRatePct: '0',
      igstRatePct: '12',
      cessRatePct: '0',
    })
    expect(result.taxableValue).toBe(100000)
    expect(result.igstPaise).toBe(12000)
    expect(result.totalPaise).toBe(112000)
  })
})

// ===========================================================================
// Tests: computeRoundOff
// ===========================================================================

describe('computeRoundOff', () => {
  it('rawTotal already on a rupee boundary: no round-off', () => {
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(118000)
    expect(roundOffPaise).toBe(0)
    expect(totalAmountPaise).toBe(118000)
  })

  it('rawTotal=118050 rounds up to 118100, roundOff=+50', () => {
    // Math.round(118050/100) = Math.round(1180.5) = 1181
    // 1181 * 100 = 118100; roundOff = 118100 - 118050 = 50
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(118050)
    expect(roundOffPaise).toBe(50)
    expect(totalAmountPaise).toBe(118100)
  })

  it('rawTotal=117950 rounds up to 118000, roundOff=+50', () => {
    // Math.round(117950/100) = Math.round(1179.5) = 1180
    // 1180 * 100 = 118000; roundOff = 118000 - 117950 = 50
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(117950)
    expect(roundOffPaise).toBe(50)
    expect(totalAmountPaise).toBe(118000)
  })

  it('rawTotal=118060 rounds up to 118100, roundOff=+40', () => {
    // Math.round(118060/100) = Math.round(1180.6) = 1181
    // 1181 * 100 = 118100; roundOff = 118100 - 118060 = 40
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(118060)
    expect(roundOffPaise).toBe(40)
    expect(totalAmountPaise).toBe(118100)
  })

  it('rawTotal=118040 rounds down to 118000, roundOff=-40', () => {
    // Math.round(118040/100) = Math.round(1180.4) = 1180
    // 1180 * 100 = 118000; roundOff = 118000 - 118040 = -40
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(118040)
    expect(roundOffPaise).toBe(-40)
    expect(totalAmountPaise).toBe(118000)
  })

  it('rawTotal=99 rounds to 100, roundOff=+1', () => {
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(99)
    expect(roundOffPaise).toBe(1)
    expect(totalAmountPaise).toBe(100)
  })

  it('rawTotal=0 produces zero round-off and zero total', () => {
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(0)
    expect(roundOffPaise).toBe(0)
    expect(totalAmountPaise).toBe(0)
  })

  it('large invoice total on exact rupee boundary has no round-off', () => {
    // 10,00,000 paise = ₹10,000 exactly
    const { roundOffPaise, totalAmountPaise } = computeRoundOff(1000000)
    expect(roundOffPaise).toBe(0)
    expect(totalAmountPaise).toBe(1000000)
  })
})
