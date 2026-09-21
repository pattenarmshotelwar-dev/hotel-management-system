import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import jsPDF from 'jspdf'
import { format } from 'date-fns'

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
  const roomNumber = room?.room_number ?? '—'
  const roomTypeLabel = (room?.room_type ?? 'Standard').replace(/_/g, ' ')

  // -------------------------------------------------------------
  // Generate Professional PDF Document
  // -------------------------------------------------------------
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const margin = 16
  const contentWidth = pageWidth - (margin * 2)

  // 1. Top Header Banner
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F')

  // Hotel Name & Details (Left)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('THE PATTEN ARMS HOTEL', margin, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225) // slate-300
  doc.text('Parker Street, Warrington, Cheshire, WA1 1LS', margin, 22)
  doc.text('Tel: 01925 636602   |   Email: info@pattenarms.co.uk', margin, 27)
  doc.text('Trading as Rumiscapes Ltd   |   Company No. 16117921', margin, 32)

  // Invoice Title & Meta (Right)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('TAX INVOICE', pageWidth - margin, 15, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Invoice No: PAH-${booking.booking_reference}`, pageWidth - margin, 22, { align: 'right' })
  doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin, 27, { align: 'right' })
  doc.text(`Folio: ${(booking.booking_reference || '').replace(/[^0-9]/g, '') || '00104'}`, pageWidth - margin, 32, { align: 'right' })

  // 2. Two Information Cards (Guest Details & Stay Details)
  const cardY = 48
  const cardHeight = 36
  const colWidth = (contentWidth - 6) / 2

  // Card 1: Guest Details
  doc.setFillColor(248, 250, 252) // slate-50
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.roundedRect(margin, cardY, colWidth, cardHeight, 2, 2, 'FD')

  doc.setTextColor(71, 85, 105) // slate-600
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('GUEST DETAILS', margin + 4, cardY + 7)

  doc.setDrawColor(226, 232, 240)
  doc.line(margin + 4, cardY + 9, margin + colWidth - 4, cardY + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Guest Name:', margin + 4, cardY + 15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${booking.guest_first_name} ${booking.guest_last_name}`, margin + 26, cardY + 15)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Address:', margin + 4, cardY + 21)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_country || 'United Kingdom', margin + 26, cardY + 21)

  doc.setTextColor(100, 116, 139)
  doc.text('Email:', margin + 4, cardY + 27)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_email || '—', margin + 26, cardY + 27)

  doc.setTextColor(100, 116, 139)
  doc.text('Phone:', margin + 4, cardY + 33)
  doc.setTextColor(30, 41, 59)
  doc.text(booking.guest_phone || '—', margin + 26, cardY + 33)

  // Card 2: Stay Details
  const col2X = margin + colWidth + 6
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(col2X, cardY, colWidth, cardHeight, 2, 2, 'FD')

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('STAY DETAILS', col2X + 4, cardY + 7)

  doc.setDrawColor(226, 232, 240)
  doc.line(col2X + 4, cardY + 9, col2X + colWidth - 4, cardY + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Room:', col2X + 4, cardY + 15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Room ${roomNumber} (${roomTypeLabel})`, col2X + 22, cardY + 15)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Check In:', col2X + 4, cardY + 21)
  doc.setTextColor(30, 41, 59)
  doc.text(format(ciDate, 'dd/MM/yyyy'), col2X + 22, cardY + 21)

  doc.setTextColor(100, 116, 139)
  doc.text('Check Out:', col2X + 4, cardY + 27)
  doc.setTextColor(30, 41, 59)
  doc.text(format(coDate, 'dd/MM/yyyy'), col2X + 22, cardY + 27)

  doc.setTextColor(100, 116, 139)
  doc.text('Duration:', col2X + 4, cardY + 33)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${nights} night${nights > 1 ? 's' : ''} (${booking.adults || 1} Adult${(booking.adults || 1) > 1 ? 's' : ''}${(booking.children || 0) > 0 ? `, ${booking.children} Child` : ''})`, col2X + 22, cardY + 33)

  // 3. Itemised Charges Table
  const tableY = cardY + cardHeight + 8

  // Table header bar
  doc.setFillColor(241, 245, 249) // slate-100
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, tableY, contentWidth, 7, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text('DATE', margin + 4, tableY + 4.8)
  doc.text('DESCRIPTION', margin + 30, tableY + 4.8)
  doc.text('QTY', margin + 115, tableY + 4.8, { align: 'center' })
  doc.text('UNIT PRICE', margin + 145, tableY + 4.8, { align: 'right' })
  doc.text('AMOUNT (GBP)', pageWidth - margin - 4, tableY + 4.8, { align: 'right' })

  // Row 1: Accommodation
  let currentY = tableY + 7
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
  doc.text(`Accommodation — Room ${roomNumber} (${roomTypeLabel})`, margin + 30, currentY + 5)

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

  // Outer border for charges table
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, tableY, contentWidth, currentY - tableY, 'D')

  // 4. Financial Totals & Payments Section
  const totalsY = currentY + 6
  const blockHeight = 44

  // Left Card: Payments Received List
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, totalsY, colWidth, blockHeight, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('PAYMENTS & SETTLEMENT', margin + 4, totalsY + 6.5)

  doc.setDrawColor(226, 232, 240)
  doc.line(margin + 4, totalsY + 8.5, margin + colWidth - 4, totalsY + 8.5)

  if (successfulPayments.length > 0) {
    let pyY = totalsY + 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const p of successfulPayments.slice(0, 4)) {
      doc.setTextColor(71, 85, 105)
      const pMethod = String(p.method || 'Card').replace(/_/g, ' ')
      const pDate = format(new Date(p.created_at), 'dd/MM/yyyy')
      doc.text(`${pDate} — ${pMethod}`, margin + 4, pyY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(22, 101, 52) // emerald-800
      doc.text(`-£${Number(p.amount).toFixed(2)}`, margin + colWidth - 4, pyY, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      pyY += 5.5
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('No recorded payments on file.', margin + 4, totalsY + 16)
  }

  // Stamp / status note at bottom of left card
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Thank you for choosing The Patten Arms Hotel.', margin + 4, totalsY + blockHeight - 4)

  // Right Card: Subtotals, VAT, Grand Total, Balance
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(col2X, totalsY, colWidth, blockHeight, 2, 2, 'FD')

  let tY = totalsY + 6.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Subtotal (Net Excl. VAT):', col2X + 4, tY)
  doc.setTextColor(15, 23, 42)
  doc.text(`£${netTotal.toFixed(2)}`, pageWidth - margin - 4, tY, { align: 'right' })

  tY += 6
  doc.setTextColor(100, 116, 139)
  doc.text('VAT (20% Standard UK Rate):', col2X + 4, tY)
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
  doc.setTextColor(22, 101, 52)
  doc.text('Payments Received:', col2X + 4, tY)
  doc.setFont('helvetica', 'bold')
  doc.text(`-£${totalPaid.toFixed(2)}`, pageWidth - margin - 4, tY, { align: 'right' })

  tY += 7.5
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.4)
  doc.line(col2X + 4, tY - 1.5, pageWidth - margin - 4, tY - 1.5)
  doc.setLineWidth(0.2) // reset

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  if (balanceDue <= 0.01) {
    doc.setTextColor(22, 101, 52) // emerald-700
    doc.text('BALANCE DUE:', col2X + 4, tY + 2.5)
    doc.text('£0.00 (PAID IN FULL)', pageWidth - margin - 4, tY + 2.5, { align: 'right' })
  } else {
    doc.setTextColor(220, 38, 38) // red-600
    doc.text('BALANCE DUE:', col2X + 4, tY + 2.5)
    doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 4, tY + 2.5, { align: 'right' })
  }

  // 5. Bank Transfer Remittance & Footer Details
  const footerY = totalsY + blockHeight + 6

  doc.setDrawColor(226, 232, 240)
  doc.line(margin, footerY, pageWidth - margin, footerY)

  // Bank transfer box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  doc.text('REMITTANCE & PAYMENT DETAILS (BACS / BANK TRANSFER)', margin, footerY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('Bank: Barclays Bank   |   Sort Code: 20-91-45   |   Account No: 83920184   |   Account Name: Rumiscapes Ltd', margin, footerY + 9)
  doc.text(`Please quote Invoice Ref: PAH-${booking.booking_reference} on bank transfers. Payment due upon receipt.`, margin, footerY + 13)

  // Company registration & contact footer
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184) // slate-400
  doc.text('Rumiscapes Ltd trading as The Patten Arms Hotel  •  Parker Street, Warrington, WA1 1LS  •  Company No. 16117921', pageWidth / 2, 285, { align: 'center' })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="PAH-Invoice-${booking.booking_reference}.pdf"`,
      'Cache-Control': 'no-store, must-revalidate',
    },
  })
}
