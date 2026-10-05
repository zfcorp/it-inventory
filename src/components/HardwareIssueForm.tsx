import React, { useState } from 'react'
import { Printer, Plus, Trash2 } from 'lucide-react'
import logoUrl from '../assets/logo'
import { supabase } from '../lib/supabase'
import type { Asset, Employee } from '../types'

interface IssueRow {
  id: string
  employee: string
  asset_label: string
  issue: string
  urgency: 'Urgent' | 'Normal' | ''
  remarks: string
}

const COMMON_ISSUES = [
  'Charging issue', 'Slow and hanging', 'Storage issue', 'Boot issue',
  'Keyboard issue', 'Display issue', 'Network issue', 'Overheating',
  'Battery issue', 'Software issue', 'Hardware damage', 'Other',
]

let _rc = 0
const newRow = (): IssueRow => ({ id: String(++_rc), employee: '', asset_label: '', issue: '', urgency: '', remarks: '' })

/* ─── Print styles injected once ─────────────────────────────────────────── */
const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 1.8cm 1.6cm 2cm 1.6cm;
  }
  html, body { width: 210mm; }
  .no-print  { display: none !important; }
  .print-doc { display: block !important; }
  body { background: #fff !important; font-size: 9pt; }
}
`

/* ─── Shared document layout ──────────────────────────────────────────────── */
interface DocProps {
  date: string; preparedBy: string; verifiedBy: string
  managersInterviewed: string; recommendedReplacement: string
  remarks: string; rows: IssueRow[]
}

const Document: React.FC<DocProps> = ({ date, preparedBy, verifiedBy, managersInterviewed, recommendedReplacement, remarks, rows }) => {
  const displayRows = rows.length > 0 ? rows : Array.from({ length: 8 }, (_, i) => ({ id: String(i), employee: '', asset_label: '', issue: '', urgency: '' as const, remarks: '' }))

  const s = {
    wrap:   { fontFamily: "'Arial', sans-serif", fontSize: '9pt', color: '#111', lineHeight: '1.4', width: '100%' } as React.CSSProperties,
    hdr:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } as React.CSSProperties,
    rule:   { border: 'none', borderTop: '2px solid #1e3a8a', margin: '0 0 10px 0' } as React.CSSProperties,
    title:  { textAlign: 'center' as const, fontWeight: 800, fontSize: '11.5pt', letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 10px 0' },
    th:     { background: '#1e3a8a', color: '#fff', padding: '5px 6px', fontSize: '8pt', fontWeight: 700, textAlign: 'left' as const, border: '1px solid #1e3a8a' } as React.CSSProperties,
    tdEven: { padding: '6px 6px', fontSize: '8.5pt', verticalAlign: 'middle' as const, border: '1px solid #d1d5db', background: '#f5f7ff' } as React.CSSProperties,
    tdOdd:  { padding: '6px 6px', fontSize: '8.5pt', verticalAlign: 'middle' as const, border: '1px solid #d1d5db', background: '#ffffff' } as React.CSSProperties,
    box:    { border: '1px solid #1e3a8a', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px' } as React.CSSProperties,
    bxHead: { fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px', marginBottom: '6px' } as React.CSSProperties,
    line:   { borderBottom: '1px solid #9ca3af', minHeight: '18px', marginBottom: '5px', paddingBottom: '1px', fontSize: '8.5pt' } as React.CSSProperties,
    sigWrap:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '12px' } as React.CSSProperties,
    sigLine:{ borderBottom: '1.5px solid #111', paddingTop: '28px', paddingBottom: '2px', fontSize: '8.5pt', fontWeight: 700 } as React.CSSProperties,
    sigLbl: { fontSize: '7pt', color: '#6b7280', marginTop: '2px' } as React.CSSProperties,
    foot:   { borderTop: '1px solid #e5e7eb', marginTop: '14px', paddingTop: '4px', fontSize: '7pt', color: '#9ca3af', textAlign: 'center' as const } as React.CSSProperties,
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.hdr}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '11pt' }}>ZURICH FINANCE CORP</div>
            <div style={{ fontSize: '8pt', color: '#6b7280' }}>Hardware Issue Documentation</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8.5pt' }}>
          <div><b>Date:</b> {date || '____________________'}</div>
          <div><b>Prepared by:</b> {preparedBy || '____________________'}</div>
        </div>
      </div>
      <hr style={s.rule} />

      <p style={s.title}>Hardware Issue Documentation</p>

      {/* Issue table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '26%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '17%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...s.th, textAlign: 'center' }}>#</th>
            <th style={s.th}>Employee</th>
            <th style={s.th}>Equipment</th>
            <th style={s.th}>Reported Issue</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Urgency</th>
            <th style={s.th}>Action / Remarks</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => {
            const td = i % 2 === 0 ? s.tdEven : s.tdOdd
            const urgencyCell =
              row.urgency === 'Urgent' ? '☒ Urgent   ☐ Normal' :
              row.urgency === 'Normal' ? '☐ Urgent   ☒ Normal' :
              '☐ Urgent   ☐ Normal'
            return (
              <tr key={row.id}>
                <td style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{row.employee || '\u00A0'}</td>
                <td style={td}>{row.asset_label || '\u00A0'}</td>
                <td style={td}>{row.issue || '\u00A0'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: '8pt', whiteSpace: 'nowrap' }}>{urgencyCell}</td>
                <td style={td}>{row.remarks || '\u00A0'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Manager box */}
      <div style={s.box}>
        <div style={s.bxHead}>Manager Interview / Verification</div>
        <div style={{ marginBottom: '8px', fontSize: '8.5pt' }}>
          <span style={{ fontWeight: 600 }}>Managers Interviewed: </span>
          <span style={{ ...s.line, display: 'inline-block', minWidth: '280px' }}>{managersInterviewed || '\u00A0'}</span>
        </div>
        <div style={{ marginBottom: '6px', fontSize: '8.5pt' }}>
          <div style={{ fontWeight: 600, marginBottom: '3px' }}>Employees Recommended for Immediate Replacement:</div>
          <div style={s.line}>{recommendedReplacement || '\u00A0'}</div>
          <div style={s.line}>&nbsp;</div>
        </div>
        <div style={{ fontSize: '8.5pt' }}>
          <div style={{ fontWeight: 600, marginBottom: '3px' }}>Remarks:</div>
          <div style={s.line}>{remarks || '\u00A0'}</div>
          <div style={s.line}>&nbsp;</div>
        </div>
      </div>

      {/* Signatures */}
      <div style={s.sigWrap}>
        {[{ label: 'Prepared by', name: preparedBy }, { label: 'Verified by', name: verifiedBy }].map(sig => (
          <div key={sig.label}>
            <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '2px' }}>{sig.label}:</div>
            <div style={s.sigLine}>{sig.name || '\u00A0'}</div>
            <div style={s.sigLbl}>Signature Over Printed Name</div>
          </div>
        ))}
      </div>

      <div style={s.foot}>
        Zurich Finance Corp — IT Inventory System &nbsp;·&nbsp; Generated {new Date().toLocaleString('en-PH')}
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */
const HardwareIssueForm: React.FC = () => {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }))
  const [preparedBy, setPreparedBy] = useState('')
  const [verifiedBy, setVerifiedBy] = useState('')
  const [managersInterviewed, setManagersInterviewed] = useState('')
  const [recommendedReplacement, setRecommendedReplacement] = useState('')
  const [remarks, setRemarks] = useState('')
  const [rows, setRows] = useState<IssueRow[]>([newRow(), newRow(), newRow()])

  const [assetSearch, setAssetSearch] = useState<Record<string, string>>({})
  const [assetSugg, setAssetSugg] = useState<Record<string, Asset[]>>({})
  const [empSearch, setEmpSearch] = useState<Record<string, string>>({})
  const [empSugg, setEmpSugg] = useState<Record<string, Employee[]>>({})

  const updateRow = (id: string, f: keyof IssueRow, v: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [f]: v } : r))

  const searchAssets = async (rowId: string, q: string) => {
    setAssetSearch(p => ({ ...p, [rowId]: q }))
    if (q.length < 2) { setAssetSugg(p => ({ ...p, [rowId]: [] })); return }
    const { data } = await supabase.from('assets').select('id, asset_id, particulars').or(`asset_id.ilike.%${q}%,particulars.ilike.%${q}%`).limit(6)
    if (data) setAssetSugg(p => ({ ...p, [rowId]: data as Asset[] }))
  }

  const selectAsset = (rowId: string, a: Asset) => {
    updateRow(rowId, 'asset_label', a.particulars)
    setAssetSearch(p => ({ ...p, [rowId]: a.particulars }))
    setAssetSugg(p => ({ ...p, [rowId]: [] }))
  }

  const searchEmps = async (rowId: string, q: string) => {
    setEmpSearch(p => ({ ...p, [rowId]: q }))
    if (q.length < 2) { setEmpSugg(p => ({ ...p, [rowId]: [] })); return }
    const { data } = await supabase.from('employees').select('id, name').ilike('name', `%${q}%`).limit(6)
    if (data) setEmpSugg(p => ({ ...p, [rowId]: data as Employee[] }))
  }

  const selectEmp = (rowId: string, e: Employee) => {
    updateRow(rowId, 'employee', e.name)
    setEmpSearch(p => ({ ...p, [rowId]: e.name }))
    setEmpSugg(p => ({ ...p, [rowId]: [] }))
  }

  const filledRows = rows.filter(r => r.employee || r.asset_label || r.issue)
  const docProps = { date, preparedBy, verifiedBy, managersInterviewed, recommendedReplacement, remarks, rows: filledRows }

  return (
    <div className="space-y-5">
      <style>{PRINT_CSS}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-base font-bold text-gray-900">Hardware Issue Documentation</h2>
          <p className="text-xs text-gray-400 mt-0.5">Fill in the entries, then print or save as PDF</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* ── Editor ── */}
      <div className="card space-y-4 no-print">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Date</label><input className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">Prepared By</label><input className="input" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="IT Officer name" /></div>
        </div>

        {/* Rows */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0">Issue Entries</label>
            <button onClick={() => setRows(p => [...p, newRow()])} className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5">
              <Plus size={12} /> Add Row
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                <div className="col-span-1 text-center text-xs text-gray-400 font-mono pb-2.5">{idx + 1}</div>

                {/* Employee */}
                <div className="col-span-3 relative">
                  <label className="label">Employee</label>
                  <input className="input text-sm" value={empSearch[row.id] ?? row.employee}
                    onChange={e => { updateRow(row.id, 'employee', e.target.value); searchEmps(row.id, e.target.value) }}
                    placeholder="Name..." />
                  {(empSugg[row.id] || []).length > 0 && (
                    <div className="absolute z-20 top-full w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mt-0.5">
                      {empSugg[row.id].map(e => (
                        <button key={e.id} type="button" className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs" onClick={() => selectEmp(row.id, e)}>{e.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Equipment */}
                <div className="col-span-3 relative">
                  <label className="label">Equipment</label>
                  <input className="input text-sm" value={assetSearch[row.id] ?? row.asset_label}
                    onChange={e => { updateRow(row.id, 'asset_label', e.target.value); searchAssets(row.id, e.target.value) }}
                    placeholder="Search asset name..." />
                  {(assetSugg[row.id] || []).length > 0 && (
                    <div className="absolute z-20 top-full w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden mt-0.5">
                      {assetSugg[row.id].map(a => (
                        <button key={a.id} type="button" className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex gap-2" onClick={() => selectAsset(row.id, a)}>
                          <span className="font-mono text-blue-600 w-20 flex-shrink-0">{a.asset_id || '—'}</span>
                          <span>{a.particulars}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Issue */}
                <div className="col-span-2">
                  <label className="label">Issue</label>
                  <select className="input text-sm" value={row.issue} onChange={e => updateRow(row.id, 'issue', e.target.value)}>
                    <option value="">Select...</option>
                    {COMMON_ISSUES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>

                {/* Urgency */}
                <div className="col-span-2">
                  <label className="label">Urgency</label>
                  <div className="flex gap-1.5">
                    {(['Urgent', 'Normal'] as const).map(u => (
                      <button key={u} type="button" onClick={() => updateRow(row.id, 'urgency', row.urgency === u ? '' : u)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                          row.urgency === u
                            ? u === 'Urgent' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}>{u}</button>
                    ))}
                  </div>
                </div>

                {/* Delete */}
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => setRows(p => p.filter(r => r.id !== row.id))} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-gray-300 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fields */}
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-gray-100">
          <div><label className="label">Managers Interviewed</label><input className="input" value={managersInterviewed} onChange={e => setManagersInterviewed(e.target.value)} /></div>
          <div><label className="label">Employees Recommended for Immediate Replacement</label><textarea className="input resize-none" rows={2} value={recommendedReplacement} onChange={e => setRecommendedReplacement(e.target.value)} /></div>
          <div><label className="label">Remarks</label><textarea className="input resize-none" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
          <div><label className="label">Verified By</label><input className="input" value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} /></div>
        </div>
      </div>

      {/* ── Screen preview ── */}
      <div className="no-print">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Print Preview</p>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* A4 portrait constraint: 210mm wide, shown at ~794px screen equivalent */}
          <div style={{ maxWidth: '794px', margin: '0 auto', padding: '48px 56px', boxSizing: 'border-box' }}>
            <Document {...docProps} />
          </div>
        </div>
      </div>

      {/* ── Print target ── */}
      <div className="print-doc" style={{ display: 'none' }}>
        <Document {...docProps} />
      </div>
    </div>
  )
}

export default HardwareIssueForm
