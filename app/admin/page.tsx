import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  BedDouble,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

async function getDashboardStats() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: rooms },
    { data: todayArrivals },
    { data: todayDepartures },
    { data: inHouseBookings },
    { data: dirtyRooms },
    { data: openTickets },
    { data: monthlyPayments },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from('rooms').select('*').eq('is_active', true),
    supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_in_date', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_out_date', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('bookings').select('id').eq('status', 'checked_in'),
    supabase.from('rooms').select('id').eq('cleaning_status', 'dirty'),
    supabase.from('maintenance_tickets').select('id').eq('status', 'open'),
    supabase.from('payments').select('amount').eq('status', 'succeeded').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('bookings').select('*, room:rooms(room_number, room_type)').order('created_at', { ascending: false }).limit(5),
  ])

  const totalRooms = rooms?.length ?? 0
  const occupiedRooms = inHouseBookings?.length ?? 0
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
  const monthRevenue = monthlyPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  return {
    totalRooms,
    occupiedRooms,
    occupancyRate,
    monthRevenue,
    todayArrivals: todayArrivals ?? [],
    todayDepartures: todayDepartures ?? [],
    dirtyRoomsCount: dirtyRooms?.length ?? 0,
    openTicketsCount: openTickets?.length ?? 0,
    recentBookings: recentBookings ?? [],
  }
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats()
  const today = new Date()

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate}%`}
          sub={`${stats.occupiedRooms} / ${stats.totalRooms} rooms`}
          icon={<BedDouble className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats.monthRevenue)}
          sub={`${today.toLocaleString('en-GB', { month: 'long' })} ${today.getFullYear()}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Rooms to Clean"
          value={String(stats.dirtyRoomsCount)}
          sub="Pending housekeeping"
          icon={<Sparkles className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          title="Open Tickets"
          value={String(stats.openTicketsCount)}
          sub="Maintenance issues"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Arrivals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Today&apos;s Arrivals</h3>
              <p className="text-xs text-slate-400">{formatDate(today.toISOString())}</p>
            </div>
            <span className="ml-auto bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {stats.todayArrivals.length}
            </span>
          </div>
          <div className="space-y-3">
            {stats.todayArrivals.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">No arrivals today</p>
            )}
            {stats.todayArrivals.slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-xs font-bold text-blue-700">
                  {b.room?.room_number}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.guest_first_name} {b.guest_last_name}</p>
                  <p className="text-xs text-slate-400">Check-in: {b.estimated_arrival_time ?? 'Flexible'}</p>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${b.status === 'checked_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {b.status === 'checked_in' ? 'In' : 'Due'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Departures */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Today&apos;s Departures</h3>
              <p className="text-xs text-slate-400">{formatDate(today.toISOString())}</p>
            </div>
            <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {stats.todayDepartures.length}
            </span>
          </div>
          <div className="space-y-3">
            {stats.todayDepartures.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">No departures today</p>
            )}
            {stats.todayDepartures.slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-xs font-bold text-orange-700">
                  {b.room?.room_number}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.guest_first_name} {b.guest_last_name}</p>
                  <p className="text-xs text-slate-400">Check-out by 11:00 AM</p>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${b.status === 'checked_out' ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                  {b.status === 'checked_out' ? 'Done' : 'Due'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Recent Bookings</h3>
          <a href="/admin/bookings" className="text-blue-600 text-sm hover:underline">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-3 font-medium">Reference</th>
                <th className="pb-3 font-medium">Guest</th>
                <th className="pb-3 font-medium">Room</th>
                <th className="pb-3 font-medium">Check-in</th>
                <th className="pb-3 font-medium">Check-out</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.recentBookings.map((b: any) => (
                <tr key={b.id} className="text-sm hover:bg-slate-50 transition">
                  <td className="py-3 font-mono text-xs text-slate-500">{b.booking_reference}</td>
                  <td className="py-3 font-medium text-slate-800">{b.guest_first_name} {b.guest_last_name}</td>
                  <td className="py-3 text-slate-500">Room {b.room?.room_number}</td>
                  <td className="py-3 text-slate-500">{formatDate(b.check_in_date)}</td>
                  <td className="py-3 text-slate-500">{formatDate(b.check_out_date)}</td>
                  <td className="py-3 font-medium">{formatCurrency(b.total_amount)}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                      b.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                      b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      b.status === 'checked_out' ? 'bg-gray-100 text-gray-600' :
                      b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {b.status === 'checked_in' && <CheckCircle2 className="w-3 h-3" />}
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No bookings yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, sub, icon, color }: {
  title: string
  value: string
  sub: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red'
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700' },
    green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', value: 'text-green-700' },
    yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', value: 'text-yellow-700' },
    red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} rounded-2xl p-6 border border-slate-200`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-1">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
