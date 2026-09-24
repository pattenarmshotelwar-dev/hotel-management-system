'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, CleaningLog, MaintenanceTicket, CleaningStatus } from '@/lib/types'
import {
  formatDateTime,
  getCleaningStatusColor,
  getCleaningStatusLabel,
  getTicketPriorityColor,
  getTicketPriorityLabel,
  getTicketStatusLabel,
  getRoomTypeLabel,
  cn,
} from '@/lib/utils'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  Plus,
  Filter,
  Check,
  Building,
  Layers,
  Search,
  MessageSquare,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  RotateCcw,
  X,
  BedDouble,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import NewTicketModal from '@/components/housekeeping/NewTicketModal'
import WhatsAppAlertModal from '@/components/housekeeping/WhatsAppAlertModal'

export default function HousekeepingAdminPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [tickets, setTickets] = useState<(MaintenanceTicket & { room?: Room })[]>([])
  const [cleaningLogs, setCleaningLogs] = useState<(CleaningLog & { room?: Room })[]>([])
  const [todayArrivals, setTodayArrivals] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'rooms' | 'tickets' | 'logs'>('rooms')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [cleaningFilter, setCleaningFilter] = useState<string>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all')
  const [defectFilter, setDefectFilter] = useState<'all' | 'has_defect' | 'no_defect'>('all')
  const [roomSortBy, setRoomSortBy] = useState<'room_asc' | 'room_desc' | 'urgency' | 'status' | 'floor_asc'>('room_asc')
  const [showRoomAdvanced, setShowRoomAdvanced] = useState(false)
  const [search, setSearch] = useState('')

  // Maintenance Ticket Filters
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all')
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketSortBy, setTicketSortBy] = useState<'urgent_first' | 'created_desc' | 'created_asc' | 'room_asc'>('urgent_first')

  // Modals & Actions
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
  const [whatsAppModalRoom, setWhatsAppModalRoom] = useState<Room | null>(null)
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [
      { data: roomsData },
      { data: ticketsData },
      { data: logsData },
      { data: arrivalsData },
    ] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('maintenance_tickets').select('*, room:rooms(room_number, room_type)').order('created_at', { ascending: false }),
      supabase.from('cleaning_logs').select('*, room:rooms(room_number, room_type)').order('completed_at', { ascending: false }).limit(100),
      supabase.from('bookings').select('room_id').eq('check_in_date', todayStr).in('status', ['confirmed', 'checked_in']),
    ])

    setRooms(roomsData ?? [])
    setTickets((ticketsData as any) ?? [])
    setCleaningLogs((logsData as any) ?? [])
    setTodayArrivals((arrivalsData ?? []).map((b: any) => b.room_id))
    setLoading(false)
  }

  // Quick Status Change on Room Card
  const handleRoomStatusChange = async (room: Room, newStatus: CleaningStatus) => {
    setUpdatingRoomId(room.id)
    const oldStatus = room.cleaning_status

    const [{ error: roomError }] = await Promise.all([
      supabase.from('rooms').update({ cleaning_status: newStatus }).eq('id', room.id),
      supabase.from('cleaning_logs').insert({
        room_id: room.id,
        cleaner_name: 'Management Inspection',
        status_before: oldStatus,
        status_after: newStatus,
        completed_at: new Date().toISOString(),
        notes: `Status updated to ${newStatus} via Admin Grid`,
      }),
    ])

    if (roomError) {
      toast.error('Failed to update room cleaning status')
    } else {
      toast.success(`Room ${room.room_number} set to ${getCleaningStatusLabel(newStatus)}`)
      // Optimistic update
      setRooms(prev => prev.map(r => (r.id === room.id ? { ...r, cleaning_status: newStatus } : r)))
    }
    setUpdatingRoomId(null)
  }

  // Bulk Clean all filtered rooms
  const handleBulkMarkClean = async () => {
    const dirtyInFilter = filteredRooms.filter(r => r.cleaning_status !== 'clean' && r.cleaning_status !== 'inspected')
    if (dirtyInFilter.length === 0) {
      toast.info('No dirty rooms to update in current view')
      return
    }
    if (!confirm(`Mark ${dirtyInFilter.length} room(s) in this view as Clean?`)) return

    setLoading(true)
    const ids = dirtyInFilter.map(r => r.id)
    const { error } = await supabase.from('rooms').update({ cleaning_status: 'clean' }).in('id', ids)

    if (error) {
      toast.error('Failed to bulk update')
    } else {
      toast.success(`${dirtyInFilter.length} rooms marked as Clean!`)
      fetchData()
    }
    setLoading(false)
  }

  const handleTicketStatus = async (ticketId: string, newStatus: string) => {
    const update: any = { status: newStatus }
    if (newStatus === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolved_by = 'Management'
    }
    const { error } = await supabase.from('maintenance_tickets').update(update).eq('id', ticketId)
    if (error) {
      toast.error('Failed to update ticket')
    } else {
      toast.success(`Ticket marked as ${newStatus}`)
      fetchData()
    }
  }

  const handleExportLogs = () => {
    const csv = [
      ['Date & Time', 'Room', 'Cleaner', 'Status Before', 'Status After', 'Notes'],
      ...cleaningLogs.map(l => [
        formatDateTime(l.completed_at),
        (l.room as any)?.room_number ?? '',
        `"${l.cleaner_name}"`,
        l.status_before ?? '',
        l.status_after,
        `"${l.notes ?? ''}"`,
      ]),
    ]
      .map(r => r.join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cleaning-logs-${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Stats
  const dirty = rooms.filter(r => r.cleaning_status === 'dirty').length
  const cleaning = rooms.filter(r => r.cleaning_status === 'cleaning').length
  const clean = rooms.filter(r => r.cleaning_status === 'clean' || r.cleaning_status === 'inspected').length
  const openTickets = tickets.filter(t => t.status === 'open').length
  const urgentTickets = tickets.filter(t => t.status === 'open' && t.priority === 'urgent').length

  // Unique floors and room types
  const floors = useMemo(() => {
    const set = new Set(rooms.map(r => r.floor))
    return Array.from(set).sort((a, b) => a - b)
  }, [rooms])

  const roomTypes = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.room_type).filter(Boolean)))
  }, [rooms])

  const openTicketsByRoom = useMemo(() => {
    return new Set(tickets.filter(t => t.status === 'open').map(t => t.room_id))
  }, [tickets])

  const ticketCategories = useMemo(() => {
    return Array.from(new Set(tickets.map(t => (t as any).category).filter(Boolean)))
  }, [tickets])

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    const result = rooms.filter(r => {
      const hasArrivalToday = todayArrivals.includes(r.id)
      const hasOpenTicket = openTicketsByRoom.has(r.id)

      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchesSearch = r.room_number.includes(q) || r.room_type.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // Floor
      if (floorFilter !== 'all' && r.floor.toString() !== floorFilter) return false

      // Room Type
      if (roomTypeFilter !== 'all' && r.room_type !== roomTypeFilter) return false

      // Defect filter
      if (defectFilter === 'has_defect' && !hasOpenTicket) return false
      if (defectFilter === 'no_defect' && hasOpenTicket) return false

      // Urgency & Cleaning Status Filter
      if (urgencyFilter === 'priority_arrival') {
        if (!hasArrivalToday || ['clean', 'inspected'].includes(r.cleaning_status)) return false
      } else if (urgencyFilter === 'arrival_today') {
        if (!hasArrivalToday) return false
      } else if (urgencyFilter === 'dirty') {
        if (r.cleaning_status !== 'dirty') return false
      } else if (urgencyFilter === 'cleaning') {
        if (r.cleaning_status !== 'cleaning') return false
      } else if (urgencyFilter === 'clean') {
        if (!['clean', 'inspected'].includes(r.cleaning_status)) return false
      } else if (urgencyFilter === 'inspected') {
        if (r.cleaning_status !== 'inspected') return false
      } else if (cleaningFilter !== 'all') {
        if (cleaningFilter === 'dirty' && r.cleaning_status !== 'dirty') return false
        if (cleaningFilter === 'cleaning' && r.cleaning_status !== 'cleaning') return false
        if (cleaningFilter === 'clean' && !['clean', 'inspected'].includes(r.cleaning_status)) return false
      }

      return true
    })

    return [...result].sort((a, b) => {
      const aArrival = todayArrivals.includes(a.id)
      const bArrival = todayArrivals.includes(b.id)

      if (roomSortBy === 'urgency') {
        const score = (r: Room, arr: boolean) => {
          if (arr && r.cleaning_status === 'dirty') return 5
          if (arr && r.cleaning_status === 'cleaning') return 4
          if (r.cleaning_status === 'dirty') return 3
          if (r.cleaning_status === 'cleaning') return 2
          return 1
        }
        return score(b, bArrival) - score(a, aArrival)
      }
      if (roomSortBy === 'status') {
        const order: Record<CleaningStatus, number> = { dirty: 1, cleaning: 2, clean: 3, inspected: 4 }
        return (order[a.cleaning_status] || 9) - (order[b.cleaning_status] || 9)
      }
      if (roomSortBy === 'room_desc') {
        return b.room_number.localeCompare(a.room_number, undefined, { numeric: true })
      }
      if (roomSortBy === 'floor_asc') {
        return a.floor - b.floor || a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
      }
      // default: room_asc
      return a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
    })
  }, [rooms, floorFilter, cleaningFilter, urgencyFilter, roomTypeFilter, defectFilter, search, roomSortBy, todayArrivals, openTicketsByRoom])

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    const result = tickets.filter(t => {
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false
      if (ticketPriorityFilter !== 'all' && t.priority !== ticketPriorityFilter) return false
      if (ticketCategoryFilter !== 'all' && (t as any).category !== ticketCategoryFilter) return false

      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase().trim()
        const match =
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          ((t.room as any)?.room_number || '').toString().includes(q) ||
          (t.reported_by || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })

    return [...result].sort((a, b) => {
      if (ticketSortBy === 'urgent_first') {
        const pOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0)
      }
      if (ticketSortBy === 'created_desc') return (b.created_at || '').localeCompare(a.created_at || '')
      if (ticketSortBy === 'created_asc') return (a.created_at || '').localeCompare(b.created_at || '')
      if (ticketSortBy === 'room_asc') {
        const rA = String((a.room as any)?.room_number || '')
        const rB = String((b.room as any)?.room_number || '')
        return rA.localeCompare(rB, undefined, { numeric: true })
      }
      return 0
    })
  }, [tickets, ticketStatusFilter, ticketPriorityFilter, ticketCategoryFilter, ticketSearch, ticketSortBy])

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Housekeeping & Maintenance</h1>
          <p className="text-xs text-slate-400 mt-0.5">Room cleaning readiness, turnover, and defect management</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'rooms' && (
            <button
              onClick={handleBulkMarkClean}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-50 transition"
            >
              <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Mark View as Clean
            </button>
          )}
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Raise Maintenance Ticket
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => {
            setActiveTab('rooms')
            setCleaningFilter('dirty')
          }}
          className={cn(
            'bg-white rounded-2xl p-4 border transition cursor-pointer hover:shadow-sm',
            cleaningFilter === 'dirty' && activeTab === 'rooms' ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Needs Cleaning</span>
            <Sparkles className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{dirty}</p>
          <p className="text-xs text-slate-400 mt-0.5">Rooms awaiting maid service</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('rooms')
            setCleaningFilter('cleaning')
          }}
          className={cn(
            'bg-white rounded-2xl p-4 border transition cursor-pointer hover:shadow-sm',
            cleaningFilter === 'cleaning' && activeTab === 'rooms' ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>In Progress</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{cleaning}</p>
          <p className="text-xs text-slate-400 mt-0.5">Currently being cleaned</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('rooms')
            setCleaningFilter('clean')
          }}
          className={cn(
            'bg-white rounded-2xl p-4 border transition cursor-pointer hover:shadow-sm',
            cleaningFilter === 'clean' && activeTab === 'rooms' ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Clean & Ready</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{clean}</p>
          <p className="text-xs text-slate-400 mt-0.5">Ready for guest check-in</p>
        </div>

        <div
          onClick={() => setActiveTab('tickets')}
          className={cn(
            'bg-white rounded-2xl p-4 border transition cursor-pointer hover:shadow-sm',
            activeTab === 'tickets' ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Open Tickets</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-600">{openTickets}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {urgentTickets > 0 ? <span className="text-red-600 font-bold">{urgentTickets} urgent issue(s)</span> : 'No urgent issues'}
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-1">
        <div className="flex gap-1">
          {(['rooms', 'tickets', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-xs font-semibold rounded-xl transition capitalize',
                activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              )}
            >
              {tab === 'rooms' ? `Room Grid (${rooms.length})` : tab === 'tickets' ? `Maintenance Tickets (${tickets.length})` : 'Cleaning Audit Logs'}
            </button>
          ))}
        </div>

      </div>

      {/* Advanced Filter Toolbar for Active Tab */}
      {activeTab === 'rooms' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search room number or type..."
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

            {/* Urgency & Turnover Filter */}
            <select
              value={urgencyFilter}
              onChange={e => setUrgencyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Turnover Statuses</option>
              <option value="priority_arrival">🚨 Priority (Arrival Today & Not Clean)</option>
              <option value="arrival_today">All Today's Arrivals</option>
              <option value="dirty">Dirty (Awaiting Service)</option>
              <option value="cleaning">In Progress Cleaning</option>
              <option value="clean">Clean & Inspected</option>
              <option value="inspected">Strictly Inspected</option>
            </select>

            {/* Floor Filter */}
            <select
              value={floorFilter}
              onChange={e => setFloorFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Floors</option>
              {floors.map(f => (
                <option key={f} value={f.toString()}>
                  {f === 0 ? 'Ground Floor' : `Floor ${f}`}
                </option>
              ))}
            </select>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowRoomAdvanced(!showRoomAdvanced)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition',
                showRoomAdvanced || roomTypeFilter !== 'all' || defectFilter !== 'all' || roomSortBy !== 'room_asc'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {(roomTypeFilter !== 'all' || defectFilter !== 'all' || roomSortBy !== 'room_asc') && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', showRoomAdvanced && 'rotate-180')} />
            </button>
          </div>

          {/* Collapsible Advanced Filters Drawer */}
          {showRoomAdvanced && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
              {/* Room Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Room Type</label>
                <select
                  value={roomTypeFilter}
                  onChange={e => setRoomTypeFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="all">All Room Types</option>
                  {roomTypes.map(rt => (
                    <option key={rt} value={rt}>
                      {getRoomTypeLabel(rt as any)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Maintenance Defects */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Maintenance Status</label>
                <select
                  value={defectFilter}
                  onChange={e => setDefectFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="all">All Rooms</option>
                  <option value="has_defect">Has Open Maintenance Ticket</option>
                  <option value="no_defect">Defect-Free Rooms</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort Grid By</label>
                <select
                  value={roomSortBy}
                  onChange={e => setRoomSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="room_asc">Room Number (Low to High)</option>
                  <option value="room_desc">Room Number (High to Low)</option>
                  <option value="urgency">Urgency (Arrival Today First)</option>
                  <option value="status">Status (Dirty → Cleaning → Clean)</option>
                  <option value="floor_asc">Floor Level</option>
                </select>
              </div>
            </div>
          )}

          {/* Active Filter Chips Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-medium">Active Filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-blue-200">
                  Search: "{search}"
                  <button onClick={() => setSearch('')} className="hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {urgencyFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-rose-200">
                  Turnover: {urgencyFilter === 'priority_arrival' ? 'Priority Arrival' : urgencyFilter.replace('_', ' ')}
                  <button onClick={() => setUrgencyFilter('all')} className="hover:text-rose-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {floorFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-indigo-200">
                  Floor: {floorFilter === '0' ? 'Ground' : `Floor ${floorFilter}`}
                  <button onClick={() => setFloorFilter('all')} className="hover:text-indigo-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {roomTypeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-amber-200">
                  Type: {getRoomTypeLabel(roomTypeFilter as any)}
                  <button onClick={() => setRoomTypeFilter('all')} className="hover:text-amber-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {defectFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-orange-200">
                  Defects: {defectFilter === 'has_defect' ? 'Has Open Tickets' : 'Defect-Free'}
                  <button onClick={() => setDefectFilter('all')} className="hover:text-orange-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {roomSortBy !== 'room_asc' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-slate-200">
                  Sort: {roomSortBy.replace('_', ' ')}
                  <button onClick={() => setRoomSortBy('room_asc')} className="hover:text-slate-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(search || urgencyFilter !== 'all' || floorFilter !== 'all' || roomTypeFilter !== 'all' || defectFilter !== 'all' || roomSortBy !== 'room_asc') ? (
                <button
                  onClick={() => {
                    setSearch('')
                    setUrgencyFilter('all')
                    setCleaningFilter('all')
                    setFloorFilter('all')
                    setRoomTypeFilter('all')
                    setDefectFilter('all')
                    setRoomSortBy('room_asc')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear All
                </button>
              ) : (
                <span className="text-slate-400 italic text-[11px]">None (Showing all)</span>
              )}
            </div>

            <div className="text-slate-500 font-semibold text-xs ml-auto whitespace-nowrap">
              Showing <span className="text-slate-800 font-bold">{filteredRooms.length}</span> of {rooms.length} rooms
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filter Toolbar for Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket title, room, description..."
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              {ticketSearch && (
                <button onClick={() => setTicketSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={ticketStatusFilter}
              onChange={e => setTicketStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Only</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Priority Filter */}
            <select
              value={ticketPriorityFilter}
              onChange={e => setTicketPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category Filter */}
            {ticketCategories.length > 0 && (
              <select
                value={ticketCategoryFilter}
                onChange={e => setTicketCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {ticketCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Tickets */}
            <select
              value={ticketSortBy}
              onChange={e => setTicketSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="urgent_first">Urgency First</option>
              <option value="created_desc">Newest Created</option>
              <option value="created_asc">Oldest Created</option>
              <option value="room_asc">Room Number</option>
            </select>
          </div>

          {/* Active Filter Chips Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-medium">Active Filters:</span>
              {ticketSearch && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-blue-200">
                  Search: "{ticketSearch}"
                  <button onClick={() => setTicketSearch('')} className="hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {ticketStatusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-purple-200">
                  Status: {getTicketStatusLabel(ticketStatusFilter as any)}
                  <button onClick={() => setTicketStatusFilter('all')} className="hover:text-purple-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {ticketPriorityFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-rose-200">
                  Priority: {ticketPriorityFilter}
                  <button onClick={() => setTicketPriorityFilter('all')} className="hover:text-rose-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {ticketCategoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-amber-200">
                  Category: {ticketCategoryFilter}
                  <button onClick={() => setTicketCategoryFilter('all')} className="hover:text-amber-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {(ticketSearch || ticketStatusFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketSortBy !== 'urgent_first') ? (
                <button
                  onClick={() => {
                    setTicketSearch('')
                    setTicketStatusFilter('all')
                    setTicketPriorityFilter('all')
                    setTicketCategoryFilter('all')
                    setTicketSortBy('urgent_first')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear All
                </button>
              ) : (
                <span className="text-slate-400 italic text-[11px]">None (Showing all)</span>
              )}
            </div>

            <div className="text-slate-500 font-semibold text-xs ml-auto whitespace-nowrap">
              Showing <span className="text-slate-800 font-bold">{filteredTickets.length}</span> of {tickets.length} tickets
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* TAB 1: INTERACTIVE ROOM GRID */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredRooms.map(room => {
                  const hasArrivalToday = todayArrivals.includes(room.id)
                  const isDirtyWithArrival = room.cleaning_status === 'dirty' && hasArrivalToday
                  const isUpdating = updatingRoomId === room.id

                  return (
                    <div
                      key={room.id}
                      className={cn(
                        'bg-white rounded-2xl p-3.5 border-2 flex flex-col justify-between transition relative shadow-sm',
                        room.cleaning_status === 'dirty'
                          ? 'border-red-200 bg-red-50/20'
                          : room.cleaning_status === 'cleaning'
                          ? 'border-yellow-200 bg-yellow-50/20'
                          : 'border-green-200 bg-green-50/20',
                        isDirtyWithArrival && 'ring-2 ring-red-400'
                      )}
                    >
                      {/* Arrival Today Warning Badge */}
                      {isDirtyWithArrival && (
                        <div className="absolute -top-2.5 left-2 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="w-2.5 h-2.5" /> Arrival Today!
                        </div>
                      )}

                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-slate-800">Room {room.room_number}</p>
                          <p className="text-[11px] text-slate-400 capitalize">
                            Floor {room.floor} · {room.room_type.replace('_', ' ')}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            getCleaningStatusColor(room.cleaning_status)
                          )}
                        >
                          {getCleaningStatusLabel(room.cleaning_status)}
                        </span>
                      </div>

                      {/* 1-Click WhatsApp Dispatch Button */}
                      <div className="mt-3">
                        <button
                          onClick={() => setWhatsAppModalRoom(room)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold transition"
                          title="Send WhatsApp cleaning task to housekeeper"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Cleaners
                        </button>
                      </div>

                      {/* Status Selector Dropdown */}
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <label className="text-[10px] text-slate-400 block mb-1">Set Cleaning Status:</label>
                        <div className="relative">
                          {isUpdating ? (
                            <div className="text-center py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-blue-500" />
                            </div>
                          ) : (
                            <select
                              value={room.cleaning_status}
                              onChange={e => handleRoomStatusChange(room, e.target.value as CleaningStatus)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="dirty">🔴 Mark Dirty</option>
                              <option value="cleaning">🟡 In Progress</option>
                              <option value="clean">🟢 Clean</option>
                              <option value="inspected">🔵 Inspected</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {filteredRooms.length === 0 && (
                <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <p className="font-semibold text-slate-600 text-sm mb-1">No rooms match your filter criteria</p>
                  <p className="text-xs text-slate-400 mb-3">Try adjusting your search, floor, room type, or turnover filter.</p>
                  <button
                    onClick={() => {
                      setSearch('')
                      setUrgencyFilter('all')
                      setCleaningFilter('all')
                      setFloorFilter('all')
                      setRoomTypeFilter('all')
                      setDefectFilter('all')
                      setRoomSortBy('room_asc')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MAINTENANCE TICKETS */}
          {activeTab === 'tickets' && (
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <p className="font-semibold text-slate-600 text-sm mb-1">No maintenance tickets found</p>
                  <p className="text-xs text-slate-400 mb-3">No tickets match your status, priority, or search term.</p>
                  <button
                    onClick={() => {
                      setTicketSearch('')
                      setTicketStatusFilter('all')
                      setTicketPriorityFilter('all')
                      setTicketCategoryFilter('all')
                      setTicketSortBy('urgent_first')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
                  </button>
                </div>
              ) : (
                filteredTickets.map(ticket => (
                  <div key={ticket.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">
                            Room {(ticket.room as any)?.room_number ?? 'General'}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-semibold',
                              getTicketPriorityColor(ticket.priority)
                            )}
                          >
                            {getTicketPriorityLabel(ticket.priority)}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              ticket.status === 'resolved'
                                ? 'bg-green-100 text-green-700'
                                : ticket.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            )}
                          >
                            {getTicketStatusLabel(ticket.status)}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 text-sm">{ticket.title}</p>
                        {ticket.description && <p className="text-xs text-slate-500 mt-1">{ticket.description}</p>}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                          <span>Reported by: {ticket.reported_by || 'Staff'}</span>
                          <span>•</span>
                          <span>Created: {formatDateTime(ticket.created_at)}</span>
                        </div>
                        {ticket.resolved_at && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            ✓ Resolved by {ticket.resolved_by || 'Management'} on {formatDateTime(ticket.resolved_at)}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      {ticket.status !== 'resolved' && (
                        <div className="flex flex-col gap-1.5">
                          {ticket.status === 'open' && (
                            <button
                              onClick={() => handleTicketStatus(ticket.id, 'in_progress')}
                              className="px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-semibold rounded-lg hover:bg-yellow-100 transition whitespace-nowrap"
                            >
                              In Progress
                            </button>
                          )}
                          <button
                            onClick={() => handleTicketStatus(ticket.id, 'resolved')}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-500 transition whitespace-nowrap flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" /> Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CLEANING LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Room Cleaning History</h3>
                  <p className="text-xs text-slate-400">Audit trail of completed cleans and maid assignments</p>
                </div>
                <button
                  onClick={handleExportLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Export Logs CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs font-semibold text-slate-500">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Cleaner / Assigned</th>
                      <th className="px-4 py-3">Previous Status</th>
                      <th className="px-4 py-3">Updated Status</th>
                      <th className="px-4 py-3">Audit Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cleaningLogs.map(log => (
                      <tr key={log.id} className="text-xs hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.completed_at)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          Room {(log.room as any)?.room_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{log.cleaner_name}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize', getCleaningStatusColor(log.status_before ?? 'dirty'))}>
                            {getCleaningStatusLabel(log.status_before ?? 'dirty')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold', getCleaningStatusColor(log.status_after))}>
                            {getCleaningStatusLabel(log.status_after)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-sm text-[11px] leading-relaxed">
                          {log.notes || 'Routine cleaning'}
                        </td>
                      </tr>
                    ))}
                    {cleaningLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No cleaning logs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Raise Ticket Modal */}
      {showNewTicketModal && (
        <NewTicketModal
          rooms={rooms}
          onClose={() => setShowNewTicketModal(false)}
          onCreated={() => {
            fetchData()
            setShowNewTicketModal(false)
          }}
        />
      )}

      {/* WhatsApp Dispatch Modal */}
      {whatsAppModalRoom && (
        <WhatsAppAlertModal
          room={whatsAppModalRoom}
          hasArrivalToday={todayArrivals.includes(whatsAppModalRoom.id)}
          onClose={() => setWhatsAppModalRoom(null)}
        />
      )}
    </div>
  )
}
