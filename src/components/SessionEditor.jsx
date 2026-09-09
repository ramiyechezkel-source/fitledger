import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { updateSession, deleteSessions } from '../lib/store'
import { today } from '../lib/dates'
import { TYPE_LIST } from '../lib/format'
import { Sheet, Field, Toggle, Stepper, Seg, Confirm, useToast } from './ui'

/** עריכת אימון קיים: תאריך, סכום, סוג, שולם, קבלה, הערה, מחיקה. */
export default function SessionEditor({ session, onClose }) {
  const toast = useToast()
  const [s, setS] = useState(session ? { ...session } : null)
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!session || !s) return null
  const set = (p) => setS((x) => ({ ...x, ...p }))
  const save = async () => {
    setBusy(true)
    try {
      const patch = { date: s.date, amount: Number(s.amount) || 0, type: s.type, paid: !!s.paid, receipt: !!s.receipt, note: s.note || '' }
      if (session.flag && s.flag === null) patch.flag = null
      await updateSession(session, patch); toast('נשמר'); onClose()
    } catch (e) { console.error(e); toast('השמירה נכשלה', 'err') } finally { setBusy(false) }
  }
  const del = async () => { try { await deleteSessions([session]); toast('נמחק'); onClose() } catch (e) { toast('המחיקה נכשלה', 'err') } }
  return (
    <Sheet open onClose={onClose} title={session.clientName} actions={<button className="icon-btn" onClick={() => setAsk(true)} aria-label="מחק"><Trash2 size={18} /></button>}>
      <div className="col" style={{ gap: 12 }}>
        {session.groupName && <div className="xs muted">אימון קבוצתי · {session.groupName}</div>}
        {session.flag && <div className="banner">{session.flag === 'duplicate' ? 'רשומה כפולה מהאקסל (אותו תאריך, לקוח וסכום). אפשר למחוק או לאשר.' : 'רשומה מהאקסל בלי סכום.'}<button className="btn sm" onClick={() => set({ flag: null })} style={{ marginRight: 'auto' }}>אשר</button></div>}
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
