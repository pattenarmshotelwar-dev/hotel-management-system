'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomType } from '@/lib/types'
import { X, Loader2, BedDouble } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function NewRoomModal({ onClose, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [roomNumber, setRoomNumber] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('double')
  const [floor, setFloor] = useState(1)
  const [basePrice, setBasePrice] = useState('65')
  const [maxAdults, setMaxAdults] = useState(2)
  const [maxChildren, setMaxChildren] = useState(1)
  const [description, setDescription] = useState('')

  const handleRoomTypeChange = (type: RoomType) => {
    setRoomType(type)
    if (type === 'single') {
      setMaxAdults(1)
      setMaxChildren(0)
      setBasePrice('50')
    } else if (type === 'double') {
      setMaxAdults(2)
      setMaxChildren(1)
      setBasePrice('65')
    } else if (type === 'twin_single') {
      setMaxAdults(2)
      setMaxChildren(1)
      setBasePrice('70')
    } else if (type === 'family') {
      setMaxAdults(3)
      setMaxChildren(2)
      setBasePrice('95')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomNumber.trim()) {
      toast.error('Please enter a room number')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('rooms').insert({
      room_number: roomNumber.trim(),
      room_type: roomType,
      floor: Number(floor),
      base_price: parseFloat(basePrice) || 0,
      max_adults: Number(maxAdults),
      max_children: Number(maxChildren),
      description: description.trim() || null,
      status: 'available',
      cleaning_status: 'clean',
      is_active: true,
      currency: 'GBP',
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Room ${roomNumber} created successfully!`)
      onCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <BedDouble className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Add New Room</h2>
              <p className="text-xs text-slate-400">Configure new hotel room inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number *</label>
              <input
                required
                type="text"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                placeholder="e.g. 101, 204"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor *</label>
              <input
                required
                type="number"
                min="0"
                max="10"
                value={floor}
                onChange={e => setFloor(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Type *</label>
              <select
                value={roomType}
                onChange={e => handleRoomTypeChange(e.target.value as RoomType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="twin_single">Twin Single</option>
                <option value="family">Family</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Base Price / Night (£) *</label>
              <input
                required
                type="number"
                step="0.01"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Adults</label>
              <input
                type="number"
                min="1"
                max="6"
                value={maxAdults}
                onChange={e => setMaxAdults(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Children</label>
              <input
                type="number"
                min="0"
                max="4"
                value={maxChildren}
                onChange={e => setMaxChildren(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Room Description / Features</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. En-suite, street view, double bed"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
