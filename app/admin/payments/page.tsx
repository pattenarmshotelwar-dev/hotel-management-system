'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Payment, Booking } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentMethodLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  cn,
} from '@/lib/utils'
import {
  Download,
  Search,
  X,
  Edit2,
  Check,
  Loader2,
  TrendingUp,
  CreditCard,
  Banknote,
  Building,
  Plus,
  Printer,
  Calendar,
  DollarSign,
  Receipt,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import PaymentReceiptModal from '@/components/payments/PaymentReceiptModal'
import RecordPaymentModal from '@/components/payments/RecordPaymentModal'
import OfficialInvoiceModal from '@/components/invoices/OfficialInvoiceModal'

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<(Payment & { booking?: Booking })[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [invoiceBooking, setInvoiceBooking] = useState<any | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'all' | 'stripe' | 'booking_com' | 'offline'>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Inline Editing
  const [editingPayment, setEditingPayment] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: paymentsData }, { data: bookingsData }] = await Promise.all([
      supabase
        .from('payments')
        .select(
          '*, booking:bookings(id, booking_reference, guest_first_name, guest_last_name, guest_email, check_in_date, check_out_date, source, total_amount, room:rooms(room_number))'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('*, room:rooms(room_number)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setPayments((paymentsData as any) ?? [])
    setBookings((bookingsData as any) ?? [])
    setLoading(false)
  }

  const handleSaveEdit = async (paymentId: string) => {
    const { error } = await supabase
      .from('payments')
      .update({
        notes: editNotes || null,
        amount: parseFloat(editAmount),
        status: editStatus as any,
      })
      .eq('id', paymentId)
    if (error) {
      toast.error('Failed to update')
      return
    }
    toast.success('Payment updated')
    setEditingPayment(null)
    fetchData()
  }

  // Filtered Payments Calculation
  const filtered = useMemo(() => {
    return payments.filter(p => {
      const booking = p.booking as any
      const matchSearch =
        search === '' ||
        (booking?.booking_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (booking?.guest_first_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (booking?.guest_last_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.reference_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        ((booking?.room?.room_number ?? '').toString()).includes(search)

      const matchMethod = methodFilter === 'all' || p.method === methodFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const matchTab =
        activeTab === 'all'
          ? true
          : activeTab === 'stripe'
          ? ['stripe_card', 'stripe_link'].includes(p.method)
          : activeTab === 'booking_com'
          ? ['booking_com_vcc', 'booking_com_payout'].includes(p.method)
          : ['cash', 'bank_transfer'].includes(p.method)

      // Date Presets
      let matchDate = true
      const pDate = p.created_at.split('T')[0]
      if (datePreset === 'today') {
        matchDate = pDate === todayStr
      } else if (datePreset === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
        matchDate = pDate >= weekAgo
      } else if (datePreset === 'month') {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        matchDate = pDate >= monthStart
      } else if (datePreset === 'custom') {
        if (customStart && pDate < customStart) matchDate = false
        if (customEnd && pDate > customEnd) matchDate = false
      }

      return matchSearch && matchMethod && matchStatus && matchTab && matchDate
    })
  }, [payments, search, methodFilter, statusFilter, activeTab, datePreset, customStart, customEnd, todayStr])

  // Financial Summary
  const stats = useMemo(() => {
    const succeeded = filtered.filter(p => p.status === 'succeeded')
    const totalRev = succeeded.reduce((s, p) => s + p.amount, 0)
    const stripeRev = succeeded.filter(p => ['stripe_card', 'stripe_link'].includes(p.method)).reduce((s, p) => s + p.amount, 0)
    const bComRev = succeeded.filter(p => ['booking_com_vcc', 'booking_com_payout'].includes(p.method)).reduce((s, p) => s + p.amount, 0)
    const offlineRev = succeeded.filter(p => ['cash', 'bank_transfer'].includes(p.method)).reduce((s, p) => s + p.amount, 0)
    const todayRev = succeeded.filter(p => p.created_at.startsWith(todayStr)).reduce((s, p) => s + p.amount, 0)
    const avgTxn = succeeded.length > 0 ? totalRev / succeeded.length : 0

    return { totalRev, stripeRev, bComRev, offlineRev, todayRev, avgTxn, count: succeeded.length }
  }, [filtered, todayStr])

  const handleExport = () => {
    const csv = [
      ['Date', 'Reference', 'Guest', 'Room', 'Amount (£)', 'Method', 'Status', 'Notes'],
      ...filtered.map(p => {
        const b = p.booking as any
        return [
          formatDate(p.created_at),
          b?.booking_reference ?? '',
          `"${b?.guest_first_name ?? ''} ${b?.guest_last_name ?? ''}"`,
          b?.room?.room_number ?? '',
          p.amount,
          getPaymentMethodLabel(p.method),
          p.status,
          `"${p.notes ?? ''}"`,
        ]
      }),
    ]
      .map(r => r.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-export-${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Record Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payments & Transactions</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track collections, reconciliations, and receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-50 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Collections</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalRev)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{stats.count} transactions in filter</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Today’s Takings</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats.todayRev)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Shift collections today</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Booking.com Payouts</span>
            <Building className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-700">{formatCurrency(stats.bComRev)}</p>
          <p className="text-xs text-slate-400 mt-0.5">VCC & OTA channel</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Cash & Bank Transfers</span>
            <Banknote className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(stats.offlineRev)}</p>
          <p className="text-xs text-slate-400 mt-0.5">In-person & BACS</p>
        </div>
      </div>

      {/* Date Presets Ribbon */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Period:</span>
        {[
          { id: 'all', label: 'All Time' },
          { id: 'today', label: 'Today (Shift)' },
          { id: 'week', label: 'Past 7 Days' },
          { id: 'month', label: 'This Month' },
          { id: 'custom', label: 'Custom Range' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setDatePreset(p.id as DatePreset)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-xl transition',
              datePreset === p.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {p.label}
          </button>
        ))}

        {datePreset === 'custom' && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Payment Channel Tabs & Search Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'stripe', 'booking_com', 'offline'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition capitalize',
                  activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab === 'booking_com' ? 'Booking.com' : tab === 'offline' ? 'Cash / Bank' : tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest, ref, room, or notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="stripe_card">Card (Stripe)</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="booking_com_vcc">Booking.com VCC</option>
            <option value="booking_com_payout">Booking.com Payout</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="succeeded">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Booking Ref</th>
                <th className="px-4 py-3">Guest & Room</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes & Ref</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <p className="text-xs">Loading payment transactions...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-xs">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const b = p.booking as any
                  const isEditing = editingPayment === p.id
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition text-sm">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {formatDateTime(p.created_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {b?.booking_reference ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-xs">
                          {b?.guest_first_name ?? ''} {b?.guest_last_name ?? 'Walk-in'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b?.room?.room_number ? `Room ${b.room.room_number}` : 'No room assigned'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={p.amount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 text-xs">{formatCurrency(p.amount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {getPaymentMethodLabel(p.method)}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            defaultValue={p.status}
                            onChange={e => setEditStatus(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="succeeded">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        ) : (
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', getPaymentStatusColor(p.status))}>
                            {getPaymentStatusLabel(p.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={p.notes ?? ''}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                          />
                        ) : (
                          <span className="truncate block">{p.notes || p.reference_number || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Official Tax Invoice */}
                          {b && (
                            <button
                              onClick={() => setInvoiceBooking(b)}
                              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                              title="Official Tax Invoice"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Print Receipt */}
                          <button
                            onClick={() => setReceiptPayment(p)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Print Payment Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit / Save */}
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleSaveEdit(p.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingPayment(null)}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingPayment(p.id)
                                setEditNotes(p.notes ?? '')
                                setEditAmount(String(p.amount))
                                setEditStatus(p.status)
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit transaction"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showRecordModal && (
        <RecordPaymentModal
          bookings={bookings}
          onClose={() => setShowRecordModal(false)}
          onCreated={() => {
            fetchData()
            setShowRecordModal(false)
          }}
        />
      )}

      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {invoiceBooking && (
        <OfficialInvoiceModal
          booking={invoiceBooking}
          payments={payments.filter(p => (p as any).booking_id === invoiceBooking.id)}
          onClose={() => setInvoiceBooking(null)}
        />
      )}
    </div>
  )
}
