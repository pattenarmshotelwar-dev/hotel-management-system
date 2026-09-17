'use client'

import { useState } from 'react'
import { Booking } from '@/lib/types'
import { sendCleanerWhatsAppMessage } from '@/lib/utils'
import { X, MessageSquare, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  booking: Booking
  onClose: () => void
}

export default function CheckoutWhatsAppPromptModal({ booking, onClose }: Props) {
  const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('patten_cleaner_phone') || '' : ''
  const [phone, setPhone] = useState(savedPhone)
  const roomNumber = (booking as any).room?.room_number ?? '—'
  const roomType = (booking as any).room?.room_type?.replace('_', ' ') ?? 'Room'

  const handleSend = () => {
    if (phone) {
      localStorage.setItem('patten_cleaner_phone', phone)
    }
    sendCleanerWhatsAppMessage({
      phone,
      roomNumber,
      roomType,
      priority: 'Normal',
      notes: `Guest ${booking.guest_first_name} ${booking.guest_last_name} has checked out. Room ready for turnover.`,
    })
    toast.success(`WhatsApp opened for Room ${roomNumber}!`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 text-center border-b border-slate-100 bg-emerald-50/60">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Guest Checked Out!</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Room {roomNumber} is now marked for cleaning.
          </p>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Cleaner Phone Number / WhatsApp Group:
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+44 7700 900123 (or leave blank to select in WhatsApp)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1 font-mono">
            <p className="font-bold text-slate-700">Message to be sent:</p>
            <p>🏨 Patten Arms Hotel — Housekeeping Alert</p>
            <p>🧹 Room {roomNumber} ({roomType})</p>
            <p>📝 Notes: Guest checked out. Ready for turnover.</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
            >
              Skip / Done
            </button>
            <button
              onClick={handleSend}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Cleaners
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
