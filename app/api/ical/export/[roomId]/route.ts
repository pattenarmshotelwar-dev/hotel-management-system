import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import ical from 'ical-generator'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params
  const supabase: any = await createAdminClient()

  // Fetch room
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  // Fetch bookings for this room
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('room_id', roomId)
    .not('status', 'in', '(cancelled)')

  // Generate iCal
  const calendar = ical({
    name: `Hotel Room ${room.room_number}`,
    prodId: '//Hotel PMS//Room Calendar//EN',
    timezone: 'Europe/London',
  })

  for (const booking of bookings ?? []) {
    calendar.createEvent({
      uid: booking.id,
      start: new Date(booking.check_in_date),
      end: new Date(booking.check_out_date),
      summary: booking.is_maintenance_block
        ? `BLOCKED: ${booking.maintenance_reason ?? 'Maintenance'}`
        : `${booking.guest_first_name} ${booking.guest_last_name}`,
      description: booking.is_maintenance_block
        ? booking.maintenance_reason ?? 'Room blocked for maintenance'
        : `Booking ref: ${booking.booking_reference}\nGuests: ${booking.adults} adults, ${booking.children} children`,
      location: `Room ${room.room_number}`,
    })
  }

  return new NextResponse(calendar.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="room-${room.room_number}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
