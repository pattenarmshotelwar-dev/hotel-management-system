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
} from 'lucide-react'
import { toast } from 'sonner'
import NewTicketModal from '@/components/housekeeping/NewTicketModal'

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
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Modals & Actions
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
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

  // Unique floors
  const floors = useMemo(() => {
    const set = new Set(rooms.map(r => r.floor))
    return Array.from(set).sort((a, b) => a - b)
  }, [rooms])

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (floorFilter !== 'all' && r.floor.toString() !== floorFilter) return false
      if (cleaningFilter !== 'all') {
        if (cleaningFilter === 'dirty' && r.cleaning_status !== 'dirty') return false
        if (cleaningFilter === 'cleaning' && r.cleaning_status !== 'cleaning') return false
        if (cleaningFilter === 'clean' && !['clean', 'inspected'].includes(r.cleaning_status)) return false
      }
      if (search && !r.room_number.includes(search) && !r.room_type.includes(search.toLowerCase())) return false
      return true
    })
  }, [rooms, floorFilter, cleaningFilter, search])

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false
      return true
    })
  }, [tickets, ticketStatusFilter])

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

        {activeTab === 'rooms' && (
          <div className="flex items-center gap-2">
            {/* Floor Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={floorFilter}
                onChange={e => setFloorFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">All Floors</option>
                {floors.map(f => (
                  <option key={f} value={f.toString()}>
                    Floor {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={cleaningFilter}
              onChange={e => setCleaningFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="dirty">Dirty</option>
              <option value="cleaning">Being Cleaned</option>
              <option value="clean">Clean & Inspected</option>
            </select>
          </div>
        )}

        {activeTab === 'tickets' && (
          <select
            value={ticketStatusFilter}
            onChange={e => setTicketStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">All Ticket Statuses</option>
            <option value="open">Open Only</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        )}
      </div>

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

                      {/* Status Selector Dropdown */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
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
                  No rooms match the selected floor or status filter.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MAINTENANCE TICKETS */}
          {activeTab === 'tickets' && (
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                  No maintenance tickets found.
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
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{log.notes || 'Routine cleaning'}</td>
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
    </div>
  )
}
