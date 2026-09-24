'use client'

import { useState, useEffect } from 'react'
import { Booking } from '@/lib/types'
import {
  formatDate,
  sendGuestWhatsAppMessage,
  generateBookingConfirmationWhatsAppText,
  generatePostStayReviewWhatsAppText,
} from '@/lib/utils'
import { X, MessageSquare, Send, CheckCircle2, Copy, Star, Calendar, RefreshCw, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { getSavedWhatsAppSettings, formatWhatsAppTemplate, createWhatsAppDispatchUrl } from '@/lib/whatsapp'

interface Props {
  booking: Booking
  defaultType?: 'confirmation' | 'wifi' | 'review'
  onClose: () => void
}

export default function WhatsAppMessageModal({ booking, defaultType = 'confirmation', onClose }: Props) {
  const [messageType, setMessageType] = useState<'confirmation' | 'wifi' | 'review'>(defaultType)
  const [guestPhone, setGuestPhone] = useState(booking.guest_phone || '')
  const [customText, setCustomText] = useState('')
  const [copied, setCopied] = useState(false)
  const [hotelConfig, setHotelConfig] = useState<any>({})

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('patten_hotel_config')
      if (savedConfig) {
        setHotelConfig(JSON.parse(savedConfig))
      }
    } catch (e) {}
  }, [])

  const roomNumber = (booking as any).room?.room_number ?? 'Assigned at check-in'
  const roomType = (booking as any).room?.room_type?.replace('_', ' ') ?? 'Room'
  const guestFullName = `${booking.guest_first_name} ${booking.guest_last_name}`.trim() || 'Valued Guest'

  // Regenerate message template from configured settings when type or hotel config changes
  useEffect(() => {
    const waSettings = getSavedWhatsAppSettings()
    const templateIdMap: Record<'confirmation' | 'wifi' | 'review', string> = {
      confirmation: 'tpl_booking_confirm',
      wifi: 'tpl_checkin_wifi',
      review: 'tpl_checkout_review',
    }

    const tplObj = waSettings.templates.find(t => t.id === templateIdMap[messageType])
    
    const vars = {
      guest_name: guestFullName,
      booking_reference: booking.booking_reference,
      room_number: roomNumber !== 'Assigned at check-in' ? `${roomNumber}` : 'Assigned upon arrival',
      room_type: roomType,
      check_in_date: formatDate(booking.check_in_date),
      check_out_date: formatDate(booking.check_out_date),
      check_in_time: hotelConfig?.checkInTime || '15:00',
      check_out_time: hotelConfig?.checkOutTime || '11:00',
      total_amount: Number(booking.total_amount)?.toFixed(2) || '0.00',
      wifi_network: hotelConfig?.wifiNetwork || 'Patten_Guest_WiFi',
      wifi_password: hotelConfig?.wifiPassword || 'PattenArmsWelcome',
      hotel_phone: hotelConfig?.phone || '+44 1925 650144',
      hotel_address: hotelConfig?.address || 'Parker Street, Warrington, WA1 1HG',
      google_review_link: hotelConfig?.googleReviewLink || 'https://g.page/r/pattenarmshotel/review',
    }

    if (tplObj && tplObj.template) {
      setCustomText(formatWhatsAppTemplate(tplObj.template, vars))
    } else if (messageType === 'confirmation') {
      const text = generateBookingConfirmationWhatsAppText({
        guestName: guestFullName,
        bookingRef: booking.booking_reference,
        roomNumber: roomNumber !== 'Assigned at check-in' ? `Room ${roomNumber}` : undefined,
        roomType,
        checkInDate: formatDate(booking.check_in_date),
        checkOutDate: formatDate(booking.check_out_date),
        totalAmount: Number(booking.total_amount) || 0,
        hotelConfig,
      })
      setCustomText(text)
    } else {
      const customLink = hotelConfig?.googleReviewLink || 'https://g.page/r/pattenarmshotel/review'
      const text = generatePostStayReviewWhatsAppText({
        guestName: guestFullName,
        bookingRef: booking.booking_reference,
        hotelConfig,
        customReviewLink: customLink,
      })
      setCustomText(text)
    }
  }, [messageType, booking, hotelConfig])

  const handleSend = () => {
    if (!guestPhone.trim()) {
      toast.error('Please enter a guest phone number or select a contact in WhatsApp')
    }
    sendGuestWhatsAppMessage({
      phone: guestPhone,
      text: customText,
    })
    toast.success('Opening WhatsApp...')
    onClose()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(customText)
    setCopied(true)
    toast.success('Message copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Guest WhatsApp Dispatch</h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {booking.booking_reference} • {guestFullName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMessageType('confirmation')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                messageType === 'confirmation'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              1. Confirmation
            </button>
            <button
              type="button"
              onClick={() => setMessageType('wifi')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                messageType === 'wifi'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-blue-600" />
              2. WiFi Welcome
            </button>
            <button
              type="button"
              onClick={() => setMessageType('review')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                messageType === 'review'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              3. Review Request
            </button>
          </div>

          {/* Guest Phone Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Guest WhatsApp / Mobile Number:
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              placeholder="+44 7700 900000 (UK or international format, or leave blank to choose inside WhatsApp)"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tip: Standard international codes work best (e.g. 447700900000). Leaving blank allows you to pick any WhatsApp contact or chat.
            </p>
          </div>

          {/* Message Content & Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Customise Message Text:
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-700 transition"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              rows={9}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs font-sans focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed resize-none bg-slate-50/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Send via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
