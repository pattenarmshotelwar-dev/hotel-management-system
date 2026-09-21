import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Staff login required' }, { status: 401 })
    }

    const { bookingId, amount, guestName, guestEmail, description } = await request.json()

    const numAmount = parseFloat(amount)
    if (!bookingId || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Valid bookingId and positive amount are required' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey === 'sk_test_placeholder') {
      return NextResponse.json({ error: 'Stripe is not configured in this environment' }, { status: 503 })
    }

    const stripe = new Stripe(stripeKey)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hotel-management-system-one-lovat.vercel.app'
    const supabase: any = await createAdminClient()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Hotel Stay — ${description || 'Reservation'}`,
              description: `Guest: ${guestName || 'Valued Guest'}`,
            },
            unit_amount: Math.round(numAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: guestEmail ?? undefined,
      metadata: { bookingId },
      success_url: `${appUrl}/admin/bookings?payment=success`,
      cancel_url: `${appUrl}/admin/bookings`,
    })

    // Create pending payment record
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount: numAmount,
      currency: 'GBP',
      method: 'stripe_link',
      status: 'pending',
      reference_number: session.id,
      notes: `Stripe Checkout: ${session.id}`,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment link creation failed' }, { status: 500 })
  }
}
