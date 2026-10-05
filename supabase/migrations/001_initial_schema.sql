-- ============================================================
-- IT INVENTORY MANAGEMENT SYSTEM — INITIAL SCHEMA
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Branches ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Departments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  branch_id   UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Employees (records only — not system users) ─────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  department_id   UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  email           TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Categories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  type_group  TEXT NOT NULL DEFAULT 'Peripherals',
  is_custom   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Assets (Primary Inventory Table) ────────────────────────
CREATE TABLE IF NOT EXISTS public.assets (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  no                      SERIAL,
  date_acquired           DATE,
  particulars             TEXT NOT NULL,
  asset_id                TEXT NOT NULL UNIQUE,
  serial_no               TEXT,
  cost_per_unit           NUMERIC(12, 2),
  issued_to_employee_id   UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  date_issued             DATE,
  notes                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'Available'
                            CHECK (status IN ('Working','Available','Issued','Under Repair',
                              'For Replacement','Replaced','Returned','Damaged','Missing','Retired')),
  category_id             UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  branch_id               UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  last_maintenance_date   DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_branch ON public.assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_employee ON public.assets(issued_to_employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_id ON public.assets(asset_id);

-- ─── Asset Details (JSONB for category-specific fields) ───────
CREATE TABLE IF NOT EXISTS public.asset_details (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id    UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  detail_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_details_asset ON public.asset_details(asset_id);

-- ─── Asset History (append-only) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_history (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id            UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  changed_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name     TEXT NOT NULL,
  action              TEXT NOT NULL,
  previous_value      TEXT,
  new_value           TEXT,
  employee_id         UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name       TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON public.asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_created ON public.asset_history(created_at DESC);

-- ─── Maintenance Records ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id          UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_date  DATE NOT NULL,
  problem           TEXT NOT NULL,
  diagnosis         TEXT,
  action_taken      TEXT,
  parts_replaced    TEXT,
  technician        TEXT,
  cost              NUMERIC(12, 2),
  result            TEXT NOT NULL DEFAULT 'Resolved'
                      CHECK (result IN ('Resolved','Ongoing','Replaced')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON public.maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON public.maintenance_records(maintenance_date DESC);

-- ─── Replacement Requests ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.replacement_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  problem         TEXT NOT NULL,
  date_reported   DATE NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'Medium'
                    CHECK (priority IN ('Low','Medium','High','Critical')),
  status          TEXT NOT NULL DEFAULT 'Requested'
                    CHECK (status IN ('Requested','For Approval','Approved','For Purchase','Purchased','Issued','Completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replacement_asset ON public.replacement_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_replacement_status ON public.replacement_requests(status);

-- ─── Audit Logs (append-only) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name       TEXT NOT NULL,
  action          TEXT NOT NULL,
  asset_id        TEXT,
  previous_value  TEXT,
  new_value       TEXT,
  details         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);

-- ─── User Profiles (linked to auth.users) ────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','staff','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE public.branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_details     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles     ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- READ: All authenticated users can read all tables
CREATE POLICY "Authenticated read" ON public.branches          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.departments       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.employees         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.categories        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.assets            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.asset_details     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.asset_history     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.maintenance_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.replacement_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.audit_logs        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON public.user_profiles     FOR SELECT USING (auth.role() = 'authenticated');

-- WRITE: Staff and Admin can insert/update most tables
CREATE POLICY "Staff+ write" ON public.assets            FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ update" ON public.assets           FOR UPDATE USING (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ write" ON public.asset_details     FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ update" ON public.asset_details    FOR UPDATE USING (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ write" ON public.employees         FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ update" ON public.employees        FOR UPDATE USING (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ write" ON public.maintenance_records FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ write" ON public.replacement_requests FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','staff'));
CREATE POLICY "Staff+ update" ON public.replacement_requests FOR UPDATE USING (public.get_user_role() IN ('admin','staff'));

-- Audit and history: anyone authenticated can insert (append-only)
CREATE POLICY "Auth insert" ON public.asset_history   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth insert" ON public.audit_logs      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- DELETE: Admin only
CREATE POLICY "Admin delete" ON public.assets         FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.employees      FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.maintenance_records FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.replacement_requests FOR DELETE USING (public.get_user_role() = 'admin');

-- Settings: Admin only write
CREATE POLICY "Admin write" ON public.branches        FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admin update" ON public.branches       FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.branches       FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin write" ON public.departments     FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admin update" ON public.departments    FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.departments    FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin write" ON public.categories      FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admin update" ON public.categories     FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin delete" ON public.categories     FOR DELETE USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin write" ON public.user_profiles   FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "Admin update" ON public.user_profiles  FOR UPDATE USING (public.get_user_role() = 'admin');

-- ─── Seed: Categories ─────────────────────────────────────────
INSERT INTO public.categories (name, type_group, is_custom) VALUES
  -- Computers
  ('Desktop PC',          'Computers',         FALSE),
  ('Laptop',              'Computers',         FALSE),
  -- Network Equipment
  ('Router',              'Network Equipment', FALSE),
  ('Hub Switch',          'Network Equipment', FALSE),
  ('Network Switch',      'Network Equipment', FALSE),
  ('Access Point',        'Network Equipment', FALSE),
  -- Printers
  ('Printer',             'Printers',          FALSE),
  ('Multifunction Printer','Printers',         FALSE),
  -- Displays
  ('Monitor',             'Displays',          FALSE),
  -- Mobile Devices
  ('Company Phone',       'Mobile Devices',    FALSE),
  ('Tablet',              'Mobile Devices',    FALSE),
  -- Peripherals
  ('Keyboard',            'Peripherals',       FALSE),
  ('Mouse',               'Peripherals',       FALSE),
  ('Headset',             'Peripherals',       FALSE),
  ('Webcam',              'Peripherals',       FALSE),
  ('Docking Station',     'Peripherals',       FALSE),
  ('Laptop Charger',      'Peripherals',       FALSE),
  ('Monitor Stand',       'Peripherals',       FALSE),
  ('USB Hub',             'Peripherals',       FALSE),
  ('HDMI Cable',          'Peripherals',       FALSE),
  ('Power Adapter',       'Peripherals',       FALSE),
  ('Other',               'Peripherals',       FALSE)
ON CONFLICT (name) DO NOTHING;

-- ─── Seed: Sample Branches & Departments ─────────────────────
INSERT INTO public.branches (id, name, location) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Main Office', 'Makati, Metro Manila'),
  ('00000000-0000-0000-0000-000000000002', 'Cebu Branch', 'Cebu City'),
  ('00000000-0000-0000-0000-000000000003', 'Davao Branch', 'Davao City')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (name, branch_id) VALUES
  ('Information Technology', '00000000-0000-0000-0000-000000000001'),
  ('Operations',             '00000000-0000-0000-0000-000000000001'),
  ('Finance',                '00000000-0000-0000-0000-000000000001'),
  ('Human Resources',        '00000000-0000-0000-0000-000000000001'),
  ('Sales',                  '00000000-0000-0000-0000-000000000001'),
  ('Marketing',              '00000000-0000-0000-0000-000000000001'),
  ('IT',                     '00000000-0000-0000-0000-000000000002'),
  ('Operations',             '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- HOW TO CREATE THE FIRST ADMIN USER:
--
-- 1. Go to your Supabase project → Authentication → Users
-- 2. Click "Invite user" or "Add user" and set email/password
-- 3. Copy the new user's UUID from the Users list
-- 4. Run this SQL (replace the UUID and email):
--
-- INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
-- VALUES ('YOUR-USER-UUID-HERE', 'admin@yourcompany.com', 'IT Administrator', 'admin', true);
--
-- ============================================================
