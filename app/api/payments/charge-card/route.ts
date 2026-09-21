import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Staff login required' }, { status: 401 })
    }

    const { bookingId, amount, paymentMethodId, guestEmail, description } = await request.json()

    const numAmount = parseFloat(amount)
    if (!bookingId || isNaN(numAmount) || numAmount <= 0 || !paymentMethodId) {
      return NextResponse.json({ success: false, error: 'Valid bookingId, paymentMethodId, and positive amount are required' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey === 'sk_test_placeholder') {
      return NextResponse.json({ success: false, error: 'Stripe is not configured in this environment' }, { status: 503 })
    }

    const stripe = new Stripe(stripeKey)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hotel-management-system-one-lovat.vercel.app'
    const supabase: any = await createAdminClient()

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(numAmount * 100),
      currency: 'gbp',
      payment_method: paymentMethodId,
      confirm: true,
      receipt_email: guestEmail ?? undefined,
      description: description ?? `Hotel booking ${bookingId}`,
      metadata: { bookingId },
      return_url: `${appUrl}/admin/bookings`,
    })

    // Record payment
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount: numAmount,
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
