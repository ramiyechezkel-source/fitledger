import { useMemo, useState } from 'react'
import { Search, Plus, ChevronLeft } from 'lucide-react'
import { upsertClient } from '../lib/store'
import { nis, num } from '../lib/format'
import { fmtDate } from '../lib/dates'
import { Sheet, Field, Toggle, Stepper, useToast, Avatar, Loading } from '../components/ui'

export default function Clients({ data, go }) {
  const { clients, balances, settings } = data
  const toast = useToast()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('active') // active | debt | all
  const [add, setAdd] = useState(false)
  const [nc, setNc] = useState({ name: '', defaultPrice: Number(settings?.defaultPrice) || 200 })

  const list = useMemo(() => {
    let l = clients || []
    if (q.trim()) l = l.filter((c) => c.name.includes(q.trim()))
    else if (tab === 'active') l = l.filter((c) => c.active !== false)
    else if (tab === 'debt') l = l.filter((c) => (balances[c.id] || 0) < -0.5)
    return [...l].sort((a, b) => tab === 'debt' ? (balances[a.id] || 0) - (balances[b.id] || 0) : (b.lastSeen || '').localeCompare(a.lastSeen || ''))
  }, [clients, q, tab, balances])
  const debtCount = (clients || []).filter((c) => (balances[c.id] || 0) < -0.5).length

  const save = async () => {
    if (!nc.name.trim()) return
    const id = await upsertClient({ ...nc, active: true }); setAdd(false); setNc({ name: '', defaultPrice: 200 }); toast('הלקוח נוסף'); go('client', id)
  }
  if (!clients) return <Loading />
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between"><h1>לקוחות <span className="muted sm">({clients.length})</span></h1><button className="btn sm primary" onClick={() => setAdd(true)}><Plus size={16} />לקוח</button></div>
      <div className="search"><Search size={18} /><input className="input" placeholder="חפש לקוח…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips">
        <button className={`chip ${tab === 'active' ? 'on' : ''}`} onClick={() => setTab('active')}>פעילים</button>
        <button className={`chip ${tab === 'debt' ? 'on' : ''}`} onClick={() => setTab('debt')}>חייבים ({debtCount})</button>
        <button className={`chip ${tab === 'all' ? 'on' : ''}`} onClick={() => setTab('all')}>כולם</button>
      </div>
      <div className="card list" style={{ padding: '0 14px' }}>
        {list.map((c) => { const b = balances[c.id] || 0; return (
          <div key={c.id} className="item click" onClick={() => go('client', c.id)}>
            <Avatar name={c.name} />
            <div className="grow"><div className="title">{c.name}{c.active === false && <span className="pill" style={{ marginRight: 6 }}>לא פעיל</span>}</div><div className="sub">{c.lastSeen ? `אימון אחרון ${fmtDate(c.lastSeen)} · ` : ''}{nis(c.defaultPrice)} לאימון</div></div>
            <span className={`num ${b < -0.5 ? 'debt' : b > 0.5 ? 'credit' : 'muted'}`} style={{ fontWeight: 600 }}>{Math.abs(b) > 0.5 ? nis(b, { plus: true }) : 'מאוזן'}</span>
            <ChevronLeft size={18} className="muted" />
          </div>) })}
        {!list.length && <div className="empty"><b>לא נמצאו לקוחות</b>{q ? 'נסה חיפוש אחר' : ''}</div>}
      </div>
      <Sheet open={add} onClose={() => setAdd(false)} title="לקוח חדש">
        <div className="col" style={{ gap: 12 }}>
          <Field label="שם"><input className="input" autoFocus value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
          <Field label="מחיר קבוע לאימון"><Stepper value={nc.defaultPrice} onChange={(v) => setNc({ ...nc, defaultPrice: v })} /></Field>
          <button className="btn primary block" onClick={save} disabled={!nc.name.trim()}>הוסף</button>
        </div>
      </Sheet>
    </div>
  )
}
