'use client'

import { useState } from 'react'
import { Booking } from '@/lib/types'
import {
  sendCleanerWhatsAppMessage,
  sendGuestWhatsAppMessage,
  generatePostStayReviewWhatsAppText,
} from '@/lib/utils'
import { X, MessageSquare, Send, CheckCircle2, Star, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  booking: Booking
  onClose: () => void
}

export default function CheckoutWhatsAppPromptModal({ booking, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'cleaner' | 'guest_review'>('guest_review')

  const savedCleanerPhone = typeof window !== 'undefined' ? localStorage.getItem('patten_cleaner_phone') || '' : ''
  const [cleanerPhone, setCleanerPhone] = useState(savedCleanerPhone)
  const [guestPhone, setGuestPhone] = useState(booking.guest_phone || '')

  let hotelConfig: any = {}
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('patten_hotel_config')
      if (saved) hotelConfig = JSON.parse(saved)
    } catch (e) {}
  }

  const roomNumber = (booking as any).room?.room_number ?? '—'
  const roomType = (booking as any).room?.room_type?.replace('_', ' ') ?? 'Room'
  const guestFullName = `${booking.guest_first_name} ${booking.guest_last_name}`.trim() || 'Valued Guest'

  const reviewText = generatePostStayReviewWhatsAppText({
    guestName: guestFullName,
    bookingRef: booking.booking_reference,
    hotelConfig,
    customReviewLink: hotelConfig?.googleReviewLink || 'https://g.page/r/pattenarmshotel/review',
  })

  const handleSendCleaner = () => {
    if (cleanerPhone) {
      localStorage.setItem('patten_cleaner_phone', cleanerPhone)
    }
    sendCleanerWhatsAppMessage({
      phone: cleanerPhone,
      roomNumber,
      roomType,
      priority: 'Normal',
      notes: `Guest ${guestFullName} has checked out. Room ready for turnover.`,
    })
    toast.success(`Housekeeping alert opened in WhatsApp!`)
    onClose()
  }

  const handleSendReview = () => {
    sendGuestWhatsAppMessage({
      phone: guestPhone,
      text: reviewText,
    })
    toast.success(`Review request opened in WhatsApp for ${guestFullName}!`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 text-center border-b border-slate-100 bg-emerald-50/60">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Guest Checked Out!</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Room {roomNumber} • {guestFullName} ({booking.booking_reference})
          </p>
        </div>

        {/* Action Choice Tabs */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('guest_review')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'guest_review'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              1. Guest Review Request
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cleaner')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cleaner'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              2. Alert Housekeeping
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {activeTab === 'guest_review' ? (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Guest WhatsApp / Mobile Number:
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="+44 7700 900000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono"
                />
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-slate-700 space-y-1.5">
                <div className="flex items-center gap-1 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Automated 5-Star Review Message:
                </div>
                <p className="font-mono text-[10px] text-slate-600 line-clamp-4">
                  {reviewText}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={handleSendReview}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Star className="w-4 h-4 text-amber-300 fill-amber-300" /> Send Review Request
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cleaner Phone Number / WhatsApp Group:
                </label>
                <input
                  type="tel"
                  value={cleanerPhone}
                  onChange={e => setCleanerPhone(e.target.value)}
                  placeholder="+44 7700 900123 (or leave blank to select in WhatsApp)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1 font-mono">
                <p className="font-bold text-slate-700">Message to be sent:</p>
                <p>🏨 Patten Arms Hotel — Housekeeping Alert</p>
                <p>🧹 Room {roomNumber} ({roomType})</p>
                <p>📝 Notes: Guest {guestFullName} checked out. Ready for turnover.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={handleSendCleaner}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" /> Alert Housekeeping
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

