import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import nodeIcal from 'node-ical'
import { format } from 'date-fns'
import { generateBookingReference } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Authorization check: either valid cron secret or authenticated session
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  let isAuthorized = false
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true
  } else {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (user) isAuthorized = true
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized: Valid session or CRON_SECRET required' }, { status: 401 })
  }

  const supabase: any = await createAdminClient()

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
        if (!event || (event as any).type !== 'VEVENT') continue

        const vEvent: any = event
        const startDate = vEvent.start instanceof Date ? vEvent.start : new Date(vEvent.start)
        const endDate = vEvent.end instanceof Date ? vEvent.end : new Date(vEvent.end)

        const checkIn = format(startDate, 'yyyy-MM-dd')
        const checkOut = format(endDate, 'yyyy-MM-dd')

        // Extract guest name from summary
        const summary = vEvent.summary?.val ?? vEvent.summary ?? 'Booking.com Guest'
        const nameParts = String(summary).split(' ')
        const guestFirstName = nameParts[0] ?? 'Booking.com'
        const guestLastName = nameParts.slice(1).join(' ') || 'Guest'

        const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
        const roomBasePrice = Number(room.base_price) || 50
        // Calculate estimated revenue for Booking.com stay with default 15% commission markup
        const estimatedStayTotal = Math.round(roomBasePrice * nights * 1.15)

        // Check if booking already exists
        const { data: existing } = await supabase
          .from('bookings')
          .select('id, total_amount')
          .eq('room_id', room.id)
          .eq('ical_uid', uid)
          .maybeSingle()

        if (existing) {
          // Update existing, ensuring non-zero total if currently 0
          const updates: any = {
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_first_name: guestFirstName,
            guest_last_name: guestLastName,
          }
          if (!existing.total_amount || Number(existing.total_amount) === 0) {
            updates.total_amount = estimatedStayTotal
          }

          await supabase.from('bookings').update(updates).eq('id', existing.id)
          totalUpdated++
        } else {
          // Insert new booking with calculated total amount
          await supabase.from('bookings').insert({
            booking_reference: generateBookingReference(),
            room_id: room.id,
            guest_first_name: guestFirstName,
            guest_last_name: guestLastName,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: estimatedStayTotal,
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
