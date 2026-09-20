import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, parseISO } from 'date-fns'
import { BookingSource, BookingStatus, CleaningStatus, PaymentMethod, PaymentStatus, RoomStatus, RoomType, TicketPriority, TicketStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'GBP'): string {
  const num = Number(amount)
  const safeAmount = isNaN(num) ? 0 : num
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(safeAmount)
  } catch {
    return `£${safeAmount.toFixed(2)}`
  }
}

export function formatDate(date: string | Date | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!d || isNaN(d.getTime())) return '—'
    return format(d, fmt)
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!d || isNaN(d.getTime())) return '—'
    return format(d, 'dd MMM yyyy, HH:mm')
  } catch {
    return '—'
  }
}

export function nightCount(checkIn: string, checkOut: string): number {
  try {
    if (!checkIn || !checkOut) return 1
    const dIn = parseISO(checkIn)
    const dOut = parseISO(checkOut)
    if (isNaN(dIn.getTime()) || isNaN(dOut.getTime())) return 1
    return Math.max(1, differenceInDays(dOut, dIn))
  } catch {
    return 1
  }
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

export function formatWhatsAppPhone(phone: string = ''): string {
  let digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('07') && digits.length === 11) {
    digits = '44' + digits.slice(1)
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  return digits
}

export function sendCleanerWhatsAppMessage({
  phone = '',
  roomNumber,
  roomType = 'Standard',
  floor = 1,
  priority = 'Normal',
  notes = '',
}: {
  phone?: string
  roomNumber: string | number
  roomType?: string
  floor?: number
  priority?: 'Normal' | 'Urgent (Arrival Today)' | 'Guest Request'
  notes?: string
}) {
  const cleanPhone = formatWhatsAppPhone(phone)
  const text = encodeURIComponent(
    `🏨 *Patten Arms Hotel — Housekeeping Alert*\n\n` +
    `🧹 *Room:* Room ${roomNumber} (Floor ${floor} — ${roomType})\n` +
    `⚡ *Priority:* ${priority}\n` +
    (notes ? `📝 *Notes:* ${notes}\n` : '') +
    `🕒 *Time:* ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}\n\n` +
    `👉 Please update status once complete:\nhttps://hotel-management-system-one-lovat.vercel.app/housekeeping`
  )

  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

export const DEFAULT_ADDON_PRESETS: Array<{
  id: string
  name: string
  price: number
  category: 'breakfast' | 'checkin_checkout' | 'parking' | 'pet' | 'fee' | 'damage' | 'other'
  description: string
}> = [
  { id: 'addon_breakfast', name: 'Full English Breakfast', price: 10.0, category: 'breakfast', description: 'Fresh cooked English breakfast per guest per morning' },
  { id: 'addon_late_co', name: 'Late Check-out (until 1:00 PM)', price: 15.0, category: 'checkin_checkout', description: 'Extended departure time until 13:00' },
  { id: 'addon_early_ci', name: 'Early Check-in (from 12:00 PM)', price: 15.0, category: 'checkin_checkout', description: 'Early room access from 12:00 PM noon' },
  { id: 'addon_parking', name: 'Overnight Parking Pass', price: 5.0, category: 'parking', description: 'Hotel customer car park space per night' },
  { id: 'addon_pet', name: 'Pet Stay Surcharge', price: 20.0, category: 'pet', description: 'Pet cleaning fee per stay' },
  { id: 'addon_lost_key', name: 'Lost Key / Fob Replacement Fee', price: 25.0, category: 'fee', description: 'Physical brass key or electronic fob replacement fee' },
  { id: 'addon_extra_bed', name: 'Extra Bed / Rollaway', price: 25.0, category: 'other', description: 'Additional single rollaway bed per night' },
  { id: 'addon_damage', name: 'Damage / Smoking / Deep Clean Charge', price: 50.0, category: 'damage', description: 'Incident fee for room damage or unauthorized smoking' },
]

export function sendGuestWhatsAppMessage({
  phone = '',
  text = '',
}: {
  phone?: string
  text: string
}) {
  const cleanPhone = formatWhatsAppPhone(phone)
  const encodedText = encodeURIComponent(text)
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

export function generateBookingConfirmationWhatsAppText({
  guestName,
  bookingRef,
  roomNumber,
  roomType,
  checkInDate,
  checkOutDate,
  totalAmount,
  hotelConfig,
}: {
  guestName: string
  bookingRef: string
  roomNumber?: string
  roomType?: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  hotelConfig?: {
    name?: string
    phone?: string
    address?: string
    checkInTime?: string
    checkOutTime?: string
    wifiNetwork?: string
    wifiPassword?: string
  }
}): string {
  const hotelName = hotelConfig?.name || 'The Patten Arms Hotel'
  const checkIn = hotelConfig?.checkInTime || '15:00'
  const checkOut = hotelConfig?.checkOutTime || '11:00'
  const phone = hotelConfig?.phone || '+44 1925 650144'
  const address = hotelConfig?.address || 'Parker Street, Warrington WA1 1HG'
  const wifi = hotelConfig?.wifiNetwork ? `📶 *Wi-Fi:* ${hotelConfig.wifiNetwork} (Password: ${hotelConfig.wifiPassword || 'See Reception'})` : ''

  return (
    `🏨 *Reservation Confirmation — ${hotelName}*\n\n` +
    `Dear ${guestName},\n\n` +
    `Thank you for choosing to stay with us! Your reservation is confirmed.\n\n` +
    `📋 *Booking Ref:* ${bookingRef}\n` +
    (roomNumber ? `🛏 *Room:* ${roomNumber} (${roomType || 'Standard'})\n` : '') +
    `📅 *Check-in:* ${checkInDate} (from ${checkIn})\n` +
    `📅 *Check-out:* ${checkOutDate} (by ${checkOut})\n` +
    `💷 *Total Amount:* £${totalAmount.toFixed(2)}\n\n` +
    `📍 *Address:* ${address}\n` +
    `📞 *Reception Phone:* ${phone}\n` +
    (wifi ? `${wifi}\n\n` : '\n') +
    `🚗 Free on-site parking is available for residents. Please let us know if you require early check-in or have any special requests.\n\n` +
    `We look forward to welcoming you soon!\n\n` +
    `Warm regards,\n*The Patten Arms Hotel Team*`
  )
}

export function generatePostStayReviewWhatsAppText({
  guestName,
  bookingRef,
  hotelConfig,
  customReviewLink,
}: {
  guestName: string
  bookingRef: string
  hotelConfig?: {
    name?: string
  }
  customReviewLink?: string
}): string {
  const hotelName = hotelConfig?.name || 'The Patten Arms Hotel'
  const reviewLink = customReviewLink || 'https://g.page/r/pattenarmshotel/review'

  return (
    `🌟 *Thank You for Staying with Us — ${hotelName}*\n\n` +
    `Dear ${guestName},\n\n` +
    `We hope you had a restful and enjoyable stay with us at ${hotelName} (Ref: ${bookingRef})!\n\n` +
    `As an independent historic hotel, your honest feedback means the world to our entire team. Could you take 30 seconds to share your experience with other travellers?\n\n` +
    `⭐ *Leave a Google Review here:*\n${reviewLink}\n\n` +
    `If anything was not 100% to your satisfaction during your stay, please reply directly to this message so our management team can make it right.\n\n` +
    `We hope to welcome you back next time you are visiting Warrington!\n\n` +
    `Warmest regards,\n*The Patten Arms Team*`
  )
}

export function getSavedAddonPresets(): typeof DEFAULT_ADDON_PRESETS {
  if (typeof window === 'undefined') return DEFAULT_ADDON_PRESETS
  const saved = localStorage.getItem('patten_addon_presets')
  if (!saved) return DEFAULT_ADDON_PRESETS
  try {
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ADDON_PRESETS
  } catch (e) {
    return DEFAULT_ADDON_PRESETS
  }
}
