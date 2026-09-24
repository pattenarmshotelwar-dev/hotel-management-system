export interface WhatsAppTemplate {
  id: string
  name: string
  target: 'guest' | 'staff'
  trigger: string
  enabled: boolean
  template: string
  description: string
}

export interface WhatsAppSettings {
  defaultCountryCode: string
  cleanerPhone: string
  maintenancePhone: string
  frontDeskPhone: string
  autoDispatchMode: 'direct' | 'api'
  twilioAccountSid?: string
  twilioAuthToken?: string
  twilioWhatsAppNumber?: string
  templates: WhatsAppTemplate[]
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl_booking_confirm',
    name: 'Booking Confirmation',
    target: 'guest',
    trigger: 'Sent when reservation is created or confirmed',
    enabled: true,
    description: 'Welcome message with reservation reference, dates, check-in window, and hotel contact details.',
    template: `🏨 *Patten Arms Hotel — Booking Confirmation*

Dear {guest_name},
Thank you for choosing Patten Arms Hotel! Your reservation is confirmed:

• *Booking Reference:* {booking_reference}
• *Room:* {room_number} ({room_type})
• *Check-in Date:* {check_in_date} from {check_in_time}
• *Check-out Date:* {check_out_date} until {check_out_time}
• *Total Stay Rate:* £{total_amount}
• *Hotel Address:* {hotel_address} (directly opposite Warrington Bank Quay Station)

If you need car parking, early check-in, or travel assistance, simply reply to this message or call {hotel_phone}. We look forward to welcoming you!`,
  },
  {
    id: 'tpl_checkin_wifi',
    name: 'Check-In & WiFi Welcome',
    target: 'guest',
    trigger: 'Sent upon guest check-in at reception',
    enabled: true,
    description: 'Instant welcome packet with WiFi network credentials, check-out time, and front desk contact.',
    template: `👋 *Welcome to Patten Arms Hotel!*

Dear {guest_name}, welcome to Room {room_number}!

📶 *Complimentary High-Speed Guest WiFi:*
• Network: *{wifi_network}*
• Password: *{wifi_password}*

🕒 *Hotel Essentials:*
• Check-out Time: by {check_out_time}
• Front Desk: Dial 0 from your room or message us on WhatsApp: {hotel_phone}
• Hot Breakfast: Served Mon–Fri 07:00–09:30, Sat–Sun 08:00–10:30

Please let reception know if you require anything during your stay. Enjoy Warrington!`,
  },
  {
    id: 'tpl_checkout_review',
    name: 'Checkout & Google Review Request',
    target: 'guest',
    trigger: 'Sent upon check-out',
    enabled: true,
    description: 'Courteous thank you note inviting the guest to rate their stay on Google Maps.',
    template: `🌟 *Thank You for Staying with Us!*

Dear {guest_name},
We hope you had a restful stay in Room {room_number} at Patten Arms Hotel.

If you enjoyed our hospitality and central location, would you mind taking 30 seconds to leave us a quick Google review? It makes a huge difference to our independent hotel team:
👉 {google_review_link}

Thank you again, and we wish you safe onward travels!`,
  },
  {
    id: 'tpl_cleaner_turnover',
    name: 'Housekeeping Turnover Alert',
    target: 'staff',
    trigger: 'Sent to cleaners when a room checks out or is marked dirty',
    enabled: true,
    description: 'Instant notification dispatched to cleaner with room number, floor, urgency, and live portal link.',
    template: `🧹 *HOUSEKEEPING TURNOVER ALERT*

Room *{room_number}* ({room_type}, Floor {floor}) has checked out and is ready for cleaning turnover.

• *Urgency:* {urgency_level}
• *Assigned Floor:* Floor {floor}
• *Tap to Update Status:* {cleaning_portal_link}`,
  },
  {
    id: 'tpl_maintenance_alert',
    name: 'Urgent Maintenance Ticket Alert',
    target: 'staff',
    trigger: 'Sent when high/urgent maintenance ticket is logged',
    enabled: true,
    description: 'Alert dispatched to maintenance technician for quick repairs and leak/electrical issues.',
    template: `⚠️ *HOTEL MAINTENANCE ALERT*

A high-priority maintenance ticket has been logged:

• *Location:* Room {room_number} (Floor {floor})
• *Priority:* 🚨 {ticket_priority}
• *Reported Issue:* {maintenance_issue}
• *Action Required:* Inspect and resolve ASAP`,
  },
]

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  defaultCountryCode: '+44',
  cleanerPhone: '+44 7700 900123',
  maintenancePhone: '+44 7700 900456',
  frontDeskPhone: '+44 1925 650144',
  autoDispatchMode: 'direct',
  templates: DEFAULT_WHATSAPP_TEMPLATES,
}

// Clean phone number into international WhatsApp E.164-compatible format (e.g. 07700900123 -> 447700900123)
export function sanitizeWhatsAppPhone(phone: string, defaultCode = '44'): string {
  if (!phone) return ''
  let cleaned = phone.replace(/[^0-9+]/g, '')
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  } else if (cleaned.startsWith('0')) {
    cleaned = defaultCode.replace('+', '') + cleaned.substring(1)
  }
  return cleaned
}

// Format template with variable substitutions
export function formatWhatsAppTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  let result = template
  Object.entries(vars).forEach(([key, val]) => {
    const replacement = val !== undefined && val !== null ? String(val) : ''
    result = result.replaceAll(`{${key}}`, replacement)
  })
  return result
}

// Generate direct wa.me link
export function createWhatsAppDispatchUrl(phone: string, message: string, defaultCode = '44'): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone, defaultCode)
  const encodedMsg = encodeURIComponent(message.trim())
  if (!cleanPhone) {
    // If no phone provided, generates generic WhatsApp share link
    return `https://wa.me/?text=${encodedMsg}`
  }
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`
}

// Retrieve from localStorage or fallback
export function getSavedWhatsAppSettings(): WhatsAppSettings {
  if (typeof window === 'undefined') return DEFAULT_WHATSAPP_SETTINGS
  try {
    const raw = localStorage.getItem('patten_whatsapp_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_WHATSAPP_SETTINGS,
        ...parsed,
        templates: Array.isArray(parsed.templates) && parsed.templates.length > 0 
          ? parsed.templates 
          : DEFAULT_WHATSAPP_TEMPLATES,
      }
    }
  } catch (e) {
    console.error('Failed to parse saved WhatsApp settings:', e)
  }
  return DEFAULT_WHATSAPP_SETTINGS
}

// Save to localStorage
export function saveWhatsAppSettings(settings: WhatsAppSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('patten_whatsapp_settings', JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save WhatsApp settings:', e)
  }
}
