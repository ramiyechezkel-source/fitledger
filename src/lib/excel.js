import * as XLSX from 'xlsx'
import { TYPES } from './format'

const HEADERS = ['תאריך', 'לקוח', 'קבוצה', 'סוג', 'סכום', 'שולם', 'קבלה', 'הערה']

export function exportSessions(sessions, filename = 'fitledger.xlsx') {
  const rows = sessions.map((s) => ({
    'תאריך': s.date, 'לקוח': s.clientName, 'קבוצה': s.groupName || '', 'סוג': TYPES[s.type] || s.type,
    'סכום': Number(s.amount) || 0, 'שולם': s.paid ? 'כן' : 'לא', 'קבלה': s.receipt ? 'כן' : '', 'הערה': s.note || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS })
  ws['!cols'] = [{ wch: 11 }, { wch: 20 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 40 }]
  if (!ws['!views']) ws['!views'] = [{ rightToLeft: true }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'אימונים')
  XLSX.writeFile(wb, filename)
}

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ['2026-09-01', 'שם הלקוח', '', 'אישי', 200, 'כן', '', 'דוגמה']])
  ws['!views'] = [{ rightToLeft: true }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'אימונים')
  XLSX.writeFile(wb, 'fitledger-template.xlsx')
}

const TYPE_BY_HE = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]))
const yes = (v) => /^(כן|yes|true|1|v|✓)$/i.test(String(v || '').trim())
function toIso(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return d.toISOString().slice(0, 10) }
  const s = String(v || '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return null
}

/** קורא קובץ אקסל בפורמט התבנית ומחזיר שורות מנורמלות + שגיאות. */
export async function parseImport(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
  const rows = [], errors = []
  raw.forEach((r, i) => {
    const date = toIso(r['תאריך'] ?? r['date'])
    const clientName = String(r['לקוח'] ?? r['client'] ?? '').trim()
    if (!date || !clientName) { errors.push(`שורה ${i + 2}: חסר תאריך או לקוח`); return }
    const amount = Number(String(r['סכום'] ?? r['amount'] ?? '').replace(/[^\d.-]/g, '')) || 0
    rows.push({ date, clientName, amount, paid: yes(r['שולם'] ?? r['paid']), receipt: yes(r['קבלה'] ?? r['receipt']), groupName: String(r['קבוצה'] ?? '').trim() || null, type: TYPE_BY_HE[String(r['סוג'] || '').trim()] || null, note: String(r['הערה'] ?? r['note'] ?? '').trim() })
  })
  return { rows, errors }
}
