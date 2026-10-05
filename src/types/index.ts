// ─── Enums / Unions ───────────────────────────────────────────────────────────

export type AssetStatus =
  | 'Working'
  | 'Available'
  | 'Under Repair'
  | 'For Replacement'
  | 'Replaced'
  | 'Returned'
  | 'Damaged'
  | 'Missing'
  | 'Retired'
  | 'Released'
  | 'Disposed'

export type UserRole = 'admin' | 'staff' | 'viewer'

export type ReplacementStatus =
  | 'Requested'
  | 'For Approval'
  | 'Approved'
  | 'For Purchase'
  | 'Purchased'
  | 'Issued'
  | 'Completed'

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

export type MaintenanceResult = 'Resolved' | 'Ongoing' | 'Replaced' | 'Broken' | 'Retired'

// ─── Database Row Types ────────────────────────────────────────────────────────

export interface Branch {
  id: string
  name: string
  location: string | null
  created_at: string
}

export interface Department {
  id: string
  name: string
  branch_id: string | null
  branches?: Branch
  created_at: string
}

export interface Employee {
  id: string
  name: string
  department_id: string | null
  branch_id: string | null
  email: string | null
  phone: string | null
  departments?: Department
  branches?: Branch
  created_at: string
  asset_count?: number
}

export interface Category {
  id: string
  name: string
  type_group: string
  is_custom: boolean
  created_at: string
}

export interface Asset {
  id: string
  no: number
  date_acquired: string | null
  particulars: string
  asset_id: string
  serial_no: string | null
  cost_per_unit: number | null
  issued_to_employee_id: string | null
  issued_to_branch_id: string | null
  location: string | null              // ← physical location e.g. "Accounting Office"
  date_issued: string | null
  notes: string | null
  status: AssetStatus
  category_id: string | null
  branch_id: string | null
  last_maintenance_date: string | null
  created_at: string
  updated_at: string
  // Joined fields
  employees?: Employee | null
  categories?: Category | null
  branches?: Branch | null
  issued_branch?: Branch | null
}

export interface AssetDetail {
  id: string
  asset_id: string
  detail_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AssetHistory {
  id: string
  asset_id: string
  changed_by_user_id: string | null
  changed_by_name: string
  action: string
  previous_value: string | null
  new_value: string | null
  employee_id: string | null
  employee_name: string | null
  notes: string | null
  created_at: string
}

export interface MaintenanceRecord {
  id: string
  asset_id: string
  maintenance_date: string
  problem: string
  diagnosis: string | null
  action_taken: string | null
  parts_replaced: string | null
  technician: string | null
  cost: number | null
  result: MaintenanceResult
  notes: string | null
  created_at: string
  assets?: Asset
}

export interface ReplacementRequest {
  id: string
  asset_id: string
  employee_id: string | null
  department_id: string | null
  problem: string
  date_reported: string
  priority: Priority
  status: ReplacementStatus
  notes: string | null
  created_at: string
  updated_at: string
  assets?: Asset
  employees?: Employee | null
  departments?: Department | null
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_name: string
  action: string
  asset_id: string | null
  previous_value: string | null
  new_value: string | null
  details: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

// ─── Form / UI Types ──────────────────────────────────────────────────────────

export interface AssetFormData {
  date_acquired: string
  particulars: string
  asset_id: string
  serial_no: string
  cost_per_unit: string
  issued_to_employee_id: string
  date_issued: string
  notes: string
  status: AssetStatus
  category_id: string
  branch_id: string
}

export interface InventoryFilters {
  search: string
  category_id: string
  status: string
  department_id: string
  branch_id: string
  employee_id: string
  date_acquired_from: string
  date_acquired_to: string
  date_issued_from: string
  date_issued_to: string
}

export interface DashboardStats {
  total: number
  working: number
  available: number
  issued: number
  under_repair: number
  for_replacement: number
  replaced: number
  returned: number
  damaged: number
  missing: number
  retired: number
  total_value: number
  working_value: number
  repair_value: number
  replacement_value: number
  replaced_value: number
}

export interface CategoryCount {
  category: string
  count: number
}

export interface DepartmentCount {
  department: string
  count: number
}

export interface StatusCount {
  status: string
  count: number
}
