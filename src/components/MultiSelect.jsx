import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'
import { Sheet } from './ui'

const useMobile = () => { const [m, set] = useState(() => window.innerWidth < 900); useEffect(() => { const h = () => set(window.innerWidth < 900); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, []); return m }

/** פילטר BI: כפתור עם רשימה נפתחת, חיפוש, בחירה מרובה, ניקוי. options: [{id,label,sub?,badge?}] */
export default function MultiSelect({ label, options, value = [], onChange, searchable = true, single = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()
  const mobile = useMobile()
  useEffect(() => {
    if (!open || mobile) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open, mobile])
  const list = useMemo(() => { const s = q.trim(); const l = s ? options.filter((o) => o.label.includes(s)) : options; return [...l].sort((a, b) => (value.includes(b.id) - value.includes(a.id)) || ((!!a.dim) - (!!b.dim))) }, [options, q, value])
  const toggle = (id) => { if (single) { onChange(value.includes(id) ? [] : [id]); setOpen(false); return } onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]) }
  const selLabels = value.map((id) => options.find((o) => o.id === id)?.label).filter(Boolean)
  const btnText = !value.length ? label : selLabels.length === 1 ? selLabels[0] : `${label} · ${selLabels.length}`

  const body = (
    <div className="col" style={{ gap: 8 }}>
      {searchable && <div className="search"><Search size={16} /><input className="input" style={{ minHeight: 40, padding: '8px 36px 8px 12px' }} placeholder="חיפוש…" value={q} autoFocus={!mobile} onChange={(e) => setQ(e.target.value)} /></div>}
      <div className="row between xs muted" style={{ padding: '0 2px' }}><span>{value.length ? `${value.length} נבחרו` : `${options.length} ערכים`}</span>{value.length > 0 && <button className="gold" onClick={() => onChange([])}>נקה</button>}</div>
      <div className="ms-list">
        {list.map((o) => { const on = value.includes(o.id); return (
          <button key={o.id} className={`ms-item ${on ? 'on' : ''} ${o.dim && !on ? 'dim' : ''}`} onClick={() => toggle(o.id)} title={o.dim ? 'אין אימונים בטווח' : undefined}>
            <span className={`check ${on ? 'on' : ''}`}>{on && <Check size={13} strokeWidth={3} />}</span>
            <span className="grow" style={{ textAlign: 'right' }}>{o.label}{o.sub && <span className="xs muted" style={{ display: 'block' }}>{o.sub}</span>}</span>
            {o.badge && <span className={`xs num ${o.badgeClass || 'muted'}`}>{o.badge}</span>}
          </button>) })}
        {!list.length && <div className="empty">אין תוצאות</div>}
      </div>
    </div>)

  return (
    <div className="ms" ref={ref}>
      <button className={`ms-btn ${value.length ? 'on' : ''}`} onClick={() => setOpen(!open)}>
        <span>{btnText}</span>
        {value.length ? <span className="ms-x" onClick={(e) => { e.stopPropagation(); onChange([]) }}><X size={13} /></span> : <ChevronDown size={15} className="muted" />}
      </button>
      {open && !mobile && <div className="ms-pop">{body}</div>}
      {mobile && <Sheet open={open} onClose={() => setOpen(false)} title={label}>{body}</Sheet>}
    </div>
  )
}
