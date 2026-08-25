export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RoomType = 'single' | 'double' | 'twin_single' | 'family'
export type RoomStatus = 'available' | 'occupied' | 'dirty' | 'cleaning' | 'maintenance' | 'blocked'
export type CleaningStatus = 'dirty' | 'cleaning' | 'clean' | 'inspected'
export type BookingSource = 'booking_com' | 'walk_in' | 'direct'
export type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type PaymentMethod = 'stripe_card' | 'stripe_link' | 'cash' | 'bank_transfer' | 'booking_com_vcc' | 'booking_com_payout'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export interface Room {
  id: string
  room_number: string
  room_type: RoomType
  floor: number
  base_price: number
  currency: string
  status: RoomStatus
  cleaning_status: CleaningStatus
  ical_import_url: string | null
  description: string | null
  max_adults: number
  max_children: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  country: string | null
  address: string | null
  id_passport_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  booking_reference: string
  room_id: string
  guest_id: string | null
  guest_first_name: string
  guest_last_name: string
  guest_email: string | null
  guest_phone: string | null
  guest_country: string | null
  check_in_date: string
  check_out_date: string
  estimated_arrival_time: string | null
  adults: number
  children: number
  total_amount: number
  currency: string
  source: BookingSource
  status: BookingStatus
  booking_com_reference: string | null
  booking_com_commission: number | null
  special_requests: string | null
  internal_notes: string | null
  is_ical_imported: boolean
  ical_uid: string | null
  is_maintenance_block: boolean
  maintenance_reason: string | null
  created_at: string
  updated_at: string
  // Joined
  room?: Room
  payments?: Payment[]
}

export interface Payment {
  id: string
  booking_id: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_receipt_url: string | null
  reference_number: string | null
  booking_com_payout_date: string | null
  booking_com_commission: number | null
  notes: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
  // Joined
  booking?: Booking
}

export interface CleaningLog {
  id: string
  room_id: string
  booking_id: string | null
  cleaner_name: string
  status_before: CleaningStatus | null
  status_after: CleaningStatus
  started_at: string | null
  completed_at: string
  notes: string | null
  created_at: string
  room?: Room
}

export interface MaintenanceTicket {
  id: string
  room_id: string
  booking_id: string | null
  reported_by: string
  title: string
  description: string | null
  priority: TicketPriority
  status: TicketStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
  room?: Room
}

export interface IcalSyncLog {
  id: string
  room_id: string | null
  sync_type: string
  status: string
  bookings_added: number
  bookings_updated: number
  bookings_removed: number
  error_message: string | null
  synced_at: string
}

export interface Database {
  public: {
    Tables: {
      rooms: { Row: Room; Insert: Partial<Room>; Update: Partial<Room> }
      guests: { Row: Guest; Insert: Partial<Guest>; Update: Partial<Guest> }
      bookings: { Row: Booking; Insert: Partial<Booking>; Update: Partial<Booking> }
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> }
      cleaning_logs: { Row: CleaningLog; Insert: Partial<CleaningLog>; Update: Partial<CleaningLog> }
      maintenance_tickets: { Row: MaintenanceTicket; Insert: Partial<MaintenanceTicket>; Update: Partial<MaintenanceTicket> }
      ical_sync_logs: { Row: IcalSyncLog; Insert: Partial<IcalSyncLog>; Update: Partial<IcalSyncLog> }
    }
  }
}
