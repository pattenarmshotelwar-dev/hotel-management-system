'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Booking, Room } from '@/lib/types'
import { formatDate, formatCurrency, getBookingSourceColor, getRoomTypeLabel, generateBookingReference, cn } from '@/lib/utils'
import { addDays, format, startOfDay, differenceInDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Plus, X, CreditCard, Check, Search, Layers, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const ROW_HEIGHT = 44
const LABEL_WIDTH = 128

type DaysVisible = 14 | 30 | 60
type ColorMode = 'source' | 'status'

function getBarColor(booking: Booking, mode: ColorMode): string {
  if (booking.is_maintenance_block) return 'bg-orange-400 border-orange-500'
  if (mode === 'source') {
    if (booking.source === 'booking_com') return 'bg-blue-500 border-blue-600'
    if (booking.source === 'walk_in') return 'bg-green-500 border-green-600'
    return 'bg-purple-500 border-purple-600'
  }
  if (booking.status === 'checked_in')  return 'bg-green-500 border-green-600'
  if (booking.status === 'checked_out') return 'bg-slate-400 border-slate-500'
  if (booking.status === 'no_show')     return 'bg-orange-500 border-orange-600'
  return 'bg-blue-500 border-blue-600'
}

export default function CalendarPage() {
  const supabase = createClient()
  const [rooms, setRooms]                       = useState<Room[]>([])
  const [bookings, setBookings]                 = useState<Booking[]>([])
  const [startDate, setStartDate]               = useState(startOfDay(new Date()))
  const [loading, setLoading]                   = useState(true)
  const [syncing, setSyncing]                   = useState(false)
  const [daysVisible, setDaysVisible]           = useState<DaysVisible>(30)
  const [colorMode, setColorMode]               = useState<ColorMode>('source')
  const [filter, setFilter]                     = useState<'all' | 'single' | 'double' | 'twin_single' | 'family'>('all')
  const [floorFilter, setFloorFilter]           = useState<string>('all')
  const [calendarSearch, setCalendarSearch]     = useState<string>('')
  const [selectedBooking, setSelectedBooking]   = useState<Booking | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<{ amount: number; status: string }[]>([])
  const [loadingPayments, setLoadingPayments]   = useState(false)
  const [hoveredBooking, setHoveredBooking]     = useState<Booking | null>(null)
  const [tooltipPos, setTooltipPos]             = useState({ x: 0, y: 0 })
  const [quickCreate, setQuickCreate]           = useState<{ room: Room; date: string } | null>(null)
  const [quickForm, setQuickForm]               = useState({ firstName: '', lastName: '', checkOut: '', source: 'direct' as 'direct' | 'walk_in' | 'booking_com', amount: '' })
  const [quickSaving, setQuickSaving]           = useState(false)

  const cellWidth = daysVisible === 14 ? 64 : daysVisible === 30 ? 40 : 22
  const days      = Array.from({ length: daysVisible }, (_, i) => addDays(startDate, i))
  const todayStr  = format(new Date(), 'yyyy-MM-dd')

  // ---------- Data ----------
  const fetchData = useCallback(async () => {
    setLoading(true)
    const rangeStart = format(startDate, 'yyyy-MM-dd')
    const rangeEnd   = format(addDays(startDate, daysVisible + 1), 'yyyy-MM-dd')
    const [{ data: roomsData }, { data: bookingsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('bookings').select('*').not('status', 'in', '(cancelled)').lte('check_in_date', rangeEnd).gte('check_out_date', rangeStart),
    ])
    setRooms(roomsData ?? [])
    setBookings(bookingsData ?? [])
    setLoading(false)
  }, [startDate, daysVisible])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedBooking) { setSelectedPayments([]); return }
    setLoadingPayments(true)
    supabase.from('payments').select('amount, status').eq('booking_id', selectedBooking.id).then(({ data }) => {
      setSelectedPayments(data ?? [])
      setLoadingPayments(false)
    })
  }, [selectedBooking])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res  = await fetch('/api/ical/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) { toast.success(`Sync complete: ${data.added} bookings added`); fetchData() }
      else toast.error('Sync failed')
    } catch { toast.error('Sync error') }
    setSyncing(false)
  }

  const getDayOccupancy = (dateStr: string) =>
    bookings.filter(b => !b.is_maintenance_block && b.check_in_date <= dateStr && b.check_out_date > dateStr).length

  const floors = useMemo(() => Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b), [rooms])

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (filter !== 'all' && r.room_type !== filter) return false
      if (floorFilter !== 'all' && r.floor.toString() !== floorFilter) return false

      if (calendarSearch.trim()) {
        const q = calendarSearch.toLowerCase().trim()
        const matchesRoom = r.room_number.includes(q) || r.room_type.toLowerCase().includes(q)
        const hasMatchingBooking = bookings.some(
          b =>
            b.room_id === r.id &&
            ((b.guest_first_name || '').toLowerCase().includes(q) ||
              (b.guest_last_name || '').toLowerCase().includes(q) ||
              `${b.guest_first_name || ''} ${b.guest_last_name || ''}`.toLowerCase().includes(q) ||
              (b.booking_reference || '').toLowerCase().includes(q))
        )
        if (!matchesRoom && !hasMatchingBooking) return false
      }
      return true
    })
  }, [rooms, filter, floorFilter, calendarSearch, bookings])

  const grouped: Record<string, Room[]> = useMemo(() => {
    const res: Record<string, Room[]> = {}
    filteredRooms.forEach(r => {
      if (!res[r.room_type]) res[r.room_type] = []
      res[r.room_type].push(r)
    })
    return res
  }, [filteredRooms])

  const handleQuickSubmit = async () => {
    if (!quickCreate || !quickForm.firstName || !quickForm.checkOut) {
      toast.error('Please fill in guest name and check-out date')
      return
    }
    setQuickSaving(true)
    const ref = generateBookingReference()
    const { error } = await supabase.from('bookings').insert({
      booking_reference: ref,
      room_id: quickCreate.room.id,
      guest_first_name: quickForm.firstName,
      guest_last_name: quickForm.lastName || '',
      check_in_date: quickCreate.date,
      check_out_date: quickForm.checkOut,
      adults: 1, children: 0,
      total_amount: parseFloat(quickForm.amount) || 0,
      currency: 'GBP',
      source: quickForm.source,
      status: 'confirmed',
      is_ical_imported: false,
      is_maintenance_block: false,
    })
    if (error) { toast.error('Failed to create booking'); setQuickSaving(false); return }
    toast.success(`✅ Booking ${ref} created!`)
    setQuickCreate(null)
    setQuickForm({ firstName: '', lastName: '', checkOut: '', source: 'direct', amount: '' })
    setQuickSaving(false)
    fetchData()
  }

  const paidAmount  = selectedPayments.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0)
  const outstanding = selectedBooking ? Math.max(0, selectedBooking.total_amount - paidAmount) : 0

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Navigation */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setStartDate(d => addDays(d, -30))} title="Back 30 days" className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronsLeft className="w-4 h-4" /></button>
          <button onClick={() => setStartDate(d => addDays(d, -7))}  className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft  className="w-4 h-4" /></button>
          <button onClick={() => setStartDate(startOfDay(new Date()))} className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Today</button>
          <button onClick={() => setStartDate(d => addDays(d, 7))}   className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight  className="w-4 h-4" /></button>
          <button onClick={() => setStartDate(d => addDays(d, 30))}  title="Forward 30 days" className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronsRight className="w-4 h-4" /></button>
        </div>

        <span className="text-sm font-semibold text-slate-700">
          {format(startDate, 'dd MMM')} – {format(addDays(startDate, daysVisible - 1), 'dd MMM yyyy')}
        </span>

        {/* Days visible */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {([14, 30, 60] as DaysVisible[]).map(d => (
            <button key={d} onClick={() => setDaysVisible(d)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition', daysVisible === d ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100')}>
              {d}d
            </button>
          ))}
        </div>

        {/* Colour mode */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(['source', 'status'] as ColorMode[]).map(m => (
            <button key={m} onClick={() => setColorMode(m)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition', colorMode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
              {m === 'source' ? 'By Source' : 'By Status'}
            </button>
          ))}
        </div>

        {/* Search Room or Guest */}
        <div className="relative min-w-[170px] max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search room or guest..."
            value={calendarSearch}
            onChange={e => setCalendarSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {calendarSearch && (
            <button onClick={() => setCalendarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>

        {/* Floor Filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={floorFilter}
            onChange={e => setFloorFilter(e.target.value)}
            className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Floors</option>
            {floors.map(f => (
              <option key={f} value={f.toString()}>
                {f === 0 ? 'Ground Floor' : `Floor ${f}`}
              </option>
            ))}
          </select>
        </div>

        {/* Room type filter */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 ml-auto">
          {(['all', 'single', 'double', 'twin_single', 'family'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition capitalize', filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
              {f === 'all' ? 'All Types' : f === 'twin_single' ? 'Twin' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {(calendarSearch || filter !== 'all' || floorFilter !== 'all') && (
          <button
            onClick={() => {
              setCalendarSearch('')
              setFilter('all')
              setFloorFilter('all')
            }}
            title="Reset Filters"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium hover:bg-rose-100 transition"
          >
            <RotateCcw className="w-3 h-3" /> Clear ({filteredRooms.length}/{rooms.length})
          </button>
        )}

        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition disabled:opacity-50">
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync iCal'}
        </button>

        <Link href="/admin/bookings?new=true"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition">
          <Plus className="w-4 h-4" /> New Booking
        </Link>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        {colorMode === 'source' ? (
          <>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" />Booking.com</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" />Walk-in</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-purple-500" />Direct</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" />Maintenance</div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" />Confirmed</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" />Checked In</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-400" />Checked Out</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-500" />No Show</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" />Maintenance</div>
          </>
        )}
        <span className="ml-auto text-slate-300 italic">Click any empty cell to quick-create a booking</span>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading calendar…</div>
        ) : (
          <div className="overflow-auto">

            {/* Date header */}
            <div className="flex sticky top-0 z-10 bg-slate-800" style={{ minWidth: LABEL_WIDTH + daysVisible * cellWidth }}>
              <div className="flex-shrink-0 bg-slate-800 text-white text-xs font-medium px-4 flex items-center" style={{ width: LABEL_WIDTH }}>
                Room
              </div>
              {days.map((day, i) => {
                const dateStr   = format(day, 'yyyy-MM-dd')
                const isToday   = dateStr === todayStr
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const occ       = getDayOccupancy(dateStr)
                return (
                  <div key={i}
                    className={cn('flex-shrink-0 text-center text-xs py-2 border-l border-slate-700 flex flex-col items-center justify-center gap-0.5',
                      isToday ? 'bg-blue-600 text-white font-bold' : isWeekend ? 'bg-slate-700/80 text-slate-200' : 'text-slate-300')}
                    style={{ width: cellWidth }}>
                    <div className="font-semibold">{format(day, 'd')}</div>
                    <div style={{ fontSize: 9 }} className={isToday ? 'text-blue-200' : 'text-slate-500'}>{format(day, 'EEE')}</div>
                    {daysVisible <= 30 && (
                      <div className={cn('font-mono leading-none', isToday ? 'text-blue-200' : occ >= rooms.length * 0.8 ? 'text-green-400' : occ >= rooms.length * 0.5 ? 'text-yellow-400' : 'text-slate-500')}
                        style={{ fontSize: 8 }}>
                        {occ}/{rooms.length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Room rows */}
            {Object.entries(grouped).map(([type, typeRooms]) => (
              <div key={type}>
                <div className="flex items-center bg-slate-100 border-t border-slate-200 px-4 py-1.5" style={{ minWidth: LABEL_WIDTH + daysVisible * cellWidth }}>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {getRoomTypeLabel(type as any)} ({typeRooms.length} rooms)
                  </span>
                </div>

                {typeRooms.map(room => {
                  const roomBookings = bookings.filter(b => b.room_id === room.id)
                  return (
                    <div key={room.id} className="flex relative border-t border-slate-100 hover:bg-slate-50/50 transition"
                      style={{ height: ROW_HEIGHT, minWidth: LABEL_WIDTH + daysVisible * cellWidth }}>

                      {/* Room label */}
                      <div className="flex-shrink-0 flex items-center px-4 gap-2 bg-white sticky left-0 z-10 border-r border-slate-100" style={{ width: LABEL_WIDTH }}>
                        <span className="text-sm font-semibold text-slate-700">{room.room_number}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
                          room.cleaning_status === 'dirty'    ? 'bg-red-100 text-red-600' :
                          room.cleaning_status === 'cleaning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700')}>
                          {room.cleaning_status === 'dirty' ? '🔴' : room.cleaning_status === 'cleaning' ? '🟡' : '🟢'}
                        </span>
                      </div>

                      {/* Day cells (clickable empties) */}
                      <div className="relative flex" style={{ width: daysVisible * cellWidth }}>
                        {days.map((day, di) => {
                          const dateStr    = format(day, 'yyyy-MM-dd')
                          const isToday    = dateStr === todayStr
                          const isWeekend  = day.getDay() === 0 || day.getDay() === 6
                          const hasBooking = roomBookings.some(b => b.check_in_date <= dateStr && b.check_out_date > dateStr)
                          return (
                            <div key={di}
                              className={cn('flex-shrink-0 border-l border-slate-100 transition',
                                isToday   ? 'bg-blue-50/60'   : isWeekend ? 'bg-slate-50/80' : '',
                                !hasBooking && 'cursor-pointer hover:bg-blue-50')}
                              style={{ width: cellWidth }}
                              onClick={() => { if (!hasBooking) setQuickCreate({ room, date: dateStr }) }}
                              title={!hasBooking ? `Quick-create booking · Room ${room.room_number} · ${format(day, 'dd MMM yyyy')}` : undefined}
                            />
                          )
                        })}

                        {/* Booking bars */}
                        {roomBookings.map(booking => {
                          const checkIn     = parseISO(booking.check_in_date)
                          const checkOut    = parseISO(booking.check_out_date)
                          const visibleStart = checkIn  < startDate                    ? startDate                    : checkIn
                          const visibleEnd   = checkOut > addDays(startDate, daysVisible) ? addDays(startDate, daysVisible) : checkOut
                          const startOffset  = Math.max(0, differenceInDays(visibleStart, startDate))
                          const duration     = differenceInDays(visibleEnd, visibleStart)
                          if (duration <= 0) return null
                          const color = getBarColor(booking, colorMode)
                          return (
                            <button key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              onMouseEnter={e => { setHoveredBooking(booking); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                              onMouseMove={e  => setTooltipPos({ x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setHoveredBooking(null)}
                              className={cn('absolute top-2 bottom-2 rounded-md border text-white text-xs font-medium truncate px-2 flex items-center cursor-pointer hover:brightness-110 transition z-10', color)}
                              style={{ left: startOffset * cellWidth + 2, width: duration * cellWidth - 4 }}>
                              {booking.is_maintenance_block
                                ? `🔧 ${booking.maintenance_reason ?? 'Maintenance'}`
                                : daysVisible === 60
                                  ? booking.guest_first_name.charAt(0) + '.'
                                  : `${booking.guest_first_name} ${booking.guest_last_name}`}
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

      {/* ── Hover Tooltip ── */}
      {hoveredBooking && (
        <div className="fixed z-50 pointer-events-none bg-slate-900 text-white text-xs rounded-xl shadow-2xl p-3 min-w-[210px]"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 8 }}>
          {hoveredBooking.is_maintenance_block ? (
            <p className="font-semibold">🔧 {hoveredBooking.maintenance_reason ?? 'Maintenance Block'}</p>
          ) : (
            <>
              <p className="font-semibold text-sm">{hoveredBooking.guest_first_name} {hoveredBooking.guest_last_name}</p>
              <p className="text-slate-400 mt-1">{formatDate(hoveredBooking.check_in_date)} → {formatDate(hoveredBooking.check_out_date)}</p>
              <p className="text-slate-400">{differenceInDays(parseISO(hoveredBooking.check_out_date), parseISO(hoveredBooking.check_in_date))} nights</p>
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-700">
                <span className="font-bold text-green-400">{formatCurrency(hoveredBooking.total_amount)}</span>
                <span className="text-slate-400 capitalize">{hoveredBooking.status?.replace('_', ' ')} · {hoveredBooking.source?.replace('_com', '.com').replace('_', '-')}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Booking Detail Popup ── */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  {selectedBooking.is_maintenance_block ? '🔧 Maintenance Block' : `${selectedBooking.guest_first_name} ${selectedBooking.guest_last_name}`}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedBooking.booking_reference}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Check-in</span><span className="font-medium">{formatDate(selectedBooking.check_in_date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Check-out</span><span className="font-medium">{formatDate(selectedBooking.check_out_date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Nights</span><span className="font-medium">{differenceInDays(parseISO(selectedBooking.check_out_date), parseISO(selectedBooking.check_in_date))}</span></div>
              {!selectedBooking.is_maintenance_block && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guests</span>
                    <span>{selectedBooking.adults} adults{selectedBooking.children > 0 ? `, ${selectedBooking.children} children` : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Source</span>
                    <span className={cn('px-2 py-0.5 rounded text-xs text-white', getBookingSourceColor(selectedBooking.source))}>
                      {selectedBooking.source?.replace('_', '.').replace('com', '.com')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className={cn('px-2 py-0.5 rounded text-xs capitalize font-medium',
                      selectedBooking.status === 'checked_in'  ? 'bg-green-100 text-green-700' :
                      selectedBooking.status === 'confirmed'   ? 'bg-blue-100 text-blue-700' :
                      selectedBooking.status === 'checked_out' ? 'bg-slate-100 text-slate-600' :
                      'bg-orange-100 text-orange-700')}>
                      {selectedBooking.status?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Payment info */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment</span>
                    </div>
                    {loadingPayments ? (
                      <p className="text-xs text-slate-400">Loading…</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-semibold">{formatCurrency(selectedBooking.total_amount)}</span></div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Paid</span>
                          <span className={cn('font-semibold flex items-center gap-1', paidAmount >= selectedBooking.total_amount ? 'text-green-600' : 'text-slate-700')}>
                            {formatCurrency(paidAmount)}
                            {paidAmount >= selectedBooking.total_amount && paidAmount > 0 && <Check className="w-3.5 h-3.5" />}
                          </span>
                        </div>
                        {outstanding > 0 && (
                          <div className="flex justify-between"><span className="text-slate-400">Outstanding</span><span className="font-bold text-red-600">{formatCurrency(outstanding)}</span></div>
                        )}
                        <div className={cn('text-xs font-medium rounded-lg px-3 py-1.5 text-center mt-1',
                          paidAmount === 0 ? 'bg-red-50 text-red-600' : outstanding > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600')}>
                          {paidAmount === 0 ? '⚠️ No payment recorded' : outstanding > 0 ? `⚠️ ${formatCurrency(outstanding)} outstanding` : '✅ Fully paid'}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedBooking.special_requests && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-400 text-xs mb-1">Special Requests</p>
                  <p className="text-slate-700">{selectedBooking.special_requests}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <Link href={`/admin/bookings/${selectedBooking.id}`}
                className="flex-1 text-center py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition">
                View Full Details →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Create Booking ── */}
      {quickCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setQuickCreate(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800">⚡ Quick Create Booking</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Room {quickCreate.room.room_number} · {quickCreate.room.room_type.replace('_', ' ')} · £{quickCreate.room.base_price}/night
                </p>
                <p className="text-xs font-medium text-blue-600 mt-0.5">
                  Check-in: {format(parseISO(quickCreate.date), 'EEEE dd MMM yyyy')}
                </p>
              </div>
              <button onClick={() => setQuickCreate(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">First Name *</label>
                  <input type="text" value={quickForm.firstName} onChange={e => setQuickForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="John" autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
                  <input type="text" value={quickForm.lastName} onChange={e => setQuickForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Smith"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Check-out Date *</label>
                <input type="date" value={quickForm.checkOut} min={addDays(parseISO(quickCreate.date), 1).toISOString().split('T')[0]}
                  onChange={e => setQuickForm(f => ({ ...f, checkOut: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
                  <select value={quickForm.source} onChange={e => setQuickForm(f => ({ ...f, source: e.target.value as any }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="direct">Direct</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="booking_com">Booking.com</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Total (£)</label>
                  <input type="number" value={quickForm.amount}
                    onChange={e => setQuickForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={`${quickCreate.room.base_price}`}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setQuickCreate(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleQuickSubmit} disabled={quickSaving}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 transition disabled:opacity-50">
                {quickSaving ? 'Creating…' : 'Create Booking'}
              </button>
            </div>

            <p className="text-xs text-center text-slate-400 mt-3">
              Need to add payment, special requests or more guests?{' '}
              <Link href="/admin/bookings?new=true" className="text-blue-500 hover:underline">Use the full form →</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
