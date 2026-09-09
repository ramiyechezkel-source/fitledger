import { useState } from 'react'
import { Plus, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { upsertGroup, deleteGroup, upsertClient } from '../lib/store'
import { nis } from '../lib/format'
import { fmtDate } from '../lib/dates'
import { Sheet, Field, Toggle, Stepper, Confirm, useToast, Avatar, Loading } from '../components/ui'
import ClientPicker from '../components/ClientPicker'

export default function Groups({ data, go }) {
  const { groups, clients, balances } = data
  const toast = useToast()
  const [edit, setEdit] = useState(null) // group object being edited (or {} for new)
  const [addMember, setAddMember] = useState(false)
  const [askDel, setAskDel] = useState(false)
  const byId = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  if (!groups || !clients) return <Loading />
  const active = groups.filter((g) => g.active !== false), inactive = groups.filter((g) => g.active === false)

  const save = async () => { if (!edit.name?.trim()) return; const id = await upsertGroup(edit); toast('נשמר'); setEdit({ ...edit, id }) }
  const removeMember = (cid) => setEdit({ ...edit, memberIds: edit.memberIds.filter((x) => x !== cid) })
  const addM = async (cid) => { if (!edit.memberIds.includes(cid)) setEdit({ ...edit, memberIds: [...edit.memberIds, cid] }); setAddMember(false) }
  const createAndAdd = async (name) => { const cid = await upsertClient({ name, defaultPrice: edit.defaultPrice || 50, active: true, groupId: edit.id || null }); addM(cid); toast(`נוספה: ${name}`) }
  const del = async () => { await deleteGroup(edit.id); setEdit(null); toast('הקבוצה נמחקה (האימונים נשארו)') }

  const GroupCard = ({ g }) => (
    <div className="card" style={{ opacity: g.active === false ? .6 : 1 }}>
      <div className="card-title"><span>{g.name}{g.active === false && <span className="pill" style={{ marginRight: 8 }}>לא פעילה</span>}</span><button className="icon-btn" onClick={() => setEdit({ ...g, memberIds: [...(g.memberIds || [])] })} aria-label="עריכה"><Pencil size={16} /></button></div>
      <div className="sm text2" style={{ marginBottom: 8 }}>{(g.memberIds || []).length} משתתפות · {nis(g.defaultPrice)} לאחת{g.lastSeen ? ` · אימון אחרון ${fmtDate(g.lastSeen)}` : ''}</div>
      <div className="row wrap" style={{ gap: 6 }}>{(g.memberIds || []).map((id) => byId[id]).filter(Boolean).map((c) => { const b = balances[c.id] || 0; return <button key={c.id} className="chip sm" onClick={() => go('client', c.id)}>{c.name}{Math.abs(b) > .5 && <span className={`num ${b < 0 ? 'debt' : 'credit'}`} style={{ marginRight: 5 }}>{nis(b, { plus: true })}</span>}</button> })}</div>
    </div>)

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between"><h1>קבוצות</h1><button className="btn sm primary" onClick={() => setEdit({ name: '', memberIds: [], defaultPrice: 50, active: true })}><Plus size={16} />קבוצה</button></div>
      <div className="grid2">{active.map((g) => <GroupCard key={g.id} g={g} />)}</div>
      {inactive.length > 0 && <><div className="section"><h2 className="muted">היסטוריות</h2></div><div className="grid2">{inactive.map((g) => <GroupCard key={g.id} g={g} />)}</div></>}
      {!groups.length && <div className="empty"><b>אין קבוצות עדיין</b>צור קבוצה, הוסף משתתפות, ובמסך רישום תסמן מי הגיעה.</div>}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'עריכת קבוצה' : 'קבוצה חדשה'} actions={edit?.id && <button className="icon-btn" onClick={() => setAskDel(true)} aria-label="מחק"><Trash2 size={18} /></button>}>
        {edit && <div className="col" style={{ gap: 12 }}>
          <Field label="שם הקבוצה"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="למשל: אימון נשים ורשה" /></Field>
          <Field label="מחיר ברירת מחדל למשתתפת" hint="ניתן לשנות לכל משתתפת בזמן הרישום"><Stepper value={edit.defaultPrice} onChange={(v) => setEdit({ ...edit, defaultPrice: v })} step={5} /></Field>
          <Toggle on={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label={edit.active !== false ? 'קבוצה פעילה' : 'לא פעילה'} />
          <div className="row between"><b>משתתפות ({edit.memberIds.length})</b><button className="btn sm" onClick={() => setAddMember(true)}><UserPlus size={15} />הוסף</button></div>
          <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '0 10px', maxHeight: 300, overflow: 'auto' }}>
            {edit.memberIds.map((id) => byId[id]).filter(Boolean).map((c) => <div key={c.id} className="item"><Avatar name={c.name} /><div className="grow title">{c.name}</div><button className="icon-btn" onClick={() => removeMember(c.id)} aria-label="הסר"><UserMinus size={16} /></button></div>)}
            {!edit.memberIds.length && <div className="empty">אין משתתפות</div>}
          </div>
          <button className="btn primary block" onClick={save} disabled={!edit.name?.trim()}>שמור קבוצה</button>
        </div>}
      </Sheet>
      <Sheet open={addMember} onClose={() => setAddMember(false)} title="הוסף משתתפת">
        <ClientPicker clients={clients.filter((c) => !edit?.memberIds.includes(c.id))} balances={balances} value="" onChange={addM} onCreate={createAndAdd} activeOnly={false} />
      </Sheet>
      <Confirm open={askDel} onClose={() => setAskDel(false)} onConfirm={del} title="למחוק את הקבוצה?" text="האימונים שנרשמו יישארו אצל המשתתפות. רק הגדרת הקבוצה תימחק. אם רק רוצים להסתיר, עדיף לסמן 'לא פעילה'." />
    </div>
  )
}
