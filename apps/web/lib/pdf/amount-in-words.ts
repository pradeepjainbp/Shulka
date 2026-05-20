/**
 * amountInWords — converts integer paise to Indian-English words.
 *
 * Sacred Rules:
 *  - Input MUST be integer paise (BIGINT from DB). Never pass floats.
 *  - Indian numbering: crores (10^7 rupees), lakhs (10^5), thousands (10^3).
 *
 * Examples:
 *   amountInWords(100)         → "Rupees One Only"
 *   amountInWords(50)          → "Rupees Zero and 50 Paise Only"
 *   amountInWords(12345678)    → "Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and 78 Paise Only"
 *   amountInWords(10000000)    → "Rupees One Lakh Only"
 *   amountInWords(100000000)   → "Rupees Ten Lakhs Only"
 *   amountInWords(10000000000) → "Rupees One Crore Only"
 */

const ones: readonly string[] = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const tens: readonly string[] = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
]

/** Convert a number 1–999 to words. Returns '' for 0. */
function threeDigits(n: number): string {
  if (n <= 0) return ''
  if (n < 20) return ones[n] ?? ''
  if (n < 100) {
    const t = tens[Math.floor(n / 10)] ?? ''
    const o = ones[n % 10] ?? ''
    return o ? `${t}-${o}` : t
  }
  // 100–999
  const hundreds = ones[Math.floor(n / 100)] ?? ''
  const remainder = n % 100
  if (remainder === 0) return `${hundreds} Hundred`
  return `${hundreds} Hundred ${threeDigits(remainder)}`
}

/**
 * Convert integer rupees (not paise) to words using Indian numbering.
 * Returns empty string for 0.
 */
function rupeesToWords(rupees: number): string {
  if (rupees === 0) return ''
  if (!Number.isFinite(rupees) || rupees < 0) throw new Error('Invalid rupees value')

  const crores = Math.floor(rupees / 10_000_000)
  const lakhs = Math.floor((rupees % 10_000_000) / 100_000)
  const thousands = Math.floor((rupees % 100_000) / 1_000)
  const remainder = rupees % 1_000

  const parts: string[] = []

  if (crores > 0) {
    const w = threeDigits(crores)
    parts.push(crores === 1 ? `${w} Crore` : `${w} Crores`)
  }
  if (lakhs > 0) {
    const w = threeDigits(lakhs)
    parts.push(lakhs === 1 ? `${w} Lakh` : `${w} Lakhs`)
  }
  if (thousands > 0) {
    const w = threeDigits(thousands)
    parts.push(`${w} Thousand`)
  }
  if (remainder > 0) {
    parts.push(threeDigits(remainder))
  }

  return parts.join(' ')
}

/**
 * Convert integer paise to a full Indian-English amount-in-words string.
 *
 * @param paise - integer paise (BIGINT from DB, mode: 'number')
 * @returns e.g. "Rupees One Thousand Two Hundred Thirty-Four and 56 Paise Only"
 */
export function amountInWords(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error(`amountInWords: expected non-negative integer paise, got ${paise}`)
  }

  const rupees = Math.floor(paise / 100)
  const paiseRemainder = paise % 100

  const rupeePart = rupees > 0 ? rupeesToWords(rupees) : 'Zero'
  const hasPaise = paiseRemainder > 0

  if (hasPaise) {
    return `Rupees ${rupeePart} and ${paiseRemainder} Paise Only`
  }
  return `Rupees ${rupeePart} Only`
}
