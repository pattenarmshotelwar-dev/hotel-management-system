'use client'

import { useRef } from 'react'
import { Payment } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/utils'
import { X, Printer, CheckCircle } from 'lucide-react'

interface Props {
  payment: Payment & { booking?: any }
  onClose: () => void
}

export default function PaymentReceiptModal({ payment, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const b = payment.booking || {}

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Payment Receipt</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono">
              RCP-{payment.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Area */}
        <div ref={printRef} className="p-8 space-y-6 text-slate-800 bg-white">
          {/* Hotel Letterhead */}
          <div className="text-center border-b border-slate-200 pb-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Patten Arms Hotel</h1>
            <p className="text-xs text-slate-500 mt-0.5">Parker Street, Warrington, WA1 1HG, UK</p>
            <p className="text-xs text-slate-500">Tel: +44 1925 650144 | Email: pattenarmshotelwar@gmail.com</p>
            <div className="mt-3 inline-block bg-slate-100 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-700">
              OFFICIAL PAYMENT RECEIPT
            </div>
          </div>

          {/* Receipt Meta */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400">Receipt Ref:</span>
              <p className="font-mono font-bold text-slate-800 mt-0.5">RCP-{payment.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <span className="text-slate-400">Date & Time:</span>
              <p className="font-semibold text-slate-800 mt-0.5">{formatDateTime(payment.created_at)}</p>
            </div>
            <div>
              <span className="text-slate-400">Guest Name:</span>
              <p className="font-bold text-slate-800 mt-0.5">
                {b.guest_first_name ? `${b.guest_first_name} ${b.guest_last_name}` : 'Front Desk Guest'}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Reservation Ref:</span>
              <p className="font-mono font-semibold text-slate-800 mt-0.5">{b.booking_reference || '—'}</p>
            </div>
            {b.room?.room_number && (
              <div>
                <span className="text-slate-400">Room:</span>
                <p className="font-bold text-slate-800 mt-0.5">Room {b.room.room_number}</p>
              </div>
            )}
            <div>
              <span className="text-slate-400">Payment Method:</span>
              <p className="font-semibold text-slate-800 mt-0.5">{getPaymentMethodLabel(payment.method)}</p>
            </div>
          </div>

          {/* Amount Paid Box */}
          <div className="border border-green-200 bg-green-50/50 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Amount Paid</p>
            <p className="text-3xl font-extrabold text-green-700 mt-1">{formatCurrency(payment.amount)}</p>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-semibold text-green-700">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Status: {getPaymentStatusLabel(payment.status)}</span>
            </div>
          </div>

          {payment.notes && (
            <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-500">Transaction Notes:</span>
              <p className="text-slate-700 mt-0.5">{payment.notes}</p>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center text-[11px] text-slate-400 pt-4 border-t border-slate-100">
            <p>Thank you for staying at the Patten Arms Hotel.</p>
            <p className="mt-0.5">For inquiries regarding this receipt, please contact reception.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
