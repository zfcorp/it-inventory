import * as XLSX from 'xlsx'
import type { Asset } from '../types'
import { formatPeso, formatDate } from './constants'

export const exportToExcel = (data: Record<string, unknown>[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export const downloadInventoryTemplate = () => {
  // ── Main sheet ──────────────────────────────────────────────────────────
  const headers = [
    'No.',
    'Date Acquired',
    'Particulars',
    'ID',
    'Serial No.',
    'Cost Per Unit',
    'Issued To',
    'Date Issued',
    'Notes',
    'Status',
    'Category',
    'Branch',
  ]

  const samples = [
    [1,  '06-Feb-20', 'LENOVO THINKPAD E14',              'LAP-001', 'PF1ZXN7Y', 49999, 'Juan Dela Cruz',   '15-Jan-26', '',                  'Working',  'Laptop',    'Main Office'],
    [2,  '28-Aug-24', 'ASUS VIVOBOOK X1402ZA',            'LAP-002', 'N5N0LP01D', 19995, 'Maria Santos',    '28-Aug-24', 'New laptop',        'Issued',   'Laptop',    'Main Office'],
    [3,  '20-Mar-19', 'DELL INSPIRON 14',                 'LAP-003', 'FCV7ZN2',  26000, '',                 '',          'For repair',        'Available','Laptop',    'Venture'],
    [4,  '01-Jun-26', 'HP DESKTOP PC',                    'PC-001',  'HP123456', 35000, 'Ana Reyes',        '01-Jun-26', '',                  'Working',  'Desktop PC','Main Office'],
    [5,  '15-Mar-25', 'BROTHER PRINTER MFC',              'PRN-001', 'BR78901',  12000, '',                 '',          'Accounting Office', 'Working',  'Printer',   'Main Office'],
    [6,  '10-Jan-24', 'TP-LINK 24-PORT SWITCH',           'SW-001',  'TP456789', 8500,  '',                 '',          'Server Room',       'Working',  'Network Switch','Main Office'],
    [7,  '05-May-23', 'SAMSUNG GALAXY A54',               'PH-001',  'IMEI123456789012', 15000, 'Liza Cruz','05-May-23', '',                  'Working',  'Company Phone','Main Office'],
    [8,  '12-Dec-22', 'LOGITECH KEYBOARD K380',           'PER-001', 'LGK12345', 1500,  'Rico Mendoza',     '12-Dec-22', '',                  'Working',  'Keyboard',  'Main Office'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...samples])

  // Column widths
  ws['!cols'] = [
    { wch: 5  },  // No.
    { wch: 15 },  // Date Acquired
    { wch: 35 },  // Particulars
    { wch: 14 },  // ID
    { wch: 18 },  // Serial No.
    { wch: 13 },  // Cost Per Unit
    { wch: 22 },  // Issued To
    { wch: 13 },  // Date Issued
    { wch: 30 },  // Notes
    { wch: 16 },  // Status
    { wch: 20 },  // Category
    { wch: 15 },  // Branch
  ]

  // ── Instructions sheet ──────────────────────────────────────────────────
  const instructions = [
    ['ZURICH FINANCE CORP — IT Inventory Import Template'],
    [''],
    ['COLUMN GUIDE', '', ''],
    ['Column',       'Required?', 'Description / Examples'],
    ['No.',          'No',        'Row number — leave blank, auto-assigned on import'],
    ['Date Acquired','No',        'Purchase date — accepts:  06-Feb-20  |  2026-02-06  |  06/02/2026'],
    ['Particulars',  'YES',       'Equipment description — e.g. LENOVO THINKPAD E14, HP DESKTOP PC'],
    ['ID',           'No',        'Asset ID — e.g. LAP-001, PC-005. Auto-generated if left blank'],
    ['Serial No.',   'No',        'Manufacturer serial number'],
    ['Cost Per Unit','No',        'Purchase price in PHP — numbers only, no ₱ sign — e.g. 49999'],
    ['Issued To',    'No',        'Employee full name — employee is auto-created if not found'],
    ['Date Issued',  'No',        'Issue date — same format as Date Acquired'],
    ['Notes',        'No',        'Any notes OR a location for network equipment — e.g. Accounting Office'],
    ['Status',       'No',        'Leave blank for Available — see valid values below'],
    ['Category',     'No',        'See valid values below — must match exactly'],
    ['Branch',       'No',        'Must match a branch name in the system — e.g. Main Office, Venture'],
    [''],
    ['VALID STATUS VALUES', '', ''],
    ['Working', 'Available', 'Issued'],
    ['Under Repair', 'For Replacement', 'Replaced'],
    ['Returned', 'Damaged', 'Missing', 'Retired'],
    [''],
    ['VALID CATEGORY VALUES', '', ''],
    ['Laptop',      'Desktop PC',         'Router'],
    ['Hub Switch',  'Network Switch',     'Access Point'],
    ['Printer',     'Multifunction Printer', 'Monitor'],
    ['Company Phone', 'Tablet',           'Keyboard'],
    ['Mouse',       'Headset',            'Webcam'],
    ['Docking Station', 'Laptop Charger', 'Monitor Stand'],
    ['USB Hub',     'HDMI Cable',         'Power Adapter', 'Other'],
    [''],
    ['TIPS', '', ''],
    ['• Duplicate IDs are auto-renamed on import — no need to worry about duplicates'],
    ['• If an employee name in "Issued To" does not exist, it will be created automatically'],
    ['• Delete the sample rows (rows 2–9) before importing your real data'],
    ['• Keep the header row (row 1) exactly as-is'],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(instructions)
  ws2['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 55 }]

  // Style the title cell
  if (ws2['A1']) ws2['A1'].s = { font: { bold: true, sz: 13 } }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '📋 Import Data Here')
  XLSX.utils.book_append_sheet(wb, ws2, 'ℹ️ Instructions')
  XLSX.writeFile(wb, 'ZFC_IT_Inventory_Import_Template.xlsx')
}

export const assetsToExportRows = (assets: Asset[]) => {
  return assets.map((a, idx) => ({
    'No.': idx + 1,
    'Date Acquired': a.date_acquired ? formatDate(a.date_acquired) : '',
    'Particulars': a.particulars,
    'ID': a.asset_id,
    'Serial No.': a.serial_no || '',
    'Cost Per Unit': a.cost_per_unit ?? '',
    'Issued To': a.employees?.name || (a.issued_branch as { name: string } | undefined)?.name || a.location || '',
    'Date Issued': a.date_issued ? formatDate(a.date_issued) : '',
    'Notes': a.notes || '',
    'Status': a.status,
    'Category': a.categories?.name || '',
    'Branch': a.branches?.name || '',
    'Location': a.location || '',
    'Department': a.employees?.departments?.name || '',
  }))
}
