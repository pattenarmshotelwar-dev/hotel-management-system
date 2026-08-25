'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Payment, Booking } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel, getPaymentStatusColor, getPaymentStatusLabel, getBookingSourceColor, getBookingSourceLabel, cn } from '@/lib/utils'
import { Download, Search, X, Edit2, Check, Loader2, TrendingUp, CreditCard, Banknote, Building } from 'lucide-react'
import { toast } from 'sonner'

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<(Payment & { booking?: Booking })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'all' | 'stripe' | 'booking_com' | 'offline'>('all')
  const [editingPayment, setEditingPayment] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editStatus, setEditStatus] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, booking:bookings(booking_reference, guest_first_name, guest_last_name, guest_email, check_in_date, check_out_date, source, room:rooms(room_number))')
      .order('created_at', { ascending: false })
    setPayments(data ?? [])
    setLoading(false)
  }

  const handleSaveEdit = async (paymentId: string) => {
    const { error } = await supabase.from('payments').update({
      notes: editNotes || null,
      amount: parseFloat(editAmount),
      status: editStatus as any,
    }).eq('id', paymentId)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Payment updated')
    setEditingPayment(null)
    fetchData()
  }

  const filtered = payments.filter(p => {
    const booking = p.booking as any
    const matchSearch = search === '' ||
      (booking?.booking_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (booking?.guest_first_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (booking?.guest_last_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference_number ?? '').toLowerCase().includes(search.toLowerCase())

    const matchMethod = methodFilter === 'all' || p.method === methodFilter
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchTab =
      activeTab === 'all' ? true :
      activeTab === 'stripe' ? ['stripe_card', 'stripe_link'].includes(p.method) :
      activeTab === 'booking_com' ? ['booking_com_vcc', 'booking_com_payout'].includes(p.method) :
      ['cash', 'bank_transfer'].includes(p.method)

    return matchSearch && matchMethod && matchStatus && matchTab
  })

  const totalRevenue = payments.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0)
  const stripeRevenue = payments.filter(p => p.status === 'succeeded' && ['stripe_card', 'stripe_link'].includes(p.method)).reduce((s, p) => s + p.amount, 0)
  const bookingComRevenue = payments.filter(p => p.status === 'succeeded' && ['booking_com_vcc', 'booking_com_payout'].includes(p.method)).reduce((s, p) => s + p.amount, 0)
  const offlineRevenue = payments.filter(p => p.status === 'succeeded' && ['cash', 'bank_transfer'].includes(p.method)).reduce((s, p) => s + p.amount, 0)

  const handleExport = () => {
    const csv = [
      ['Date', 'Reference', 'Guest', 'Amount', 'Method', 'Status', 'Notes'],
      ...filtered.map(p => {
        const b = p.booking as any
        return [
          formatDate(p.created_at),
          b?.booking_reference ?? '',
          `${b?.guest_first_name ?? ''} ${b?.guest_last_name ?? ''}`,
          p.amount,
          getPaymentMethodLabel(p.method),
          p.status,
          p.notes ?? '',
        ]
      })
    ].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: totalRevenue, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Stripe', value: stripeRevenue, icon: <CreditCard className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Booking.com', value: bookingComRevenue, icon: <Building className="w-4 h-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Cash / Bank', value: offlineRevenue, icon: <Banknote className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-5 border border-slate-200`}>
            <div className={`${card.color} mb-2`}>{card.icon}</div>
            <p className={`text-xl font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {(['all', 'stripe', 'booking_com', 'offline'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium rounded-lg transition capitalize', activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}
          >
            {tab === 'booking_com' ? 'Booking.com' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search booking ref, guest name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="succeeded">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Booking Ref</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400">No payments found</td></tr>
              ) : filtered.map(p => {
                const b = p.booking as any
                const isEditing = editingPayment === p.id
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition text-sm">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b?.booking_reference ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{b?.guest_first_name ?? ''} {b?.guest_last_name ?? ''}</td>
                    <td className="px-4 py-3 text-slate-500">{b?.room?.room_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="number" step="0.01" defaultValue={p.amount} onChange={e => setEditAmount(e.target.value)}
                          className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-sm" />
                      ) : (
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{getPaymentMethodLabel(p.method)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select defaultValue={p.status} onChange={e => setEditStatus(e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs">
                          <option value="pending">Pending</option>
                          <option value="succeeded">Paid</option>
                          <option value="failed">Failed</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      ) : (
                        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getPaymentStatusColor(p.status))}>
                          {getPaymentStatusLabel(p.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs">
                      {isEditing ? (
                        <input type="text" defaultValue={p.notes ?? ''} onChange={e => setEditNotes(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm" />
                      ) : (
                        <span className="truncate text-xs">{p.notes ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveEdit(p.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingPayment(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingPayment(p.id); setEditNotes(p.notes ?? ''); setEditAmount(String(p.amount)); setEditStatus(p.status) }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
