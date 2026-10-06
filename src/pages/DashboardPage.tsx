import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Package, CheckCircle, Monitor, RefreshCw, Wrench,
  AlertTriangle, XCircle, AlertCircle, TrendingUp,
  ArrowUpRight, Activity, Boxes, Layers, X, ExternalLink
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPeso, formatDate, CHART_COLORS } from '../utils/constants'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatusBadge from '../components/ui/StatusBadge'
import type { AssetStatus } from '../types'

interface Stats {
  total: number
  byStatus: Record<string, number>
  byCategory: { category: string; count: number }[]
  byDepartment: { department: string; count: number }[]
  totalValue: number
  valueByStatus: Record<string, number>
}

interface AlertDef {
  type: 'warning' | 'error' | 'info'
  message: string
  count: number
  queryKey: string   // used to fetch detail rows
}

interface AlertAsset {
  id: string
  asset_id: string
  particulars: string
  status: AssetStatus
  serial_no: string | null
  employee_name: string | null
  location: string | null
  date_acquired: string | null
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: number | string; icon: React.ReactNode
  gradient: string; iconBg: string; onClick?: () => void
}> = ({ label, value, icon, gradient, iconBg, onClick }) => (
  <div onClick={onClick} className={`relative overflow-hidden rounded-2xl p-5 border border-white/60 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${gradient}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-sm font-bold text-blue-600">{payload[0].value} items</p>
      </div>
    )
  }
  return null
}

// ─── Alert Detail Drawer ─────────────────────────────────────────────────────
const AlertDrawer: React.FC<{
  alert: AlertDef | null
  onClose: () => void
  onViewAsset: (id: string) => void
}> = ({ alert, onClose, onViewAsset }) => {
  const [rows, setRows] = useState<AlertAsset[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!alert) return
    setLoading(true)
    const fetch = async () => {
      let q = supabase
        .from('assets')
        .select('id, asset_id, particulars, status, serial_no, location, date_acquired, employees(name)')
        .order('particulars')
        .limit(100)

      switch (alert.queryKey) {
        case 'for-replacement': q = q.eq('status', 'For Replacement'); break
        case 'under-repair':    q = q.eq('status', 'Under Repair'); break
        case 'available':       q = q.eq('status', 'Available'); break
        case 'damaged':         q = q.eq('status', 'Damaged'); break
        case 'missing':         q = q.eq('status', 'Missing'); break
        case 'missing-serial':  q = q.is('serial_no', null); break
        default: break
      }

      const { data } = await q
      setRows(
        (data || []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          asset_id: a.asset_id as string,
          particulars: a.particulars as string,
          status: a.status as AssetStatus,
          serial_no: a.serial_no as string | null,
          location: a.location as string | null,
          date_acquired: a.date_acquired as string | null,
          employee_name: (a.employees as { name: string } | null)?.name || null,
        }))
      )
      setLoading(false)
    }
    fetch()
  }, [alert])

  if (!alert) return null

  const typeColors = {
    error:   'text-red-600 bg-red-50 border-red-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    info:    'text-blue-600 bg-blue-50 border-blue-200',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-right">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100`}>
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${typeColors[alert.type]}`}>
              {alert.count} items
            </div>
            <h2 className="text-base font-bold text-gray-900">{alert.message}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No items found</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rows.map((a, i) => (
                <div key={a.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
                  {/* Number */}
                  <span className="text-xs text-gray-300 font-mono w-5 pt-0.5 flex-shrink-0">{i + 1}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {a.asset_id || <span className="text-amber-500 italic">No ID</span>}
                      </span>
                      <StatusBadge status={a.status} size="sm" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{a.particulars}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {a.employee_name && (
                        <span className="text-xs text-gray-500">👤 {a.employee_name}</span>
                      )}
                      {a.location && (
                        <span className="text-xs text-gray-500">📍 {a.location}</span>
                      )}
                      {a.serial_no && (
                        <span className="text-xs text-gray-400 font-mono">SN: {a.serial_no}</span>
                      )}
                      {!a.serial_no && alert.queryKey === 'missing-serial' && (
                        <span className="text-xs text-amber-500 font-semibold">⚠ Serial number missing</span>
                      )}
                      {a.date_acquired && (
                        <span className="text-xs text-gray-400">{formatDate(a.date_acquired)}</span>
                      )}
                    </div>
                  </div>

                  {/* View button */}
                  <button
                    onClick={() => { onViewAsset(a.id); onClose() }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex-shrink-0"
                    title="View asset"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Click any row's → icon to open the full asset profile
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Department Detail Drawer ────────────────────────────────────────────────
const DeptDrawer: React.FC<{
  department: string | null
  onClose: () => void
  onViewAsset: (id: string) => void
}> = ({ department, onClose, onViewAsset }) => {
  const [rows, setRows] = useState<AlertAsset[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!department) return
    setLoading(true)
    const fetch = async () => {
      // Get department id first
      const { data: deptData } = await supabase
        .from('departments').select('id').ilike('name', department).single()

      let q = supabase
        .from('assets')
        .select('id, asset_id, particulars, status, serial_no, location, date_acquired, employees(name)')
        .order('particulars')
        .limit(200)

      if (deptData) {
        // Get employees in this department
        const { data: emps } = await supabase
          .from('employees').select('id').eq('department_id', (deptData as { id: string }).id)
        const empIds = (emps || []).map((e: { id: string }) => e.id)
        if (empIds.length > 0) {
          q = q.in('issued_to_employee_id', empIds)
        } else {
          setRows([]); setLoading(false); return
        }
      }

      const { data } = await q
      setRows(
        (data || []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          asset_id: a.asset_id as string,
          particulars: a.particulars as string,
          status: a.status as AssetStatus,
          serial_no: a.serial_no as string | null,
          location: a.location as string | null,
          date_acquired: a.date_acquired as string | null,
          employee_name: (a.employees as { name: string } | null)?.name || null,
        }))
      )
      setLoading(false)
    }
    fetch()
  }, [department])

  if (!department) return null

  // Group by status
  const statusGroups: Record<string, AlertAsset[]> = {}
  rows.forEach(r => {
    if (!statusGroups[r.status]) statusGroups[r.status] = []
    statusGroups[r.status].push(r)
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{department}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} assets assigned</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Summary badges */}
        {!loading && Object.keys(statusGroups).length > 0 && (
          <div className="px-6 py-3 border-b border-gray-50 flex flex-wrap gap-2">
            {Object.entries(statusGroups).map(([status, items]) => (
              <span key={status} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 font-semibold">
                {status}: {items.length}
              </span>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No assets assigned to this department</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rows.map((a, i) => (
                <div key={a.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                  <span className="text-xs text-gray-300 font-mono w-5 pt-0.5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${a.asset_id ? 'text-blue-600' : 'text-amber-500 italic'}`}>
                        {a.asset_id || 'No ID'}
                      </span>
                      <StatusBadge status={a.status} size="sm" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{a.particulars}</p>
                    {a.employee_name && <p className="text-xs text-gray-400 mt-0.5">👤 {a.employee_name}</p>}
                  </div>
                  <button
                    onClick={() => { onViewAsset(a.id); onClose() }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex-shrink-0"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">Click any row's → icon to open the full asset profile</p>
        </div>
      </div>
    </>
  )
}
const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [alerts, setAlerts] = useState<AlertDef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAlert, setActiveAlert] = useState<AlertDef | null>(null)
  const [activeDept, setActiveDept] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const { data: assets } = await supabase
        .from('assets')
        .select(`id, status, cost_per_unit, categories(name, type_group), employees(name, departments(name))`)

      if (!assets) { setLoading(false); return }

      const byStatus: Record<string, number> = {}
      assets.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1 })

      const catMap: Record<string, number> = {}
      assets.forEach(a => {
        const cat = (a.categories as { name?: string } | null)?.name || 'Uncategorized'
        catMap[cat] = (catMap[cat] || 0) + 1
      })
      const byCategory = Object.entries(catMap).map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count).slice(0, 15)

      const deptMap: Record<string, number> = {}
      assets.forEach(a => {
        const emp = a.employees as { departments?: { name?: string } } | null
        const dept = emp?.departments?.name || 'Unassigned'
        deptMap[dept] = (deptMap[dept] || 0) + 1
      })
      const byDepartment = Object.entries(deptMap)
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count)

      const totalValue = assets.reduce((s, a) => s + (a.cost_per_unit || 0), 0)
      const valueByStatus: Record<string, number> = {}
      assets.forEach(a => {
        valueByStatus[a.status] = (valueByStatus[a.status] || 0) + (a.cost_per_unit || 0)
      })

      setStats({ total: assets.length, byStatus, byCategory, byDepartment, totalValue, valueByStatus })

      // Build alerts
      const newAlerts: AlertDef[] = []
      if (byStatus['For Replacement']) newAlerts.push({ type: 'error',   message: 'For Replacement',       count: byStatus['For Replacement'], queryKey: 'for-replacement' })
      if (byStatus['Under Repair'])    newAlerts.push({ type: 'warning', message: 'Under Repair',           count: byStatus['Under Repair'],    queryKey: 'under-repair' })
      if (byStatus['Available'])       newAlerts.push({ type: 'info',    message: 'Available (Unissued)',   count: byStatus['Available'],       queryKey: 'available' })
      if (byStatus['Damaged'])         newAlerts.push({ type: 'error',   message: 'Damaged Equipment',     count: byStatus['Damaged'],         queryKey: 'damaged' })
      if (byStatus['Missing'])         newAlerts.push({ type: 'error',   message: 'Missing Equipment',     count: byStatus['Missing'],         queryKey: 'missing' })

      const { count: missingSerial } = await supabase
        .from('assets').select('id', { count: 'exact', head: true }).is('serial_no', null)
      if (missingSerial && missingSerial > 0)
        newAlerts.push({ type: 'warning', message: 'Missing Serial No.', count: missingSerial, queryKey: 'missing-serial' })

      setAlerts(newAlerts)
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner message="Loading dashboard..." />
    </div>
  )
  if (!stats) return null

  const statusChartData = Object.entries(stats.byStatus).map(([status, count]) => ({ status, count }))

  const statCards = [
    { label: 'Total Assets',    value: stats.total,                           gradient: 'bg-gradient-to-br from-blue-50 to-blue-100/60',    iconBg: 'bg-blue-500',    icon: <Boxes size={18} className="text-white" />,          link: '/inventory' },
    { label: 'Working',         value: stats.byStatus['Working'] || 0,        gradient: 'bg-gradient-to-br from-emerald-50 to-green-100/60', iconBg: 'bg-emerald-500', icon: <CheckCircle size={18} className="text-white" />,    link: '/inventory?status=Working' },
    { label: 'Available',       value: stats.byStatus['Available'] || 0,      gradient: 'bg-gradient-to-br from-teal-50 to-teal-100/60',    iconBg: 'bg-teal-500',    icon: <Package size={18} className="text-white" />,       link: '/inventory?status=Available' },
    { label: 'Under Repair',    value: stats.byStatus['Under Repair'] || 0,   gradient: 'bg-gradient-to-br from-amber-50 to-yellow-100/60', iconBg: 'bg-amber-500',   icon: <Wrench size={18} className="text-white" />,         link: '/maintenance' },
    { label: 'For Replacement', value: stats.byStatus['For Replacement'] || 0,gradient: 'bg-gradient-to-br from-orange-50 to-orange-100/60',iconBg: 'bg-orange-500',  icon: <AlertTriangle size={18} className="text-white" />,  link: '/replacement' },
    { label: 'Replaced',        value: stats.byStatus['Replaced'] || 0,       gradient: 'bg-gradient-to-br from-slate-50 to-gray-100/60',   iconBg: 'bg-slate-400',   icon: <RefreshCw size={18} className="text-white" />,      link: '/inventory?status=Replaced' },
  ]

  const alertStyle = (type: AlertDef['type']) => ({
    error:   { wrapper: 'bg-red-50 border-red-100 hover:bg-red-100',       icon: <XCircle size={15} className="text-red-500 flex-shrink-0" />,       text: 'text-red-700',    count: 'text-red-600' },
    warning: { wrapper: 'bg-amber-50 border-amber-100 hover:bg-amber-100', icon: <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />, text: 'text-amber-700',  count: 'text-amber-600' },
    info:    { wrapper: 'bg-blue-50 border-blue-100 hover:bg-blue-100',    icon: <Activity size={15} className="text-blue-500 flex-shrink-0" />,     text: 'text-blue-700',   count: 'text-blue-600' },
  }[type])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        {statCards.map(c => (
          <StatCard key={c.label} label={c.label} value={c.value}
            gradient={c.gradient} iconBg={c.iconBg} icon={c.icon}
            onClick={() => navigate(c.link)} />
        ))}
      </div>

      {/* Inventory Value */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Inventory Value</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Cost',      value: stats.totalValue,                            color: 'text-blue-300',   bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Working',         value: stats.valueByStatus['Working'] || 0,         color: 'text-emerald-300',bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Under Repair',    value: stats.valueByStatus['Under Repair'] || 0,    color: 'text-amber-300',  bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'For Replacement', value: stats.valueByStatus['For Replacement'] || 0, color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20' },
            { label: 'Replaced',        value: stats.valueByStatus['Replaced'] || 0,        color: 'text-slate-300',  bg: 'bg-slate-500/10 border-slate-500/20' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl border p-3 ${bg}`}>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-base font-bold ${color}`}>{formatPeso(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Layers size={14} className="text-blue-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Inventory by Category</h2>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={18}>
                {stats.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
              <Activity size={14} className="text-purple-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">By Status</h2>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={statusChartData} dataKey="count" nameKey="status" cx="50%" cy="45%" outerRadius={85} innerRadius={48} paddingAngle={2}>
                {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }} />
              <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Monitor size={14} className="text-emerald-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Inventory by Department</h2>
            <span className="text-xs text-gray-400 ml-1">— click a bar to see assets</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={stats.byDepartment}
              margin={{ bottom: 5 }}
              onClick={(e) => { if (e?.activeLabel) setActiveDept(e.activeLabel as string) }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff' }} />
              <Bar dataKey="count" fill="url(#blueGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts panel */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Alerts</h2>
            </div>
            {alerts.length > 0 && (
              <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle size={22} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">All clear</p>
              <p className="text-xs text-gray-400 mt-0.5">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => {
                const s = alertStyle(alert.type)
                return (
                  <button
                    key={i}
                    onClick={() => setActiveAlert(alert)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm transition-all cursor-pointer text-left ${s.wrapper}`}
                  >
                    {s.icon}
                    <span className={`flex-1 text-xs font-semibold ${s.text}`}>{alert.message}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-xl leading-none ${s.count}`}>{alert.count}</span>
                      <ArrowUpRight size={12} className={`${s.count} opacity-60`} />
                    </div>
                  </button>
                )
              })}
              <p className="text-center text-xs text-gray-400 pt-1">Click any alert to see affected assets</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert Detail Drawer */}
      <AlertDrawer
        alert={activeAlert}
        onClose={() => setActiveAlert(null)}
        onViewAsset={(id) => navigate(`/inventory/${id}`)}
      />

      {/* Department Detail Drawer */}
      <DeptDrawer
        department={activeDept}
        onClose={() => setActiveDept(null)}
        onViewAsset={(id) => navigate(`/inventory/${id}`)}
      />
    </div>
  )
}

export default DashboardPage
