import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react'
import { DashboardStatCards } from '@/components/dashboard-stat-cards'
import { DashboardRevenueChart } from '@/components/dashboard-revenue-chart'
import { DashboardForecastStrip } from '@/components/dashboard-forecast-strip'
import { DashboardRoomGrid } from '@/components/dashboard-room-grid'
import { DashboardActionRequired } from '@/components/dashboard-action-required'
import { DashboardKpiRow } from '@/components/dashboard-kpi-row'

async function getDashboardStats() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let rooms: any[] | null = []
  let todayArrivals: any[] | null = []
  let todayDepartures: any[] | null = []
  let inHouseBookings: any[] | null = []
  let dirtyRooms: any[] | null = []
  let openTickets: any[] | null = []
  let monthlyPayments: any[] | null = []
  let recentBookings: any[] | null = []
  let revenueByDay: any[] | null = []
  let forecastBookings: any[] | null = []
  let overdueCheckouts: any[] | null = []
  let monthlyBookings: any[] | null = []

  try {
    const results = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_in_date', today).in('status', ['confirmed', 'checked_in']),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').eq('check_out_date', today).in('status', ['confirmed', 'checked_in']),
      supabase.from('bookings').select('id, room_id').eq('status', 'checked_in'),
      supabase.from('rooms').select('id, room_number, room_type, cleaning_status').eq('cleaning_status', 'dirty').eq('is_active', true),
      supabase.from('maintenance_tickets').select('id, title, priority, status, room:rooms(room_number)').eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('payments').select('amount').eq('status', 'succeeded').gte('created_at', monthStart),
      supabase.from('bookings').select('*, room:rooms(room_number, room_type)').order('created_at', { ascending: false }).limit(5),
      supabase.from('payments').select('amount, created_at').eq('status', 'succeeded').gte('created_at', sevenDaysAgo),
      supabase.from('bookings').select('check_in_date, check_out_date, room_id').in('status', ['confirmed', 'checked_in']).gte('check_out_date', today).lte('check_in_date', sevenDaysFromNow),
      supabase.from('bookings').select('id, guest_first_name, guest_last_name, check_out_date, room:rooms(room_number)').eq('status', 'checked_in').lt('check_out_date', today),
      supabase.from('bookings').select('check_in_date, check_out_date, total_amount').in('status', ['confirmed', 'checked_in', 'checked_out']).gte('check_in_date', monthStart),
    ])

    rooms = results[0].data
    todayArrivals = results[1].data
    todayDepartures = results[2].data
    inHouseBookings = results[3].data
    dirtyRooms = results[4].data
    openTickets = results[5].data
    monthlyPayments = results[6].data
    recentBookings = results[7].data
    revenueByDay = results[8].data
    forecastBookings = results[9].data
    overdueCheckouts = results[10].data
    monthlyBookings = results[11].data
  } catch (error) {
    console.error('Error fetching dashboard statistics from Supabase:', error)
  }

  const totalRooms = rooms?.length ?? 0
  const occupiedRoomIds = new Set((inHouseBookings ?? []).map((b: any) => b.room_id))
  const occupiedRooms = occupiedRoomIds.size
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
  const monthRevenue = (monthlyPayments ?? []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)

  // 7-day revenue chart
  const revenueDays: { date: string; amount: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const total = (revenueByDay ?? []).filter((p: any) => p.created_at.startsWith(dateStr)).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)
    revenueDays.push({ date: dateStr, amount: total })
  }

  // 7-day occupancy forecast
  const forecastDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const occupied = (forecastBookings ?? []).filter((b: any) => b.check_in_date <= dateStr && b.check_out_date > dateStr).length
    return { date: dateStr, occupiedRooms: occupied, totalRooms, occupancyRate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0 }
  })

  // Rooms with effective status for the grid
  const roomsForGrid = (rooms ?? []).map((room: any) => {
    let effectiveStatus: string
    if (occupiedRoomIds.has(room.id)) {
      effectiveStatus = 'occupied'
    } else if (room.cleaning_status === 'dirty') {
      effectiveStatus = 'dirty'
    } else if (room.cleaning_status === 'cleaning') {
      effectiveStatus = 'cleaning'
    } else if (room.status === 'maintenance') {
      effectiveStatus = 'maintenance'
    } else if (room.status === 'blocked') {
      effectiveStatus = 'blocked'
    } else {
      effectiveStatus = 'available'
    }
    return { id: room.id, room_number: room.room_number, room_type: room.room_type, floor: room.floor, effectiveStatus }
  })

  // Action required: dirty rooms that have an arrival today
  const todayArrivalRoomIds = new Set((todayArrivals ?? []).map((b: any) => b.room_id))
  const dirtyArrivalRooms = (dirtyRooms ?? []).filter((r: any) => todayArrivalRoomIds.has(r.id)).map((r: any) => ({ id: r.id, room_number: r.room_number }))
  const urgentTickets = (openTickets ?? []).filter((t: any) => t.priority === 'urgent')

  // ADR, ALOS, RevPAR
  const bookingsList = monthlyBookings ?? []
  const totalNights = bookingsList.reduce((sum: number, b: any) => {
    const nights = Math.max(0, (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / 86400000)
    return sum + nights
  }, 0)
  const adr = totalNights > 0 ? monthRevenue / totalNights : 0
  const alos = bookingsList.length > 0 ? totalNights / bookingsList.length : 0
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const revpar = totalRooms > 0 ? monthRevenue / (totalRooms * daysInMonth) : 0

  return {
    totalRooms, occupiedRooms, occupancyRate, monthRevenue,
    todayArrivals: todayArrivals ?? [],
    todayDepartures: todayDepartures ?? [],
    dirtyRoomsCount: dirtyRooms?.length ?? 0,
    dirtyRooms: dirtyRooms ?? [],
    openTicketsCount: openTickets?.length ?? 0,
    openTickets: openTickets ?? [],
    recentBookings: recentBookings ?? [],
    revenueDays,
    forecastDays,
    roomsForGrid,
    overdueCheckouts: overdueCheckouts ?? [],
    dirtyArrivalRooms,
    urgentTickets,
    revpar, adr, alos,
  }
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats()
  const today = new Date()

  return (
    <div className="space-y-5">

      {/* Row 1: KPI Stat Cards */}
      <DashboardStatCards
        occupancyRate={stats.occupancyRate}
        occupiedRooms={stats.occupiedRooms}
        totalRooms={stats.totalRooms}
        monthRevenue={stats.monthRevenue}
        dirtyRoomsCount={stats.dirtyRoomsCount}
        dirtyRooms={stats.dirtyRooms as any[]}
        openTicketsCount={stats.openTicketsCount}
        openTickets={stats.openTickets as any[]}
      />

      {/* Row 2: 7-Day Occupancy Forecast */}
      <DashboardForecastStrip forecast={stats.forecastDays} />

      {/* Row 3: Revenue Chart + Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashboardRevenueChart data={stats.revenueDays} monthRevenue={stats.monthRevenue} />
        <DashboardActionRequired
          overdueCheckouts={stats.overdueCheckouts as any[]}
          dirtyArrivalRooms={stats.dirtyArrivalRooms}
          urgentTickets={stats.urgentTickets as any[]}
        />
      </div>

      {/* Row 4: Room Status Grid */}
      <DashboardRoomGrid rooms={stats.roomsForGrid as any[]} />

      {/* Row 5: RevPAR / ADR / ALOS */}
      <DashboardKpiRow revpar={stats.revpar} adr={stats.adr} alos={stats.alos} />

      {/* Row 6: Today's Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

      {/* Row 7: Recent Bookings */}
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
