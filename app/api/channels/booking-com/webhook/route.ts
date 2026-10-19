import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateBookingReference } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Universal Two-Way Booking.com / Channel Manager Webhook Endpoint
 * 
 * Supports:
 * 1. Channel Manager Aggregators (Channex.io, Beds24, Smoobu)
 * 2. Hostinger n8n Automation Workflows (srv2039559.hstgr.cloud)
 * 3. Direct OTA Webhook payloads
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const channelSecret = process.env.CHANNEL_MANAGER_SECRET || process.env.CRON_SECRET

    // Optional secret verification if configured
    if (channelSecret && authHeader !== `Bearer ${channelSecret}`) {
      // Allow if standard API key header matches
      const apiKeyHeader = request.headers.get('x-api-key')
      if (apiKeyHeader !== channelSecret) {
        return NextResponse.json({ error: 'Unauthorized channel webhook' }, { status: 401 })
      }
    }

    const payload = await request.json()
    const supabase: any = await createAdminClient()

    // 1. Identify Event Type
    const eventType = payload.event || payload.action || (payload.status === 'cancelled' ? 'booking_cancelled' : 'booking_created')
    
    // Normalize booking payload fields across Channex, Beds24, and n8n formats
    const otaReference = payload.booking_id || payload.ota_reference || payload.reservation_id || payload.booking_com_reference || `BCOM-${Date.now()}`
    const checkInDate = payload.check_in_date || payload.checkin || payload.arrival
    const checkOutDate = payload.check_out_date || payload.checkout || payload.departure
    const roomNumber = payload.room_number?.toString() || payload.room?.toString()
    const roomId = payload.room_id

    if (!checkInDate || !checkOutDate) {
      return NextResponse.json({ error: 'Missing check_in_date or check_out_date' }, { status: 400 })
    }

    // Resolve room
    let targetRoom: any = null
    if (roomId) {
      const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
      targetRoom = r
    }
    if (!targetRoom && roomNumber) {
      const { data: r } = await supabase.from('rooms').select('*').eq('room_number', roomNumber).maybeSingle()
      targetRoom = r
    }
    if (!targetRoom) {
      // Pick first available active room of matching type or first room
      const { data: r } = await supabase.from('rooms').select('*').eq('is_active', true).limit(1).maybeSingle()
      targetRoom = r
    }

    if (!targetRoom) {
      return NextResponse.json({ error: 'No active room available to assign reservation' }, { status: 422 })
    }

    // 2. Handle Cancellation
    if (eventType === 'booking_cancelled' || payload.status === 'cancelled') {
      const { data: existing } = await supabase
        .from('bookings')
        .select('id, booking_reference')
        .eq('booking_com_reference', otaReference)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            internal_notes: `Cancelled via Booking.com Two-Way Sync at ${new Date().toISOString()}`,
          })
          .eq('id', existing.id)

        return NextResponse.json({
          success: true,
          message: `Booking ${existing.booking_reference} marked as cancelled`,
          action: 'cancelled',
        })
      }
    }

    // 3. Handle Create or Update
    const guestFirstName = payload.guest_first_name || payload.first_name || payload.guest_name?.split(' ')[0] || 'Booking.com'
    const guestLastName = payload.guest_last_name || payload.last_name || payload.guest_name?.split(' ').slice(1).join(' ') || 'Guest'
    const guestEmail = payload.guest_email || payload.email || null
    const guestPhone = payload.guest_phone || payload.phone || null
    const totalAmount = parseFloat(payload.total_amount || payload.total_price || payload.amount || targetRoom.base_price || 60)
    const commission = parseFloat(payload.commission || payload.booking_com_commission || (totalAmount * 0.15).toFixed(2))

    // Check if reservation already exists
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, booking_reference')
      .or(`booking_com_reference.eq.${otaReference},ical_uid.eq.${otaReference}`)
      .maybeSingle()

    if (existingBooking) {
      // Update existing booking
      await supabase
        .from('bookings')
        .update({
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          guest_first_name: guestFirstName,
          guest_last_name: guestLastName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          total_amount: totalAmount,
          booking_com_commission: commission,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBooking.id)

      return NextResponse.json({
        success: true,
        message: `Booking ${existingBooking.booking_reference} updated via Two-Way Sync`,
        bookingId: existingBooking.id,
        action: 'updated',
      })
    }

    // Insert new booking
    const newRef = generateBookingReference()
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        booking_reference: newRef,
        room_id: targetRoom.id,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        adults: payload.adults || 1,
        children: payload.children || 0,
        total_amount: totalAmount,
        currency: 'GBP',
        source: 'booking_com',
        status: 'confirmed',
        booking_com_reference: otaReference,
        booking_com_commission: commission,
        special_requests: payload.special_requests || payload.remarks || null,
        internal_notes: `Ingested via Booking.com Two-Way Channel Webhook (${otaReference})`,
        is_ical_imported: true,
        ical_uid: otaReference,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log to ical_sync_logs for audit tracking
    await supabase.from('ical_sync_logs').insert({
      room_id: targetRoom.id,
      sync_type: 'two_way_webhook',
      status: 'success',
      bookings_added: 1,
      bookings_updated: 0,
      bookings_removed: 0,
    })

    return NextResponse.json({
      success: true,
      message: `New reservation ${newRef} created successfully via Two-Way Channel Sync`,
      booking: newBooking,
      action: 'created',
    })
  } catch (err: any) {
    console.error('Channel Manager Webhook Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
