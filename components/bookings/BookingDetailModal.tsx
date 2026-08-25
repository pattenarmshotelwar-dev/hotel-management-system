'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Payment } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, getBookingStatusColor, getBookingStatusLabel, getBookingSourceLabel, getBookingSourceColor, getPaymentMethodLabel, getPaymentStatusColor, getPaymentStatusLabel, nightCount, cn } from '@/lib/utils'
import { X, CreditCard, Banknote, QrCode, Loader2, Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  booking: Booking
  onClose: () => void
  onUpdated: () => void
}

export default function BookingDetailModal({ booking, onClose, onUpdated }: Props) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: String(booking.total_amount),
    method: 'cash',
    notes: '',
    reference_number: '',
  })
  const [generatingLink, setGeneratingLink] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    const { data } = await supabase.from('payments').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false })
    setPayments(data ?? [])
  }

  const totalPaid = payments.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0)
  const balance = booking.total_amount - totalPaid

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Status updated')
    onUpdated()
  }

  const handleRecordPayment = async () => {
    setLoading(true)
    const { error } = await supabase.from('payments').insert({
      booking_id: booking.id,
      amount: parseFloat(paymentForm.amount),
      currency: 'GBP',
      method: paymentForm.method as any,
      status: 'succeeded',
      notes: paymentForm.notes || null,
      reference_number: paymentForm.reference_number || null,
      recorded_by: 'Management',
    })
    if (error) { toast.error(error.message) }
    else { toast.success('Payment recorded'); setShowPaymentForm(false); fetchPayments() }
    setLoading(false)
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/payments/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          amount: booking.total_amount,
          guestName: `${booking.guest_first_name} ${booking.guest_last_name}`,
          guestEmail: booking.guest_email,
          description: `Room ${booking.booking_reference} — ${nightCount(booking.check_in_date, booking.check_out_date)} nights`,
        }),
      })
      const data = await res.json()
      if (data.url) {
        setPaymentLink(data.url)
        toast.success('Payment link created!')
      } else {
        toast.error('Failed to create link')
      }
    } catch {
      toast.error('Error creating payment link')
    }
    setGeneratingLink(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{booking.guest_first_name} {booking.guest_last_name}</h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{booking.booking_reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-3 py-1.5 rounded-full', getBookingStatusColor(booking.status))}>
              {getBookingStatusLabel(booking.status)}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Booking Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-slate-400 text-xs">Check-in</p><p className="font-semibold mt-0.5">{formatDate(booking.check_in_date)}</p></div>
            <div><p className="text-slate-400 text-xs">Check-out</p><p className="font-semibold mt-0.5">{formatDate(booking.check_out_date)}</p></div>
            <div><p className="text-slate-400 text-xs">Nights</p><p className="font-semibold mt-0.5">{nightCount(booking.check_in_date, booking.check_out_date)}</p></div>
            <div><p className="text-slate-400 text-xs">Guests</p><p className="font-semibold mt-0.5">{booking.adults} Adults, {booking.children} Children</p></div>
            <div><p className="text-slate-400 text-xs">Source</p><span className={cn('text-white text-xs px-2 py-0.5 rounded-full inline-block mt-0.5', getBookingSourceColor(booking.source))}>{getBookingSourceLabel(booking.source)}</span></div>
            <div><p className="text-slate-400 text-xs">Total</p><p className="font-bold text-green-600 mt-0.5">{formatCurrency(booking.total_amount)}</p></div>
            {booking.guest_email && <div><p className="text-slate-400 text-xs">Email</p><p className="font-medium mt-0.5">{booking.guest_email}</p></div>}
            {booking.guest_phone && <div><p className="text-slate-400 text-xs">Phone</p><p className="font-medium mt-0.5">{booking.guest_phone}</p></div>}
            {booking.guest_country && <div><p className="text-slate-400 text-xs">Country</p><p className="font-medium mt-0.5">{booking.guest_country}</p></div>}
            {booking.booking_com_reference && <div><p className="text-slate-400 text-xs">Booking.com Ref</p><p className="font-mono font-medium mt-0.5">{booking.booking_com_reference}</p></div>}
            {booking.estimated_arrival_time && <div><p className="text-slate-400 text-xs">Est. Arrival</p><p className="font-medium mt-0.5">{booking.estimated_arrival_time}</p></div>}
          </div>

          {booking.special_requests && (
            <div className="bg-yellow-50 rounded-xl p-3 text-sm border border-yellow-200">
              <p className="text-yellow-800 font-semibold text-xs mb-1">Special Requests</p>
              <p className="text-yellow-700">{booking.special_requests}</p>
            </div>
          )}

          {/* Status Actions */}
          {(booking.status === 'confirmed' || booking.status === 'checked_in') && (
            <div className="flex gap-2 flex-wrap">
              {booking.status === 'confirmed' && (
                <button onClick={() => handleStatusChange('checked_in')} className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-500 transition">
                  ✓ Check In
                </button>
              )}
              {booking.status === 'checked_in' && (
                <button onClick={() => handleStatusChange('checked_out')} className="flex-1 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-500 transition">
                  ↑ Check Out
                </button>
              )}
              <button onClick={() => handleStatusChange('no_show')} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-300 transition">
                No Show
              </button>
              <button onClick={() => handleStatusChange('cancelled')} className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-200 transition">
                Cancel
              </button>
            </div>
          )}

          {/* Payments Summary */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Payments</h3>
              <div className="text-sm">
                <span className="text-slate-400">Balance: </span>
                <span className={cn('font-bold', balance > 0 ? 'text-red-600' : 'text-green-600')}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="space-y-2 mb-3">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{getPaymentMethodLabel(p.method)}</span>
                      </div>
                      {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', getPaymentStatusColor(p.status))}>
                      {getPaymentStatusLabel(p.status)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(p.created_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {!showPaymentForm ? (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-xl hover:bg-slate-700 transition">
                  <Plus className="w-3.5 h-3.5" /> Record Payment
                </button>
                <button onClick={handleGenerateLink} disabled={generatingLink} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-500 transition disabled:opacity-50">
                  {generatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Stripe Payment Link
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold">Record Payment</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Amount (£)</label>
                    <input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Method</label>
                    <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="stripe_card">Card (Stripe)</option>
                      <option value="booking_com_payout">Booking.com Payout</option>
                      <option value="booking_com_vcc">Booking.com VCC</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Reference / Notes</label>
                  <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Transaction ref, bank transfer ID, etc." />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-100">Cancel</button>
                  <button onClick={handleRecordPayment} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Payment
                  </button>
                </div>
              </div>
            )}

            {paymentLink && (
              <div className="mt-3 bg-green-50 rounded-xl p-3 text-sm border border-green-200">
                <p className="text-green-800 font-semibold mb-1">Payment Link Ready</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={paymentLink} className="flex-1 bg-white border border-green-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                  <button onClick={() => { navigator.clipboard.writeText(paymentLink); toast.success('Copied!') }}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500">Copy</button>
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
