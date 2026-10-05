import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, AlertCircle, CheckCircle, Info } from 'lucide-react'
import Modal from './ui/Modal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logAudit } from '../utils/auditLogger'
import type { Category, Branch, Employee } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
  categories: Category[]
  branches: Branch[]
  employees: Employee[]
}

interface ParsedRow {
  row: number
  particulars: string
  asset_id: string           // final resolved ID (may be auto-generated or de-duped)
  asset_id_original: string  // what was in the file
  serial_no: string
  date_acquired: string
  cost_per_unit: number | null
  issued_to: string
  date_issued: string
  notes: string
  status: string
  category: string
  branch: string
  warning?: string  // non-blocking notice
  error?: string    // blocking — will be skipped
}

// Parse date strings that come in many formats into YYYY-MM-DD
function parseDate(raw: string | number | undefined): string {
  if (!raw && raw !== 0) return ''
  const s = String(raw).trim()
  if (!s) return ''

  // XLSX serial number
  if (/^\d{4,5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s))
    if (d) {
      const mo = String(d.m).padStart(2, '0')
      const dy = String(d.d).padStart(2, '0')
      return `${d.y}-${mo}-${dy}`
    }
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YYYY or D-Mon-YYYY  e.g. "06-Feb-20", "5-Apr-2021"
  const dmy = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/)
  if (dmy) {
    const months: Record<string, string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
    }
    const m = months[dmy[2].toLowerCase().slice(0, 3)]
    if (m) {
      const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]
      return `${y}-${m}-${dmy[1].padStart(2, '0')}`
    }
  }

  // DD/MM/YYYY or D/M/YYYY
  const dmy2 = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (dmy2) {
    const y = dmy2[3].length === 2 ? '20' + dmy2[3] : dmy2[3]
    return `${y}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`
  }

  // Try native Date parse as last resort
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  return ''
}

const ImportModal: React.FC<Props> = ({ open, onClose, onImported, categories, branches, employees }) => {
  const { userProfile } = useAuth()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [stage, setStage] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [summary, setSummary] = useState({ imported: 0, skipped: 0, warnings: 0, newEmployees: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async e => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })

      // Fetch existing asset IDs and serial numbers from DB
      const { data: existing } = await supabase.from('assets').select('asset_id, serial_no')
      const existingAssetIds = new Set((existing || []).map((a: { asset_id: string }) => a.asset_id))
      const existingSerials = new Set((existing || []).map((a: { serial_no: string | null }) => a.serial_no).filter(Boolean))

      // Track IDs seen within this import batch to handle intra-file duplicates
      const seenIdsInFile = new Map<string, number>() // id -> count

      const parsed: ParsedRow[] = raw.map((r, i) => {
        const particulars = String(r['Particulars'] || r['particulars'] || '').trim()
        const rawAssetId = String(r['ID'] || r['id'] || r['Asset ID'] || '').trim()
        const serial = String(r['Serial No.'] || r['serial_no'] || r['Serial'] || '').trim()

        let error: string | undefined
        let warning: string | undefined
        let finalAssetId = rawAssetId

        // Particulars is the only truly required field
        if (!particulars) {
          error = 'Missing Particulars — row will be skipped'
        } else {
          // Handle missing Asset ID — auto-generate a placeholder
          if (!finalAssetId) {
            finalAssetId = `IMP-${String(i + 1).padStart(4, '0')}`
            warning = `No Asset ID — auto-assigned ${finalAssetId}`
          }

          // Handle Asset ID already in DB — append suffix
          if (existingAssetIds.has(finalAssetId)) {
            const suffix = String(Date.now()).slice(-4) + String(i)
            finalAssetId = `${finalAssetId}_${suffix}`
            warning = (warning ? warning + '; ' : '') + `Duplicate ID in DB — renamed to ${finalAssetId}`
          }

          // Handle duplicate within this import file — append row suffix
          const seenCount = seenIdsInFile.get(finalAssetId) || 0
          if (seenCount > 0) {
            finalAssetId = `${finalAssetId}_r${i + 2}`
            warning = (warning ? warning + '; ' : '') + `Duplicate in file — renamed to ${finalAssetId}`
          }
          seenIdsInFile.set(finalAssetId, seenCount + 1)

          // Warn on duplicate serial (non-blocking)
          if (serial && existingSerials.has(serial)) {
            warning = (warning ? warning + '; ' : '') + `Serial ${serial} already in DB`
          }
        }

        return {
          row: i + 2,
          particulars,
          asset_id: finalAssetId,
          asset_id_original: rawAssetId,
          serial_no: serial,
          date_acquired: parseDate((r['Date Acquired'] || r['date_acquired']) as string | number | undefined),
          cost_per_unit: parseFloat(String(r['Cost Per Unit'] || r['cost_per_unit'] || '').replace(/[^0-9.]/g, '')) || null,
          issued_to: String(r['Issued To'] || r['issued_to'] || '').trim(),
          date_issued: parseDate((r['Date Issued'] || r['date_issued']) as string | number | undefined),
          notes: String(r['Notes'] || r['notes'] || '').trim(),
          status: String(r['Status'] || r['status'] || 'Available').trim() || 'Available',
          category: String(r['Category'] || r['category'] || '').trim(),
          branch: String(r['Branch'] || r['branch'] || '').trim(),
          warning,
          error,
        }
      })

      setRows(parsed)
      setStage('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleImport = async () => {
    setImporting(true)
    setImportProgress(0)
    const toImport = rows.filter(r => !r.error)
    let imported = 0
    let skipped = 0
    let warnings = 0
    let newEmployees = 0

    // Build a live employee map (name lowercase → id) — starts from existing employees
    const empMap = new Map<string, string>(
      employees.map(e => [e.name.toLowerCase().trim(), e.id])
    )

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i]
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100))

      const cat = categories.find(c => c.name.toLowerCase() === row.category.toLowerCase())
      const branch = branches.find(b => b.name.toLowerCase() === row.branch.toLowerCase())

      // ── Auto-create employee if name given but not in DB ──────────────────
      let empId: string | null = null
      const issuedToName = row.issued_to.trim()

      if (issuedToName) {
        const nameKey = issuedToName.toLowerCase()

        // Exact match first
        if (empMap.has(nameKey)) {
          empId = empMap.get(nameKey)!
        } else {
          // Fuzzy match — first word match for names like "Juan Dela Cruz" vs "Juan"
          const firstWord = nameKey.split(' ')[0]
          const fuzzy = [...empMap.entries()].find(([k]) =>
            k.startsWith(firstWord) && firstWord.length > 2
          )
          if (fuzzy) {
            empId = fuzzy[1]
          } else {
            // Create new employee
            const { data: newEmp, error: empErr } = await supabase
              .from('employees')
              .insert({
                name: issuedToName,
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single()

            if (!empErr && newEmp) {
              empId = (newEmp as { id: string }).id
              empMap.set(nameKey, empId)
              newEmployees++
            }
          }
        }
      }

      const { error } = await supabase.from('assets').insert({
        particulars: row.particulars,
        asset_id: row.asset_id,
        serial_no: row.serial_no || null,
        date_acquired: row.date_acquired || null,
        cost_per_unit: row.cost_per_unit,
        issued_to_employee_id: empId,
        date_issued: row.date_issued || null,
        notes: row.notes || null,
        status: row.status,
        category_id: cat?.id || null,
        branch_id: branch?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        skipped++
        console.error(`Row ${row.row} insert error:`, error.message)
      } else {
        imported++
        if (row.warning) warnings++
      }
    }

    await logAudit({
      userProfile,
      action: `Imported ${imported} assets via Excel/CSV`,
      details: `${imported} imported, ${skipped} failed, ${newEmployees} new employees created`,
    })

    setSummary({ imported, skipped, warnings, newEmployees })
    setStage('done')
    setImporting(false)
    onImported()
  }

  const reset = () => {
    setRows([])
    setStage('upload')
    setSummary({ imported: 0, skipped: 0, warnings: 0, newEmployees: 0 })
    setImportProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validRows = rows.filter(r => !r.error)
  const errorRows = rows.filter(r => r.error)
  const warnRows = rows.filter(r => r.warning && !r.error)

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Import Inventory" size="2xl">
      {stage === 'upload' && (
        <div className="text-center py-8">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-12 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all"
          >
            <Upload size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">Click to upload Excel or CSV</p>
            <p className="text-xs text-gray-400 mt-1">All rows with Particulars will be imported</p>
            <p className="text-xs text-gray-400 mt-0.5">Missing/duplicate Asset IDs are auto-resolved</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} className="hidden" />
        </div>
      )}

      {stage === 'preview' && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle size={14} /> {validRows.length} will be imported
            </span>
            {warnRows.length > 0 && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <Info size={14} /> {warnRows.length} with auto-fixes (IDs renamed)
              </span>
            )}
            {errorRows.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertCircle size={14} /> {errorRows.length} will be skipped (missing Particulars)
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                <tr>
                  <th className="table-header w-10">Row</th>
                  <th className="table-header">Particulars</th>
                  <th className="table-header">Asset ID</th>
                  <th className="table-header">Serial No.</th>
                  <th className="table-header">Date Acquired</th>
                  <th className="table-header">Issued To</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr
                    key={r.row}
                    className={`border-b border-gray-50 ${
                      r.error ? 'bg-red-50 opacity-60' :
                      r.warning ? 'bg-amber-50/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="table-cell text-gray-400">{r.row}</td>
                    <td className="table-cell font-medium max-w-40 truncate">{r.particulars || <span className="text-red-400">—</span>}</td>
                    <td className="table-cell font-mono text-xs">
                      {r.asset_id_original !== r.asset_id ? (
                        <span className="text-amber-600" title={`Renamed from: ${r.asset_id_original || 'blank'}`}>
                          {r.asset_id}
                        </span>
                      ) : (
                        <span className={r.asset_id ? 'text-gray-700' : 'text-gray-300'}>
                          {r.asset_id || '—'}
                        </span>
                      )}
                    </td>
                    <td className="table-cell font-mono text-gray-500">{r.serial_no || '—'}</td>
                    <td className="table-cell text-gray-500">{r.date_acquired || '—'}</td>
                    <td className="table-cell text-gray-600 max-w-32 truncate">{r.issued_to || '—'}</td>
                    <td className="table-cell">{r.status}</td>
                    <td className="table-cell max-w-36">
                      {r.error && <span className="text-red-500 font-medium">{r.error}</span>}
                      {r.warning && !r.error && <span className="text-amber-600">{r.warning}</span>}
                      {!r.error && !r.warning && <span className="text-emerald-500">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button onClick={reset} className="btn-secondary text-sm">Re-upload</button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="btn-primary text-sm"
            >
              {importing
                ? `Importing... ${importProgress}%`
                : `Import ${validRows.length} Rows`}
            </button>
          </div>

          {importing && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Import Complete</h3>
          <div className="flex justify-center gap-6 mt-3 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{summary.imported}</p>
              <p className="text-gray-400 text-xs">Assets imported</p>
            </div>
            {summary.newEmployees > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{summary.newEmployees}</p>
                <p className="text-gray-400 text-xs">Employees created</p>
              </div>
            )}
            {summary.warnings > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{summary.warnings}</p>
                <p className="text-gray-400 text-xs">ID auto-fixed</p>
              </div>
            )}
            {summary.skipped > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{summary.skipped}</p>
                <p className="text-gray-400 text-xs">Failed</p>
              </div>
            )}
          </div>
          <button onClick={() => { onClose(); reset() }} className="btn-primary mt-6">Done</button>
        </div>
      )}
    </Modal>
  )
}

export default ImportModal
