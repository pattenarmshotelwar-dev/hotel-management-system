'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { formatCurrency, getRoomTypeLabel, cn } from '@/lib/utils'
import {
  TrendingUp,
  Flame,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Save,
  RefreshCw,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Percent,
  ArrowUpRight,
  ShieldAlert,
  Info,
  Globe,
  Link2,
  ExternalLink,
  Radio,
  Key,
  Plus,
  X,
  Tag,
  Check,
  Activity,
  Trash2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

export interface EventItem {
  id: string
  title: string
  venue: string
  category: 'sports' | 'music' | 'business' | 'festival'
  dateRange: string
  impact: 'Very High' | 'High' | 'Medium'
  recommendedSurge: number
  description: string
  autoSurgeApplied?: boolean
  url?: string
  distanceMiles?: number
  source?: 'ticketmaster' | 'warrington_radar' | 'custom'
  startDate?: string
}

export default function PricingPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Midweek / Weekend pricing rules
  const [midweekAdjustment, setMidweekAdjustment] = useState<number>(0) // in %
  const [weekendAdjustment, setWeekendAdjustment] = useState<number>(20) // in %
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(0) // current active surge in %
  const [surgeReason, setSurgeReason] = useState<string>('')
  const [activeSurgeEvents, setActiveSurgeEvents] = useState<Record<string, boolean>>({})

  // Booking.com OTA Channel Parity & Margin Markup
  const [bookingComCommission, setBookingComCommission] = useState<number>(15) // standard 15% OTA commission
  const [syncingBookingCom, setSyncingBookingCom] = useState(false)
  const [bookingComLastSync, setBookingComLastSync] = useState<string | null>(null)

  // Room custom overrides (base price, weekend price)
  const [roomRates, setRoomRates] = useState<Record<string, { base: number; weekend: number }>>({})

  // Live automated event radar & integration state
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsCategory, setEventsCategory] = useState<string>('all')
  const [eventsSource, setEventsSource] = useState<string>('Warrington Live Dynamic Radar')
  const [lastEventsUpdate, setLastEventsUpdate] = useState<string | null>(null)
  const [ticketmasterConnected, setTicketmasterConnected] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [ticketmasterApiKey, setTicketmasterApiKey] = useState('')
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [customEvents, setCustomEvents] = useState<EventItem[]>([])
  const [newEvent, setNewEvent] = useState({
    title: '',
    venue: 'Patten Arms Hotel Area',
    category: 'music' as 'sports' | 'music' | 'business' | 'festival',
    dateRange: '',
    impact: 'High' as 'Very High' | 'High' | 'Medium',
    recommendedSurge: 20,
    description: '',
  })

  useEffect(() => {
    fetchRooms()
    loadSavedPricingConfig()
    const savedKey = localStorage.getItem('patten_ticketmaster_api_key') || process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY || ''
    if (savedKey) setTicketmasterApiKey(savedKey)
    const savedCustom = localStorage.getItem('patten_custom_events')
    if (savedCustom) {
      try {
        setCustomEvents(JSON.parse(savedCustom))
      } catch (e) {}
    }
    fetchLiveEvents('all', savedKey)
  }, [])

  const fetchLiveEvents = async (category = 'all', keyOverride?: string) => {
    setEventsLoading(true)
    try {
      const keyToUse = keyOverride !== undefined ? keyOverride : (ticketmasterApiKey || localStorage.getItem('patten_ticketmaster_api_key') || process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY || '')
      const url = new URL('/api/admin/events', window.location.origin)
      if (category !== 'all') url.searchParams.set('category', category)
      if (keyToUse) url.searchParams.set('apiKey', keyToUse)
      url.searchParams.set('refresh', 'true')

      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.success && Array.isArray(data.events)) {
        // Merge custom events
        let savedCustomList: EventItem[] = customEvents
        try {
          const savedCustomStr = localStorage.getItem('patten_custom_events')
          if (savedCustomStr) savedCustomList = JSON.parse(savedCustomStr)
        } catch (e) {}

        const matchingCustom = category === 'all' 
          ? savedCustomList 
          : savedCustomList.filter(c => c.category === category)

        setEvents([...matchingCustom, ...data.events])
        setEventsSource(data.source || 'Warrington Live Dynamic Radar')
        setTicketmasterConnected(!!data.ticketmasterConnected)
        setLastEventsUpdate(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
      toast.error('Failed to refresh live events')
    } finally {
      setEventsLoading(false)
    }
  }

  const handleSaveTicketmasterKey = () => {
    localStorage.setItem('patten_ticketmaster_api_key', ticketmasterApiKey.trim())
    setShowApiKeyModal(false)
    toast.success('Ticketmaster API Key saved. Refreshing live events...')
    fetchLiveEvents(eventsCategory, ticketmasterApiKey.trim())
  }

  const handleAddCustomEvent = () => {
    if (!newEvent.title.trim() || !newEvent.dateRange.trim()) {
      toast.error('Please enter an event title and date')
      return
    }
    const created: EventItem = {
      id: `custom_${Date.now()}`,
      title: newEvent.title.trim(),
      venue: newEvent.venue.trim() || 'Patten Arms Hotel Area',
      category: newEvent.category,
      dateRange: newEvent.dateRange.trim(),
      impact: newEvent.impact,
      recommendedSurge: Number(newEvent.recommendedSurge) || 20,
      description: newEvent.description.trim() || 'Custom hotel/local high-demand event.',
      source: 'custom',
    }
    const updated = [created, ...customEvents]
    setCustomEvents(updated)
    localStorage.setItem('patten_custom_events', JSON.stringify(updated))
    setEvents(prev => [created, ...prev])
    setShowAddEventModal(false)
    setNewEvent({
      title: '',
      venue: 'Patten Arms Hotel Area',
      category: 'music',
      dateRange: '',
      impact: 'High',
      recommendedSurge: 20,
      description: '',
    })
    toast.success(`Added custom event: ${created.title}`)
  }

  const handleDeleteCustomEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customEvents.filter(item => item.id !== id)
    setCustomEvents(updated)
    localStorage.setItem('patten_custom_events', JSON.stringify(updated))
    setEvents(prev => prev.filter(item => item.id !== id))
    toast.info('Custom event removed')
  }

  const loadSavedPricingConfig = () => {
    try {
      const saved = localStorage.getItem('patten_pricing_yield_config')
      if (saved) {
        const config = JSON.parse(saved)
        if (config.midweekAdjustment !== undefined) setMidweekAdjustment(config.midweekAdjustment)
        if (config.weekendAdjustment !== undefined) setWeekendAdjustment(config.weekendAdjustment)
        if (config.surgeMultiplier !== undefined) setSurgeMultiplier(config.surgeMultiplier)
        if (config.surgeReason !== undefined) setSurgeReason(config.surgeReason)
        if (config.activeSurgeEvents) setActiveSurgeEvents(config.activeSurgeEvents)
        if (config.bookingComCommission !== undefined) setBookingComCommission(config.bookingComCommission)
        if (config.bookingComLastSync) setBookingComLastSync(config.bookingComLastSync)
      }
    } catch (e) {}
  }

  const fetchRooms = async () => {
    setLoading(true)
    const { data } = await supabase.from('rooms').select('*').order('room_number')
    if (data) {
      setRooms(data)
      const initialRates: Record<string, { base: number; weekend: number }> = {}
      data.forEach(r => {
        initialRates[r.id] = {
          base: Number(r.base_price) || 50,
          weekend: Math.round((Number(r.base_price) || 50) * 1.2),
        }
      })
      // If local overrides exist
      const localRates = localStorage.getItem('patten_room_rate_overrides')
      if (localRates) {
        try {
          const parsed = JSON.parse(localRates)
          Object.assign(initialRates, parsed)
        } catch (e) {}
      }
      setRoomRates(initialRates)
    }
    setLoading(false)
  }

  const handleBaseRateChange = (roomId: string, newBase: number) => {
    setRoomRates(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        base: newBase,
        weekend: Math.round(newBase * (1 + weekendAdjustment / 100)),
      },
    }))
  }

  const handleWeekendRateChange = (roomId: string, newWeekend: number) => {
    setRoomRates(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        weekend: newWeekend,
      },
    }))
  }

  const handleToggleEventSurge = (event: EventItem) => {
    const isNowActive = !activeSurgeEvents[event.id]
    const updatedEvents = { ...activeSurgeEvents, [event.id]: isNowActive }
    setActiveSurgeEvents(updatedEvents)

    if (isNowActive) {
      setSurgeMultiplier(event.recommendedSurge)
      setSurgeReason(event.title)
      toast.success(`⚡ Surge rate of +${event.recommendedSurge}% activated for ${event.title}!`)
    } else {
      // Find another active event if any
      const activeIds = Object.keys(updatedEvents).filter(id => updatedEvents[id])
      if (activeIds.length > 0) {
        const other = events.find(e => e.id === activeIds[0])
        setSurgeMultiplier(other ? other.recommendedSurge : 0)
        setSurgeReason(other ? other.title : '')
      } else {
        setSurgeMultiplier(0)
        setSurgeReason('')
        toast.info('Surge pricing reset to 0%')
      }
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    // 1. Save yield rules
    const config = {
      midweekAdjustment,
      weekendAdjustment,
      surgeMultiplier,
      surgeReason,
      activeSurgeEvents,
      bookingComCommission,
      bookingComLastSync,
    }
    localStorage.setItem('patten_pricing_yield_config', JSON.stringify(config))
    localStorage.setItem('patten_room_rate_overrides', JSON.stringify(roomRates))

    // 2. Persist updated base prices to Supabase rooms table
    let errors = 0
    for (const room of rooms) {
      const rate = roomRates[room.id]
      if (rate && rate.base !== room.base_price) {
        const { error } = await supabase
          .from('rooms')
          .update({ base_price: rate.base })
          .eq('id', room.id)
        if (error) errors++
      }
    }

    setSaving(false)
    if (errors === 0) {
      toast.success('Yield management and room prices updated successfully!')
    } else {
      toast.warning('Prices saved locally, but some database updates had issues.')
    }
  }

  const handleSyncBookingComRates = async () => {
    setSyncingBookingCom(true)
    try {
      const payloadRates: Record<string, number> = {}
      rooms.forEach(r => {
        const current = roomRates[r.id]?.base || r.base_price
        payloadRates[r.id] = calculateBookingComRate(current, false)
      })

      const res = await fetch('/api/pricing/booking-com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelMarkupPercent: bookingComCommission,
          rates: payloadRates,
          updateBasePrices: false,
        }),
      })
      const data = await res.json()
      const syncTimestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      setBookingComLastSync(syncTimestamp)

      // Save to localStorage
      const saved = localStorage.getItem('patten_pricing_yield_config')
      const currentConfig = saved ? JSON.parse(saved) : {}
      currentConfig.bookingComCommission = bookingComCommission
      currentConfig.bookingComLastSync = syncTimestamp
      localStorage.setItem('patten_pricing_yield_config', JSON.stringify(currentConfig))

      toast.success(`Booking.com rates updated with +${bookingComCommission}% margin parity!`)
    } catch (e) {
      toast.error('Failed to sync rates to Booking.com endpoint')
    }
    setSyncingBookingCom(false)
  }

  // Calculate live dynamic rate for direct booking
  const calculateEffectiveRate = (baseRate: number, isWeekend: boolean) => {
    let rate = baseRate
    if (isWeekend) {
      rate = rate * (1 + weekendAdjustment / 100)
    } else if (midweekAdjustment !== 0) {
      rate = rate * (1 + midweekAdjustment / 100)
    }
    if (surgeMultiplier > 0) {
      rate = rate * (1 + surgeMultiplier / 100)
    }
    return Math.round(rate)
  }

  // Calculate Booking.com channel rate (Direct rate + OTA markup to ensure hotel receives desired net revenue after 15% fee)
  const calculateBookingComRate = (baseRate: number, isWeekend: boolean) => {
    const direct = calculateEffectiveRate(baseRate, isWeekend)
    return Math.round(direct * (1 + bookingComCommission / 100))
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Pricing & Yield Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimize nightly RevPAR, set Midweek vs. Weekend multipliers, and capitalize on Warrington stadium events & festivals.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving Changes...' : 'Save & Publish Rates'}
        </button>
      </div>

      {/* Active Surge Banner if Enabled */}
      {surgeMultiplier > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs">
              <Flame className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/30 px-2 py-0.5 rounded-md">
                  Active Surge Mode
                </span>
                <span className="text-base font-extrabold font-mono">+{surgeMultiplier}%</span>
              </div>
              <p className="text-xs text-white/90 mt-0.5 font-medium">
                Applied due to: <strong>{surgeReason || 'High Demand Period'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSurgeMultiplier(0)
              setSurgeReason('')
              setActiveSurgeEvents({})
              toast.info('Surge turned off')
            }}
            className="px-3 py-1.5 bg-white text-orange-700 font-bold rounded-xl text-xs hover:bg-white/90 transition cursor-pointer shadow-xs"
          >
            Deactivate Surge
          </button>
        </div>
      )}

      {/* Grid: Rate Rules & Surge Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Event Radar & Surge Trigger */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warrington Local Event Radar Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Warrington & Cheshire Live Event Radar</h2>
                    {ticketmasterConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ticketmaster Live API
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Live Dynamic Radar (WA1)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Live demand tracker for rugby derbies, Parr Hall gigs, and regional festivals • {lastEventsUpdate ? `Updated at ${lastEventsUpdate}` : 'Auto-synced'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchLiveEvents(eventsCategory)}
                  disabled={eventsLoading}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Force refresh live events feed"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', eventsLoading && 'animate-spin')} />
                  <span className="hidden sm:inline">Refresh Feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(true)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Configure Ticketmaster API Key"
                >
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">API Key</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddEventModal(true)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Event</span>
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'All Dates' },
                { id: 'sports', label: '🏉 Sports & Rugby' },
                { id: 'music', label: '🎵 Music & Comedy' },
                { id: 'festival', label: '🎪 Festivals' },
                { id: 'business', label: '💼 Business Expos' },
              ].map(cat => {
                const isActive = eventsCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setEventsCategory(cat.id)
                      fetchLiveEvents(cat.id)
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl font-semibold transition shrink-0 cursor-pointer',
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Events List */}
            {eventsLoading ? (
              <div className="py-12 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Scanning live Warrington & Cheshire fixtures...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="py-10 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">No events found in this category.</p>
                <button
                  onClick={() => {
                    setEventsCategory('all')
                    fetchLiveEvents('all')
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  View All Events
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(event => {
                  const isSurgeOn = !!activeSurgeEvents[event.id]
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isSurgeOn
                          ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-slate-900 truncate max-w-md">
                            {event.title}
                          </h3>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 transition p-0.5"
                              title="Open event details / tickets"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                              event.impact === 'Very High'
                                ? 'bg-red-100 text-red-700'
                                : event.impact === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-700'
                            )}
                          >
                            {event.impact} Demand
                          </span>
                          {event.source === 'ticketmaster' ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                              Ticketmaster
                            </span>
                          ) : event.source === 'custom' ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                              In-House Custom
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                              Warrington Radar
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {event.venue}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Calendar className="w-3 h-3 text-blue-500 shrink-0" /> {event.dateRange}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {event.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Recommended</span>
                          <span className="text-xs font-extrabold text-amber-700 font-mono">+{event.recommendedSurge}% Surge</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleEventSurge(event)}
                          className={cn(
                            'px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs',
                            isSurgeOn
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          <Flame className={cn('w-3.5 h-3.5', isSurgeOn ? 'fill-white' : 'text-amber-500')} />
                          {isSurgeOn ? 'Surge Applied' : 'Apply Surge'}
                        </button>
                        {event.source === 'custom' && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomEvent(event.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete custom event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Surge Manual Slider */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Immediate Demand Surge Multiplier</h2>
                  <p className="text-[11px] text-slate-500">Temporarily adjust room rates across all rooms during sudden high demand</p>
                </div>
              </div>
              <span className="text-sm font-extrabold font-mono text-orange-600">
                +{surgeMultiplier}%
              </span>
            </div>

            <div className="space-y-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={surgeMultiplier}
                onChange={e => {
                  const val = Number(e.target.value)
                  setSurgeMultiplier(val)
                  if (val === 0) setSurgeReason('')
                  else if (!surgeReason) setSurgeReason('Manual Demand Multiplier')
                }}
                className="w-full accent-orange-600 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>0% (Standard)</span>
                <span>+25% (Busy)</span>
                <span>+50% (High Surge)</span>
                <span>+100% (Double Rack)</span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2">
                {[0, 15, 30, 50].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setSurgeMultiplier(val)
                      if (val === 0) setSurgeReason('')
                      else setSurgeReason(`Quick Preset +${val}%`)
                    }}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer',
                      surgeMultiplier === val
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {val === 0 ? 'Standard (0%)' : `+${val}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Midweek vs Weekend Pricing Rules */}
        <div className="space-y-6">
          {/* Day of Week Strategy */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Midweek & Weekend Rules</h2>
                <p className="text-[11px] text-slate-500">Automatic price adjustments based on day of week</p>
              </div>
            </div>

            {/* Weekend Surcharge */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950">
                  Weekend Rate Uplift (Fri & Sat)
                </label>
                <span className="text-xs font-extrabold font-mono text-emerald-700">
                  +{weekendAdjustment}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={weekendAdjustment}
                onChange={e => {
                  const val = Number(e.target.value)
                  setWeekendAdjustment(val)
                  // Recalculate room weekend rates
                  setRoomRates(prev => {
                    const next = { ...prev }
                    Object.keys(next).forEach(id => {
                      next[id].weekend = Math.round(next[id].base * (1 + val / 100))
                    })
                    return next
                  })
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Applies automatically to Friday and Saturday reservations to capture leisure travel demand.
              </p>
            </div>

            {/* Midweek Surcharge / Discount */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Midweek Adjustment (Mon – Thu)
                </label>
                <span className="text-xs font-extrabold font-mono text-slate-700">
                  {midweekAdjustment >= 0 ? `+${midweekAdjustment}%` : `${midweekAdjustment}%`}
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={5}
                value={midweekAdjustment}
                onChange={e => setMidweekAdjustment(Number(e.target.value))}
                className="w-full accent-slate-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Keep at 0% for standard rack rate, or discount up to -20% during quiet winter midweeks to drive contractor bookings.
              </p>
            </div>

            {/* Booking.com OTA Channel Parity & Margin Protection */}
            <div className="bg-sky-50/80 border border-sky-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-600" />
                  <label className="text-xs font-bold text-sky-950">
                    Booking.com OTA Markup
                  </label>
                </div>
                <span className="text-xs font-extrabold font-mono text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md">
                  +{bookingComCommission}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={bookingComCommission}
                onChange={e => setBookingComCommission(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />

              <p className="text-[11px] text-sky-800 leading-relaxed">
                Automatically offsets Booking.com’s standard ~15% commission fee so the hotel preserves full profit margin across OTA listings.
              </p>

              <div className="pt-1 flex items-center justify-between text-[11px] border-t border-sky-200/60 mt-2">
                <span className="text-slate-500 font-medium">
                  {bookingComLastSync ? `Last synced: ${bookingComLastSync}` : 'iCal feed connected'}
                </span>
                <button
                  type="button"
                  onClick={handleSyncBookingComRates}
                  disabled={syncingBookingCom}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', syncingBookingCom && 'animate-spin')} />
                  {syncingBookingCom ? 'Syncing...' : 'Sync OTA Rates'}
                </button>
              </div>
            </div>

            {/* Yield Strategy Info */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-[11px] text-blue-900">
              <div className="flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Revenue Tip:
              </div>
              <p>
                Warrington Bank Quay station is directly across the street. Midweek stays are strongly driven by corporate business travelers, whilst weekends spike during rugby fixtures.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Room-by-Room Dynamic Rate Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Room Pricing & Live Dynamic Yield Table</h2>
            <p className="text-[11px] text-slate-500">Calculates active selling prices for Direct Bookings vs. Booking.com OTA channels with weekend & surge rules</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              {rooms.length} Rooms Loaded
            </span>
            <button
              onClick={handleSyncBookingComRates}
              disabled={syncingBookingCom}
              className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" /> Push to Booking.com
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Direct Midweek (£)</th>
                <th className="px-4 py-3">Direct Weekend (£)</th>
                <th className="px-4 py-3 bg-amber-50/80 text-amber-900">
                  Live Direct Rate
                </th>
                <th className="px-4 py-3 bg-sky-50/80 text-sky-950 font-bold border-l border-sky-100">
                  🌐 Booking.com Rate (+{bookingComCommission}%)
                </th>
                <th className="px-4 py-3 text-right">Quick Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map(room => {
                const currentRates = roomRates[room.id] || {
                  base: room.base_price,
                  weekend: Math.round(room.base_price * 1.2),
                }
                const liveMidweek = calculateEffectiveRate(currentRates.base, false)
                const liveWeekend = calculateEffectiveRate(currentRates.base, true)
                const bcomMidweek = calculateBookingComRate(currentRates.base, false)
                const bcomWeekend = calculateBookingComRate(currentRates.base, true)

                return (
                  <tr key={room.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-bold font-mono text-slate-900">
                      Room {room.room_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {getRoomTypeLabel(room.room_type)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">Floor {room.floor}</td>

                    {/* Standard Midweek Input */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-400">£</span>
                        <input
                          type="number"
                          value={currentRates.base}
                          onChange={e => handleBaseRateChange(room.id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </td>

                    {/* Standard Weekend Input */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-400">£</span>
                        <input
                          type="number"
                          value={currentRates.weekend}
                          onChange={e => handleWeekendRateChange(room.id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/40"
                        />
                      </div>
                    </td>

                    {/* Dynamic Direct Rate Under Surge */}
                    <td className="px-4 py-3 bg-amber-50/50">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">Midweek</span>
                          <span className="font-bold text-slate-900 font-mono text-xs">
                            £{liveMidweek}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 uppercase block font-semibold">Weekend</span>
                          <span className="font-bold text-emerald-700 font-mono text-xs">
                            £{liveWeekend}
                          </span>
                        </div>
                        {surgeMultiplier > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-md">
                            +{surgeMultiplier}%
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Booking.com Live Selling Rate (Direct + Commission Parity) */}
                    <td className="px-4 py-3 bg-sky-50/40 border-l border-sky-100">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] text-sky-600 uppercase block font-semibold">OTA Mid</span>
                          <span className="font-bold text-sky-900 font-mono text-xs">
                            £{bcomMidweek}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-sky-600 uppercase block font-semibold">OTA Wknd</span>
                          <span className="font-bold text-sky-950 font-mono text-xs">
                            £{bcomWeekend}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Net: £{liveMidweek})
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          handleBaseRateChange(room.id, Math.round(currentRates.base * 1.05))
                          toast.success(`Room ${room.room_number} bumped +5%`)
                        }}
                        className="p-1 px-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition cursor-pointer"
                        title="Bump +5%"
                      >
                        +5%
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticketmaster API Key Configuration Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ticketmaster Live Feed Setup</h3>
                  <p className="text-[11px] text-slate-500">Automate real-time Warrington concert & stadium sync</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Enter your free <strong>Ticketmaster Discovery API Key</strong> to automatically ingest live concerts, touring artists, and stadium fixtures within a 20-mile radius of Patten Arms Hotel.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ticketmaster Consumer API Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. AbC123xYz987..."
                  value={ticketmasterApiKey}
                  onChange={e => setTicketmasterApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-[11px] text-purple-900 space-y-1">
                <p className="font-semibold">Need a free API key?</p>
                <p>
                  You can register for a 100% free account on the{' '}
                  <a
                    href="https://developer.ticketmaster.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 underline font-bold inline-flex items-center gap-0.5"
                  >
                    Ticketmaster Developer Portal <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  {' '}(includes 5,000 free API queries/day).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {ticketmasterApiKey ? (
                <button
                  type="button"
                  onClick={() => {
                    setTicketmasterApiKey('')
                    localStorage.removeItem('patten_ticketmaster_api_key')
                    setShowApiKeyModal(false)
                    toast.info('Ticketmaster API key removed. Using Warrington dynamic radar.')
                    fetchLiveEvents(eventsCategory, '')
                  }}
                  className="text-xs text-red-600 hover:underline font-medium cursor-pointer"
                >
                  Clear Key
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTicketmasterKey}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  Save & Connect Feed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Hotel Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Custom Hotel Event</h3>
                  <p className="text-[11px] text-slate-500">Track local weddings, conferences, or private banquets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Warrington Town Hall Charity Gala / Wedding Block"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newEvent.category}
                    onChange={e => setNewEvent({ ...newEvent, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="music">Music & Gala</option>
                    <option value="sports">Sports Fixture</option>
                    <option value="business">Corporate / Business</option>
                    <option value="festival">Festival / Celebration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Demand Level
                  </label>
                  <select
                    value={newEvent.impact}
                    onChange={e => setNewEvent({ ...newEvent, impact: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Very High">Very High (+35–60%)</option>
                    <option value="High">High (+20–30%)</option>
                    <option value="Medium">Medium (+10–15%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dates & Schedule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sat, 18 Oct 2026 • Evening Reception"
                  value={newEvent.dateRange}
                  onChange={e => setNewEvent({ ...newEvent, dateRange: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Patten Arms Function Room or Warrington Town Centre"
                  value={newEvent.venue}
                  onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Surge Uplift
                  </label>
                  <span className="text-xs font-bold text-amber-700 font-mono">
                    +{newEvent.recommendedSurge}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={newEvent.recommendedSurge}
                  onChange={e => setNewEvent({ ...newEvent, recommendedSurge: Number(e.target.value) })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of expected guests, party size, or room block requirements..."
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomEvent}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
