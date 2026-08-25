import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabase = await createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const bookingId = session.metadata?.bookingId
      if (bookingId) {
        // Update payment status
        await supabase.from('payments')
          .update({ status: 'succeeded', stripe_charge_id: session.payment_intent as string })
          .eq('reference_number', session.id)
      }
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const bookingId = pi.metadata?.bookingId
      if (bookingId) {
        await supabase.from('payments')
          .update({ status: 'succeeded', stripe_charge_id: pi.latest_charge as string })
          .eq('stripe_payment_intent_id', pi.id)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      await supabase.from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      await supabase.from('payments')
        .update({ status: 'refunded' })
        .eq('stripe_charge_id', charge.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
