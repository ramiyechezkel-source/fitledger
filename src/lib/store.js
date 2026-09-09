import { useEffect, useState, useMemo } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  collection, doc, onSnapshot, query, where, orderBy, writeBatch, setDoc, updateDoc, deleteDoc,
  increment, serverTimestamp, getDocs, limit,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { monthKey, today } from './dates'

/* ---------- Auth ---------- */
export function useAuth() {
  const [state, set] = useState({ user: undefined })
  useEffect(() => onAuthStateChanged(auth, (user) => set({ user })), [])
  return state.user
}
export const login = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password)
export const logout = () => signOut(auth)

/* ---------- Generic live query ---------- */
function useLive(makeQuery, deps, enabled = true) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (!enabled) { setData([]); return }
    setData(null)
    const unsub = onSnapshot(makeQuery(), (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setErr(null)
    }, (e) => { console.error(e); setErr(e) })
    return unsub
  }, deps) // eslint-disable-line
  return [data, err]
}

export const useClients = () => useLive(() => query(collection(db, 'clients'), orderBy('name')), [])
export const useGroups = () => useLive(() => query(collection(db, 'groups'), orderBy('name')), [])
export const usePayments = () => useLive(() => query(collection(db, 'payments'), orderBy('date')), [])
export const useMonthly = () => useLive(() => query(collection(db, 'monthly'), orderBy('__name__')), [])
export const useSettings = () => {
  const [s, set] = useState(null)
  useEffect(() => onSnapshot(doc(db, 'settings', 'app'), (d) => set(d.exists() ? d.data() : {})), [])
  return s
}
/** אימונים בטווח תאריכים (מחרוזות YYYY-MM-DD, השוואה לקסיקוגרפית). */
export const useSessions = (from, to) =>
  useLive(() => query(collection(db, 'sessions'), where('date', '>=', from), where('date', '<=', to), orderBy('date', 'desc')), [from, to])
/** אימונים שעדיין לא שולמו – קבוצה קטנה, משמשת ליתרות. */
export const useOpenSessions = () =>
  useLive(() => query(collection(db, 'sessions'), where('paid', '==', false)), [])
/** אימונים ששולמו אחרי תאריך מסוים – ליתרה היסטורית "נכון ל-". */
export const useSessionsPaidAfter = (asOf) =>
  useLive(() => query(collection(db, 'sessions'), where('paidAt', '>', asOf)), [asOf], asOf < today())
export const useClientSessions = (clientId) =>
  useLive(() => query(collection(db, 'sessions'), where('clientId', '==', clientId), limit(2000)), [clientId], !!clientId)

/* ---------- Balances ---------- */
/** יתרה לכל לקוח נכון לתאריך asOf: תשלומים עד התאריך פחות אימונים שלא שולמו עד התאריך.
 *  חיובי = זכות (שילם מראש), שלילי = חוב. */
export function computeBalances({ openSessions = [], paidAfter = [], payments = [], asOf = today() }) {
  const bal = {}
  const add = (id, v) => { bal[id] = (bal[id] || 0) + v }
  const unpaid = [...openSessions, ...paidAfter.filter((s) => !openSessions.some((o) => o.id === s.id))]
  for (const s of unpaid) if (s.date <= asOf) add(s.clientId, -(Number(s.amount) || 0))
  for (const p of payments) if (p.date <= asOf) add(p.clientId, Number(p.amount) || 0)
  return bal
}

/* ---------- Monthly summary (12 קריאות במקום 700) ---------- */
function monthlyDelta(batch, mk, charged, paid, count) {
  batch.set(doc(db, 'monthly', mk), { charged: increment(charged), paid: increment(paid), count: increment(count) }, { merge: true })
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/* ---------- Sessions ---------- */
export async function addSessions(list) {
  // list: [{date, clientId, clientName, amount, type, groupId, groupName, gkey, paid, receipt, note}]
  const batch = writeBatch(db)
  const per = {}
  for (const s of list) {
    const ref = doc(collection(db, 'sessions'))
    const amount = Number(s.amount) || 0
    batch.set(ref, clean({ ...s, amount, paid: !!s.paid, paidAt: s.paid ? (s.paidAt || s.date) : null, receipt: !!s.receipt, note: s.note || '', createdAt: serverTimestamp() }))
    const mk = monthKey(s.date)
    per[mk] = per[mk] || { c: 0, p: 0, n: 0 }
    per[mk].c += amount; per[mk].p += s.paid ? amount : 0; per[mk].n += 1
  }
  for (const [mk, d] of Object.entries(per)) monthlyDelta(batch, mk, d.c, d.p, d.n)
  await batch.commit()
}

export async function updateSession(old, patch) {
  const batch = writeBatch(db)
  const next = { ...old, ...patch }
  if ('paid' in patch) next.paidAt = patch.paid ? (patch.paidAt || today()) : null
  const oa = Number(old.amount) || 0, na = Number(next.amount) || 0
  const om = monthKey(old.date), nm = monthKey(next.date)
  if (om === nm) {
    const dc = na - oa, dp = (next.paid ? na : 0) - (old.paid ? oa : 0)
    if (dc || dp) monthlyDelta(batch, om, dc, dp, 0)
  } else {
    monthlyDelta(batch, om, -oa, old.paid ? -oa : 0, -1)
    monthlyDelta(batch, nm, na, next.paid ? na : 0, 1)
  }
  const { id, createdAt, ...data } = next
  batch.update(doc(db, 'sessions', old.id), clean({ ...data, amount: na, updatedAt: serverTimestamp() }))
  await batch.commit()
}

export async function setPaidMany(sessions, paid) {
  const batch = writeBatch(db)
  const per = {}
  for (const s of sessions) {
    if (!!s.paid === paid) continue
    batch.update(doc(db, 'sessions', s.id), { paid, paidAt: paid ? today() : null, updatedAt: serverTimestamp() })
    const mk = monthKey(s.date); per[mk] = (per[mk] || 0) + (paid ? 1 : -1) * (Number(s.amount) || 0)
  }
  for (const [mk, dp] of Object.entries(per)) monthlyDelta(batch, mk, 0, dp, 0)
  await batch.commit()
}

export async function deleteSessions(sessions) {
  const chunks = []
  for (let i = 0; i < sessions.length; i += 400) chunks.push(sessions.slice(i, i + 400))
  for (const chunk of chunks) {
    const batch = writeBatch(db)
    const per = {}
    for (const s of chunk) {
      batch.delete(doc(db, 'sessions', s.id))
      const mk = monthKey(s.date); const a = Number(s.amount) || 0
      per[mk] = per[mk] || { c: 0, p: 0, n: 0 }
      per[mk].c -= a; per[mk].p -= s.paid ? a : 0; per[mk].n -= 1
    }
    for (const [mk, d] of Object.entries(per)) monthlyDelta(batch, mk, d.c, d.p, d.n)
    await batch.commit()
  }
}

/* ---------- Payments (זיכויים / תשלומים מראש / חלקיים) ---------- */
export async function addPayment(p) {
  const ref = doc(collection(db, 'payments'))
  await setDoc(ref, clean({ ...p, amount: Number(p.amount) || 0, note: p.note || '', createdAt: serverTimestamp() }))
  return ref.id
}
export const deletePayment = (id) => deleteDoc(doc(db, 'payments', id))
export const updatePayment = (id, patch) => updateDoc(doc(db, 'payments', id), clean({ ...patch, amount: Number(patch.amount) }))

/* ---------- Clients & Groups ---------- */
export async function upsertClient(c) {
  const ref = c.id ? doc(db, 'clients', c.id) : doc(collection(db, 'clients'))
  const { id, ...data } = c
  await setDoc(ref, clean({ ...data, name: (data.name || '').trim(), defaultPrice: Number(data.defaultPrice) || 200, active: data.active !== false, updatedAt: serverTimestamp() }), { merge: true })
  return ref.id
}
export const deleteClient = (id) => deleteDoc(doc(db, 'clients', id))
export async function upsertGroup(g) {
  const ref = g.id ? doc(db, 'groups', g.id) : doc(collection(db, 'groups'))
  const { id, ...data } = g
  await setDoc(ref, clean({ ...data, name: (data.name || '').trim(), memberIds: data.memberIds || [], defaultPrice: Number(data.defaultPrice) || 50, active: data.active !== false, updatedAt: serverTimestamp() }), { merge: true })
  return ref.id
}
export const deleteGroup = (id) => deleteDoc(doc(db, 'groups', id))
export const saveSettings = (patch) => setDoc(doc(db, 'settings', 'app'), patch, { merge: true })

/* ---------- Seed / Import ---------- */
export async function isDbEmpty() {
  const s = await getDocs(query(collection(db, 'sessions'), limit(1)))
  return s.empty
}

/** טעינת ההיסטוריה מהאקסל (קובץ history.json שנבנה מראש). */
export async function importSeed(seed, onProgress) {
  const all = []
  for (const c of seed.clients) all.push(['clients', c.id, { name: c.name, defaultPrice: c.defaultPrice, active: c.active, groupId: c.groupId || null, firstSeen: c.firstSeen, lastSeen: c.lastSeen, src: 'excel' }])
  for (const g of seed.groups) all.push(['groups', g.id, { name: g.name, memberIds: g.memberIds, defaultPrice: g.defaultPrice, active: g.active, firstSeen: g.firstSeen, lastSeen: g.lastSeen, src: 'excel' }])
  for (const p of seed.payments) all.push(['payments', p.id, { date: p.date, clientId: p.clientId, clientName: p.clientName, amount: p.amount, note: p.note, src: 'excel' }])
  const monthly = {}
  for (const s of seed.sessions) {
    const { id, rowTotal, ...rest } = s
    all.push(['sessions', id, { ...rest, groupId: rest.groupId || null, groupName: rest.groupName || null, gkey: rest.gkey || null, flag: rest.flag || null, paidAt: rest.paid ? rest.date : null, receipt: false }])
    const mk = monthKey(s.date); monthly[mk] = monthly[mk] || { charged: 0, paid: 0, count: 0 }
    monthly[mk].charged += s.amount; monthly[mk].paid += s.paid ? s.amount : 0; monthly[mk].count += 1
  }
  for (const [mk, v] of Object.entries(monthly)) all.push(['monthly', mk, v])
  all.push(['settings', 'app', { defaultPrice: 200, seedLoaded: seed.meta, seedLoadedAt: new Date().toISOString() }])
  let done = 0
  for (let i = 0; i < all.length; i += 450) {
    const batch = writeBatch(db)
    for (const [col, id, data] of all.slice(i, i + 450)) batch.set(doc(db, col, id), data)
    await batch.commit()
    done = Math.min(all.length, i + 450)
    onProgress && onProgress(done, all.length)
  }
}

/** ייבוא גנרי מאקסל: שורות {date, clientName, amount, paid, groupName, type, note, receipt}. יוצר לקוחות חסרים. */
export async function importRows(rows, clients, groups) {
  const byName = Object.fromEntries(clients.map((c) => [c.name.trim(), c]))
  const gByName = Object.fromEntries(groups.map((g) => [g.name.trim(), g]))
  const newClients = {}
  const list = []
  for (const r of rows) {
    const name = (r.clientName || '').trim(); if (!name || !r.date) continue
    let c = byName[name] || newClients[name]
    if (!c) { const id = doc(collection(db, 'clients')).id; c = { id, name, defaultPrice: Number(r.amount) || 200, active: true }; newClients[name] = c }
    const g = r.groupName ? gByName[r.groupName.trim()] : null
    list.push({ date: r.date, clientId: c.id, clientName: name, amount: Number(r.amount) || 0, type: r.type || (g ? 'group' : 'personal'), groupId: g?.id || null, groupName: g?.name || null, gkey: g ? `${g.id}_${r.date}` : null, paid: !!r.paid, receipt: !!r.receipt, note: r.note || '', src: 'import' })
  }
  const batch = writeBatch(db)
  for (const c of Object.values(newClients)) batch.set(doc(db, 'clients', c.id), { ...c, src: 'import' })
  await batch.commit()
  for (let i = 0; i < list.length; i += 400) await addSessions(list.slice(i, i + 400))
  return { sessions: list.length, newClients: Object.keys(newClients).length }
}
