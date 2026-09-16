import { useMemo, useState } from 'react'
import { ArrowRight, Pencil, Plus, Trash2, MessageCircle } from 'lucide-react'
import { useClientSessions, upsertClient, deleteClient, addPayment, deletePayment, deleteSessions, setPaidMany } from '../lib/store'
import { nis, num, TYPES } from '../lib/format'
import { fmtDate, today } from '../lib/dates'
import { Sheet, Field, Toggle, Stepper, Confirm, useToast, Loading } from '../components/ui'
import SessionsTable from '../components/SessionsTable'
import SessionEditor from '../components/SessionEditor'

export default function ClientDetail({ id, data, go, range }) {
  const { clients, balances, payments, groups } = data
  const toast = useToast()
  const c = clients?.find((x) => x.id === id)
  const [sessions] = useClientSessions(id)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState(null)
  const [pay, setPay] = useState(false)
  const [p, setP] = useState({ date: today(), amount: '', note: '' })
  const [askDel, setAskDel] = useState(false)
  const [editS, setEditS] = useState(null)
  const myPayments = (payments || []).filter((x) => x.clientId === id).sort((a, b) => b.date.localeCompare(a.date))
  const sorted = useMemo(() => [...(sessions || [])].sort((a, b) => b.date.localeCompare(a.date)), [sessions])
  const stats = useMemo(() => {
    const s = sorted; const total = s.reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const unpaid = s.filter((x) => !x.paid); const open = unpaid.reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const ytd = s.filter((x) => x.date >= today().slice(0, 4) + '-01-01').reduce((a, x) => a + (Number(x.amount) || 0), 0)
    return { count: s.length, total, open, unpaidCount: unpaid.length, ytd }
  }, [sorted])
  if (!clients) return <Loading />
  if (!c) return <div className="empty">הלקוח לא נמצא <a onClick={() => go('clients')}>חזרה</a></div>
  const b = balances[id] || 0
  const grp = groups?.find((g) => g.id === c.groupId || (g.memberIds || []).includes(id))

  const saveEdit = async () => { await upsertClient({ id, ...form }); setEdit(false); toast('נשמר') }
  const savePay = async () => {
    const amount = Number(p.amount); if (!amount) return
    await addPayment({ ...p, amount, clientId: id, clientName: c.name, src: 'app' }); setPay(false); setP({ date: today(), amount: '', note: '' }); toast(`נרשם תשלום ${nis(amount)}`)
  }
  const settleAll = async () => {
    const unpaid = sorted.filter((s) => !s.paid); if (!unpaid.length) return
    await setPaidMany(unpaid, true); toast(`${unpaid.length} אימונים סומנו כשולמו`)
  }
  const del = async () => {
    if (sorted.length) await deleteSessions(sorted)
    for (const x of myPayments) await deletePayment(x.id)
    await deleteClient(id); toast('הלקוח נמחק'); go('clients')
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(`היי ${c.name}, תזכורת: יתרה לתשלום ${nis(-b)} עבור ${stats.unpaidCount} אימונים. תודה!`)}`

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row"><button className="icon-btn" onClick={() => go('clients')} aria-label="חזרה"><ArrowRight size={18} /></button><h1 className="grow">{c.name}</h1><button className="icon-btn" onClick={() => { setForm({ name: c.name, defaultPrice: c.defaultPrice, active: c.active !== false }); setEdit(true) }} aria-label="עריכה"><Pencil size={17} /></button></div>
      <div className="kpis">
        <div className={`kpi hero ${b < -0.5 ? 'g-debt' : 'g-credit'}`}><span className="bar" style={{ background: b < -0.5 ? 'var(--debt)' : 'var(--credit)', color: b < -0.5 ? 'var(--debt)' : 'var(--credit)' }} /><span className="l">יתרה נכון להיום</span><span className={`v num ${b < -0.5 ? 'debt' : b > 0.5 ? 'credit' : ''}`}>{nis(b, { plus: true })}</span>
          <span className="sub">{b < -0.5 ? `${stats.unpaidCount} אימונים לא שולמו` : b > 0.5 ? 'שילם/ה מראש' : 'מאוזן'}{c.active === false && ' · לא פעיל'}{grp && ` · ${grp.name}`}</span></div>
        <div className="kpi"><span className="l">השנה</span><span className="v num">{nis(stats.ytd)}</span></div>
        <div className="kpi"><span className="l">סה"כ אימונים</span><span className="v num">{num(stats.count)}</span><span className="sub">{nis(stats.total)} מאז {c.firstSeen ? fmtDate(c.firstSeen) : 'ההתחלה'}</span></div>
      </div>
      <div className="row wrap">
        <button className="btn credit" onClick={() => setPay(true)}><Plus size={16} />רשום תשלום</button>
        {stats.unpaidCount > 0 && <button className="btn" onClick={settleAll}>סמן הכל כשולם ({stats.unpaidCount})</button>}
        {b < -0.5 && <a className="btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />תזכורת בוואטסאפ</a>}
      </div>

      {myPayments.length > 0 && <div className="card">
        <div className="card-title">תשלומים ומקדמות <span className="muted xs">מוסיפים ליתרה</span></div>
        <div className="list">{myPayments.map((x) => <div key={x.id} className="item"><div className="grow"><div className="title num credit">+{nis(x.amount)}</div><div className="sub">{fmtDate(x.date)}{x.note ? ` · ${x.note}` : ''}</div></div><button className="icon-btn" onClick={async () => { if (confirm('למחוק את התשלום?')) { await deletePayment(x.id); toast('נמחק') } }} aria-label="מחק"><Trash2 size={16} /></button></div>)}</div>
      </div>}

      {sessions ? <SessionsTable sessions={sorted} onEdit={setEditS} title="היסטוריית אימונים" /> : <Loading />}
      {editS && <SessionEditor session={editS} onClose={() => setEditS(null)} groups={groups} clients={clients} />}

      <Sheet open={edit} onClose={() => setEdit(false)} title="עריכת לקוח" actions={<button className="icon-btn" onClick={() => setAskDel(true)} aria-label="מחק"><Trash2 size={18} /></button>}>
        {form && <div className="col" style={{ gap: 12 }}>
          <Field label="שם"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="מחיר קבוע לאימון" hint="נטען אוטומטית ברישום אימון חדש"><Stepper value={form.defaultPrice} onChange={(v) => setForm({ ...form, defaultPrice: v })} /></Field>
          <Toggle on={form.active} onChange={(v) => setForm({ ...form, active: v })} label={form.active ? 'לקוח פעיל' : 'לא פעיל (מוסתר מרשימות)'} />
          <button className="btn primary block" onClick={saveEdit}>שמור</button>
        </div>}
      </Sheet>
      <Sheet open={pay} onClose={() => setPay(false)} title={`תשלום מ${c.name}`}>
        <div className="col" style={{ gap: 12 }}>
          <div className="xs muted">לתשלום על אימון ספציפי עדיף לסמן "שולם" על האימון. כאן רושמים מקדמות, חבילות ותשלומים חלקיים. היתרה מתעדכנת אוטומטית.</div>
          <Field label="תאריך"><input type="date" className="input" value={p.date} max={today()} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
          <Field label="סכום"><input className="input big num" inputMode="decimal" autoFocus placeholder="0" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
          {b < -0.5 && <button className="btn sm" onClick={() => setP({ ...p, amount: String(Math.round(-b)) })}>מלא את כל החוב ({nis(-b)})</button>}
          <Field label="הערה"><input className="input" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="חבילה, מזומן, ביט…" /></Field>
          <button className="btn credit block" disabled={!Number(p.amount)} onClick={savePay}>רשום תשלום</button>
        </div>
      </Sheet>
      <Confirm open={askDel} onClose={() => setAskDel(false)} onConfirm={del} title={`למחוק את ${c.name}?`} text={`יימחקו גם ${stats.count} האימונים ו-${myPayments.length} התשלומים של הלקוח. אם רק רוצים להסתיר, עדיף לסמן "לא פעיל".`} />
    </div>
  )
}
