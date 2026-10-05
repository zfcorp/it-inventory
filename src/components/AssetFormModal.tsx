import React, { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logAudit } from '../utils/auditLogger'
import { ASSET_STATUSES } from '../utils/constants'
import DateInput from './ui/DateInput'
import type { Asset, Category, Branch, Employee, AssetStatus } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  asset?: Asset | null
  categories: Category[]
  branches: Branch[]
  employees: Employee[]
}

// Who is this issued to?
type IssuedToMode = 'employee' | 'branch' | 'none'

const AssetFormModal: React.FC<Props> = ({ open, onClose, onSaved, asset, categories, branches, employees }) => {
  const { userProfile } = useAuth()
  const isEdit = !!asset

  const [form, setForm] = useState({
    date_acquired: '',
    particulars: '',
    asset_id: '',
    serial_no: '',
    cost_per_unit: '',
    issued_to_employee_id: '',
    issued_to_branch_id: '',
    location: '',
    date_issued: '',
    notes: '',
    status: 'Available' as AssetStatus,
    category_id: '',
    branch_id: '',
  })
  const [issuedToMode, setIssuedToMode] = useState<IssuedToMode>('none')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (asset) {
      // Determine mode from existing data
      const mode: IssuedToMode = asset.issued_to_employee_id
        ? 'employee'
        : asset.issued_to_branch_id
        ? 'branch'
        : 'none'
      setIssuedToMode(mode)
      setForm({
        date_acquired: asset.date_acquired || '',
        particulars: asset.particulars || '',
        asset_id: asset.asset_id || '',
        serial_no: asset.serial_no || '',
        cost_per_unit: asset.cost_per_unit?.toString() || '',
        issued_to_employee_id: asset.issued_to_employee_id || '',
        issued_to_branch_id: asset.issued_to_branch_id || '',
        location: asset.location || '',
        date_issued: asset.date_issued || '',
        notes: asset.notes || '',
        status: asset.status || 'Available',
        category_id: asset.category_id || '',
        branch_id: asset.branch_id || '',
      })
    } else {
      setIssuedToMode('none')
    }
  }, [asset])

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  const handleModeChange = (mode: IssuedToMode) => {
    setIssuedToMode(mode)
    // Clear the other assignment field
    if (mode === 'employee') set('issued_to_branch_id', '')
    if (mode === 'branch') set('issued_to_employee_id', '')
    if (mode === 'none') {
      set('issued_to_employee_id', '')
      set('issued_to_branch_id', '')
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.particulars.trim()) e.particulars = 'Particulars is required'
    if (!form.asset_id.trim()) e.asset_id = 'Asset ID is required'
    return e
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)

    if (!isEdit || (isEdit && form.asset_id !== asset?.asset_id)) {
      const { count } = await supabase.from('assets').select('id', { count: 'exact', head: true }).eq('asset_id', form.asset_id.trim())
      if (count && count > 0) {
        setErrors({ asset_id: 'Asset ID already exists' })
        setSaving(false)
        return
      }
    }

    // Auto-set status based on assignment
    // Auto-set status based on assignment
    let autoStatus = form.status
    if ((form.issued_to_employee_id || form.issued_to_branch_id) && form.status === 'Available') {
      autoStatus = 'Working'
    }

    const payload = {
      date_acquired: form.date_acquired || null,
      particulars: form.particulars.trim(),
      asset_id: form.asset_id.trim(),
      serial_no: form.serial_no.trim() || null,
      cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
      issued_to_employee_id: form.issued_to_employee_id || null,
      issued_to_branch_id: form.issued_to_branch_id || null,
      location: form.location.trim() || null,
      date_issued: form.date_issued || null,
      notes: form.notes.trim() || null,
      status: autoStatus,
      category_id: form.category_id || null,
      branch_id: form.branch_id || null,
      updated_at: new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('assets').update(payload).eq('id', asset!.id)
      if (!error) {
        await supabase.from('asset_history').insert({
          asset_id: asset!.id,
          changed_by_name: userProfile?.full_name || userProfile?.email || 'System',
          action: 'Asset Updated',
          previous_value: asset!.status,
          new_value: autoStatus,
          notes: `Updated by ${userProfile?.full_name || userProfile?.email}`,
        })
        await logAudit({ userProfile, action: `Updated asset ${form.asset_id}`, assetId: form.asset_id, previousValue: asset!.status, newValue: autoStatus })
        onSaved()
      }
    } else {
      const { data, error } = await supabase.from('assets').insert({ ...payload, created_at: new Date().toISOString() }).select().single()
      if (!error && data) {
        await supabase.from('asset_history').insert({
          asset_id: (data as Asset).id,
          changed_by_name: userProfile?.full_name || userProfile?.email || 'System',
          action: 'Asset Created',
          new_value: autoStatus,
          notes: `Created by ${userProfile?.full_name || userProfile?.email}`,
        })
        await logAudit({ userProfile, action: `Created asset ${form.asset_id} — ${form.particulars}`, assetId: form.asset_id })
        onSaved()
      }
    }
    setSaving(false)
  }

  const F = ({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit Asset — ${asset?.asset_id}` : 'Add New Asset'} size="2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F label="Particulars" name="particulars" required>
          <input className={`input ${errors.particulars ? 'border-red-400' : ''}`} value={form.particulars} onChange={e => set('particulars', e.target.value)} placeholder="e.g. Dell Latitude Laptop" />
        </F>
        <F label="Asset ID" name="asset_id" required>
          <input className={`input font-mono ${errors.asset_id ? 'border-red-400' : ''}`} value={form.asset_id} onChange={e => set('asset_id', e.target.value)} placeholder="e.g. LAP-001" />
        </F>
        <F label="Serial Number" name="serial_no">
          <input className="input font-mono" value={form.serial_no} onChange={e => set('serial_no', e.target.value)} placeholder="Manufacturer serial number" />
        </F>
        <F label="Category" name="category_id">
          <select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
            <option value="">Select category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <F label="Date Acquired" name="date_acquired">
          <DateInput value={form.date_acquired} onChange={v => set('date_acquired', v)} />
        </F>
        <F label="Cost Per Unit (₱)" name="cost_per_unit">
          <input type="number" min="0" step="0.01" className="input" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)} placeholder="0.00" />
        </F>
        <F label="Status" name="status">
          <select className="input" value={form.status} onChange={e => set('status', e.target.value as AssetStatus)}>
            {ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>
        <F label="Home Branch (Location)" name="branch_id">
          <select className="input" value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
            <option value="">Select branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </F>

        {/* Issued To — toggle between Employee / Branch / None */}
        <div className="md:col-span-2">
          <label className="label">Issued To</label>
          <div className="flex gap-2 mb-3">
            {([
              { key: 'none',     label: '— Unassigned —' },
              { key: 'employee', label: 'Employee' },
              { key: 'branch',   label: 'Branch / Office' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleModeChange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  issuedToMode === opt.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {issuedToMode === 'employee' && (
            <select className="input" value={form.issued_to_employee_id} onChange={e => set('issued_to_employee_id', e.target.value)}>
              <option value="">Select employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}

          {issuedToMode === 'branch' && (
            <select className="input" value={form.issued_to_branch_id} onChange={e => set('issued_to_branch_id', e.target.value)}>
              <option value="">Select branch / office...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {issuedToMode === 'none' && (
            <p className="text-xs text-gray-400 italic">Asset will be marked as unassigned</p>
          )}
        </div>

        <F label="Date Issued" name="date_issued">
          <DateInput value={form.date_issued} onChange={v => set('date_issued', v)} />
        </F>

        <F label="Location / Installed At" name="location">
          <input
            className="input"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="e.g. Accounting Office, Loan Department, Server Room"
            list="location-suggestions"
          />
          <datalist id="location-suggestions">
            {[
              'Accounting Office', 'Loan Department', 'Collection Department',
              'HR Department', 'IT Office', 'Operations', 'Finance Department',
              'Server Room', 'Conference Room', 'Reception', 'Warehouse',
            ].map(l => <option key={l} value={l} />)}
          </datalist>
        </F>

        <div className="md:col-span-2">
          <F label="Notes" name="notes">
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, condition, remarks..." />
          </F>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Asset'}
        </button>
      </div>
    </Modal>
  )
}

export default AssetFormModal
