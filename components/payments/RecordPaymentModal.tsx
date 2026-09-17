'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { X, Loader2, CreditCard, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  bookings: Booking[]
  onClose: () => void
  onCreated: () => void
}

export default function RecordPaymentModal({ bookings, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [searchBooking, setSearchBooking] = useState('')
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'stripe_card' | 'bank_transfer' | 'booking_com_payout' | 'booking_com_vcc'>('cash')
  const [status, setStatus] = useState<'succeeded' | 'pending'>('succeeded')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')

  // Filter bookings for selection
  const matchingBookings = bookings.filter(b => {
    if (!searchBooking) return true
    const term = searchBooking.toLowerCase()
    const guest = `${b.guest_first_name} ${b.guest_last_name}`.toLowerCase()
    const ref = b.booking_reference.toLowerCase()
    const room = ((b as any).room?.room_number ?? '').toString()
    return guest.includes(term) || ref.includes(term) || room.includes(term)
  }).slice(0, 10)

  const selectedBooking = bookings.find(b => b.id === selectedBookingId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBookingId) {
      toast.error('Please select a booking to apply payment to')
      return
    }
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('payments').insert({
      booking_id: selectedBookingId,
      amount: numAmount,
      currency: 'GBP',
      method,
      status,
      reference_number: referenceNumber || null,
      notes: notes || null,
      recorded_by: 'Reception Desk',
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Payment successfully recorded!')
      onCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-green-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Record Payment</h2>
              <p className="text-xs text-slate-400">Add cash, card, or bank transfer payment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Booking Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Booking / Guest *
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search guest name, room number, or ref..."
                value={searchBooking}
                onChange={e => setSearchBooking(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              required
              value={selectedBookingId}
              onChange={e => {
                const bId = e.target.value
                setSelectedBookingId(bId)
                const found = bookings.find(b => b.id === bId)
                if (found) {
                  setAmount(String(found.total_amount))
                }
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Choose matching reservation --</option>
              {matchingBookings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.booking_reference} — {b.guest_first_name} {b.guest_last_name} (Room {(b as any).room?.room_number ?? 'N/A'}) — Total: {formatCurrency(b.total_amount)}
                </option>
              ))}
            </select>
          </div>

          {selectedBooking && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs flex justify-between items-center text-blue-900">
              <div>
                <p className="font-semibold">{selectedBooking.guest_first_name} {selectedBooking.guest_last_name}</p>
                <p className="text-[11px] text-blue-600">Room {(selectedBooking as any).room?.room_number ?? 'Unassigned'}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Total Bill</span>
                <p className="font-bold text-sm text-blue-700">{formatCurrency(selectedBooking.total_amount)}</p>
              </div>
            </div>
          )}

          {/* Amount & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (£) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="stripe_card">Card (In-Person / Stripe)</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="booking_com_payout">Booking.com Payout</option>
                <option value="booking_com_vcc">Booking.com VCC</option>
              </select>
            </div>
          </div>

          {/* Status & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="succeeded">Paid / Succeeded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Card Last 4</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="e.g. Card 4242 or Txn ID"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Received at reception, deposit paid, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
