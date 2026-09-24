'use client'

import { useState } from 'react'
import { Room } from '@/lib/types'
import { sendCleanerWhatsAppMessage } from '@/lib/utils'
import { X, MessageSquare, Send, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getSavedWhatsAppSettings, formatWhatsAppTemplate, createWhatsAppDispatchUrl } from '@/lib/whatsapp'

interface Props {
  room: Room
  hasArrivalToday?: boolean
  onClose: () => void
}

export default function WhatsAppAlertModal({ room, hasArrivalToday = false, onClose }: Props) {
  const waSettings = getSavedWhatsAppSettings()
  const initialPhone = waSettings.cleanerPhone || (typeof window !== 'undefined' ? localStorage.getItem('patten_cleaner_phone') || '' : '')
  const [phone, setPhone] = useState(initialPhone)
  const [priority, setPriority] = useState<'Normal' | 'Urgent (Arrival Today)' | 'Guest Request'>(
    hasArrivalToday ? 'Urgent (Arrival Today)' : 'Normal'
  )
  const [notes, setNotes] = useState(hasArrivalToday ? 'Guest arriving today — please prioritize turnover' : 'Standard room turnover')

  const handleSend = () => {
    if (phone) {
      localStorage.setItem('patten_cleaner_phone', phone)
    }
    const tplObj = waSettings.templates.find(t => t.id === 'tpl_cleaner_turnover')
    if (tplObj && tplObj.template) {
      const vars = {
        room_number: room.room_number,
        room_type: room.room_type.replace('_', ' '),
        floor: String(room.floor),
        urgency_level: priority,
        cleaning_portal_link: typeof window !== 'undefined' ? `${window.location.origin}/housekeeping` : 'https://hotel-management-system-one-lovat.vercel.app/housekeeping',
      }
      const text = formatWhatsAppTemplate(tplObj.template, vars)
      const url = createWhatsAppDispatchUrl(phone, text, waSettings.defaultCountryCode)
      window.open(url, '_blank')
    } else {
      sendCleanerWhatsAppMessage({
        phone,
        roomNumber: room.room_number,
        roomType: room.room_type.replace('_', ' '),
        floor: room.floor,
        priority,
        notes,
      })
    }
    toast.success(`WhatsApp opened for Room ${room.room_number}!`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-emerald-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Dispatch WhatsApp to Cleaners</h2>
              <p className="text-xs text-slate-500">Alert housekeeping team for Room {room.room_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Room Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm text-slate-800">Room {room.room_number}</span>
              <p className="text-[11px] text-slate-400 capitalize">Floor {room.floor} · {room.room_type.replace('_', ' ')}</p>
            </div>
            {hasArrivalToday ? (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                🚨 Arrival Today
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                Turnover Needed
              </span>
            )}
          </div>

          {/* Cleaner Phone Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Cleaner Phone Number / WhatsApp Group
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+44 7700 900123 (or leave blank to choose in WhatsApp)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tip: Number is remembered for future dispatches. Leaving blank lets you pick any chat or group in WhatsApp.
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Turnover Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-xs font-semibold text-slate-700"
            >
              <option value="Normal">Normal Turnover</option>
              <option value="Urgent (Arrival Today)">🚨 Urgent (Guest Arrives Today)</option>
              <option value="Guest Request">Guest Request (Towels / Refresh)</option>
            </select>
          </div>

          {/* Special Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Instructions / Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none text-xs"
              placeholder="e.g. Extra pillows requested, double bed setup, etc."
            />
          </div>

          {/* Message Preview */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-950 font-mono space-y-1">
            <p className="font-bold">Message Preview:</p>
            <p>🏨 Patten Arms Hotel — Housekeeping Alert</p>
            <p>🧹 Room {room.room_number} (Floor {room.floor} — {room.room_type.replace('_', ' ')})</p>
            <p>⚡ Priority: {priority}</p>
            {notes && <p>📝 Notes: {notes}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
