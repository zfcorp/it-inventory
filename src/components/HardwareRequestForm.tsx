import React, { useState } from 'react'
import { Printer, Plus, X, Search } from 'lucide-react'
import logoUrl from '../assets/logo'
import { supabase } from '../lib/supabase'
import type { Asset } from '../types'

const HARDWARE_TYPES = [
  'Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse',
  'Printer', 'Mobile Device', 'Router/Switch', 'Headset',
  'Webcam', 'Docking Station', 'Other',
]

const REQUEST_REASONS = [
  'New Employee Equipment',
  'Replacement of Faulty/Damaged Hardware',
  'Hardware Upgrade Needed',
  'Project-Specific Requirement',
  'Additional Equipment',
  'Other',
]

const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 1.8cm 1.8cm 2cm 1.8cm;
  }
  html, body { width: 210mm; }
  .no-print  { display: none !important; }
  .print-doc { display: block !important; }
  body { background: #fff !important; }
}
`

interface SelectedAsset {
  id: string; asset_id: string; particulars: string; serial_no: string | null; status: string
}

interface DocProps {
  date: string; controlNumber: string; requestedBy: string; department: string
  quantity: string; quantityDescription: string; specifications: string
  additionalNotes: string; managerName: string; itOfficerName: string; presidentName: string
  hardwareTypes: string[]; otherHardware: string; reasons: string[]; otherReason: string
  selectedAssets: SelectedAsset[]
}

/* ─── Printable document ──────────────────────────────────────────────────── */
const Document: React.FC<DocProps> = (p) => {
  const s = {
    wrap:  { fontFamily: "'Arial', sans-serif", fontSize: '9pt', color: '#111', lineHeight: '1.4', width: '100%' } as React.CSSProperties,
    rule:  { border: 'none', borderTop: '2px solid #1e3a8a', margin: '0 0 10px 0' } as React.CSSProperties,
    title: { textAlign: 'center' as const, fontWeight: 800, fontSize: '11.5pt', letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 12px 0' },
    sec:   { marginBottom: '10px' } as React.CSSProperties,
    sHead: { fontWeight: 700, fontSize: '8.5pt', borderBottom: '1px solid #d1d5db', paddingBottom: '3px', marginBottom: '6px' } as React.CSSProperties,
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' } as React.CSSProperties,
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px' } as React.CSSProperties,
    chk:   { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8.5pt' } as React.CSSProperties,
    line:  { borderBottom: '1px solid #9ca3af', minHeight: '16px', paddingBottom: '1px', fontSize: '8.5pt', marginBottom: '3px' } as React.CSSProperties,
    th:    { background: '#1e3a8a', color: '#fff', padding: '4px 6px', fontSize: '8pt', fontWeight: 700, textAlign: 'left' as const, border: '1px solid #1e3a8a' } as React.CSSProperties,
    td:    { padding: '4px 6px', fontSize: '8pt', border: '1px solid #d1d5db', verticalAlign: 'middle' as const } as React.CSSProperties,
    sigG:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '4px' } as React.CSSProperties,
    sigL:  { borderBottom: '1.5px solid #111', paddingTop: '26px', paddingBottom: '2px', fontWeight: 700, fontSize: '8.5pt' } as React.CSSProperties,
    sigS:  { fontSize: '7pt', color: '#6b7280', marginTop: '2px' } as React.CSSProperties,
    foot:  { borderTop: '1px solid #e5e7eb', marginTop: '14px', paddingTop: '4px', fontSize: '7pt', color: '#9ca3af', textAlign: 'center' as const } as React.CSSProperties,
  }

  const cb = (checked: boolean) => <span style={{ fontSize: '10pt', marginRight: '2px' }}>{checked ? '☒' : '☐'}</span>

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '11pt' }}>ZURICH FINANCE CORP</div>
            <div style={{ fontSize: '8pt', color: '#6b7280' }}>Hardware Request Form</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8.5pt' }}>
          <div><b>Date:</b> {p.date || '____________________'}</div>
          <div><b>Control No.:</b> {p.controlNumber}</div>
          {p.department && <div><b>Department:</b> {p.department}</div>}
        </div>
      </div>
      <hr style={s.rule} />
      <p style={s.title}>Hardware Request Form</p>

      {/* Two-column layout for sections 1–3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginBottom: '10px' }}>
        {/* Section 1 */}
        <div style={s.sec}>
          <div style={s.sHead}>1. Hardware Type <span style={{ fontWeight: 400, fontSize: '7.5pt' }}>(check all that apply)</span></div>
          <div style={s.grid3}>
            {HARDWARE_TYPES.filter(t => t !== 'Other').map(t => (
              <div key={t} style={s.chk}>{cb(p.hardwareTypes.includes(t))} {t}</div>
            ))}
            <div style={{ ...s.chk, gridColumn: '1 / -1' }}>
              {cb(p.hardwareTypes.includes('Other'))} Other: {p.otherHardware || <span style={{ color: '#9ca3af' }}>___________</span>}
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div style={s.sec}>
          <div style={s.sHead}>3. Reason for Request</div>
          <div style={s.grid2}>
            {REQUEST_REASONS.filter(r => r !== 'Other').map(r => (
              <div key={r} style={s.chk}>{cb(p.reasons.includes(r))} {r}</div>
            ))}
            <div style={{ ...s.chk, gridColumn: '1 / -1' }}>
              {cb(p.reasons.includes('Other'))} Other: {p.otherReason || <span style={{ color: '#9ca3af' }}>___________</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div style={s.sec}>
        <div style={s.sHead}>2. Quantity Needed</div>
        <div style={{ ...s.line, paddingLeft: '8px' }}>
          {p.quantityDescription || (p.quantity && p.hardwareTypes.length > 0 ? `${p.quantity} ${p.hardwareTypes.join(', ')}` : '\u00A0')}
        </div>
      </div>

      {/* Section 4 */}
      <div style={s.sec}>
        <div style={s.sHead}>4. Specifications / Model</div>
        <div style={{ ...s.line, paddingLeft: '8px', minHeight: '20px' }}>{p.specifications || '\u00A0'}</div>
      </div>

      {/* Section 5: Linked Assets */}
      {p.selectedAssets.length > 0 && (
        <div style={s.sec}>
          <div style={s.sHead}>5. Related Assets</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '22%' }} /><col style={{ width: '44%' }} /><col style={{ width: '22%' }} /><col style={{ width: '12%' }} /></colgroup>
            <thead>
              <tr>
                <th style={s.th}>Asset ID</th>
                <th style={s.th}>Description</th>
                <th style={s.th}>Serial No.</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {p.selectedAssets.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#f5f7ff' : '#fff' }}>
                  <td style={{ ...s.td, fontFamily: 'monospace' }}>{a.asset_id || '—'}</td>
                  <td style={s.td}>{a.particulars}</td>
                  <td style={{ ...s.td, fontFamily: 'monospace' }}>{a.serial_no || '—'}</td>
                  <td style={s.td}>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Additional Notes */}
      {p.additionalNotes && (
        <div style={s.sec}>
          <div style={s.sHead}>Additional Notes</div>
          <div style={{ ...s.line, paddingLeft: '8px', whiteSpace: 'pre-wrap', minHeight: '20px' }}>{p.additionalNotes}</div>
        </div>
      )}

      {/* Approval Workflow */}
      <div style={s.sec}>
        <div style={s.sHead}>Approval Workflow</div>
        <div style={s.sigG}>
          {[
            { label: 'Requested By', name: p.requestedBy, sub: p.department ? `Department: ${p.department}` : '' },
            { label: "Manager's Approval", name: p.managerName, sub: '' },
            { label: "IT Officer's Approval", name: p.itOfficerName, sub: '' },
            { label: "President's Approval", name: p.presidentName, sub: '' },
          ].map(sig => (
            <div key={sig.label}>
              <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '2px' }}>{sig.label}:</div>
              <div style={s.sigL}>{sig.name || '\u00A0'}</div>
              <div style={s.sigS}>Signature Over Printed Name</div>
              {sig.sub && <div style={{ fontSize: '8pt', marginTop: '3px' }}>{sig.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={s.foot}>
        Zurich Finance Corp — IT Inventory System &nbsp;·&nbsp; Generated {new Date().toLocaleString('en-PH')} &nbsp;·&nbsp; Control No. {p.controlNumber}
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */
const HardwareRequestForm: React.FC = () => {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }))
  const [controlNumber, setControlNumber] = useState(() => {
    const n = new Date()
    return `${String(n.getDate()).padStart(2,'0')}${String(n.getMonth()+1).padStart(2,'0')}${n.getFullYear()}-001`
  })
  const [hardwareTypes, setHardwareTypes] = useState<string[]>([])
  const [otherHardware, setOtherHardware] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [quantityDescription, setQuantityDescription] = useState('')
  const [reasons, setReasons] = useState<string[]>([])
  const [otherReason, setOtherReason] = useState('')
  const [specifications, setSpecifications] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [requestedBy, setRequestedBy] = useState('')
  const [department, setDepartment] = useState('')
  const [managerName, setManagerName] = useState('')
  const [itOfficerName, setItOfficerName] = useState('')
  const [presidentName, setPresidentName] = useState('')
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([])
  const [assetSearch, setAssetSearch] = useState('')
  const [assetSugg, setAssetSugg] = useState<Asset[]>([])

  const toggleHW = (t: string) => setHardwareTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const toggleR  = (r: string) => setReasons(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])

  const searchAssets = async (q: string) => {
    setAssetSearch(q)
    if (q.length < 2) { setAssetSugg([]); return }
    const { data } = await supabase.from('assets').select('id, asset_id, particulars, serial_no, status').or(`asset_id.ilike.%${q}%,particulars.ilike.%${q}%`).limit(8)
    if (data) setAssetSugg(data as Asset[])
  }

  const addAsset = (a: Asset) => {
    if (selectedAssets.find(s => s.id === a.id)) return
    setSelectedAssets(p => [...p, { id: a.id, asset_id: a.asset_id, particulars: a.particulars, serial_no: a.serial_no, status: a.status }])
    setAssetSearch(''); setAssetSugg([])
  }

  const docProps: DocProps = {
    date, controlNumber, requestedBy, department, quantity, quantityDescription,
    specifications, additionalNotes, managerName, itOfficerName, presidentName,
    hardwareTypes, otherHardware, reasons, otherReason, selectedAssets,
  }

  return (
    <div className="space-y-5">
      <style>{PRINT_CSS}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-base font-bold text-gray-900">Hardware Request Form</h2>
          <p className="text-xs text-gray-400 mt-0.5">Fill in the form, then print or save as PDF</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Editor */}
      <div className="card space-y-4 no-print">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Date</label><input className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">Control Number</label><input className="input font-mono" value={controlNumber} onChange={e => setControlNumber(e.target.value)} /></div>
          <div><label className="label">Requested By</label><input className="input" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder="Full name" /></div>
          <div><label className="label">Department</label><input className="input" value={department} onChange={e => setDepartment(e.target.value)} /></div>
          <div><label className="label">Quantity</label><input className="input" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div><label className="label">Quantity Description</label><input className="input" value={quantityDescription} onChange={e => setQuantityDescription(e.target.value)} placeholder="e.g. 1 Laptop" /></div>
          <div className="col-span-2"><label className="label">Specifications / Model</label><input className="input" value={specifications} onChange={e => setSpecifications(e.target.value)} placeholder="e.g. Acer Aspire Go, 8GB RAM, 512GB SSD" /></div>
          <div className="col-span-2"><label className="label">Additional Notes</label><textarea className="input resize-none" rows={3} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} /></div>
        </div>

        {/* Hardware Types */}
        <div>
          <label className="label">Hardware Type</label>
          <div className="flex flex-wrap gap-2">
            {HARDWARE_TYPES.map(t => (
              <button key={t} type="button" onClick={() => toggleHW(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${hardwareTypes.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                {t}
              </button>
            ))}
          </div>
          {hardwareTypes.includes('Other') && <input className="input mt-2 text-sm" value={otherHardware} onChange={e => setOtherHardware(e.target.value)} placeholder="Specify..." />}
        </div>

        {/* Reasons */}
        <div>
          <label className="label">Reason for Request</label>
          <div className="flex flex-wrap gap-2">
            {REQUEST_REASONS.map(r => (
              <button key={r} type="button" onClick={() => toggleR(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${reasons.includes(r) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}>
                {r}
              </button>
            ))}
          </div>
          {reasons.includes('Other') && <input className="input mt-2 text-sm" value={otherReason} onChange={e => setOtherReason(e.target.value)} placeholder="Specify..." />}
        </div>

        {/* Asset Linking */}
        <div>
          <label className="label">Linked Assets (optional)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" value={assetSearch} onChange={e => searchAssets(e.target.value)} placeholder="Search by Asset ID or name..." />
            {assetSugg.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {assetSugg.map(a => (
                  <button key={a.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-3" onClick={() => addAsset(a)}>
                    <span className="font-mono text-blue-600 text-xs font-bold w-24 flex-shrink-0">{a.asset_id || '—'}</span>
                    <span className="flex-1 text-gray-700">{a.particulars}</span>
                    <span className="text-xs text-gray-400">{a.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedAssets.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {selectedAssets.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm">
                  <span className="font-mono text-blue-600 text-xs font-bold w-24 flex-shrink-0">{a.asset_id || '—'}</span>
                  <span className="flex-1 text-gray-700">{a.particulars}</span>
                  <span className="text-xs text-gray-400 font-mono">{a.serial_no || '—'}</span>
                  <button onClick={() => setSelectedAssets(p => p.filter(x => x.id !== a.id))} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div><label className="label">Manager's Name</label><input className="input" value={managerName} onChange={e => setManagerName(e.target.value)} /></div>
          <div><label className="label">IT Officer's Name</label><input className="input" value={itOfficerName} onChange={e => setItOfficerName(e.target.value)} /></div>
          <div><label className="label">President's Name</label><input className="input" value={presidentName} onChange={e => setPresidentName(e.target.value)} /></div>
        </div>
      </div>

      {/* Screen preview */}
      <div className="no-print">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Print Preview</p>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div style={{ maxWidth: '794px', margin: '0 auto', padding: '48px 56px', boxSizing: 'border-box' }}>
            <Document {...docProps} />
          </div>
        </div>
      </div>

      {/* Print target */}
      <div className="print-doc" style={{ display: 'none' }}>
        <Document {...docProps} />
      </div>
    </div>
  )
}

export default HardwareRequestForm
