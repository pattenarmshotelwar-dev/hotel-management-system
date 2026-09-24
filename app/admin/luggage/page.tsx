'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LuggageItem, Room } from '@/lib/types'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import {
  Briefcase,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Phone,
  DoorOpen,
  MapPin,
  Tag,
  AlertCircle,
  Archive,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

const DEFAULT_LUGGAGE: LuggageItem[] = []

export default function LuggageTrackerPage() {
  const supabase = createClient()
  const [items, setItems] = useState<LuggageItem[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'stored' | 'collected'>('stored')

  // Modals
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [receiptItem, setReceiptItem] = useState<LuggageItem | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // New Check-in Form
  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    room_number: '',
    bag_count: 1,
    bag_description: '',
    storage_location: 'Behind Reception',
    expected_collection_time: '',
    notes: '',
  })

  useEffect(() => {
    fetchRooms()
    loadLuggage()
  }, [])

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('room_number')
    setRooms(data ?? [])
  }

  const loadLuggage = () => {
    const saved = localStorage.getItem('patten_luggage_records')
    let currentItems: LuggageItem[] = []
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        currentItems = Array.isArray(parsed) ? parsed : []
      } catch (e) {
        currentItems = []
      }
    }

    // Automatically purge legacy sample items
    const hasPurged = localStorage.getItem('patten_lug_sample_purged_v2')
    if (!hasPurged) {
      currentItems = currentItems.filter(it => it.id !== 'lug_1' && it.id !== 'lug_2')
      localStorage.setItem('patten_luggage_records', JSON.stringify(currentItems))
      localStorage.setItem('patten_lug_sample_purged_v2', 'true')
    }

    setItems(currentItems)
  }

  const saveItems = (newItems: LuggageItem[]) => {
    setItems(newItems)
    localStorage.setItem('patten_luggage_records', JSON.stringify(newItems))
  }

  const handleCheckInBags = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.guest_name.trim()) {
      toast.error('Please enter the guest name')
      return
    }

    const nextTagNumber = `LUG-${String(items.length + 1).padStart(2, '0')}`
    const newItem: LuggageItem = {
      id: `lug_${Date.now()}`,
      tag_number: nextTagNumber,
      guest_name: form.guest_name.trim(),
      guest_phone: form.guest_phone || undefined,
      room_number: form.room_number || 'Pre-check-in',
      bag_count: form.bag_count || 1,
      bag_description: form.bag_description || `${form.bag_count} item(s)`,
      storage_location: form.storage_location,
      check_in_time: new Date().toISOString(),
      expected_collection_time: form.expected_collection_time || undefined,
      status: 'stored',
      notes: form.notes || undefined,
    }

    const updated = [newItem, ...items]
    saveItems(updated)
    toast.success(`Luggage Tag ${nextTagNumber} checked in!`)
    setShowCheckInModal(false)
    setReceiptItem(newItem) // Automatically open printable claim slip

    // Reset
    setForm({
      guest_name: '',
      guest_phone: '',
      room_number: '',
      bag_count: 1,
      bag_description: '',
      storage_location: 'Behind Reception',
      expected_collection_time: '',
      notes: '',
    })
  }

  const handleCollectBag = (item: LuggageItem) => {
    const updated = items.map(it =>
      it.id === item.id
        ? {
            ...it,
            status: 'collected' as const,
            collected_at: new Date().toISOString(),
          }
        : it
    )
    saveItems(updated)
    toast.success(`Luggage Tag ${item.tag_number} marked as collected by ${item.guest_name}`)
  }

  const handlePrint = () => {
    window.print()
  }

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        it.tag_number.toLowerCase().includes(q) ||
        it.guest_name.toLowerCase().includes(q) ||
        (it.room_number && it.room_number.toLowerCase().includes(q)) ||
        (it.bag_description && it.bag_description.toLowerCase().includes(q)) ||
        (it.guest_phone && it.guest_phone.includes(q))

      if (!matchesSearch) return false
      if (filterStatus === 'stored') return it.status === 'stored'
      if (filterStatus === 'collected') return it.status === 'collected'
      return true
    })
  }, [items, search, filterStatus])

  const storedCount = items.filter(i => i.status === 'stored').length
  const totalBagsStored = items
    .filter(i => i.status === 'stored')
    .reduce((sum, i) => sum + i.bag_count, 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Luggage Storage & Cloakroom Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Issue tag references, track storage locations, record bag counts, and generate customer claim receipts
          </p>
        </div>

        <button
          onClick={() => setShowCheckInModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Check In New Luggage
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Luggage Tags</p>
          <p className="text-xl font-extrabold text-blue-600 mt-0.5">{storedCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Bags in Custody</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{totalBagsStored}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Collected / Released</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
            {items.filter(i => i.status === 'collected').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lifetime Logged</p>
          <p className="text-xl font-extrabold text-slate-700 mt-0.5">{items.length}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by tag # (e.g. LUG-01), guest name, room number..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { id: 'stored', label: `Currently Stored (${storedCount})` },
            { id: 'collected', label: 'Collected / Returned' },
            { id: 'all', label: `All Records (${items.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Luggage Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-sm">No luggage records matching filter</p>
            <p className="text-xs text-slate-400 mt-1">Check in incoming bags or view all past records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tag Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Guest & Room</th>
                  <th className="px-4 py-3 text-center font-semibold">Bags</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">Storage Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Check-In / Expected</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr
                    key={item.id}
                    className={cn(
                      'hover:bg-slate-50/80 transition',
                      item.status === 'collected' && 'opacity-60 bg-slate-50/30'
                    )}
                  >
                    {/* Tag Number */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg">
                        <Tag className="w-3 h-3 text-blue-600" />
                        {item.tag_number}
                      </span>
                    </td>

                    {/* Guest & Room */}
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{item.guest_name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                          <DoorOpen className="w-3 h-3 text-slate-400" />
                          Room {item.room_number || 'N/A'}
                        </span>
                        {item.guest_phone && (
                          <span className="font-mono">{item.guest_phone}</span>
                        )}
                      </div>
                    </td>

                    {/* Bag Count */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-extrabold text-xs px-2 py-0.5 bg-slate-100 rounded-full text-slate-800">
                        {item.bag_count} {item.bag_count === 1 ? 'bag' : 'bags'}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3.5 text-slate-700 max-w-[200px]">
                      <p className="truncate font-medium">{item.bag_description}</p>
                      {item.notes && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Note: {item.notes}</p>
                      )}
                    </td>

                    {/* Storage Location */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {item.storage_location}
                      </span>
                    </td>

                    {/* Time Logged */}
                    <td className="px-4 py-3.5 text-[11px] space-y-0.5">
                      <p className="text-slate-600">In: {formatDateTime(item.check_in_time)}</p>
                      {item.expected_collection_time && (
                        <p className="text-blue-600 font-semibold">
                          Pickup around: {item.expected_collection_time}
                        </p>
                      )}
                      {item.collected_at && (
                        <p className="text-slate-400 italic">
                          Claimed: {formatDateTime(item.collected_at)}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center">
                      {item.status === 'stored' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" /> In Storage
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Collected
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Printable Claim Slip */}
                        <button
                          onClick={() => setReceiptItem(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Print Claim Tag / Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Mark as Collected */}
                        {item.status === 'stored' && (
                          <button
                            onClick={() => handleCollectBag(item)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                            title="Release Bags to Guest"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CHECK IN NEW LUGGAGE */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-4">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Check In Guest Luggage</h3>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckInBags} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.guest_name}
                    onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Guest Phone Number</label>
                  <input
                    type="tel"
                    value={form.guest_phone}
                    onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                    placeholder="+44 7700 900123"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Room Number</label>
                  <select
                    value={form.room_number}
                    onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Pre-Check-in (No room yet)</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.room_number}>
                        Room {r.room_number} ({r.room_type.replace('_', ' ')})
                      </option>
                    ))}
                    <option value="Post-Checkout">Post-Checkout / Visitor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Total Bags Count *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={form.bag_count}
                    onChange={e => setForm(f => ({ ...f, bag_count: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Bag Description & Color</label>
                <input
                  type="text"
                  required
                  value={form.bag_description}
                  onChange={e => setForm(f => ({ ...f, bag_description: e.target.value }))}
                  placeholder="e.g. 2x Black hardcase suitcases + 1 red backpack"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Storage Location</label>
                  <select
                    value={form.storage_location}
                    onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option>Behind Reception</option>
                    <option>Luggage Cupboard A</option>
                    <option>Luggage Cupboard B (Upstairs)</option>
                    <option>Manager Safe Deposit</option>
                    <option>Function Room Store</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Expected Collection Time</label>
                  <input
                    type="time"
                    value={form.expected_collection_time}
                    onChange={e => setForm(f => ({ ...f, expected_collection_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Additional Staff Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Fragile items inside, train departs 18:20"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  Generate Tag & Print Claim Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE LUGGAGE CLAIM SLIP */}
      {receiptItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
              <h3 className="text-sm font-bold text-slate-800">Luggage Claim Slip</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Claim Slip
                </button>
                <button
                  onClick={() => setReceiptItem(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Slip Body */}
            <div ref={printRef} className="p-8 space-y-5 text-slate-900 font-sans text-xs bg-white">
              <div className="text-center border-b border-slate-300 pb-4 space-y-1">
                <div className="w-36 mx-auto mb-2">
                  <Image
                    src="/invoice-logo.png"
                    alt="The Patten Arms Hotel"
                    width={200}
                    height={100}
                    unoptimized
                    className="h-16 w-auto object-contain mx-auto"
                  />
                </div>
                <h2 className="text-base font-extrabold tracking-wide uppercase">LUGGAGE CLAIM CHECK</h2>
                <p className="text-[11px] text-slate-500">The Patten Arms Hotel — Warrington Bank Quay</p>
                <p className="text-[11px] text-slate-500">Tel: 01925 636602</p>
              </div>

              {/* Huge Tag Badge */}
              <div className="bg-slate-100 border-2 border-dashed border-slate-300 p-4 rounded-xl text-center space-y-1">
                <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">CLAIM TAG NUMBER</p>
                <p className="text-3xl font-mono font-extrabold text-blue-700 tracking-wider">
                  {receiptItem.tag_number}
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {receiptItem.bag_count} Item{receiptItem.bag_count > 1 ? 's' : ''} Checked In
                </p>
              </div>

              {/* Information Table */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Guest Name:</span>
                  <strong className="text-slate-900">{receiptItem.guest_name}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Room Number:</span>
                  <strong>{receiptItem.room_number ? `Room ${receiptItem.room_number}` : 'Pre-Check-in'}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Storage Location:</span>
                  <span className="font-semibold text-slate-800">{receiptItem.storage_location}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Check-in Time:</span>
                  <span>{formatDateTime(receiptItem.check_in_time)}</span>
                </div>
                {receiptItem.expected_collection_time && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500">Expected Pickup:</span>
                    <strong className="text-blue-700">{receiptItem.expected_collection_time}</strong>
                  </div>
                )}
                <div className="pt-1 text-[11px]">
                  <span className="text-slate-500 block mb-0.5">Item Description:</span>
                  <p className="text-slate-800 font-medium italic">{receiptItem.bag_description}</p>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="text-[10px] text-slate-500 space-y-1 border-t border-slate-200 pt-3">
                <p className="font-bold text-slate-700 uppercase">Customer Notice:</p>
                <p>• Please present this slip to reception staff when reclaiming your luggage.</p>
                <p>• Luggage is stored on behalf of guests in good faith. Please do not store high-value jewelry or cash.</p>
                <p>• Items must be collected within 24 hours unless agreed in advance with hotel management.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
