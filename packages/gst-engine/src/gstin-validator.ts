export type GstinInvalidReason =
  | 'invalid_length'
  | 'invalid_structure'
  | 'invalid_state_code'
  | 'invalid_pan'
  | 'invalid_checksum'

export type GstinValidationResult = { valid: true } | { valid: false; reason: GstinInvalidReason }

// Positions: 0-1 = state code digits, 2-6 = 5 uppercase letters (PAN letters),
// 7-10 = 4 digits (PAN digits), 11 = PAN check letter, 12 = entity number [1-9 or A-Z],
// 13 = literal 'Z', 14 = checksum character
const STRUCTURE_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const VALID_STATE_CODES = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '26',
  '27',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '97',
  '99',
])

// 25 (old Daman & Diu) excluded — subsumed into 26
// 28 (old Andhra Pradesh) excluded — replaced by 37
// 97 = Other Territory supplies; 99 = centre-administered transactions

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function computeCheckChar(gstin: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let val = CHARSET.indexOf(gstin.charAt(i)) // 0–35
    if ((i + 1) % 2 === 0) val *= 2 // even positions (1-indexed) get weight 2
    sum += Math.floor(val / 36) + (val % 36)
  }
  const idx = (36 - (sum % 36)) % 36
  return CHARSET.charAt(idx)
}

export function validateGstin(gstin: string): GstinValidationResult {
  // Step 1 — length check
  if (gstin.length !== 15) {
    return { valid: false, reason: 'invalid_length' }
  }

  // Step 2 — structure regex
  if (!STRUCTURE_REGEX.test(gstin)) {
    return { valid: false, reason: 'invalid_structure' }
  }

  // Step 3 — state code
  const stateCode = gstin.slice(0, 2)
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { valid: false, reason: 'invalid_state_code' }
  }

  // Step 4 — PAN embedded in chars 2–11
  const pan = gstin.slice(2, 12)
  if (!PAN_REGEX.test(pan)) {
    return { valid: false, reason: 'invalid_pan' }
  }

  // Step 5 — Mod-36 checksum
  const expectedCheckChar = computeCheckChar(gstin)
  if (gstin.charAt(14) !== expectedCheckChar) {
    return { valid: false, reason: 'invalid_checksum' }
  }

  return { valid: true }
}

export function isValidGstin(gstin: string): boolean {
  return validateGstin(gstin).valid
}
