'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, CleaningLog, MaintenanceTicket } from '@/lib/types'
import { formatDateTime, getCleaningStatusColor, getCleaningStatusLabel, getTicketPriorityColor, getTicketPriorityLabel, getTicketStatusLabel, cn } from '@/lib/utils'
import { Sparkles, AlertTriangle, CheckCircle, Clock, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function HousekeepingAdminPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [tickets, setTickets] = useState<(MaintenanceTicket & { room?: Room })[]>([])
  const [cleaningLogs, setCleaningLogs] = useState<(CleaningLog & { room?: Room })[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'rooms' | 'tickets' | 'logs'>('rooms')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: roomsData }, { data: ticketsData }, { data: logsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('maintenance_tickets').select('*, room:rooms(room_number, room_type)').order('created_at', { ascending: false }),
      supabase.from('cleaning_logs').select('*, room:rooms(room_number, room_type)').order('completed_at', { ascending: false }).limit(100),
    ])
    setRooms(roomsData ?? [])
    setTickets(ticketsData ?? [])
    setCleaningLogs(logsData ?? [])
    setLoading(false)
  }

  const handleTicketStatus = async (ticketId: string, newStatus: string) => {
    const update: any = { status: newStatus }
    if (newStatus === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolved_by = 'Management'
    }
    const { error } = await supabase.from('maintenance_tickets').update(update).eq('id', ticketId)
    if (error) { toast.error('Failed to update ticket') } else { toast.success('Ticket updated'); fetchData() }
  }

  const handleExportLogs = () => {
    const csv = [
      ['Date', 'Room', 'Cleaner', 'Status Before', 'Status After', 'Notes'],
      ...cleaningLogs.map(l => [
        formatDateTime(l.completed_at),
        (l.room as any)?.room_number ?? '',
        l.cleaner_name,
        l.status_before ?? '',
        l.status_after,
        l.notes ?? '',
      ])
    ].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cleaning-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const dirty = rooms.filter(r => r.cleaning_status === 'dirty').length
  const cleaning = rooms.filter(r => r.cleaning_status === 'cleaning').length
  const clean = rooms.filter(r => r.cleaning_status === 'clean' || r.cleaning_status === 'inspected').length
  const openTickets = tickets.filter(t => t.status === 'open').length
  const urgentTickets = tickets.filter(t => t.status === 'open' && t.priority === 'urgent').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
          <p className="text-2xl font-bold text-red-600">{dirty}</p>
          <p className="text-sm text-red-700 font-medium mt-1">Needs Cleaning</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200">
          <p className="text-2xl font-bold text-yellow-600">{cleaning}</p>
          <p className="text-sm text-yellow-700 font-medium mt-1">Being Cleaned</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
          <p className="text-2xl font-bold text-green-600">{clean}</p>
          <p className="text-sm text-green-700 font-medium mt-1">Clean & Ready</p>
        </div>
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
          <p className="text-2xl font-bold text-orange-600">{openTickets}</p>
          <p className="text-sm text-orange-700 font-medium mt-1">Open Tickets {urgentTickets > 0 && <span className="text-red-600">({urgentTickets} urgent)</span>}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {(['rooms', 'tickets', 'logs'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium rounded-lg transition capitalize', activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
            {tab === 'logs' ? 'Cleaning Logs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {activeTab === 'rooms' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {rooms.map(room => (
                <div key={room.id} className={cn('rounded-2xl p-4 border-2 text-center', {
                  'border-red-300 bg-red-50': room.cleaning_status === 'dirty',
                  'border-yellow-300 bg-yellow-50': room.cleaning_status === 'cleaning',
                  'border-green-300 bg-green-50': room.cleaning_status === 'clean',
                  'border-blue-300 bg-blue-50': room.cleaning_status === 'inspected',
                })}>
                  <p className="text-lg font-bold text-slate-800">{room.room_number}</p>
                  <p className="text-xs text-slate-400 mb-2 capitalize">{room.room_type.replace('_', ' ')}</p>
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getCleaningStatusColor(room.cleaning_status))}>
                    {getCleaningStatusLabel(room.cleaning_status)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-3">
              {tickets.length === 0 && <p className="text-center text-slate-400 py-8">No maintenance tickets</p>}
              {tickets.map(ticket => (
                <div key={ticket.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">Room {(ticket.room as any)?.room_number}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', getTicketPriorityColor(ticket.priority))}>
                          {getTicketPriorityLabel(ticket.priority)}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                          {getTicketStatusLabel(ticket.status)}
                        </span>
                      </div>
                      <p className="font-medium text-slate-700">{ticket.title}</p>
                      {ticket.description && <p className="text-sm text-slate-400 mt-1">{ticket.description}</p>}
                      <p className="text-xs text-slate-400 mt-2">Reported by {ticket.reported_by} · {formatDateTime(ticket.created_at)}</p>
                      {ticket.resolved_at && <p className="text-xs text-green-600 mt-0.5">Resolved by {ticket.resolved_by} · {formatDateTime(ticket.resolved_at)}</p>}
                    </div>
                    {ticket.status !== 'resolved' && (
                      <div className="flex flex-col gap-1">
                        {ticket.status === 'open' && (
                          <button onClick={() => handleTicketStatus(ticket.id, 'in_progress')}
                            className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-lg hover:bg-yellow-200 transition whitespace-nowrap">
                            In Progress
                          </button>
                        )}
                        <button onClick={() => handleTicketStatus(ticket.id, 'resolved')}
                          className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 transition">
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Cleaning History</h3>
                <button onClick={handleExportLogs} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-xl hover:bg-slate-200 transition">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs text-slate-400">
                      <th className="px-4 py-3 font-medium">Date & Time</th>
                      <th className="px-4 py-3 font-medium">Room</th>
                      <th className="px-4 py-3 font-medium">Cleaner</th>
                      <th className="px-4 py-3 font-medium">Before</th>
                      <th className="px-4 py-3 font-medium">After</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cleaningLogs.map(log => (
                      <tr key={log.id} className="text-sm hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(log.completed_at)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{(log.room as any)?.room_number}</td>
                        <td className="px-4 py-3 text-slate-700">{log.cleaner_name}</td>
                        <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full', getCleaningStatusColor(log.status_before ?? 'dirty'))}>{getCleaningStatusLabel(log.status_before ?? 'dirty')}</span></td>
                        <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full', getCleaningStatusColor(log.status_after))}>{getCleaningStatusLabel(log.status_after)}</span></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{log.notes ?? '—'}</td>
                      </tr>
                    ))}
                    {cleaningLogs.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">No cleaning logs yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
