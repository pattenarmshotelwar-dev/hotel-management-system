'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Guest, Booking } from '@/lib/types'
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Car,
  ShieldAlert,
  ShieldCheck,
  Star,
  Calendar,
  ExternalLink,
  Edit2,
  Trash2,
  History,
  X,
  Loader2,
  MessageSquare,
  AlertTriangle,
  Clock,
  BedDouble,
  CheckCircle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  RotateCcw,
  Filter,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

export default function GuestCRMPage() {
  const supabase = createClient()
  const [guests, setGuests] = useState<Guest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<'all' | 'vip' | 'repeat' | 'blacklisted' | 'single_stay'>('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [spendTierFilter, setSpendTierFilter] = useState<'all' | 'vip' | 'mid' | 'budget' | 'zero'>('all')
  const [stayCountFilter, setStayCountFilter] = useState<'all' | '1' | '2-4' | '5+'>('all')
  const [sortBy, setSortBy] = useState<'spend_desc' | 'stays_desc' | 'recent_desc' | 'name_asc' | 'created_desc'>('created_desc')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Modals
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState<Guest | null>(null)
  const [blacklistReason, setBlacklistReason] = useState('')

  // Guest Form
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    country: 'United Kingdom',
    address: '',
    id_passport_number: '',
    vehicle_reg: '',
    is_vip: false,
    is_blacklisted: false,
    blacklist_reason: '',
    notes: '',
  })

  useEffect(() => {
    fetchGuestsAndBookings()
  }, [])

  const fetchGuestsAndBookings = async () => {
    setLoading(true)
    try {
      const [{ data: guestsData }, { data: bookingsData }] = await Promise.all([
        supabase.from('guests').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*, room:rooms(room_number, room_type)').order('check_in_date', { ascending: false }),
      ])

      // Fallback & local overrides
      const localCRM = localStorage.getItem('patten_guest_crm_overrides')
      const localOverrides: Record<string, Partial<Guest>> = localCRM ? JSON.parse(localCRM) : {}

      let combinedGuests: Guest[] = (guestsData ?? []).map(g => ({
        ...g,
        ...(localOverrides[g.id] || {}),
      }))

      // If Supabase guests table is sparse, auto-seed with unique guests extracted from bookings
      if (bookingsData && bookingsData.length > 0) {
        const existingEmails = new Set(combinedGuests.map(g => (g.email || '').toLowerCase()).filter(Boolean))
        const existingPhones = new Set(combinedGuests.map(g => (g.phone || '').replace(/[^0-9]/g, '')).filter(Boolean))

        bookingsData.forEach(b => {
          const email = (b.guest_email || '').toLowerCase().trim()
          const phone = (b.guest_phone || '').replace(/[^0-9]/g, '')
          const isKnown = (email && existingEmails.has(email)) || (phone && existingPhones.has(phone))

          if (!isKnown && (b.guest_first_name || b.guest_last_name)) {
            const guestId = b.guest_id || `booking_guest_${b.id}`
            const override = localOverrides[guestId] || {}
            combinedGuests.push({
              id: guestId,
              first_name: b.guest_first_name,
              last_name: b.guest_last_name,
              email: b.guest_email || null,
              phone: b.guest_phone || null,
              country: b.guest_country || 'United Kingdom',
              address: null,
              id_passport_number: null,
              vehicle_reg: null,
              is_vip: false,
              is_blacklisted: false,
              blacklist_reason: null,
              notes: b.special_requests || null,
              created_at: b.created_at,
              updated_at: b.updated_at,
              ...override,
            })
            if (email) existingEmails.add(email)
            if (phone) existingPhones.add(phone)
          }
        })
      }

      setGuests(combinedGuests)
      setBookings((bookingsData as any) ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Calculate guest stay statistics
  const guestStats = useMemo(() => {
    const stats: Record<string, { totalStays: number; totalSpent: number; lastStayDate: string; lastRoom: string; stays: Booking[] }> = {}

    guests.forEach(g => {
      const gEmail = (g.email || '').toLowerCase().trim()
      const gPhone = (g.phone || '').replace(/[^0-9]/g, '')

      const matches = bookings.filter(b => {
        if (b.guest_id && b.guest_id === g.id) return true
        const bEmail = (b.guest_email || '').toLowerCase().trim()
        const bPhone = (b.guest_phone || '').replace(/[^0-9]/g, '')
        if (gEmail && bEmail && gEmail === bEmail) return true
        if (gPhone && bPhone && gPhone === bPhone) return true
        return false
      })

      const totalSpent = matches.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
      const lastStay = matches[0]

      stats[g.id] = {
        totalStays: matches.length,
        totalSpent,
        lastStayDate: lastStay?.check_in_date || '',
        lastRoom: (lastStay as any)?.room?.room_number || '',
        stays: matches,
      }
    })

    return stats
  }, [guests, bookings])

  // Unique countries
  const countries = useMemo(() => {
    const set = new Set(guests.map(g => g.country).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [guests])

  // Filtered list
  const filteredGuests = useMemo(() => {
    const result = guests.filter(g => {
      const q = search.toLowerCase().trim()
      const fullName = `${g.first_name} ${g.last_name}`.toLowerCase()
      const matchesQuery =
        !q ||
        fullName.includes(q) ||
        (g.email && g.email.toLowerCase().includes(q)) ||
        (g.phone && g.phone.includes(q)) ||
        (g.vehicle_reg && g.vehicle_reg.toLowerCase().includes(q)) ||
        (g.id_passport_number && g.id_passport_number.toLowerCase().includes(q)) ||
        (g.country && g.country.toLowerCase().includes(q)) ||
        (g.notes && g.notes.toLowerCase().includes(q))

      if (!matchesQuery) return false

      const stat = guestStats[g.id] || { totalStays: 0, totalSpent: 0 }
      if (filterTag === 'vip' && !g.is_vip) return false
      if (filterTag === 'repeat' && stat.totalStays <= 1) return false
      if (filterTag === 'blacklisted' && !g.is_blacklisted) return false
      if (filterTag === 'single_stay' && stat.totalStays !== 1) return false

      // Country filter
      if (countryFilter !== 'all' && g.country !== countryFilter) return false

      // Lifetime Spend Tier filter
      if (spendTierFilter === 'vip' && stat.totalSpent < 500) return false
      if (spendTierFilter === 'mid' && (stat.totalSpent < 150 || stat.totalSpent >= 500)) return false
      if (spendTierFilter === 'budget' && (stat.totalSpent <= 0 || stat.totalSpent >= 150)) return false
      if (spendTierFilter === 'zero' && stat.totalSpent > 0) return false

      // Stay Count filter
      if (stayCountFilter === '1' && stat.totalStays !== 1) return false
      if (stayCountFilter === '2-4' && (stat.totalStays < 2 || stat.totalStays > 4)) return false
      if (stayCountFilter === '5+' && stat.totalStays < 5) return false

      return true
    })

    return [...result].sort((a, b) => {
      const statA = guestStats[a.id] || { totalStays: 0, totalSpent: 0, lastStayDate: '' }
      const statB = guestStats[b.id] || { totalStays: 0, totalSpent: 0, lastStayDate: '' }

      if (sortBy === 'spend_desc') return statB.totalSpent - statA.totalSpent
      if (sortBy === 'stays_desc') return statB.totalStays - statA.totalStays
      if (sortBy === 'recent_desc') return (statB.lastStayDate || '').localeCompare(statA.lastStayDate || '')
      if (sortBy === 'name_asc') {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
        return nameA.localeCompare(nameB)
      }
      if (sortBy === 'created_desc') return (b.created_at || '').localeCompare(a.created_at || '')
      return 0
    })
  }, [guests, search, filterTag, countryFilter, spendTierFilter, stayCountFilter, sortBy, guestStats])

  const saveLocalOverride = (guestId: string, updates: Partial<Guest>) => {
    const localCRM = localStorage.getItem('patten_guest_crm_overrides')
    const current: Record<string, Partial<Guest>> = localCRM ? JSON.parse(localCRM) : {}
    current[guestId] = { ...(current[guestId] || {}), ...updates }
    localStorage.setItem('patten_guest_crm_overrides', JSON.stringify(current))

    setGuests(prev =>
      prev.map(g => (g.id === guestId ? { ...g, ...updates } : g))
    )
  }

  const handleToggleVIP = (guest: Guest) => {
    const newVal = !guest.is_vip
    saveLocalOverride(guest.id, { is_vip: newVal })
    toast.success(`${guest.first_name} ${guest.last_name} ${newVal ? 'marked as VIP ⭐' : 'removed from VIP'}`)
  }

  const handleApplyBlacklist = () => {
    if (!showBlacklistConfirm) return
    saveLocalOverride(showBlacklistConfirm.id, {
      is_blacklisted: true,
      blacklist_reason: blacklistReason || 'Flagged by hotel management',
    })
    toast.error(`${showBlacklistConfirm.first_name} ${showBlacklistConfirm.last_name} added to Caution / Blacklist`)
    setShowBlacklistConfirm(null)
    setBlacklistReason('')
  }

  const handleRemoveBlacklist = (guest: Guest) => {
    saveLocalOverride(guest.id, {
      is_blacklisted: false,
      blacklist_reason: null,
    })
    toast.success(`Removed ${guest.first_name} ${guest.last_name} from blacklist`)
  }

  const handleSaveGuestForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name || !formData.last_name) {
      toast.error('First and Last name are required')
      return
    }

    if (editingGuest) {
      saveLocalOverride(editingGuest.id, formData)
      toast.success('Guest profile updated!')
      setEditingGuest(null)
    } else {
      const newId = `crm_${Date.now()}`
      const newGuest: Guest = {
        id: newId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        country: formData.country,
        address: formData.address || null,
        id_passport_number: formData.id_passport_number || null,
        vehicle_reg: formData.vehicle_reg || null,
        is_vip: formData.is_vip,
        is_blacklisted: formData.is_blacklisted,
        blacklist_reason: formData.blacklist_reason || null,
        notes: formData.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      saveLocalOverride(newId, newGuest)
      setGuests(prev => [newGuest, ...prev])
      toast.success('New guest registered!')
      setShowAddModal(false)
    }

    // Reset
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      country: 'United Kingdom',
      address: '',
      id_passport_number: '',
      vehicle_reg: '',
      is_vip: false,
      is_blacklisted: false,
      blacklist_reason: '',
      notes: '',
    })
  }

  const openWhatsApp = (phone?: string | null, name = 'Guest') => {
    if (!phone) {
      toast.error('No phone number recorded for this guest')
      return
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const text = encodeURIComponent(
      `Hello ${name}, this is the front desk at The Patten Arms Hotel Warrington. We hope you're having a pleasant day! How can we assist you?`
    )
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Guest Profile & CRM System
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage repeat guests, stay history, vehicle registration plates, VIP status, and house blacklists
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              first_name: '',
              last_name: '',
              email: '',
              phone: '',
              country: 'United Kingdom',
              address: '',
              id_passport_number: '',
              vehicle_reg: '',
              is_vip: false,
              is_blacklisted: false,
              blacklist_reason: '',
              notes: '',
            })
            setShowAddModal(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add New Guest
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Guests In CRM</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{guests.length}</p>
      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Guests In CRM</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{guests.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Repeat Visitors</p>
          <p className="text-xl font-extrabold text-blue-600 mt-0.5">
            {Object.values(guestStats).filter(s => s.totalStays > 1).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">VIP Guests</p>
          <p className="text-xl font-extrabold text-amber-500 mt-0.5">
            {guests.filter(g => g.is_vip).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Caution / Blacklisted</p>
          <p className="text-xl font-extrabold text-red-600 mt-0.5">
            {guests.filter(g => g.is_blacklisted).length}
          </p>
        </div>
      </div>

      {/* Search & Filter Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, plate number, or ID..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: `All Guests (${guests.length})` },
              { id: 'vip', label: `VIPs (${guests.filter(g => g.is_vip).length})` },
              { id: 'repeat', label: `Repeat (${Object.values(guestStats).filter(s => s.totalStays > 1).length})` },
              { id: 'single_stay', label: 'First-Timer' },
              { id: 'blacklisted', label: `Caution (${guests.filter(g => g.is_blacklisted).length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTag(tab.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer',
                  filterTag === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition cursor-pointer',
                showAdvanced || countryFilter !== 'all' || spendTierFilter !== 'all' || stayCountFilter !== 'all' || sortBy !== 'created_desc'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {(countryFilter !== 'all' || spendTierFilter !== 'all' || stayCountFilter !== 'all' || sortBy !== 'created_desc') && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', showAdvanced && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
            {/* Country / Nationality */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Country / Nationality</label>
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Countries</option>
                {countries.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Lifetime Spend Tier */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lifetime Spend Tier</label>
              <select
                value={spendTierFilter}
                onChange={e => setSpendTierFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Spend Levels</option>
                <option value="vip">High Value (£500+)</option>
                <option value="mid">Mid Tier (£150 – £500)</option>
                <option value="budget">Budget (&lt; £150)</option>
                <option value="zero">Zero Spend (£0 / Inquiries)</option>
              </select>
            </div>

            {/* Stay Count Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Stay Frequency</label>
              <select
                value={stayCountFilter}
                onChange={e => setStayCountFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Stay Counts</option>
                <option value="1">1 Stay Only (First-time)</option>
                <option value="2-4">2 – 4 Stays</option>
                <option value="5+">5+ Stays (Frequent Regular)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sort Profiles By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                <option value="created_desc">Newest Guest Profile</option>
                <option value="spend_desc">Total Spent (£ High to Low)</option>
                <option value="stays_desc">Total Stays (Most to Fewest)</option>
                <option value="recent_desc">Most Recent Stay Date</option>
                <option value="name_asc">Guest Name (A to Z)</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filter Chips Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {search && (
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-blue-200">
                Search: "{search}"
                <button onClick={() => setSearch('')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterTag !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-slate-200">
                Segment: {filterTag === 'vip' ? 'VIP' : filterTag === 'repeat' ? 'Repeat' : filterTag === 'single_stay' ? 'First-Timer' : 'Blacklist'}
                <button onClick={() => setFilterTag('all')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {countryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-purple-200">
                Country: {countryFilter}
                <button onClick={() => setCountryFilter('all')} className="hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {spendTierFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-emerald-200">
                Spend: {spendTierFilter === 'vip' ? 'High Value (£500+)' : spendTierFilter === 'mid' ? 'Mid Tier (£150-£500)' : spendTierFilter === 'budget' ? 'Budget (<£150)' : '£0'}
                <button onClick={() => setSpendTierFilter('all')} className="hover:text-emerald-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {stayCountFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-amber-200">
                Stays: {stayCountFilter}
                <button onClick={() => setStayCountFilter('all')} className="hover:text-amber-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {sortBy !== 'created_desc' && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-medium text-[11px] border border-slate-200">
                Sort: {sortBy.replace('_', ' ')}
                <button onClick={() => setSortBy('created_desc')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(search || filterTag !== 'all' || countryFilter !== 'all' || spendTierFilter !== 'all' || stayCountFilter !== 'all' || sortBy !== 'created_desc') ? (
              <button
                onClick={() => {
                  setSearch('')
                  setFilterTag('all')
                  setCountryFilter('all')
                  setSpendTierFilter('all')
                  setStayCountFilter('all')
                  setSortBy('created_desc')
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-1"
              >
                <RotateCcw className="w-3 h-3" /> Clear All
              </button>
            ) : (
              <span className="text-slate-400 italic text-[11px]">None (Showing all)</span>
            )}
          </div>

          <div className="text-slate-500 font-semibold text-xs ml-auto whitespace-nowrap">
            Showing <span className="text-slate-800 font-bold">{filteredGuests.length}</span> of {guests.length} guest profiles
          </div>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600 text-sm">No guests found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria, country, or filters</p>
            <button
              onClick={() => {
                setSearch('')
                setFilterTag('all')
                setCountryFilter('all')
                setSpendTierFilter('all')
                setStayCountFilter('all')
                setSortBy('created_desc')
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Guest</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle Plate</th>
                  <th className="px-4 py-3 text-center font-semibold">Stays</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Spent</th>
                  <th className="px-4 py-3 text-center font-semibold">Status / Flags</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGuests.map(guest => {
                  const stats = guestStats[guest.id] || { totalStays: 0, totalSpent: 0, lastStayDate: '', lastRoom: '' }
                  return (
                    <tr
                      key={guest.id}
                      className={cn(
                        'hover:bg-slate-50/80 transition',
                        guest.is_blacklisted && 'bg-red-50/40 hover:bg-red-50/70'
                      )}
                    >
                      {/* Guest Name & Country */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                              guest.is_blacklisted
                                ? 'bg-red-100 text-red-700'
                                : guest.is_vip
                                ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {guest.first_name[0] || 'G'}
                            {guest.last_name[0] || ''}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              {guest.first_name} {guest.last_name}
                              {guest.is_vip && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> VIP
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">{guest.country || 'United Kingdom'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 space-y-1">
                        {guest.phone ? (
                          <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{guest.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">No phone</span>
                        )}
                        {guest.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[170px]">{guest.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Vehicle Registration */}
                      <td className="px-4 py-3.5">
                        {guest.vehicle_reg ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] bg-amber-50 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md uppercase">
                            <Car className="w-3 h-3 text-amber-700" />
                            {guest.vehicle_reg}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Stays Count */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-full text-xs',
                            stats.totalStays > 1
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {stats.totalStays} {stats.totalStays === 1 ? 'stay' : 'stays'}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                        {formatCurrency(stats.totalSpent)}
                      </td>

                      {/* Status / Flags */}
                      <td className="px-4 py-3.5 text-center">
                        {guest.is_blacklisted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3" /> Caution / Blacklist
                          </span>
                        ) : stats.totalStays > 2 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Frequent Guest
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Good Standing</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp */}
                          <button
                            onClick={() => openWhatsApp(guest.phone, `${guest.first_name}`)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Message on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* View Full Profile & Stay History */}
                          <button
                            onClick={() => setSelectedGuest(guest)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="View History & Folios"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Profile */}
                          <button
                            onClick={() => {
                              setEditingGuest(guest)
                              setFormData({
                                first_name: guest.first_name,
                                last_name: guest.last_name,
                                email: guest.email || '',
                                phone: guest.phone || '',
                                country: guest.country || 'United Kingdom',
                                address: guest.address || '',
                                id_passport_number: guest.id_passport_number || '',
                                vehicle_reg: guest.vehicle_reg || '',
                                is_vip: !!guest.is_vip,
                                is_blacklisted: !!guest.is_blacklisted,
                                blacklist_reason: guest.blacklist_reason || '',
                                notes: guest.notes || '',
                              })
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Toggle Blacklist */}
                          {guest.is_blacklisted ? (
                            <button
                              onClick={() => handleRemoveBlacklist(guest)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Remove from Blacklist"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowBlacklistConfirm(guest)}
                              className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Flag / Blacklist Guest"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: GUEST STAY HISTORY & FULL CRM PROFILE */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  {selectedGuest.first_name[0]}
                  {selectedGuest.last_name[0]}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {selectedGuest.first_name} {selectedGuest.last_name}
                    {selectedGuest.is_vip && (
                      <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500" /> VIP
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">{selectedGuest.country || 'United Kingdom'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleVIP(selectedGuest)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-white transition cursor-pointer"
                >
                  {selectedGuest.is_vip ? 'Remove VIP' : '⭐ Set VIP'}
                </button>
                <button
                  onClick={() => setSelectedGuest(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Caution Banner if Blacklisted */}
              {selectedGuest.is_blacklisted && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-red-900">CAUTION: Blacklisted Guest</p>
                    <p className="text-red-700 mt-0.5">
                      {selectedGuest.blacklist_reason || 'Flagged for non-payment or disturbance.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Guest Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Phone</span>
                  <strong className="text-slate-800 font-mono">{selectedGuest.phone || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Email</span>
                  <strong className="text-slate-800 truncate block">{selectedGuest.email || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Vehicle Plate</span>
                  <strong className="text-amber-900 font-mono uppercase bg-amber-100/60 px-1.5 py-0.5 rounded">
                    {selectedGuest.vehicle_reg || 'None logged'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ID / Passport</span>
                  <strong className="text-slate-800 font-mono">{selectedGuest.id_passport_number || '—'}</strong>
                </div>
              </div>

              {/* Internal Notes / Preferences */}
              {selectedGuest.notes && (
                <div className="bg-yellow-50/60 border border-yellow-200 p-3.5 rounded-xl text-xs">
                  <span className="font-bold text-yellow-800 block mb-1">Guest Notes & Preferences:</span>
                  <p className="text-yellow-900 whitespace-pre-wrap">{selectedGuest.notes}</p>
                </div>
              )}

              {/* Lifetime Stay History */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-600" /> Lifetime Stay History ({guestStats[selectedGuest.id]?.totalStays || 0})
                </h3>

                {guestStats[selectedGuest.id]?.stays && guestStats[selectedGuest.id].stays.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                        <tr>
                          <th className="px-3 py-2 text-left">Stay Dates</th>
                          <th className="px-3 py-2 text-left">Room</th>
                          <th className="px-3 py-2 text-left">Ref</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {guestStats[selectedGuest.id].stays.map(stay => (
                          <tr key={stay.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {formatDate(stay.check_in_date, 'dd MMM yyyy')} → {formatDate(stay.check_out_date, 'dd MMM yyyy')}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-700">
                              Room {(stay as any).room?.room_number ?? 'Assigned'}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                              {stay.booking_reference}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                              {formatCurrency(stay.total_amount)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="capitalize text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {stay.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No past reservations linked to this profile.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT GUEST MODAL */}
      {(showAddModal || editingGuest) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-4">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingGuest ? 'Edit Guest Profile' : 'Add New Guest'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingGuest(null)
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGuestForm} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+44 7700 900000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Vehicle License Plate</label>
                  <input
                    type="text"
                    value={formData.vehicle_reg}
                    onChange={e => setFormData(f => ({ ...f, vehicle_reg: e.target.value.toUpperCase() }))}
                    placeholder="e.g. WA24 XYZ"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">ID / Passport Number</label>
                  <input
                    type="text"
                    value={formData.id_passport_number}
                    onChange={e => setFormData(f => ({ ...f, id_passport_number: e.target.value }))}
                    placeholder="Passport or Driving Licence"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_vip}
                    onChange={e => setFormData(f => ({ ...f, is_vip: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-slate-700">⭐ Mark as VIP Guest</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Internal Notes & Preferences</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Quiet room preference, company payee, contractor team lead, etc."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingGuest(null)
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  Save Guest Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BLACKLIST CONFIRMATION */}
      {showBlacklistConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">Add to Caution / Blacklist</h3>
            </div>
            <p className="text-xs text-slate-600">
              Flag <strong>{showBlacklistConfirm.first_name} {showBlacklistConfirm.last_name}</strong> on the front-desk caution list. Front desk staff will see this warning on future reservations.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Caution / Ban</label>
              <textarea
                rows={3}
                value={blacklistReason}
                onChange={e => setBlacklistReason(e.target.value)}
                placeholder="e.g. Non-payment, smoking in bedroom, severe noise complaint, key theft..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBlacklistConfirm(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBlacklist}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Confirm Blacklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
