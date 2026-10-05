import React, { useEffect, useState, useCallback } from 'react'
import { Plus, UserCog, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { logAudit } from '../utils/auditLogger'
import type { UserProfile, UserRole } from '../types'

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  staff: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
}

const UsersPage: React.FC = () => {
  const { userProfile } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'staff' as UserRole })
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('user_profiles').select('*').order('created_at')
    if (data) setUsers(data as UserProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleAddUser = async () => {
    if (!form.email || !form.password) { toast('error', 'Email and password required'); return }
    setSaving(true)
    // Create Supabase Auth user via admin API (requires service role key in real deployment)
    // For now, we insert directly into user_profiles for demo purposes
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { toast('error', error.message); setSaving(false); return }
    if (data.user) {
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name || null,
        role: form.role,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      await logAudit({ userProfile, action: `Created user ${form.email} with role ${form.role}` })
      toast('success', `User ${form.email} created. They can now log in.`)
      setAddModal(false)
      setForm({ email: '', full_name: '', password: '', role: 'staff' })
      fetchUsers()
    }
    setSaving(false)
  }

  const handleEditRole = async () => {
    if (!editUser) return
    setSaving(true)
    const { error } = await supabase.from('user_profiles').update({ role: form.role, full_name: form.full_name || null }).eq('id', editUser.id)
    if (!error) {
      await logAudit({ userProfile, action: `Changed ${editUser.email} role to ${form.role}`, previousValue: editUser.role, newValue: form.role })
      toast('success', 'User updated')
      setEditUser(null)
      fetchUsers()
    } else toast('error', 'Failed to update user')
    setSaving(false)
  }

  const openEdit = (u: UserProfile) => {
    setForm(f => ({ ...f, role: u.role, full_name: u.full_name || '', password: '' }))
    setEditUser(u)
  }

  const handleToggleActive = async (u: UserProfile) => {
    await supabase.from('user_profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    await logAudit({ userProfile, action: `${u.is_active ? 'Deactivated' : 'Reactivated'} user ${u.email}` })
    toast('success', u.is_active ? 'User deactivated' : 'User reactivated')
    fetchUsers()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ email: '', full_name: '', password: '', role: 'staff' }); setAddModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Name</th>
              <th className="table-header">Email</th>
              <th className="table-header">Role</th>
              <th className="table-header">Status</th>
              <th className="table-header">Created</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center"><LoadingSpinner /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-8">
                <EmptyState title="No users yet" icon={<UserCog size={28} className="text-gray-400" />} />
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={`table-row ${!u.is_active ? 'opacity-50' : ''}`}>
                <td className="table-cell font-medium">{u.full_name || <span className="text-gray-400">—</span>}</td>
                <td className="table-cell">{u.email}</td>
                <td className="table-cell">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                </td>
                <td className="table-cell">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-cell text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    {u.id !== userProfile?.id && (
                      <>
                        <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg" title="Edit"><Edit2 size={14} /></button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs px-2 py-1 rounded-lg font-medium ${u.is_active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-green-50 hover:text-green-600'}`}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </>
                    )}
                    {u.id === userProfile?.id && <span className="text-xs text-gray-400 px-2">You</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add System User" size="md">
        <div className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan dela Cruz" /></div>
          <div><label className="label">Email <span className="text-red-500">*</span></label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Password <span className="text-red-500">*</span></label><input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="viewer">Viewer (Management)</option>
              <option value="staff">IT Staff</option>
              <option value="admin">IT Administrator</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddUser} disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create User'}</button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.email}`} size="md">
        <div className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="viewer">Viewer (Management)</option>
              <option value="staff">IT Staff</option>
              <option value="admin">IT Administrator</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleEditRole} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default UsersPage
