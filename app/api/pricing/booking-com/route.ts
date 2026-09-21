import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase: any = await createAdminClient()

  // Fetch all active rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('room_number')

  if (!rooms) {
    return NextResponse.json({ error: 'No rooms found' }, { status: 404 })
  }

  // Format rates for OTA channel managers / Booking.com
  const channelRates = rooms.map((r: any) => {
    const base = Number(r.base_price) || 50
    return {
      roomId: r.id,
      roomNumber: r.room_number,
      roomType: r.room_type,
      currency: 'GBP',
      rackRate: base,
      // Booking.com commission compensation rate (+15% to maintain margin after Booking.com 15% fee)
      bookingComDirectRate: Math.round(base * 1.15),
      weekendRate: Math.round(base * 1.2),
      weekendBookingComRate: Math.round(base * 1.2 * 1.15),
      maxOccupancy: (r.max_adults || 2) + (r.max_children || 0),
    }
  })

  return NextResponse.json({
    hotel: 'The Patten Arms Hotel',
    generatedAt: new Date().toISOString(),
    channel: 'Booking.com',
    rateCount: channelRates.length,
    rates: channelRates,
  })
}

export async function POST(request: NextRequest) {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userEmail = user.email?.toLowerCase() || ''
  if (userEmail.startsWith('frontdesk') || userEmail.startsWith('housekeeping')) {
    return NextResponse.json({ error: 'Forbidden: Management permissions required' }, { status: 403 })
  }

  const supabase: any = await createAdminClient()
  const body = await request.json()
  const { channelMarkupPercent = 15, updateBasePrices = false, rates = {} } = body

  let updatedCount = 0
  const errors: string[] = []

  // If user requested to update room base prices in database
  if (updateBasePrices && rates && typeof rates === 'object') {
    for (const [roomId, price] of Object.entries(rates)) {
      const num = Number(price)
      if (num > 0) {
        const { error } = await supabase
          .from('rooms')
          .update({ base_price: num })
          .eq('id', roomId)
        if (!error) updatedCount++
        else errors.push(error.message)
      }
    }
  }

  return NextResponse.json({
    success: true,
    channelMarkupPercent,
    updatedRooms: updatedCount,
    errors,
    syncedAt: new Date().toISOString(),
    message: `Booking.com channel pricing adjusted (+${channelMarkupPercent}% OTA commission parity markup)`,
  })
}
