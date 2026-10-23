-- ==========================================================================
-- SIANTRI - Supabase PostgreSQL Schema & Initial Data
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==========================================================================

-- 1. Table Settings
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    institution_name TEXT NOT NULL DEFAULT 'KANTOR PELAYANAN TERPADU SATU PINTU (PTSP)',
    institution_address TEXT DEFAULT 'Jl. Pemuda No. 45, Kompleks Perkantoran Pemerintah',
    running_text TEXT DEFAULT 'Selamat datang di Sistem Antrean Terpadu (SIANTRI). Mohon perhatikan nomor antrean dan loket pelayanan Anda. Layanan buka Senin - Jumat pukul 08:00 - 15:30 WIB.',
    daily_reset_time VARCHAR(10) DEFAULT '00:00',
    last_reset_date DATE DEFAULT CURRENT_DATE,
    voice_speed NUMERIC DEFAULT 1.0,
    voice_pitch NUMERIC DEFAULT 1.0,
    chime_sound BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table Services (Master Layanan)
CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(5) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avg_duration INTEGER DEFAULT 10,
    color VARCHAR(20) DEFAULT '#2563eb',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table Users (Admin & Petugas Loket)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    assigned_counter_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table Counters (Master Loket)
CREATE TABLE IF NOT EXISTS counters (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    service_ids JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    current_ticket_id VARCHAR(50),
    assigned_staff_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table Tickets (Transaksi Antrean)
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(50) PRIMARY KEY,
    ticket_code VARCHAR(20) NOT NULL,
    number INTEGER NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    service_code VARCHAR(5) NOT NULL,
    service_name TEXT NOT NULL,
    customer_name TEXT,
    customer_phone VARCHAR(30),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    call_time TIMESTAMPTZ,
    complete_time TIMESTAMPTZ,
    counter_id VARCHAR(50),
    counter_name VARCHAR(50),
    staff_id VARCHAR(50),
    staff_name TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, calling, serving, completed, skipped, cancelled
    notes TEXT
);

-- 6. Table Calling History (Riwayat Panggilan Monitor)
CREATE TABLE IF NOT EXISTS calling_history (
    id BIGSERIAL PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    ticket_code VARCHAR(20) NOT NULL,
    service_name TEXT,
    counter_id VARCHAR(50),
    counter_name VARCHAR(50),
    staff_name TEXT,
    time TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast queue lookups
CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(date);
CREATE INDEX IF NOT EXISTS idx_tickets_service ON tickets(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);

-- Enable Row Level Security (RLS) & Allow Public / Anon Access for demo simplicity
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE calling_history ENABLE ROW LEVEL SECURITY;

-- Create Policies to allow full access with anon/service key
DROP POLICY IF EXISTS "Public settings access" ON settings;
CREATE POLICY "Public settings access" ON settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public services access" ON services;
CREATE POLICY "Public services access" ON services FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public counters access" ON counters;
CREATE POLICY "Public counters access" ON counters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public users access" ON users;
CREATE POLICY "Public users access" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public tickets access" ON tickets;
CREATE POLICY "Public tickets access" ON tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public calling_history access" ON calling_history;
CREATE POLICY "Public calling_history access" ON calling_history FOR ALL USING (true) WITH CHECK (true);

-- ==========================================================================
-- DATA AWAL (SEED DATA)
-- ==========================================================================

-- Seed Settings
INSERT INTO settings (id, institution_name, institution_address, running_text, daily_reset_time, last_reset_date, voice_speed, voice_pitch, chime_sound)
VALUES (
    'main',
    'KANTOR PELAYANAN TERPADU SATU PINTU (PTSP)',
    'Jl. Pemuda No. 45, Kompleks Perkantoran Pemerintah',
    'Selamat datang di Sistem Antrean Terpadu (SIANTRI). Mohon perhatikan nomor antrean dan loket pelayanan Anda. Layanan buka Senin - Jumat pukul 08:00 - 15:30 WIB.',
    '00:00',
    CURRENT_DATE,
    1.0,
    1.0,
    true
)
ON CONFLICT (id) DO NOTHING;

-- Seed Services
INSERT INTO services (id, code, name, description, avg_duration, color, active)
VALUES 
    ('srv-1', 'A', 'Layanan Kependudukan & KTP', 'Perekaman KTP-el, KK, Akta Kelahiran, dan Surat Pindah', 7, '#2563eb', true),
    ('srv-2', 'B', 'Layanan Pajak & Retribusi Daerah', 'Pembayaran PBB, BPHTB, PKB, dan Retribusi Usaha', 10, '#059669', true),
    ('srv-3', 'C', 'Layanan Perizinan & OSS Usaha', 'Izin Usaha NIB, IMB/PBG, Reklame, dan Izin Lingkungan', 12, '#d97706', true),
    ('srv-4', 'D', 'Layanan Customer Service & Aduan', 'Informasi umum, konsultasi berkas, dan layanan pengaduan', 5, '#7c3aed', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Users
INSERT INTO users (id, username, password, name, role, assigned_counter_id)
VALUES 
    ('usr-1', 'admin', 'admin123', 'Administrator Utama', 'admin', NULL),
    ('usr-2', 'petugas1', 'petugas123', 'Ahmad Fauzi', 'staff', 'cnt-1'),
    ('usr-3', 'petugas2', 'petugas123', 'Siti Rahma', 'staff', 'cnt-2'),
    ('usr-4', 'petugas3', 'petugas123', 'Budi Santoso', 'staff', 'cnt-3'),
    ('usr-5', 'petugas4', 'petugas123', 'Dewi Lestari', 'staff', 'cnt-4')
ON CONFLICT (id) DO NOTHING;

-- Seed Counters
INSERT INTO counters (id, name, service_ids, status, current_ticket_id, assigned_staff_id)
VALUES 
    ('cnt-1', 'Loket 1', '["srv-1"]'::jsonb, 'active', NULL, 'usr-2'),
    ('cnt-2', 'Loket 2', '["srv-1", "srv-4"]'::jsonb, 'active', NULL, 'usr-3'),
    ('cnt-3', 'Loket 3', '["srv-2"]'::jsonb, 'active', NULL, 'usr-4'),
    ('cnt-4', 'Loket 4', '["srv-3"]'::jsonb, 'active', NULL, 'usr-5')
ON CONFLICT (id) DO NOTHING;
