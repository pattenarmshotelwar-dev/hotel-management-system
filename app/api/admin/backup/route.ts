import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Management session required' }, { status: 401 })
    }

    const userEmail = user.email?.toLowerCase() || ''
    if (userEmail.startsWith('frontdesk') || userEmail.startsWith('housekeeping')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required for database export' }, { status: 403 })
    }

    const adminSupabase: any = await createAdminClient()

    // Fetch all core operational tables in parallel
    const [
      { data: rooms, error: errRooms },
      { data: bookings, error: errBookings },
      { data: guests, error: errGuests },
      { data: payments, error: errPayments },
      { data: cleaningLogs, error: errCleaning },
      { data: tickets, error: errTickets },
      { data: icalLogs, error: errIcal },
    ] = await Promise.all([
      adminSupabase.from('rooms').select('*').order('room_number'),
      adminSupabase.from('bookings').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('guests').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('payments').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('cleaning_logs').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('maintenance_tickets').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('ical_sync_logs').select('*').order('synced_at', { ascending: false }).limit(50),
    ])

    const backupPayload = {
      hotel: 'The Patten Arms Hotel',
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      version: '1.0',
      record_counts: {
        rooms: rooms?.length || 0,
        bookings: bookings?.length || 0,
        guests: guests?.length || 0,
        payments: payments?.length || 0,
        cleaning_logs: cleaningLogs?.length || 0,
        maintenance_tickets: tickets?.length || 0,
        ical_sync_logs: icalLogs?.length || 0,
      },
      data: {
        rooms: rooms || [],
        bookings: bookings || [],
        guests: guests || [],
        payments: payments || [],
        cleaning_logs: cleaningLogs || [],
        maintenance_tickets: tickets || [],
        ical_sync_logs: icalLogs || [],
      },
      errors: {
        rooms: errRooms?.message,
        bookings: errBookings?.message,
        guests: errGuests?.message,
        payments: errPayments?.message,
        cleaning: errCleaning?.message,
        tickets: errTickets?.message,
        ical: errIcal?.message,
      },
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
    const jsonString = JSON.stringify(backupPayload, null, 2)

    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="patten-arms-backup-${timestamp}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Backup export failed' }, { status: 500 })
  }
}
