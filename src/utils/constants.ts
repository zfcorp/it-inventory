import type { AssetStatus, Priority, ReplacementStatus } from '../types'

export const ASSET_STATUSES: AssetStatus[] = [
  'Working', 'Available', 'Under Repair',
  'For Replacement', 'Replaced', 'Returned', 'Damaged',
  'Missing', 'Retired', 'Released', 'Disposed'
]

export const STATUS_COLORS: Record<AssetStatus, { bg: string; text: string; dot: string }> = {
  'Working':         { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500' },
  'Available':       { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  'Under Repair':    { bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-500' },
  'For Replacement': { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  'Replaced':        { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  'Returned':        { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  'Damaged':         { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500' },
  'Missing':         { bg: 'bg-pink-100',    text: 'text-pink-800',    dot: 'bg-pink-500' },
  'Retired':         { bg: 'bg-neutral-100', text: 'text-neutral-600', dot: 'bg-neutral-400' },
  'Released':        { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  'Disposed':        { bg: 'bg-zinc-200',    text: 'text-zinc-600',    dot: 'bg-zinc-500' },
}

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  'Low':      { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Medium':   { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'High':     { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Critical': { bg: 'bg-red-100',    text: 'text-red-700' },
}

export const REPLACEMENT_STATUS_COLORS: Record<ReplacementStatus, { bg: string; text: string }> = {
  'Requested':    { bg: 'bg-gray-100',   text: 'text-gray-700' },
  'For Approval': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Approved':     { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'For Purchase': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Purchased':    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'Issued':       { bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  'Completed':    { bg: 'bg-green-100',  text: 'text-green-700' },
}

export const REPLACEMENT_STATUSES: ReplacementStatus[] = [
  'Requested', 'For Approval', 'Approved', 'For Purchase', 'Purchased', 'Issued', 'Completed'
]

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical']

export const CATEGORY_GROUPS = [
  { group: 'Computers', categories: ['Desktop PC', 'Laptop'] },
  { group: 'Network Equipment', categories: ['Router', 'Hub Switch', 'Network Switch', 'Access Point'] },
  { group: 'Printers', categories: ['Printer', 'Multifunction Printer'] },
  { group: 'Displays', categories: ['Monitor'] },
  { group: 'Mobile Devices', categories: ['Company Phone', 'Tablet'] },
  { group: 'Peripherals', categories: [
    'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Docking Station',
    'Laptop Charger', 'Monitor Stand', 'USB Hub', 'HDMI Cable', 'Power Adapter', 'Other'
  ]},
]

export const PESO = '₱'

export const formatPeso = (amount: number | null | undefined): string => {
  if (amount == null) return '—'
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = String(d.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
  '#14b8a6', '#eab308'
]
