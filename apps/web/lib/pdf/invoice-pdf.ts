/**
 * invoice-pdf.ts — GST-compliant A4 PDF generation using pdf-lib.
 *
 * Sacred Rules enforced:
 *  - Money is always stored/passed as integer paise; divide by 100 only at display boundary.
 *  - No tax math here — all values come pre-computed from the DB.
 *  - No external fonts — uses built-in Helvetica / Helvetica-Bold only.
 */

import type { Business, Party, SalesInvoice, SalesInvoiceItem } from '@shulka/db'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { amountInWords } from './amount-in-words'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoicePdfInput {
  invoice: SalesInvoice
  items: SalesInvoiceItem[]
  business: Business
  party: Party
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const COLOR_PRIMARY = rgb(0.118, 0.227, 0.373) // #1e3a5f
const COLOR_ACCENT = rgb(0.086, 0.533, 0.38) // emerald totals
const COLOR_WHITE = rgb(1, 1, 1)
const _COLOR_BLACK = rgb(0, 0, 0)
const COLOR_GRAY_LIGHT = rgb(0.95, 0.95, 0.95)
const COLOR_ROW_ALT = rgb(0.98, 0.98, 0.98)
const COLOR_DARK_TEXT = rgb(0.2, 0.2, 0.2)
const COLOR_MID_GRAY = rgb(0.5, 0.5, 0.5)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Paise → "1,234.56" string (display only) */
function rupees(paise: number): string {
  return (paise / 100).toFixed(2)
}

/** Address jsonb → printable lines. Handles null gracefully. */
function formatAddress(addr: unknown): string[] {
  if (!addr || typeof addr !== 'object') return []
  const a = addr as Record<string, unknown>
  const parts: string[] = []
  if (a.line1 && typeof a.line1 === 'string') parts.push(a.line1)
  const cityState: string[] = []
  if (a.city && typeof a.city === 'string') cityState.push(a.city)
  if (a.state && typeof a.state === 'string') cityState.push(a.state)
  if (cityState.length) parts.push(cityState.join(', '))
  if (a.pincode && typeof a.pincode === 'string') parts.push(a.pincode)
  return parts
}

/** Truncate text to fit within maxChars to avoid cell overflow. */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}

/** Format date string (YYYY-MM-DD from Drizzle date type) as DD/MM/YYYY */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  // date columns arrive as "YYYY-MM-DD"
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/** Financial year from fy field e.g. "2025-26" → "FY 2025-26" */
function formatFY(fy: string): string {
  return `FY ${fy}`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, items, business, party } = input

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 36
  const contentWidth = width - margin * 2

  let yPos = height // current y cursor; we draw top-down, decrementing y

  // ---------------------------------------------------------------------------
  // 1. Header band
  // ---------------------------------------------------------------------------

  const headerHeight = 70
  yPos -= headerHeight

  page.drawRectangle({
    x: 0,
    y: yPos,
    width,
    height: headerHeight,
    color: COLOR_PRIMARY,
  })

  // "TAX INVOICE" right-aligned
  const taxInvoiceText = 'TAX INVOICE'
  const taxInvoiceFontSize = 11
  const taxInvoiceWidth = fontBold.widthOfTextAtSize(taxInvoiceText, taxInvoiceFontSize)
  page.drawText(taxInvoiceText, {
    x: width - margin - taxInvoiceWidth,
    y: yPos + headerHeight - 20,
    size: taxInvoiceFontSize,
    font: fontBold,
    color: COLOR_WHITE,
  })

  // Business name — large
  const bizNameFontSize = 16
  page.drawText(truncate(business.name, 40), {
    x: margin,
    y: yPos + headerHeight - 22,
    size: bizNameFontSize,
    font: fontBold,
    color: COLOR_WHITE,
  })

  // GSTIN below business name
  if (business.gstin) {
    page.drawText(`GSTIN: ${business.gstin}`, {
      x: margin,
      y: yPos + headerHeight - 38,
      size: 9,
      font: fontRegular,
      color: COLOR_GRAY_LIGHT,
    })
  }

  // ---------------------------------------------------------------------------
  // 2. Business address block (left) + Invoice meta (right)
  // ---------------------------------------------------------------------------

  yPos -= 8 // gap below header

  const addressLines = formatAddress(business.address)
  const addrBlockY = yPos
  let addrY = addrBlockY

  for (const line of addressLines) {
    addrY -= 13
    page.drawText(truncate(line, 50), {
      x: margin,
      y: addrY,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK_TEXT,
    })
  }

  // Business phone
  if (business.address && typeof business.address === 'object') {
    const addr = business.address as Record<string, unknown>
    if (addr.phone && typeof addr.phone === 'string') {
      addrY -= 13
      page.drawText(`Ph: ${addr.phone}`, {
        x: margin,
        y: addrY,
        size: 8,
        font: fontRegular,
        color: COLOR_DARK_TEXT,
      })
    }
  }

  // Invoice meta box (right side)
  const metaBoxX = width / 2 + 20
  const metaBoxWidth = width - margin - metaBoxX
  const metaLines: Array<[string, string]> = [
    ['Invoice No.', invoice.invoiceNumber],
    ['Date', formatDate(invoice.invoiceDate)],
  ]
  if (invoice.dueDate) {
    metaLines.push(['Due Date', formatDate(invoice.dueDate)])
  }
  metaLines.push(['FY', formatFY(invoice.fy)])

  const metaBoxHeight = metaLines.length * 16 + 12
  const metaBoxY = addrBlockY - metaBoxHeight

  page.drawRectangle({
    x: metaBoxX,
    y: metaBoxY,
    width: metaBoxWidth,
    height: metaBoxHeight,
    color: COLOR_GRAY_LIGHT,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  })

  let metaY = metaBoxY + metaBoxHeight - 10
  for (const [label, value] of metaLines) {
    page.drawText(`${label}:`, {
      x: metaBoxX + 6,
      y: metaY,
      size: 8,
      font: fontBold,
      color: COLOR_DARK_TEXT,
    })
    const valueWidth = fontRegular.widthOfTextAtSize(value, 8)
    page.drawText(value, {
      x: metaBoxX + metaBoxWidth - valueWidth - 6,
      y: metaY,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK_TEXT,
    })
    metaY -= 16
  }

  // Use the lower of addrY vs metaBoxY as next yPos
  yPos = Math.min(addrY, metaBoxY) - 12

  // ---------------------------------------------------------------------------
  // 3. Divider
  // ---------------------------------------------------------------------------

  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
  yPos -= 8

  // ---------------------------------------------------------------------------
  // 4. Bill To block
  // ---------------------------------------------------------------------------

  page.drawText('Bill To:', {
    x: margin,
    y: yPos,
    size: 8,
    font: fontBold,
    color: COLOR_MID_GRAY,
  })
  yPos -= 13

  page.drawText(truncate(party.name, 55), {
    x: margin,
    y: yPos,
    size: 10,
    font: fontBold,
    color: COLOR_DARK_TEXT,
  })
  yPos -= 13

  if (party.externalGstin) {
    page.drawText(`GSTIN: ${party.externalGstin}`, {
      x: margin,
      y: yPos,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK_TEXT,
    })
    yPos -= 13
  }

  const partyAddrLines = formatAddress(party.address)
  for (const line of partyAddrLines) {
    page.drawText(truncate(line, 55), {
      x: margin,
      y: yPos,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK_TEXT,
    })
    yPos -= 12
  }

  yPos -= 8

  // ---------------------------------------------------------------------------
  // 5. Line items table
  // ---------------------------------------------------------------------------

  // Column definitions: [header, x, width, align]
  type ColAlign = 'left' | 'right' | 'center'
  type ColDef = { header: string; x: number; w: number; align: ColAlign }

  const cols: ColDef[] = [
    { header: '#', x: margin, w: 18, align: 'center' },
    { header: 'Description', x: margin + 18, w: 110, align: 'left' },
    { header: 'HSN/SAC', x: margin + 128, w: 52, align: 'center' },
    { header: 'Qty & Unit', x: margin + 180, w: 52, align: 'right' },
    { header: 'Unit Price', x: margin + 232, w: 58, align: 'right' },
    { header: 'Disc%', x: margin + 290, w: 34, align: 'right' },
    { header: 'Taxable', x: margin + 324, w: 58, align: 'right' },
    { header: 'Tax', x: margin + 382, w: 72, align: 'right' },
    { header: 'Total', x: margin + 454, w: contentWidth - 454, align: 'right' },
  ]

  // Table header row
  const tableHeaderHeight = 16
  page.drawRectangle({
    x: margin,
    y: yPos - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: COLOR_GRAY_LIGHT,
  })

  // Header border lines
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
  page.drawLine({
    start: { x: margin, y: yPos - tableHeaderHeight },
    end: { x: width - margin, y: yPos - tableHeaderHeight },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })

  for (const col of cols) {
    let textX = col.x + 2
    if (col.align === 'right') {
      const tw = fontBold.widthOfTextAtSize(col.header, 7)
      textX = col.x + col.w - tw - 2
    } else if (col.align === 'center') {
      const tw = fontBold.widthOfTextAtSize(col.header, 7)
      textX = col.x + (col.w - tw) / 2
    }
    page.drawText(col.header, {
      x: textX,
      y: yPos - tableHeaderHeight + 5,
      size: 7,
      font: fontBold,
      color: COLOR_DARK_TEXT,
    })
  }

  yPos -= tableHeaderHeight

  // Data rows
  const rowHeight = 18
  const isIntra = invoice.posKind === 'intra_state'

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const isAlt = i % 2 === 1

    if (isAlt) {
      page.drawRectangle({
        x: margin,
        y: yPos - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: COLOR_ROW_ALT,
      })
    }

    const cellY = yPos - rowHeight + 5
    const hsnSac = item.hsnCode ?? item.sacCode ?? '—'

    // Tax cell: "CGST X%+SGST X%" or "IGST X%"
    let taxLabel: string
    let taxPaise: number
    if (isIntra) {
      const cgstRate = Number.parseFloat(item.cgstRatePct)
      const sgstRate = Number.parseFloat(item.sgstRatePct)
      taxLabel = `C${cgstRate}+S${sgstRate}%`
      taxPaise = item.cgstPaise + item.sgstPaise
    } else {
      const igstRate = Number.parseFloat(item.igstRatePct)
      taxLabel = `IGST ${igstRate}%`
      taxPaise = item.igstPaise
    }

    const rowData: string[] = [
      String(i + 1),
      truncate(item.description, 22),
      truncate(hsnSac, 10),
      `${item.quantity} ${item.unit}`,
      rupees(item.unitPricePaise),
      item.discountPct === '0' ? '—' : `${item.discountPct}%`,
      rupees(item.taxableValuePaise),
      `${taxLabel}\n${rupees(taxPaise)}`,
      rupees(item.totalPaise),
    ]

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c]
      if (!col) continue
      const text = rowData[c] ?? ''
      // Handle newlines in tax cell
      const lines = text.split('\n')
      let lineY = cellY + (lines.length > 1 ? 4 : 0)
      for (const line of lines) {
        let textX = col.x + 2
        if (col.align === 'right') {
          const tw = fontRegular.widthOfTextAtSize(line, 7)
          textX = col.x + col.w - tw - 2
        } else if (col.align === 'center') {
          const tw = fontRegular.widthOfTextAtSize(line, 7)
          textX = col.x + (col.w - tw) / 2
        }
        page.drawText(line, {
          x: textX,
          y: lineY,
          size: 7,
          font: fontRegular,
          color: COLOR_DARK_TEXT,
        })
        lineY -= 8
      }
    }

    // Row bottom border
    page.drawLine({
      start: { x: margin, y: yPos - rowHeight },
      end: { x: width - margin, y: yPos - rowHeight },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    })

    yPos -= rowHeight
  }

  // Table bottom border
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })

  yPos -= 12

  // ---------------------------------------------------------------------------
  // 6. Tax summary box (right-aligned)
  // ---------------------------------------------------------------------------

  const summaryLines: Array<{ label: string; value: string; bold?: boolean; accent?: boolean }> = [
    { label: 'Subtotal', value: `₹${rupees(invoice.subtotalPaise)}` },
  ]

  if (isIntra) {
    summaryLines.push({
      label: 'CGST',
      value: `₹${rupees(invoice.totalCgstPaise)}`,
    })
    summaryLines.push({
      label: 'SGST',
      value: `₹${rupees(invoice.totalSgstPaise)}`,
    })
  } else {
    summaryLines.push({
      label: 'IGST',
      value: `₹${rupees(invoice.totalIgstPaise)}`,
    })
  }

  if (invoice.totalCessPaise > 0) {
    summaryLines.push({ label: 'Cess', value: `₹${rupees(invoice.totalCessPaise)}` })
  }

  if (invoice.roundOffPaise !== 0) {
    const sign = invoice.roundOffPaise >= 0 ? '+' : ''
    summaryLines.push({
      label: 'Round Off',
      value: `${sign}${rupees(invoice.roundOffPaise)}`,
    })
  }

  summaryLines.push({
    label: 'Total',
    value: `₹${rupees(invoice.totalAmountPaise)}`,
    bold: true,
    accent: true,
  })

  const summaryBoxWidth = 200
  const summaryBoxX = width - margin - summaryBoxWidth
  const summaryRowH = 14
  const summaryBoxHeight = summaryLines.length * summaryRowH + 8

  page.drawRectangle({
    x: summaryBoxX,
    y: yPos - summaryBoxHeight,
    width: summaryBoxWidth,
    height: summaryBoxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  })

  let sumY = yPos - 6
  for (const row of summaryLines) {
    const bg = row.accent ? COLOR_ACCENT : null
    if (bg) {
      page.drawRectangle({
        x: summaryBoxX,
        y: sumY - summaryRowH + 2,
        width: summaryBoxWidth,
        height: summaryRowH,
        color: bg,
      })
    }

    const textColor = row.accent ? COLOR_WHITE : COLOR_DARK_TEXT
    const font = row.bold ? fontBold : fontRegular

    page.drawText(row.label, {
      x: summaryBoxX + 6,
      y: sumY - summaryRowH + 4,
      size: 8,
      font,
      color: textColor,
    })

    const valueW = font.widthOfTextAtSize(row.value, 8)
    page.drawText(row.value, {
      x: summaryBoxX + summaryBoxWidth - valueW - 6,
      y: sumY - summaryRowH + 4,
      size: 8,
      font,
      color: textColor,
    })

    // Separator between rows
    if (!row.accent) {
      page.drawLine({
        start: { x: summaryBoxX, y: sumY - summaryRowH + 2 },
        end: { x: summaryBoxX + summaryBoxWidth, y: sumY - summaryRowH + 2 },
        thickness: 0.3,
        color: rgb(0.85, 0.85, 0.85),
      })
    }

    sumY -= summaryRowH
  }

  yPos -= summaryBoxHeight + 10

  // ---------------------------------------------------------------------------
  // 7. Amount in words
  // ---------------------------------------------------------------------------

  const wordsText = amountInWords(invoice.totalAmountPaise)
  page.drawText('Amount in Words:', {
    x: margin,
    y: yPos,
    size: 8,
    font: fontBold,
    color: COLOR_MID_GRAY,
  })
  yPos -= 12

  // Wrap words text if it exceeds content width
  const maxCharsPerLine = 85
  const wordLines: string[] = []
  let remaining = wordsText
  while (remaining.length > maxCharsPerLine) {
    const breakAt = remaining.lastIndexOf(' ', maxCharsPerLine)
    const cutAt = breakAt > 0 ? breakAt : maxCharsPerLine
    wordLines.push(remaining.slice(0, cutAt))
    remaining = remaining.slice(cutAt + 1)
  }
  wordLines.push(remaining)

  for (const line of wordLines) {
    page.drawText(line, {
      x: margin,
      y: yPos,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK_TEXT,
    })
    yPos -= 12
  }

  yPos -= 8

  // ---------------------------------------------------------------------------
  // 8. QR code (bottom-left, 80×80 pt) — UPI payment link
  // ---------------------------------------------------------------------------

  const qrSize = 80
  let qrEmbedded = false

  if (business.upiVpa) {
    try {
      const rupeesAmount = (invoice.totalAmountPaise / 100).toFixed(2)
      const upiString = [
        'upi://pay',
        `?pa=${encodeURIComponent(business.upiVpa)}`,
        `&pn=${encodeURIComponent(business.name)}`,
        `&am=${rupeesAmount}`,
        '&cu=INR',
        `&tn=${encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)}`,
      ].join('')

      const qrBuffer = await QRCode.toBuffer(upiString, { type: 'png', width: 80, margin: 1 })
      const qrImage = await pdfDoc.embedPng(qrBuffer)

      // Place QR at current yPos, but ensure enough room; if too close to bottom use fixed position
      const qrY = Math.max(yPos - qrSize, 60)
      page.drawImage(qrImage, {
        x: margin,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })

      page.drawText('Scan to Pay (UPI)', {
        x: margin,
        y: qrY - 10,
        size: 7,
        font: fontRegular,
        color: COLOR_MID_GRAY,
      })

      qrEmbedded = true
      yPos = Math.min(yPos, qrY - 16)
    } catch (err) {
      // QR generation is best-effort; don't fail PDF generation
      console.error('[pdf] QR code generation failed:', err)
    }
  }

  if (!qrEmbedded) {
    yPos -= 4
  }

  // ---------------------------------------------------------------------------
  // 9. Footer
  // ---------------------------------------------------------------------------

  const footerText =
    'Powered by Shulka — shulka.pradeepjainbp.in | Sign up free to receive invoices directly'
  const footerY = 28
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 7)

  page.drawLine({
    start: { x: margin, y: footerY + 14 },
    end: { x: width - margin, y: footerY + 14 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })

  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: footerY,
    size: 7,
    font: fontRegular,
    color: COLOR_MID_GRAY,
  })

  // ---------------------------------------------------------------------------
  // Serialise
  // ---------------------------------------------------------------------------

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
