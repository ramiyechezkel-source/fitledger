import { useEffect, useMemo, useState } from 'react'
import { Users, User, CheckCheck, ChevronDown } from 'lucide-react'
import { addSessions, upsertClient } from '../lib/store'
import { today, addDays, fmtDateLong } from '../lib/dates'
import { nis, TYPE_LIST } from '../lib/format'
import { Field, Toggle, Stepper, Seg, CheckBox, useToast, Avatar } from '../components/ui'
import ClientPicker from '../components/ClientPicker'

/** מסך רישום אימון: אישי או קבוצתי. מהיר, ברירות מחדל חכמות. */
export default function AddSession({ data, go, arg }) {
  const initGroup = arg && arg.startsWith('group:') ? arg.slice(6) : ''
  const { clients, groups, balances, settings } = data
  const toast = useToast()
  const [mode, setMode] = useState(initGroup ? 'group' : 'personal')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const defaultPrice = Number(settings?.defaultPrice) || 200

  /* ---- אישי ---- */
  const [clientId, setClientId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [desc, setDesc] = useState('')
  const [linkClient, setLinkClient] = useState(false)
  const [amount, setAmount] = useState(defaultPrice)
  const [type, setType] = useState('personal')
  const [paid, setPaid] = useState(false)
  const [receipt, setReceipt] = useState(false)
  const [note, setNote] = useState('')
  const client = clients?.find((c) => c.id === clientId)
  const partner = clients?.find((c) => c.id === partnerId)
  useEffect(() => { if (client && type !== 'other') setAmount(client.defaultPrice || defaultPrice) }, [clientId]) // eslint-disable-line
  useEffect(() => { if (type === 'other') { setAmount(0); setClientId(''); setPartnerId('') } else if (!client) setAmount(defaultPrice); if (type !== 'pair') setPartnerId('') }, [type]) // eslint-disable-line

  const createClient = async (name) => {
    const id = await upsertClient({ name, defaultPrice, active: true })
    setClientId(id); toast(`נוסף לקוח: ${name}`)
  }

  const savePersonal = async () => {
    setBusy(true)
    try {
      const base = { date, receipt, groupId: null, groupName: null, gkey: null, src: 'app' }
      if (type === 'other') {
        if (!desc.trim()) { toast('כתוב תיאור להכנסה', 'err'); return }
        const c = linkClient ? client : null
        await addSessions([{ ...base, clientId: c ? c.id : 'other', clientName: c ? c.name : desc.trim(), amount, type: 'other', paid, note: c ? [desc.trim(), note].filter(Boolean).join(' · ') : note }])
        toast(`נרשם: ${desc.trim()} · ${nis(amount)}`)
        setDesc(''); setNote(''); setPaid(false); setReceipt(false); setClientId('')
        return
      }
      if (!client) { toast('בחר לקוח', 'err'); return }
      if (type === 'pair') {
        if (!partner) { toast('בחר את בן/בת הזוג', 'err'); return }
        const gkey = `pair_${date}_${[client.id, partner.id].sort().join('_')}`
        await addSessions([client, partner].map((c) => ({ ...base, clientId: c.id, clientName: c.name, amount, type: 'pair', paid, note, groupName: 'זוגי', gkey })))
        for (const c of [client, partner]) await upsertClient({ id: c.id, lastSeen: date > (c.lastSeen || '') ? date : c.lastSeen })
        toast(`נרשם אימון זוגי: ${client.name} + ${partner.name} · ${nis(amount * 2)}`)
      } else {
        await addSessions([{ ...base, clientId: client.id, clientName: client.name, amount, type, paid, note }])
        if (Number(amount) !== Number(client.defaultPrice)) await upsertClient({ id: client.id, defaultPrice: amount })
        await upsertClient({ id: client.id, lastSeen: date > (client.lastSeen || '') ? date : client.lastSeen })
        toast(`נרשם: ${client.name} · ${nis(amount)}${paid ? ' · שולם' : ''}`)
      }
      setClientId(''); setPartnerId(''); setNote(''); setPaid(false); setReceipt(false)
    } catch (e) { console.error(e); toast('השמירה נכשלה', 'err') } finally { setBusy(false) }
  }

  /* ---- קבוצה ---- */
  const activeGroups = (groups || []).filter((g) => g.active !== false)
  const [groupId, setGroupId] = useState(initGroup)
  const [guest, setGuest] = useState('')
  const [guests, setGuests] = useState([])   // אורחות חד-פעמיות: {id,name}
  const group = groups?.find((g) => g.id === groupId)
  const [members, setMembers] = useState({}) // id -> {on, amount, paid}
  const [gnote, setGnote] = useState('')
  useEffect(() => {
    if (!group) { setMembers({}); return }
    const m = {}
    for (const id of group.memberIds || []) m[id] = { on: true, amount: group.defaultPrice || 50, paid: false }
    setMembers(m)
  }, [groupId]) // eslint-disable-line
  useEffect(() => { if (!groupId && activeGroups.length === 1) setGroupId(activeGroups[0].id) }, [groups]) // eslint-disable-line
  const byId = useMemo(() => Object.fromEntries((clients || []).map((c) => [c.id, c])), [clients])
  const memberRows = [...(group?.memberIds || []).map((id) => byId[id]).filter(Boolean), ...guests]
  const onCount = Object.values(members).filter((m) => m.on).length
  const total = Object.values(members).filter((m) => m.on).reduce((a, m) => a + (Number(m.amount) || 0), 0)
  const setM = (id, patch) => setMembers((m) => ({ ...m, [id]: { ...m[id], ...patch } }))
  const allPaid = () => setMembers((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, paid: v.on }])))

  const addGuest = async () => {
    const name = guest.trim(); if (!name) return
    let c = (clients || []).find((x) => x.name === name)
    if (!c) { const id = await upsertClient({ name, defaultPrice: group?.defaultPrice || 50, active: true, guest: true }); c = { id, name, defaultPrice: group?.defaultPrice || 50 } }
    setGuests((g) => g.some((x) => x.id === c.id) ? g : [...g, c]); setMembers((m) => ({ ...m, [c.id]: { on: true, amount: group?.defaultPrice || 50, paid: false } })); setGuest('')
  }
  const saveGroup = async () => {
    if (!group) return toast('בחר קבוצה', 'err')
    const list = memberRows.filter((c) => members[c.id]?.on).map((c) => ({
      date, clientId: c.id, clientName: c.name, amount: members[c.id].amount, type: 'group', groupId: group.id, groupName: group.name, gkey: `${group.id}_${date}`, paid: !!members[c.id].paid, receipt: false, note: gnote, src: 'app',
    }))
    if (!list.length) return toast('סמן לפחות משתתפת אחת', 'err')
    setBusy(true)
    try {
      await addSessions(list)
      await Promise.all(list.map((x) => { const c = byId[x.clientId]; return date > (c?.lastSeen || '') ? upsertClient({ id: x.clientId, lastSeen: date }) : null }))
      toast(`נרשם אימון ${group.name}: ${list.length} משתתפות · ${nis(total)}`)
      setGnote(''); setGuests([]); setMembers((m) => Object.fromEntries(Object.entries(m).filter(([k]) => (group.memberIds || []).includes(k)).map(([k, v]) => [k, { ...v, on: true, paid: false, amount: group.defaultPrice || 50 }])))
    } catch (e) { console.error(e); toast('השמירה נכשלה', 'err') } finally { setBusy(false) }
  }

  return (
    <div className="col" style={{ gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <div className="row between"><h1>רישום אימון</h1></div>
      <Seg value={mode} onChange={setMode} options={[{ id: 'personal', label: <span className="row" style={{ gap: 6, justifyContent: 'center' }}><User size={16} />אישי</span> }, { id: 'group', label: <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Users size={16} />קבוצה</span> }]} />

      <div className="card col" style={{ gap: 12 }}>
        <Field label="תאריך">
          <div className="input-row">
            <input type="date" className="input grow" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            <button type="button" className={`chip ${date === today() ? 'on' : ''}`} onClick={() => setDate(today())}>היום</button>
            <button type="button" className={`chip ${date === addDays(today(), -1) ? 'on' : ''}`} onClick={() => setDate(addDays(today(), -1))}>אתמול</button>
          </div>
          <span className="xs muted">{fmtDateLong(date)}</span>
        </Field>

        {mode === 'personal' ? (<>
          {type === 'personal' ? null : <Field label="סוג"><Seg value={type} onChange={setType} options={TYPE_LIST.filter((t) => t.id !== 'group')} /></Field>}
          {type === 'other' ? (<>
            <Field label="מה נמכר?" hint="למשל: תפריט תזונה, משקולות, פרסומת"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="תיאור ההכנסה" autoFocus /></Field>
            <Toggle on={linkClient} onChange={setLinkClient} label={linkClient ? 'משויך ללקוח' : 'ללא לקוח (הכנסה כללית)'} gold />
            {linkClient && <Field label="לקוח"><ClientPicker clients={clients} balances={balances} value={clientId} onChange={setClientId} onCreate={createClient} /></Field>}
          </>) : (<>
            <Field label={type === 'pair' ? 'מתאמן/ת ראשון/ה' : 'לקוח'}><ClientPicker clients={clients} balances={balances} value={clientId} onChange={setClientId} onCreate={createClient} /></Field>
            {type === 'pair' && <Field label="בן/בת הזוג"><ClientPicker clients={(clients || []).filter((c) => c.id !== clientId)} balances={balances} value={partnerId} onChange={setPartnerId} onCreate={async (name) => { const id = await upsertClient({ name, defaultPrice, active: true }); setPartnerId(id); toast(`נוסף לקוח: ${name}`) }} /></Field>}
          </>)}
          <Field label={type === 'pair' ? 'סכום לכל אחד' : 'סכום'} hint={type === 'pair' ? `סה"כ לאימון: ${nis(amount * 2)}` : type === 'other' ? undefined : client ? `ברירת המחדל של ${client.name}: ${nis(client.defaultPrice)}. שינוי כאן יעדכן את המחיר הקבוע שלו.` : `ברירת מחדל ${nis(defaultPrice)}`}><Stepper value={amount} onChange={setAmount} step={type === 'other' ? 50 : 10} /></Field>
          <Toggle on={paid} onChange={setPaid} label="שולם עכשיו" />
          <details className="details" open={type !== 'personal' || receipt || !!note}>
            <summary><ChevronDown size={16} />עוד אפשרויות: זוגי, הכנסה אחרת, קבלה, הערה</summary>
            <div className="col" style={{ gap: 12, paddingBottom: 12 }}>
              {type === 'personal' && <Field label="סוג"><Seg value={type} onChange={setType} options={TYPE_LIST.filter((t) => t.id !== 'group')} /></Field>}
              <Toggle on={receipt} onChange={setReceipt} label="הוצאה קבלה" gold />
              <Field label="הערה"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="אופציונלי" /></Field>
            </div>
          </details>
          <button className="btn primary block" disabled={busy || (type === 'other' ? !desc.trim() || !Number(amount) : type === 'pair' ? !client || !partner : !client)} onClick={savePersonal}>{busy ? 'שומר…' : type === 'pair' ? `שמור אימון זוגי · ${nis(amount * 2)}` : type === 'other' ? `שמור הכנסה · ${nis(amount)}` : `שמור אימון · ${nis(amount)}`}</button>
        </>) : (<>
          <Field label="קבוצה">
            {activeGroups.length ? <div className="chips">{activeGroups.map((g) => <button key={g.id} type="button" className={`chip ${groupId === g.id ? 'on' : ''}`} onClick={() => setGroupId(g.id)}>{g.name}</button>)}</div>
              : <div className="empty">אין קבוצות פעילות. <a onClick={() => go('groups')}>נהל קבוצות</a></div>}
          </Field>
          {group && (<>
            <div className="row between">
              <span className="sm text2">{onCount} מתוך {memberRows.length} משתתפות · סה"כ <b className="num">{nis(total)}</b></span>
              <button type="button" className="btn sm credit" onClick={allPaid}><CheckCheck size={16} />כולן שילמו</button>
            </div>
            <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '0 10px' }}>
              {memberRows.map((c) => { const m = members[c.id] || {}; const b = balances[c.id] || 0; return (
                <div key={c.id} className="item" style={{ opacity: m.on ? 1 : .45 }}>
                  <CheckBox on={!!m.on} onChange={(v) => setM(c.id, { on: v })} />
                  <Avatar name={c.name} />
                  <div className="grow" onClick={() => setM(c.id, { on: !m.on })} style={{ cursor: 'pointer' }}>
                    <div className="title">{c.name}</div>
                    <div className="sub">יתרה <span className={`num ${b < 0 ? 'debt' : b > 0 ? 'credit' : ''}`}>{nis(b, { plus: true })}</span></div>
                  </div>
                  <input className="input num" style={{ width: 74, minHeight: 40, padding: '6px 8px', textAlign: 'center' }} inputMode="decimal" value={m.amount ?? ''} disabled={!m.on} onChange={(e) => setM(c.id, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                  <button type="button" className={`pill ${m.paid ? 'paid' : ''}`} style={{ minWidth: 58, justifyContent: 'center', height: 32 }} disabled={!m.on} onClick={() => setM(c.id, { paid: !m.paid })}>{m.paid ? 'שולם' : 'לא שולם'}</button>
                </div>) })}
              {!memberRows.length && <div className="empty">אין משתתפות בקבוצה. <a onClick={() => go('groups')}>הוסף</a></div>}
            </div>
            <div className="input-row"><input className="input grow" placeholder="אורחת חד-פעמית (שם)" value={guest} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} /><button type="button" className="btn" onClick={addGuest} disabled={!guest.trim()}>הוסף להיום</button></div>
            <Field label="הערה לאימון"><input className="input" value={gnote} onChange={(e) => setGnote(e.target.value)} placeholder="אופציונלי" /></Field>
            <button className="btn primary block" disabled={busy || !onCount} onClick={saveGroup}>{busy ? 'שומר…' : `שמור אימון קבוצתי · ${onCount} משתתפות · ${nis(total)}`}</button>
          </>)}
        </>)}
      </div>
    </div>
  )
}
