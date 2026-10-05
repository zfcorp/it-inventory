import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Building2, GitBranch, Tag, ChevronRight, ChevronDown, FolderPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import type { Branch, Department, Category } from '../types'

type Section = 'branches' | 'departments' | 'categories'

// All unique groups from categories
const getGroups = (cats: Category[]): string[] => {
  const set = new Set(cats.map(c => c.type_group).filter(Boolean))
  return Array.from(set).sort()
}

const SettingsPage: React.FC = () => {
  const toast = useToast()
  const [section, setSection] = useState<Section>('branches')

  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Category modal state
  const [catModal, setCatModal] = useState<{ open: boolean; record?: Category }>({ open: false })
  const [catForm, setCatForm] = useState({ name: '', type_group: '', newGroup: '' })
  const [useNewGroup, setUseNewGroup] = useState(false)

  // Group rename modal
  const [groupModal, setGroupModal] = useState<{ open: boolean; oldName: string }>({ open: false, oldName: '' })
  const [groupNewName, setGroupNewName] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  // Expanded groups in the category list
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Branch/dept modal
  const [modal, setModal] = useState<{ open: boolean; type: 'branches' | 'departments'; record?: Branch | Department }>({ open: false, type: 'branches' })
  const [form, setForm] = useState({ name: '', location: '', branch_id: '' })

  const [deleteRecord, setDeleteRecord] = useState<{ id: string; label: string; type: Section } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [brRes, deptRes, catRes] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('departments').select(`*, branches(name)`).order('name'),
      supabase.from('categories').select('*').order('type_group').order('name'),
    ])
    if (brRes.data) setBranches(brRes.data as Branch[])
    if (deptRes.data) setDepartments(deptRes.data as Department[])
    if (catRes.data) {
      setCategories(catRes.data as Category[])
      // Expand all groups by default
      const groups = new Set((catRes.data as Category[]).map(c => c.type_group).filter(Boolean))
      setExpandedGroups(groups)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Category handlers ────────────────────────────────────────────────────
  const openAddCat = () => {
    const groups = getGroups(categories)
    setCatForm({ name: '', type_group: groups[0] || '', newGroup: '' })
    setUseNewGroup(false)
    setCatModal({ open: true })
  }

  const openEditCat = (c: Category) => {
    setCatForm({ name: c.name, type_group: c.type_group, newGroup: '' })
    setUseNewGroup(false)
    setCatModal({ open: true, record: c })
  }

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) { toast('error', 'Category name is required'); return }
    const group = useNewGroup ? catForm.newGroup.trim() : catForm.type_group
    if (!group) { toast('error', 'Group is required'); return }
    setSaving(true)
    const payload = { name: catForm.name.trim(), type_group: group, is_custom: true }
    if (catModal.record) {
      await supabase.from('categories').update(payload).eq('id', catModal.record.id)
      toast('success', 'Category updated')
    } else {
      await supabase.from('categories').insert({ ...payload, created_at: new Date().toISOString() })
      toast('success', 'Category added')
    }
    setSaving(false)
    setCatModal({ open: false })
    fetchAll()
  }

  // Rename a whole group (updates all categories in that group)
  const handleRenameGroup = async () => {
    if (!groupNewName.trim()) { toast('error', 'Group name is required'); return }
    if (groupNewName.trim() === groupModal.oldName) { setGroupModal({ open: false, oldName: '' }); return }
    setSavingGroup(true)
    const { error } = await supabase.from('categories')
      .update({ type_group: groupNewName.trim() })
      .eq('type_group', groupModal.oldName)
    if (error) toast('error', 'Failed to rename group')
    else toast('success', `Group renamed to "${groupNewName.trim()}"`)
    setSavingGroup(false)
    setGroupModal({ open: false, oldName: '' })
    setGroupNewName('')
    fetchAll()
  }

  // Delete an entire group (deletes all categories in it — only custom ones)
  const handleDeleteGroup = async (groupName: string) => {
    const catsInGroup = categories.filter(c => c.type_group === groupName)
    const hasDefault = catsInGroup.some(c => !c.is_custom)
    if (hasDefault) { toast('error', 'Cannot delete a group that contains default categories'); return }
    const { error } = await supabase.from('categories').delete().eq('type_group', groupName)
    if (error) toast('error', 'Failed to delete group')
    else toast('success', `Group "${groupName}" deleted`)
    fetchAll()
  }

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  // ── Branch / Dept handlers ────────────────────────────────────────────────
  const openAddBD = (type: 'branches' | 'departments') => {
    setForm({ name: '', location: '', branch_id: '' })
    setModal({ open: true, type })
  }
  const openEditBD = (type: 'branches' | 'departments', record: Branch | Department) => {
    if (type === 'branches') {
      const b = record as Branch
      setForm(f => ({ ...f, name: b.name, location: b.location || '' }))
    } else {
      const d = record as Department
      setForm(f => ({ ...f, name: d.name, branch_id: d.branch_id || '' }))
    }
    setModal({ open: true, type, record })
  }

  const handleSaveBD = async () => {
    if (!form.name.trim()) { toast('error', 'Name is required'); return }
    setSaving(true)
    const { type, record } = modal
    const isEdit = !!record
    if (type === 'branches') {
      const payload = { name: form.name.trim(), location: form.location || null }
      if (isEdit) await supabase.from('branches').update(payload).eq('id', record!.id)
      else await supabase.from('branches').insert({ ...payload, created_at: new Date().toISOString() })
    } else {
      const payload = { name: form.name.trim(), branch_id: form.branch_id || null }
      if (isEdit) await supabase.from('departments').update(payload).eq('id', record!.id)
      else await supabase.from('departments').insert({ ...payload, created_at: new Date().toISOString() })
    }
    toast('success', `${type === 'branches' ? 'Branch' : 'Department'} ${isEdit ? 'updated' : 'added'}`)
    setSaving(false)
    setModal({ open: false, type })
    fetchAll()
  }

  const handleDelete = async () => {
    if (!deleteRecord) return
    setDeleting(true)
    const { error } = await supabase.from(deleteRecord.type).delete().eq('id', deleteRecord.id)
    if (error) toast('error', 'Cannot delete — it may be in use')
    else toast('success', 'Deleted successfully')
    setDeleting(false)
    setDeleteRecord(null)
    fetchAll()
  }

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'branches',    label: 'Branches',    icon: <GitBranch size={16} /> },
    { key: 'departments', label: 'Departments', icon: <Building2 size={16} /> },
    { key: 'categories',  label: 'Categories',  icon: <Tag size={16} /> },
  ]

  const groups = getGroups(categories)

  return (
    <div className="max-w-4xl space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (

        <div className="card">
          {/* ── Branches ── */}
          {section === 'branches' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Branches</h2>
                <button onClick={() => openAddBD('branches')} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Add Branch</button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100"><th className="table-header">Name</th><th className="table-header">Location</th><th className="table-header w-20">Actions</th></tr></thead>
                <tbody>
                  {branches.map(b => (
                    <tr key={b.id} className="table-row">
                      <td className="table-cell font-medium">{b.name}</td>
                      <td className="table-cell text-gray-500">{b.location || '—'}</td>
                      <td className="table-cell"><div className="flex gap-1">
                        <button onClick={() => openEditBD('branches', b)} className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteRecord({ id: b.id, label: b.name, type: 'branches' })} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={13} /></button>
                      </div></td>
                    </tr>
                  ))}
                  {branches.length === 0 && <tr><td colSpan={3} className="table-cell text-center text-gray-400 py-6">No branches yet</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* ── Departments ── */}
          {section === 'departments' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Departments</h2>
                <button onClick={() => openAddBD('departments')} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Add Department</button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100"><th className="table-header">Name</th><th className="table-header">Branch</th><th className="table-header w-20">Actions</th></tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id} className="table-row">
                      <td className="table-cell font-medium">{d.name}</td>
                      <td className="table-cell text-gray-500">{d.branches?.name || '—'}</td>
                      <td className="table-cell"><div className="flex gap-1">
                        <button onClick={() => openEditBD('departments', d)} className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteRecord({ id: d.id, label: d.name, type: 'departments' })} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={13} /></button>
                      </div></td>
                    </tr>
                  ))}
                  {departments.length === 0 && <tr><td colSpan={3} className="table-cell text-center text-gray-400 py-6">No departments yet</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* ── Categories ── */}
          {section === 'categories' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Categories</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCatForm({ name: '', type_group: '', newGroup: '' })
                      setUseNewGroup(true)
                      setCatModal({ open: true })
                    }}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <FolderPlus size={14} /> New Group
                  </button>
                  <button onClick={openAddCat} className="btn-primary text-sm flex items-center gap-1.5">
                    <Plus size={14} /> Add Category
                  </button>
                </div>
              </div>

              {groups.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No categories yet. Add a group first.</p>
              )}

              <div className="space-y-2">
                {groups.map(group => {
                  const groupCats = categories.filter(c => c.type_group === group)
                  const isExpanded = expandedGroups.has(group)
                  const allDefault = groupCats.every(c => !c.is_custom)

                  return (
                    <div key={group} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Group header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <button onClick={() => toggleGroup(group)} className="flex items-center gap-2 flex-1 text-left">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-gray-400" />
                            : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-sm font-bold text-gray-700">{group}</span>
                          <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{groupCats.length}</span>
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setGroupModal({ open: true, oldName: group }); setGroupNewName(group) }}
                            className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg text-gray-400 transition-colors"
                            title="Rename group"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!allDefault && (
                            <button
                              onClick={() => handleDeleteGroup(group)}
                              className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-400 transition-colors"
                              title="Delete group and all its categories"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setCatForm({ name: '', type_group: group, newGroup: '' })
                              setUseNewGroup(false)
                              setCatModal({ open: true })
                            }}
                            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-gray-400 transition-colors"
                            title="Add category to this group"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Category rows */}
                      {isExpanded && (
                        <div>
                          {groupCats.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-blue-50/30 transition-colors group">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-4 flex-shrink-0" />
                              <span className="flex-1 text-sm text-gray-700">{c.name}</span>
                              {c.is_custom
                                ? <span className="text-[10px] bg-violet-100 text-violet-600 font-semibold px-1.5 py-0.5 rounded-full">Custom</span>
                                : <span className="text-[10px] text-gray-400">Default</span>}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditCat(c)} className="p-1.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg"><Edit2 size={12} /></button>
                                {c.is_custom && (
                                  <button onClick={() => setDeleteRecord({ id: c.id, label: c.name, type: 'categories' })} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={12} /></button>
                                )}
                              </div>
                            </div>
                          ))}
                          {groupCats.length === 0 && (
                            <p className="text-xs text-gray-400 px-8 py-3 italic">No categories in this group</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Add/Edit Category Modal ── */}
      <Modal open={catModal.open} onClose={() => setCatModal({ open: false })}
        title={catModal.record ? `Edit Category — ${catModal.record.name}` : 'Add Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Category Name <span className="text-red-500">*</span></label>
            <input className="input" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gaming Laptop, IP Camera" />
          </div>

          <div>
            <label className="label">Group <span className="text-red-500">*</span></label>
            {!useNewGroup ? (
              <div className="space-y-2">
                <select
                  className="input"
                  value={catForm.type_group}
                  onChange={e => setCatForm(f => ({ ...f, type_group: e.target.value }))}
                >
                  <option value="">Select a group...</option>
                  {groups.map(g => <option key={g}>{g}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setUseNewGroup(true)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <FolderPlus size={12} /> Create a new group instead
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="input"
                  value={catForm.newGroup}
                  onChange={e => setCatForm(f => ({ ...f, newGroup: e.target.value }))}
                  placeholder="e.g. Security Equipment, Audio Visual"
                  autoFocus
                />
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseNewGroup(false)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ← Pick an existing group
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCatModal({ open: false })} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveCat} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : catModal.record ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Rename Group Modal ── */}
      <Modal open={groupModal.open} onClose={() => setGroupModal({ open: false, oldName: '' })}
        title={`Rename Group — "${groupModal.oldName}"`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">New Group Name <span className="text-red-500">*</span></label>
            <input
              className="input"
              value={groupNewName}
              onChange={e => setGroupNewName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5">
              This will rename the group for all {categories.filter(c => c.type_group === groupModal.oldName).length} categories inside it.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setGroupModal({ open: false, oldName: '' })} className="btn-secondary">Cancel</button>
            <button onClick={handleRenameGroup} disabled={savingGroup} className="btn-primary">
              {savingGroup ? 'Renaming...' : 'Rename Group'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Add/Edit Branch / Dept Modal ── */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, type: 'branches' })}
        title={`${modal.record ? 'Edit' : 'Add'} ${modal.type === 'branches' ? 'Branch' : 'Department'}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {modal.type === 'branches' && (
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Makati, Metro Manila" />
            </div>
          )}
          {modal.type === 'departments' && (
            <div>
              <label className="label">Branch</label>
              <select className="input" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                <option value="">Select branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal({ open: false, type: 'branches' })} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveBD} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteRecord} onClose={() => setDeleteRecord(null)} onConfirm={handleDelete}
        title="Delete" message={`Delete "${deleteRecord?.label}"? This cannot be undone.`} loading={deleting} />
    </div>
  )
}

export default SettingsPage
