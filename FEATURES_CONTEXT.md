# The Patten Arms Hotel — Hotel Management System (PMS)
## Complete Feature Specification & Operational Context

> **System URL:** [https://hotel-management-system-one-lovat.vercel.app](https://hotel-management-system-one-lovat.vercel.app)  
> **Location Focus:** The Patten Arms Hotel, Parker Street, Warrington, WA1 1LS (Opposite Warrington Bank Quay Station)  
> **Core Technology Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL & Auth), Stripe API, Ticketmaster Discovery API, jsPDF, iCal Engine.

---

## 1. Executive Summary

The Patten Arms Hotel Management System is a modern, unified Property Management System (PMS) and Point-of-Sale/Yield Engine engineered specifically for independent and historic hotels. It bridges the gap between daily front-desk reception, automated OTA channel management (Booking.com/Airbnb/Expedia), mobile housekeeping turnover, guest relationship tracking, and dynamic event-based room pricing.

---

## 2. User Roles & Access Architecture

The system provides tailored interfaces for different hotel departments while maintaining role-based access control and security safeguards.

### 2.1 Configured Staff Accounts (Default Password: `password123!`)

| Department / Role | Login Email | Landing Destination | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Manager / Admin** | `manager@pattenarms.co.uk` | `/admin` | Complete access to yield pricing, room inventory, backups, staff settings, financial KPIs, and all modules. |
| **Front of House** | `info@pattenarms.co.uk` | `/frontdesk` | High-speed tablet-optimized reception terminal for guest check-ins, check-outs, key issuance, and walk-in reservations. |
| **Bookings & Reservations** | `bookings@pattenarms.co.uk` | `/admin/bookings` | Booking management, multi-criteria searches, add-ons, payments, and WhatsApp confirmation dispatch. |
| **Housekeeping & Cleaning** | `housekeeping@pattenarms.co.uk` | `/housekeeping` | Dedicated mobile cleaner portal with turnover checklists, urgency alerts, and maintenance reporting. |
| **Accounts & Finance** | `accounts@pattenarms.co.uk` | `/admin/payments` | Full financial ledger, Stripe/card processing, cash/BACS tracking, and CSV audit exports. |
| **Developer** | `dev@uvdigital.co.uk` | `/admin` | Unrestricted maintenance, system diagnostics, and administrative control. |

### 2.2 Security & Inactivity Session Guard
* **Auto-Lock Timeout:** An integrated client-side `SessionGuard` monitors active user engagement (mouse, keyboard, touch events). If a staff member leaves a terminal unattended for **15 minutes**, the session is automatically invalidated, credentials are cleared, and the screen returns to the secure login lock screen.
* **Portal Switcher:** Staff with management access can toggle between **Manager Mode**, **Front Desk Mode**, and **Cleaner App** via the sidebar navigation.

---

## 3. Core Modules & Operational Workflows

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AUTHENTICATION & LOGIN                                │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
┌──────────────────┐               ┌──────────────────┐                ┌──────────────────┐
│  ADMIN DASHBOARD │               │ FRONT DESK MODE  │                │  CLEANER PORTAL  │
│     (/admin)     │               │   (/frontdesk)   │                │  (/housekeeping) │
└───────┬──────────┘               └──────────────────┘                └──────────────────┘
        │
        ├─► Calendar Grid (/admin/calendar)
        ├─► Reservations & Bookings Hub (/admin/bookings)
        ├─► Pricing & Yield Engine (/admin/pricing)
        ├─► Payments & Financial Ledger (/admin/payments)
        ├─► Housekeeping Admin & Tickets (/admin/housekeeping)
        ├─► Guest CRM & VIP Register (/admin/guests)
        ├─► Luggage Tracker (/admin/luggage)
        ├─► Lost & Found Register (/admin/lost-and-found)
        └─► Settings & iCal Sync (/admin/settings)
```

---

### 3.1 Executive Management Dashboard (`/admin`)

The master dashboard gives hoteliers and duty managers an immediate 360-degree pulse on operations:
1. **Real-time Operational KPI Strip:**
   * **Occupancy Percentage:** Calculated dynamically against active inventory (`Occupied / Total Active Rooms * 100`).
   * **Today's Arrivals & Departures:** Real-time counts of incoming guests and scheduled check-outs.
   * **Today's Revenue & RevPAR:** Gross takings and Revenue Per Available Room.
   * **Average Daily Rate (ADR):** Tracked across sold rooms.
   * **Cleanliness Rate:** Percentage of rooms in `clean` or `inspected` status.
   * **Unpaid Balance Alert:** Live sum of all outstanding balances on active bookings.
2. **7-Day Occupancy Forecast Strip:** Interactive day-by-day occupancy bar graph displaying high-demand days, weekend peaks, and forecasted sell-outs.
3. **Action Required Queue:** Automatically highlights overdue departures, rooms requiring immediate cleaning turnover, and open high-priority maintenance tickets.
4. **Live Room Grid:** Color-coded visual matrix of all rooms on ground, first, second, and third floors showing live status (`Available`, `Occupied`, `Dirty`, `Cleaning`, `Maintenance`).

---

### 3.2 Visual Calendar & Gantt Timeline (`/admin/calendar`)

An interactive room-by-room, day-by-day Gantt timeline designed for fast spatial room management:
* **Configurable View Windows:** Toggle between **14 Days**, **30 Days**, or **60 Days** outlooks.
* **Dual Color Coding Modes:**
  * *By Source:* Instantly spot Booking.com (Blue), Direct Bookings (Purple), and Walk-ins (Green).
  * *By Status:* Distinguish Confirmed (Blue), Checked In (Green), and Maintenance Blocks (Orange).
* **Search & Multi-Filter Controls:** Search directly for guest names, room numbers, or booking references without leaving the calendar; filter by floor or room type (`Single`, `Double`, `Twin`, `Family`).
* **Interactive Quick Create:** Click or drag on any vacant cell to open the instant reservation popover (pre-fills room and check-in date).
* **Daily Occupancy Header:** The timeline header displays the total number of occupied rooms for every single day.
* **Quick Sync Trigger:** Button to force an immediate iCal pull across all room channels.

---

### 3.3 Reservations & Bookings Hub (`/admin/bookings`)

The central operational engine for reservations:
1. **Multi-Dimensional Searching & Filtering:**
   * **Text Search:** Live lookup across Guest First Name, Last Name, Email, Phone, Booking Reference, and Notes.
   * **Channel / Source:** Filter by `Booking.com`, `Walk-in`, or `Direct`.
   * **Payment Status:** Filter bookings by `Fully Paid`, `Outstanding Balance`, or `Unpaid`.
   * **Room Type & Floor:** Isolate specific room categories or building floors.
   * **Date Range Shortcuts:** One-click presets for `Today`, `Tomorrow`, `This Week`, `Next 7 Days`, `Next 30 Days`, or custom date bounds.
   * **Active Filter Chips & Reset:** Visual tags for applied filters with 1-click clearance.
2. **Multi-Column Sorting:** Sort bookings by Check-in Date, Check-out Date, Guest Name, Room Number, Total Amount, Outstanding Balance, or Booking Creation Date.
3. **Comprehensive Booking Detail Drawer:**
   * Complete guest profile, contact details, special requests, and room assignment.
   * Full payment audit history (breakdown of card, cash, transfer, and payout receipts).
4. **Add-Ons & Ancillary Services Integration:**
   * Staff can attach hotel extras: Full English Breakfast (£10), Late Check-out (£15), Early Check-in (£15), Overnight Parking (£5), Pet Surcharge (£20), Rollaway Bed (£25), Lost Key Replacement (£25), or Deep Clean/Damage Charge (£50).
   * Automatically appends to `internal_notes` as `[ADDONS]` and recalibrates total stay amounts.
5. **Printable Documents:**
   * **Guest Registration Card:** Formatted printable A4 registration card with hotel terms, room allocation, car registration field, and signature box.
   * **Official PDF Invoice Generator:** Generates a compliant A4 PDF invoice directly in a new tab featuring the hotel crest, VAT calculations (20%), accommodation night breakdown, itemized add-ons, Barclays Bank BACS transfer details, and company registration data.
6. **Automated WhatsApp Guest Communication:**
   * Modal to dispatch pre-formatted WhatsApp messages directly to the guest’s phone via `wa.me`:
     * *Booking Confirmation:* Reference, room number, check-in window, address, and contact numbers.
     * *WiFi & Welcome Packet:* Guest WiFi network name and password, breakfast hours, and reception contact.
     * *Post-Stay Review Request:* Direct Google Review URL for online reputation management.

---

### 3.4 Front Desk Express Terminal (`/frontdesk`)

Built specifically for high-paced reception counters and touchscreens:
* **Today's Operational Tabs:** Fast switching between **Arrivals Today**, **In-House Residents**, and **Departures Today**.
* **1-Click Express Check-In:** Verifies payment balance, collects vehicle registration, assigns room key, and flips booking status to `checked_in`.
* **1-Click Express Check-Out:** Validates zero outstanding balance, flags room as `dirty` for housekeeping, and checks out guest.
* **Instant Walk-In Booking:** Rapid booking modal that takes guest name, room selection, payment method (Cash / Card / Link), and completes check-in in under 30 seconds.
* **Key Card / Fob Assignment:** Quick visual indicator of assigned keys.

---

### 3.5 Pricing, Yield & Warrington Event Radar (`/admin/pricing`)

A dynamic revenue management tool tailored to Warrington's hospitality market:
1. **Dynamic Yield Multipliers:**
   * Set baseline weekend vs midweek pricing adjustments (e.g. +20% on Friday/Saturday).
   * Minimum stay restrictions for peak periods.
2. **Warrington Live Event Radar:**
   * Automatically calculates dates and demand surges for local high-volume events:
     * *Warrington Wolves Super League Matches* at Halliwell Jones Stadium (0.8 miles).
     * *Parr Hall Live Comedy & Concerts* (0.4 miles).
     * *Birchwood Park Nuclear & Tech Corporate Expos* (3.5 miles).
     * *Creamfields Festival* (Bank Holiday August, 4.5 miles — triggers 2x–3x rate surges).
     * *Haydock Park Races* (7.5 miles).
3. **Ticketmaster Discovery API Integration:**
   * Live scanning of real concerts, theater, and sporting events within a 20-mile radius of postcode **WA1 1LS**.
   * Hoteliers can toggle event surge rates (+15%, +25%, +50%) with 1-click, instantly updating room rack rates.
4. **OTA Margin Compensation Calculator:**
   * Automatically calculates the +15% rate markup required on Booking.com so that net revenue matches direct direct-booking profits after OTA commission deduction.
   * Exportable pricing schedule for channel managers.

---

### 3.6 Payments & Financial Ledger (`/admin/payments`)

An accounting hub capturing all money in and out:
1. **Multi-Method Payment Support:**
   * `stripe_card` (In-person or terminal card charge)
   * `stripe_link` (Hosted Stripe checkout link sent via SMS/WhatsApp/Email)
   * `cash` (Front-desk cash drawer with receipt notes)
   * `bank_transfer` (Direct BACS transfer to Barclays business account)
   * `booking_com_vcc` (Virtual Credit Card supplied by OTA)
   * `booking_com_payout` (Direct bank payout from Booking.com)
2. **Financial Aggregations & KPIs:**
   * Real-time calculation of Total Revenue, Stripe Revenue, Booking.com Payouts, Cash/Offline Takings, Today's Takings, and Average Transaction Value.
3. **Transaction Search & Filtering:** Filter by payment method, status (`succeeded`, `pending`, `refunded`, `failed`), amount range (min/max), and date presets.
4. **Payment Receipts & Invoicing:**
   * Instant modal to issue printable payment receipts with transaction IDs.
   * Generates official VAT invoices linked directly to the parent reservation.
5. **CSV Accounting Export:** One-click export of filtered transaction logs for bookkeeping and accountant audits.

---

### 3.7 Housekeeping & Maintenance (`/admin/housekeeping` & `/housekeeping`)

A dual-tier turnover ecosystem ensuring rooms are rapidly cleaned and inspected:

#### A. Administrative Housekeeping (`/admin/housekeeping`)
* **Room Matrix Overview:** Track all rooms categorized into `Dirty`, `Cleaning`, `Clean`, and `Inspected`.
* **Turnaround Urgency Flag:** Rooms with incoming arrivals scheduled *today* are automatically marked with an animated high-priority badge (`Arrival Today`) to prioritize cleaning queues.
* **Bulk Actions:** 1-click button to mark an entire floor as clean.
* **Maintenance Ticketing Board:**
  * Log tickets with severity (`Low`, `Medium`, `High`, `Urgent`), category (Plumbing, Electrical, Heating, Furniture, Linen), assigned room, description, and photos.
  * Resolving tickets updates room maintenance status automatically.
* **Cleaner WhatsApp Dispatch:** Dispatches automated room turnover alerts to cleaners' WhatsApp phones with room numbers, floor locations, and portal links.

#### B. Dedicated Cleaner Mobile App (`/housekeeping`)
* High-contrast, mobile-friendly interface designed for smartphones/tablets.
* Displays assigned dirty rooms ordered by arrival urgency.
* **Turnover Checklist:** Step-by-step room turnover verification covering:
  * *Bedroom Area:* Mattress inspection, fresh protector, crisp bed sheets, plumped pillows, bedside lamps, curtains.
  * *Bathroom & Towels:* Bath towels (2x per double), hand towels, bath mat, toilet paper stock, sanitized drinking glasses.
  * *Toiletries & Supplies:* Shampoo, body wash, hand soap, tea/coffee hospitality tray replenishment.
  * *Sanitization:* High-touch surfaces, door handles, remote controls, trash bin liners, vacuuming.

---

### 3.8 Guest CRM & VIP Register (`/admin/guests`)

A relationship management database storing guest history:
* **Guest Directory:** Consolidated profiles aggregated from bookings and direct registrations.
* **Lifetime Statistics:** Tracks lifetime revenue spent at the hotel, total completed stays, and date of last visit.
* **VIP & Blacklist Tagging:**
  * Star guests as **VIP** to ensure front desk offers complimentary upgrades or welcome amenities.
  * Flag disruptive guests as **Blacklisted / Caution** with documented incident reasons to prevent re-booking.
* **Car Park & Vehicle Registration:** Stores vehicle registration plates to verify authorized parking on hotel grounds.
* **Nationality & Spend Tier Filtering:** Segment guests by country of origin or lifetime spend tier (VIP >£500, Mid >£150, Budget).

---

### 3.9 Luggage Storage Tracker (`/admin/luggage`)

A physical baggage holding register for early arrivals and post-checkout station travelers:
* Assigns unique storage tag numbers (`BAG-101`, `BAG-102`, etc.).
* Records guest name, room number, bag count, storage location (Front Desk Cupboard / Safe), and notes.
* Generates a printable baggage claim stub to hand to the guest.
* Status tracking (`Stored` -> `Collected`).

---

### 3.10 Lost & Found Property Register (`/admin/lost-and-found`)

Compliance register for items left behind in guest rooms:
* Logs item description, category (Electronics, Clothing, Keys, Documents, Jewelry), room number found, finder name, and storage bin.
* **1-Click Guest WhatsApp Notification:** Automatically composes a friendly message to the guest stating their item has been safely secured and detailing collection/postage options.
* Claim logging records the collector's name, ID verification, and timestamp.

---

### 3.11 System Settings & Integrations (`/admin/settings`)

Central configuration management:
1. **Hotel Business Profile:** Edit hotel trading name, address, phone numbers, contact email, WiFi SSID/passwords, standard check-in time (15:00), and check-out time (11:00).
2. **Room Inventory Management:**
   * Create new rooms with floor, room type, base rack rate, max adults, and max children.
   * Edit existing room prices or deactivate rooms undergoing refurbishment.
   * **Safe Deletion & Cascade Protection:** If a room has linked reservations, the system blocks accidental deletion with a conflict warning, offering either an inactive toggle or an intentional force-cascade delete.
3. **Two-Way iCal Channel Synchronization:**
   * Configure outbound iCal feed URL for Booking.com, Airbnb, or Vrbo (`/api/ical/export/[roomId]`).
   * Store inbound OTA iCal feed URLs per room.
   * Automated cron and manual "Sync All Feeds" button using `node-ical` to import bookings, generate references, and log sync results.
4. **WhatsApp Settings Tab:**
   * Configure default country code (`+44`) and default staff numbers (Cleaner, Maintenance, Reception).
   * Full template editor for Confirmation, Check-in WiFi, Checkout Review, Cleaner Turnover, and Maintenance alerts.
5. **Database Backup:** 1-click export of the complete database (rooms, reservations, guests, tickets, logs) as a timestamped JSON snapshot.

---

## 4. Database Schema Overview (PostgreSQL)

The database schema is hosted on Supabase (PostgreSQL) and structured as follows:

```
┌──────────────────┐       1:N       ┌──────────────────┐
│      rooms       │────────────────►│     bookings     │
└────────┬─────────┘                 └────────┬─────────┘
         │ 1:N                                │ 1:N
         │                                    │
         ├──────────────────┐                 ├──────────────────┐
         │                  │                 │                  │
         ▼                  ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐
│  cleaning_logs   │ │ maint_ticket │ │     payments     │ │    guests    │
└──────────────────┘ └──────────────┘ └──────────────────┘ └──────────────┘
```

1. **`rooms`**: `id` (UUID), `room_number`, `room_type` (single/double/twin_single/family), `floor`, `base_price`, `currency`, `status`, `cleaning_status`, `ical_import_url`, `is_active`.
2. **`bookings`**: `id` (UUID), `booking_reference` (Unique), `room_id` (FK), `guest_first_name`, `guest_last_name`, `guest_email`, `guest_phone`, `check_in_date`, `check_out_date`, `adults`, `children`, `total_amount`, `source` (booking_com/walk_in/direct), `status` (confirmed/checked_in/checked_out/cancelled), `internal_notes` (including add-ons).
3. **`guests`**: `id` (UUID), `first_name`, `last_name`, `email`, `phone`, `country`, `address`, `id_passport_number`, `notes`.
4. **`payments`**: `id` (UUID), `booking_id` (FK), `amount`, `currency`, `method` (stripe_card/stripe_link/cash/bank_transfer/booking_com_vcc/booking_com_payout), `status` (succeeded/pending/failed/refunded), `stripe_payment_intent_id`, `reference_number`.
5. **`cleaning_logs`**: `id` (UUID), `room_id` (FK), `cleaner_name`, `status_before`, `status_after`, `started_at`, `completed_at`, `notes`.
6. **`maintenance_tickets`**: `id` (UUID), `room_id` (FK), `reported_by`, `title`, `description`, `priority` (low/medium/high/urgent), `status` (open/in_progress/resolved), `resolved_by`, `resolution_notes`.
7. **`ical_sync_logs`**: `id` (UUID), `room_id` (FK), `sync_type`, `status`, `bookings_added`, `bookings_updated`, `error_message`, `synced_at`.

---

## 5. Third-Party Integrations

1. **Supabase / PostgreSQL:** Provides cloud database storage, real-time updates, relational integrity, and JWT-authenticated session handling.
2. **Stripe API:** Handles secure debit/credit card payments, payment link generation, and automated webhook reconciliation (`/api/payments/webhook`).
3. **Ticketmaster Discovery API:** Scans upcoming live concerts, sports fixtures, and festivals in the Warrington/Cheshire region to fuel dynamic yield surge pricing.
4. **WhatsApp Business Direct Link Protocol:** Enables 1-click messaging without costly third-party WhatsApp BSP subscription fees by leveraging sanitized `https://wa.me/` dispatch links.
5. **iCal Protocol (RFC 5545):** Standard calendar exchange format syncing reservations bidirectionally between the PMS and Online Travel Agencies (OTAs).
6. **jsPDF:** Client and server-side PDF generation producing pixel-perfect official branded invoices and folios.

---

## 6. Development & Deployment Guide

### Local Development
```bash
# Install dependencies
npm install

# Start local Next.js development server
npm run dev
# Server accessible at http://localhost:3000
```

### Production Deployment
The repository is continuously deployed to **Vercel** via GitHub integration:
* **Branch:** `main`
* **Vercel Production Domain:** `https://hotel-management-system-one-lovat.vercel.app`
* **Build Command:** `next build`
* **Environment Configuration:**
  * `NEXT_PUBLIC_SUPABASE_URL`
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  * `SUPABASE_SERVICE_ROLE_KEY`
  * `NEXT_PUBLIC_APP_URL`
  * `STRIPE_SECRET_KEY`
  * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  * `STRIPE_WEBHOOK_SECRET`
  * `NEXT_PUBLIC_TICKETMASTER_API_KEY`
