import React, { useState, useEffect, useCallback } from 'react'
import { Search, Printer, FileSpreadsheet, Download, User, ChevronRight } from 'lucide-react'
import logoUrl from '../assets/logo'
import { supabase } from '../lib/supabase'
import { formatDate, formatPeso } from '../utils/constants'
import { exportToExcel, exportToCSV } from '../utils/export'
import StatusBadge from './ui/StatusBadge'
import LoadingSpinner from './ui/LoadingSpinner'
import type { AssetStatus } from '../types'

interface EmpRow {
  id: string
  name: string
  department: string
  branch: string
  email: string | null
  phone: string | null
}

interface AssetRow {
  id: string
  asset_id: string
  particulars: string
  serial_no: string | null
  category: string
  date_acquired: string | null
  date_issued: string | null
  cost_per_unit: number | null
  status: AssetStatus
  notes: string | null
}

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 1.5cm 1.8cm 2cm 1.8cm; }
  html, body { width: 210mm; }
  .no-print { display: none !important; }
  .print-doc { display: block !important; }
  body { background: #fff !important; }
}
`

const EmployeeAccountabilityReport: React.FC = () => {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<EmpRow[]>([])
  const [filtered, setFiltered] = useState<EmpRow[]>([])
  const [selected, setSelected] = useState<EmpRow | null>(null)
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingEmps, setLoadingEmps] = useState(true)

  // Fetch all employees once
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, departments(name), branches(name), email, phone')
        .order('name')
      if (data) {
        const rows: EmpRow[] = (data as Record<string, unknown>[]).map(e => ({
          id: e.id as string,
          name: e.name as string,
          department: (e.departments as { name: string } | null)?.name || '',
          branch: (e.branches as { name: string } | null)?.name || '',
          email: e.email as string | null,
          phone: e.phone as string | null,
        }))
        setEmployees(rows)
        setFiltered(rows)
      }
      setLoadingEmps(false)
    }
    fetch()
  }, [])

  // Filter employees as user types
  useEffect(() => {
    if (!search.trim()) { setFiltered(employees); return }
    const q = search.toLowerCase()
    setFiltered(employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.branch.toLowerCase().includes(q)
    ))
  }, [search, employees])

  // Fetch selected employee's assets
  const fetchAssets = useCallback(async (emp: EmpRow) => {
    setLoading(true)
    const { data } = await supabase
      .from('assets')
      .select('id, asset_id, particulars, serial_no, categories(name), date_acquired, date_issued, cost_per_unit, status, notes')
      .eq('issued_to_employee_id', emp.id)
      .order('particulars')
    if (data) {
      setAssets((data as Record<string, unknown>[]).map(a => ({
        id: a.id as string,
        asset_id: a.asset_id as string,
        particulars: a.particulars as string,
        serial_no: a.serial_no as string | null,
        category: (a.categories as { name: string } | null)?.name || '',
        date_acquired: a.date_acquired as string | null,
        date_issued: a.date_issued as string | null,
        cost_per_unit: a.cost_per_unit as number | null,
        status: a.status as AssetStatus,
        notes: a.notes as string | null,
      })))
    }
    setLoading(false)
  }, [])

  const selectEmployee = (emp: EmpRow) => {
    setSelected(emp)
    fetchAssets(emp)
  }

  const totalValue = assets.reduce((s, a) => s + (a.cost_per_unit || 0), 0)

  const handleExcelExport = () => {
    if (!selected) return
    const rows = assets.map((a, i) => ({
      'No.': i + 1,
      'Asset ID': a.asset_id || '',
      'Particulars': a.particulars,
      'Category': a.category,
      'Serial No.': a.serial_no || '',
      'Date Acquired': a.date_acquired ? formatDate(a.date_acquired) : '',
      'Date Issued': a.date_issued ? formatDate(a.date_issued) : '',
      'Cost': a.cost_per_unit ?? '',
      'Status': a.status,
      'Notes': a.notes || '',
    }))
    exportToExcel(rows, `Accountability_${selected.name.replace(/\s+/g, '_')}`)
  }

  const handleCSVExport = () => {
    if (!selected) return
    const rows = assets.map((a, i) => ({
      'No.': i + 1,
      'Asset ID': a.asset_id || '',
      'Particulars': a.particulars,
      'Category': a.category,
      'Serial No.': a.serial_no || '',
      'Date Issued': a.date_issued ? formatDate(a.date_issued) : '',
      'Status': a.status,
    }))
    exportToCSV(rows, `Accountability_${selected.name.replace(/\s+/g, '_')}`)
  }

  return (
    <div className="flex gap-5 h-full">
      <style>{PRINT_CSS}</style>

      {/* Employee list */}
      <div className="w-64 flex-shrink-0 no-print flex flex-col gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 py-2 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {loadingEmps ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No employees found</p>
          ) : (
            <div>
              {filtered.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-left transition-colors ${
                    selected?.id === emp.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    selected?.id === emp.id ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {emp.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{emp.name}</p>
                    {emp.department && <p className={`text-xs truncate ${selected?.id === emp.id ? 'text-blue-200' : 'text-gray-400'}`}>{emp.department}</p>}
                  </div>
                  {selected?.id === emp.id && <ChevronRight size={13} className="text-blue-300 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center">{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Report preview */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <User size={36} className="mb-3 opacity-30" />
            <p className="font-medium text-sm">Select an employee</p>
            <p className="text-xs mt-1">Choose from the list to preview their accountability sheet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 no-print">
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-400">{[selected.department, selected.branch].filter(Boolean).join(' · ')}</p>
              </div>
              {!loading && assets.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={handleExcelExport} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                    <FileSpreadsheet size={13} /> Excel
                  </button>
                  <button onClick={handleCSVExport} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                    <Download size={13} /> CSV
                  </button>
                  <button onClick={() => window.print()} className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5">
                    <Printer size={13} /> Print / PDF
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><LoadingSpinner message="Loading assets..." /></div>
            ) : (
              <>
                {/* ── SCREEN preview ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden no-print">
                  {assets.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No assets assigned to this employee</div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="table-header w-8">#</th>
                            <th className="table-header">Asset ID</th>
                            <th className="table-header min-w-48">Particulars</th>
                            <th className="table-header">Category</th>
                            <th className="table-header">Serial No.</th>
                            <th className="table-header">Date Issued</th>
                            <th className="table-header text-right">Cost</th>
                            <th className="table-header">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((a, i) => (
                            <tr key={a.id} className="table-row">
                              <td className="table-cell text-center text-gray-400 text-xs">{i + 1}</td>
                              <td className="table-cell font-mono text-xs font-bold text-blue-600">{a.asset_id || <span className="text-amber-500 italic">No ID</span>}</td>
                              <td className="table-cell font-medium">{a.particulars}</td>
                              <td className="table-cell text-gray-500 text-xs">{a.category}</td>
                              <td className="table-cell font-mono text-xs text-gray-400">{a.serial_no || '—'}</td>
                              <td className="table-cell text-xs whitespace-nowrap">{formatDate(a.date_issued)}</td>
                              <td className="table-cell text-right text-xs font-semibold">{formatPeso(a.cost_per_unit)}</td>
                              <td className="table-cell"><StatusBadge status={a.status} size="sm" /></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td colSpan={6} className="table-cell text-xs font-semibold text-gray-600 text-right">Total Value:</td>
                            <td className="table-cell text-right font-bold text-gray-900">{formatPeso(totalValue)}</td>
                            <td className="table-cell text-xs text-gray-400">{assets.length} item{assets.length !== 1 ? 's' : ''}</td>
                          </tr>
                        </tfoot>
                      </table>
                      {assets.some(a => a.notes) && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/50">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                          {assets.filter(a => a.notes).map(a => (
                            <p key={a.id} className="text-xs text-gray-600"><span className="font-mono text-blue-500">{a.asset_id}</span> — {a.notes}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── PRINT document ── */}
                <div className="print-doc" style={{ display: 'none', fontFamily: "'Arial', sans-serif", fontSize: '9pt', color: '#111' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={logoUrl} alt="" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '11pt' }}>ZURICH FINANCE CORP</div>
                        <div style={{ fontSize: '8pt', color: '#6b7280' }}>Employee Accountability Sheet</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '8.5pt' }}>
                      <div><b>Date Generated:</b> {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '2px solid #1e3a8a', marginBottom: '10px' }} />

                  {/* Employee info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 24px', marginBottom: '12px', padding: '8px 12px', background: '#f8faff', border: '1px solid #dbeafe', borderRadius: '4px' }}>
                    {[
                      ['Employee', selected.name],
                      ['Department', selected.department || '—'],
                      ['Branch', selected.branch || '—'],
                      ['Email', selected.email || '—'],
                      ['Phone', selected.phone || '—'],
                      ['Total Assets', String(assets.length)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: '7.5pt', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                        <div style={{ fontSize: '9pt', fontWeight: label === 'Employee' ? 700 : 400 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Assets table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '4%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                        <th style={{ padding: '5px 6px', textAlign: 'center', border: '1px solid #1e3a8a' }}>#</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Asset ID</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Particulars</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Category</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Serial No.</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Date Issued</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #1e3a8a' }}>Cost (₱)</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #1e3a8a' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb' }}>No assets assigned</td></tr>
                      ) : assets.map((a, i) => (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? '#f8f9ff' : '#fff' }}>
                          <td style={{ padding: '5px 6px', textAlign: 'center', border: '1px solid #e5e7eb', color: '#9ca3af' }}>{i + 1}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{a.asset_id || '—'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', fontWeight: 500 }}>{a.particulars}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{a.category}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: '7.5pt', color: '#6b7280' }}>{a.serial_no || '—'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{a.date_issued ? formatDate(a.date_issued) : '—'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{a.cost_per_unit != null ? a.cost_per_unit.toLocaleString() : '—'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb' }}>{a.status}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: '5px 6px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '8pt' }}>Total Value:</td>
                        <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', textAlign: 'right', color: '#1e3a8a' }}>
                          {totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '5px 6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '7.5pt' }}>{assets.length} items</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Notes */}
                  {assets.some(a => a.notes) && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '3px', fontSize: '8pt' }}>
                      <div style={{ fontWeight: 700, marginBottom: '3px' }}>Notes:</div>
                      {assets.filter(a => a.notes).map(a => (
                        <div key={a.id}><span style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{a.asset_id}</span> — {a.notes}</div>
                      ))}
                    </div>
                  )}

                  {/* Signature */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '24px' }}>
                    {[
                      { label: 'Received by (Employee)', name: selected.name },
                      { label: 'Issued by (IT Officer)', name: '' },
                    ].map(sig => (
                      <div key={sig.label}>
                        <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '2px' }}>{sig.label}:</div>
                        <div style={{ borderBottom: '1.5px solid #111', paddingTop: '28px', paddingBottom: '2px', fontWeight: 700, fontSize: '9pt' }}>{sig.name}</div>
                        <div style={{ fontSize: '7pt', color: '#9ca3af', marginTop: '2px' }}>Signature Over Printed Name</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '4px', fontSize: '7pt', color: '#9ca3af', textAlign: 'center' }}>
                    Zurich Finance Corp — IT Inventory System &nbsp;·&nbsp; Generated {new Date().toLocaleString('en-PH')}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeAccountabilityReport
