import { useMemo, useState } from 'react'
import { Download, ChevronDown, ChevronLeft, Trash2, Users } from 'lucide-react'
import { fmtDate } from '../lib/dates'
import { nis, TYPES } from '../lib/format'
import { exportSessions } from '../lib/excel'
import { CheckBox, Confirm, useToast } from './ui'
import { setPaidMany, deleteSessions } from '../lib/store'

/** טבלת אימונים: אימון קבוצתי מקובץ לשורה אחת עם שמות המשתתפות, נפתח לשורות פרטניות.
 *  מיון, בחירה מרובה, סימון שולם, מחיקה, ייצוא לאקסל. */
/** context = כל האימונים בטווח (לפני סינון), כדי שאימון קבוצתי יציג את כל המשתתפות גם כשמסננים לקוח. */
export default function SessionsTable({ sessions, context, onEdit, title = 'אימונים', pageSize = 60, onClient, onGroup, selClients, selGroups }) {
  const xfC = (s) => onClient ? <span className={`xf ${selClients?.has(s.clientId) ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onClient(s.clientId) }} title="לחץ לסינון">{s.clientName}</span> : s.clientName
  const xfG = (id, name) => onGroup && id ? <span className={`xf ${selGroups?.has(id) ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onGroup(id) }} title="לחץ לסינון">{name}</span> : (name || '')
  const [shown, setShown] = useState(pageSize)
  const [sel, setSel] = useState({})
  const [sort, setSort] = useState({ k: 'date', d: -1 })
  const [open, setOpen] = useState({})   // gkey -> expanded
  const [grouped, setGrouped] = useState(true)
  const [askDel, setAskDel] = useState(false)
  const toast = useToast()

  // בניית שורות תצוגה: קבוצות מקובצות לפי gkey
  const rows = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => { const x = a[sort.k] ?? '', y = b[sort.k] ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * sort.d })
    if (!grouped) return sorted.map((s) => ({ kind: 'one', s }))
    const out = []; const seen = {}
    for (const s of sorted) {
      if (!s.gkey) { out.push({ kind: 'one', s }); continue }
      if (seen[s.gkey]) { seen[s.gkey].items.push(s); continue }
      const g = { kind: 'group', key: s.gkey, date: s.date, groupName: s.groupName, items: [s] }
      seen[s.gkey] = g; out.push(g)
    }
    return out
  }, [sessions, sort, grouped])

  const byGkey = useMemo(() => { const m = {}; for (const s of (context || sessions)) if (s.gkey) (m[s.gkey] = m[s.gkey] || []).push(s); return m }, [context, sessions])
  const selList = sessions.filter((s) => sel[s.id])
  const toggleAll = () => { if (selList.length === sessions.length) setSel({}); else setSel(Object.fromEntries(sessions.map((s) => [s.id, true]))) }
  const th = (k, label) => <th onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : -1 }))} style={{ cursor: 'pointer' }}>{label}{sort.k === k && (sort.d < 0 ? ' ↓' : ' ↑')}</th>

  const Row = ({ s, indent, dim }) => (
    <tr className="click" style={{ background: indent ? '#ffffff04' : undefined, opacity: dim ? .55 : 1 }}>
      <td onClick={(e) => e.stopPropagation()}><CheckBox on={!!sel[s.id]} onChange={(v) => setSel((x) => ({ ...x, [s.id]: v }))} /></td>
      <td className="num muted" onClick={() => onEdit(s)}>{indent ? '' : fmtDate(s.date)}</td>
      <td onClick={() => onEdit(s)} style={indent ? { paddingRight: 28 } : undefined}>{indent && <span className="muted">└ </span>}{xfC(s)}{s.flag && <span className="pill flag" style={{ marginRight: 6 }}>לבדיקה</span>}</td>
      <td className="muted" onClick={() => onEdit(s)}>{indent ? '' : xfG(s.groupId, s.groupName)}</td>
      <td className="muted" onClick={() => onEdit(s)}>{TYPES[s.type] || s.type}</td>
      <td className="num" onClick={() => onEdit(s)}>{nis(s.amount)}</td>
      <td><button className={`pill ${s.paid ? 'paid' : 'unpaid'}`} onClick={() => setPaidMany([s], !s.paid)}>{s.paid ? 'שולם' : 'לא שולם'}</button></td>
      <td className="muted" onClick={() => onEdit(s)}>{s.receipt ? '✓' : ''}</td>
      <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.note} onClick={() => onEdit(s)}>{s.note}</td>
    </tr>)

  const GroupRow = ({ g }) => {
    const all = byGkey[g.key] || g.items            // כל המשתתפות באימון
    const inFilter = new Set(g.items.map((x) => x.id))
    const filtered = all.length !== g.items.length
    const total = all.reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const paid = all.filter((x) => x.paid).length
    const allSel = g.items.every((x) => sel[x.id])
    const isOpen = !!open[g.key]
    const single = all.length === 1 && all[0].clientName === g.groupName // שורה כללית בלי שמות
    if (single) return <Row s={g.items[0]} />
    return (<>
      <tr className="click" style={{ background: '#F4C15D0A' }}>
        <td onClick={(e) => e.stopPropagation()}><CheckBox on={allSel} onChange={(v) => setSel((x) => ({ ...x, ...Object.fromEntries(g.items.map((i) => [i.id, v])) }))} /></td>
        <td className="num" onClick={() => setOpen({ ...open, [g.key]: !isOpen })}>{fmtDate(g.date)}</td>
        <td onClick={() => setOpen({ ...open, [g.key]: !isOpen })} style={{ whiteSpace: 'normal', minWidth: 220 }}>
          <span className="row" style={{ gap: 6 }}><Users size={14} className="gold" /><b>{g.groupName}</b><span className="muted">· {all.length} {g.groupName === 'זוגי' ? 'מתאמנים' : 'משתתפות'}</span>{isOpen ? <ChevronDown size={14} className="muted" /> : <ChevronLeft size={14} className="muted" />}</span>
          {!isOpen && <div className="xs text2" style={{ marginTop: 3, lineHeight: 1.5 }}>{all.map((x) => <span key={x.id} style={{ marginLeft: 8, fontWeight: filtered && inFilter.has(x.id) ? 700 : 400, color: filtered && inFilter.has(x.id) ? 'var(--gold)' : undefined, opacity: filtered && !inFilter.has(x.id) ? .6 : 1 }}>{x.clientName}<span className={x.paid ? 'credit' : 'debt'}> {x.paid ? '✓' : '✗'}</span></span>)}</div>}
        </td>
        <td className="muted">{xfG(all[0].groupId, g.groupName)}</td>
        <td className="muted">קבוצה</td>
        <td className="num" onClick={() => setOpen({ ...open, [g.key]: !isOpen })}>{nis(total)}</td>
        <td><button className={`pill ${paid === all.length ? 'paid' : paid ? '' : 'unpaid'}`} onClick={() => setPaidMany(all, paid !== all.length)}>{paid}/{all.length} שולמו</button></td>
        <td className="muted">{all.every((x) => x.receipt) ? '✓' : ''}</td>
        <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{all[0].note}</td>
      </tr>
      {isOpen && all.map((x) => <Row key={x.id} s={x} indent dim={filtered && !inFilter.has(x.id)} />)}
    </>)
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-title">
        <span>{title} <span className="muted sm">({sessions.length})</span></span>
        <div className="row wrap">
          {selList.length > 0 && <>
            <button className="btn sm credit" onClick={async () => { await setPaidMany(selList, true); setSel({}) }}>סמן {selList.length} כשולם</button>
            <button className="btn sm" onClick={async () => { await setPaidMany(selList, false); setSel({}) }}>בטל שולם</button>
            <button className="btn sm danger" onClick={() => setAskDel(true)}><Trash2 size={14} />מחק {selList.length}</button>
          </>}
          <button className={`chip sm ${grouped ? 'x' : ''}`} onClick={() => setGrouped(!grouped)} title="קיבוץ אימוני קבוצה לשורה אחת"><Users size={13} /> {grouped ? 'מקובץ' : 'פרטני'}</button>
          <button className="btn sm" onClick={() => exportSessions([...sessions].sort((a, b) => b.date.localeCompare(a.date)), `fitledger-${new Date().toISOString().slice(0, 10)}.xlsx`)}><Download size={15} />אקסל</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th style={{ width: 36 }}><CheckBox on={sessions.length > 0 && selList.length === sessions.length} onChange={toggleAll} /></th>{th('date', 'תאריך')}{th('clientName', 'לקוח')}{th('groupName', 'קבוצה')}{th('type', 'סוג')}{th('amount', 'סכום')}{th('paid', 'סטטוס')}<th>קבלה</th><th>הערה</th></tr></thead>
          <tbody>
            {rows.slice(0, shown).map((r) => r.kind === 'group' ? <GroupRow key={r.key} g={r} /> : <Row key={r.s.id} s={r.s} />)}
            {!rows.length && <tr><td colSpan={9} className="empty">אין אימונים בטווח ובסינון שנבחרו</td></tr>}
          </tbody>
        </table>
      </div>
      <Confirm open={askDel} onClose={() => setAskDel(false)} onConfirm={async () => { try { await deleteSessions(selList); toast(`נמחקו ${selList.length} רשומות`); setSel({}) } catch (e) { toast('המחיקה נכשלה', 'err') } }} title={`למחוק ${selList.length} רשומות?`} text="הרשומות יימחקו לצמיתות והסיכומים יתעדכנו. אין ביטול." />
      {shown < rows.length && <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setShown((n) => n + pageSize)}><ChevronDown size={16} />הצג עוד ({rows.length - shown})</button>}
    </div>
  )
}
