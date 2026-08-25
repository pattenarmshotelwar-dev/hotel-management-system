import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import nodeIcal from 'node-ical'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()

  // Get all rooms with iCal import URLs
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .not('ical_import_url', 'is', null)
    .eq('is_active', true)

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({ success: true, message: 'No rooms with iCal URLs configured', added: 0 })
  }

  let totalAdded = 0
  let totalUpdated = 0
  const errors: string[] = []

  for (const room of rooms) {
    if (!room.ical_import_url) continue

    try {
      // Fetch and parse iCal feed
      const events = await nodeIcal.async.fromURL(room.ical_import_url)

      for (const [uid, event] of Object.entries(events)) {
        if (event.type !== 'VEVENT') continue

        const startDate = event.start instanceof Date ? event.start : new Date(event.start as any)
        const endDate = event.end instanceof Date ? event.end : new Date(event.end as any)

        const checkIn = format(startDate, 'yyyy-MM-dd')
        const checkOut = format(endDate, 'yyyy-MM-dd')

        // Extract guest name from summary
        const summary = (event.summary as any)?.val ?? event.summary ?? 'Booking.com Guest'
        const nameParts = String(summary).split(' ')
        const guestFirstName = nameParts[0] ?? 'Booking.com'
        const guestLastName = nameParts.slice(1).join(' ') || 'Guest'

        // Check if booking already exists
        const { data: existing } = await supabase
          .from('bookings')
          .select('id')
          .eq('room_id', room.id)
          .eq('ical_uid', uid)
          .single()

        if (existing) {
          // Update existing
          await supabase.from('bookings').update({
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_first_name: guestFirstName,
            guest_last_name: guestLastName,
          }).eq('id', existing.id)
          totalUpdated++
        } else {
          // Insert new booking
          await supabase.from('bookings').insert({
            room_id: room.id,
            guest_first_name: guestFirstName,
            guest_last_name: guestLastName,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: 0,
            currency: 'GBP',
            source: 'booking_com',
            status: 'confirmed',
            is_ical_imported: true,
            ical_uid: uid,
            booking_com_reference: String(uid),
          })
          totalAdded++
        }
      }

      // Log sync
      await supabase.from('ical_sync_logs').insert({
        room_id: room.id,
        sync_type: 'import',
        status: 'success',
        bookings_added: totalAdded,
        bookings_updated: totalUpdated,
      })
    } catch (err: any) {
      errors.push(`Room ${room.room_number}: ${err.message}`)
      await supabase.from('ical_sync_logs').insert({
        room_id: room.id,
        sync_type: 'import',
        status: 'error',
        error_message: err.message,
      })
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    added: totalAdded,
    updated: totalUpdated,
    errors,
    message: `Synced ${rooms.length} rooms: ${totalAdded} added, ${totalUpdated} updated`,
  })
}
