'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, Booking, MaintenanceTicket } from '@/lib/types'
import { formatDate, getCleaningStatusColor, getCleaningStatusLabel, cn } from '@/lib/utils'
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  Loader2,
  Plus,
  X,
  Sparkles,
  Search,
  Bed,
  SprayCan,
  ShieldCheck,
  RotateCcw,
  User,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import RoomCleaningModal from '@/components/housekeeping/RoomCleaningModal'
import { HOUSEKEEPING_CART_CHEMICALS } from '@/lib/cleaning-checklist'

export default function HousekeepingDashboard() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [todayDepartures, setTodayDepartures] = useState<(Booking & { room?: Room })[]>([])
  const [todayArrivals, setTodayArrivals] = useState<(Booking & { room?: Room })[]>([])
  const [loading, setLoading] = useState(true)
  const [cleanerName, setCleanerName] = useState('')
  const [showCleanerModal, setShowCleanerModal] = useState(false)

  // Active cleaning modal
  const [activeCleaningRoom, setActiveCleaningRoom] = useState<Room | null>(null)

  // Maintenance ticket modal
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketRoom, setTicketRoom] = useState<Room | null>(null)
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'medium' })
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'rooms' | 'cart' | 'schedule'>('rooms')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'dirty' | 'cleaning' | 'clean'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Trolley chemicals checklist state
  const [cartChecked, setCartChecked] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('housekeeping_cart_checked')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return {}
  })

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const saved = localStorage.getItem('cleanerName')
    if (saved) {
      setCleanerName(saved)
    } else {
      setShowCleanerModal(true)
    }
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: roomsData }, { data: departuresData }, { data: arrivalsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_out_date', today).in('status', ['confirmed', 'checked_in', 'checked_out']),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_in_date', today).in('status', ['confirmed', 'checked_in']),
    ])
    setRooms(roomsData ?? [])
    setTodayDepartures(departuresData ?? [])
    setTodayArrivals(arrivalsData ?? [])
    setLoading(false)
  }

  // Handle raise maintenance ticket
  const handleRaiseTicket = async () => {
    if (!ticketRoom || !ticketForm.title) return
    setSubmittingTicket(true)
    const { error } = await supabase.from('maintenance_tickets').insert({
      room_id: ticketRoom.id,
      reported_by: cleanerName || 'Housekeeping',
      title: ticketForm.title,
      description: ticketForm.description || null,
      priority: ticketForm.priority as any,
      status: 'open',
    })
    if (error) {
      toast.error('Failed to raise ticket')
    } else {
      toast.success('Ticket raised & alerted to Front Desk/Management ✓')
      setShowTicketModal(false)
      setTicketForm({ title: '', description: '', priority: 'medium' })
    }
    setSubmittingTicket(false)
  }

  // Toggle chemical item
  const toggleCartItem = (name: string) => {
    setCartChecked(prev => {
      const next = { ...prev, [name]: !prev[name] }
      try {
        localStorage.setItem('housekeeping_cart_checked', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  // Available floors
  const availableFloors = useMemo(() => {
    const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b)
    return floors
  }, [rooms])

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Floor filter
      if (floorFilter !== 'all' && String(room.floor) !== floorFilter) return false

      // Status filter
      if (statusFilter === 'dirty' && room.cleaning_status !== 'dirty') return false
      if (statusFilter === 'cleaning' && room.cleaning_status !== 'cleaning') return false
      if (statusFilter === 'clean' && room.cleaning_status !== 'clean' && room.cleaning_status !== 'inspected') return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchNumber = room.room_number.toLowerCase().includes(query)
        const matchType = room.room_type.toLowerCase().includes(query)
        if (!matchNumber && !matchType) return false
      }

      return true
    })
  }, [rooms, floorFilter, statusFilter, searchQuery])

  // Counters
  const dirtyCount = rooms.filter(r => r.cleaning_status === 'dirty').length
  const cleaningCount = rooms.filter(r => r.cleaning_status === 'cleaning').length
  const cleanCount = rooms.filter(r => r.cleaning_status === 'clean' || r.cleaning_status === 'inspected').length

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              🏨
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">Patten Arms Housekeeping</h1>
              <p className="text-slate-400 text-xs">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowCleanerModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-200 transition"
              title="Tap to change cleaner name"
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-white max-w-[90px] truncate">{cleanerName || 'Set Name'}</span>
            </button>

            <button
              onClick={async () => {
                sessionStorage.removeItem('patten_hotel_session_active')
                sessionStorage.removeItem('patten_hotel_last_activity')
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-red-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-red-500/30 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* KPI Counter Strip */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div
            onClick={() => setStatusFilter('dirty')}
            className={cn(
              'bg-white border rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition shadow-xs',
              statusFilter === 'dirty' ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 hover:border-red-300'
            )}
          >
            <p className="text-xl sm:text-2xl font-black text-red-600">{dirtyCount}</p>
            <p className="text-[11px] sm:text-xs font-bold text-red-600/90 uppercase tracking-wider mt-0.5">To Clean</p>
          </div>

          <div
            onClick={() => setStatusFilter('cleaning')}
            className={cn(
              'bg-white border rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition shadow-xs',
              statusFilter === 'cleaning' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200 hover:border-amber-300'
            )}
          >
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl sm:text-2xl font-black text-amber-600">{cleaningCount}</span>
              {cleaningCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />}
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-amber-600/90 uppercase tracking-wider mt-0.5">Cleaning</p>
          </div>

          <div
            onClick={() => setStatusFilter('clean')}
            className={cn(
              'bg-white border rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition shadow-xs',
              statusFilter === 'clean' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300'
            )}
          >
            <p className="text-xl sm:text-2xl font-black text-emerald-600">{cleanCount}</p>
            <p className="text-[11px] sm:text-xs font-bold text-emerald-600/90 uppercase tracking-wider mt-0.5">Ready</p>
          </div>

          <div
            onClick={() => setActiveTab('schedule')}
            className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition shadow-xs"
          >
            <p className="text-xl sm:text-2xl font-black text-blue-600">{todayDepartures.length}</p>
            <p className="text-[11px] sm:text-xs font-bold text-blue-600/90 uppercase tracking-wider mt-0.5">Departures</p>
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('rooms')}
            className={cn(
              'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2',
              activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Bed className="w-4 h-4 text-blue-600" />
            <span>Room Inspection ({filteredRooms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cart')}
            className={cn(
              'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2',
              activeTab === 'cart' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <SprayCan className="w-4 h-4 text-purple-600" />
            <span>Trolley Chemicals</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={cn(
              'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2',
              activeTab === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Today's Schedule</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading housekeeping roster...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: ROOMS VIEW */}
            {activeTab === 'rooms' && (
              <div className="space-y-3">
                {/* Search & Filter Controls */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-3 shadow-xs">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search room number (e.g. 101, 204)..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Floor Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                      Floor:
                    </span>
                    <button
                      onClick={() => setFloorFilter('all')}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition',
                        floorFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      All Floors
                    </button>
                    {availableFloors.map(floor => (
                      <button
                        key={floor}
                        onClick={() => setFloorFilter(String(floor))}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition',
                          floorFilter === String(floor)
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
                      </button>
                    ))}
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                      Status:
                    </span>
                    {(['all', 'dirty', 'cleaning', 'clean'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 capitalize transition',
                          statusFilter === s
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {s === 'all'
                          ? `All (${rooms.length})`
                          : s === 'dirty'
                          ? `🔴 To Clean (${dirtyCount})`
                          : s === 'cleaning'
                          ? `🟡 In Progress (${cleaningCount})`
                          : `🟢 Clean (${cleanCount})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rooms Grid */}
                {filteredRooms.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-800 text-base">No rooms match your filters</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting filters or clear your search</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRooms.map(room => {
                      const isDeparture = todayDepartures.some(b => (b as any).room_id === room.id)
                      const isArrival = todayArrivals.some(b => (b as any).room_id === room.id)
                      const arrivalBooking = todayArrivals.find(b => (b as any).room_id === room.id)

                      return (
                        <div
                          key={room.id}
                          className={cn(
                            'bg-white rounded-2xl border-2 p-4 transition-all shadow-xs hover:shadow-md',
                            room.cleaning_status === 'dirty'
                              ? 'border-red-300/80 bg-gradient-to-r from-red-50/20 to-white'
                              : room.cleaning_status === 'cleaning'
                              ? 'border-amber-400 bg-gradient-to-r from-amber-50/30 to-white'
                              : 'border-emerald-300/80 bg-gradient-to-r from-emerald-50/20 to-white'
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                  Room {room.room_number}
                                </span>
                                <span
                                  className={cn(
                                    'text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                                    getCleaningStatusColor(room.cleaning_status)
                                  )}
                                >
                                  {getCleaningStatusLabel(room.cleaning_status)}
                                </span>
                                {room.cleaning_status === 'cleaning' && (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3 animate-spin" />
                                    Active Clean
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-500 capitalize mt-1 font-medium">
                                {room.room_type?.replace('_', ' ')} · {room.floor === 0 ? 'Ground Floor' : `Floor ${room.floor}`}
                              </p>

                              {/* Priority Alerts */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {isDeparture && (
                                  <span className="inline-flex items-center gap-1 text-[11px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-md">
                                    ⚠️ Departure Today — Priority Turn
                                  </span>
                                )}
                                {isArrival && (
                                  <span className="inline-flex items-center gap-1 text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                                    ✈️ Arrival Today
                                    {arrivalBooking?.estimated_arrival_time && ` (ETA: ${arrivalBooking.estimated_arrival_time})`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              {/* Primary Action Button */}
                              {room.cleaning_status === 'dirty' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveCleaningRoom(room)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Start Cleaning
                                </button>
                              )}

                              {room.cleaning_status === 'cleaning' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveCleaningRoom(room)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
                                >
                                  <RotateCcw className="w-4 h-4 animate-spin" />
                                  Resume Checklist
                                </button>
                              )}

                              {(room.cleaning_status === 'clean' || room.cleaning_status === 'inspected') && (
                                <button
                                  type="button"
                                  onClick={() => setActiveCleaningRoom(room)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  Checklist Details
                                </button>
                              )}

                              {/* Secondary: Report Maintenance */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTicketRoom(room)
                                  setTicketForm({ title: '', description: '', priority: 'medium' })
                                  setShowTicketModal(true)
                                }}
                                className="px-3 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs sm:text-sm font-semibold rounded-xl border border-orange-200 transition"
                                title="Report Maintenance Issue"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CART SUPPLIES & CHEMICALS */}
            {activeTab === 'cart' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                        <SprayCan className="w-5 h-5 text-purple-600" />
                        Commercial Grade Room-Cleaning Chemicals
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Client specified cleaning solutions & cart preparation checklist
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const allChecked: Record<string, boolean> = {}
                        HOUSEKEEPING_CART_CHEMICALS.forEach(c => (allChecked[c.name] = true))
                        setCartChecked(allChecked)
                        try {
                          localStorage.setItem('housekeeping_cart_checked', JSON.stringify(allChecked))
                        } catch (e) {}
                        toast.success('All cart chemicals verified! ✓')
                      }}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition shrink-0"
                    >
                      Check All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {HOUSEKEEPING_CART_CHEMICALS.map(chemical => {
                      const isChecked = !!cartChecked[chemical.name]
                      return (
                        <div
                          key={chemical.name}
                          onClick={() => toggleCartItem(chemical.name)}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none',
                            isChecked ? 'bg-purple-50/60 border-purple-300' : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                          )}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition shrink-0',
                              isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300'
                            )}
                          >
                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className={cn('text-xs sm:text-sm font-bold', isChecked ? 'text-purple-900' : 'text-slate-800')}>
                              {chemical.name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{chemical.usage}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TODAY'S SCHEDULE */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                {/* Departures */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Check-outs Today ({todayDepartures.length})
                  </h3>
                  {todayDepartures.length === 0 ? (
                    <p className="text-slate-400 text-xs py-3 text-center">No departures scheduled for today.</p>
                  ) : (
                    <div className="space-y-2">
                      {todayDepartures.map(b => (
                        <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-sm font-bold text-slate-800">
                              Room {(b as any).room?.room_number}
                            </span>
                            <span className="text-xs text-slate-500 ml-2 font-medium">
                              {b.guest_first_name} {b.guest_last_name}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                              b.status === 'checked_out' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                            )}
                          >
                            {b.status === 'checked_out' ? 'Key Returned / Vacated' : 'Departing Today'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Arrivals */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Arrivals Today ({todayArrivals.length})
                  </h3>
                  {todayArrivals.length === 0 ? (
                    <p className="text-slate-400 text-xs py-3 text-center">No arrivals scheduled for today.</p>
                  ) : (
                    <div className="space-y-2">
                      {todayArrivals.map(b => (
                        <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-sm font-bold text-slate-800">
                              Room {(b as any).room?.room_number}
                            </span>
                            <span className="text-xs text-slate-500 ml-2 font-medium">
                              {b.guest_first_name} {b.guest_last_name}
                            </span>
                            {b.estimated_arrival_time && (
                              <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                                Estimated Arrival: {b.estimated_arrival_time}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Expected
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL 1: Interactive Room Cleaning Modal */}
      {activeCleaningRoom && (
        <RoomCleaningModal
          room={activeCleaningRoom}
          cleanerName={cleanerName}
          onClose={() => {
            setActiveCleaningRoom(null)
            fetchData()
          }}
          onComplete={cleanedRoom => {
            setActiveCleaningRoom(null)
            fetchData()
          }}
          onReportIssue={(room, itemTitle) => {
            setTicketRoom(room)
            setTicketForm({
              title: itemTitle ? `Issue with ${itemTitle}` : '',
              description: '',
              priority: 'medium',
            })
            setShowTicketModal(true)
          }}
        />
      )}

      {/* MODAL 2: Cleaner Name Input Modal */}
      {showCleanerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-3">
              👋
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Who is cleaning today?</h3>
            <p className="text-slate-400 text-xs mb-4">
              Enter your name to sign your official room inspection and cleaning records.
            </p>
            <input
              type="text"
              placeholder="e.g. Maria, John, Sarah..."
              defaultValue={cleanerName}
              id="cleaner-input"
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 bg-slate-50 font-medium"
            />
            <button
              type="button"
              onClick={() => {
                const val = (document.getElementById('cleaner-input') as HTMLInputElement)?.value
                if (val && val.trim()) {
                  const trimmed = val.trim()
                  setCleanerName(trimmed)
                  try {
                    localStorage.setItem('cleanerName', trimmed)
                  } catch (e) {}
                  setShowCleanerModal(false)
                } else {
                  toast.error('Please enter your name')
                }
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition"
            >
              Confirm & Start Shift
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Maintenance Ticket Reporting */}
      {showTicketModal && ticketRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Report Issue — Room {ticketRoom.room_number}</h3>
              </div>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  Issue Title *
                </label>
                <input
                  type="text"
                  value={ticketForm.title}
                  onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Broken kettle, TV remote missing, leaking shower..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  Details / Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ticketForm.description}
                  onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe location, severity or replacement needed..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTicketForm(f => ({ ...f, priority: p }))}
                      className={cn(
                        'py-2 text-xs font-bold rounded-xl capitalize transition border',
                        ticketForm.priority === p
                          ? {
                              low: 'bg-slate-800 text-white border-slate-800',
                              medium: 'bg-amber-500 text-white border-amber-500',
                              high: 'bg-orange-500 text-white border-orange-500',
                              urgent: 'bg-red-600 text-white border-red-600',
                            }[p]
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRaiseTicket}
              disabled={submittingTicket || !ticketForm.title.trim()}
              className="w-full mt-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {submittingTicket && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Alert to Front Desk & Management
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
