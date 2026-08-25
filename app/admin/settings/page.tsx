'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room } from '@/lib/types'
import { formatCurrency, getRoomTypeLabel, cn } from '@/lib/utils'
import { Save, Plus, Trash2, Loader2, RefreshCw, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'rooms' | 'ical'>('rooms')
  const [editedRooms, setEditedRooms] = useState<Record<string, Partial<Room>>>({})

  useEffect(() => { fetchRooms() }, [])

  const fetchRooms = async () => {
    setLoading(true)
    const { data } = await supabase.from('rooms').select('*').order('room_number')
    setRooms(data ?? [])
    setLoading(false)
  }

  const handleEdit = (roomId: string, field: string, value: any) => {
    setEditedRooms(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], [field]: value }
    }))
  }

  const handleSaveRoom = async (room: Room) => {
    const changes = editedRooms[room.id]
    if (!changes) return
    setSaving(room.id)
    const { error } = await supabase.from('rooms').update(changes).eq('id', room.id)
    if (error) { toast.error(error.message) } else {
      toast.success(`Room ${room.room_number} updated`)
      setEditedRooms(prev => { const next = { ...prev }; delete next[room.id]; return next })
      fetchRooms()
    }
    setSaving(null)
  }

  const handleToggleActive = async (room: Room) => {
    const { error } = await supabase.from('rooms').update({ is_active: !room.is_active }).eq('id', room.id)
    if (error) { toast.error('Failed to update') } else { fetchRooms() }
  }

  const handleSaveIcalUrl = async (roomId: string, url: string) => {
    setSaving(roomId)
    const { error } = await supabase.from('rooms').update({ ical_import_url: url || null }).eq('id', roomId)
    if (error) { toast.error(error.message) } else { toast.success('iCal URL saved'); fetchRooms() }
    setSaving(null)
  }

  const getIcalExportUrl = (roomId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    return `${baseUrl}/api/ical/export/${roomId}`
  }

  const getRoomEdited = (roomId: string) => !!editedRooms[roomId]

  const grouped: Record<string, Room[]> = {}
  rooms.forEach(r => {
    if (!grouped[r.room_type]) grouped[r.room_type] = []
    grouped[r.room_type].push(r)
  })

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {(['rooms', 'ical'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium rounded-lg transition', activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
            {tab === 'ical' ? 'Booking.com iCal Sync' : 'Room Management'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              {Object.entries(grouped).map(([type, typeRooms]) => (
                <div key={type} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">{getRoomTypeLabel(type as any)} Rooms</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{typeRooms.length} rooms · Edit room number, floor, base price, and status</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                          <th className="px-4 py-3 font-medium">Room Number</th>
                          <th className="px-4 py-3 font-medium">Floor</th>
                          <th className="px-4 py-3 font-medium">Base Price / Night (£)</th>
                          <th className="px-4 py-3 font-medium">Max Adults</th>
                          <th className="px-4 py-3 font-medium">Max Children</th>
                          <th className="px-4 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium">Active</th>
                          <th className="px-4 py-3 font-medium">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {typeRooms.map(room => {
                          const edited = editedRooms[room.id] ?? {}
                          const isEdited = getRoomEdited(room.id)
                          return (
                            <tr key={room.id} className={cn('text-sm', isEdited ? 'bg-blue-50/30' : 'hover:bg-slate-50')}>
                              <td className="px-4 py-2">
                                <input defaultValue={room.room_number}
                                  onChange={e => handleEdit(room.id, 'room_number', e.target.value)}
                                  className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" defaultValue={room.floor}
                                  onChange={e => handleEdit(room.id, 'floor', parseInt(e.target.value))}
                                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" step="0.01" defaultValue={room.base_price}
                                  onChange={e => handleEdit(room.id, 'base_price', parseFloat(e.target.value))}
                                  className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" defaultValue={room.max_adults}
                                  onChange={e => handleEdit(room.id, 'max_adults', parseInt(e.target.value))}
                                  className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" defaultValue={room.max_children}
                                  onChange={e => handleEdit(room.id, 'max_children', parseInt(e.target.value))}
                                  className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <input defaultValue={room.description ?? ''}
                                  onChange={e => handleEdit(room.id, 'description', e.target.value)}
                                  className="w-40 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="Optional..." />
                              </td>
                              <td className="px-4 py-2">
                                <button onClick={() => handleToggleActive(room)}
                                  className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', room.is_active ? 'bg-green-500' : 'bg-slate-300')}>
                                  <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow', room.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                                </button>
                              </td>
                              <td className="px-4 py-2">
                                {isEdited && (
                                  <button onClick={() => handleSaveRoom(room)} disabled={saving === room.id}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition disabled:opacity-50">
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
              ))}
            </div>
          )}

          {activeTab === 'ical' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-1">📅 2-Way Booking.com iCal Setup</h3>
                <p className="text-sm text-blue-700">
                  For each room: <strong>1)</strong> Paste the Booking.com iCal import URL below → <strong>2)</strong> Copy your export URL and paste it into Booking.com Extranet as an iCal export link.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs text-slate-400">
                        <th className="px-4 py-3 font-medium">Room</th>
                        <th className="px-4 py-3 font-medium">Booking.com iCal Import URL (paste here)</th>
                        <th className="px-4 py-3 font-medium">Your Export URL (copy to Booking.com)</th>
                        <th className="px-4 py-3 font-medium">Save</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.map(room => (
                        <IcalRow
                          key={room.id}
                          room={room}
                          exportUrl={getIcalExportUrl(room.id)}
                          saving={saving === room.id}
                          onSave={(url) => handleSaveIcalUrl(room.id, url)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function IcalRow({ room, exportUrl, saving, onSave }: { room: Room; exportUrl: string; saving: boolean; onSave: (url: string) => void }) {
  const [url, setUrl] = useState(room.ical_import_url ?? '')
  return (
    <tr className="text-sm hover:bg-slate-50">
      <td className="px-4 py-3 font-semibold text-slate-700">{room.room_number}</td>
      <td className="px-4 py-3">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?..."
          className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]">{exportUrl}</span>
          <button onClick={() => { navigator.clipboard.writeText(exportUrl); }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <button onClick={() => onSave(url)} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </td>
    </tr>
  )
}
