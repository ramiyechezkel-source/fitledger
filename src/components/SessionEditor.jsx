import { useState } from 'react'
import { Trash2, Users } from 'lucide-react'
import { updateSession, deleteSessions, addSessions } from '../lib/store'
import { today } from '../lib/dates'
import { TYPE_LIST, nis } from '../lib/format'
import { Sheet, Field, Toggle, Stepper, Seg, Confirm, CheckBox, Avatar, useToast } from './ui'

/** עריכת אימון קיים: תאריך, סכום, סוג, שולם, קבלה, הערה, מחיקה.
 *  לשורה קבוצתית כללית (בלי שמות מהאקסל): פיצול למשתתפות. */
export default function SessionEditor({ session, onClose, groups = [], clients = [] }) {
  const toast = useToast()
  const [s, setS] = useState(session ? { ...session } : null)
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [split, setSplit] = useState(null) // {id: {on, amount}}
  if (!session || !s) return null
  const set = (p) => setS((x) => ({ ...x, ...p }))
  const group = session.groupId ? groups?.find((g) => g.id === session.groupId) : null
  const isGroupRow = !!group && session.clientName === session.groupName
  const members = (group?.memberIds || []).map((id) => clients?.find((c) => c.id === id)).filter(Boolean)

  const save = async () => {
    setBusy(true)
    try {
      const patch = { date: s.date, amount: Number(s.amount) || 0, type: s.type, paid: !!s.paid, receipt: !!s.receipt, note: s.note || '' }
      if (session.flag && s.flag === null) patch.flag = null
      await updateSession(session, patch); toast('נשמר'); onClose()
    } catch (e) { console.error(e); toast('השמירה נכשלה', 'err') } finally { setBusy(false) }
  }
  const del = async () => { try { await deleteSessions([session]); toast('נמחק'); onClose() } catch (e) { toast('המחיקה נכשלה', 'err') } }
  const startSplit = () => { const n = members.length || 1; const per = Math.round((Number(session.amount) || 0) / n); setSplit(Object.fromEntries(members.map((m) => [m.id, { on: true, amount: per }]))) }
  const doSplit = async () => {
    const list = members.filter((m) => split[m.id]?.on).map((m) => ({ date: session.date, clientId: m.id, clientName: m.name, amount: Number(split[m.id].amount) || 0, type: 'group', groupId: group.id, groupName: group.name, gkey: session.gkey || `${group.id}_${session.date}`, paid: !!session.paid, receipt: false, note: session.note || '', src: 'split' }))
    if (!list.length) return toast('סמן לפחות משתתפת אחת', 'err')
    setBusy(true)
    try { await addSessions(list); await deleteSessions([session]); toast(`פוצל ל-${list.length} משתתפות`); onClose() }
    catch (e) { console.error(e); toast('הפיצול נכשל', 'err') } finally { setBusy(false) }
  }
  const splitTotal = split ? Object.values(split).filter((x) => x.on).reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0

  return (
    <Sheet open onClose={onClose} title={session.clientName} actions={<button className="icon-btn" onClick={() => setAsk(true)} aria-label="מחק"><Trash2 size={18} /></button>}>
      <div className="col" style={{ gap: 12 }}>
        {session.groupName && <div className="xs muted">אימון קבוצתי · {session.groupName}</div>}
        {session.flag && <div className="banner">{session.flag === 'duplicate' ? 'רשומה כפולה מהאקסל (אותו תאריך, לקוח וסכום). אפשר למחוק או לאשר.' : 'רשומה מהאקסל בלי סכום.'}<button className="btn sm" onClick={() => set({ flag: null })} style={{ marginRight: 'auto' }}>אשר</button></div>}
        {isGroupRow && !split && <div className="banner"><Users size={18} /><span className="grow">באקסל לא נרשם מי השתתפה באימון הזה, אז הסכום ({nis(session.amount)}) רשום על הקבוצה. אפשר לפצל אותו למשתתפות.</span><button className="btn sm primary" onClick={startSplit}>פצל</button></div>}
        {split && (<div className="card col" style={{ gap: 8, padding: 12 }}>
          <div className="row between"><b>מי השתתפה?</b><span className="sm text2">סה"כ <span className="num">{nis(splitTotal)}</span> מתוך {nis(session.amount)}</span></div>
          <div className="list">{members.map((m) => { const x = split[m.id]; return (
            <div key={m.id} className="item" style={{ opacity: x.on ? 1 : .45 }}>
              <CheckBox on={x.on} onChange={(v) => setSplit({ ...split, [m.id]: { ...x, on: v } })} /><Avatar name={m.name} /><div className="grow title">{m.name}</div>
              <input className="input num" style={{ width: 74, minHeight: 40, padding: '6px 8px', textAlign: 'center' }} inputMode="decimal" value={x.amount} disabled={!x.on} onChange={(e) => setSplit({ ...split, [m.id]: { ...x, amount: e.target.value.replace(/[^\d.]/g, '') } })} />
            </div>) })}</div>
          <div className="row"><button className="btn ghost" onClick={() => setSplit(null)}>ביטול</button><button className="btn primary grow" disabled={busy} onClick={doSplit}>שייך למשתתפות ומחק את השורה הכללית</button></div>
        </div>)}
        <Field label="תאריך"><input type="date" className="input" value={s.date} max={today()} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="סכום"><Stepper value={s.amount} onChange={(v) => set({ amount: v })} /></Field>
        <Field label="סוג"><Seg value={s.type} onChange={(v) => set({ type: v })} options={TYPE_LIST} /></Field>
        <div className="row wrap" style={{ gap: 18 }}>
          <Toggle on={!!s.paid} onChange={(v) => set({ paid: v })} label="שולם" />
          <Toggle on={!!s.receipt} onChange={(v) => set({ receipt: v })} label="הוצאה קבלה" gold />
        </div>
        {s.paid && session.paidAt && <div className="xs muted">סומן כשולם ב-{session.paidAt}</div>}
        <Field label="הערה"><textarea className="input" value={s.note || ''} onChange={(e) => set({ note: e.target.value })} /></Field>
        <button className="btn primary block" disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמור שינויים'}</button>
      </div>
      <Confirm open={ask} onClose={() => setAsk(false)} onConfirm={del} title="למחוק את האימון?" text="הפעולה תסיר את הרשומה לצמיתות ותעדכן את הסיכומים." />
    </Sheet>
  )
}
