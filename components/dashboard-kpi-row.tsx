interface Props {
  revpar: number
  adr: number
  alos: number
}

export function DashboardKpiRow({ revpar, adr, alos }: Props) {
  const metrics = [
    {
      label: 'RevPAR',
      value: `£${revpar.toFixed(2)}`,
      description: 'Revenue Per Available Room',
      sub: 'per room per day this month',
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      icon: '📐',
    },
    {
      label: 'ADR',
      value: `£${adr.toFixed(2)}`,
      description: 'Average Daily Rate',
      sub: 'avg rate per occupied room night',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: '💷',
    },
    {
      label: 'ALOS',
      value: `${alos.toFixed(1)} nights`,
      description: 'Average Length of Stay',
      sub: 'avg nights per booking this month',
      color: 'text-teal-700',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      icon: '🌙',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map((m) => (
        <div key={m.label} className={`${m.bg} rounded-2xl border ${m.border} p-5`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{m.icon}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{m.label}</span>
          </div>
          <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          <p className="text-sm font-medium text-slate-700 mt-1">{m.description}</p>
          <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
        </div>
      ))}
    </div>
  )
}
