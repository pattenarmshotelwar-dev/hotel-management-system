'use client'

import { useRouter } from 'next/navigation'

interface GridRoom {
  id: string
  room_number: string
  room_type: string
  floor: number
  effectiveStatus: 'occupied' | 'available' | 'dirty' | 'cleaning' | 'maintenance' | 'blocked'
}

interface Props {
  rooms: GridRoom[]
}

const statusConfig = {
  occupied:    { bg: 'bg-blue-500 hover:bg-blue-600',    text: 'text-white', label: 'Occupied',    dot: 'bg-blue-500' },
  available:   { bg: 'bg-green-500 hover:bg-green-600',  text: 'text-white', label: 'Available',   dot: 'bg-green-500' },
  dirty:       { bg: 'bg-amber-400 hover:bg-amber-500',  text: 'text-white', label: 'Dirty',       dot: 'bg-amber-400' },
  cleaning:    { bg: 'bg-yellow-300 hover:bg-yellow-400',text: 'text-yellow-900', label: 'Cleaning', dot: 'bg-yellow-300' },
  maintenance: { bg: 'bg-red-500 hover:bg-red-600',      text: 'text-white', label: 'Maintenance', dot: 'bg-red-500' },
  blocked:     { bg: 'bg-slate-400 hover:bg-slate-500',  text: 'text-white', label: 'Blocked',     dot: 'bg-slate-400' },
}

export function DashboardRoomGrid({ rooms }: Props) {
  const router = useRouter()

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b)

  const counts = {
    occupied:    rooms.filter(r => r.effectiveStatus === 'occupied').length,
    available:   rooms.filter(r => r.effectiveStatus === 'available').length,
    dirty:       rooms.filter(r => r.effectiveStatus === 'dirty').length,
    maintenance: rooms.filter(r => r.effectiveStatus === 'maintenance').length,
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">🏨 Tonight at a Glance</h3>
          <p className="text-xs text-slate-400 mt-0.5">Live status for all {rooms.length} rooms — click any room to go to calendar</p>
        </div>
        <button
          onClick={() => router.push('/admin/calendar')}
          className="text-blue-600 text-sm hover:underline"
        >
          Full calendar →
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5 pb-4 border-b border-slate-100">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${cfg.dot}`} />
            <span className="text-xs text-slate-500">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Room grid by floor */}
      <div className="space-y-4">
        {floors.map(floor => (
          <div key={floor}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Floor {floor}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rooms
                .filter(r => r.floor === floor)
                .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }))
                .map(room => {
                  const cfg = statusConfig[room.effectiveStatus] ?? statusConfig.available
                  return (
                    <button
                      key={room.id}
                      onClick={() => router.push('/admin/calendar')}
                      title={`Room ${room.room_number} — ${cfg.label}`}
                      className={`w-10 h-10 rounded-lg ${cfg.bg} ${cfg.text} text-xs font-bold transition-all hover:scale-110 active:scale-95 flex items-center justify-center shadow-sm`}
                    >
                      {room.room_number}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">{counts.available}</p>
          <p className="text-xs text-slate-400">Available</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-blue-600">{counts.occupied}</p>
          <p className="text-xs text-slate-400">Occupied</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-amber-500">{counts.dirty}</p>
          <p className="text-xs text-slate-400">Dirty</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">{counts.maintenance}</p>
          <p className="text-xs text-slate-400">Maintenance</p>
        </div>
      </div>
    </div>
  )
}
