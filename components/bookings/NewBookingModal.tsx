'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { formatCurrency, nightCount } from '@/lib/utils'
import { X, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Props {
  rooms: Room[]
  onClose: () => void
  onCreated: () => void
}

const COUNTRIES = ['United Kingdom', 'United States', 'Ireland', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Australia', 'Canada', 'India', 'China', 'Japan', 'UAE', 'Saudi Arabia', 'Other']

export default function NewBookingModal({ rooms, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    room_id: '',
    guest_first_name: '',
    guest_last_name: '',
    guest_email: '',
    guest_phone: '',
    guest_country: 'United Kingdom',
    check_in_date: '',
    check_out_date: '',
    estimated_arrival_time: '',
    adults: 1,
    children: 0,
    total_amount: '',
    source: 'walk_in',
    special_requests: '',
    internal_notes: '',
    is_maintenance_block: false,
    maintenance_reason: '',
  })

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const nights = form.check_in_date && form.check_out_date ? nightCount(form.check_in_date, form.check_out_date) : 0

  const handleRoomSelect = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    setForm(f => ({
      ...f,
      room_id: roomId,
      total_amount: room && nights > 0 ? String(room.base_price * nights) : f.total_amount
    }))
  }

  const handleDateChange = (field: 'check_in_date' | 'check_out_date', value: string) => {
    setForm(f => {
      const updated = { ...f, [field]: value }
      const n = updated.check_in_date && updated.check_out_date ? nightCount(updated.check_in_date, updated.check_out_date) : 0
      const room = rooms.find(r => r.id === f.room_id)
      return { ...updated, total_amount: room && n > 0 ? String(room.base_price * n) : f.total_amount }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.room_id) { toast.error('Please select a room'); return }
    if (nights <= 0) { toast.error('Check-out must be after check-in'); return }

    setLoading(true)
    const { error } = await supabase.from('bookings').insert({
      room_id: form.room_id,
      guest_first_name: form.guest_first_name,
      guest_last_name: form.guest_last_name,
      guest_email: form.guest_email || null,
      guest_phone: form.guest_phone || null,
      guest_country: form.guest_country || null,
      check_in_date: form.check_in_date,
      check_out_date: form.check_out_date,
      estimated_arrival_time: form.estimated_arrival_time || null,
      adults: form.adults,
      children: form.children,
      total_amount: parseFloat(form.total_amount) || 0,
      currency: 'GBP',
      source: form.source as any,
      status: 'confirmed',
      special_requests: form.special_requests || null,
      internal_notes: form.internal_notes || null,
      is_maintenance_block: form.is_maintenance_block,
      maintenance_reason: form.is_maintenance_block ? form.maintenance_reason : null,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Booking created successfully!')
      onCreated()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">New Booking</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Maintenance Block Toggle */}
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
            <input
              type="checkbox"
              id="maintenance"
              checked={form.is_maintenance_block}
              onChange={e => setForm(f => ({ ...f, is_maintenance_block: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="maintenance" className="text-sm font-medium text-orange-800">
              🔧 Maintenance / Out of Service Block (no guest)
            </label>
          </div>

          {/* Room & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Room *</label>
              <select
                required
                value={form.room_id}
                onChange={e => handleRoomSelect(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select room...</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} — {r.room_type.replace('_', ' ')} (£{r.base_price}/night)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-in *</label>
              <input
                type="date"
                required
                value={form.check_in_date}
                onChange={e => handleDateChange('check_in_date', e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-out *</label>
              <input
                type="date"
                required
                value={form.check_out_date}
                onChange={e => handleDateChange('check_out_date', e.target.value)}
                min={form.check_in_date || format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {nights > 0 && selectedRoom && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800 font-medium">
              📅 {nights} night{nights > 1 ? 's' : ''} — Default rate: {formatCurrency(selectedRoom.base_price * nights)}
            </div>
          )}

          {!form.is_maintenance_block && (
            <>
              {/* Guest Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Guest Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">First Name *</label>
                    <input required type="text" value={form.guest_first_name} onChange={e => setForm(f => ({ ...f, guest_first_name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Last Name *</label>
                    <input required type="text" value={form.guest_last_name} onChange={e => setForm(f => ({ ...f, guest_last_name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Smith" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Email</label>
                    <input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Phone</label>
                    <input type="tel" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+44 7700 900000" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Country</label>
                    <select value={form.guest_country} onChange={e => setForm(f => ({ ...f, guest_country: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Estimated Arrival Time</label>
                    <input type="time" value={form.estimated_arrival_time} onChange={e => setForm(f => ({ ...f, estimated_arrival_time: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Guests count & financials */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Adults *</label>
                  <input type="number" min="1" max="10" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Children</label>
                  <input type="number" min="0" max="10" value={form.children} onChange={e => setForm(f => ({ ...f, children: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="walk_in">Walk-in</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Total Amount (£) *</label>
                  <input required type="number" step="0.01" min="0" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Special Requests</label>
                  <textarea rows={2} value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Late check-in, extra pillows, etc." />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Internal Notes</label>
                  <textarea rows={2} value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Management notes (not shown to guest)" />
                </div>
              </div>
            </>
          )}

          {form.is_maintenance_block && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Reason</label>
              <textarea rows={2} value={form.maintenance_reason} onChange={e => setForm(f => ({ ...f, maintenance_reason: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Deep cleaning, broken TV, painting, etc." />
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
