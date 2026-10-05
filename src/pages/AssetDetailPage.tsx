import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Clock, Wrench, Info, FileText, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import AssetFormModal from '../components/AssetFormModal'
import DateInput from '../components/ui/DateInput'
import { formatPeso, formatDate } from '../utils/constants'
import type { Asset, AssetHistory, MaintenanceRecord, MaintenanceResult, Category, Branch, Employee, AssetDetail } from '../types'

type Tab = 'overview' | 'details' | 'history' | 'maintenance'

const COMPUTER_FIELDS = ['Device Type','Brand','Model','Processor','RAM','Storage','Storage Type','Windows Version','MAC Address','Warranty Expiration']
const NETWORK_FIELDS = ['Brand','Model','MAC Address','IP Address','Port Count','Location','Warranty']
const PRINTER_FIELDS = ['Brand','Model','Printer Type','IP Address','Connection Type','Location','Warranty']
const PHONE_FIELDS = ['Brand','Model','IMEI','OS Version','Storage','RAM','Mobile Number']
const MONITOR_FIELDS = ['Brand','Model','Specifications']

function getFields(categoryName: string): string[] {
  const n = categoryName.toLowerCase()
  if (n.includes('laptop') || n.includes('desktop') || n.includes('pc')) return COMPUTER_FIELDS
  if (n.includes('router') || n.includes('switch') || n.includes('access point')) return NETWORK_FIELDS
  if (n.includes('printer')) return PRINTER_FIELDS
  if (n.includes('phone') || n.includes('tablet')) return PHONE_FIELDS
  return MONITOR_FIELDS
}

const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const toast = useToast()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [history, setHistory] = useState<AssetHistory[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [editAsset, setEditAsset] = useState(false)
  const [editDetails, setEditDetails] = useState(false)
  const [detailForm, setDetailForm] = useState<Record<string, string>>({})
  const [savingDetails, setSavingDetails] = useState(false)

  // Maintenance log modal state
  const [maintModal, setMaintModal] = useState(false)
  const [maintForm, setMaintForm] = useState({
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
  const [savingMaint, setSavingMaint] = useState(false)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [assetRes, detailRes, histRes, maintRes, catRes, brRes, empRes] = await Promise.all([
      supabase.from('assets').select(`*, categories(id,name,type_group), branch:branch_id(id,name), employees(id,name,departments(id,name))`).eq('id', id).single(),
      supabase.from('asset_details').select('*').eq('asset_id', id).maybeSingle(),
      supabase.from('asset_history').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
      supabase.from('maintenance_records').select('*').eq('asset_id', id).order('maintenance_date', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('employees').select('id,name').order('name'),
    ])
    if (assetRes.data) setAsset(assetRes.data as Asset)
    if (detailRes.data) { setDetail(detailRes.data as AssetDetail); setDetailForm(detailRes.data.detail_data as Record<string,string> || {}) }
    if (histRes.data) setHistory(histRes.data as AssetHistory[])
    if (maintRes.data) setMaintenance(maintRes.data as MaintenanceRecord[])
    if (catRes.data) setCategories(catRes.data as Category[])
    if (brRes.data) setBranches(brRes.data as Branch[])
    if (empRes.data) setEmployees(empRes.data as Employee[])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSaveDetails = async () => {
    if (!asset) return
    setSavingDetails(true)
    if (detail) {
      await supabase.from('asset_details').update({ detail_data: detailForm, updated_at: new Date().toISOString() }).eq('id', detail.id)
    } else {
      await supabase.from('asset_details').insert({ asset_id: asset.id, detail_data: detailForm, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    }
    toast('success', 'Details saved')
    setSavingDetails(false)
    setEditDetails(false)
    fetchAll()
  }

  const handleLogMaintenance = async () => {
    if (!asset || !maintForm.problem || !maintForm.maintenance_date) {
      toast('error', 'Date and problem are required')
      return
    }
    setSavingMaint(true)
    const { error } = await supabase.from('maintenance_records').insert({
      asset_id: asset.id,
      maintenance_date: maintForm.maintenance_date,
      problem: maintForm.problem,
      diagnosis: maintForm.diagnosis || null,
      action_taken: maintForm.action_taken || null,
      parts_replaced: maintForm.parts_replaced || null,
      technician: maintForm.technician || null,
      cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      result: maintForm.result,
      notes: maintForm.notes || null,
      created_at: new Date().toISOString(),
    })
    if (!error) {
      // Update asset last_maintenance_date and status
      const updates: Record<string, unknown> = { last_maintenance_date: maintForm.maintenance_date, updated_at: new Date().toISOString() }
      if (maintForm.result === 'Ongoing')   updates.status = 'Under Repair'
      else if (maintForm.result === 'Resolved') updates.status = 'Working'
      else if (maintForm.result === 'Replaced') updates.status = 'Replaced'
      else if (maintForm.result === 'Broken')   updates.status = 'Damaged'
      else if (maintForm.result === 'Retired')  updates.status = 'Retired'
      await supabase.from('assets').update(updates).eq('id', asset.id)
      // Write to history
      await supabase.from('asset_history').insert({
        asset_id: asset.id,
        changed_by_name: userProfile?.full_name || userProfile?.email || 'System',
        action: `Maintenance Logged: ${maintForm.result}`,
        new_value: maintForm.result === 'Ongoing' ? 'Under Repair' : 'Working',
        notes: maintForm.problem,
      })
      toast('success', 'Maintenance record saved')
      setMaintModal(false)
      setMaintForm({ maintenance_date: new Date().toISOString().split('T')[0], problem: '', diagnosis: '', action_taken: '', parts_replaced: '', technician: '', cost: '', result: 'Resolved', notes: '' })
      fetchAll()
    } else {
      toast('error', 'Failed to save maintenance record')
    }
    setSavingMaint(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner message="Loading asset..." /></div>
  if (!asset) return <div className="text-center py-16 text-gray-400">Asset not found</div>

  const catName = asset.categories?.name || ''
  const fields = getFields(catName)
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Info size={15} /> },
    { key: 'details', label: 'Details', icon: <FileText size={15} /> },
    { key: 'history', label: `History (${history.length})`, icon: <Clock size={15} /> },
    { key: 'maintenance', label: `Maintenance (${maintenance.length})`, icon: <Wrench size={15} /> },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xl font-bold text-blue-600">{asset.asset_id || <span className="text-amber-500 italic text-base">No Asset ID</span>}</span>
            <StatusBadge status={asset.status} />
            {asset.categories && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{asset.categories.name}</span>
            )}
            {asset.branches && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{asset.branches.name}</span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mt-1">{asset.particulars}</h1>
        </div>
        {canEdit && (
          <button onClick={() => setEditAsset(true)} className="btn-secondary flex items-center gap-2">
            <Edit2 size={15} /> Edit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-800 border-b pb-2">Inventory Information</h3>
            {[
              ['Asset ID', asset.asset_id],
              ['Serial Number', asset.serial_no || '—'],
              ['Category', asset.categories?.name || '—'],
              ['Branch', asset.branches?.name || '—'],
              ['Location', asset.location || '—'],
              ['Status', null],
              ['Date Acquired', formatDate(asset.date_acquired)],
              ['Cost Per Unit', formatPeso(asset.cost_per_unit)],
              ['Last Maintained', formatDate(asset.last_maintenance_date)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-gray-500 w-40 flex-shrink-0">{label}</span>
                {label === 'Status' ? <StatusBadge status={asset.status} size="sm" /> : <span className="font-medium text-gray-800 text-right">{value as string}</span>}
              </div>
            ))}
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-800 border-b pb-2">Assignment</h3>
            {[
              ['Issued To', asset.employees?.name || '— Unassigned —'],
              ['Department', asset.employees?.departments?.name || '—'],
              ['Date Issued', formatDate(asset.date_issued)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-gray-500 w-40">{label}</span>
                <span className={`font-medium text-right ${value === '— Unassigned —' ? 'text-gray-400 italic' : 'text-gray-800'}`}>{value as string}</span>
              </div>
            ))}
            {asset.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Tab */}
      {tab === 'details' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Technical Details — {catName || 'Asset'}</h3>
            {canEdit && (
              <button onClick={() => setEditDetails(!editDetails)} className="btn-secondary text-sm">
                {editDetails ? 'Cancel' : <><Edit2 size={13} className="inline mr-1" />Edit Details</>}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(field => (
              <div key={field}>
                <label className="label text-xs">{field}</label>
                {editDetails ? (
                  <input
                    className="input text-sm"
                    value={detailForm[field] || ''}
                    onChange={e => setDetailForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-gray-700 font-medium">{(detail?.detail_data as Record<string,string>)?.[field] || <span className="text-gray-400">—</span>}</p>
                )}
              </div>
            ))}
          </div>
          {editDetails && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setEditDetails(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveDetails} disabled={savingDetails} className="btn-primary">
                {savingDetails ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Asset History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No history recorded yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4 pl-10">
                {history.map(h => (
                  <div key={h.id} className="relative">
                    <div className="absolute -left-6 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{h.action}</span>
                        <span className="text-xs text-gray-400">{formatDate(h.created_at)}</span>
                      </div>
                      {(h.previous_value || h.new_value) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {h.previous_value && <span className="line-through text-red-400">{h.previous_value}</span>}
                          {h.previous_value && h.new_value && <span className="mx-2">→</span>}
                          {h.new_value && <span className="text-green-600">{h.new_value}</span>}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        By {h.changed_by_name}
                        {h.employee_name && ` · ${h.employee_name}`}
                        {h.notes && ` · ${h.notes}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Tab */}
      {tab === 'maintenance' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Maintenance Records</h3>
            {canEdit && (
              <button onClick={() => setMaintModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
                <Plus size={14} /> Log Maintenance
              </button>
            )}
          </div>
          {maintenance.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">No maintenance records</p>
              {canEdit && (
                <button onClick={() => setMaintModal(true)} className="btn-secondary text-sm mt-3">
                  Log the first record
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {maintenance.map(m => (
                <div key={m.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{m.problem}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(m.maintenance_date)}
                        {m.technician && ` · ${m.technician}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0 ${
                      m.result === 'Resolved' ? 'bg-green-100 text-green-700' :
                      m.result === 'Ongoing' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{m.result}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    {m.diagnosis && (
                      <div><p className="text-xs text-gray-400">Diagnosis</p><p className="text-sm text-gray-700">{m.diagnosis}</p></div>
                    )}
                    {m.action_taken && (
                      <div><p className="text-xs text-gray-400">Action Taken</p><p className="text-sm text-gray-700">{m.action_taken}</p></div>
                    )}
                    {m.parts_replaced && (
                      <div><p className="text-xs text-gray-400">Parts Replaced</p><p className="text-sm text-gray-700">{m.parts_replaced}</p></div>
                    )}
                    {m.cost != null && (
                      <div><p className="text-xs text-gray-400">Cost</p><p className="text-sm font-semibold text-gray-700">{formatPeso(m.cost)}</p></div>
                    )}
                  </div>
                  {m.notes && <p className="text-xs text-gray-400 mt-2 italic">{m.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Asset Modal */}
      {editAsset && (
        <AssetFormModal
          open={editAsset}
          onClose={() => setEditAsset(false)}
          onSaved={() => { setEditAsset(false); fetchAll(); toast('success', 'Asset updated') }}
          asset={asset}
          categories={categories}
          branches={branches}
          employees={employees}
        />
      )}

      {/* Log Maintenance Modal */}
      <Modal open={maintModal} onClose={() => setMaintModal(false)} title={`Log Maintenance — ${asset.asset_id || asset.particulars}`} size="2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Maintenance Date <span className="text-red-500">*</span></label>
            <DateInput value={maintForm.maintenance_date} onChange={v => setMaintForm(f => ({ ...f, maintenance_date: v }))} />
          </div>
          <div>
            <label className="label">Technician</label>
            <input className="input" value={maintForm.technician} onChange={e => setMaintForm(f => ({ ...f, technician: e.target.value }))} placeholder="Technician name" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Problem <span className="text-red-500">*</span></label>
            <input className="input" value={maintForm.problem} onChange={e => setMaintForm(f => ({ ...f, problem: e.target.value }))} placeholder="Describe the problem..." />
          </div>
          <div className="md:col-span-2">
            <label className="label">Diagnosis</label>
            <textarea className="input resize-none" rows={2} value={maintForm.diagnosis} onChange={e => setMaintForm(f => ({ ...f, diagnosis: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Action Taken</label>
            <textarea className="input resize-none" rows={2} value={maintForm.action_taken} onChange={e => setMaintForm(f => ({ ...f, action_taken: e.target.value }))} />
          </div>
          <div>
            <label className="label">Parts Replaced</label>
            <input className="input" value={maintForm.parts_replaced} onChange={e => setMaintForm(f => ({ ...f, parts_replaced: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cost (₱)</label>
            <input type="number" min="0" step="0.01" className="input" value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Result</label>
            <select className="input" value={maintForm.result} onChange={e => setMaintForm(f => ({ ...f, result: e.target.value as MaintenanceResult }))}>
              <option value="Resolved">Resolved — mark asset as Working</option>
              <option value="Ongoing">Ongoing — mark asset as Under Repair</option>
              <option value="Replaced">Replaced — mark asset as Replaced</option>
              <option value="Broken">Broken — mark asset as Damaged</option>
              <option value="Retired">Retired — mark asset as Retired</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={maintForm.notes} onChange={e => setMaintForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setMaintModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleLogMaintenance} disabled={savingMaint} className="btn-primary">
            {savingMaint ? 'Saving...' : 'Save Maintenance Record'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default AssetDetailPage
