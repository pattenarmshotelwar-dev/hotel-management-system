import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')
  const { bookingId, amount, guestName, guestEmail, description } = await request.json()

  const supabase: any = await createAdminClient()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Hotel Stay — ${description}`,
            description: `Guest: ${guestName}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: guestEmail ?? undefined,
    metadata: { bookingId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/bookings?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/bookings`,
  })

  // Create pending payment record
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount,
    currency: 'GBP',
    method: 'stripe_link',
    status: 'pending',
    reference_number: session.id,
    notes: `Stripe Checkout: ${session.id}`,
  })

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
