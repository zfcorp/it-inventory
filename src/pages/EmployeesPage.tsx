import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit2, Trash2, Users, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logAudit } from '../utils/auditLogger'
import type { Employee, Department, Branch } from '../types'

interface ParsedEmployee {
  row: number
  name: string
  department: string
  branch: string
  email: string
  phone: string
  error?: string
}

const EmployeesPage: React.FC = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const toast = useToast()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; employee?: Employee }>({ open: false })
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ name: '', department_id: '', branch_id: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Import state
  const [importModal, setImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ParsedEmployee[]>([])
  const [importStage, setImportStage] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importSummary, setImportSummary] = useState({ imported: 0, skipped: 0 })
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [empRes, deptRes, brRes] = await Promise.all([
      supabase.from('employees').select(`*, departments(id,name), branches(id,name)`).order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
    ])
    if (empRes.data) setEmployees(empRes.data as Employee[])
    if (deptRes.data) setDepartments(deptRes.data as Department[])
    if (brRes.data) setBranches(brRes.data as Branch[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Department', 'Branch', 'Email', 'Phone'],
      ['Juan Dela Cruz', 'Operations', 'Main Office', 'juan@company.com', '+63 912 345 6789'],
    ])
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees Template')
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx')
  }

  const parseEmployeeFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const existingNames = new Set(employees.map(e => e.name.toLowerCase().trim()))

      const parsed: ParsedEmployee[] = raw.map((r, i) => {
        const name = String(r['Name'] || r['name'] || r['Full Name'] || '').trim()
        let error: string | undefined
        if (!name) error = 'Name is required'
        else if (existingNames.has(name.toLowerCase())) error = `"${name}" already exists`
        return {
          row: i + 2,
          name,
          department: String(r['Department'] || r['department'] || '').trim(),
          branch: String(r['Branch'] || r['branch'] || '').trim(),
          email: String(r['Email'] || r['email'] || '').trim(),
          phone: String(r['Phone'] || r['phone'] || '').trim(),
          error,
        }
      })
      setImportRows(parsed)
      setImportStage('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImportConfirm = async () => {
    setImporting(true)
    const valid = importRows.filter(r => !r.error)
    let imported = 0
    for (const row of valid) {
      const dept = departments.find(d => d.name.toLowerCase() === row.department.toLowerCase())
      const branch = branches.find(b => b.name.toLowerCase() === row.branch.toLowerCase())
      const { error } = await supabase.from('employees').insert({
        name: row.name,
        department_id: dept?.id || null,
        branch_id: branch?.id || null,
        email: row.email || null,
        phone: row.phone || null,
        created_at: new Date().toISOString(),
      })
      if (!error) imported++
    }
    await logAudit({ userProfile, action: `Imported ${imported} employees via Excel/CSV` })
    setImportSummary({ imported, skipped: valid.length - imported + importRows.filter(r => r.error).length })
    setImportStage('done')
    setImporting(false)
    fetchAll()
  }

  const resetImport = () => {
    setImportRows([])
    setImportStage('upload')
    setImportSummary({ imported: 0, skipped: 0 })
    if (fileRef.current) fileRef.current.value = ''
  }

  const openAdd = () => { setForm({ name: '', department_id: '', branch_id: '', email: '', phone: '' }); setErrors({}); setModal({ open: true }) }
  const openEdit = (emp: Employee) => { setForm({ name: emp.name, department_id: emp.department_id || '', branch_id: emp.branch_id || '', email: emp.email || '', phone: emp.phone || '' }); setErrors({}); setModal({ open: true, employee: emp }) }

  const handleSave = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { name: form.name.trim(), department_id: form.department_id || null, branch_id: form.branch_id || null, email: form.email || null, phone: form.phone || null }
    if (modal.employee) {
      const { error } = await supabase.from('employees').update(payload).eq('id', modal.employee.id)
      if (!error) { toast('success', 'Employee updated'); await logAudit({ userProfile, action: `Updated employee ${form.name}` }) }
      else toast('error', 'Failed to update employee')
    } else {
      const { error } = await supabase.from('employees').insert({ ...payload, created_at: new Date().toISOString() })
      if (!error) { toast('success', 'Employee added'); await logAudit({ userProfile, action: `Added employee ${form.name}` }) }
      else toast('error', 'Failed to add employee')
    }
    setSaving(false)
    setModal({ open: false })
    fetchAll()
  }

  const handleDelete = async () => {
    if (!deleteEmp) return
    setDeleting(true)
    const { error } = await supabase.from('employees').delete().eq('id', deleteEmp.id)
    if (error) toast('error', 'Cannot delete employee with assigned assets')
    else { toast('success', 'Employee deleted'); await logAudit({ userProfile, action: `Deleted employee ${deleteEmp.name}` }) }
    setDeleting(false)
    setDeleteEmp(null)
    fetchAll()
  }

  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.departments?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." className="input pl-9 py-2" />
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={downloadTemplate} className="btn-secondary text-sm flex items-center gap-1.5">
              <Download size={14} /> Template
            </button>
            <button onClick={() => { resetImport(); setImportModal(true) }} className="btn-secondary text-sm flex items-center gap-1.5">
              <Upload size={14} /> Import
            </button>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Employee
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Name</th>
              <th className="table-header">Department</th>
              <th className="table-header">Branch</th>
              <th className="table-header">Email</th>
              <th className="table-header">Phone</th>
              <th className="table-header w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center"><LoadingSpinner /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8">
                <EmptyState title="No employees found" message="Add employees to track equipment assignments" icon={<Users size={28} className="text-gray-400" />}
                  action={canEdit ? <button onClick={openAdd} className="btn-primary text-sm">Add Employee</button> : undefined} />
              </td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id} className="table-row">
                <td className="table-cell font-medium text-gray-900">{emp.name}</td>
                <td className="table-cell">{emp.departments?.name || '—'}</td>
                <td className="table-cell">{emp.branches?.name || '—'}</td>
                <td className="table-cell text-gray-500">{emp.email || '—'}</td>
                <td className="table-cell text-gray-500">{emp.phone || '—'}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/employees/${emp.id}`)} className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg" title="View Profile"><Eye size={14} /></button>
                    {canEdit && <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg" title="Edit"><Edit2 size={14} /></button>}
                    {role === 'admin' && <button onClick={() => setDeleteEmp(emp)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg" title="Delete"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.employee ? 'Edit Employee' : 'Add Employee'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input className={`input ${errors.name ? 'border-red-400' : ''}`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Dela Cruz" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Select department...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Branch</label>
            <select className="input" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
              <option value="">Select branch...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@company.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal({ open: false })} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : modal.employee ? 'Save Changes' : 'Add Employee'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteEmp} onClose={() => setDeleteEmp(null)} onConfirm={handleDelete}
        title="Delete Employee" message={`Delete ${deleteEmp?.name}? Assets assigned to this employee will become unassigned.`}
        confirmLabel="Delete" loading={deleting} />

      {/* Import Modal */}
      <Modal open={importModal} onClose={() => { setImportModal(false); resetImport() }} title="Import Employees" size="xl">
        {importStage === 'upload' && (
          <div className="text-center py-6">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-12 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all"
            >
              <Upload size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Click to upload Excel or CSV</p>
              <p className="text-xs text-gray-400 mt-1">Columns: Name, Department, Branch, Email, Phone</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) parseEmployeeFile(f) }} className="hidden" />
            <p className="text-xs text-gray-400 mt-4">
              Don't have a template?{' '}
              <button onClick={downloadTemplate} className="text-blue-600 hover:underline font-medium">Download it here</button>
            </p>
          </div>
        )}

        {importStage === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl text-sm">
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle size={14} /> {importRows.filter(r => !r.error).length} valid
              </span>
              {importRows.filter(r => r.error).length > 0 && (
                <span className="text-red-600 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} /> {importRows.filter(r => r.error).length} with errors (will be skipped)
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="table-header">Row</th>
                    <th className="table-header">Name</th>
                    <th className="table-header">Department</th>
                    <th className="table-header">Branch</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map(r => (
                    <tr key={r.row} className={`border-b border-gray-50 ${r.error ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className="table-cell text-gray-400">{r.row}</td>
                      <td className="table-cell font-medium">{r.name || <span className="text-gray-300">—</span>}</td>
                      <td className="table-cell text-gray-500">{r.department || '—'}</td>
                      <td className="table-cell text-gray-500">{r.branch || '—'}</td>
                      <td className="table-cell text-gray-500">{r.email || '—'}</td>
                      <td className="table-cell">
                        {r.error
                          ? <span className="text-red-500 font-medium">{r.error}</span>
                          : <span className="text-emerald-600 font-semibold">✓ Ready</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button onClick={resetImport} className="btn-secondary text-sm">Re-upload</button>
              <button
                onClick={handleImportConfirm}
                disabled={importRows.filter(r => !r.error).length === 0 || importing}
                className="btn-primary text-sm"
              >
                {importing ? 'Importing...' : `Import ${importRows.filter(r => !r.error).length} Employees`}
              </button>
            </div>
          </div>
        )}

        {importStage === 'done' && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Import Complete</h3>
            <p className="text-gray-500 text-sm mt-2">
              <span className="font-semibold text-emerald-600">{importSummary.imported} imported</span>
              {importSummary.skipped > 0 && <> · <span className="font-semibold text-red-500">{importSummary.skipped} skipped</span></>}
            </p>
            <button onClick={() => { setImportModal(false); resetImport() }} className="btn-primary mt-6">Done</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default EmployeesPage
