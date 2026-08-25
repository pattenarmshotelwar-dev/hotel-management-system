import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import jsPDF from 'jspdf'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const supabase: any = await createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, room:rooms(room_number, room_type), payments(*)')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const room = booking.room
  const payments: any[] = booking.payments ?? []
  const totalPaid = payments.filter((p: any) => p.status === 'succeeded').reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
  const nights = Math.ceil((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / (1000 * 60 * 60 * 24))

  // Generate PDF
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, pageWidth, 45, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('HOTEL INVOICE', 20, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ref: ${booking.booking_reference}`, 20, 32)
  doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 20, 39)

  // Guest info
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Guest Details', 20, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Name: ${booking.guest_first_name} ${booking.guest_last_name}`, 20, 70)
  if (booking.guest_email) doc.text(`Email: ${booking.guest_email}`, 20, 77)
  if (booking.guest_phone) doc.text(`Phone: ${booking.guest_phone}`, 20, 84)
  if (booking.guest_country) doc.text(`Country: ${booking.guest_country}`, 20, 91)

  // Booking details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Booking Details', 20, 108)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Room: ${room?.room_number ?? '—'} (${room?.room_type?.replace('_', ' ') ?? '—'})`, 20, 118)
  doc.text(`Check-in: ${format(new Date(booking.check_in_date), 'dd MMM yyyy')}`, 20, 125)
  doc.text(`Check-out: ${format(new Date(booking.check_out_date), 'dd MMM yyyy')}`, 20, 132)
  doc.text(`Duration: ${nights} night${nights > 1 ? 's' : ''}`, 20, 139)
  doc.text(`Guests: ${booking.adults} Adults, ${booking.children} Children`, 20, 146)

  // Charges table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Charges', 20, 163)

  // Table header
  doc.setFillColor(241, 245, 249) // slate-100
  doc.rect(18, 168, pageWidth - 36, 9, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 20, 175)
  doc.text('Amount', pageWidth - 40, 175, { align: 'right' })

  // Line item
  doc.setFont('helvetica', 'normal')
  doc.text(`Room ${room?.room_number ?? ''} — ${nights} nights`, 20, 185)
  doc.text(`£${Number(booking.total_amount || 0).toFixed(2)}`, pageWidth - 40, 185, { align: 'right' })

  // Total
  doc.line(18, 193, pageWidth - 18, 193)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', 20, 202)
  doc.text(`£${Number(booking.total_amount || 0).toFixed(2)}`, pageWidth - 40, 202, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(22, 163, 74) // green-600
  doc.text(`Paid: £${Number(totalPaid).toFixed(2)}`, 20, 210)
  if (Number(booking.total_amount || 0) - totalPaid > 0) {
    doc.setTextColor(220, 38, 38) // red-600
    doc.text(`Balance Due: £${(Number(booking.total_amount || 0) - totalPaid).toFixed(2)}`, 20, 217)
  }

  // Payment details
  if (payments.length > 0) {
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Payments Received', 20, 232)
    let y = 240
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const p of payments.filter((p: any) => p.status === 'succeeded')) {
      doc.text(`${format(new Date(p.created_at), 'dd MMM yyyy')} — ${p.method.replace('_', ' ')} — £${Number(p.amount).toFixed(2)}`, 20, y)
      y += 7
    }
  }

  // Footer
  doc.setTextColor(148, 163, 184) // slate-400
  doc.setFontSize(8)
  doc.text('Thank you for your stay.', pageWidth / 2, 275, { align: 'center' })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${booking.booking_reference}.pdf"`,
    },
  })
}
