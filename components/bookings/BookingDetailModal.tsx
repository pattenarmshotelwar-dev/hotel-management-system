'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Payment } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, getBookingStatusColor, getBookingStatusLabel, getBookingSourceLabel, getBookingSourceColor, getPaymentMethodLabel, getPaymentStatusColor, getPaymentStatusLabel, nightCount, getSavedAddonPresets, cn } from '@/lib/utils'
import { X, CreditCard, Banknote, QrCode, Loader2, Plus, ExternalLink, Printer, Receipt, Tag } from 'lucide-react'
import { toast } from 'sonner'
import OfficialInvoiceModal from '@/components/invoices/OfficialInvoiceModal'

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
  const [showIncidentalForm, setShowIncidentalForm] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [addonPresets, setAddonPresets] = useState<any[]>([])

  const [incidentalForm, setIncidentalForm] = useState({
    name: 'Full English Breakfast',
    amount: '10.00',
    notes: '',
  })

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
    setAddonPresets(getSavedAddonPresets())
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

  const handleAddIncidental = async () => {
    const fee = parseFloat(incidentalForm.amount)
    if (isNaN(fee) || fee <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setLoading(true)
    const newTotal = Number(booking.total_amount) + fee
    const incidentalEntry = `[ADDON]: 1x ${incidentalForm.name} (£${fee.toFixed(2)})${incidentalForm.notes ? ` - ${incidentalForm.notes}` : ''}`
    const updatedNotes = [booking.internal_notes, incidentalEntry].filter(Boolean).join('\n')

    const { error } = await supabase
      .from('bookings')
      .update({
        total_amount: newTotal,
        internal_notes: updatedNotes,
      })
      .eq('id', booking.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Added ${incidentalForm.name} (+${formatCurrency(fee)})`)
      setShowIncidentalForm(false)
      setIncidentalForm({ name: 'Full English Breakfast', amount: '10.00', notes: '' })
      booking.total_amount = newTotal
      booking.internal_notes = updatedNotes
      onUpdated()
    }
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

          {/* Add-ons & Incidentals Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Add-ons & Incidentals
                </h3>
              </div>
              {!showIncidentalForm && (
                <button
                  onClick={() => setShowIncidentalForm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Extra / Fee
                </button>
              )}
            </div>

            {/* Existing added items if recorded in internal_notes */}
            {booking.internal_notes && booking.internal_notes.includes('[ADDON') ? (
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Charged Extras:
                </p>
                {booking.internal_notes
                  .split('\n')
                  .filter(l => l.includes('[ADDON'))
                  .map((line, i) => (
                    <div key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{line.replace(/\[ADDON[S]?\]:\s*/g, '')}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No incidental extras added yet.</p>
            )}

            {/* Incidental Adder Form */}
            {showIncidentalForm && (
              <div className="bg-white border border-blue-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800">Add Incidental / Surcharge</h4>
                  <button
                    onClick={() => setShowIncidentalForm(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preset Fast Chips */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Quick Preset Select:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {addonPresets.slice(0, 6).map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setIncidentalForm({
                            name: preset.name,
                            amount: Number(preset.price).toFixed(2),
                            notes: preset.description || '',
                          })
                        }
                        className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition cursor-pointer border border-slate-200"
                      >
                        {preset.name} (£{Number(preset.price).toFixed(0)})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Charge Name</label>
                    <input
                      type="text"
                      value={incidentalForm.name}
                      onChange={e => setIncidentalForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Amount (£)</label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={incidentalForm.amount}
                      onChange={e => setIncidentalForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium text-xs">Optional Reference / Note</label>
                  <input
                    type="text"
                    value={incidentalForm.notes}
                    onChange={e => setIncidentalForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Added at 10:30 by reception"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowIncidentalForm(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddIncidental}
                    disabled={loading}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add & Update Total
                  </button>
                </div>
              </div>
            )}
          </div>

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
                <button
                  onClick={() => setShowInvoice(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" /> Official Invoice
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

      {showInvoice && (
        <OfficialInvoiceModal
          booking={booking}
          payments={payments}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  )
}
