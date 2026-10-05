import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus, Search, Wrench, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatPeso } from '../utils/constants'
import { logAudit } from '../utils/auditLogger'
import DateInput from '../components/ui/DateInput'
import type { MaintenanceRecord, MaintenanceResult } from '../types'

const RESULTS: MaintenanceResult[] = ['Resolved', 'Ongoing', 'Replaced', 'Broken', 'Retired']

const RESULT_CONFIG: Record<MaintenanceResult, { bg: string; text: string; assetStatus: string; hint: string }> = {
  'Resolved': { bg: 'bg-green-100',  text: 'text-green-700',  assetStatus: 'Working',      hint: '→ Asset marked as Working' },
  'Ongoing':  { bg: 'bg-yellow-100', text: 'text-yellow-700', assetStatus: 'Under Repair', hint: '→ Asset marked as Under Repair' },
  'Replaced': { bg: 'bg-gray-100',   text: 'text-gray-600',   assetStatus: 'Replaced',     hint: '→ Asset marked as Replaced' },
  'Broken':   { bg: 'bg-red-100',    text: 'text-red-700',    assetStatus: 'Damaged',      hint: '→ Asset marked as Damaged' },
  'Retired':  { bg: 'bg-slate-100',  text: 'text-slate-600',  assetStatus: 'Retired',      hint: '→ Asset marked as Retired' },
}
const PAGE_SIZE = 30

const MaintenancePage: React.FC = () => {
  const { userProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [sp] = useSearchParams()

  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [totalCost, setTotalCost] = useState(0)
  const [form, setForm] = useState({
    asset_id_search: sp.get('asset') || '',
    asset_uuid: sp.get('asset') || '',
    asset_label: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    problem: '',
    diagnosis: '',
    action_taken: '',
    parts_replaced: '',
    technician: '',
    cost: '',
    result: 'Resolved' as MaintenanceResult,
    notes: '',
  })
  const [assetSuggestions, setAssetSuggestions] = useState<{ id: string; asset_id: string; particulars: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Edit existing record
  const [editRecord, setEditRecord] = useState<MaintenanceRecord | null>(null)
  const [editForm, setEditForm] = useState({
    maintenance_date: '',
    problem: '',
    diagnosis: '',
    action_taken: '',
    parts_replaced: '',
    technician: '',
    cost: '',
    result: 'Resolved' as MaintenanceResult,
    notes: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('maintenance_records')
      .select(`*, assets(id, asset_id, particulars)`, { count: 'exact' })
    if (search) q = q.or(`problem.ilike.%${search}%,technician.ilike.%${search}%`)
    q = q.order('maintenance_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data, count } = await q
    if (data) {
      setRecords(data as MaintenanceRecord[])
      const tc = (data as MaintenanceRecord[]).reduce((s, r) => s + (r.cost || 0), 0)
      setTotalCost(tc)
    }
    setTotal(count || 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const searchAssets = async (q: string) => {
    if (q.length < 2) { setAssetSuggestions([]); return }
    const { data } = await supabase.from('assets').select('id, asset_id, particulars').ilike('asset_id', `%${q}%`).limit(8)
    if (data) setAssetSuggestions(data as { id: string; asset_id: string; particulars: string }[])
  }

  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }))

  const handleSave = async () => {
    if (!form.asset_uuid || !form.problem || !form.maintenance_date) {
      toast('error', 'Asset, maintenance date and problem are required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('maintenance_records').insert({
      asset_id: form.asset_uuid,
      maintenance_date: form.maintenance_date,
      problem: form.problem,
      diagnosis: form.diagnosis || null,
      action_taken: form.action_taken || null,
      parts_replaced: form.parts_replaced || null,
      technician: form.technician || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      result: form.result,
      notes: form.notes || null,
      created_at: new Date().toISOString(),
    })
    if (!error) {
      // Update asset last_maintenance_date and status if ongoing
      const updates: Record<string, unknown> = { last_maintenance_date: form.maintenance_date, updated_at: new Date().toISOString() }
      updates.status = RESULT_CONFIG[form.result].assetStatus
      await supabase.from('assets').update(updates).eq('id', form.asset_uuid)
      await supabase.from('asset_history').insert({
        asset_id: form.asset_uuid,
        changed_by_name: userProfile?.full_name || 'System',
        action: `Maintenance Logged: ${form.result}`,
        new_value: RESULT_CONFIG[form.result].assetStatus,
        notes: form.problem,
      })
      await logAudit({ userProfile, action: `Logged maintenance for ${form.asset_label || form.asset_uuid}`, assetId: form.asset_label })
      toast('success', 'Maintenance record saved')
      setModal(false)
      fetchRecords()
    } else {
      toast('error', 'Failed to save')
    }
    setSaving(false)
  }

  const openModal = () => {
    setForm(f => ({ ...f, problem: '', diagnosis: '', action_taken: '', parts_replaced: '', technician: '', cost: '', result: 'Resolved', notes: '' }))
    setModal(true)
  }

  const openEdit = (r: MaintenanceRecord) => {
    setEditRecord(r)
    setEditForm({
      maintenance_date: r.maintenance_date || '',
      problem: r.problem || '',
      diagnosis: r.diagnosis || '',
      action_taken: r.action_taken || '',
      parts_replaced: r.parts_replaced || '',
      technician: r.technician || '',
      cost: r.cost?.toString() || '',
      result: r.result as MaintenanceResult,
      notes: r.notes || '',
    })
  }

  const handleUpdateResult = async (record: MaintenanceRecord, newResult: MaintenanceResult) => {
    const { error } = await supabase
      .from('maintenance_records')
      .update({ result: newResult })
      .eq('id', record.id)
    if (!error) {
      const statusUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
      statusUpdate.status = RESULT_CONFIG[newResult].assetStatus
      await supabase.from('assets').update(statusUpdate).eq('id', record.asset_id)
      await logAudit({ userProfile, action: `Maintenance result updated to ${newResult}`, assetId: record.assets?.asset_id })
      toast('success', `Updated to ${newResult}`)
      fetchRecords()
    } else {
      toast('error', 'Failed to update result')
    }
  }

  const handleSaveEdit = async () => {
    if (!editRecord) return
    setSavingEdit(true)
    const { error } = await supabase.from('maintenance_records').update({
      maintenance_date: editForm.maintenance_date,
      problem: editForm.problem,
      diagnosis: editForm.diagnosis || null,
      action_taken: editForm.action_taken || null,
      parts_replaced: editForm.parts_replaced || null,
      technician: editForm.technician || null,
      cost: editForm.cost ? parseFloat(editForm.cost) : null,
      result: editForm.result,
      notes: editForm.notes || null,
    }).eq('id', editRecord.id)
    if (!error) {
      // Sync asset status
      const statusUpdate: Record<string, unknown> = { last_maintenance_date: editForm.maintenance_date, updated_at: new Date().toISOString() }
      statusUpdate.status = RESULT_CONFIG[editForm.result].assetStatus
      await supabase.from('assets').update(statusUpdate).eq('id', editRecord.asset_id)
      await logAudit({ userProfile, action: `Updated maintenance record for ${editRecord.assets?.asset_id}`, assetId: editRecord.assets?.asset_id })
      toast('success', 'Maintenance record updated')
      setEditRecord(null)
      fetchRecords()
    } else {
      toast('error', 'Failed to update record')
    }
    setSavingEdit(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by problem, technician..." className="input pl-9 py-2" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-gray-500">Total Repair Cost: <span className="font-bold text-gray-900">{formatPeso(totalCost)}</span></div>
          {canEdit && (
            <button onClick={openModal} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Log Maintenance
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Asset</th>
                <th className="table-header">Date</th>
                <th className="table-header min-w-48">Problem</th>
                <th className="table-header">Action Taken</th>
                <th className="table-header">Technician</th>
                <th className="table-header text-right">Cost</th>
                <th className="table-header w-36">Result</th>
                {canEdit && <th className="table-header w-14"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><LoadingSpinner /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="py-8">
                  <EmptyState title="No maintenance records" message="Log your first maintenance record" icon={<Wrench size={28} className="text-gray-400" />}
                    action={canEdit ? <button onClick={openModal} className="btn-primary text-sm">Log Maintenance</button> : undefined} />
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">
                    <button onClick={() => r.assets && navigate(`/inventory/${r.assets.id}`)} className={`font-mono font-medium hover:underline ${r.assets?.asset_id ? 'text-blue-600' : 'text-amber-500 italic'}`}>
                      {r.assets?.asset_id || 'No Asset ID'}
                    </button>
                    <div className="text-xs text-gray-400">{r.assets?.particulars}</div>
                  </td>
                  <td className="table-cell whitespace-nowrap">{formatDate(r.maintenance_date)}</td>
                  <td className="table-cell">{r.problem}</td>
                  <td className="table-cell text-gray-500 text-xs">{r.action_taken || '—'}</td>
                  <td className="table-cell">{r.technician || '—'}</td>
                  <td className="table-cell text-right font-medium">{formatPeso(r.cost)}</td>
                  <td className="table-cell">
                    {canEdit ? (
                      <select
                        value={r.result}
                        onChange={e => handleUpdateResult(r, e.target.value as MaintenanceResult)}
                        className={`text-xs px-2 py-1.5 rounded-lg font-semibold border-0 outline-none cursor-pointer focus:ring-2 focus:ring-blue-400 ${RESULT_CONFIG[r.result as MaintenanceResult]?.bg || 'bg-gray-100'} ${RESULT_CONFIG[r.result as MaintenanceResult]?.text || 'text-gray-600'}`}
                      >
                        {RESULTS.map(res => <option key={res} value={res}>{res}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${RESULT_CONFIG[r.result as MaintenanceResult]?.bg || 'bg-gray-100'} ${RESULT_CONFIG[r.result as MaintenanceResult]?.text || 'text-gray-600'}`}>
                        {r.result}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="table-cell">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                        title="Edit record"
                      >
                        <Edit2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {/* Add Maintenance Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Log Maintenance Record" size="2xl">        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Asset ID <span className="text-red-500">*</span></label>
            <div className="relative">
              <input className="input" value={form.asset_id_search} onChange={e => { set('asset_id_search', e.target.value); searchAssets(e.target.value) }} placeholder="Type asset ID to search..." />
              {assetSuggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                  {assetSuggestions.map(a => (
                    <button key={a.id} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                      onClick={() => { set('asset_uuid', a.id); set('asset_id_search', a.asset_id); set('asset_label', a.asset_id); setAssetSuggestions([]) }}>
                      <span className="font-mono font-bold">{a.asset_id}</span> — {a.particulars}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="label">Maintenance Date <span className="text-red-500">*</span></label>
            <DateInput value={form.maintenance_date} onChange={v => set('maintenance_date', v)} />
          </div>
          <div>
            <label className="label">Technician</label>
            <input className="input" value={form.technician} onChange={e => set('technician', e.target.value)} placeholder="Technician name" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Problem <span className="text-red-500">*</span></label>
            <input className="input" value={form.problem} onChange={e => set('problem', e.target.value)} placeholder="Describe the problem..." />
          </div>
          <div className="md:col-span-2">
            <label className="label">Diagnosis</label>
            <textarea className="input resize-none" rows={2} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Action Taken</label>
            <textarea className="input resize-none" rows={2} value={form.action_taken} onChange={e => set('action_taken', e.target.value)} />
          </div>
          <div>
            <label className="label">Parts Replaced</label>
            <input className="input" value={form.parts_replaced} onChange={e => set('parts_replaced', e.target.value)} />
          </div>
          <div>
            <label className="label">Cost (₱)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Result</label>
            <select className="input" value={form.result} onChange={e => set('result', e.target.value as MaintenanceResult)}>
              {RESULTS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Record'}</button>
        </div>
      </Modal>

      {/* Edit Maintenance Modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)}
        title={`Edit Maintenance — ${editRecord?.assets?.asset_id || ''}`} size="2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Maintenance Date <span className="text-red-500">*</span></label>
            <DateInput value={editForm.maintenance_date} onChange={v => setEditForm(f => ({ ...f, maintenance_date: v }))} />
          </div>
          <div>
            <label className="label">Technician</label>
            <input className="input" value={editForm.technician} onChange={e => setEditForm(f => ({ ...f, technician: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Problem <span className="text-red-500">*</span></label>
            <input className="input" value={editForm.problem} onChange={e => setEditForm(f => ({ ...f, problem: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Diagnosis</label>
            <textarea className="input resize-none" rows={2} value={editForm.diagnosis} onChange={e => setEditForm(f => ({ ...f, diagnosis: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Action Taken</label>
            <textarea className="input resize-none" rows={2} value={editForm.action_taken} onChange={e => setEditForm(f => ({ ...f, action_taken: e.target.value }))} />
          </div>
          <div>
            <label className="label">Parts Replaced</label>
            <input className="input" value={editForm.parts_replaced} onChange={e => setEditForm(f => ({ ...f, parts_replaced: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cost (₱)</label>
            <input type="number" min="0" step="0.01" className="input" value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Result</label>
            <select
              className={`input font-semibold ${RESULT_CONFIG[editForm.result]?.bg || ''} ${RESULT_CONFIG[editForm.result]?.text || ''}`}
              value={editForm.result}
              onChange={e => setEditForm(f => ({ ...f, result: e.target.value as MaintenanceResult }))}
            >
              {RESULTS.map(r => <option key={r}>{r}</option>)}
            </select>
            {RESULT_CONFIG[editForm.result] && (
              <p className="text-xs text-gray-400 mt-1">{RESULT_CONFIG[editForm.result].hint}</p>
            )}
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button onClick={() => setEditRecord(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary">
            {savingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default MaintenancePage
