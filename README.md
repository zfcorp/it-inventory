# IT Inventory Management System

A professional internal IT Inventory and Asset Management System for company IT departments.

## Features

- **Dashboard** — Summary cards, charts by category/status/department, inventory value, alerts
- **Inventory** — Spreadsheet-style table with add/edit/delete, status badges, pagination
- **Asset Detail Profiles** — Category-specific technical details (computer specs, IMEI, IP, etc.)
- **Employee Management** — Employee directory, assign/return assets, equipment profile
- **Maintenance Tracking** — Full repair log with costs, technician, result tracking
- **Replacement Tracking** — Workflow from Requested → Approved → Completed
- **Reports** — 22 pre-built reports exportable to Excel, CSV, and PDF (print)
- **Import/Export** — Bulk import via Excel/CSV with validation preview
- **Audit Log** — Immutable action log for all inventory changes
- **User Management** — IT Admin, IT Staff, Management/Viewer roles
- **Settings** — Manage branches, departments, and categories
- **Multi-branch support** — Track assets across multiple office locations
- **Philippine Peso (₱)** currency throughout

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend/DB/Auth:** Supabase (PostgreSQL + Row Level Security)
- **UI:** Tailwind CSS + Lucide React icons
- **Charts:** Recharts
- **Export:** SheetJS (xlsx)

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it (e.g., `it-inventory`), set a database password, choose a region close to your office
3. Wait for the project to be ready (~1 minute)

### 2. Run the Database Migration

1. In your Supabase project, go to **SQL Editor**
2. Open the file: `supabase/migrations/001_initial_schema.sql`
3. Paste the entire contents into the SQL Editor
4. Click **Run** — this creates all tables, indexes, RLS policies, and seeds the default categories

### 3. Create the First Admin User

1. In Supabase → **Authentication** → **Users** → **Add user**
2. Enter the admin's email and password, click **Create user**
3. Copy the new user's **UUID** from the Users list
4. Go back to **SQL Editor** and run:

```sql
INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
VALUES (
  'PASTE-USER-UUID-HERE',
  'admin@yourcompany.com',
  'IT Administrator',
  'admin',
  true
);
```

### 4. Configure Environment Variables

1. In your Supabase project → **Settings** → **API**
2. Copy the **Project URL** and **anon/public key**
3. Create a `.env` file in the project root (copy from `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install and Run

```bash
cd it-inventory
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — log in with the admin credentials you created.

---

## Deployment (Vercel)

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
3. Set the **Root Directory** to `it-inventory` (if not at repo root)
4. Add environment variables:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**

---

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access: inventory, employees, maintenance, replacement, reports, audit log, users, settings |
| **Staff** | Add/edit inventory, issue equipment, log maintenance, create replacement requests, generate reports |
| **Viewer** | Read-only: dashboard, inventory, reports (for management) |

To create additional users: log in as Admin → **Users** → **Add User**

---

## Project Structure

```
src/
  App.tsx                    # Routes and providers
  main.tsx                   # Entry point
  contexts/
    AuthContext.tsx           # Auth + role state
  components/
    layout/                  # Sidebar, Header, Layout
    ui/                      # Modal, Toast, StatusBadge, etc.
    AssetFormModal.tsx        # Add/Edit asset form
    ImportModal.tsx           # Excel/CSV import
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    InventoryPage.tsx
    AssetDetailPage.tsx
    EmployeesPage.tsx
    EmployeeProfilePage.tsx
    MaintenancePage.tsx
    ReplacementPage.tsx
    ReportsPage.tsx
    AuditLogPage.tsx
    UsersPage.tsx
    SettingsPage.tsx
  lib/
    supabase.ts               # Supabase client
  types/
    index.ts                  # All TypeScript types
  utils/
    constants.ts              # Status colors, formatters
    export.ts                 # Excel/CSV export helpers
    auditLogger.ts            # Audit log helper
supabase/
  migrations/
    001_initial_schema.sql    # Full DB schema + seed data
```

---

## Import Template

Download the import template from the Inventory page toolbar (Template button).

Required columns: `Particulars`, `ID`

Optional columns: `Date Acquired`, `Serial No.`, `Cost Per Unit`, `Issued To`, `Date Issued`, `Notes`, `Status`, `Category`, `Branch`

---

## Notes

- The `no` column in the inventory table auto-increments globally (not per-category) via PostgreSQL SERIAL
- Asset IDs must be unique system-wide (e.g., `LAP-001`, `MON-015`, `PH-008`)
- Employees are records only — they do NOT have system login accounts
- The audit log and asset history are append-only (no records are deleted)
- PDF export uses browser print — click the Print button on any report page and use "Save as PDF"
