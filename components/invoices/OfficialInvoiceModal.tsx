'use client'

import { useRef, useEffect, useState } from 'react'
import { Booking, Payment } from '@/lib/types'
import { formatCurrency, formatDate, nightCount } from '@/lib/utils'
import { X, Printer } from 'lucide-react'
import Image from 'next/image'

interface Props {
  booking: Booking
  payments?: Payment[]
  onClose: () => void
}

export default function OfficialInvoiceModal({ booking, payments = [], onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  // Load configurable bank details and hotel details from settings/localStorage
  const [bankDetails, setBankDetails] = useState({
    bankName: 'Barclays Bank',
    accountName: 'Rumiscapes Ltd',
    sortCode: '20-91-45',
    accountNumber: '83920184',
    paymentTerms: 'Payment due upon receipt. Please use invoice reference on transfer.',
  })

  useEffect(() => {
    const saved = localStorage.getItem('patten_hotel_config')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setBankDetails(prev => ({
          bankName: parsed.bankName || prev.bankName,
          accountName: parsed.accountName || prev.accountName,
          sortCode: parsed.sortCode || prev.sortCode,
          accountNumber: parsed.accountNumber || prev.accountNumber,
          paymentTerms: parsed.paymentTerms || prev.paymentTerms,
        }))
      } catch (e) {}
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  // Financial calculations
  const grossTotal = Number(booking.total_amount) || 0
  const netTotal = grossTotal / 1.2
  const vatAmount = grossTotal - netTotal

  const successfulPayments = payments.filter(p => p.status === 'succeeded')
  const totalPaid = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balanceDue = Math.max(0, grossTotal - totalPaid)

  const nights = nightCount(booking.check_in_date, booking.check_out_date)
  const roomNumber = (booking as any).room?.room_number ?? 'Assigned'
  const roomTypeLabel = ((booking as any).room?.room_type ?? 'Standard').replace('_', ' ')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        {/* Navigation Bar - Hidden during printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Official Hotel Tax Invoice</h2>
            <span className="text-xs bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
              PAH-{booking.booking_reference}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body matching Patten_Arms_Hotel_Invoice_With_Logo.docx */}
        <div ref={printRef} className="p-8 sm:p-12 space-y-6 text-slate-900 bg-white font-sans text-xs leading-normal">
          {/* Header Row: Logo & Invoice Block */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-6">
            <div className="w-64">
              <Image
                src="/invoice-logo.png"
                alt="The Patten Arms Hotel"
                width={250}
                height={140}
                unoptimized
                className="h-28 w-auto object-contain"
              />
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-extrabold tracking-wider text-slate-900 uppercase">INVOICE</h1>
              <div className="mt-3 space-y-1 text-xs">
                <p>
                  <span className="text-slate-500">Invoice No:</span>{' '}
                  <span className="font-mono font-bold text-sm">PAH-{booking.booking_reference}</span>
                </p>
                <p>
                  <span className="text-slate-500">Invoice Date:</span>{' '}
                  <span className="font-semibold">{formatDate(new Date().toISOString(), 'dd/MM/yyyy')}</span>
                </p>
                <p>
                  <span className="text-slate-500">Folio No:</span>{' '}
                  <span className="font-mono font-semibold">{booking.booking_reference.replace(/[^0-9]/g, '') || '000104'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Guest Details */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-200 pb-1 mb-2">
                GUEST DETAILS
              </h3>
              <p>
                <span className="text-slate-500">Guest Name:</span>{' '}
                <strong className="text-slate-900 text-sm">{booking.guest_first_name} {booking.guest_last_name}</strong>
              </p>
              <p>
                <span className="text-slate-500">Address:</span>{' '}
                <span>{booking.guest_country || 'United Kingdom'}</span>
              </p>
              <p>
                <span className="text-slate-500">Email:</span>{' '}
                <span>{booking.guest_email || '—'}</span>
              </p>
              <p>
                <span className="text-slate-500">Phone:</span>{' '}
                <span>{booking.guest_phone || '—'}</span>
              </p>
            </div>

            {/* Stay Details */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-200 pb-1 mb-2">
                STAY DETAILS
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <p>
                  <span className="text-slate-500">Room Number:</span>{' '}
                  <strong>Room {roomNumber}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Room Type:</span>{' '}
                  <span className="capitalize font-semibold">{roomTypeLabel}</span>
                </p>
                <p>
                  <span className="text-slate-500">Check In:</span>{' '}
                  <span>{formatDate(booking.check_in_date, 'dd/MM/yyyy')}</span>
                </p>
                <p>
                  <span className="text-slate-500">Check Out:</span>{' '}
                  <span>{formatDate(booking.check_out_date, 'dd/MM/yyyy')}</span>
                </p>
                <p>
                  <span className="text-slate-500">No. of Nights:</span>{' '}
                  <strong>{nights}</strong>
                </p>
                <p>
                  <span className="text-slate-500">No. of Guests:</span>{' '}
                  <span>{booking.adults} Adults{booking.children > 0 ? `, ${booking.children} Children` : ''}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Itemised Charges Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px] text-slate-700">
              ITEMISED CHARGES
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">DATE</th>
                  <th className="px-4 py-2.5 text-left font-semibold">DESCRIPTION</th>
                  <th className="px-4 py-2.5 text-center font-semibold">QTY</th>
                  <th className="px-4 py-2.5 text-right font-semibold">UNIT PRICE</th>
                  <th className="px-4 py-2.5 text-right font-semibold">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 text-slate-600">{formatDate(booking.check_in_date, 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Accommodation — {roomTypeLabel} (Room {roomNumber})
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{nights} night{nights > 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCurrency(nights > 0 ? grossTotal / nights : grossTotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCurrency(grossTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payments & Deposits on Left, Totals on Right */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            {/* Left: Payments & Appreciation */}
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-500 mb-2">
                  PAYMENTS & DEPOSITS
                </h4>
                {successfulPayments.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {successfulPayments.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-slate-700">
                        <span>
                          {formatDate(p.created_at, 'dd/MM/yyyy')} — <span className="capitalize">{p.method.replace('_', ' ')}</span>
                        </span>
                        <span className="font-semibold text-green-700">-{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No payments recorded to date.</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-slate-600 text-xs">
                <p className="font-medium">Thank you for staying with us.</p>
                <p className="text-slate-400">We hope to welcome you back soon.</p>
              </div>
            </div>

            {/* Right: Subtotal, VAT, Total, Balance */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>SUBTOTAL (Net):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(netTotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>VAT (20%):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>TOTAL (GBP):</span>
                <span>{formatCurrency(grossTotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>PAYMENTS RECEIVED:</span>
                <span className="font-semibold text-green-700">-{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-slate-300 text-base font-extrabold">
                <span>BALANCE DUE:</span>
                <span className={balanceDue > 0 ? 'text-red-600' : 'text-slate-900'}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Billing & Company Information Footer matching docx */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-[11px] text-slate-600">
            {/* Billing Info */}
            <div className="space-y-1">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-700">
                BILLING INFORMATION
              </h4>
              <p>• All charges are itemised in GBP (£).</p>
              <p>• Payment is due upon check-out or as agreed by invoice terms.</p>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px]">
                <p className="font-semibold text-slate-800">Bank Transfer Details (BACS):</p>
                <p>Bank: {bankDetails.bankName} | Sort Code: {bankDetails.sortCode}</p>
                <p>Account No: {bankDetails.accountNumber} | Name: {bankDetails.accountName}</p>
                <p className="text-slate-400 mt-0.5">{bankDetails.paymentTerms}</p>
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-1 text-right sm:text-left">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-700">
                COMPANY INFORMATION
              </h4>
              <p className="font-bold text-slate-900">Rumiscapes Ltd</p>
              <p>Trading as The Patten Arms Hotel</p>
              <p>Parker Street, Warrington, WA1 1LS</p>
              <p>Company No. 16117921</p>
              <p>Tel: 01925 636602 | Email: info@pattenarms.co.uk</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
