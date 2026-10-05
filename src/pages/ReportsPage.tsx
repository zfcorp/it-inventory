import React, { useState } from 'react'
import { FileSpreadsheet, Download, Printer, BarChart2, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { exportToExcel, exportToCSV, assetsToExportRows } from '../utils/export'
import { formatPeso, formatDate } from '../utils/constants'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import HardwareRequestForm from '../components/HardwareRequestForm'
import HardwareIssueForm from '../components/HardwareIssueForm'
import EmployeeAccountabilityReport from '../components/EmployeeAccountabilityReport'
import type { Asset, MaintenanceRecord, ReplacementRequest } from '../types'

interface ReportDef {
  id: string
  label: string
  group: string
  description: string
}

const REPORTS: ReportDef[] = [
  { id: 'all', label: 'Complete IT Inventory', group: 'Inventory', description: 'All inventory items' },
  { id: 'by-category', label: 'Inventory by Category', group: 'Inventory', description: 'Assets grouped by category' },
  { id: 'by-department', label: 'Inventory by Department', group: 'Inventory', description: 'Assets grouped by department' },
  { id: 'available', label: 'Available Equipment', group: 'Inventory', description: 'Unissued, available assets' },
  { id: 'issued', label: 'Issued Equipment', group: 'Inventory', description: 'Assets assigned to an employee' },
  { id: 'unassigned', label: 'Unassigned Equipment', group: 'Inventory', description: 'Assets with no employee assigned' },
  { id: 'laptops', label: 'Laptop Inventory', group: 'Equipment', description: 'All laptops' },
  { id: 'pcs', label: 'PC Inventory', group: 'Equipment', description: 'All desktop PCs' },
  { id: 'printers', label: 'Printer Inventory', group: 'Equipment', description: 'All printers' },
  { id: 'network', label: 'Router/Switch Inventory', group: 'Equipment', description: 'Routers, switches, access points' },
  { id: 'monitors', label: 'Monitor Inventory', group: 'Equipment', description: 'All monitors' },
  { id: 'phones', label: 'Phone Inventory', group: 'Equipment', description: 'Company phones' },
  { id: 'tablets', label: 'Tablet Inventory', group: 'Equipment', description: 'All tablets' },
  { id: 'peripherals', label: 'Peripheral Inventory', group: 'Equipment', description: 'All peripherals/accessories' },
  { id: 'under-repair', label: 'Equipment Under Repair', group: 'Maintenance', description: 'Assets currently under repair' },
  { id: 'maintenance-history', label: 'Maintenance History', group: 'Maintenance', description: 'All maintenance records' },
  { id: 'repair-costs', label: 'Repair Costs', group: 'Maintenance', description: 'Maintenance cost summary' },
  { id: 'for-replacement', label: 'For Replacement', group: 'Replacement', description: 'Assets flagged for replacement' },
  { id: 'replaced', label: 'Replaced Equipment', group: 'Replacement', description: 'Assets that have been replaced' },
  { id: 'replacement-history', label: 'Replacement History', group: 'Replacement', description: 'All replacement requests' },
  { id: 'employee-accountability', label: 'Employee Accountability', group: 'Employee', description: 'Select an employee and preview their accountability sheet' },
  { id: 'issued-per-employee', label: 'Equipment Issued Per Employee', group: 'Employee', description: 'Summary of assets per employee' },
  // Forms
  { id: 'hardware-request', label: 'Hardware Request Form', group: 'Forms', description: 'Generate a printable hardware request form' },
  { id: 'hardware-issue', label: 'Hardware Issue Documentation', group: 'Forms', description: 'Document hardware issues per employee' },
]

const GROUPS = ['Inventory', 'Equipment', 'Maintenance', 'Replacement', 'Employee', 'Forms']

const ReportsPage: React.FC = () => {
  const toast = useToast()
  const [selected, setSelected] = useState<ReportDef | null>(null)
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')

  const generateReport = async (report: ReportDef) => {
    setSelected(report)
    setLoading(true)
    setReportData([])

    let rows: Record<string, unknown>[] = []
    let cols: string[] = []

    try {
      switch (report.id) {
        case 'all':
        case 'available':
        case 'issued':
        case 'unassigned': {
          let q = supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).order('no')
          if (report.id === 'available') q = q.eq('status', 'Available')
          if (report.id === 'issued') q = q.not('issued_to_employee_id', 'is', null)
          if (report.id === 'unassigned') q = q.is('issued_to_employee_id', null)
          const { data } = await q
          rows = assetsToExportRows((data as Asset[]) || [])
          cols = ['No.', 'Date Acquired', 'Particulars', 'ID', 'Serial No.', 'Cost Per Unit', 'Issued To', 'Date Issued', 'Status', 'Category', 'Branch', 'Department']
          break
        }
        case 'laptops': case 'pcs': case 'printers': case 'network': case 'monitors': case 'phones': case 'tablets': case 'peripherals': {
          const catMap: Record<string, string[]> = {
            laptops: ['Laptop'], pcs: ['Desktop PC'], printers: ['Printer', 'Multifunction Printer'],
            network: ['Router', 'Hub Switch', 'Network Switch', 'Access Point'], monitors: ['Monitor'],
            phones: ['Company Phone'], tablets: ['Tablet'],
            peripherals: ['Keyboard','Mouse','Headset','Webcam','Docking Station','Laptop Charger','Monitor Stand','USB Hub','HDMI Cable','Power Adapter','Other'],
          }
          const { data: cats } = await supabase.from('categories').select('id, name').in('name', catMap[report.id] || [])
          const catIds = (cats || []).map((c: { id: string }) => c.id)
          if (catIds.length === 0) { rows = []; break }
          const { data } = await supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).in('category_id', catIds).order('no')
          rows = assetsToExportRows((data as Asset[]) || [])
          cols = ['No.', 'Particulars', 'ID', 'Serial No.', 'Cost Per Unit', 'Issued To', 'Date Issued', 'Status', 'Branch']
          break
        }
        case 'by-category': {
          const { data } = await supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).order('category_id').order('no')
          const map: Record<string, Asset[]> = {}
          ;(data as Asset[] || []).forEach(a => {
            const k = a.categories?.name || 'Uncategorized'
            if (!map[k]) map[k] = []
            map[k].push(a)
          })
          rows = Object.entries(map).flatMap(([cat, assets]) => [
            { 'Category': `── ${cat} (${assets.length}) ──`, 'Particulars': '', ID: '', Status: '' },
            ...assetsToExportRows(assets),
          ])
          cols = ['Category', 'Particulars', 'ID', 'Serial No.', 'Issued To', 'Status']
          break
        }
        case 'by-department': {
          const { data } = await supabase.from('assets').select(`*, categories(name), employees(name, departments(name))`).order('no')
          const map: Record<string, Asset[]> = {}
          ;(data as Asset[] || []).forEach(a => {
            const k = a.employees?.departments?.name || 'Unassigned'
            if (!map[k]) map[k] = []
            map[k].push(a)
          })
          rows = Object.entries(map).flatMap(([dept, assets]) => [
            { 'Department': `── ${dept} (${assets.length}) ──`, 'Particulars': '', ID: '', Status: '' },
            ...assetsToExportRows(assets),
          ])
          cols = ['Department', 'Particulars', 'ID', 'Issued To', 'Status', 'Category']
          break
        }
        case 'under-repair': {
          const { data } = await supabase.from('assets').select(`*, categories(name), branch:branch_id(name), employees(name, departments(name))`).eq('status', 'Under Repair').order('no')
          rows = assetsToExportRows((data as Asset[]) || [])
          cols = ['Particulars', 'ID', 'Serial No.', 'Status', 'Issued To', 'Department', 'Branch']
          break
        }
        case 'maintenance-history': case 'repair-costs': {
          const { data } = await supabase.from('maintenance_records').select(`*, assets(asset_id, particulars)`).order('maintenance_date', { ascending: false })
          rows = ((data as MaintenanceRecord[]) || []).map(r => ({
            'Date': formatDate(r.maintenance_date),
            'Asset ID': r.assets?.asset_id || '',
            'Equipment': r.assets?.particulars || '',
            'Problem': r.problem,
            'Diagnosis': r.diagnosis || '',
            'Action Taken': r.action_taken || '',
            'Parts Replaced': r.parts_replaced || '',
            'Technician': r.technician || '',
            'Cost (₱)': r.cost ?? '',
            'Result': r.result,
            'Notes': r.notes || '',
          }))
          cols = ['Date', 'Asset ID', 'Equipment', 'Problem', 'Technician', 'Cost (₱)', 'Result']
          if (report.id === 'repair-costs') {
            const totalCost = ((data as MaintenanceRecord[]) || []).reduce((s, r) => s + (r.cost || 0), 0)
            rows = [{ 'Total Repair Cost': formatPeso(totalCost), '': '' }, ...rows]
          }
          break
        }
        case 'for-replacement': case 'replaced': case 'replacement-history': {
          let q = supabase.from('replacement_requests').select(`*, assets(asset_id, particulars), employees(name, departments(name))`).order('date_reported', { ascending: false })
          if (report.id === 'for-replacement') q = q.not('status', 'eq', 'Completed')
          if (report.id === 'replaced') q = q.eq('status', 'Completed')
          const { data } = await q
          rows = ((data as ReplacementRequest[]) || []).map(r => ({
            'Asset ID': r.assets?.asset_id || '',
            'Equipment': r.assets?.particulars || '',
            'Employee': r.employees?.name || '',
            'Department': r.employees?.departments?.name || '',
            'Problem': r.problem,
            'Date Reported': formatDate(r.date_reported),
            'Priority': r.priority,
            'Status': r.status,
          }))
          cols = ['Asset ID', 'Equipment', 'Employee', 'Department', 'Problem', 'Date Reported', 'Priority', 'Status']
          break
        }
        case 'employee-accountability': case 'issued-per-employee': {
          const { data: emps } = await supabase.from('employees').select(`id, name, departments(name), branches(name)`).order('name')
          const { data: allAssets } = await supabase.from('assets').select(`*, categories(name)`).not('issued_to_employee_id', 'is', null)
          const empMap: Record<string, Asset[]> = {}
          ;(allAssets as Asset[] || []).forEach(a => {
            const eid = a.issued_to_employee_id!
            if (!empMap[eid]) empMap[eid] = []
            empMap[eid].push(a)
          })
          type EmpRow = { id: string; name: string; departments?: unknown; branches?: unknown }
          if (report.id === 'employee-accountability') {
            rows = (emps || []).flatMap((e: EmpRow) => {
              const eAssets = empMap[e.id] || []
              const deptName = (e.departments as { name: string } | null)?.name || ''
              const branchName = (e.branches as { name: string } | null)?.name || ''
              return [
                { 'Employee': e.name, 'Department': deptName, 'Branch': branchName, 'Asset ID': `── ${eAssets.length} item(s) ──`, 'Particulars': '', Status: '' },
                ...eAssets.map(a => ({ 'Employee': '', 'Department': '', 'Branch': '', 'Asset ID': a.asset_id, 'Particulars': a.particulars, 'Status': a.status })),
              ]
            })
            cols = ['Employee', 'Department', 'Branch', 'Asset ID', 'Particulars', 'Status']
          } else {
            rows = (emps || []).map((e: EmpRow) => ({
              'Employee': e.name,
              'Department': (e.departments as { name: string } | null)?.name || '',
              'Branch': (e.branches as { name: string } | null)?.name || '',
              'Total Assets': (empMap[e.id] || []).length,
            }))
            cols = ['Employee', 'Department', 'Branch', 'Total Assets']
          }
          break
        }
      }
    } catch (e) { console.error(e) }

    setReportData(rows)
    setColumns(cols)
    setTitle(report.label)
    setLoading(false)
  }

  const handleExcelExport = () => { if (reportData.length) exportToExcel(reportData, title.replace(/\s+/g, '_')); toast('success', 'Exported to Excel') }
  const handleCSVExport = () => { if (reportData.length) exportToCSV(reportData, title.replace(/\s+/g, '_')); toast('success', 'Exported to CSV') }
  const handlePrint = () => window.print()

  return (
    <div className="flex gap-6 h-full">
      {/* Report List */}
      <div className="w-56 flex-shrink-0 no-print">
        {GROUPS.map(group => (
          <div key={group} className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">{group}</p>
            {REPORTS.filter(r => r.group === group).map(r => (
              <button
                key={r.id}
                onClick={() => generateReport(r)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected?.id === r.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {r.id === 'hardware-request' ? (
                  <span className="flex items-center gap-2"><ClipboardList size={13} />{r.label}</span>
                ) : r.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Report Content */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <BarChart2 size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Select a report from the left</p>
            <p className="text-sm mt-1">Choose a report type to generate and export</p>
          </div>
        ) : selected.id === 'hardware-request' ? (
          <HardwareRequestForm />
        ) : selected.id === 'hardware-issue' ? (
          <HardwareIssueForm />
        ) : selected.id === 'employee-accountability' ? (
          <EmployeeAccountabilityReport />
        ) : (
          <div className="space-y-4">
            {/* Report Header */}
            <div className="flex items-center gap-3 no-print">
              <h2 className="text-lg font-bold text-gray-900 flex-1">{title}</h2>
              {!loading && reportData.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={handleExcelExport} className="btn-secondary text-sm flex items-center gap-1.5"><FileSpreadsheet size={14} /> Excel</button>
                  <button onClick={handleCSVExport} className="btn-secondary text-sm flex items-center gap-1.5"><Download size={14} /> CSV</button>
                  <button onClick={handlePrint} className="btn-secondary text-sm flex items-center gap-1.5"><Printer size={14} /> Print / PDF</button>
                </div>
              )}
            </div>

            {/* Print header (only shows when printing) */}
            <div className="hidden print-only mb-4">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500">IT Inventory Management System · Generated {new Date().toLocaleDateString()}</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><LoadingSpinner message="Generating report..." /></div>
            ) : reportData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p>No data for this report</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print-container">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {columns.map(c => <th key={c} className="table-header">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, i) => (
                        <tr key={i} className={`table-row ${
                          Object.values(row).some(v => typeof v === 'string' && v.startsWith('──')) ? 'bg-gray-100 font-semibold' : ''
                        }`}>
                          {columns.map(c => (
                            <td key={c} className="table-cell">{String(row[c] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-400 no-print">
                  {reportData.length} rows · {title}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportsPage
