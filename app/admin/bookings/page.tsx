'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Room } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  getBookingStatusColor,
  getBookingStatusLabel,
  getBookingSourceColor,
  getBookingSourceLabel,
  nightCount,
  cn,
} from '@/lib/utils'
import {
  Plus,
  Search,
  Download,
  X,
  Loader2,
  Eye,
  LogIn,
  LogOut,
  XCircle,
  FileText,
  Calendar,
  AlertCircle,
  Users,
  CreditCard,
  BedDouble,
  CheckCircle2,
  MessageSquare,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import NewBookingModal from '@/components/bookings/NewBookingModal'
import BookingDetailModal from '@/components/bookings/BookingDetailModal'
import GuestRegistrationCardModal from '@/components/bookings/GuestRegistrationCardModal'
import CheckoutWhatsAppPromptModal from '@/components/housekeeping/CheckoutWhatsAppPromptModal'
import OfficialInvoiceModal from '@/components/invoices/OfficialInvoiceModal'
import WhatsAppMessageModal from '@/components/bookings/WhatsAppMessageModal'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type QuickTab = 'all' | 'arrivals' | 'in_house' | 'departures' | 'unpaid'

function BookingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutPromptBooking, setCheckoutPromptBooking] = useState<Booking | null>(null)
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null)
  const [whatsAppModalBooking, setWhatsAppModalBooking] = useState<Booking | null>(null)

  // Filters
  const [activeTab, setActiveTab] = useState<QuickTab>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dateFilterType, setDateFilterType] = useState<'check_in' | 'check_out'>('check_in')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Modals
  const [showNewModal, setShowNewModal] = useState(searchParams.get('new') === 'true')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [regCardBooking, setRegCardBooking] = useState<Booking | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: bookingsData }, { data: roomsData }] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, room:rooms(room_number, room_type), payments(id, amount, status, method, created_at)')
          .order('created_at', { ascending: false }),
        supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      ])
      setBookings((bookingsData as any) ?? [])
      setRooms(roomsData ?? [])
    } catch (err) {
      console.error('Error fetching bookings data:', err)
      toast.error('Failed to load some bookings data')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    const bookingToUpdate = bookings.find(b => b.id === bookingId)
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId)
    if (error) {
      toast.error('Failed to update status')
    } else {
      toast.success(`Booking marked as ${getBookingStatusLabel(newStatus as any)}`)

      // If guest checked out, mark room as dirty and trigger WhatsApp prompt
      if (newStatus === 'checked_out' && bookingToUpdate) {
        if (bookingToUpdate.room_id) {
          await supabase.from('rooms').update({ cleaning_status: 'dirty' }).eq('id', bookingToUpdate.room_id)
        }
        setCheckoutPromptBooking(bookingToUpdate)
      }

      fetchData()
    }
  }

  // Calculate payment balance for each booking
  const getBookingPaymentInfo = (b: Booking) => {
    const payments = (b as any).payments || []
    const paid = payments
      .filter((p: any) => p.status === 'succeeded')
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    const balance = Math.max(0, b.total_amount - paid)
    return { paid, balance, isFullyPaid: balance <= 0 && b.total_amount > 0 }
  }

  // KPIs
  const kpis = useMemo(() => {
    const inHouse = bookings.filter(b => b.status === 'checked_in').length
    const arrivalsToday = bookings.filter(
      b => b.check_in_date === todayStr && ['confirmed', 'checked_in'].includes(b.status)
    ).length
    const departuresToday = bookings.filter(
      b => b.check_out_date === todayStr && ['checked_in', 'checked_out'].includes(b.status)
    ).length

    let totalOutstanding = 0
    let unpaidCount = 0
    bookings.forEach(b => {
      if (b.status !== 'cancelled') {
        const { balance } = getBookingPaymentInfo(b)
        if (balance > 0) {
          totalOutstanding += balance
          unpaidCount++
        }
      }
    })

    return { inHouse, arrivalsToday, departuresToday, totalOutstanding, unpaidCount }
  }, [bookings, todayStr])

  // Filter logic
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      // 1. Tab filter
      if (activeTab === 'arrivals') {
        if (b.check_in_date !== todayStr || b.status === 'cancelled') return false
      } else if (activeTab === 'in_house') {
        if (b.status !== 'checked_in') return false
      } else if (activeTab === 'departures') {
        if (b.check_out_date !== todayStr || b.status === 'cancelled') return false
      } else if (activeTab === 'unpaid') {
        if (b.status === 'cancelled') return false
        const { balance } = getBookingPaymentInfo(b)
        if (balance <= 0) return false
      }

      // 2. Search filter
      const matchSearch =
        search === '' ||
        b.guest_first_name.toLowerCase().includes(search.toLowerCase()) ||
        b.guest_last_name.toLowerCase().includes(search.toLowerCase()) ||
        b.booking_reference.toLowerCase().includes(search.toLowerCase()) ||
        (b.guest_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (b.guest_phone ?? '').includes(search) ||
        (b.booking_com_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
        ((b as any).room?.room_number ?? '').toString().includes(search)

      if (!matchSearch) return false

      // 3. Dropdown filters
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (sourceFilter !== 'all' && b.source !== sourceFilter) return false

      // 4. Custom date range
      const targetDate = dateFilterType === 'check_in' ? b.check_in_date : b.check_out_date
      if (startDate && targetDate < startDate) return false
      if (endDate && targetDate > endDate) return false

      return true
    })
  }, [bookings, activeTab, search, statusFilter, sourceFilter, dateFilterType, startDate, endDate, todayStr])

  const handleExport = () => {
    const csv = [
      [
        'Reference',
        'Guest',
        'Email',
        'Phone',
        'Room',
        'Check-in',
        'Check-out',
        'Nights',
        'Adults',
        'Children',
        'Total (£)',
        'Paid (£)',
        'Balance (£)',
        'Source',
        'Status',
      ],
      ...filtered.map(b => {
        const { paid, balance } = getBookingPaymentInfo(b)
        return [
          b.booking_reference,
          `"${b.guest_first_name} ${b.guest_last_name}"`,
          b.guest_email ?? '',
          b.guest_phone ?? '',
          (b as any).room?.room_number ?? '',
          b.check_in_date,
          b.check_out_date,
          nightCount(b.check_in_date, b.check_out_date),
          b.adults,
          b.children,
          b.total_amount,
          paid,
          balance,
          b.source,
          b.status,
        ]
      }),
    ]
      .map(r => r.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patten-arms-bookings-${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Top Metric Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveTab('in_house')}
          className={cn(
            'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
            activeTab === 'in_house' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>In-House Guests</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{kpis.inHouse}</p>
          <p className="text-xs text-slate-400 mt-0.5">Currently checked in</p>
        </div>

        <div
          onClick={() => setActiveTab('arrivals')}
          className={cn(
            'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
            activeTab === 'arrivals' ? 'border-green-500 ring-2 ring-green-100 bg-green-50/20' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Arriving Today</span>
            <LogIn className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700 mt-2">{kpis.arrivalsToday}</p>
          <p className="text-xs text-slate-400 mt-0.5">Scheduled for check-in</p>
        </div>

        <div
          onClick={() => setActiveTab('departures')}
          className={cn(
            'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
            activeTab === 'departures' ? 'border-orange-500 ring-2 ring-orange-100 bg-orange-50/20' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Departing Today</span>
            <LogOut className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-700 mt-2">{kpis.departuresToday}</p>
          <p className="text-xs text-slate-400 mt-0.5">Scheduled check-outs</p>
        </div>

        <div
          onClick={() => setActiveTab('unpaid')}
          className={cn(
            'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
            activeTab === 'unpaid' ? 'border-red-500 ring-2 ring-red-100 bg-red-50/20' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Outstanding Due</span>
            <CreditCard className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-2">{formatCurrency(kpis.totalOutstanding)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{kpis.unpaidCount} bookings with balance</p>
        </div>
      </div>

      {/* Quick Tabs Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'all', label: 'All Bookings', count: bookings.length },
          { id: 'arrivals', label: 'Today’s Arrivals', count: kpis.arrivalsToday },
          { id: 'in_house', label: 'In-House', count: kpis.inHouse },
          { id: 'departures', label: 'Today’s Departures', count: kpis.departuresToday },
          { id: 'unpaid', label: 'Unpaid / Balance Due', count: kpis.unpaidCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as QuickTab)}
            className={cn(
              'px-3.5 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap flex items-center gap-2',
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                activeTab === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest, reference, room, email, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="booking_com">Booking.com</option>
            <option value="walk_in">Walk-in</option>
            <option value="direct">Direct</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-100 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {/* New Booking Button */}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-sm transition ml-auto"
          >
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </div>

        {/* Date Filter Accordion / Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date Filter:
          </span>
          <select
            value={dateFilterType}
            onChange={e => setDateFilterType(e.target.value as any)}
            className="bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="check_in">Check-in Date</option>
            <option value="check_out">Check-out Date</option>
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-blue-600 hover:underline text-[11px] ml-1"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-slate-400 ml-auto font-medium">{filtered.length} bookings found</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Guest Details</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-500 mb-2" />
                    <p className="text-xs">Loading reservations...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600 text-sm">No bookings match your filters</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing your search or switching tabs</p>
                  </td>
                </tr>
              ) : (
                filtered.map(booking => {
                  const { paid, balance, isFullyPaid } = getBookingPaymentInfo(booking)
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/80 transition text-sm">
                      {/* Reference */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          {booking.booking_reference}
                        </span>
                        {booking.booking_com_reference && (
                          <div className="text-[10px] text-blue-600 font-mono mt-1">OTA: {booking.booking_com_reference}</div>
                        )}
                      </td>

                      {/* Guest */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {booking.guest_first_name} {booking.guest_last_name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {booking.guest_phone || booking.guest_email || 'No contact info'}
                        </div>
                      </td>

                      {/* Room */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {(booking as any).room?.room_number ? `Room ${(booking as any).room?.room_number}` : 'Unassigned'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {(booking as any).room?.room_type?.replace('_', ' ') || 'Standard'}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div className="font-medium">{formatDate(booking.check_in_date, 'dd MMM yyyy')}</div>
                        <div className="text-slate-400 mt-0.5">→ {formatDate(booking.check_out_date, 'dd MMM yyyy')}</div>
                      </td>

                      {/* Nights / Guests */}
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <span className="font-medium">{nightCount(booking.check_in_date, booking.check_out_date)} nights</span>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {booking.adults}A {booking.children > 0 ? `${booking.children}C` : ''}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {formatCurrency(booking.total_amount)}
                      </td>

                      {/* Payment Status Column */}
                      <td className="px-4 py-3.5">
                        {booking.status === 'cancelled' ? (
                          <span className="text-xs text-slate-400">Cancelled</span>
                        ) : isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Fully Paid
                          </span>
                        ) : paid > 0 ? (
                          <div>
                            <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Partial: {formatCurrency(paid)}
                            </span>
                            <div className="text-[10px] text-red-600 font-bold mt-0.5">
                              Due: {formatCurrency(balance)}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Unpaid: {formatCurrency(balance)}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider',
                            getBookingSourceColor(booking.source)
                          )}
                        >
                          {getBookingSourceLabel(booking.source)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                            getBookingStatusColor(booking.status)
                          )}
                        >
                          {getBookingStatusLabel(booking.status)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Official Tax Invoice */}
                          <button
                            onClick={() => setInvoiceBooking(booking)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                            title="Official Tax Invoice (PAH Template)"
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                          </button>

                          {/* WhatsApp Confirmation / Review */}
                          <button
                            onClick={() => setWhatsAppModalBooking(booking)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title={booking.status === 'checked_out' ? 'Send Review Request via WhatsApp' : 'Send Booking Confirmation via WhatsApp'}
                          >
                            <MessageSquare className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Print Registration / Folio */}
                          <button
                            onClick={() => setRegCardBooking(booking)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Print Folio / Registration Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* View Modal */}
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View / Edit Booking"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Check In Action */}
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => handleStatusChange(booking.id, 'checked_in')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                              title="Check In Guest"
                            >
                              <LogIn className="w-4 h-4" />
                            </button>
                          )}

                          {/* Check Out Action */}
                          {booking.status === 'checked_in' && (
                            <button
                              onClick={() => handleStatusChange(booking.id, 'checked_out')}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                              title="Check Out Guest"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel */}
                          {['confirmed', 'checked_in'].includes(booking.status) && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this reservation?')) {
                                  handleStatusChange(booking.id, 'cancelled')
                                }
                              }}
                              className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Cancel Reservation"
                            >
                              <XCircle className="w-4 h-4" />
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
      {showNewModal && (
        <NewBookingModal
          rooms={rooms}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            fetchData()
            setShowNewModal(false)
          }}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => {
            fetchData()
            setSelectedBooking(null)
          }}
        />
      )}

      {regCardBooking && (
        <GuestRegistrationCardModal
          booking={regCardBooking}
          payments={(regCardBooking as any).payments || []}
          onClose={() => setRegCardBooking(null)}
        />
      )}

      {invoiceBooking && (
        <OfficialInvoiceModal
          booking={invoiceBooking}
          payments={(invoiceBooking as any).payments || []}
          onClose={() => setInvoiceBooking(null)}
        />
      )}

      {checkoutPromptBooking && (
        <CheckoutWhatsAppPromptModal
          booking={checkoutPromptBooking}
          onClose={() => setCheckoutPromptBooking(null)}
        />
      )}

      {whatsAppModalBooking && (
        <WhatsAppMessageModal
          booking={whatsAppModalBooking}
          defaultType={whatsAppModalBooking.status === 'checked_out' ? 'review' : 'confirmation'}
          onClose={() => setWhatsAppModalBooking(null)}
        />
      )}
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading bookings...</div>}>
      <BookingsContent />
    </Suspense>
  )
}
