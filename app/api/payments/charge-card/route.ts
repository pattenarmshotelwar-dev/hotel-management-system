import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')
  const { bookingId, amount, paymentMethodId, guestEmail, description } = await request.json()

  const supabase: any = await createAdminClient()

  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'gbp',
      payment_method: paymentMethodId,
      confirm: true,
      receipt_email: guestEmail ?? undefined,
      description: description ?? `Hotel booking ${bookingId}`,
      metadata: { bookingId },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/bookings`,
    })

    // Record payment
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount,
      currency: 'GBP',
      method: 'stripe_card',
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: paymentIntent.latest_charge as string ?? null,
      notes: `Card charge via PMS dashboard`,
    })

    return NextResponse.json({ success: true, paymentIntentId: paymentIntent.id, status: paymentIntent.status })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}
