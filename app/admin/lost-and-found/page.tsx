'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LostFoundItem, Room } from '@/lib/types'
import { formatDate, formatDateTime, sendGuestWhatsAppMessage, cn } from '@/lib/utils'
import {
  Archive,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Phone,
  MessageSquare,
  Sparkles,
  MapPin,
  Tag,
  ShieldCheck,
  Printer,
  X,
  Loader2,
  AlertCircle,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'

// Default starter items for The Patten Arms Hotel
const INITIAL_LOST_ITEMS: LostFoundItem[] = [
  {
    id: 'lf_01',
    item_reference: 'LF-101',
    title: 'Apple iPhone 13 in navy blue silicone case',
    category: 'electronics',
    room_number: '14',
    found_location: 'Bedside table drawer',
    found_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    found_by: 'Housekeeper Sarah',
    status: 'unclaimed',
    guest_name: 'David Wilson',
    guest_phone: '+44 7700 900456',
    guest_notified: true,
    storage_bin: 'Safe Box A (Reception)',
    notes: 'Phone has 15% battery, kept on charge in manager office.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'lf_02',
    item_reference: 'LF-102',
    title: 'Black leather Barbour jacket (Size L)',
    category: 'clothing',
    room_number: '08',
    found_location: 'Wardrobe hanger',
    found_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    found_by: 'Housekeeper Maria',
    status: 'unclaimed',
    guest_name: 'James Harrison',
    guest_phone: '+44 7700 900889',
    guest_notified: false,
    storage_bin: 'Lost Property Rail B',
    notes: 'No wallet in pockets. High value item.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'lf_03',
    item_reference: 'LF-103',
    title: 'Set of car & house keys on Manchester United lanyard',
    category: 'keys',
    room_number: '21',
    found_location: 'Under desk chair',
    found_date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    found_by: 'Duty Manager Tom',
    status: 'claimed',
    guest_name: 'Mark Taylor',
    guest_phone: '+44 7700 900112',
    guest_notified: true,
    claimed_at: new Date(Date.now() - 36000000).toISOString(),
    storage_bin: 'Key Cupboard',
    notes: 'Guest collected in person. Identity verified via photo ID.',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
]

export default function LostAndFoundPage() {
  const supabase = createClient()
  const [items, setItems] = useState<LostFoundItem[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unclaimed' | 'claimed' | 'disposed'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<LostFoundItem | null>(null)
  const [claimingItem, setClaimingItem] = useState<LostFoundItem | null>(null)
  const [claimNotes, setClaimNotes] = useState('')
  const [printTagItem, setPrintTagItem] = useState<LostFoundItem | null>(null)

  // Form State
  const [form, setForm] = useState({
    title: '',
    category: 'electronics' as LostFoundItem['category'],
    room_number: '',
    found_location: '',
    found_date: new Date().toISOString().split('T')[0],
    found_by: '',
    guest_name: '',
    guest_phone: '',
    storage_bin: 'Lost Property Cupboard',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: roomsData } = await supabase.from('rooms').select('*').order('room_number')
    setRooms(roomsData ?? [])

    const saved = localStorage.getItem('patten_lost_and_found_items')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setItems(Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_LOST_ITEMS)
      } catch (e) {
        setItems(INITIAL_LOST_ITEMS)
      }
    } else {
      setItems(INITIAL_LOST_ITEMS)
      localStorage.setItem('patten_lost_and_found_items', JSON.stringify(INITIAL_LOST_ITEMS))
    }
    setLoading(false)
  }

  const saveItemsToStorage = (updated: LostFoundItem[]) => {
    setItems(updated)
    localStorage.setItem('patten_lost_and_found_items', JSON.stringify(updated))
  }

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Item description is required')
      return
    }

    if (editingItem) {
      const updated = items.map(it =>
        it.id === editingItem.id
          ? {
              ...it,
              ...form,
            }
          : it
      )
      saveItemsToStorage(updated)
      toast.success(`Updated ${editingItem.item_reference}`)
      setEditingItem(null)
    } else {
      const nextRef = `LF-${100 + items.length + 1}`
      const newItem: LostFoundItem = {
        id: `lf_${Date.now()}`,
        item_reference: nextRef,
        ...form,
        status: 'unclaimed',
        guest_notified: false,
        created_at: new Date().toISOString(),
      }
      saveItemsToStorage([newItem, ...items])
      toast.success(`Logged ${newItem.item_reference} successfully!`)
    }

    setShowAddModal(false)
    resetForm()
  }

  const resetForm = () => {
    setForm({
      title: '',
      category: 'electronics',
      room_number: '',
      found_location: '',
      found_date: new Date().toISOString().split('T')[0],
      found_by: '',
      guest_name: '',
      guest_phone: '',
      storage_bin: 'Lost Property Cupboard',
      notes: '',
    })
  }

  const handleStartEdit = (item: LostFoundItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      category: item.category,
      room_number: item.room_number || '',
      found_location: item.found_location,
      found_date: item.found_date,
      found_by: item.found_by,
      guest_name: item.guest_name || '',
      guest_phone: item.guest_phone || '',
      storage_bin: item.storage_bin,
      notes: item.notes || '',
    })
    setShowAddModal(true)
  }

  const handleConfirmClaim = () => {
    if (!claimingItem) return
    const updated = items.map(it =>
      it.id === claimingItem.id
        ? {
            ...it,
            status: 'claimed' as const,
            claimed_at: new Date().toISOString(),
            notes: claimNotes ? `${it.notes ? it.notes + ' | ' : ''}Claim details: ${claimNotes}` : it.notes,
          }
        : it
    )
    saveItemsToStorage(updated)
    toast.success(`${claimingItem.item_reference} marked as Returned to Guest!`)
    setClaimingItem(null)
    setClaimNotes('')
  }

  const handleDeleteItem = (id: string) => {
    if (confirm('Delete this lost property log?')) {
      const updated = items.filter(it => it.id !== id)
      saveItemsToStorage(updated)
      toast.success('Log entry removed')
    }
  }

  const handleNotifyGuestWhatsApp = (item: LostFoundItem) => {
    if (!item.guest_phone) {
      toast.error('No phone number recorded for this guest')
      return
    }
    const text =
      `🏨 *The Patten Arms Hotel — Lost Property Notice*\n\n` +
      `Dear ${item.guest_name || 'Guest'},\n\n` +
      `Our housekeeping team found an item belonging to you after your stay:\n\n` +
      `📦 *Item:* ${item.title} (Ref: ${item.item_reference})\n` +
      (item.room_number ? `📍 *Location Found:* Room ${item.room_number}\n` : '') +
      `🔒 It has been securely logged and stored in our hotel reception safe.\n\n` +
      `Please let us know if you would like us to keep it for your collection, or arrange courier dispatch to your home address.\n\n` +
      `Warm regards,\n*Patten Arms Hotel Front Desk*`

    sendGuestWhatsAppMessage({
      phone: item.guest_phone,
      text,
    })

    // Mark guest notified
    const updated = items.map(it => (it.id === item.id ? { ...it, guest_notified: true } : it))
    saveItemsToStorage(updated)
    toast.success('Opening WhatsApp to notify guest!')
  }

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        it.title.toLowerCase().includes(q) ||
        it.item_reference.toLowerCase().includes(q) ||
        (it.room_number && it.room_number.includes(q)) ||
        (it.guest_name && it.guest_name.toLowerCase().includes(q)) ||
        it.found_location.toLowerCase().includes(q)

      if (!matchSearch) return false
      if (statusFilter !== 'all' && it.status !== statusFilter) return false
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false

      return true
    })
  }, [items, search, statusFilter, categoryFilter])

  // KPIs
  const kpis = useMemo(() => {
    const total = items.length
    const unclaimed = items.filter(it => it.status === 'unclaimed').length
    const claimed = items.filter(it => it.status === 'claimed').length
    const highPriority = items.filter(
      it => it.status === 'unclaimed' && ['electronics', 'keys', 'jewellery', 'documents'].includes(it.category)
    ).length
    return { total, unclaimed, claimed, highPriority }
  }, [items])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-6 h-6 text-blue-600" />
            Lost & Found Property Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log, track, and return items left behind in guest rooms with automated WhatsApp alerts and printable reference tags.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm()
            setEditingItem(null)
            setShowAddModal(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Log Found Item
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Currently Unclaimed</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{kpis.unclaimed}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Awaiting guest contact</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Valuable Items</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{kpis.highPriority}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Electronics, keys, documents</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Safely Returned</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{kpis.claimed}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Claimed by verified owners</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Total Registered</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{kpis.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Historical log entries</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description, ref (LF-101), room number, guest name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {(['all', 'unclaimed', 'claimed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer',
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="electronics">📱 Electronics</option>
            <option value="clothing">🧥 Clothing</option>
            <option value="keys">🔑 Keys & Fobs</option>
            <option value="jewellery">💍 Jewellery & Watches</option>
            <option value="documents">📄 Passports & Wallets</option>
            <option value="toiletries">🧴 Toiletries & Bags</option>
            <option value="other">📦 Other</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Item Ref</th>
                <th className="px-4 py-3">Description & Category</th>
                <th className="px-4 py-3">Location Found</th>
                <th className="px-4 py-3">Suspected Guest</th>
                <th className="px-4 py-3">Secure Storage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No lost property items matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    {/* Item Ref */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
                        {item.item_reference}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(item.found_date)}</p>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3.5 max-w-[240px]">
                      <p className="font-bold text-slate-900 leading-snug">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                        {item.found_by && (
                          <span className="text-[11px] text-slate-400">• Found by: {item.found_by}</span>
                        )}
                      </div>
                    </td>

                    {/* Location Found */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {item.room_number ? `Room ${item.room_number}` : 'Public Area'}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.found_location}</p>
                    </td>

                    {/* Suspected Guest */}
                    <td className="px-4 py-3.5">
                      {item.guest_name ? (
                        <div>
                          <p className="font-semibold text-slate-900">{item.guest_name}</p>
                          {item.guest_phone && (
                            <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400" /> {item.guest_phone}
                            </p>
                          )}
                          {item.guest_notified && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-1">
                              ✓ WhatsApp Sent
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    {/* Secure Storage */}
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-lg text-[11px] inline-block">
                        {item.storage_bin}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {item.status === 'unclaimed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" /> Unclaimed
                        </span>
                      ) : item.status === 'claimed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Returned to Owner
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] capitalize">{item.status}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Notify Guest via WhatsApp */}
                        {item.guest_phone && item.status === 'unclaimed' && (
                          <button
                            onClick={() => handleNotifyGuestWhatsApp(item)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Send WhatsApp Notice to Guest"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}

                        {/* Print Property Tag */}
                        <button
                          onClick={() => setPrintTagItem(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Print Lost Property Tag"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Return to Owner */}
                        {item.status === 'unclaimed' && (
                          <button
                            onClick={() => setClaimingItem(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Mark Returned to Guest"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {editingItem ? `Edit ${editingItem.item_reference}` : 'Register Lost Property Item'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingItem(null)
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Black leather Barbour jacket, gold necklace, iPad mini..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="electronics">📱 Electronics</option>
                    <option value="clothing">🧥 Clothing</option>
                    <option value="keys">🔑 Keys & Fobs</option>
                    <option value="jewellery">💍 Jewellery & Watches</option>
                    <option value="documents">📄 Passports & Wallets</option>
                    <option value="toiletries">🧴 Toiletries & Bags</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Number (if in room)</label>
                  <select
                    value={form.room_number}
                    onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Room / Public Space</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.room_number}>
                        Room {r.room_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Exact Location Found</label>
                  <input
                    type="text"
                    placeholder="e.g. Under bed, wardrobe, reception lobby..."
                    value={form.found_location}
                    onChange={e => setForm(f => ({ ...f, found_location: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Found By (Staff Member)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah (Housekeeping), Tom (Front Desk)..."
                    value={form.found_by}
                    onChange={e => setForm(f => ({ ...f, found_by: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Suspected Guest Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Wilson"
                    value={form.guest_name}
                    onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guest Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+44 7700 900000"
                    value={form.guest_phone}
                    onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Storage Bin / Cupboard Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Safe Box 2, Lost Property Cupboard Top Shelf..."
                    value={form.storage_bin}
                    onChange={e => setForm(f => ({ ...f, storage_bin: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Notes</label>
                <textarea
                  rows={2}
                  placeholder="Condition, distinctive marks, serial numbers, password lock status..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingItem(null)
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm transition cursor-pointer"
                >
                  {editingItem ? 'Update Log' : 'Save & Print Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return to Owner Modal */}
      {claimingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Return Item to Owner</h3>
              </div>
              <button onClick={() => setClaimingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
              <p className="font-bold text-slate-800">{claimingItem.title}</p>
              <p className="text-slate-500 font-mono text-[11px]">{claimingItem.item_reference}</p>
              <p className="text-slate-500">Stored at: {claimingItem.storage_bin}</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Collection Verification & Notes:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Collected in person by guest David Wilson. Photo ID checked / Royal Mail Tracked ref: #123456"
                value={claimNotes}
                onChange={e => setClaimNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setClaimingItem(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClaim}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm transition cursor-pointer"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Tag Slip */}
      {printTagItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Hotel Property Tag
              </span>
              <button onClick={() => setPrintTagItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Slip Preview */}
            <div id="lost-property-slip" className="border-2 border-dashed border-slate-300 p-4 rounded-xl text-center space-y-2 bg-slate-50">
              <p className="font-bold text-sm text-slate-900 uppercase tracking-widest">
                The Patten Arms Hotel
              </p>
              <p className="text-[10px] text-slate-400">Parker Street, Warrington WA1 1HG</p>

              <div className="my-3 py-2 bg-white rounded-lg border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400">Tag Reference</p>
                <p className="text-2xl font-black font-mono text-blue-700">{printTagItem.item_reference}</p>
              </div>

              <div className="text-left text-xs space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700">
                <p><strong>Item:</strong> {printTagItem.title}</p>
                <p><strong>Found:</strong> {formatDate(printTagItem.found_date)} ({printTagItem.room_number ? `Room ${printTagItem.room_number}` : printTagItem.found_location})</p>
                <p><strong>Staff:</strong> {printTagItem.found_by || 'Housekeeping'}</p>
                <p><strong>Storage:</strong> {printTagItem.storage_bin}</p>
                {printTagItem.guest_name && <p><strong>Guest:</strong> {printTagItem.guest_name}</p>}
              </div>

              <p className="text-[9px] text-slate-400 pt-1">
                Attach this tag securely to property bag or hanger.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPrintTagItem(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print()
                  toast.success('Printing property tag...')
                }}
                className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
