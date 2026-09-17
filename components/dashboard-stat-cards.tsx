'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BedDouble,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  X,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface DirtyRoom {
  id: string
  room_number: string
  room_type: string
  cleaning_status: string
}

interface OpenTicket {
  id: string
  title: string
  priority: string
  status: string
  room?: { room_number: string }
}

interface Props {
  occupancyRate: number
  occupiedRooms: number
  totalRooms: number
  monthRevenue: number
  dirtyRoomsCount: number
  dirtyRooms: DirtyRoom[]
  openTicketsCount: number
  openTickets: OpenTicket[]
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-600',
}

const roomTypeLabel: Record<string, string> = {
  single: 'Single',
  double: 'Double',
  twin_single: 'Twin/Single',
  family: 'Family',
}

export function DashboardStatCards({
  occupancyRate,
  occupiedRooms,
  totalRooms,
  monthRevenue,
  dirtyRoomsCount,
  dirtyRooms,
  openTicketsCount,
  openTickets,
}: Props) {
  const [openPanel, setOpenPanel] = useState<'blue' | 'green' | 'yellow' | 'red' | null>(null)
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    if (openPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openPanel])

  const toggle = (key: typeof openPanel) =>
    setOpenPanel(prev => (prev === key ? null : key))

  const navigate = (href: string) => {
    setOpenPanel(null)
    router.push(href)
  }

  const availableRooms = totalRooms - occupiedRooms

  return (
    <div className="relative" ref={panelRef}>
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Blue — Occupancy */}
        <button
          onClick={() => toggle('blue')}
          className={`text-left bg-blue-50 rounded-2xl p-6 border-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${
            openPanel === 'blue' ? 'border-blue-400 shadow-lg' : 'border-blue-100'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <BedDouble className="w-5 h-5" />
            </div>
            <ChevronRight className={`w-4 h-4 text-blue-400 mt-1 transition-transform ${openPanel === 'blue' ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-2xl font-bold text-blue-700">{occupancyRate}%</p>
          <p className="text-sm font-medium text-slate-700 mt-1">Occupancy Rate</p>
          <p className="text-xs text-slate-400 mt-0.5">{occupiedRooms} / {totalRooms} rooms</p>
        </button>

        {/* Green — Revenue */}
        <button
          onClick={() => toggle('green')}
          className={`text-left bg-green-50 rounded-2xl p-6 border-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${
            openPanel === 'green' ? 'border-green-400 shadow-lg' : 'border-green-100'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <ChevronRight className={`w-4 h-4 text-green-400 mt-1 transition-transform ${openPanel === 'green' ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(monthRevenue)}</p>
          <p className="text-sm font-medium text-slate-700 mt-1">Monthly Revenue</p>
          <p className="text-xs text-slate-400 mt-0.5">{new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </button>

        {/* Yellow — Rooms to Clean */}
        <button
          onClick={() => toggle('yellow')}
          className={`text-left bg-yellow-50 rounded-2xl p-6 border-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${
            openPanel === 'yellow' ? 'border-yellow-400 shadow-lg' : 'border-yellow-100'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <ChevronRight className={`w-4 h-4 text-yellow-400 mt-1 transition-transform ${openPanel === 'yellow' ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-2xl font-bold text-yellow-700">{dirtyRoomsCount}</p>
          <p className="text-sm font-medium text-slate-700 mt-1">Rooms to Clean</p>
          <p className="text-xs text-slate-400 mt-0.5">Pending housekeeping</p>
        </button>

        {/* Red — Open Tickets */}
        <button
          onClick={() => toggle('red')}
          className={`text-left bg-red-50 rounded-2xl p-6 border-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${
            openPanel === 'red' ? 'border-red-400 shadow-lg' : 'border-red-100'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <ChevronRight className={`w-4 h-4 text-red-400 mt-1 transition-transform ${openPanel === 'red' ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-2xl font-bold text-red-700">{openTicketsCount}</p>
          <p className="text-sm font-medium text-slate-700 mt-1">Open Tickets</p>
          <p className="text-xs text-slate-400 mt-0.5">Maintenance issues</p>
        </button>
      </div>

      {/* Dropdown Panel */}
      {openPanel && (
        <div className={`mt-2 rounded-2xl border-2 shadow-xl bg-white overflow-hidden animate-in slide-in-from-top-2 duration-200 ${
          openPanel === 'blue' ? 'border-blue-200' :
          openPanel === 'green' ? 'border-green-200' :
          openPanel === 'yellow' ? 'border-yellow-200' :
          'border-red-200'
        }`}>
          {/* Panel Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${
            openPanel === 'blue' ? 'bg-blue-50 border-blue-100' :
            openPanel === 'green' ? 'bg-green-50 border-green-100' :
            openPanel === 'yellow' ? 'bg-yellow-50 border-yellow-100' :
            'bg-red-50 border-red-100'
          }`}>
            <h3 className="font-semibold text-slate-800 text-sm">
              {openPanel === 'blue' && `Room Occupancy Breakdown`}
              {openPanel === 'green' && `This Month's Revenue`}
              {openPanel === 'yellow' && `Rooms Needing Cleaning (${dirtyRoomsCount})`}
              {openPanel === 'red' && `Open Maintenance Tickets (${openTicketsCount})`}
            </h3>
            <button
              onClick={() => setOpenPanel(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/70 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="p-4">

            {/* Blue: Occupancy breakdown */}
            {openPanel === 'blue' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-green-700">{occupiedRooms}</p>
                    <p className="text-xs text-green-600 font-medium mt-0.5">Occupied</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{availableRooms}</p>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">Available</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-700">{totalRooms}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Total Rooms</p>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center">{occupancyRate}% occupancy rate</p>
                <button
                  onClick={() => navigate('/admin/calendar')}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition"
                >
                  View Room Calendar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Green: Revenue */}
            {openPanel === 'green' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{formatCurrency(monthRevenue)}</p>
                  <p className="text-xs text-green-600 mt-1">Total confirmed payments this month</p>
                </div>
                <p className="text-xs text-slate-400 text-center">Includes all completed card, cash, and bank transfer payments</p>
                <button
                  onClick={() => navigate('/admin/payments')}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition"
                >
                  View All Payments <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Yellow: Dirty rooms */}
            {openPanel === 'yellow' && (
              <div className="space-y-3">
                {dirtyRooms.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">✅ All rooms are clean!</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                    {dirtyRooms.map(room => (
                      <div key={room.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <p className="font-bold text-yellow-800 text-lg">Room {room.room_number}</p>
                        <p className="text-xs text-yellow-600 capitalize">{roomTypeLabel[room.room_type] ?? room.room_type}</p>
                        <span className="inline-block mt-1 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-medium">Dirty</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/admin/housekeeping')}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition"
                >
                  Go to Housekeeping <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Red: Open tickets */}
            {openPanel === 'red' && (
              <div className="space-y-3">
                {openTickets.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">✅ No open tickets!</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {openTickets.map(ticket => (
                      <div key={ticket.id} className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-red-700">
                            {ticket.room?.room_number ?? '–'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{ticket.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Room {ticket.room?.room_number ?? 'N/A'}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${priorityColors[ticket.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/admin/housekeeping')}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition"
                >
                  View All Tickets <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
