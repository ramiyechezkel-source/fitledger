import { useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import { fmtDate } from '../lib/dates'
import { nis, TYPES } from '../lib/format'
import { exportSessions } from '../lib/excel'
import { CheckBox } from './ui'
import { setPaidMany } from '../lib/store'

/** טבלת אימונים: מיון, בחירה מרובה, סימון שולם, ייצוא לאקסל. */
export default function SessionsTable({ sessions, onEdit, title = 'אימונים', pageSize = 60 }) {
  const [shown, setShown] = useState(pageSize)
  const [sel, setSel] = useState({})
  const [sort, setSort] = useState({ k: 'date', d: -1 })
  const list = [...sessions].sort((a, b) => { const x = a[sort.k] ?? '', y = b[sort.k] ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * sort.d })
  const selList = sessions.filter((s) => sel[s.id])
  const toggleAll = () => { if (selList.length === list.length) setSel({}); else setSel(Object.fromEntries(list.map((s) => [s.id, true]))) }
  const th = (k, label) => <th onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : -1 }))} style={{ cursor: 'pointer' }}>{label}{sort.k === k && (sort.d < 0 ? ' ↓' : ' ↑')}</th>
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-title">
        <span>{title} <span className="muted sm">({sessions.length})</span></span>
        <div className="row">
          {selList.length > 0 && <>
            <button className="btn sm credit" onClick={async () => { await setPaidMany(selList, true); setSel({}) }}>סמן {selList.length} כשולם</button>
            <button className="btn sm" onClick={async () => { await setPaidMany(selList, false); setSel({}) }}>בטל שולם</button>
          </>}
          <button className="btn sm" onClick={() => exportSessions(list, `fitledger-${new Date().toISOString().slice(0, 10)}.xlsx`)}><Download size={15} />אקסל</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th style={{ width: 36 }}><CheckBox on={list.length > 0 && selList.length === list.length} onChange={toggleAll} /></th>{th('date', 'תאריך')}{th('clientName', 'לקוח')}{th('groupName', 'קבוצה')}{th('type', 'סוג')}{th('amount', 'סכום')}{th('paid', 'סטטוס')}<th>קבלה</th><th>הערה</th></tr></thead>
          <tbody>
            {list.slice(0, shown).map((s) => (
              <tr key={s.id} className="click">
                <td onClick={(e) => e.stopPropagation()}><CheckBox on={!!sel[s.id]} onChange={(v) => setSel((x) => ({ ...x, [s.id]: v }))} /></td>
                <td className="num" onClick={() => onEdit(s)}>{fmtDate(s.date)}</td>
                <td onClick={() => onEdit(s)}>{s.clientName}{s.flag && <span className="pill flag" style={{ marginRight: 6 }}>לבדיקה</span>}</td>
                <td className="muted" onClick={() => onEdit(s)}>{s.groupName || ''}</td>
                <td className="muted" onClick={() => onEdit(s)}>{TYPES[s.type] || s.type}</td>
                <td className="num" onClick={() => onEdit(s)}>{nis(s.amount)}</td>
                <td><button className={`pill ${s.paid ? 'paid' : 'unpaid'}`} onClick={() => setPaidMany([s], !s.paid)}>{s.paid ? 'שולם' : 'לא שולם'}</button></td>
                <td className="muted" onClick={() => onEdit(s)}>{s.receipt ? '✓' : ''}</td>
                <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.note} onClick={() => onEdit(s)}>{s.note}</td>
              </tr>))}
            {!list.length && <tr><td colSpan={9} className="empty">אין אימונים בטווח ובסינון שנבחרו</td></tr>}
          </tbody>
        </table>
      </div>
      {shown < list.length && <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setShown((n) => n + pageSize)}><ChevronDown size={16} />הצג עוד ({list.length - shown})</button>}
    </div>
  )
}
