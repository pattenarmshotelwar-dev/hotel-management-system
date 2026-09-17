'use client'

import { useRef } from 'react'
import { Booking, Payment } from '@/lib/types'
import { formatCurrency, formatDate, nightCount } from '@/lib/utils'
import { X, Printer } from 'lucide-react'

interface Props {
  booking: Booking
  payments?: Payment[]
  onClose: () => void
}

export default function GuestRegistrationCardModal({ booking, payments = [], onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const totalPaid = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  const balance = Math.max(0, booking.total_amount - totalPaid)
  const nights = nightCount(booking.check_in_date, booking.check_out_date)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">Guest Registration Folio</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">
              {booking.booking_reference}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Print Folio
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div ref={printRef} className="p-8 space-y-6 text-slate-800 bg-white">
          {/* Hotel Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patten Arms Hotel</h1>
              <p className="text-xs text-slate-500 mt-1">Parker Street, Warrington, WA1 1HG, UK</p>
              <p className="text-xs text-slate-500">Phone: +44 1925 650144 | Email: pattenarmshotelwar@gmail.com</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                Registration Card & Invoice
              </span>
              <p className="text-sm font-mono font-bold mt-2">Ref: {booking.booking_reference}</p>
              <p className="text-xs text-slate-400">Date: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          {/* Guest & Room Details Grid */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Guest Information</h3>
              <p className="text-base font-bold text-slate-900">{booking.guest_first_name} {booking.guest_last_name}</p>
              <p className="text-xs text-slate-600 mt-0.5">{booking.guest_email || 'No email registered'}</p>
              <p className="text-xs text-slate-600">{booking.guest_phone || 'No phone registered'}</p>
              <p className="text-xs text-slate-600">Country: {booking.guest_country || 'United Kingdom'}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Reservation Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Room:</span>
                  <p className="font-bold text-slate-800 text-sm">Room {(booking as any).room?.room_number ?? 'Assigned at check-in'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Room Type:</span>
                  <p className="font-semibold text-slate-800 capitalize">{(booking as any).room?.room_type?.replace('_', ' ') ?? 'Standard'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Check-in:</span>
                  <p className="font-semibold text-slate-800">{formatDate(booking.check_in_date)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Check-out:</span>
                  <p className="font-semibold text-slate-800">{formatDate(booking.check_out_date)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Duration:</span>
                  <p className="font-semibold text-slate-800">{nights} night{nights > 1 ? 's' : ''}</p>
                </div>
                <div>
                  <span className="text-slate-400">Guests:</span>
                  <p className="font-semibold text-slate-800">{booking.adults} Adults, {booking.children} Children</p>
                </div>
              </div>
            </div>
          </div>

          {/* Rate & Folio Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Billing Breakdown</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-center">Nights</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">
                    Room Stay ({(booking as any).room?.room_type?.replace('_', ' ') ?? 'Room'} — {booking.booking_reference})
                  </td>
                  <td className="py-2.5 text-center text-slate-600">{nights}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(booking.total_amount)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={2} className="py-2 text-right font-medium text-slate-600">Total Charges:</td>
                  <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(booking.total_amount)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 text-right font-medium text-slate-600">Payments Received:</td>
                  <td className="py-1 text-right font-bold text-green-600">-{formatCurrency(totalPaid)}</td>
                </tr>
                <tr className="border-t border-slate-300 font-bold text-sm">
                  <td colSpan={2} className="py-2 text-right text-slate-900">Balance Due:</td>
                  <td className={`py-2 text-right ${balance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Rules and Guest Signature Line */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-4">
            <p className="leading-relaxed">
              <strong>Hotel Notice:</strong> Check-out is strictly by 11:00 AM. Patten Arms Hotel operates a 100% non-smoking policy throughout the premises. Any damages, missing items, or violation of non-smoking policies will incur an automatic £150 fee charged to the card on file.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="border-t border-slate-400 pt-2">
                <p className="font-semibold text-slate-700">Guest Signature</p>
                <p className="text-[10px] text-slate-400 mt-1">I agree to the terms, conditions, and charges above.</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-semibold text-slate-700">Receptionist Initial / Date</p>
                <p className="text-[10px] text-slate-400 mt-1">Key issued & identification verified.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
