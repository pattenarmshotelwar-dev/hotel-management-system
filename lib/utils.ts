import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, parseISO } from 'date-fns'
import { BookingSource, BookingStatus, CleaningStatus, PaymentMethod, PaymentStatus, RoomStatus, RoomType, TicketPriority, TicketStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy, HH:mm')
}

export function nightCount(checkIn: string, checkOut: string): number {
  return differenceInDays(parseISO(checkOut), parseISO(checkIn))
}

export function getRoomTypeLabel(type: RoomType): string {
  const labels: Record<RoomType, string> = {
    single: 'Single',
    double: 'Double',
    twin_single: 'Twin Single',
    family: 'Family',
  }
  return labels[type] ?? type
}

export function getRoomStatusLabel(status: RoomStatus): string {
  const labels: Record<RoomStatus, string> = {
    available: 'Available',
    occupied: 'Occupied',
    dirty: 'Dirty',
    cleaning: 'Cleaning',
    maintenance: 'Maintenance',
    blocked: 'Blocked',
  }
  return labels[status] ?? status
}

export function getCleaningStatusLabel(status: CleaningStatus): string {
  const labels: Record<CleaningStatus, string> = {
    dirty: 'Dirty',
    cleaning: 'Cleaning',
    clean: 'Clean',
    inspected: 'Inspected',
  }
  return labels[status] ?? status
}

export function getBookingStatusLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    confirmed: 'Confirmed',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  }
  return labels[status] ?? status
}

export function getBookingSourceLabel(source: BookingSource): string {
  const labels: Record<BookingSource, string> = {
    booking_com: 'Booking.com',
    walk_in: 'Walk-in',
    direct: 'Direct',
  }
  return labels[source] ?? source
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    stripe_card: 'Card (Stripe)',
    stripe_link: 'Payment Link',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    booking_com_vcc: 'Booking.com VCC',
    booking_com_payout: 'Booking.com Payout',
  }
  return labels[method] ?? method
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Pending',
    succeeded: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
    partial_refund: 'Partial Refund',
  }
  return labels[status] ?? status
}

export function getTicketPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  }
  return labels[priority] ?? priority
}

export function getTicketStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  }
  return labels[status] ?? status
}

export function getBookingStatusColor(status: BookingStatus): string {
  const colors: Record<BookingStatus, string> = {
    confirmed: 'bg-blue-100 text-blue-800',
    checked_in: 'bg-green-100 text-green-800',
    checked_out: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function getBookingSourceColor(source: BookingSource): string {
  const colors: Record<BookingSource, string> = {
    booking_com: 'bg-blue-500',
    walk_in: 'bg-green-500',
    direct: 'bg-purple-500',
  }
  return colors[source] ?? 'bg-gray-500'
}

export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    succeeded: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-purple-100 text-purple-800',
    partial_refund: 'bg-orange-100 text-orange-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function getTicketPriorityColor(priority: TicketPriority): string {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  }
  return colors[priority] ?? 'bg-gray-100 text-gray-700'
}

export function getCleaningStatusColor(status: CleaningStatus): string {
  const colors: Record<CleaningStatus, string> = {
    dirty: 'bg-red-100 text-red-800',
    cleaning: 'bg-yellow-100 text-yellow-800',
    clean: 'bg-green-100 text-green-800',
    inspected: 'bg-blue-100 text-blue-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'BK-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
