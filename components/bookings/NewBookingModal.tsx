'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { formatCurrency, nightCount, getSavedAddonPresets, cn } from '@/lib/utils'
import { X, Loader2, Calendar, Plus, Check } from 'lucide-react'
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
  const [addonPresets, setAddonPresets] = useState<any[]>([])
  const [selectedAddons, setSelectedAddons] = useState<Record<string, { name: string; price: number; quantity: number }>>({})

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

  // Load add-on presets on mount
  useState(() => {
    setAddonPresets(getSavedAddonPresets())
  })

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const nights = form.check_in_date && form.check_out_date ? nightCount(form.check_in_date, form.check_out_date) : 0

  const calculateTotal = (roomId: string, inDate: string, outDate: string, addons = selectedAddons) => {
    const room = rooms.find(r => r.id === roomId)
    const n = inDate && outDate ? nightCount(inDate, outDate) : 0
    const roomSubtotal = room && n > 0 ? room.base_price * n : 0
    const addonsTotal = Object.values(addons).reduce((sum, item) => sum + (item.price * item.quantity), 0)
    return String(roomSubtotal + addonsTotal)
  }

  const handleRoomSelect = (roomId: string) => {
    setForm(f => ({
      ...f,
      room_id: roomId,
      total_amount: calculateTotal(roomId, f.check_in_date, f.check_out_date, selectedAddons)
    }))
  }

  const handleDateChange = (field: 'check_in_date' | 'check_out_date', value: string) => {
    setForm(f => {
      const inDate = field === 'check_in_date' ? value : f.check_in_date
      const outDate = field === 'check_out_date' ? value : f.check_out_date
      return {
        ...f,
        [field]: value,
        total_amount: calculateTotal(f.room_id, inDate, outDate, selectedAddons)
      }
    })
  }

  const toggleAddon = (preset: any) => {
    setSelectedAddons(prev => {
      const next = { ...prev }
      if (next[preset.id]) {
        delete next[preset.id]
      } else {
        next[preset.id] = { name: preset.name, price: Number(preset.price), quantity: 1 }
      }
      setForm(f => ({
        ...f,
        total_amount: calculateTotal(f.room_id, f.check_in_date, f.check_out_date, next)
      }))
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.room_id) { toast.error('Please select a room'); return }
    if (nights <= 0) { toast.error('Check-out must be after check-in'); return }

    setLoading(true)

    // Build add-on summary string to store in internal_notes or special_requests
    const addonList = Object.values(selectedAddons)
    const addonSummary = addonList.length > 0 
      ? `[ADDONS]: ` + addonList.map(a => `${a.quantity}x ${a.name} (£${(a.price * a.quantity).toFixed(2)})`).join(', ')
      : ''
    const combinedNotes = [form.internal_notes, addonSummary].filter(Boolean).join('\n')

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
      internal_notes: combinedNotes || null,
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

              {/* Add-ons & Extras Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    🛎️ Add-ons & Incidentals (Optional)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {Object.keys(selectedAddons).length} selected (+£
                    {Object.values(selectedAddons)
                      .reduce((s, a) => s + a.price * a.quantity, 0)
                      .toFixed(2)}
                    )
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {addonPresets.map(preset => {
                    const isSelected = !!selectedAddons[preset.id]
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => toggleAddon(preset)}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer',
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold truncate">{preset.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{preset.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold font-mono">
                            +£{Number(preset.price).toFixed(2)}
                          </span>
                          <div
                            className={cn(
                              'w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold',
                              isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                            )}
                          >
                            {isSelected && '✓'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
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
