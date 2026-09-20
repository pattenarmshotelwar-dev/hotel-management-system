'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, Booking, Payment } from '@/lib/types'
import { formatCurrency, formatDate, getBookingStatusColor, getBookingStatusLabel, nightCount, cn } from '@/lib/utils'
import {
  Users,
  LogIn,
  LogOut,
  CreditCard,
  BedDouble,
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  Printer,
  MessageSquare,
  Briefcase,
  Archive,
  RefreshCw,
  Phone,
  Mail,
  ShieldCheck,
  Calendar,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import NewBookingModal from '@/components/bookings/NewBookingModal'
import BookingDetailModal from '@/components/bookings/BookingDetailModal'
import GuestRegistrationCardModal from '@/components/bookings/GuestRegistrationCardModal'
import CheckoutWhatsAppPromptModal from '@/components/housekeeping/CheckoutWhatsAppPromptModal'
import OfficialInvoiceModal from '@/components/invoices/OfficialInvoiceModal'
import WhatsAppMessageModal from '@/components/bookings/WhatsAppMessageModal'

interface LuggageRecord {
  id: string
  tag_number: string
  guest_name: string
  guest_phone?: string
  room_number: string
  bag_count: number
  bag_description: string
  storage_location: string
  check_in_time: string
  expected_collection_time?: string
  status: 'stored' | 'collected'
  notes?: string
}

interface LostFoundRecord {
  id: string
  reference: string
  title: string
  category: string
  room_number?: string
  found_location: string
  found_date: string
  found_by: string
  guest_name?: string
  status: 'unclaimed' | 'claimed' | 'disposed'
  notes?: string
}

interface HandoverNote {
  id: string
  author: string
  content: string
  priority: 'normal' | 'urgent'
  created_at: string
}

type FrontDeskTab = 'arrivals' | 'in_house' | 'departures' | 'room_rack' | 'luggage' | 'lost_found' | 'handover'

export default function FrontDeskPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>([])
  const [arrivals, setArrivals] = useState<Booking[]>([])
  const [inHouse, setInHouse] = useState<Booking[]>([])
  const [departures, setDepartures] = useState<Booking[]>([])
  const [luggageItems, setLuggageItems] = useState<LuggageRecord[]>([])
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundRecord[]>([])
  const [handoverNotes, setHandoverNotes] = useState<HandoverNote[]>([])
  const [loading, setLoading] = useState(true)

  // Staff identity
  const [staffName, setStaffName] = useState('Front Desk Receptionist')
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [newStaffInput, setNewStaffInput] = useState('')

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<FrontDeskTab>('arrivals')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [regCardBooking, setRegCardBooking] = useState<Booking | null>(null)
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null)
  const [checkoutPromptBooking, setCheckoutPromptBooking] = useState<Booking | null>(null)
  const [whatsAppModalBooking, setWhatsAppModalBooking] = useState<Booking | null>(null)
  const [showLuggageModal, setShowLuggageModal] = useState(false)
  const [showLostFoundModal, setShowLostFoundModal] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)

  // Forms
  const [luggageForm, setLuggageForm] = useState({
    guest_name: '',
    guest_phone: '',
    room_number: '',
    bag_count: 1,
    bag_description: '',
    expected_collection_time: '18:00',
    notes: '',
  })

  const [lostFoundForm, setLostFoundForm] = useState({
    title: '',
    category: 'electronics',
    room_number: '',
    found_location: 'Reception / Lobby',
    found_by: '',
    notes: '',
  })

  const [handoverForm, setHandoverForm] = useState({
    content: '',
    priority: 'normal' as 'normal' | 'urgent',
  })

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    // Load staff name from storage
    const savedStaff = localStorage.getItem('patten_frontdesk_staff')
    if (savedStaff) {
      setStaffName(savedStaff)
    }

    // Load luggage & lost-found & handover from localStorage
    loadLocalData()
    fetchHotelData()
  }, [])

  const loadLocalData = () => {
    try {
      const savedLug = localStorage.getItem('patten_luggage_records')
      if (savedLug) {
        setLuggageItems(JSON.parse(savedLug))
      }
      const savedLf = localStorage.getItem('patten_lost_and_found')
      if (savedLf) {
        setLostFoundItems(JSON.parse(savedLf))
      }
      const savedHandover = localStorage.getItem('patten_handover_notes')
      if (savedHandover) {
        setHandoverNotes(JSON.parse(savedHandover))
      } else {
        const initialNotes: HandoverNote[] = [
          {
            id: 'note_1',
            author: 'Reception - Morning',
            content: 'Room 204 requested wake-up call at 07:00 AM tomorrow. Luggage tag LUG-01 held behind desk.',
            priority: 'normal',
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
        ]
        setHandoverNotes(initialNotes)
        localStorage.setItem('patten_handover_notes', JSON.stringify(initialNotes))
      }
    } catch (e) {
      console.error('Error reading local desk data:', e)
    }
  }

  const fetchHotelData = async () => {
    setLoading(true)
    try {
      const [
        { data: roomsData },
        { data: arrivalsData },
        { data: inHouseData },
        { data: departuresData },
      ] = await Promise.all([
        supabase.from('rooms').select('*').eq('is_active', true).order('room_number'),
        supabase
          .from('bookings')
          .select('*, room:rooms(room_number, room_type), payments(id, amount, status, method, created_at)')
          .eq('check_in_date', todayStr)
          .in('status', ['confirmed', 'checked_in'])
          .order('guest_last_name'),
        supabase
          .from('bookings')
          .select('*, room:rooms(room_number, room_type), payments(id, amount, status, method, created_at)')
          .eq('status', 'checked_in')
          .order('guest_last_name'),
        supabase
          .from('bookings')
          .select('*, room:rooms(room_number, room_type), payments(id, amount, status, method, created_at)')
          .eq('check_out_date', todayStr)
          .in('status', ['checked_in', 'checked_out'])
          .order('guest_last_name'),
      ])

      setRooms(roomsData ?? [])
      setArrivals(arrivalsData ?? [])
      setInHouse(inHouseData ?? [])
      setDepartures(departuresData ?? [])
    } catch (err) {
      console.error('Error fetching front desk data:', err)
      toast.error('Failed to load hotel data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate payment balance for a booking
  const getBookingPaymentInfo = (b: Booking) => {
    const payments = (b as any).payments || []
    const paid = payments
      .filter((p: any) => p.status === 'succeeded')
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    const balance = Math.max(0, b.total_amount - paid)
    return { paid, balance, isFullyPaid: balance <= 0 && b.total_amount > 0 }
  }

  // 1-Click Check In Guest
  const handleCheckIn = async (booking: Booking) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'checked_in',
          estimated_arrival_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
        .eq('id', booking.id)

      if (error) throw error

      toast.success(`✓ Checked in ${booking.guest_first_name} ${booking.guest_last_name} into Room ${(booking as any).room?.room_number ?? 'assigned'}`)
      fetchHotelData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to check in guest')
    }
  }

  // 1-Click Check Out Guest
  const handleCheckOut = async (booking: Booking) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'checked_out' })
        .eq('id', booking.id)

      if (error) throw error

      // Auto mark room dirty for housekeeping
      if (booking.room_id) {
        await supabase.from('rooms').update({ cleaning_status: 'dirty' }).eq('id', booking.room_id)
      }

      toast.success(`✓ Checked out ${booking.guest_first_name} ${booking.guest_last_name}. Room marked dirty for Housekeeping!`)
      setCheckoutPromptBooking(booking)
      fetchHotelData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to check out guest')
    }
  }

  // Save staff member name
  const handleSaveStaffName = () => {
    if (!newStaffInput.trim()) return
    setStaffName(newStaffInput.trim())
    localStorage.setItem('patten_frontdesk_staff', newStaffInput.trim())
    setShowStaffModal(false)
    toast.success(`Staff updated to ${newStaffInput.trim()}`)
  }

  // Fast Luggage Intake
  const handleAddLuggage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!luggageForm.guest_name.trim()) {
      toast.error('Please enter the guest name')
      return
    }

    const tagNumber = `LUG-${String(luggageItems.length + 1).padStart(2, '0')}`
    const newItem: LuggageRecord = {
      id: `lug_${Date.now()}`,
      tag_number: tagNumber,
      guest_name: luggageForm.guest_name.trim(),
      guest_phone: luggageForm.guest_phone.trim() || undefined,
      room_number: luggageForm.room_number.trim() || 'Front Desk',
      bag_count: Number(luggageForm.bag_count) || 1,
      bag_description: luggageForm.bag_description.trim() || 'Suitcase / Bag',
      storage_location: 'Behind Reception',
      check_in_time: new Date().toISOString(),
      expected_collection_time: luggageForm.expected_collection_time,
      status: 'stored',
      notes: luggageForm.notes.trim() || undefined,
    }

    const updated = [newItem, ...luggageItems]
    setLuggageItems(updated)
    localStorage.setItem('patten_luggage_records', JSON.stringify(updated))
    setShowLuggageModal(false)
    setLuggageForm({
      guest_name: '',
      guest_phone: '',
      room_number: '',
      bag_count: 1,
      bag_description: '',
      expected_collection_time: '18:00',
      notes: '',
    })
    toast.success(`Luggage tag ${tagNumber} checked in successfully!`)
  }

  // Release Luggage
  const handleReleaseLuggage = (id: string) => {
    const updated = luggageItems.map(item => (item.id === id ? { ...item, status: 'collected' as const } : item))
    setLuggageItems(updated)
    localStorage.setItem('patten_luggage_records', JSON.stringify(updated))
    toast.success('Bags returned to guest!')
  }

  // Fast Lost & Found Intake
  const handleAddLostFound = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lostFoundForm.title.trim()) {
      toast.error('Please describe the item')
      return
    }

    const ref = `LF-${new Date().getFullYear()}-${String(lostFoundItems.length + 1).padStart(3, '0')}`
    const newItem: LostFoundRecord = {
      id: `lf_${Date.now()}`,
      reference: ref,
      title: lostFoundForm.title.trim(),
      category: lostFoundForm.category,
      room_number: lostFoundForm.room_number.trim() || undefined,
      found_location: lostFoundForm.found_location.trim(),
      found_date: todayStr,
      found_by: lostFoundForm.found_by.trim() || staffName,
      status: 'unclaimed',
      notes: lostFoundForm.notes.trim() || undefined,
    }

    const updated = [newItem, ...lostFoundItems]
    setLostFoundItems(updated)
    localStorage.setItem('patten_lost_and_found', JSON.stringify(updated))
    setShowLostFoundModal(false)
    setLostFoundForm({
      title: '',
      category: 'electronics',
      room_number: '',
      found_location: 'Reception / Lobby',
      found_by: '',
      notes: '',
    })
    toast.success(`Logged lost item ${ref} in reception drawer!`)
  }

  // Claim Lost & Found Item
  const handleClaimLostFound = (id: string) => {
    const updated = lostFoundItems.map(item => (item.id === id ? { ...item, status: 'claimed' as const } : item))
    setLostFoundItems(updated)
    localStorage.setItem('patten_lost_and_found', JSON.stringify(updated))
    toast.success('Item marked as claimed and returned to guest!')
  }

  // Shift Handover Note
  const handleAddHandoverNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!handoverForm.content.trim()) return

    const newNote: HandoverNote = {
      id: `note_${Date.now()}`,
      author: staffName,
      content: handoverForm.content.trim(),
      priority: handoverForm.priority,
      created_at: new Date().toISOString(),
    }

    const updated = [newNote, ...handoverNotes]
    setHandoverNotes(updated)
    localStorage.setItem('patten_handover_notes', JSON.stringify(updated))
    setShowHandoverModal(false)
    setHandoverForm({ content: '', priority: 'normal' })
    toast.success('Handover note posted for team!')
  }

  // Quick stats
  const activeLuggageCount = luggageItems.filter(i => i.status === 'stored').length
  const unclaimedLostFoundCount = lostFoundItems.filter(i => i.status === 'unclaimed').length
  const cleanRoomsCount = rooms.filter(r => r.cleaning_status === 'clean' || r.cleaning_status === 'inspected').length
  const occupiedRoomsCount = inHouse.length
  const arrivalsDueCount = arrivals.filter(b => b.status === 'confirmed').length
  const departuresDueCount = departures.filter(b => b.status === 'checked_in').length

  // Filtered arrivals
  const filteredArrivals = useMemo(() => {
    if (!searchQuery) return arrivals
    const q = searchQuery.toLowerCase()
    return arrivals.filter(
      b =>
        b.guest_first_name.toLowerCase().includes(q) ||
        b.guest_last_name.toLowerCase().includes(q) ||
        b.booking_reference.toLowerCase().includes(q) ||
        ((b as any).room?.room_number ?? '').toString().includes(q)
    )
  }, [arrivals, searchQuery])

  // Filtered in-house
  const filteredInHouse = useMemo(() => {
    if (!searchQuery) return inHouse
    const q = searchQuery.toLowerCase()
    return inHouse.filter(
      b =>
        b.guest_first_name.toLowerCase().includes(q) ||
        b.guest_last_name.toLowerCase().includes(q) ||
        b.booking_reference.toLowerCase().includes(q) ||
        ((b as any).room?.room_number ?? '').toString().includes(q)
    )
  }, [inHouse, searchQuery])

  // Filtered departures
  const filteredDepartures = useMemo(() => {
    if (!searchQuery) return departures
    const q = searchQuery.toLowerCase()
    return departures.filter(
      b =>
        b.guest_first_name.toLowerCase().includes(q) ||
        b.guest_last_name.toLowerCase().includes(q) ||
        b.booking_reference.toLowerCase().includes(q) ||
        ((b as any).room?.room_number ?? '').toString().includes(q)
    )
  }, [departures, searchQuery])

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* 1. Header Bar */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              🏨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight">The Patten Arms Front Desk</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Operations
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Active Staff Identity */}
            <button
              onClick={() => {
                setNewStaffInput(staffName)
                setShowStaffModal(true)
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-xl transition text-left"
              title="Click to switch staff name on shift"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                {staffName.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white truncate max-w-[140px]">{staffName}</p>
                <p className="text-[10px] text-slate-400">Tap to change</p>
              </div>
            </button>

            {/* Quick Link to Management */}
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
            >
              <span>Management</span>
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            </Link>

            {/* Sign Out */}
            <button
              onClick={async () => {
                localStorage.removeItem('patten_hotel_last_activity')
                sessionStorage.removeItem('patten_hotel_last_activity')
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* 2. Top Metric Cards Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Arrivals */}
          <div
            onClick={() => setActiveTab('arrivals')}
            className={cn(
              'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
              activeTab === 'arrivals' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Today&apos;s Arrivals</span>
              <LogIn className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{arrivals.length}</p>
            <p className="text-xs text-green-700 font-semibold mt-0.5">{arrivalsDueCount} due in</p>
          </div>

          {/* In-House */}
          <div
            onClick={() => setActiveTab('in_house')}
            className={cn(
              'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
              activeTab === 'in_house' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>In-House Guests</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{occupiedRoomsCount}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">Rooms occupied</p>
          </div>

          {/* Departures */}
          <div
            onClick={() => setActiveTab('departures')}
            className={cn(
              'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
              activeTab === 'departures' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Departures</span>
              <LogOut className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{departures.length}</p>
            <p className="text-xs text-orange-600 font-semibold mt-0.5">{departuresDueCount} due out</p>
          </div>

          {/* Ready Rooms */}
          <div
            onClick={() => setActiveTab('room_rack')}
            className={cn(
              'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm',
              activeTab === 'room_rack' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Rooms Ready</span>
              <BedDouble className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">{cleanRoomsCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Clean & Inspected</p>
          </div>

          {/* Luggage Counter */}
          <div
            onClick={() => setActiveTab('luggage')}
            className={cn(
              'bg-white border rounded-2xl p-4 cursor-pointer transition hover:shadow-sm col-span-2 sm:col-span-1',
              activeTab === 'luggage' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Luggage Stored</span>
              <Briefcase className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700 mt-2">{activeLuggageCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Active at desk</p>
          </div>
        </div>

        {/* 3. Front Desk Fast Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Walk-in Booking */}
            <button
              onClick={() => setShowWalkInModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Walk-In Booking</span>
            </button>

            {/* Check-In Baggage */}
            <button
              onClick={() => setShowLuggageModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold rounded-xl text-xs transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>Store Luggage</span>
            </button>

            {/* Log Lost Property */}
            <button
              onClick={() => setShowLostFoundModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold rounded-xl text-xs transition"
            >
              <Archive className="w-4 h-4" />
              <span>Lost &amp; Found</span>
            </button>

            {/* Add Shift Note */}
            <button
              onClick={() => setShowHandoverModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold rounded-xl text-xs transition"
            >
              <FileText className="w-4 h-4" />
              <span>Shift Handover Note</span>
            </button>
          </div>

          <button
            onClick={() => fetchHotelData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition rounded-lg hover:bg-slate-100"
            title="Refresh live data"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4. Operational Tabs Ribbon */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          {[
            { id: 'arrivals', label: '📥 Arrivals', count: arrivals.length },
            { id: 'in_house', label: '🏨 In-House Guests', count: inHouse.length },
            { id: 'departures', label: '📤 Departures', count: departures.length },
            { id: 'room_rack', label: '🛏️ Visual Room Rack', count: rooms.length },
            { id: 'luggage', label: '🧳 Luggage Storage', count: activeLuggageCount },
            { id: 'lost_found', label: '📦 Lost & Found', count: unclaimedLostFoundCount },
            { id: 'handover', label: '📋 Shift Notes', count: handoverNotes.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FrontDeskTab)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold rounded-xl transition whitespace-nowrap flex items-center gap-2',
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  activeTab === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Filter for Tables */}
        {['arrivals', 'in_house', 'departures'].includes(activeTab) && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search guest by name, room number, or booking reference..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 5. TAB CONTENTS */}

        {/* TAB 1: ARRIVALS */}
        {activeTab === 'arrivals' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Scheduled Check-Ins for Today</h3>
                <p className="text-xs text-slate-400 mt-0.5">Review guest folio, collect ID/payment, and check in</p>
              </div>
              <span className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                {filteredArrivals.length} Guests
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs">Loading arrivals...</p>
              </div>
            ) : filteredArrivals.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No arrivals found</p>
                <p className="text-xs text-slate-400 mt-1">All guests for today may already be checked in</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredArrivals.map(b => {
                  const { paid, balance, isFullyPaid } = getBookingPaymentInfo(b)
                  const isCheckedIn = b.status === 'checked_in'
                  return (
                    <div key={b.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-blue-600">Room</span>
                          <span className="font-bold text-base leading-none">{(b as any).room?.room_number ?? '—'}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{b.guest_first_name} {b.guest_last_name}</h4>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                              {b.booking_reference}
                            </span>
                            {isCheckedIn ? (
                              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Checked In
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Due In
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              ETA: {b.estimated_arrival_time || 'Standard 15:00'}
                            </span>
                            <span>•</span>
                            <span>{nightCount(b.check_in_date, b.check_out_date)} nights</span>
                            <span>•</span>
                            <span>{b.adults} Adults {b.children > 0 ? `, ${b.children} Children` : ''}</span>
                            {b.guest_phone && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Phone className="w-3 h-3" /> {b.guest_phone}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Payment & Action Controls */}
                      <div className="flex items-center gap-3 flex-wrap md:justify-end">
                        <div className="text-right mr-2">
                          <p className="text-xs font-bold text-slate-800">{formatCurrency(b.total_amount)}</p>
                          {isFullyPaid ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                              ✓ Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              Due: {formatCurrency(balance)}
                            </span>
                          )}
                        </div>

                        {/* Registration Card / Folio */}
                        <button
                          onClick={() => setRegCardBooking(b)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                          title="Print Registration Folio for guest signature"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Reg Card</span>
                        </button>

                        {/* WhatsApp Welcome */}
                        <button
                          onClick={() => setWhatsAppModalBooking(b)}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-medium transition"
                          title="Send WhatsApp confirmation & WiFi details"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* 1-Click Check In */}
                        {!isCheckedIn ? (
                          <button
                            onClick={() => handleCheckIn(b)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Check In</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedBooking(b)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IN-HOUSE GUESTS */}
        {activeTab === 'in_house' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Currently Checked-In Guests</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage in-house guests, incidentals, and departures</p>
              </div>
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                {filteredInHouse.length} In-House
              </span>
            </div>

            {filteredInHouse.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No in-house guests</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredInHouse.map(b => {
                  const { balance, isFullyPaid } = getBookingPaymentInfo(b)
                  const isLeavingToday = b.check_out_date === todayStr
                  return (
                    <div key={b.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">Room</span>
                          <span className="font-bold text-base leading-none text-white">{(b as any).room?.room_number ?? '—'}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{b.guest_first_name} {b.guest_last_name}</h4>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                              {b.booking_reference}
                            </span>
                            {isLeavingToday && (
                              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Departing Today
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                            <span>Departs: {formatDate(b.check_out_date)}</span>
                            <span>•</span>
                            <span>{b.adults}A {b.children > 0 ? `, ${b.children}C` : ''}</span>
                            {b.guest_phone && (
                              <>
                                <span>•</span>
                                <span>{b.guest_phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap md:justify-end">
                        <div className="text-right mr-2">
                          <p className="text-xs font-bold text-slate-800">{formatCurrency(b.total_amount)}</p>
                          {isFullyPaid ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                              ✓ Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              Balance: {formatCurrency(balance)}
                            </span>
                          )}
                        </div>

                        {/* Official Invoice */}
                        <button
                          onClick={() => setInvoiceBooking(b)}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                          title="Generate official VAT invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>

                        {/* 1-Click Check Out */}
                        <button
                          onClick={() => handleCheckOut(b)}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Check Out</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPARTURES */}
        {activeTab === 'departures' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Today&apos;s Check-Outs (Standard: 11:00 AM)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Settle remaining balances, retrieve keys, and dispatch housekeeping</p>
              </div>
              <span className="text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">
                {filteredDepartures.length} Total
              </span>
            </div>

            {filteredDepartures.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No departures today</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDepartures.map(b => {
                  const { balance, isFullyPaid } = getBookingPaymentInfo(b)
                  const isCheckedOut = b.status === 'checked_out'
                  return (
                    <div key={b.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-orange-600">Room</span>
                          <span className="font-bold text-base leading-none">{(b as any).room?.room_number ?? '—'}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{b.guest_first_name} {b.guest_last_name}</h4>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                              {b.booking_reference}
                            </span>
                            {isCheckedOut ? (
                              <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Checked Out
                              </span>
                            ) : (
                              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Pending Check-out
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Stayed {nightCount(b.check_in_date, b.check_out_date)} nights</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap md:justify-end">
                        <div className="text-right mr-2">
                          <p className="text-xs font-bold text-slate-800">{formatCurrency(b.total_amount)}</p>
                          {isFullyPaid ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                              ✓ Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              Due: {formatCurrency(balance)}
                            </span>
                          )}
                        </div>

                        {/* Invoice */}
                        <button
                          onClick={() => setInvoiceBooking(b)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>

                        {!isCheckedOut && (
                          <button
                            onClick={() => handleCheckOut(b)}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Check Out</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: VISUAL ROOM RACK */}
        {activeTab === 'room_rack' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Interactive Room Allocation Rack</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Live room readiness, occupancy, and housekeeping status</p>
                </div>

                {/* Color Legend */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600 font-medium">Clean &amp; Ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                    <span className="text-slate-600 font-medium">Occupied</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-slate-600 font-medium">Dirty / Turn-down</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                    <span className="text-slate-600 font-medium">Maintenance</span>
                  </div>
                </div>
              </div>

              {/* Grid of rooms */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {rooms.map(room => {
                  const currentBooking = inHouse.find(b => b.room_id === room.id)
                  const isOccupied = !!currentBooking
                  const isClean = room.cleaning_status === 'clean' || room.cleaning_status === 'inspected'
                  const isDirty = room.cleaning_status === 'dirty'

                  let badgeColor = 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  let statusText = 'Ready'

                  if (isOccupied) {
                    badgeColor = 'bg-blue-50 border-blue-300 text-blue-900'
                    statusText = 'Occupied'
                  } else if (isDirty) {
                    badgeColor = 'bg-amber-50 border-amber-300 text-amber-900'
                    statusText = 'Dirty'
                  } else if (room.status === 'maintenance') {
                    badgeColor = 'bg-slate-100 border-slate-300 text-slate-700'
                    statusText = 'Maintenance'
                  }

                  return (
                    <div
                      key={room.id}
                      className={cn(
                        'border-2 rounded-2xl p-3.5 transition flex flex-col justify-between hover:shadow-md cursor-pointer min-h-[110px]',
                        badgeColor
                      )}
                      onClick={() => {
                        if (currentBooking) {
                          setSelectedBooking(currentBooking)
                        } else if (!isOccupied && isClean) {
                          setShowWalkInModal(true)
                        } else {
                          toast.info(`Room ${room.room_number}: ${statusText}`)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-extrabold">{room.room_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border shadow-xs">
                          {statusText}
                        </span>
                      </div>

                      <div className="mt-2">
                        <p className="text-[11px] font-semibold truncate capitalize text-slate-700">
                          {room.room_type.replace('_', ' ')}
                        </p>
                        {currentBooking ? (
                          <p className="text-[10px] font-bold text-blue-700 truncate mt-0.5">
                            👤 {currentBooking.guest_first_name} {currentBooking.guest_last_name}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            £{room.base_price}/night
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LUGGAGE STORAGE */}
        {activeTab === 'luggage' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Reception Baggage Storage Counter</h3>
                <p className="text-xs text-slate-400 mt-0.5">Track stored luggage for early arrivals and late departures</p>
              </div>
              <button
                onClick={() => setShowLuggageModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Store New Bags</span>
              </button>
            </div>

            {luggageItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Briefcase className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No luggage currently stored</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {luggageItems.map(item => {
                  const isStored = item.status === 'stored'
                  return (
                    <div key={item.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-purple-600">Tag</span>
                          <span className="font-bold text-sm leading-none">{item.tag_number}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{item.guest_name}</h4>
                            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Room {item.room_number}
                            </span>
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', isStored ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600')}>
                              {isStored ? 'In Storage' : 'Returned'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.bag_count} bag(s) • {item.bag_description} • Location: {item.storage_location}
                          </p>
                          {item.expected_collection_time && (
                            <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                              Pickup expected: {item.expected_collection_time}
                            </p>
                          )}
                        </div>
                      </div>

                      {isStored && (
                        <button
                          onClick={() => handleReleaseLuggage(item.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 ml-auto"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Return to Guest</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: LOST & FOUND */}
        {activeTab === 'lost_found' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Front Desk Lost Property Drawer</h3>
                <p className="text-xs text-slate-400 mt-0.5">Record items left behind in rooms or public areas</p>
              </div>
              <button
                onClick={() => setShowLostFoundModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Log Found Property</span>
              </button>
            </div>

            {lostFoundItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Archive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No lost property logged</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lostFoundItems.map(item => {
                  const isUnclaimed = item.status === 'unclaimed'
                  return (
                    <div key={item.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-amber-600">Ref</span>
                          <span className="font-bold text-[11px] leading-none">{item.reference.replace('LF-2026-', '#')}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                            {item.room_number && (
                              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                Room {item.room_number}
                              </span>
                            )}
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', isUnclaimed ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600')}>
                              {isUnclaimed ? 'Unclaimed' : 'Claimed'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Found at {item.found_location} by {item.found_by} on {item.found_date}
                          </p>
                          {item.notes && <p className="text-xs text-slate-400 italic mt-0.5">{item.notes}</p>}
                        </div>
                      </div>

                      {isUnclaimed && (
                        <button
                          onClick={() => handleClaimLostFound(item.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 ml-auto"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Mark Claimed</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: SHIFT HANDOVER NOTES */}
        {activeTab === 'handover' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Reception Shift Handover Log</h3>
                <p className="text-xs text-slate-400 mt-0.5">Notes, alerts, and instructions between front desk shifts</p>
              </div>
              <button
                onClick={() => setShowHandoverModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Shift Note</span>
              </button>
            </div>

            <div className="p-5 space-y-3">
              {handoverNotes.map(note => (
                <div
                  key={note.id}
                  className={cn(
                    'p-4 rounded-xl border transition',
                    note.priority === 'urgent'
                      ? 'bg-red-50/70 border-red-200 text-red-950'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{note.author}</span>
                      {note.priority === 'urgent' && (
                        <span className="bg-red-200 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          URGENT
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(note.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* 1. Change Staff Member Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-800 text-base">Set Receptionist Name</h3>
            <p className="text-xs text-slate-500">
              Enter your name to stamp check-ins, payments, and shift notes.
            </p>
            <input
              type="text"
              value={newStaffInput}
              onChange={e => setNewStaffInput(e.target.value)}
              placeholder="e.g. Sarah - Reception"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowStaffModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStaffName}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Walk-In Booking Modal */}
      {showWalkInModal && (
        <NewBookingModal
          rooms={rooms}
          onClose={() => setShowWalkInModal(false)}
          onCreated={() => {
            fetchHotelData()
            setShowWalkInModal(false)
          }}
        />
      )}

      {/* 3. Booking Details Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => {
            fetchHotelData()
            setSelectedBooking(null)
          }}
        />
      )}

      {/* 4. Guest Registration Card Folio Modal */}
      {regCardBooking && (
        <GuestRegistrationCardModal
          booking={regCardBooking}
          payments={(regCardBooking as any).payments || []}
          onClose={() => setRegCardBooking(null)}
        />
      )}

      {/* 5. Official PAH Tax Invoice Modal */}
      {invoiceBooking && (
        <OfficialInvoiceModal
          booking={invoiceBooking}
          payments={(invoiceBooking as any).payments || []}
          onClose={() => setInvoiceBooking(null)}
        />
      )}

      {/* 6. Checkout WhatsApp Prompt */}
      {checkoutPromptBooking && (
        <CheckoutWhatsAppPromptModal
          booking={checkoutPromptBooking}
          onClose={() => setCheckoutPromptBooking(null)}
        />
      )}

      {/* 7. WhatsApp Message Modal */}
      {whatsAppModalBooking && (
        <WhatsAppMessageModal
          booking={whatsAppModalBooking}
          defaultType={whatsAppModalBooking.status === 'checked_out' ? 'review' : 'confirmation'}
          onClose={() => setWhatsAppModalBooking(null)}
        />
      )}

      {/* 8. Fast Luggage Intake Modal */}
      {showLuggageModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Store Luggage at Reception</h3>
              <button onClick={() => setShowLuggageModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLuggage} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Guest Full Name *</label>
                <input
                  type="text"
                  required
                  value={luggageForm.guest_name}
                  onChange={e => setLuggageForm({ ...luggageForm, guest_name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Room # (or 'Arriving')</label>
                  <input
                    type="text"
                    value={luggageForm.room_number}
                    onChange={e => setLuggageForm({ ...luggageForm, room_number: e.target.value })}
                    placeholder="e.g. 104"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Number of Bags</label>
                  <input
                    type="number"
                    min="1"
                    value={luggageForm.bag_count}
                    onChange={e => setLuggageForm({ ...luggageForm, bag_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Bag Description / Color</label>
                <input
                  type="text"
                  value={luggageForm.bag_description}
                  onChange={e => setLuggageForm({ ...luggageForm, bag_description: e.target.value })}
                  placeholder="e.g. Black rolling suitcase + blue backpack"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Guest Phone</label>
                  <input
                    type="text"
                    value={luggageForm.guest_phone}
                    onChange={e => setLuggageForm({ ...luggageForm, guest_phone: e.target.value })}
                    placeholder="+44 7..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Expected Pickup</label>
                  <input
                    type="time"
                    value={luggageForm.expected_collection_time}
                    onChange={e => setLuggageForm({ ...luggageForm, expected_collection_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLuggageModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  Store &amp; Issue Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Fast Lost & Found Modal */}
      {showLostFoundModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">Log Lost &amp; Found Item</h3>
              <button onClick={() => setShowLostFoundModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLostFound} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Item Description *</label>
                <input
                  type="text"
                  required
                  value={lostFoundForm.title}
                  onChange={e => setLostFoundForm({ ...lostFoundForm, title: e.target.value })}
                  placeholder="e.g. Apple iPhone charger + lightning cable"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Room # (if from room)</label>
                  <input
                    type="text"
                    value={lostFoundForm.room_number}
                    onChange={e => setLostFoundForm({ ...lostFoundForm, room_number: e.target.value })}
                    placeholder="e.g. 202"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Found Location</label>
                  <input
                    type="text"
                    value={lostFoundForm.found_location}
                    onChange={e => setLostFoundForm({ ...lostFoundForm, found_location: e.target.value })}
                    placeholder="e.g. Reception Desk"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Found By</label>
                <input
                  type="text"
                  value={lostFoundForm.found_by}
                  onChange={e => setLostFoundForm({ ...lostFoundForm, found_by: e.target.value })}
                  placeholder={staffName}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  value={lostFoundForm.notes}
                  onChange={e => setLostFoundForm({ ...lostFoundForm, notes: e.target.value })}
                  placeholder="Stored in bottom reception drawer..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLostFoundModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Log Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Handover Note Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">New Shift Handover Note</h3>
              <button onClick={() => setShowHandoverModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddHandoverNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={handoverForm.priority}
                  onChange={e => setHandoverForm({ ...handoverForm, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                >
                  <option value="normal">Standard Handover Note</option>
                  <option value="urgent">Urgent / Attention Required</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Note Details</label>
                <textarea
                  rows={4}
                  required
                  value={handoverForm.content}
                  onChange={e => setHandoverForm({ ...handoverForm, content: e.target.value })}
                  placeholder="e.g. Room 108 requested extra towels. Late arrival Mr Jenkins due at 23:30, key card on desk."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Post Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
