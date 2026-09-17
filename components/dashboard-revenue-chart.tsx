'use client'

interface DayRevenue {
  date: string
  amount: number
}

interface Props {
  data: DayRevenue[]
  monthRevenue: number
}

export function DashboardRevenueChart({ data, monthRevenue }: Props) {
  const max = Math.max(...data.map(d => d.amount), 1)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-800">Revenue — Last 7 Days</h3>
          <p className="text-xs text-slate-400 mt-0.5">Confirmed payments by day</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Month total</p>
          <p className="text-base font-bold text-green-600">
            £{monthRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-2 flex-1 min-h-[120px]">
        {data.map((day) => {
          const barPct = day.amount > 0 ? Math.max((day.amount / max) * 100, 4) : 3
          const isToday = day.date === today
          const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
          const dayNum = new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

          return (
            <div key={day.date} className="flex flex-col items-center gap-1 flex-1 group">
              {/* Amount label */}
              <span className={`text-xs font-medium transition-opacity ${day.amount > 0 ? 'opacity-100' : 'opacity-0'} ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                £{day.amount >= 1000
                  ? (day.amount / 1000).toFixed(1) + 'k'
                  : Math.round(day.amount)}
              </span>
              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: '100px' }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isToday
                      ? 'bg-blue-500'
                      : day.amount > 0
                      ? 'bg-slate-300 group-hover:bg-slate-400'
                      : 'bg-slate-100'
                  }`}
                  style={{ height: `${barPct}%` }}
                />
              </div>
              {/* Labels */}
              <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{dayName}</span>
              <span className="text-xs text-slate-300">{dayNum}</span>
              {isToday && <span className="text-xs text-blue-500 font-semibold">Today</span>}
            </div>
          )
        })}
      </div>

      {/* Zero line */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">7-day chart</span>
        <span className="text-xs text-slate-400">
          Total: £{data.reduce((s, d) => s + d.amount, 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  )
}
