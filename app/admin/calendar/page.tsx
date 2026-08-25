'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Room } from '@/lib/types'
import { formatDate, getBookingSourceColor, getRoomTypeLabel, cn } from '@/lib/utils'
import { addDays, format, startOfDay, differenceInDays, parseISO, isWithinInterval, eachDayOfInterval } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw, Plus, X, Info } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const CELL_WIDTH = 40
const ROW_HEIGHT = 44
const LABEL_WIDTH = 120
const DAYS_VISIBLE = 30

export default function CalendarPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [startDate, setStartDate] = useState(startOfDay(new Date()))
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [filter, setFilter] = useState<'all' | 'single' | 'double' | 'twin_single' | 'family'>('all')

  const days = Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(startDate, i))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const rangeStart = format(startDate, 'yyyy-MM-dd')
    const rangeEnd = format(addDays(startDate, DAYS_VISIBLE), 'yyyy-MM-dd')

    const [{ data: roomsData }, { data: bookingsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('bookings')
        .select('*')
        .not('status', 'in', '(cancelled)')
        .lte('check_in_date', rangeEnd)
        .gte('check_out_date', rangeStart),
    ])

    setRooms(roomsData ?? [])
    setBookings(bookingsData ?? [])
    setLoading(false)
  }, [startDate])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ical/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Sync complete: ${data.added} bookings added`)
        fetchData()
      } else {
        toast.error('Sync failed')
      }
    } catch {
      toast.error('Sync error')
    }
    setSyncing(false)
  }

  const getBookingsForRoom = (roomId: string) =>
    bookings.filter(b => b.room_id === roomId)

  const getBookingBar = (booking: Booking, dayIndex: number) => {
    const checkIn = parseISO(booking.check_in_date)
    const checkOut = parseISO(booking.check_out_date)
    const dayDate = days[dayIndex]

    if (!isWithinInterval(dayDate, { start: checkIn, end: addDays(checkOut, -1) })) return null

    const visibleStart = checkIn < startDate ? startDate : checkIn
    const visibleEnd = checkOut > addDays(startDate, DAYS_VISIBLE) ? addDays(startDate, DAYS_VISIBLE) : checkOut

    const startOffset = Math.max(0, differenceInDays(visibleStart, startDate))
    const duration = differenceInDays(visibleEnd, visibleStart)

    if (dayDate.getTime() !== visibleStart.getTime()) return null

    const color = booking.is_maintenance_block
      ? 'bg-orange-400'
      : booking.source === 'booking_com'
        ? 'bg-blue-500'
        : booking.source === 'walk_in'
          ? 'bg-green-500'
          : 'bg-purple-500'

    return { startOffset, duration, color }
  }

  const filteredRooms = filter === 'all' ? rooms : rooms.filter(r => r.room_type === filter)

  const grouped: Record<string, Room[]> = {}
  filteredRooms.forEach(r => {
    if (!grouped[r.room_type]) grouped[r.room_type] = []
    grouped[r.room_type].push(r)
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setStartDate(d => addDays(d, -7))} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStartDate(startOfDay(new Date()))}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Today
          </button>
          <button onClick={() => setStartDate(d => addDays(d, 7))} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-sm font-medium text-slate-600">
          {formatDate(startDate.toISOString(), 'dd MMM')} – {formatDate(addDays(startDate, DAYS_VISIBLE - 1).toISOString(), 'dd MMM yyyy')}
        </span>

        {/* Room type filter */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 ml-auto">
          {(['all', 'single', 'double', 'twin_single', 'family'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition capitalize',
                filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              {f === 'all' ? 'All' : f === 'twin_single' ? 'Twin' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>

        <Link
          href="/admin/bookings?new=true"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </Link>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" /> Booking.com</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /> Walk-in / Direct</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" /> Maintenance Block</div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading calendar...</div>
        ) : (
          <div className="overflow-auto">
            {/* Header Row */}
            <div className="flex sticky top-0 z-10 bg-slate-800" style={{ minWidth: LABEL_WIDTH + DAYS_VISIBLE * CELL_WIDTH }}>
              <div className="flex-shrink-0 bg-slate-800 text-white text-xs font-medium px-4 flex items-center" style={{ width: LABEL_WIDTH }}>
                Room
              </div>
              {days.map((day, i) => {
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-shrink-0 text-center text-xs py-3 border-l border-slate-700',
                      isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-300'
                    )}
                    style={{ width: CELL_WIDTH }}
                  >
                    <div>{format(day, 'd')}</div>
                    <div className="text-slate-400" style={{ fontSize: 9 }}>{format(day, 'EEE')}</div>
                  </div>
                )
              })}
            </div>

            {/* Room Rows */}
            {Object.entries(grouped).map(([type, typeRooms]) => (
              <div key={type}>
                {/* Group header */}
                <div
                  className="flex items-center bg-slate-100 border-t border-slate-200 px-4 py-1.5"
                  style={{ minWidth: LABEL_WIDTH + DAYS_VISIBLE * CELL_WIDTH }}
                >
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {getRoomTypeLabel(type as any)} ({typeRooms.length} rooms)
                  </span>
                </div>

                {typeRooms.map(room => {
                  const roomBookings = getBookingsForRoom(room.id)
                  return (
                    <div
                      key={room.id}
                      className="flex relative border-t border-slate-100 hover:bg-slate-50 transition"
                      style={{ height: ROW_HEIGHT, minWidth: LABEL_WIDTH + DAYS_VISIBLE * CELL_WIDTH }}
                    >
                      {/* Room label */}
                      <div
                        className="flex-shrink-0 flex items-center px-4 gap-2 bg-white sticky left-0 z-10 border-r border-slate-100"
                        style={{ width: LABEL_WIDTH }}
                      >
                        <span className="text-sm font-semibold text-slate-700">{room.room_number}</span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded-full',
                          room.cleaning_status === 'dirty' ? 'bg-red-100 text-red-600' :
                          room.cleaning_status === 'cleaning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        )}>
                          {room.cleaning_status === 'dirty' ? '🔴' : room.cleaning_status === 'cleaning' ? '🟡' : '🟢'}
                        </span>
                      </div>

                      {/* Day cells */}
                      <div className="relative flex" style={{ width: DAYS_VISIBLE * CELL_WIDTH }}>
                        {days.map((day, di) => {
                          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                          return (
                            <div
                              key={di}
                              className={cn(
                                'flex-shrink-0 border-l border-slate-100',
                                isToday ? 'bg-blue-50/50' : ''
                              )}
                              style={{ width: CELL_WIDTH }}
                            />
                          )
                        })}

                        {/* Booking bars */}
                        {roomBookings.map(booking => {
                          const checkIn = parseISO(booking.check_in_date)
                          const checkOut = parseISO(booking.check_out_date)
                          const visibleStart = checkIn < startDate ? startDate : checkIn
                          const visibleEnd = checkOut > addDays(startDate, DAYS_VISIBLE) ? addDays(startDate, DAYS_VISIBLE) : checkOut
                          const startOffset = Math.max(0, differenceInDays(visibleStart, startDate))
                          const duration = differenceInDays(visibleEnd, visibleStart)

                          if (duration <= 0) return null

                          const color = booking.is_maintenance_block
                            ? 'bg-orange-400 border-orange-500'
                            : booking.source === 'booking_com'
                              ? 'bg-blue-500 border-blue-600'
                              : booking.source === 'walk_in'
                                ? 'bg-green-500 border-green-600'
                                : 'bg-purple-500 border-purple-600'

                          return (
                            <button
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className={cn(
                                'absolute top-2 bottom-2 rounded-md border text-white text-xs font-medium truncate px-2 flex items-center cursor-pointer hover:brightness-110 transition z-10',
                                color
                              )}
                              style={{
                                left: startOffset * CELL_WIDTH + 2,
                                width: duration * CELL_WIDTH - 4,
                              }}
                            >
                              {booking.is_maintenance_block ? '🔧' : `${booking.guest_first_name} ${booking.guest_last_name}`}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Detail Popup */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">
                {selectedBooking.is_maintenance_block ? '🔧 Maintenance Block' : `${selectedBooking.guest_first_name} ${selectedBooking.guest_last_name}`}
              </h3>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Reference</span><span className="font-mono">{selectedBooking.booking_reference}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Check-in</span><span>{formatDate(selectedBooking.check_in_date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Check-out</span><span>{formatDate(selectedBooking.check_out_date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Guests</span><span>{selectedBooking.adults} Adults, {selectedBooking.children} Children</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Source</span>
                <span className={cn('px-2 py-0.5 rounded text-xs text-white', getBookingSourceColor(selectedBooking.source))}>
                  {selectedBooking.source.replace('_', '.')}
                </span>
              </div>
              {selectedBooking.special_requests && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-400 text-xs mb-1">Special Requests</p>
                  <p className="text-slate-700">{selectedBooking.special_requests}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Link
                href={`/admin/bookings/${selectedBooking.id}`}
                className="flex-1 text-center py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition"
              >
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
