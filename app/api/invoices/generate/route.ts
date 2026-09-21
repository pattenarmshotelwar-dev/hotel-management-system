import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const supabase: any = await createAdminClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, room:rooms(room_number, room_type, base_price), payments(*)')
    .eq('id', bookingId)
    .single()

  if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const room = booking.room
  const payments: any[] = booking.payments ?? []
  const successfulPayments = payments.filter((p: any) => p.status === 'succeeded')
  const totalPaid = successfulPayments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  
  const ciDate = new Date(booking.check_in_date)
  const coDate = new Date(booking.check_out_date)
  const diffTime = Math.abs(coDate.getTime() - ciDate.getTime())
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))

  const grossTotal = Number(booking.total_amount) || 0
  const netTotal = grossTotal / 1.2
  const vatAmount = grossTotal - netTotal
  const balanceDue = Math.max(0, grossTotal - totalPaid)

  // Parse add-ons from internal_notes if present
  const parsedAddons: Array<{ description: string; qty: number; unitPrice: number; total: number }> = []
  if (booking.internal_notes) {
    const lines = String(booking.internal_notes).split('\n')
    lines.forEach(line => {
      if (line.includes('[ADDON')) {
        const content = line.replace(/\[ADDON[S]?\]:\s*/g, '')
        const items = content.split(',').map(s => s.trim()).filter(Boolean)
        items.forEach(item => {
          const match = item.match(/^(\d+)x\s+([^()]+?)(?:\s*\((?:£|GBP)?([0-9.]+)\))?(?:\s*-\s*(.+))?$/)
          if (match) {
            const qtyNum = parseInt(match[1]) || 1
            const name = match[2].trim()
            const totalVal = parseFloat(match[3]) || 0
            const unitVal = qtyNum > 0 ? totalVal / qtyNum : totalVal
            parsedAddons.push({
              description: name,
              qty: qtyNum,
              unitPrice: unitVal,
              total: totalVal,
            })
          }
        })
      }
    })
  }

  const addonsTotalSum = parsedAddons.reduce((sum, a) => sum + a.total, 0)
  const accommodationGross = Math.max(0, grossTotal - addonsTotalSum)
  const roomRatePerNight = nights > 0 ? (accommodationGross / nights) : accommodationGross
  const roomNumber = room?.room_number ?? 'Assigned'
  const roomTypeLabel = (room?.room_type ?? 'Standard').replace(/_/g, ' ')

  // -------------------------------------------------------------
  // Read Logo Base64
  // -------------------------------------------------------------
  let logoDataUri: string | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public', 'invoice-logo.png')
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath)
      logoDataUri = `data:image/png;base64,${buffer.toString('base64')}`
    }
  } catch (e) {
    // fallback gracefully
  }

  // -------------------------------------------------------------
  // Generate Exact Official Invoice PDF Document (A4 White Paper)
  // -------------------------------------------------------------
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const margin = 15
  const contentWidth = pageWidth - (margin * 2) // 180mm
  const colWidth = (contentWidth - 6) / 2 // 87mm
  const col2X = margin + colWidth + 6 // 108mm

  // --- 1. HEADER ROW (Logo on Left, INVOICE on Right) ---
  if (logoDataUri) {
    try {
      // 52mm wide by 28.5mm high (matches 1.821 aspect ratio)
      doc.addImage(logoDataUri, 'PNG', margin, 12, 52, 28.5)
    } catch (e) {
      // fallback
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(15, 23, 42)
      doc.text('THE PATTEN ARMS HOTEL', margin, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('Parker Street, Warrington WA1 1LS', margin, 26)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('THE PATTEN ARMS HOTEL', margin, 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Parker Street, Warrington WA1 1LS', margin, 26)
  }

  // Right Side: INVOICE header & meta
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text('INVOICE', pageWidth - margin, 20, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139) // slate-500
  doc.text('Invoice No:', pageWidth - margin - 35, 28, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`PAH-${booking.booking_reference}`, pageWidth - margin, 28, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Invoice Date:', pageWidth - margin - 35, 34, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(format(new Date(), 'dd/MM/yyyy'), pageWidth - margin, 34, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Folio No:', pageWidth - margin - 35, 40, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)
  const folioNum = (booking.booking_reference || '').replace(/[^0-9]/g, '') || '000104'
  doc.text(folioNum, pageWidth - margin, 40, { align: 'right' })

  // Header Divider Line
  doc.setDrawColor(203, 213, 225) // slate-300
  doc.setLineWidth(0.3)
  doc.line(margin, 46, pageWidth - margin, 46)

  // --- 2. DETAILS 2-COLUMN GRID (GUEST DETAILS & STAY DETAILS) ---
  const cardY = 51
  const cardHeight = 36

  // Card 1: GUEST DETAILS
  doc.setFillColor(248, 250, 252) // bg-slate-50/50
  doc.setDrawColor(226, 232, 240) // border-slate-200
  doc.roundedRect(margin, cardY, colWidth, cardHeight, 2, 2, 'FD')

  doc.setTextColor(100, 116, 139) // text-slate-500
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('GUEST DETAILS', margin + 4, cardY + 6.5)

  doc.setDrawColor(226, 232, 240)
  doc.line(margin + 4, cardY + 8.5, margin + colWidth - 4, cardY + 8.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Guest Name:', margin + 4, cardY + 14.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  doc.text(`${booking.guest_first_name} ${booking.guest_last_name}`, margin + 24, cardY + 14.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Address:', margin + 4, cardY + 20.5)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_country || 'United Kingdom', margin + 24, cardY + 20.5)

  doc.setTextColor(100, 116, 139)
  doc.text('Email:', margin + 4, cardY + 26.5)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_email || '—', margin + 24, cardY + 26.5)

  doc.setTextColor(100, 116, 139)
  doc.text('Phone:', margin + 4, cardY + 32.5)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_phone || '—', margin + 24, cardY + 32.5)

  // Card 2: STAY DETAILS
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(col2X, cardY, colWidth, cardHeight, 2, 2, 'FD')

  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('STAY DETAILS', col2X + 4, cardY + 6.5)

  doc.setDrawColor(226, 232, 240)
  doc.line(col2X + 4, cardY + 8.5, col2X + colWidth - 4, cardY + 8.5)

  // Sub-grid 2 columns inside Stay Details
  const stayCol2X = col2X + 44

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Room Number:', col2X + 4, cardY + 14.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Room ${roomNumber}`, col2X + 26, cardY + 14.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Room Type:', stayCol2X, cardY + 14.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(roomTypeLabel, stayCol2X + 18, cardY + 14.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Check In:', col2X + 4, cardY + 23.5)
  doc.setTextColor(30, 41, 59)
  doc.text(format(ciDate, 'dd/MM/yyyy'), col2X + 26, cardY + 23.5)

  doc.setTextColor(100, 116, 139)
  doc.text('Check Out:', stayCol2X, cardY + 23.5)
  doc.setTextColor(30, 41, 59)
  doc.text(format(coDate, 'dd/MM/yyyy'), stayCol2X + 18, cardY + 23.5)

  doc.setTextColor(100, 116, 139)
  doc.text('No. of Nights:', col2X + 4, cardY + 32.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${nights}`, col2X + 26, cardY + 32.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('No. of Guests:', stayCol2X, cardY + 32.5)
  doc.setTextColor(30, 41, 59)
  const guestsLabel = `${booking?.adults || 1} Adult${(booking?.adults || 1) > 1 ? 's' : ''}${(booking?.children || 0) > 0 ? `, ${booking.children} Child` : ''}`
  doc.text(guestsLabel, stayCol2X + 20, cardY + 32.5)

  // --- 3. ITEMISED CHARGES TABLE ---
  const tableY = cardY + cardHeight + 6

  // Section Header: ITEMISED CHARGES
  doc.setFillColor(241, 245, 249) // bg-slate-100
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, tableY, contentWidth, 6.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85) // text-slate-700
  doc.text('ITEMISED CHARGES', margin + 4, tableY + 4.5)

  // Table Column Header Bar
  const thY = tableY + 6.5
  doc.setFillColor(248, 250, 252) // bg-slate-50
  doc.rect(margin, thY, contentWidth, 6, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139) // text-slate-500
  doc.text('DATE', margin + 4, thY + 4.2)
  doc.text('DESCRIPTION', margin + 30, thY + 4.2)
  doc.text('QTY', margin + 115, thY + 4.2, { align: 'center' })
  doc.text('UNIT PRICE', margin + 145, thY + 4.2, { align: 'right' })
  doc.text('AMOUNT', pageWidth - margin - 4, thY + 4.2, { align: 'right' })

  // Row 1: Accommodation
  let currentY = thY + 6
  const rowHeight = 7.5

  doc.setFillColor(255, 255, 255)
  doc.rect(margin, currentY, contentWidth, rowHeight, 'F')
  doc.setDrawColor(241, 245, 249)
  doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(format(ciDate, 'dd/MM/yyyy'), margin + 4, currentY + 5)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Accommodation — ${roomTypeLabel} (Room ${roomNumber})`, margin + 30, currentY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`${nights} night${nights > 1 ? 's' : ''}`, margin + 115, currentY + 5, { align: 'center' })
  doc.text(`£${roomRatePerNight.toFixed(2)}`, margin + 145, currentY + 5, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`£${accommodationGross.toFixed(2)}`, pageWidth - margin - 4, currentY + 5, { align: 'right' })

  currentY += rowHeight

  // Add-on Rows
  for (const addon of parsedAddons) {
    doc.setFillColor(250, 250, 250)
    doc.rect(margin, currentY, contentWidth, rowHeight, 'F')
    doc.setDrawColor(241, 245, 249)
    doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(format(ciDate, 'dd/MM/yyyy'), margin + 4, currentY + 5)

    doc.setTextColor(30, 41, 59)
    doc.text(`• ${addon.description}`, margin + 30, currentY + 5)

    doc.setTextColor(100, 116, 139)
    doc.text(`${addon.qty}`, margin + 115, currentY + 5, { align: 'center' })
    doc.text(`£${addon.unitPrice.toFixed(2)}`, margin + 145, currentY + 5, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(`£${addon.total.toFixed(2)}`, pageWidth - margin - 4, currentY + 5, { align: 'right' })

    currentY += rowHeight
  }

  // Outer border for itemised table
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, tableY, contentWidth, currentY - tableY, 'D')

  // --- 4. PAYMENTS & DEPOSITS (Left) vs TOTALS (Right) ---
  const totalsY = currentY + 5
  const blockHeight = 44

  // Left: PAYMENTS & DEPOSITS
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, totalsY, colWidth, blockHeight, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('PAYMENTS & DEPOSITS', margin + 4, totalsY + 6.5)

  doc.setDrawColor(226, 232, 240)
  doc.line(margin + 4, totalsY + 8.5, margin + colWidth - 4, totalsY + 8.5)

  if (successfulPayments.length > 0) {
    let pyY = totalsY + 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const p of successfulPayments.slice(0, 3)) {
      doc.setTextColor(71, 85, 105)
      const pMethod = String(p.method || 'Card').replace(/_/g, ' ')
      const pDate = format(new Date(p.created_at), 'dd/MM/yyyy')
      doc.text(`${pDate} — ${pMethod}`, margin + 4, pyY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(21, 128, 61) // text-green-700
      doc.text(`-£${Number(p.amount).toFixed(2)}`, margin + colWidth - 4, pyY, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      pyY += 5.5
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('No payments recorded to date.', margin + 4, totalsY + 15)
  }

  // Appreciation Note inside left box
  doc.setDrawColor(241, 245, 249)
  doc.line(margin + 4, totalsY + blockHeight - 11, margin + colWidth - 4, totalsY + blockHeight - 11)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text('Thank you for staying with us.', margin + 4, totalsY + blockHeight - 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('We hope to welcome you back soon.', margin + 4, totalsY + blockHeight - 2.5)

  // Right: Subtotal, VAT, Total, Balance
  doc.setFillColor(248, 250, 252) // bg-slate-50/50
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(col2X, totalsY, colWidth, blockHeight, 2, 2, 'FD')

  let tY = totalsY + 6.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('SUBTOTAL (Net):', col2X + 4, tY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`£${netTotal.toFixed(2)}`, pageWidth - margin - 4, tY, { align: 'right' })

  tY += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('VAT (20%):', col2X + 4, tY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`£${vatAmount.toFixed(2)}`, pageWidth - margin - 4, tY, { align: 'right' })

  tY += 6.5
  doc.setDrawColor(203, 213, 225)
  doc.line(col2X + 4, tY - 1.5, pageWidth - margin - 4, tY - 1.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  doc.text('TOTAL (GBP):', col2X + 4, tY + 2)
  doc.text(`£${grossTotal.toFixed(2)}`, pageWidth - margin - 4, tY + 2, { align: 'right' })

  tY += 7.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('PAYMENTS RECEIVED:', col2X + 4, tY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(21, 128, 61)
  doc.text(`-£${totalPaid.toFixed(2)}`, pageWidth - margin - 4, tY, { align: 'right' })

  tY += 7.5
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(col2X + 4, tY - 1.5, pageWidth - margin - 4, tY - 1.5)
  doc.setLineWidth(0.2) // reset

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('BALANCE DUE:', col2X + 4, tY + 2.5)

  if (balanceDue <= 0.01) {
    doc.setTextColor(21, 128, 61) // green-700
    doc.text('£0.00 (PAID IN FULL)', pageWidth - margin - 4, tY + 2.5, { align: 'right' })
  } else {
    doc.setTextColor(220, 38, 38) // red-600
    doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 4, tY + 2.5, { align: 'right' })
  }

  // --- 5. BILLING & COMPANY INFORMATION FOOTER ---
  const footerY = totalsY + blockHeight + 6

  doc.setDrawColor(226, 232, 240)
  doc.line(margin, footerY, pageWidth - margin, footerY)

  // Left: Billing Information
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85) // text-slate-700
  doc.text('BILLING INFORMATION', margin, footerY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('• All charges are itemised in GBP (£).', margin, footerY + 9)
  doc.text('• Payment is due upon check-out or as agreed by invoice terms.', margin, footerY + 13)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Bank Transfer Details (BACS):', margin, footerY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Bank: Barclays Bank   |   Sort Code: 20-91-45', margin, footerY + 22)
  doc.text('Account No: 83920184   |   Name: Rumiscapes Ltd', margin, footerY + 26)
  doc.text('Payment due upon receipt. Please use invoice reference on transfer.', margin, footerY + 30)

  // Right: Company Information
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text('COMPANY INFORMATION', col2X, footerY + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)
  doc.text('Rumiscapes Ltd', col2X, footerY + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('Trading as The Patten Arms Hotel', col2X, footerY + 14)
  doc.text('Parker Street, Warrington, WA1 1LS', col2X, footerY + 18)
  doc.text('Company No. 16117921', col2X, footerY + 22)
  doc.text('Tel: 01925 636602   |   Email: info@pattenarms.co.uk', col2X, footerY + 26)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="PAH-Invoice-${booking.booking_reference}.pdf"`,
      'Cache-Control': 'no-store, must-revalidate',
    },
  })
}
