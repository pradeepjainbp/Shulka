// P2-02: Place-of-supply auto-derivation + CGST/SGST vs IGST split
// Mirrors the logic in apps/web/app/api/sales/route.ts that derives posKind
// and expectedTaxType from placeOfSupply(), then applies the correct tax rates.

import { placeOfSupply } from '@shulka/gst-engine'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implementation of the tax-application logic from POST /api/sales
// Source: apps/web/app/api/sales/route.ts — computeItemPaise + posKind derivation
// ---------------------------------------------------------------------------

type TaxType = 'CGST_SGST' | 'IGST' | 'ZERO_RATED'

function derivePos(
  supplierStateCode: string,
  recipientStateCode: string,
): {
  taxType: TaxType
  posKind: 'intra_state' | 'inter_state' | 'export' | 'sez'
  posRuleId: string
} {
  const result = placeOfSupply({ supplierStateCode, recipientStateCode, transactionType: 'b2b' })
  const taxType = result.taxType as TaxType
  const posKind = taxType === 'CGST_SGST' ? 'intra_state' : 'inter_state'
  const posRuleId = taxType === 'CGST_SGST' ? 'POS_INTRASTATE_v1' : 'POS_INTERSTATE_v1'
  return { taxType, posKind, posRuleId }
}

// Splits a slab rate into CGST/SGST (intra) or IGST (inter) components.
// Mirrors the rate-split logic in the SalesInvoiceForm + API.
function splitRates(
  slabRatePct: number,
  taxType: TaxType,
): { cgst: number; sgst: number; igst: number } {
  if (taxType === 'CGST_SGST') {
    return { cgst: slabRatePct / 2, sgst: slabRatePct / 2, igst: 0 }
  }
  return { cgst: 0, sgst: 0, igst: slabRatePct }
}

// Computes paise for a given rate on an amount.
function taxPaise(amountPaise: number, ratePct: number): number {
  return Math.round((amountPaise * ratePct) / 100)
}

// ---------------------------------------------------------------------------
// Tests: Karnataka business (state code '29')
// ---------------------------------------------------------------------------

describe('P2-02: place-of-supply derivation', () => {
  it('Karnataka supplier → Karnataka recipient: CGST_SGST (intra-state)', () => {
    const { taxType, posKind, posRuleId } = derivePos('29', '29')
    expect(taxType).toBe('CGST_SGST')
    expect(posKind).toBe('intra_state')
    expect(posRuleId).toBe('POS_INTRASTATE_v1')
  })

  it('Karnataka supplier → Maharashtra recipient: IGST (inter-state)', () => {
    const { taxType, posKind, posRuleId } = derivePos('29', '27')
    expect(taxType).toBe('IGST')
    expect(posKind).toBe('inter_state')
    expect(posRuleId).toBe('POS_INTERSTATE_v1')
  })

  it('Karnataka supplier → Delhi recipient: IGST (inter-state)', () => {
    const { taxType, posKind } = derivePos('29', '07')
    expect(taxType).toBe('IGST')
    expect(posKind).toBe('inter_state')
  })

  it('Maharashtra supplier → Maharashtra recipient: CGST_SGST (intra-state)', () => {
    const { taxType, posKind } = derivePos('27', '27')
    expect(taxType).toBe('CGST_SGST')
    expect(posKind).toBe('intra_state')
  })
})

// ---------------------------------------------------------------------------
// Tests: 18% slab → 9% CGST + 9% SGST (intra) OR 18% IGST (inter)
// ---------------------------------------------------------------------------

describe('P2-02: rate splitting — 18% slab', () => {
  it('intra-state 18% slab → 9% CGST + 9% SGST + 0% IGST', () => {
    const rates = splitRates(18, 'CGST_SGST')
    expect(rates.cgst).toBe(9)
    expect(rates.sgst).toBe(9)
    expect(rates.igst).toBe(0)
  })

  it('inter-state 18% slab → 0% CGST + 0% SGST + 18% IGST', () => {
    const rates = splitRates(18, 'IGST')
    expect(rates.cgst).toBe(0)
    expect(rates.sgst).toBe(0)
    expect(rates.igst).toBe(18)
  })
})

describe('P2-02: rate splitting — 5% slab', () => {
  it('intra-state 5% → 2.5% CGST + 2.5% SGST', () => {
    const rates = splitRates(5, 'CGST_SGST')
    expect(rates.cgst).toBe(2.5)
    expect(rates.sgst).toBe(2.5)
    expect(rates.igst).toBe(0)
  })

  it('inter-state 5% → 5% IGST', () => {
    const rates = splitRates(5, 'IGST')
    expect(rates.igst).toBe(5)
    expect(rates.cgst).toBe(0)
  })
})

describe('P2-02: rate splitting — 28% slab', () => {
  it('intra-state 28% → 14% CGST + 14% SGST', () => {
    const rates = splitRates(28, 'CGST_SGST')
    expect(rates.cgst).toBe(14)
    expect(rates.sgst).toBe(14)
  })
})

// ---------------------------------------------------------------------------
// End-to-end: Karnataka → Karnataka, ₹10,000 item at 18% slab
// Acceptance criteria from PHASES.md P2-02
// ---------------------------------------------------------------------------

describe('P2-02: full item tax computation', () => {
  it('Karnataka→Karnataka ₹10,000 @ 18% = ₹900 CGST + ₹900 SGST + ₹0 IGST', () => {
    const { taxType } = derivePos('29', '29')
    const rates = splitRates(18, taxType)
    const itemAmountPaise = 10000 * 100 // ₹10,000 in paise

    const cgstPaise = taxPaise(itemAmountPaise, rates.cgst)
    const sgstPaise = taxPaise(itemAmountPaise, rates.sgst)
    const igstPaise = taxPaise(itemAmountPaise, rates.igst)

    expect(cgstPaise).toBe(90000) // ₹900 in paise
    expect(sgstPaise).toBe(90000) // ₹900 in paise
    expect(igstPaise).toBe(0)
    expect(cgstPaise + sgstPaise + igstPaise).toBe(180000) // ₹1,800 total tax
  })

  it('Karnataka→Maharashtra ₹10,000 @ 18% = ₹0 CGST + ₹0 SGST + ₹1,800 IGST', () => {
    const { taxType } = derivePos('29', '27')
    const rates = splitRates(18, taxType)
    const itemAmountPaise = 10000 * 100

    const cgstPaise = taxPaise(itemAmountPaise, rates.cgst)
    const sgstPaise = taxPaise(itemAmountPaise, rates.sgst)
    const igstPaise = taxPaise(itemAmountPaise, rates.igst)

    expect(cgstPaise).toBe(0)
    expect(sgstPaise).toBe(0)
    expect(igstPaise).toBe(180000) // ₹1,800 in paise
    expect(cgstPaise + sgstPaise + igstPaise).toBe(180000)
  })
})

// ---------------------------------------------------------------------------
// posKind → posRuleId mapping (used in rule_resolutions at finalise time)
// ---------------------------------------------------------------------------

describe('P2-02: posRuleId derivation', () => {
  it('intra_state maps to POS_INTRASTATE_v1', () => {
    const { posRuleId } = derivePos('29', '29')
    expect(posRuleId).toBe('POS_INTRASTATE_v1')
  })

  it('inter_state maps to POS_INTERSTATE_v1', () => {
    const { posRuleId } = derivePos('29', '27')
    expect(posRuleId).toBe('POS_INTERSTATE_v1')
  })
})
