import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Management session required' }, { status: 401 })
    }

    const userEmail = user?.email?.toLowerCase() || ''
    const isDev = userEmail.startsWith('dev') || userEmail.includes('uvdigital')
    const isRestricted = userEmail.startsWith('frontdesk') || userEmail.startsWith('foh') || userEmail.startsWith('info') || userEmail.startsWith('housekeeping') || userEmail.startsWith('clean') || userEmail.startsWith('bookings')
    if (isRestricted && !isDev) {
      return NextResponse.json({ error: 'Only administrators can delete rooms' }, { status: 403 })
    }

    const body = await request.json()
    const { roomId, force = false } = body

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    const adminSupabase: any = await createAdminClient()

    // 1. Fetch room details
    const { data: room, error: roomError } = await adminSupabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 2. Check for linked bookings
    const { data: linkedBookings, error: bookingsErr } = await adminSupabase
      .from('bookings')
      .select('id, booking_reference, guest_first_name, guest_last_name, status, check_in_date, check_out_date')
      .eq('room_id', roomId)

    const hasBookings = (linkedBookings?.length ?? 0) > 0

    if (hasBookings && !force) {
      return NextResponse.json({
        error: `Room ${room.room_number} is linked to ${linkedBookings?.length} booking(s). You can toggle the room inactive instead, or confirm force delete to remove the room and its linked records.`,
        hasBookings: true,
        bookingsCount: linkedBookings?.length ?? 0,
        roomNumber: room.room_number,
      }, { status: 409 })
    }

    // 3. If force delete requested and bookings exist, delete bookings first
    if (hasBookings && force) {
      const bookingIds = linkedBookings.map((b: any) => b.id)
      // Delete payments
      await adminSupabase.from('payments').delete().in('booking_id', bookingIds)
      // Delete bookings
      await adminSupabase.from('bookings').delete().in('id', bookingIds)
    }

    // 4. Delete associated logs and tickets
    await adminSupabase.from('cleaning_logs').delete().eq('room_id', roomId)
    await adminSupabase.from('maintenance_tickets').delete().eq('room_id', roomId)
    await adminSupabase.from('ical_sync_logs').delete().eq('room_id', roomId)

    // 5. Delete room
    const { error: delError } = await adminSupabase
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (delError) {
      console.error('Error deleting room:', delError)
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Room ${room.room_number} has been permanently deleted from inventory.`,
      deletedRoom: room,
    })
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/rooms:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
