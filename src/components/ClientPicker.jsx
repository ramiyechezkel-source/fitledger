import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { nis } from '../lib/format'

/** בחירת לקוח עם חיפוש. מציג יתרה נוכחית. */
export default function ClientPicker({ clients, balances = {}, value, onChange, onCreate, activeOnly = true }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = useMemo(() => {
    const s = q.trim()
    let l = (clients || []).filter((c) => !c.isGroupRow)
    if (activeOnly && !s) l = l.filter((c) => c.active !== false)
    if (s) l = l.filter((c) => c.name.includes(s))
    l = [...l].sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''))
    return l.slice(0, 40)
  }, [clients, q, activeOnly])
  const sel = (clients || []).find((c) => c.id === value)
  if (sel && !open) {
    const b = balances[sel.id] || 0
    return (
      <div className="item" style={{ border: '1px solid var(--line-strong)', borderRadius: 14, padding: '8px 12px' }}>
        <div className="avatar">{sel.name.slice(0, 2)}</div>
        <div className="grow"><div className="title">{sel.name}</div><div className="sub">מחיר קבוע {nis(sel.defaultPrice)}{Math.round(b) !== 0 && <> · יתרה <span className={`num ${b < 0 ? 'debt' : 'credit'}`}>{nis(b, { plus: true })}</span></>}</div></div>
        <button type="button" className="btn sm ghost" onClick={() => { setOpen(true); setQ('') }}>החלף</button>
      </div>
    )
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="search"><Search size={18} /><input className="input" placeholder="חפש לקוח…" value={q} autoFocus={open} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="list" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 14, padding: '0 10px' }}>
        {list.map((c) => { const b = balances[c.id] || 0; return (
          <div key={c.id} className="item click" onClick={() => { onChange(c.id); setOpen(false) }}>
            <div className="avatar">{c.name.slice(0, 2)}</div>
            <div className="grow"><div className="title">{c.name}{c.active === false && <span className="pill" style={{ marginRight: 6 }}>לא פעיל</span>}</div><div className="sub">{nis(c.defaultPrice)} לאימון</div></div>
            {Math.round(b) !== 0 && <span className={`num sm ${b < 0 ? 'debt' : 'credit'}`}>{nis(b, { plus: true })}</span>}
          </div>) })}
        {onCreate && q.trim() && !list.some((c) => c.name === q.trim()) && (
          <div className="item click" onClick={() => onCreate(q.trim())}><div className="avatar" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}><Plus size={18} /></div><div className="title">הוסף לקוח חדש: {q.trim()}</div></div>
        )}
        {!list.length && !q && <div className="empty">אין לקוחות פעילים</div>}
      </div>
    </div>
  )
}
