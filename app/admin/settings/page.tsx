'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, getRoomTypeLabel, cn } from '@/lib/utils'
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Copy,
  ExternalLink,
  BedDouble,
  Calendar,
  Building,
  CheckCircle2,
  AlertCircle,
  Search,
  Wifi,
  Clock,
  Phone,
  Mail,
  MapPin,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import NewRoomModal from '@/components/settings/NewRoomModal'

export default function SettingsPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [activeTab, setActiveTab] = useState<'rooms' | 'ical' | 'hotel'>('rooms')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [showNewRoomModal, setShowNewRoomModal] = useState(false)

  // Track room modifications
  const [editedRooms, setEditedRooms] = useState<Record<string, Partial<Room>>>({})

  // Hotel Profile Form state (persisted locally / ready for config)
  const [hotelConfig, setHotelConfig] = useState({
    name: 'Patten Arms Hotel',
    phone: '+44 1925 650144',
    email: 'pattenarmshotelwar@gmail.com',
    address: 'Parker Street, Warrington, WA1 1HG, UK',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    wifiNetwork: 'Patten_Guest_WiFi',
    wifiPassword: 'PattenArmsWelcome',
    cleanerPhone: '+44 7700 900123',
    cancellationPolicy: 'Free cancellation up to 24 hours prior to check-in. Non-refundable afterwards.',
  })
  const [savingHotelConfig, setSavingHotelConfig] = useState(false)

  useEffect(() => {
    fetchRooms()
    fetchLogs()
    const savedConfig = localStorage.getItem('patten_hotel_config')
    if (savedConfig) {
      try {
        setHotelConfig(JSON.parse(savedConfig))
      } catch (e) {}
    }
  }, [])

  const fetchRooms = async () => {
    setLoading(true)
    const { data } = await supabase.from('rooms').select('*').order('room_number')
    setRooms(data ?? [])
    setLoading(false)
  }

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('ical_sync_logs')
      .select('*, room:rooms(room_number)')
      .order('created_at', { ascending: false })
      .limit(20)
    setSyncLogs(data ?? [])
  }

  const handleEdit = (roomId: string, field: string, value: any) => {
    setEditedRooms(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], [field]: value },
    }))
  }

  const handleSaveRoom = async (room: Room) => {
    const changes = editedRooms[room.id]
    if (!changes) return
    setSaving(room.id)
    const { error } = await supabase.from('rooms').update(changes).eq('id', room.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Room ${room.room_number} updated`)
      setEditedRooms(prev => {
        const next = { ...prev }
        delete next[room.id]
        return next
      })
      fetchRooms()
    }
    setSaving(null)
  }

  const handleToggleActive = async (room: Room) => {
    const { error } = await supabase.from('rooms').update({ is_active: !room.is_active }).eq('id', room.id)
    if (error) {
      toast.error('Failed to toggle status')
    } else {
      toast.success(`Room ${room.room_number} is now ${room.is_active ? 'Inactive' : 'Active'}`)
      fetchRooms()
    }
  }

  const handleSaveIcalUrl = async (roomId: string, url: string) => {
    setSaving(roomId)
    const { error } = await supabase.from('rooms').update({ ical_import_url: url.trim() || null }).eq('id', roomId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('iCal import feed saved')
      fetchRooms()
    }
    setSaving(null)
  }

  const handleSyncAllFeeds = async () => {
    setSyncingAll(true)
    try {
      const res = await fetch('/api/ical/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Sync complete! ${data.added} added, ${data.updated} updated`)
        fetchLogs()
      } else {
        toast.error(`Sync finished with issues: ${data.message || 'Check logs'}`)
      }
    } catch (err) {
      toast.error('Failed to trigger iCal sync')
    }
    setSyncingAll(false)
  }

  const handleSaveHotelConfig = () => {
    setSavingHotelConfig(true)
    localStorage.setItem('patten_hotel_config', JSON.stringify(hotelConfig))
    setTimeout(() => {
      setSavingHotelConfig(false)
      toast.success('Hotel profile and policies updated!')
    }, 400)
  }

  const getIcalExportUrl = (roomId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://hotel-management-system-one-lovat.vercel.app'
    return `${baseUrl}/api/ical/export/${roomId}`
  }

  // Floors list
  const floors = useMemo(() => {
    const set = new Set(rooms.map(r => r.floor))
    return Array.from(set).sort((a, b) => a - b)
  }, [rooms])

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (typeFilter !== 'all' && r.room_type !== typeFilter) return false
      if (floorFilter !== 'all' && r.floor.toString() !== floorFilter) return false
      if (search && !r.room_number.includes(search)) return false
      return true
    })
  }, [rooms, typeFilter, floorFilter, search])

  const configuredIcalCount = rooms.filter(r => !!r.ical_import_url).length

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Hotel Settings & Configuration</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage room inventory, OTA channels, and hotel operations</p>
        </div>
        {activeTab === 'rooms' && (
          <button
            onClick={() => setShowNewRoomModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add New Room
          </button>
        )}
        {activeTab === 'ical' && (
          <button
            onClick={handleSyncAllFeeds}
            disabled={syncingAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', syncingAll && 'animate-spin')} />
            {syncingAll ? 'Syncing All Channels...' : 'Sync All Feeds Now'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 pb-1">
        {[
          { id: 'rooms', label: `Room Inventory (${rooms.length})` },
          { id: 'ical', label: `Booking.com iCal (${configuredIcalCount}/${rooms.length} linked)` },
          { id: 'hotel', label: 'Hotel Profile & Policies' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-xl transition',
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* TAB 1: ROOM INVENTORY */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap gap-2.5 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by room number..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="all">All Room Types</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="twin_single">Twin Single</option>
                  <option value="family">Family</option>
                </select>

                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="all">All Floors</option>
                  {floors.map(f => (
                    <option key={f} value={f.toString()}>
                      Floor {f}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-slate-400 ml-auto font-medium">
                  {filteredRooms.length} of {rooms.length} rooms
                </span>
              </div>

              {/* Rooms Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs font-semibold text-slate-500">
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Floor</th>
                        <th className="px-4 py-3">Base Rate (£)</th>
                        <th className="px-4 py-3">Max Guests</th>
                        <th className="px-4 py-3">Features / Notes</th>
                        <th className="px-4 py-3 text-center">Active</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRooms.map(room => {
                        const isEdited = !!editedRooms[room.id]
                        return (
                          <tr key={room.id} className={cn('text-xs hover:bg-slate-50/80 transition', isEdited && 'bg-blue-50/40')}>
                            <td className="px-4 py-2.5">
                              <input
                                defaultValue={room.room_number}
                                onChange={e => handleEdit(room.id, 'room_number', e.target.value)}
                                className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="capitalize font-semibold text-slate-700">
                                {getRoomTypeLabel(room.room_type)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number"
                                defaultValue={room.floor}
                                onChange={e => handleEdit(room.id, 'floor', parseInt(e.target.value))}
                                className="w-12 px-2 py-1 border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold">£</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={room.base_price}
                                  onChange={e => handleEdit(room.id, 'base_price', parseFloat(e.target.value))}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {room.max_adults}A {room.max_children > 0 ? `· ${room.max_children}C` : ''}
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                defaultValue={room.description || ''}
                                onChange={e => handleEdit(room.id, 'description', e.target.value)}
                                placeholder="Add features..."
                                className="w-full max-w-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => handleToggleActive(room)}
                                className={cn(
                                  'relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer',
                                  room.is_active ? 'bg-green-500' : 'bg-slate-300'
                                )}
                              >
                                <span
                                  className={cn(
                                    'inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow',
                                    room.is_active ? 'translate-x-4' : 'translate-x-1'
                                  )}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {isEdited && (
                                <button
                                  onClick={() => handleSaveRoom(room)}
                                  disabled={saving === room.id}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition font-semibold text-[11px] shadow-sm disabled:opacity-50"
                                >
                                  {saving === room.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  Save
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ICAL CHANNELS */}
          {activeTab === 'ical' && (
            <div className="space-y-5">
              {/* Instructions banner */}
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <p className="font-bold text-sm mb-0.5">Booking.com 2-Way Calendar Integration</p>
                  <p>
                    <strong>1. Import:</strong> Paste your Booking.com room iCal feed into the <em>Import Feed</em> box.
                    <br />
                    <strong>2. Export:</strong> Copy the <em>Export URL</em> on each row and paste it into Booking.com Extranet to prevent double bookings.
                  </p>
                </div>
              </div>

              {/* Rooms iCal Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs font-semibold text-slate-500">
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Sync Status</th>
                        <th className="px-4 py-3">Booking.com Import URL</th>
                        <th className="px-4 py-3">PMS Export Link (Copy to OTA)</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.map(room => (
                        <IcalRow
                          key={room.id}
                          room={room}
                          exportUrl={getIcalExportUrl(room.id)}
                          saving={saving === room.id}
                          onSave={url => handleSaveIcalUrl(room.id, url)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sync Logs Audit Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800">Recent iCal Synchronization Logs</h3>
                  <button onClick={fetchLogs} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh Logs
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-100 text-left text-[11px] text-slate-400">
                      <tr className="px-4 py-2">
                        <th className="px-4 py-2">Timestamp</th>
                        <th className="px-4 py-2">Room</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Added</th>
                        <th className="px-4 py-2">Updated</th>
                        <th className="px-4 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {syncLogs.slice(0, 10).map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-500">{formatDateTime(log.created_at)}</td>
                          <td className="px-4 py-2 font-bold text-slate-700">Room {(log.room as any)?.room_number ?? '—'}</td>
                          <td className="px-4 py-2">
                            <span
                              className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                                log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              )}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-green-600 font-semibold">{log.bookings_added ?? 0}</td>
                          <td className="px-4 py-2 text-blue-600 font-semibold">{log.bookings_updated ?? 0}</td>
                          <td className="px-4 py-2 text-slate-400 text-[11px] truncate max-w-xs">{log.error_message || 'OK'}</td>
                        </tr>
                      ))}
                      {syncLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No sync logs yet. Click "Sync All Feeds Now" above to initiate a cycle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HOTEL PROFILE & POLICIES */}
          {activeTab === 'hotel' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 max-w-3xl shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-800">Hotel Profile & Operating Rules</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  These details appear on guest registration cards, invoices, receipts, and booking summaries.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" /> Property Name
                  </label>
                  <input
                    type="text"
                    value={hotelConfig.name}
                    onChange={e => setHotelConfig(c => ({ ...c, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Reception Telephone
                  </label>
                  <input
                    type="text"
                    value={hotelConfig.phone}
                    onChange={e => setHotelConfig(c => ({ ...c, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Hotel Inquiries Email
                  </label>
                  <input
                    type="email"
                    value={hotelConfig.email}
                    onChange={e => setHotelConfig(c => ({ ...c, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Address
                  </label>
                  <input
                    type="text"
                    value={hotelConfig.address}
                    onChange={e => setHotelConfig(c => ({ ...c, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Standard Check-in Time
                  </label>
                  <input
                    type="time"
                    value={hotelConfig.checkInTime}
                    onChange={e => setHotelConfig(c => ({ ...c, checkInTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Standard Check-out Time
                  </label>
                  <input
                    type="time"
                    value={hotelConfig.checkOutTime}
                    onChange={e => setHotelConfig(c => ({ ...c, checkOutTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-slate-400" /> Guest Wi-Fi SSID
                  </label>
                  <input
                    type="text"
                    value={hotelConfig.wifiNetwork}
                    onChange={e => setHotelConfig(c => ({ ...c, wifiNetwork: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-slate-400" /> Guest Wi-Fi Password
                  </label>
                  <input
                    type="text"
                    value={hotelConfig.wifiPassword}
                    onChange={e => setHotelConfig(c => ({ ...c, wifiPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl">
                  <label className="block font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                    📲 Housekeeping Team WhatsApp Number / Group
                  </label>
                  <input
                    type="tel"
                    value={hotelConfig.cleanerPhone}
                    onChange={e => {
                      const val = e.target.value
                      setHotelConfig(c => ({ ...c, cleanerPhone: val }))
                      localStorage.setItem('patten_cleaner_phone', val)
                    }}
                    placeholder="+44 7700 900123"
                    className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-xs font-mono"
                  />
                  <p className="text-[11px] text-emerald-700 mt-1">
                    When guests check out or rooms are marked dirty, 1-click WhatsApp alerts will automatically target this number.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation & House Rules</label>
                <textarea
                  rows={3}
                  value={hotelConfig.cancellationPolicy}
                  onChange={e => setHotelConfig(c => ({ ...c, cancellationPolicy: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleSaveHotelConfig}
                disabled={savingHotelConfig}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingHotelConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          )}
        </>
      )}

      {/* Add New Room Modal */}
      {showNewRoomModal && (
        <NewRoomModal
          onClose={() => setShowNewRoomModal(false)}
          onCreated={() => {
            fetchRooms()
            setShowNewRoomModal(false)
          }}
        />
      )}
    </div>
  )
}

function IcalRow({
  room,
  exportUrl,
  saving,
  onSave,
}: {
  room: Room
  exportUrl: string
  saving: boolean
  onSave: (url: string) => void
}) {
  const [url, setUrl] = useState(room.ical_import_url ?? '')
  const isLinked = !!room.ical_import_url

  return (
    <tr className="text-xs hover:bg-slate-50/80 transition">
      <td className="px-4 py-3 font-bold text-slate-800">Room {room.room_number}</td>
      <td className="px-4 py-3">
        {isLinked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" /> Missing Feed
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?..."
          className="w-full max-w-sm px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">{exportUrl}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(exportUrl)
              toast.success(`Export URL for Room ${room.room_number} copied!`)
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Copy Export Link"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onSave(url)}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </td>
    </tr>
  )
}
