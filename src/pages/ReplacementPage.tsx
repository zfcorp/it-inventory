import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, User, Package, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Pagination from '../components/ui/Pagination'
import { formatDate } from '../utils/constants'
import { REPLACEMENT_STATUSES, REPLACEMENT_STATUS_COLORS, PRIORITIES, PRIORITY_COLORS } from '../utils/constants'
import { logAudit } from '../utils/auditLogger'
import DateInput from '../components/ui/DateInput'
import type { ReplacementRequest, ReplacementStatus, Priority } from '../types'

const PAGE_SIZE = 30

const ReplacementPage: React.FC = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const toast = useToast()

  const [requests, setRequests] = useState<ReplacementRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({
    asset_id_search: '',
    asset_uuid: '',
    asset_label: '',
    employee_id: '',
    employee_name: '',
    department_name: '',
    problem: '',
    date_reported: new Date().toISOString().split('T')[0],
    priority: 'Medium' as Priority,
    notes: '',
  })
  const [assetSuggestions, setAssetSuggestions] = useState<{ id: string; asset_id: string; particulars: string; employee_name: string | null; employee_id: string | null; department_name: string | null }[]>([])
  const [saving, setSaving] = useState(false)

  // Employee search mode
  type SearchMode = 'asset' | 'employee'
  const [searchMode, setSearchMode] = useState<SearchMode>('asset')
  const [empSearch, setEmpSearch] = useState('')
  const [empSuggestions, setEmpSuggestions] = useState<{ id: string; name: string; department?: string }[]>([])
  const [selectedEmpAssets, setSelectedEmpAssets] = useState<{ id: string; asset_id: string; particulars: string; status: string }[]>([])
  const [loadingEmpAssets, setLoadingEmpAssets] = useState(false)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'
  const isAdmin = role === 'admin'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('replacement_requests')
      .select(`*, assets(id, asset_id, particulars, branch:branch_id(name)), employees(name, departments(name))`, { count: 'exact' })
    if (filterStatus) q = q.eq('status', filterStatus)
    q = q.order('date_reported', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data, count } = await q
    if (data) setRequests(data as ReplacementRequest[])
    setTotal(count || 0)
    setLoading(false)
  }, [filterStatus, page])

  useEffect(() => { fetchAll() }, [fetchAll])

  const searchAssets = async (q: string) => {
    if (q.length < 2) { setAssetSuggestions([]); return }
    const { data } = await supabase
      .from('assets')
      .select('id, asset_id, particulars, employees(id, name, departments(name))')
      .or(`asset_id.ilike.%${q}%,particulars.ilike.%${q}%`)
      .limit(8)
    if (data) {
      setAssetSuggestions(data.map((a: Record<string, unknown>) => ({
        id: a.id as string,
        asset_id: a.asset_id as string,
        particulars: a.particulars as string,
        employee_id: (a.employees as { id: string } | null)?.id || null,
        employee_name: (a.employees as { name: string } | null)?.name || null,
        department_name: (a.employees as { departments?: { name: string } } | null)?.departments?.name || null,
      })))
    }
  }

  const selectAsset = (a: typeof assetSuggestions[0]) => {
    setForm(f => ({
      ...f,
      asset_uuid: a.id,
      asset_id_search: a.asset_id || a.particulars,
      asset_label: a.asset_id,
      employee_id: a.employee_id || '',
      employee_name: a.employee_name || '',
      department_name: a.department_name || '',
    }))
    setAssetSuggestions([])
  }

  const searchEmployees = async (q: string) => {
    setEmpSearch(q)
    if (q.length < 2) { setEmpSuggestions([]); return }
    const { data } = await supabase
      .from('employees')
      .select('id, name, departments(name)')
      .ilike('name', `%${q}%`)
      .limit(8)
    if (data) {
      setEmpSuggestions(data.map((e: Record<string, unknown>) => ({
        id: e.id as string,
        name: e.name as string,
        department: (e.departments as { name: string } | null)?.name || '',
      })))
    }
  }

  const selectEmployee = async (emp: { id: string; name: string; department?: string }) => {
    setEmpSearch(emp.name)
    setEmpSuggestions([])
    setForm(f => ({ ...f, employee_id: emp.id, employee_name: emp.name, department_name: emp.department || '', asset_uuid: '', asset_id_search: '', asset_label: '' }))
    setLoadingEmpAssets(true)
    const { data } = await supabase
      .from('assets')
      .select('id, asset_id, particulars, status')
      .eq('issued_to_employee_id', emp.id)
      .order('particulars')
    setSelectedEmpAssets(data as { id: string; asset_id: string; particulars: string; status: string }[] || [])
    setLoadingEmpAssets(false)
  }

  const selectEmpAsset = (a: { id: string; asset_id: string; particulars: string; status: string }) => {
    setForm(f => ({
      ...f,
      asset_uuid: a.id,
      asset_id_search: a.asset_id || a.particulars,
      asset_label: a.asset_id,
    }))
  }

  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }))

  const handleSave = async () => {
    if (!form.asset_uuid || !form.problem) { toast('error', 'Asset and problem are required'); return }
    setSaving(true)
    const { error } = await supabase.from('replacement_requests').insert({
      asset_id: form.asset_uuid,
      employee_id: form.employee_id || null,
      problem: form.problem,
      date_reported: form.date_reported,
      priority: form.priority,
      status: 'Requested',
      notes: form.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (!error) {
      await supabase.from('assets').update({ status: 'For Replacement', updated_at: new Date().toISOString() }).eq('id', form.asset_uuid)
      await supabase.from('asset_history').insert({
        asset_id: form.asset_uuid,
        changed_by_name: userProfile?.full_name || 'System',
        action: 'Replacement Requested',
        new_value: 'For Replacement',
        notes: form.problem,
      })
      await logAudit({ userProfile, action: `Replacement requested for ${form.asset_label}`, assetId: form.asset_label })
      toast('success', 'Replacement request created')
      setModal(false)
      fetchAll()
    } else toast('error', 'Failed to create request')
    setSaving(false)
  }

  const handleStatusChange = async (req: ReplacementRequest, newStatus: ReplacementStatus) => {
    const { error } = await supabase.from('replacement_requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', req.id)
    if (!error) {
      if (newStatus === 'Completed') {
        await supabase.from('assets').update({ status: 'Replaced', updated_at: new Date().toISOString() }).eq('id', req.asset_id)
        await supabase.from('asset_history').insert({
          asset_id: req.asset_id,
          changed_by_name: userProfile?.full_name || 'System',
          action: 'Replacement Completed',
          previous_value: 'For Replacement',
          new_value: 'Replaced',
        })
      }
      await logAudit({ userProfile, action: `Replacement status changed to ${newStatus}`, assetId: req.assets?.asset_id, previousValue: req.status, newValue: newStatus })
      toast('success', `Status updated to ${newStatus}`)
      fetchAll()
    } else toast('error', 'Failed to update status')
  }

  const allowedNextStatuses = (current: ReplacementStatus): ReplacementStatus[] => {
    const idx = REPLACEMENT_STATUSES.indexOf(current)
    if (idx < 0) return []
    if (!isAdmin && idx >= 1) return [] // only admin can advance past Requested
    return REPLACEMENT_STATUSES.slice(idx + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input max-w-48 py-2 text-sm">
          <option value="">All Statuses</option>
          {REPLACEMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => { setForm(f => ({ ...f, asset_id_search: '', asset_uuid: '', asset_label: '', employee_id: '', employee_name: '', department_name: '', problem: '', notes: '' })); setSearchMode('asset'); setEmpSearch(''); setSelectedEmpAssets([]); setModal(true) }} className="btn-primary flex items-center gap-2 ml-auto">
            <Plus size={16} /> New Request
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Asset ID</th>
                <th className="table-header min-w-36">Equipment</th>
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header min-w-40">Problem</th>
                <th className="table-header">Date Reported</th>
                <th className="table-header">Priority</th>
                <th className="table-header">Status</th>
                {canEdit && <th className="table-header">Advance</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><LoadingSpinner /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={9} className="py-8">
                  <EmptyState title="No replacement requests" icon={<RefreshCw size={28} className="text-gray-400" />}
                    action={canEdit ? <button onClick={() => setModal(true)} className="btn-primary text-sm">New Request</button> : undefined} />
                </td></tr>
              ) : requests.map(r => {
                const priCol = PRIORITY_COLORS[r.priority] || PRIORITY_COLORS['Medium']
                const statCol = REPLACEMENT_STATUS_COLORS[r.status] || REPLACEMENT_STATUS_COLORS['Requested']
                const next = allowedNextStatuses(r.status)
                return (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <button onClick={() => r.assets && navigate(`/inventory/${r.assets.id}`)} className={`font-mono font-medium hover:underline ${r.assets?.asset_id ? 'text-blue-600' : 'text-amber-500 italic'}`}>
                        {r.assets?.asset_id || 'No Asset ID'}
                      </button>
                    </td>
                    <td className="table-cell">{r.assets?.particulars || '—'}</td>
                    <td className="table-cell">{r.employees?.name || '—'}</td>
                    <td className="table-cell text-gray-500">{r.employees?.departments?.name || r.assets?.branches?.name || '—'}</td>
                    <td className="table-cell text-xs text-gray-600">{r.problem}</td>
                    <td className="table-cell whitespace-nowrap">{formatDate(r.date_reported)}</td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${priCol.bg} ${priCol.text}`}>{r.priority}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statCol.bg} ${statCol.text}`}>{r.status}</span>
                    </td>
                    {canEdit && (
                      <td className="table-cell">
                        {next.length > 0 ? (
                          <select
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                            value=""
                            onChange={e => e.target.value && handleStatusChange(r, e.target.value as ReplacementStatus)}
                          >
                            <option value="">Move to...</option>
                            {next.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-400">{r.status === 'Completed' ? '✓ Done' : 'No advance'}</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Replacement Request" size="lg">
        <div className="space-y-4">

          {/* Search mode toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setSearchMode('asset'); setEmpSearch(''); setSelectedEmpAssets([]) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${searchMode === 'asset' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Package size={14} /> Search by Asset
            </button>
            <button
              type="button"
              onClick={() => { setSearchMode('employee'); setAssetSuggestions([]); setForm(f => ({ ...f, asset_uuid: '', asset_id_search: '', asset_label: '' })) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${searchMode === 'employee' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <User size={14} /> Search by Employee
            </button>
          </div>

          {/* ── ASSET MODE ── */}
          {searchMode === 'asset' && (
            <div>
              <label className="label">Asset <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  className="input"
                  value={form.asset_id_search}
                  onChange={e => { set('asset_id_search', e.target.value); searchAssets(e.target.value) }}
                  placeholder="Search by Asset ID or equipment name..."
                  autoFocus
                />
                {assetSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                    {assetSuggestions.map(a => (
                      <button key={a.id} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0"
                        onClick={() => selectAsset(a)}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 text-xs w-24 flex-shrink-0">{a.asset_id || '—'}</span>
                          <span className="flex-1 text-gray-700">{a.particulars}</span>
                          {a.employee_name && <span className="text-xs text-gray-400">👤 {a.employee_name}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EMPLOYEE MODE ── */}
          {searchMode === 'employee' && (
            <div className="space-y-3">
              <div>
                <label className="label">Employee <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    className="input"
                    value={empSearch}
                    onChange={e => searchEmployees(e.target.value)}
                    placeholder="Search employee by name..."
                    autoFocus
                  />
                  {empSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                      {empSuggestions.map(e => (
                        <button key={e.id} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 flex items-center gap-3"
                          onClick={() => selectEmployee(e)}>
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 text-xs font-bold">{e.name[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{e.name}</p>
                            {e.department && <p className="text-xs text-gray-400">{e.department}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Employee's assets */}
              {form.employee_name && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{form.employee_name[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{form.employee_name}</p>
                      {form.department_name && <p className="text-xs text-gray-400">{form.department_name}</p>}
                    </div>
                  </div>

                  <label className="label mt-3">Select Asset to Replace <span className="text-red-500">*</span></label>
                  {loadingEmpAssets ? (
                    <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
                  ) : selectedEmpAssets.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-600">
                      This employee has no assets assigned.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedEmpAssets.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => selectEmpAsset(a)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-all text-left ${
                            form.asset_uuid === a.id
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <span className={`font-mono font-bold text-xs w-24 flex-shrink-0 ${form.asset_uuid === a.id ? 'text-blue-200' : 'text-blue-600'}`}>
                            {a.asset_id || '—'}
                          </span>
                          <span className="flex-1">{a.particulars}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            form.asset_uuid === a.id ? 'bg-blue-500 text-blue-100' : 'bg-gray-100 text-gray-500'
                          }`}>{a.status}</span>
                          {form.asset_uuid === a.id && <ChevronRight size={14} className="text-blue-200 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected asset summary */}
          {form.asset_uuid && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
              <span className="text-emerald-600 font-semibold text-sm">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800 truncate">
                  {form.asset_id_search}
                </p>
                {form.employee_name && searchMode === 'asset' && (
                  <p className="text-xs text-emerald-600">👤 {form.employee_name}{form.department_name ? ` · ${form.department_name}` : ''}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="label">Problem <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={3} value={form.problem} onChange={e => set('problem', e.target.value)} placeholder="Describe the issue requiring replacement..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date Reported</label>
              <DateInput value={form.date_reported} onChange={v => set('date_reported', v)} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Submit Request'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ReplacementPage
