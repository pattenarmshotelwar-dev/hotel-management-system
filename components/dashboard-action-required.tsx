'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, Sparkles } from 'lucide-react'

interface OverdueCheckout {
  id: string
  guest_first_name: string
  guest_last_name: string
  check_out_date: string
  room?: { room_number: string }
}

interface DirtyArrivalRoom {
  id: string
  room_number: string
}

interface UrgentTicket {
  id: string
  title: string
  room?: { room_number: string }
}

interface Props {
  overdueCheckouts: OverdueCheckout[]
  dirtyArrivalRooms: DirtyArrivalRoom[]
  urgentTickets: UrgentTicket[]
}

export function DashboardActionRequired({ overdueCheckouts, dirtyArrivalRooms, urgentTickets }: Props) {
  const router = useRouter()

  type ActionType = 'overdue' | 'dirty_arrival' | 'urgent_ticket'

  interface Action {
    type: ActionType
    title: string
    subtitle: string
    href: string
  }

  const actions: Action[] = [
    ...overdueCheckouts.map(b => ({
      type: 'overdue' as ActionType,
      title: `Overdue check-out: Room ${b.room?.room_number ?? 'N/A'}`,
      subtitle: `${b.guest_first_name} ${b.guest_last_name} — was due ${new Date(b.check_out_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      href: '/admin/bookings',
    })),
    ...dirtyArrivalRooms.map(r => ({
      type: 'dirty_arrival' as ActionType,
      title: `🚨 Dirty room with arrival today: Room ${r.room_number}`,
      subtitle: 'Guest expected today — needs cleaning urgently before check-in',
      href: '/admin/housekeeping',
    })),
    ...urgentTickets.map(t => ({
      type: 'urgent_ticket' as ActionType,
      title: `Urgent ticket: ${t.title}`,
      subtitle: `Room ${t.room?.room_number ?? 'N/A'} — marked urgent`,
      href: '/admin/housekeeping',
    })),
  ]

  const iconMap: Record<ActionType, React.ReactNode> = {
    overdue: <Clock className="w-4 h-4 text-orange-600" />,
    dirty_arrival: <Sparkles className="w-4 h-4 text-yellow-600" />,
    urgent_ticket: <AlertTriangle className="w-4 h-4 text-red-600" />,
  }

  const iconBgMap: Record<ActionType, string> = {
    overdue: 'bg-orange-100',
    dirty_arrival: 'bg-yellow-100',
    urgent_ticket: 'bg-red-100',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">⚡ Action Required</h3>
          <p className="text-xs text-slate-400 mt-0.5">Items needing your attention now</p>
        </div>
        {actions.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            {actions.length} urgent
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-sm font-medium text-slate-700">All clear!</p>
          <p className="text-xs text-slate-400 mt-1 text-center">No urgent actions needed right now</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => router.push(action.href)}
              className="w-full flex items-start gap-3 p-3 bg-slate-50 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all text-left group"
            >
              <div className={`w-8 h-8 ${iconBgMap[action.type]} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {iconMap[action.type]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 leading-snug">{action.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{action.subtitle}</p>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500 ml-auto text-lg">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
