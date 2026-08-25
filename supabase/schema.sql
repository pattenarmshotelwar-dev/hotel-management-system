-- Hotel Management System - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE room_type AS ENUM ('single', 'double', 'twin_single', 'family');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'dirty', 'cleaning', 'maintenance', 'blocked');
CREATE TYPE booking_source AS ENUM ('booking_com', 'walk_in', 'direct');
CREATE TYPE booking_status AS ENUM ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
CREATE TYPE payment_method AS ENUM ('stripe_card', 'stripe_link', 'cash', 'bank_transfer', 'booking_com_vcc', 'booking_com_payout');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partial_refund');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE cleaning_status AS ENUM ('dirty', 'cleaning', 'clean', 'inspected');

-- =============================================
-- ROOMS TABLE
-- =============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number VARCHAR(10) NOT NULL UNIQUE,
  room_type room_type NOT NULL,
  floor INTEGER DEFAULT 1,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) DEFAULT 'GBP',
  status room_status DEFAULT 'available',
  cleaning_status cleaning_status DEFAULT 'clean',
  ical_import_url TEXT,
  description TEXT,
  max_adults INTEGER DEFAULT 2,
  max_children INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 43 rooms
INSERT INTO rooms (room_number, room_type, floor, base_price, max_adults, max_children) VALUES
-- 16 Single Rooms (101-116)
('101', 'single', 1, 60.00, 1, 0),
('102', 'single', 1, 60.00, 1, 0),
('103', 'single', 1, 60.00, 1, 0),
('104', 'single', 1, 60.00, 1, 0),
('105', 'single', 1, 60.00, 1, 0),
('106', 'single', 1, 60.00, 1, 0),
('107', 'single', 1, 60.00, 1, 0),
('108', 'single', 1, 60.00, 1, 0),
('109', 'single', 1, 60.00, 1, 0),
('110', 'single', 1, 60.00, 1, 0),
('111', 'single', 1, 60.00, 1, 0),
('112', 'single', 1, 60.00, 1, 0),
('113', 'single', 1, 60.00, 1, 0),
('114', 'single', 1, 60.00, 1, 0),
('115', 'single', 1, 60.00, 1, 0),
('116', 'single', 1, 60.00, 1, 0),
-- 15 Double Rooms (201-215)
('201', 'double', 2, 90.00, 2, 0),
('202', 'double', 2, 90.00, 2, 0),
('203', 'double', 2, 90.00, 2, 0),
('204', 'double', 2, 90.00, 2, 0),
('205', 'double', 2, 90.00, 2, 0),
('206', 'double', 2, 90.00, 2, 0),
('207', 'double', 2, 90.00, 2, 0),
('208', 'double', 2, 90.00, 2, 0),
('209', 'double', 2, 90.00, 2, 0),
('210', 'double', 2, 90.00, 2, 0),
('211', 'double', 2, 90.00, 2, 0),
('212', 'double', 2, 90.00, 2, 0),
('213', 'double', 2, 90.00, 2, 0),
('214', 'double', 2, 90.00, 2, 0),
('215', 'double', 2, 90.00, 2, 0),
-- 5 Twin Single Rooms (301-305)
('301', 'twin_single', 3, 85.00, 2, 0),
('302', 'twin_single', 3, 85.00, 2, 0),
('303', 'twin_single', 3, 85.00, 2, 0),
('304', 'twin_single', 3, 85.00, 2, 0),
('305', 'twin_single', 3, 85.00, 2, 0),
-- 7 Family Rooms (401-407)
('401', 'family', 4, 140.00, 2, 2),
('402', 'family', 4, 140.00, 2, 2),
('403', 'family', 4, 140.00, 2, 2),
('404', 'family', 4, 140.00, 2, 2),
('405', 'family', 4, 140.00, 2, 2),
('406', 'family', 4, 140.00, 2, 2),
('407', 'family', 4, 140.00, 2, 2);

-- =============================================
-- GUESTS TABLE
-- =============================================
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  country VARCHAR(100),
  address TEXT,
  id_passport_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BOOKINGS TABLE
-- =============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(50) UNIQUE NOT NULL DEFAULT ('BK-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8))),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  -- Guest info (denormalised for booking.com imports)
  guest_first_name VARCHAR(100) NOT NULL,
  guest_last_name VARCHAR(100) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(30),
  guest_country VARCHAR(100),
  -- Booking details
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  estimated_arrival_time TIME,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  -- Financials
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) DEFAULT 'GBP',
  -- Source & status
  source booking_source DEFAULT 'walk_in',
  status booking_status DEFAULT 'confirmed',
  booking_com_reference VARCHAR(100),
  booking_com_commission DECIMAL(10,2),
  -- Extras
  special_requests TEXT,
  internal_notes TEXT,
  is_ical_imported BOOLEAN DEFAULT false,
  ical_uid TEXT,
  -- Maintenance block
  is_maintenance_block BOOLEAN DEFAULT false,
  maintenance_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX idx_bookings_room_dates ON bookings(room_id, check_in_date, check_out_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_source ON bookings(source);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'GBP',
  method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_receipt_url TEXT,
  reference_number VARCHAR(255),
  -- Booking.com specific
  booking_com_payout_date DATE,
  booking_com_commission DECIMAL(10,2),
  -- Notes
  notes TEXT,
  recorded_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);

-- =============================================
-- CLEANING LOGS TABLE
-- =============================================
CREATE TABLE cleaning_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  cleaner_name VARCHAR(100) NOT NULL,
  status_before cleaning_status,
  status_after cleaning_status DEFAULT 'clean',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cleaning_logs_room ON cleaning_logs(room_id);
CREATE INDEX idx_cleaning_logs_date ON cleaning_logs(completed_at);

-- =============================================
-- MAINTENANCE TICKETS TABLE
-- =============================================
CREATE TABLE maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reported_by VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_room ON maintenance_tickets(room_id);
CREATE INDEX idx_tickets_status ON maintenance_tickets(status);
CREATE INDEX idx_tickets_priority ON maintenance_tickets(priority);

-- =============================================
-- ICAL SYNC LOG TABLE
-- =============================================
CREATE TABLE ical_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) DEFAULT 'import',
  status VARCHAR(20) DEFAULT 'success',
  bookings_added INTEGER DEFAULT 0,
  bookings_updated INTEGER DEFAULT 0,
  bookings_removed INTEGER DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ical_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Authenticated users can read rooms" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read bookings" ON bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read guests" ON guests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read cleaning_logs" ON cleaning_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read tickets" ON maintenance_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read sync_logs" ON ical_sync_logs FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to write data
CREATE POLICY "Authenticated users can insert bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update bookings" ON bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete bookings" ON bookings FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert guests" ON guests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update guests" ON guests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update rooms" ON rooms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cleaning_logs" ON cleaning_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert tickets" ON maintenance_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tickets" ON maintenance_tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sync_logs" ON ical_sync_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON maintenance_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-set room to dirty when booking is checked out
CREATE OR REPLACE FUNCTION handle_checkout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status != 'checked_out' THEN
    UPDATE rooms SET cleaning_status = 'dirty', status = 'available' WHERE id = NEW.room_id;
  END IF;
  IF NEW.status = 'checked_in' AND OLD.status != 'checked_in' THEN
    UPDATE rooms SET status = 'occupied' WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_status_room_update
AFTER UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION handle_checkout();
