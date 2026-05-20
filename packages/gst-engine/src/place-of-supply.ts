export type TransactionType =
  | 'b2b' // business to business (domestic)
  | 'b2c' // business to consumer (domestic)
  | 'export' // goods/services exported outside India
  | 'import' // goods/services imported into India
  | 'sez_supply' // supply to a Special Economic Zone unit/developer

export type PosResult =
  | 'CGST_SGST' // intra-state: split between CGST + SGST/UTGST
  | 'IGST' // inter-state / export / SEZ / import
  | 'ZERO_RATED' // export that is zero-rated (still IGST treatment but 0%)

export type PlaceOfSupplyInput = {
  supplierStateCode: string // 2-digit state code, e.g. '27'
  recipientStateCode?: string // optional for exports/imports
  transactionType: TransactionType
  isSupplierSez?: boolean // supplier is in an SEZ — always IGST
  isRecipientSez?: boolean // recipient is in an SEZ — always IGST
}

export type PlaceOfSupplyOutput = {
  taxType: PosResult
  reasoning: string // human-readable explanation (English)
  rule: 'section_7' | 'section_8' | 'section_12' | 'sez_special' | 'export_rule' | 'import_rule'
}

export class PlaceOfSupplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaceOfSupplyError'
  }
}

// All 36 Indian states + UTs keyed by 2-digit numeric string (as used in GSTIN)
// 25 (old Daman & Diu) and 28 (old Andhra Pradesh) are excluded — same as GSTIN validator
const STATE_MAP = new Map<string, string>([
  ['01', 'Jammu & Kashmir'],
  ['02', 'Himachal Pradesh'],
  ['03', 'Punjab'],
  ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'],
  ['06', 'Haryana'],
  ['07', 'Delhi'],
  ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'],
  ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'],
  ['14', 'Manipur'],
  ['15', 'Mizoram'],
  ['16', 'Tripura'],
  ['17', 'Meghalaya'],
  ['18', 'Assam'],
  ['19', 'West Bengal'],
  ['20', 'Jharkhand'],
  ['21', 'Odisha'],
  ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'],
  ['26', 'Dadra & Nagar Haveli and Daman & Diu'],
  ['27', 'Maharashtra'],
  ['29', 'Karnataka'],
  ['30', 'Goa'],
  ['31', 'Lakshadweep'],
  ['32', 'Kerala'],
  ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'],
  ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'],
  ['97', 'Other Territory'],
  ['99', 'Centre'],
])

export function isValidStateCode(code: string): boolean {
  return STATE_MAP.has(code)
}

export function placeOfSupply(input: PlaceOfSupplyInput): PlaceOfSupplyOutput {
  const { supplierStateCode, transactionType, isSupplierSez, isRecipientSez } = input
  // exactOptionalPropertyTypes: access recipientStateCode carefully
  const recipientStateCode = 'recipientStateCode' in input ? input.recipientStateCode : undefined

  // Validate supplier state code
  if (!isValidStateCode(supplierStateCode)) {
    throw new PlaceOfSupplyError(
      `Invalid supplier state code: '${supplierStateCode}'. Must be a 2-digit code from the valid state list.`,
    )
  }

  // Validate recipient state code if provided
  if (recipientStateCode !== undefined && !isValidStateCode(recipientStateCode)) {
    throw new PlaceOfSupplyError(
      `Invalid recipient state code: '${recipientStateCode}'. Must be a 2-digit code from the valid state list.`,
    )
  }

  // Rule 1: Export — always ZERO_RATED (checked before SEZ)
  if (transactionType === 'export') {
    return {
      taxType: 'ZERO_RATED',
      reasoning: 'Exports are zero-rated under Section 16 of IGST Act.',
      rule: 'export_rule',
    }
  }

  // Rule 2: Import — always IGST
  if (transactionType === 'import') {
    return {
      taxType: 'IGST',
      reasoning: 'Imports are treated as inter-state supply under Section 7(2) of IGST Act.',
      rule: 'import_rule',
    }
  }

  // Rule 3: SEZ supply — always IGST
  if (transactionType === 'sez_supply' || isSupplierSez === true || isRecipientSez === true) {
    return {
      taxType: 'IGST',
      reasoning:
        'Supplies to/from SEZ units are treated as inter-state under Section 8(2) of IGST Act.',
      rule: 'sez_special',
    }
  }

  // Rule 4: Intra-state — same state code for both parties
  if (recipientStateCode !== undefined && supplierStateCode === recipientStateCode) {
    const stateName = STATE_MAP.get(supplierStateCode) ?? supplierStateCode
    return {
      taxType: 'CGST_SGST',
      reasoning: `Intra-state supply (${stateName}): CGST + SGST apply under Section 8 of IGST Act.`,
      rule: 'section_8',
    }
  }

  // Rule 5: Inter-state — different state codes, both present
  if (recipientStateCode !== undefined && supplierStateCode !== recipientStateCode) {
    const supplierState = STATE_MAP.get(supplierStateCode) ?? supplierStateCode
    const recipientState = STATE_MAP.get(recipientStateCode) ?? recipientStateCode
    return {
      taxType: 'IGST',
      reasoning: `Inter-state supply (${supplierState} → ${recipientState}): IGST applies under Section 7 of IGST Act.`,
      rule: 'section_7',
    }
  }

  // Rule 6: B2C with no recipient state — defaults to supplier's state
  if (transactionType === 'b2c' && recipientStateCode === undefined) {
    const supplierStateName = STATE_MAP.get(supplierStateCode) ?? supplierStateCode
    return {
      taxType: 'CGST_SGST',
      reasoning: `B2C supply: place of supply defaults to supplier's state (${supplierStateName}) under Section 12 of IGST Act.`,
      rule: 'section_12',
    }
  }

  // Rule 7: Fallback — B2B missing recipientStateCode
  throw new PlaceOfSupplyError('recipientStateCode is required for B2B transactions')
}
