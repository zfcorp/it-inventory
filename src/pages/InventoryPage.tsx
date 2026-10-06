import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Download, Upload, FileSpreadsheet, Filter, X, Eye, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import StatusBadge from '../components/ui/StatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import DateInput from '../components/ui/DateInput'
import { ASSET_STATUSES, formatPeso, formatDate } from '../utils/constants'
import { exportToExcel, exportToCSV, downloadInventoryTemplate, downloadPhoneTemplate, assetsToExportRows } from '../utils/export'
import { logAudit } from '../utils/auditLogger'
import type { Asset, AssetStatus, Category, Branch, Employee } from '../types'
import AssetFormModal from '../components/AssetFormModal'
import ImportModal from '../components/ImportModal'

const PAGE_SIZE = 50

// Map sidebar tab key → category names in the DB
const TAB_CATEGORIES: Record<string, string[]> = {
  laptops:         ['Laptop'],
  pc:              ['Desktop PC'],
  printers:        ['Printer', 'Multifunction Printer'],
  routers:         ['Router', 'Access Point'],
  switches:        ['Hub Switch', 'Network Switch'],
  monitors:        ['Monitor'],
  peripherals:     ['Keyboard','Mouse','Headset','Webcam','Docking Station','Laptop Charger','Monitor Stand','USB Hub','HDMI Cable','Power Adapter','Other'],
  phones:          ['Company Phone'],
  'replaced-phones': ['Company Phone'],   // same category, filtered by status
  tablets:         ['Tablet'],
}

const TAB_LABELS: Record<string, string> = {
  '':               'All Inventory',
  laptops:          'Laptops',
  pc:               'PC',
  printers:         'Printers',
  routers:          'Routers',
  switches:         'HUB Switches',
  monitors:         'Monitors',
  peripherals:      'Peripherals',
  phones:           'Phones',
  'replaced-phones':'Replaced Phones',
  tablets:          'Tablets',
}

const InventoryPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userProfile } = useAuth()
  const toast = useToast()

  const [assets, setAssets] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const role = userProfile?.role || 'viewer'
  const canEdit = role === 'admin' || role === 'staff'
  const canDelete = role === 'admin'

  // Active tab from URL
  const activeTab = searchParams.get('tab') || ''

  // Other filters
  const search = searchParams.get('search') || ''
  const filterStatus = searchParams.get('status') || ''
  const filterBranch = searchParams.get('branch_id') || ''
  const filterDept = searchParams.get('department_id') || ''
  const filterDateFrom = searchParams.get('date_acquired_from') || ''
  const filterDateTo = searchParams.get('date_acquired_to') || ''
  const filterAssignment = searchParams.get('assignment') || ''

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams)
    if (value) p.set(key, value); else p.delete(key)
    p.delete('page')
    setPage(1)
    setSearchParams(p)
  }

  const clearFilters = () => {
    const p = new URLSearchParams()
    if (activeTab) p.set('tab', activeTab)
    setSearchParams(p)
    setPage(1)
  }

  const activeFilterCount = [search, filterStatus, filterBranch, filterDept, filterDateFrom, filterDateTo, filterAssignment].filter(Boolean).length

  const fetchAssets = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('assets')
      .select(`*, categories(id, name, type_group), branch:branch_id(id, name), employees(id, name, departments(id, name)), asset_details(detail_data)`, { count: 'exact' })

    // Tab-based category filter
    if (activeTab && TAB_CATEGORIES[activeTab]) {
      const catNames = TAB_CATEGORIES[activeTab]

      // Get matching category IDs from categories table
      const { data: cats } = await supabase.from('categories').select('id').in('name', catNames)
      const catIds = (cats || []).map((c: { id: string }) => c.id)

      // Build keyword patterns for particulars fallback (e.g. "Laptop" matches "LENOVO THINKPAD Laptop")
      const TAB_KEYWORDS: Record<string, string[]> = {
        laptops:           ['laptop', 'thinkpad', 'vivobook', 'ideapad', 'inspiron', 'aspire'],
        pc:                ['desktop', 'pc', 'imac', 'optiplex'],
        printers:          ['printer', 'laserjet', 'inkjet', 'epson', 'brother', 'canon'],
        routers:           ['router', 'access point', 'tp-link', 'cisco', 'ubiquiti'],
        switches:          ['switch', 'hub'],
        monitors:          ['monitor', 'display', 'screen', 'lcd', 'led'],
        peripherals:       ['keyboard', 'mouse', 'headset', 'webcam', 'docking', 'charger', 'usb hub', 'hdmi', 'adapter'],
        phones:            ['phone', 'iphone', 'samsung', 'android', 'mobile'],
        'replaced-phones': ['phone', 'iphone', 'samsung', 'android', 'mobile'],
        tablets:           ['tablet', 'ipad'],
      }
      const keywords = TAB_KEYWORDS[activeTab] || []

      if (catIds.length > 0 && keywords.length > 0) {
        // Match by category_id OR by particulars keywords
        const keywordFilters = keywords.map(k => `particulars.ilike.%${k}%`).join(',')
        const catFilter = catIds.map(id => `category_id.eq.${id}`).join(',')
        query = query.or(`${catFilter},${keywordFilters}`)
      } else if (catIds.length > 0) {
        query = query.in('category_id', catIds)
      } else if (keywords.length > 0) {
        // No categories found — fall back to keyword search on particulars
        const keywordFilters = keywords.map(k => `particulars.ilike.%${k}%`).join(',')
        query = query.or(keywordFilters)
      }

      // Special status filters for phone tabs
      if (activeTab === 'replaced-phones') query = query.eq('status', 'Replaced')
      if (activeTab === 'phones') query = query.neq('status', 'Replaced')
    }

    // Additional filters
    if (search) query = query.or(`asset_id.ilike.%${search}%,particulars.ilike.%${search}%,serial_no.ilike.%${search}%`)
    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterBranch) query = query.eq('branch_id', filterBranch)
    if (filterDateFrom) query = query.gte('date_acquired', filterDateFrom)
    if (filterDateTo) query = query.lte('date_acquired', filterDateTo)
    // Assignment filter
    if (filterAssignment === 'unassigned') {
      query = query.is('issued_to_employee_id', null)
    } else if (filterAssignment === 'assigned') {
      query = query.not('issued_to_employee_id', 'is', null)
    }

    query = query.order('no', { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) {
      console.error('Assets query error:', error)
      toast('error', `Query failed: ${error.message}`)
    }
    if (!error) { setAssets((data as Asset[]) || []); setTotal(count || 0) }
    setLoading(false)
  }, [activeTab, search, filterStatus, filterBranch, filterDateFrom, filterDateTo, page])

  const fetchLookups = useCallback(async () => {
    const [cat, br, emp, dept] = await Promise.all([
      supabase.from('categories').select('*').order('type_group').order('name'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('employees').select('id, name, department_id, departments(id, name)').order('name'),
      supabase.from('departments').select('id, name').order('name'),
    ])
    if (cat.data) setCategories(cat.data as Category[])
    if (br.data) setBranches(br.data as Branch[])
    if (emp.data) setEmployees(emp.data as unknown as Employee[])
    if (dept.data) setDepartments(dept.data as { id: string; name: string }[])
  }, [])

  useEffect(() => { fetchLookups() }, [fetchLookups])
  useEffect(() => { setPage(1) }, [activeTab])
  useEffect(() => { fetchAssets() }, [fetchAssets])

  const handleExportExcel = async () => {
    setExporting(true)
    const { data } = await supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).order('no')
    if (data) exportToExcel(assetsToExportRows(data as Asset[]), `IT_Inventory_${TAB_LABELS[activeTab] || 'All'}`)
    setExporting(false)
    toast('success', 'Exported to Excel')
  }

  const handleExportCSV = async () => {
    setExporting(true)
    const { data } = await supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).order('no')
    if (data) exportToCSV(assetsToExportRows(data as Asset[]), `IT_Inventory_${TAB_LABELS[activeTab] || 'All'}`)
    setExporting(false)
    toast('success', 'Exported to CSV')
  }

  const handleDelete = async () => {
    if (!deleteAsset) return
    setDeleteLoading(true)
    const { error } = await supabase.from('assets').delete().eq('id', deleteAsset.id)
    if (error) toast('error', 'Failed to delete asset')
    else {
      await logAudit({ userProfile, action: `Deleted asset ${deleteAsset.asset_id} (${deleteAsset.particulars})`, assetId: deleteAsset.asset_id })
      toast('success', `Asset ${deleteAsset.asset_id} deleted`)
      fetchAssets()
    }
    setDeleteLoading(false)
    setDeleteAsset(null)
  }

  const tabLabel = TAB_LABELS[activeTab] || 'All Inventory'

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-800">{tabLabel}</h2>
          {!loading && <p className="text-xs text-gray-400 mt-0.5">{total} asset{total !== 1 ? 's' : ''}</p>}
        </div>

        {/* Search */}
        <div className="relative min-w-52 flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Search asset ID, serial, name..."
            className="input pl-9 py-2 text-sm"
          />
          {search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary text-sm flex items-center gap-1.5 relative ${activeFilterCount > 0 ? 'border-blue-400 text-blue-600' : ''}`}
        >
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{activeFilterCount}</span>
          )}
        </button>

        {/* Export */}
        <div className="flex gap-1">
          <button
            onClick={() => (activeTab === 'phones' || activeTab === 'tablets' || activeTab === 'replaced-phones') ? downloadPhoneTemplate() : downloadInventoryTemplate()}
            className="btn-secondary text-sm px-3 flex items-center gap-1.5"
            title="Download import template"
          >
            <Download size={14} />
            <span className="hidden sm:inline">
              {(activeTab === 'phones' || activeTab === 'tablets' || activeTab === 'replaced-phones') ? 'Phone Template' : 'Template'}
            </span>
          </button>
          {canEdit && (
            <button onClick={() => setImportModal(true)} className="btn-secondary text-sm px-3 flex items-center gap-1.5">
              <Upload size={14} /><span className="hidden sm:inline">Import</span>
            </button>
          )}
          <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary text-sm px-3 flex items-center gap-1.5">
            <FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={handleExportCSV} disabled={exporting} className="btn-secondary text-sm px-3 flex items-center gap-1.5">
            <Download size={14} /><span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {canEdit && (
          <button onClick={() => setAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Asset
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Status</label>
              <select value={filterStatus} onChange={e => setFilter('status', e.target.value)} className="input text-sm py-2">
                <option value="">All Statuses</option>
                {ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Assignment</label>
              <select value={filterAssignment} onChange={e => setFilter('assignment', e.target.value)} className="input text-sm py-2">
                <option value="">All Assets</option>
                <option value="assigned">Assigned (has employee)</option>
                <option value="unassigned">Unassigned (no employee)</option>
              </select>
            </div>
            <div>
              <label className="label">Branch</label>
              <select value={filterBranch} onChange={e => setFilter('branch_id', e.target.value)} className="input text-sm py-2">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date Acquired From</label>
              <DateInput value={filterDateFrom} onChange={v => setFilter('date_acquired_from', v)} placeholder="01-Jan-26" />
            </div>
            <div>
              <label className="label">Date Acquired To</label>
              <DateInput value={filterDateTo} onChange={v => setFilter('date_acquired_to', v)} placeholder="31-Dec-26" />
            </div>
          </div>
          <button onClick={clearFilters} className="btn-secondary text-sm mt-3 flex items-center gap-1.5">
            <X size={13} /> Clear Filters
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* ── Phone / Tablet table ── */}
            {(activeTab === 'phones' || activeTab === 'tablets' || activeTab === 'replaced-phones') ? (
              <>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header w-10">No.</th>
                    <th className="table-header min-w-52">Unit</th>
                    <th className="table-header">Serial Number</th>
                    <th className="table-header">IMEI Number</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header min-w-36">Issued To</th>
                    <th className="table-header min-w-36">Returned By</th>
                    <th className="table-header">Status</th>
                    <th className="table-header min-w-44">Remarks</th>
                    <th className="table-header w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="py-16 text-center"><LoadingSpinner /></td></tr>
                  ) : assets.length === 0 ? (
                    <tr><td colSpan={10}>
                      <EmptyState
                        title={`No ${tabLabel.toLowerCase()} found`}
                        message={activeFilterCount > 0 ? 'Try clearing your filters' : 'No assets in this category yet'}
                        action={canEdit ? <button onClick={() => setAddModal(true)} className="btn-primary text-sm">Add Asset</button> : undefined}
                      />
                    </td></tr>
                  ) : assets.map(asset => {
                    // IMEI stored in asset_details — show from notes or serial for now
                    // Returned by — shown from notes if it contains "returned"
                    const imei = asset.serial_no || '—'
                    const issuedTo = asset.employees?.name || asset.location || '—'
                    // Parse "Returned By" from notes field
                    const notesText = asset.notes || ''
                    const returnedMatch = notesText.match(/returned\s+(?:by\s+)?([^,;\n]+)/i)
                    const returnedBy = returnedMatch ? returnedMatch[1].trim() : '—'
                    const remarks = notesText

                    return (
                      <tr key={asset.id} className="table-row">
                        <td className="table-cell text-center font-mono text-gray-300 text-xs">{asset.no}</td>
                        <td className="table-cell">
                          <div className="font-semibold text-gray-900 text-sm">{asset.particulars}</div>
                          <button
                            onClick={() => navigate(`/inventory/${asset.id}`)}
                            className={`font-mono text-xs hover:underline ${asset.asset_id ? 'text-blue-500' : 'text-amber-500 italic'}`}
                          >
                            {asset.asset_id || 'No Asset ID'}
                          </button>
                        </td>
                        <td className="table-cell font-mono text-xs text-gray-500">{asset.serial_no || '—'}</td>
                        <td className="table-cell font-mono text-xs text-gray-500">
                          {(() => {
                            type DetailEntry = { detail_data?: Record<string, string> }
                            const details = (asset as Asset & { asset_details?: DetailEntry | DetailEntry[] }).asset_details
                            const detailData = Array.isArray(details)
                              ? (details as DetailEntry[])[0]?.detail_data
                              : (details as DetailEntry | undefined)?.detail_data
                            return detailData?.['IMEI'] || detailData?.['IMEI Number'] || '—'
                          })()}
                        </td>
                        <td className="table-cell text-right text-xs font-semibold">{formatPeso(asset.cost_per_unit)}</td>
                        <td className="table-cell text-xs">
                          {asset.employees
                            ? <button onClick={() => navigate(`/employees/${asset.employees!.id}`)} className="text-blue-600 hover:underline">{asset.employees.name}</button>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="table-cell text-xs text-gray-500">{returnedBy}</td>
                        <td className="table-cell"><StatusBadge status={asset.status} size="sm" /></td>
                        <td className="table-cell">
                          <span className="text-gray-400 text-xs line-clamp-2">{remarks || '—'}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => navigate(`/inventory/${asset.id}`)} className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg" title="View"><Eye size={13} /></button>
                            {canEdit && <button onClick={() => setEditAsset(asset)} className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg" title="Edit"><Edit2 size={13} /></button>}
                            {canDelete && <button onClick={() => setDeleteAsset(asset)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg" title="Delete"><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </>
            ) : (
              /* ── Standard inventory table ── */
              <>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header w-10">No.</th>
                    <th className="table-header">Date Acquired</th>
                    <th className="table-header min-w-52">Particulars</th>
                    <th className="table-header">Asset ID</th>
                    <th className="table-header">Serial No.</th>
                    <th className="table-header text-right">Cost/Unit</th>
                    <th className="table-header min-w-36">Issued To</th>
                    <th className="table-header">Date Issued</th>
                    <th className="table-header">Status</th>
                    <th className="table-header min-w-44">Notes</th>
                    <th className="table-header w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="py-16 text-center"><LoadingSpinner /></td></tr>
                  ) : assets.length === 0 ? (
                    <tr><td colSpan={11}>
                      <EmptyState
                        title={`No ${tabLabel.toLowerCase()} found`}
                        message={activeFilterCount > 0 ? 'Try clearing your filters' : `No assets in this category yet`}
                        action={canEdit ? <button onClick={() => setAddModal(true)} className="btn-primary text-sm">Add Asset</button> : undefined}
                      />
                    </td></tr>
                  ) : assets.map(asset => (
                    <tr key={asset.id} className="table-row">
                      <td className="table-cell text-center font-mono text-gray-300 text-xs">{asset.no}</td>
                      <td className="table-cell whitespace-nowrap text-xs">{formatDate(asset.date_acquired)}</td>
                      <td className="table-cell">
                        <div className="font-semibold text-gray-900 text-sm">{asset.particulars}</div>
                        {!activeTab && <div className="text-xs text-gray-400">{asset.categories?.name}</div>}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => navigate(`/inventory/${asset.id}`)}
                          className={`font-mono text-xs font-bold hover:underline ${asset.asset_id ? 'text-blue-600' : 'text-amber-500 italic'}`}
                        >
                          {asset.asset_id || 'No Asset ID'}
                        </button>
                      </td>
                      <td className="table-cell font-mono text-xs text-gray-400">{asset.serial_no || '—'}</td>
                      <td className="table-cell text-right text-xs font-semibold">{formatPeso(asset.cost_per_unit)}</td>
                      <td className="table-cell text-xs">
                        {asset.employees
                          ? <button onClick={() => navigate(`/employees/${asset.employees!.id}`)} className="text-blue-600 hover:underline">{asset.employees.name}</button>
                          : asset.issued_branch
                          ? <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg font-semibold text-xs border border-purple-100">
                              🏢 {(asset.issued_branch as { name: string }).name}
                            </span>
                          : asset.location
                          ? <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg font-semibold text-xs border border-teal-100">
                              📍 {asset.location}
                            </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell whitespace-nowrap text-xs">{formatDate(asset.date_issued)}</td>
                      <td className="table-cell"><StatusBadge status={asset.status} size="sm" /></td>
                      <td className="table-cell">
                        <span className="text-gray-400 text-xs line-clamp-2">{asset.notes || '—'}</span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => navigate(`/inventory/${asset.id}`)} className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg" title="View"><Eye size={13} /></button>
                          {canEdit && <button onClick={() => setEditAsset(asset)} className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg" title="Edit"><Edit2 size={13} /></button>}
                          {canDelete && <button onClick={() => setDeleteAsset(asset)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg" title="Delete"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {/* Modals */}
      {addModal && (
        <AssetFormModal open={addModal} onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); fetchAssets(); toast('success', 'Asset added') }}
          categories={categories} branches={branches} employees={employees} />
      )}
      {editAsset && (
        <AssetFormModal open={!!editAsset} onClose={() => setEditAsset(null)}
          onSaved={() => { setEditAsset(null); fetchAssets(); toast('success', 'Asset updated') }}
          asset={editAsset} categories={categories} branches={branches} employees={employees} />
      )}
      <ConfirmDialog open={!!deleteAsset} onClose={() => setDeleteAsset(null)} onConfirm={handleDelete}
        title="Delete Asset" message={`Delete ${deleteAsset?.asset_id || 'this asset'} — ${deleteAsset?.particulars}? This cannot be undone.`}
        confirmLabel="Delete" loading={deleteLoading} />
      <ImportModal open={importModal} onClose={() => setImportModal(false)}
        onImported={() => { setImportModal(false); fetchAssets(); toast('success', 'Import completed') }}
        categories={categories} branches={branches} employees={employees} />
    </div>
  )
}

export default InventoryPage
