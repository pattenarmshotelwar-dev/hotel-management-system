'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  rooms: Room[]
  onClose: () => void
  onCreated: () => void
}

export default function NewTicketModal({ rooms, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [reportedBy, setReportedBy] = useState('Management')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomId || !title) {
      toast.error('Please select a room and title')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('maintenance_tickets').insert({
      room_id: roomId,
      title,
      description: description || null,
      priority,
      status: 'open',
      reported_by: reportedBy || 'Management',
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Maintenance ticket created!')
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
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Raise Maintenance Ticket</h2>
              <p className="text-xs text-slate-400">Report repairs, faults, or room issues</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Room Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Affected Room *</label>
            <select
              required
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Choose Room --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} (Floor {r.floor} — {r.room_type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Issue Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Title / Category *</label>
            <input
              required
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Shower leak, Broken door handle, TV remote missing"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Priority & Reporter */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="low">Low (Cosmetic)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="high">High (Needs fix before guest arrives)</option>
                <option value="urgent">Urgent (Room out of service)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reported By</label>
              <input
                type="text"
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                placeholder="Management, Duty Manager, Cleaner"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details & Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue, location in room, and any temporary action taken..."
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
              className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Submitting...' : 'Raise Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
