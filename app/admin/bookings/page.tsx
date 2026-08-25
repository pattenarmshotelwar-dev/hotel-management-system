'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Room } from '@/lib/types'
import { formatCurrency, formatDate, getBookingStatusColor, getBookingStatusLabel, getBookingSourceColor, getBookingSourceLabel, nightCount, cn } from '@/lib/utils'
import { Plus, Search, Download, Filter, ChevronDown, X, Loader2, Eye, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import NewBookingModal from '@/components/bookings/NewBookingModal'
import BookingDetailModal from '@/components/bookings/BookingDetailModal'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function BookingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: bookingsData }, { data: roomsData }] = await Promise.all([
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').order('created_at', { ascending: false }),
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
    ])
    setBookings(bookingsData ?? [])
    setRooms(roomsData ?? [])
    setLoading(false)
  }

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId)
    if (error) {
      toast.error('Failed to update status')
    } else {
      toast.success(`Booking ${getBookingStatusLabel(newStatus as any)}`)
      fetchData()
    }
  }

  const handleExport = () => {
    const csv = [
      ['Reference', 'Guest', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Nights', 'Adults', 'Children', 'Amount', 'Source', 'Status'],
      ...filtered.map(b => [
        b.booking_reference,
        `${b.guest_first_name} ${b.guest_last_name}`,
        b.guest_email ?? '',
        b.guest_phone ?? '',
        (b as any).room?.room_number ?? '',
        b.check_in_date,
        b.check_out_date,
        nightCount(b.check_in_date, b.check_out_date),
        b.adults,
        b.children,
        b.total_amount,
        b.source,
        b.status,
      ])
    ].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = bookings.filter(b => {
    const matchSearch = search === '' ||
      b.guest_first_name.toLowerCase().includes(search.toLowerCase()) ||
      b.guest_last_name.toLowerCase().includes(search.toLowerCase()) ||
      b.booking_reference.toLowerCase().includes(search.toLowerCase()) ||
      (b.guest_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.guest_phone ?? '').includes(search) ||
      (b.booking_com_reference ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchSource = sourceFilter === 'all' || b.source === sourceFilter
    return matchSearch && matchStatus && matchSource
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search guest, reference, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Sources</option>
          <option value="booking_com">Booking.com</option>
          <option value="walk_in">Walk-in</option>
          <option value="direct">Direct</option>
        </select>

        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      <div className="text-xs text-slate-400">{filtered.length} bookings</div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Nights</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-slate-400">No bookings found</td></tr>
              ) : filtered.map(booking => (
                <tr key={booking.id} className="hover:bg-slate-50 transition text-sm">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{booking.booking_reference}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{booking.guest_first_name} {booking.guest_last_name}</div>
                    {booking.guest_email && <div className="text-xs text-slate-400">{booking.guest_email}</div>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {(booking as any).room?.room_number ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(booking.check_in_date)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(booking.check_out_date)}</td>
                  <td className="px-4 py-3 text-slate-500">{nightCount(booking.check_in_date, booking.check_out_date)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(booking.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-white text-xs font-medium px-2 py-1 rounded-full', getBookingSourceColor(booking.source))}>
                      {getBookingSourceLabel(booking.source)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getBookingStatusColor(booking.status))}>
                      {getBookingStatusLabel(booking.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'checked_in')}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Check In"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                      )}
                      {booking.status === 'checked_in' && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'checked_out')}
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="Check Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                      {(booking.status === 'confirmed' || booking.status === 'checked_in') && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewBookingModal
          rooms={rooms}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { fetchData(); setShowNewModal(false) }}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => { fetchData(); setSelectedBooking(null) }}
        />
      )}
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsContent />
    </Suspense>
  )
}
