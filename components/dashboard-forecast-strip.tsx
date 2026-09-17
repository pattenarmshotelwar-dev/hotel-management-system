'use client'

interface DayForecast {
  date: string
  occupiedRooms: number
  totalRooms: number
  occupancyRate: number
}

interface Props {
  forecast: DayForecast[]
}

export function DashboardForecastStrip({ forecast }: Props) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">🔮 7-Day Occupancy Forecast</h3>
          <p className="text-xs text-slate-400 mt-0.5">Projected occupancy based on confirmed bookings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-xs text-slate-400">&gt;70%</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-xs text-slate-400">40–70%</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-xs text-slate-400">&lt;40%</span></div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {forecast.map((day) => {
          const isToday = day.date === today
          const rate = day.occupancyRate
          const d = new Date(day.date + 'T12:00:00')

          const barColor = rate >= 70 ? 'bg-green-500' : rate >= 40 ? 'bg-amber-400' : rate > 0 ? 'bg-red-400' : 'bg-slate-100'
          const valueColor = rate >= 70 ? 'text-green-700' : rate >= 40 ? 'text-amber-700' : rate > 0 ? 'text-red-600' : 'text-slate-300'
          const cardBg = rate >= 70 ? 'bg-green-50 border-green-200' : rate >= 40 ? 'bg-amber-50 border-amber-200' : rate > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'

          return (
            <div
              key={day.date}
              className={`rounded-xl border p-2.5 text-center transition-all ${cardBg} ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
            >
              <p className="text-xs font-semibold text-slate-600">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </p>
              <p className="text-xs text-slate-400 mb-2">
                {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>

              {/* Mini bar */}
              <div className="w-full bg-white/60 rounded-full h-1.5 mb-2 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${rate}%` }}
                />
              </div>

              <p className={`text-sm font-bold ${valueColor}`}>{rate}%</p>
              <p className="text-xs text-slate-400">{day.occupiedRooms}/{day.totalRooms}</p>
              {isToday && (
                <span className="inline-block mt-1 text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md">Today</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
