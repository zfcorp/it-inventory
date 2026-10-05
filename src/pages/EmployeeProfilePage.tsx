import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, LogIn, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatDate } from '../utils/constants'
import { logAudit } from '../utils/auditLogger'
import DateInput from '../components/ui/DateInput'
import type { Employee, Asset } from '../types'

const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const toast = useToast()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0])
  const [assigning, setAssigning] = useState(false)
  const [returningId, setReturningId] = useState<string | null>(null)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)

    // Get category IDs for network equipment — these are location-based, not person-assigned
    const { data: networkCats } = await supabase
      .from('categories')
      .select('id')
      .eq('type_group', 'Network Equipment')

    const networkCatIds = (networkCats || []).map((c: { id: string }) => c.id)

    const [empRes, assetsRes, availRes] = await Promise.all([
      supabase.from('employees').select(`*, departments(id,name), branches(id,name)`).eq('id', id).single(),
      supabase.from('assets').select(`*, categories(name)`).eq('issued_to_employee_id', id).order('particulars'),
      // Exclude network equipment from the assignable list
      networkCatIds.length > 0
        ? supabase.from('assets')
            .select('id, asset_id, particulars, categories(name)')
            .in('status', ['Available', 'Working'])
            .is('issued_to_employee_id', null)
            .not('category_id', 'in', `(${networkCatIds.join(',')})`)
            .order('particulars')
        : supabase.from('assets')
            .select('id, asset_id, particulars, categories(name)')
            .in('status', ['Available', 'Working'])
            .is('issued_to_employee_id', null)
            .order('particulars'),
    ])

    if (empRes.data) setEmployee(empRes.data as Employee)
    if (assetsRes.data) setAssets(assetsRes.data as Asset[])
    if (availRes.data) setAvailableAssets(availRes.data as unknown as Asset[])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAssign = async () => {
    if (!selectedAsset || !employee) return
    setAssigning(true)
    const { error } = await supabase.from('assets').update({
      issued_to_employee_id: employee.id,
      date_issued: dateIssued,
      status: 'Working',
      updated_at: new Date().toISOString(),
    }).eq('id', selectedAsset)

    if (!error) {
      const assetData = availableAssets.find(a => a.id === selectedAsset)
      await supabase.from('asset_history').insert({
        asset_id: selectedAsset,
        changed_by_name: userProfile?.full_name || userProfile?.email || 'System',
        action: 'Assigned to Employee',
        new_value: 'Working',
        employee_id: employee.id,
        employee_name: employee.name,
        notes: `Assigned to ${employee.name} on ${dateIssued}`,
      })
      await logAudit({ userProfile, action: `Assigned ${assetData?.asset_id || 'asset'} to ${employee.name}`, assetId: assetData?.asset_id })
      toast('success', `Asset assigned to ${employee.name}`)
      setAssignModal(false)
      setSelectedAsset('')
      fetchAll()
    } else {
      toast('error', 'Failed to assign asset')
    }
    setAssigning(false)
  }

  const handleReturn = async (asset: Asset) => {
    setReturningId(asset.id)
    const { error } = await supabase.from('assets').update({
      issued_to_employee_id: null,
      date_issued: null,
      status: 'Available',
      updated_at: new Date().toISOString(),
    }).eq('id', asset.id)

    if (!error) {
      await supabase.from('asset_history').insert({
        asset_id: asset.id,
        changed_by_name: userProfile?.full_name || userProfile?.email || 'System',
        action: 'Returned by Employee',
        previous_value: 'Working',
        new_value: 'Available',
        employee_id: employee!.id,
        employee_name: employee!.name,
        notes: `Returned by ${employee!.name} on ${new Date().toISOString().split('T')[0]}`,
      })
      await logAudit({ userProfile, action: `${employee!.name} returned ${asset.asset_id}`, assetId: asset.asset_id, previousValue: 'Working', newValue: 'Available' })
      toast('success', `${asset.asset_id} returned successfully`)
      fetchAll()
    } else {
      toast('error', 'Failed to return asset')
    }
    setReturningId(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
  if (!employee) return <div className="text-center py-16 text-gray-400">Employee not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/employees')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{employee.name}</h1>
          <div className="flex gap-2 mt-1 text-sm text-gray-500">
            {employee.departments?.name && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{employee.departments.name}</span>}
            {employee.branches?.name && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">{employee.branches.name}</span>}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setAssignModal(true)} className="btn-primary flex items-center gap-2">
            <LogIn size={15} /> Assign Asset
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="card grid grid-cols-3 gap-4 text-sm">
        <div><p className="text-gray-400 text-xs mb-0.5">Email</p><p className="font-medium">{employee.email || '—'}</p></div>
        <div><p className="text-gray-400 text-xs mb-0.5">Phone</p><p className="font-medium">{employee.phone || '—'}</p></div>
        <div><p className="text-gray-400 text-xs mb-0.5">Total Assets</p><p className="font-bold text-blue-600 text-lg">{assets.length}</p></div>
      </div>

      {/* Assets Table */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Assigned Equipment</h2>
        {assets.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">No equipment assigned</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Asset</th>
                <th className="table-header">Asset ID</th>
                <th className="table-header">Serial No.</th>
                <th className="table-header">Category</th>
                <th className="table-header">Date Issued</th>
                <th className="table-header">Status</th>
                {canEdit && <th className="table-header">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="table-cell font-medium">{a.particulars}</td>
                  <td className="table-cell">
                    <button onClick={() => navigate(`/inventory/${a.id}`)} className={`font-mono hover:underline ${a.asset_id ? 'text-blue-600' : 'text-amber-500 italic'}`}>
                        {a.asset_id || 'No Asset ID'}
                      </button>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-500">{a.serial_no || '—'}</td>
                  <td className="table-cell text-gray-500">{a.categories?.name || '—'}</td>
                  <td className="table-cell">{formatDate(a.date_issued)}</td>
                  <td className="table-cell"><StatusBadge status={a.status} size="sm" /></td>
                  {canEdit && (
                    <td className="table-cell">
                      <button
                        onClick={() => handleReturn(a)}
                        disabled={returningId === a.id}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <LogOut size={12} /> {returningId === a.id ? '...' : 'Return'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={`Assign Asset to ${employee.name}`} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Select Asset <span className="text-gray-400 font-normal normal-case">(Available/Working · excludes network equipment)</span></label>
            <select className="input" value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
              <option value="">Choose an asset...</option>
              {availableAssets.map(a => <option key={a.id} value={a.id}>{a.asset_id} — {a.particulars}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date Issued</label>
            <DateInput value={dateIssued} onChange={setDateIssued} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setAssignModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAssign} disabled={!selectedAsset || assigning} className="btn-primary">
              {assigning ? 'Assigning...' : 'Assign Asset'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeProfilePage
