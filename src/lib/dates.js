export const pad = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())
export const monthKey = (ds) => ds.slice(0, 7)
export const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
export const addMonths = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setMonth(d.getMonth() + n); return iso(d) }
export const startOfMonth = (ds) => ds.slice(0, 8) + '01'
export const endOfMonth = (ds) => { const d = new Date(ds.slice(0, 4), Number(ds.slice(5, 7)), 0); return iso(d) }
export const startOfWeek = (ds) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() - d.getDay()); return iso(d) } // ראשון
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
export const HE_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const fmtDate = (ds) => { if (!ds) return ''; const [y, m, d] = ds.split('-'); return `${Number(d)}.${Number(m)}.${y.slice(2)}` }
export const fmtDateLong = (ds) => { if (!ds) return ''; const d = new Date(ds + 'T00:00:00'); return `יום ${HE_DAYS[d.getDay()]}, ${d.getDate()} ב${HE_MONTHS[d.getMonth()]} ${d.getFullYear()}` }
export const fmtMonth = (mk) => { const [y, m] = mk.split('-'); return `${HE_MONTHS[Number(m) - 1]} ${y}` }
export const fmtMonthShort = (mk) => { const [y, m] = mk.split('-'); return `${HE_MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}` }

export const PRESETS = [
  { id: 'today', label: 'היום' },
  { id: 'week', label: 'השבוע' },
  { id: 'month', label: 'החודש' },
  { id: 'prev', label: 'חודש קודם' },
  { id: '3m', label: '3 חודשים' },
  { id: '6m', label: 'חצי שנה' },
  { id: 'year', label: 'שנה' },
  { id: 'all', label: 'הכל' },
  { id: 'custom', label: 'טווח' },
]

export function presetRange(id, base = today()) {
  switch (id) {
    case 'today': return [base, base]
    case 'week': return [startOfWeek(base), base]
    case 'month': return [startOfMonth(base), endOfMonth(base)]
    case 'prev': { const p = addMonths(startOfMonth(base), -1); return [p, endOfMonth(p)] }
    case '3m': return [addMonths(base, -3), base]
    case '6m': return [addMonths(base, -6), base]
    case 'year': return [addMonths(base, -12), base]
    case 'all': return ['2000-01-01', '2099-12-31']
    default: return [startOfMonth(base), endOfMonth(base)]
  }
}

export const monthsBetween = (a, b) => { const out = []; let m = startOfMonth(a); while (m <= b) { out.push(monthKey(m)); m = addMonths(m, 1) } return out }
