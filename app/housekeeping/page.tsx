'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, Booking, MaintenanceTicket } from '@/lib/types'
import { formatDate, getCleaningStatusColor, getCleaningStatusLabel, cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, Clock, LogOut, Loader2, Plus, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { format, isToday, isTomorrow } from 'date-fns'

export default function HousekeepingDashboard() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [todayDepartures, setTodayDepartures] = useState<(Booking & { room?: Room })[]>([])
  const [todayArrivals, setTodayArrivals] = useState<(Booking & { room?: Room })[]>([])
  const [loading, setLoading] = useState(true)
  const [cleanerName, setCleanerName] = useState('')
  const [showCleanerModal, setShowCleanerModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketRoom, setTicketRoom] = useState<Room | null>(null)
  const [markingRoom, setMarkingRoom] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'dirty' | 'clean'>('all')
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'medium' })
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [activeTab, setActiveTab] = useState<'rooms' | 'schedule'>('rooms')

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const saved = localStorage.getItem('cleanerName')
    if (saved) { setCleanerName(saved) } else { setShowCleanerModal(true) }
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: roomsData }, { data: departuresData }, { data: arrivalsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_out_date', today).in('status', ['confirmed', 'checked_in', 'checked_out']),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_in_date', today).in('status', ['confirmed']),
    ])
    setRooms(roomsData ?? [])
    setTodayDepartures(departuresData ?? [])
    setTodayArrivals(arrivalsData ?? [])
    setLoading(false)
  }

  const handleMarkCleaned = async (room: Room) => {
    if (!cleanerName) { setShowCleanerModal(true); return }
    setMarkingRoom(room.id)

    await supabase.from('rooms').update({ cleaning_status: 'cleaning' }).eq('id', room.id)
    await new Promise(r => setTimeout(r, 500))

    const [{ error: roomError }, { error: logError }] = await Promise.all([
      supabase.from('rooms').update({ cleaning_status: 'clean' }).eq('id', room.id),
      supabase.from('cleaning_logs').insert({
        room_id: room.id,
        cleaner_name: cleanerName,
        status_before: room.cleaning_status,
        status_after: 'clean',
        completed_at: new Date().toISOString(),
      }),
    ])

    if (roomError || logError) { toast.error('Failed to mark room as cleaned') }
    else { toast.success(`Room ${room.room_number} marked as clean! ✓`) }
    setMarkingRoom(null)
    fetchData()
  }

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
    if (error) { toast.error('Failed to raise ticket') }
    else { toast.success('Ticket raised and sent to management ✓'); setShowTicketModal(false); setTicketForm({ title: '', description: '', priority: 'medium' }) }
    setSubmittingTicket(false)
  }

  const filteredRooms = rooms.filter(r => {
    if (filter === 'dirty') return r.cleaning_status === 'dirty'
    if (filter === 'clean') return r.cleaning_status === 'clean' || r.cleaning_status === 'inspected'
    return true
  })

  const dirtyCount = rooms.filter(r => r.cleaning_status === 'dirty').length
  const cleanCount = rooms.filter(r => r.cleaning_status === 'clean' || r.cleaning_status === 'inspected').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">🏨 Patten Arms Housekeeping</h1>
            <p className="text-slate-400 text-xs">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCleanerModal(true)} className="text-right">
              <p className="text-sm font-medium text-white">{cleanerName || 'Set Name'}</p>
              <p className="text-xs text-slate-400">Tap to change</p>
            </button>
            <button
              onClick={async () => {
                sessionStorage.removeItem('patten_hotel_session_active')
                sessionStorage.removeItem('patten_hotel_last_activity')
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{dirtyCount}</p>
            <p className="text-xs text-red-600 font-medium">To Clean</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{cleanCount}</p>
            <p className="text-xs text-green-600 font-medium">Clean</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{todayDepartures.length}</p>
            <p className="text-xs text-blue-600 font-medium">Departures</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(['rooms', 'schedule'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('flex-1 py-2 text-sm font-medium rounded-lg transition capitalize', activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500')}>
              {tab === 'schedule' ? "Today's Schedule" : 'Rooms'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <>
            {activeTab === 'rooms' && (
              <>
                {/* Filter */}
                <div className="flex gap-2">
                  {(['all', 'dirty', 'clean'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={cn('px-4 py-2 text-sm font-medium rounded-xl transition capitalize', filter === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500')}>
                      {f === 'all' ? `All (${rooms.length})` : f === 'dirty' ? `🔴 To Clean (${dirtyCount})` : `🟢 Clean (${cleanCount})`}
                    </button>
                  ))}
                </div>

                {/* Room Cards */}
                <div className="space-y-3">
                  {filteredRooms.map(room => (
                    <div key={room.id} className={cn(
                      'bg-white rounded-2xl border-2 p-4 transition',
                      room.cleaning_status === 'dirty' ? 'border-red-300' :
                      room.cleaning_status === 'cleaning' ? 'border-yellow-300' :
                      'border-green-300'
                    )}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-slate-800">Room {room.room_number}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', getCleaningStatusColor(room.cleaning_status))}>
                              {getCleaningStatusLabel(room.cleaning_status)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 capitalize mt-0.5">{room.room_type.replace('_', ' ')} · Floor {room.floor}</p>
                          {/* Check if departure today */}
                          {todayDepartures.find(b => (b as any).room_id === room.id) && (
                            <p className="text-xs text-orange-600 font-medium mt-1">⚠️ Departure today — priority clean</p>
                          )}
                          {todayArrivals.find(b => (b as any).room_id === room.id) && (
                            <p className="text-xs text-blue-600 font-medium mt-1">✈️ Arrival today — must be ready!</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {room.cleaning_status === 'dirty' && (
                            <button
                              onClick={() => handleMarkCleaned(room)}
                              disabled={markingRoom === room.id}
                              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-500 disabled:opacity-50 transition"
                            >
                              {markingRoom === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              Mark Clean
                            </button>
                          )}
                          <button
                            onClick={() => { setTicketRoom(room); setShowTicketModal(true) }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-orange-100 text-orange-700 text-sm font-semibold rounded-xl hover:bg-orange-200 transition"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Report Issue
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 text-sm">🔻 Check-outs Today ({todayDepartures.length})</h3>
                  {todayDepartures.length === 0 && <p className="text-slate-400 text-sm">No departures today</p>}
                  <div className="space-y-2">
                    {todayDepartures.map(b => (
                      <div key={b.id} className="bg-white rounded-xl border border-orange-200 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-800">Room {(b as any).room?.room_number}</p>
                            <p className="text-sm text-slate-500">{b.guest_first_name} {b.guest_last_name}</p>
                          </div>
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">{b.status === 'checked_out' ? 'Checked Out' : 'Departing'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 text-sm">✈️ Arrivals Today ({todayArrivals.length})</h3>
                  {todayArrivals.length === 0 && <p className="text-slate-400 text-sm">No arrivals today</p>}
                  <div className="space-y-2">
                    {todayArrivals.map(b => (
                      <div key={b.id} className="bg-white rounded-xl border border-green-200 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-800">Room {(b as any).room?.room_number}</p>
                            <p className="text-sm text-slate-500">{b.guest_first_name} {b.guest_last_name}</p>
                            {b.estimated_arrival_time && <p className="text-xs text-slate-400 mt-0.5">Arriving around {b.estimated_arrival_time}</p>}
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Arriving</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cleaner Name Modal */}
      {showCleanerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-1">Who are you?</h3>
            <p className="text-slate-400 text-sm mb-4">Enter your name to sign your cleaning records</p>
            <input
              type="text"
              placeholder="Your first name..."
              defaultValue={cleanerName}
              id="cleaner-input"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <button
              onClick={() => {
                const val = (document.getElementById('cleaner-input') as HTMLInputElement)?.value
                if (val.trim()) { setCleanerName(val.trim()); localStorage.setItem('cleanerName', val.trim()); setShowCleanerModal(false) }
                else { toast.error('Please enter your name') }
              }}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {showTicketModal && ticketRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Report Issue — Room {ticketRoom.room_number}</h3>
              <button onClick={() => setShowTicketModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Issue Title *</label>
                <input type="text" value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Broken TV, leaking tap, missing towels..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Details (optional)</label>
                <textarea rows={3} value={ticketForm.description} onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="More details about the issue..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button key={p} onClick={() => setTicketForm(f => ({ ...f, priority: p }))}
                      className={cn('py-2 text-xs font-medium rounded-xl capitalize transition border', ticketForm.priority === p ? {
                        low: 'bg-gray-800 text-white border-gray-800',
                        medium: 'bg-yellow-500 text-white border-yellow-500',
                        high: 'bg-orange-500 text-white border-orange-500',
                        urgent: 'bg-red-600 text-white border-red-600',
                      }[p] : 'border-slate-200 text-slate-500')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleRaiseTicket} disabled={submittingTicket || !ticketForm.title}
              className="w-full mt-4 py-3 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-500 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {submittingTicket && <Loader2 className="w-4 h-4 animate-spin" />}
              Send to Management
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
