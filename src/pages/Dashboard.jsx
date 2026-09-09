import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertTriangle, X } from 'lucide-react'
import RangePicker from '../components/RangePicker'
import BalanceStrip from '../components/BalanceStrip'
import SessionsTable from '../components/SessionsTable'
import SessionEditor from '../components/SessionEditor'
import { monthsBetween, fmtMonthShort, monthKey, fmtDate, addMonths, startOfMonth, today, HE_MONTHS } from '../lib/dates'
import { nis, num, TYPE_LIST } from '../lib/format'
import { Loading, Sheet } from '../components/ui'
import ClientPicker from '../components/ClientPicker'

const Tip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="rc-tip">{label}<br />{payload.map((p) => <div key={p.dataKey}><span style={{ color: p.fill }}>■</span> {p.name}: <b className="num">{nis(p.value)}</b></div>)}</div>) : null

export default function Dashboard({ data, range, setRange, go }) {
  const { clients, groups, sessions, balances, monthly, payments } = data
  const [f, setF] = useState({ clientId: '', groupId: '', type: '', status: '' })
  const [pickClient, setPickClient] = useState(false)
  const [edit, setEdit] = useState(null)
  const [showFlags, setShowFlags] = useState(false)

  const filtered = useMemo(() => (sessions || []).filter((s) =>
    (!f.clientId || s.clientId === f.clientId) && (!f.groupId || s.groupId === f.groupId) && (!f.type || s.type === f.type) &&
    (!f.status || (f.status === 'paid' ? s.paid : !s.paid)) && (!showFlags || s.flag)), [sessions, f, showFlags])

  const k = useMemo(() => {
    let expected = 0, paid = 0, count = 0, unpaidCount = 0
    for (const s of filtered) { const a = Number(s.amount) || 0; expected += a; count++; if (s.paid) paid += a; else unpaidCount++ }
    return { expected, paid, open: expected - paid, count, unpaidCount }
  }, [filtered])
  const flagged = (sessions || []).filter((s) => s.flag).length
  const creditTotal = Object.values(balances).filter((v) => v > 0).reduce((a, b) => a + b, 0)
  const debtTotal = -Object.values(balances).filter((v) => v < 0).reduce((a, b) => a + b, 0)

  // גרף בטווח: לפי יום (עד 45 יום) או לפי חודש
  const chart = useMemo(() => {
    const span = (new Date(range.to) - new Date(range.from)) / 86400000
    const byKey = {}
    const keyOf = span <= 45 ? (d) => d : (d) => monthKey(d)
    for (const s of filtered) { const kk = keyOf(s.date); byKey[kk] = byKey[kk] || { paid: 0, open: 0 }; byKey[kk][s.paid ? 'paid' : 'open'] += Number(s.amount) || 0 }
    return Object.entries(byKey).sort().map(([kk, v]) => ({ k: kk, label: span <= 45 ? fmtDate(kk).slice(0, -3) : fmtMonthShort(kk), ...v }))
  }, [filtered, range])

  // מגמה 12 חודשים – מהסיכומים החודשיים (12 קריאות)
  const trend = useMemo(() => {
    const m = Object.fromEntries((monthly || []).map((x) => [x.id, x]))
    const months = monthsBetween(addMonths(startOfMonth(today()), -11), today())
    return months.map((mk) => ({ label: fmtMonthShort(mk), charged: m[mk]?.charged || 0, paid: m[mk]?.paid || 0 }))
  }, [monthly])
  const avg12 = trend.reduce((a, t) => a + t.charged, 0) / 12
  const thisMonth = trend[trend.length - 1]

  const chipsFilters = (
    <div className="chips" style={{ marginBottom: 6 }}>
      <button className={`chip sm ${f.clientId ? 'x' : ''}`} onClick={() => f.clientId ? setF({ ...f, clientId: '' }) : setPickClient(true)}>{f.clientId ? <>{clients.find((c) => c.id === f.clientId)?.name} <X size={12} /></> : 'לקוח'}</button>
      {groups?.map((g) => <button key={g.id} className={`chip sm ${f.groupId === g.id ? 'x' : ''}`} onClick={() => setF({ ...f, groupId: f.groupId === g.id ? '' : g.id })}>{g.name}{f.groupId === g.id && <X size={12} />}</button>)}
      {TYPE_LIST.map((t) => <button key={t.id} className={`chip sm ${f.type === t.id ? 'x' : ''}`} onClick={() => setF({ ...f, type: f.type === t.id ? '' : t.id })}>{t.label}</button>)}
      <button className={`chip sm ${f.status === 'unpaid' ? 'x' : ''}`} onClick={() => setF({ ...f, status: f.status === 'unpaid' ? '' : 'unpaid' })}>לא שולם</button>
      <button className={`chip sm ${f.status === 'paid' ? 'x' : ''}`} onClick={() => setF({ ...f, status: f.status === 'paid' ? '' : 'paid' })}>שולם</button>
    </div>)

  if (!sessions || !clients) return <Loading />
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between"><h1>דשבורד</h1><span className="muted sm">{HE_MONTHS[new Date().getMonth()]} {new Date().getFullYear()}</span></div>
      <div><RangePicker range={range} setRange={setRange} />{chipsFilters}</div>

      {flagged > 0 && !showFlags && <div className="banner"><AlertTriangle size={18} /><span className="grow">{flagged} רשומות מהאקסל מסומנות לבדיקה (כפילויות / חסר סכום).</span><button className="btn sm" onClick={() => { setRange({ preset: 'all', from: '2000-01-01', to: '2099-12-31' }); setShowFlags(true) }}>הצג</button></div>}
      {showFlags && <div className="banner"><span className="grow">מציג רק רשומות לבדיקה. לחץ על שורה כדי לאשר או למחוק.</span><button className="btn sm" onClick={() => setShowFlags(false)}>סגור</button></div>}

      <div className="kpis">
        <div className="kpi hero"><span className="bar" style={{ background: 'var(--gold)' }} /><span className="l">צפוי בטווח</span><span className="v num">{nis(k.expected)}</span>
          <span className="sub">{num(k.count)} אימונים · שולם {k.expected ? Math.round((k.paid / k.expected) * 100) : 0}%</span>
          <div className="progress"><i style={{ width: `${k.expected ? (k.paid / k.expected) * 100 : 0}%` }} /></div></div>
        <div className="kpi"><span className="bar" style={{ background: 'var(--credit)' }} /><span className="l">שולם</span><span className="v num credit">{nis(k.paid)}</span></div>
        <div className="kpi"><span className="bar" style={{ background: 'var(--debt)' }} /><span className="l">עוד לא שולם</span><span className="v num debt">{nis(k.open)}</span><span className="sub">{num(k.unpaidCount)} אימונים</span></div>
        <div className="kpi"><span className="l">ממוצע חודשי (12 ח')</span><span className="v num">{nis(avg12)}</span><span className="sub">החודש עד כה {nis(thisMonth?.charged || 0)}</span></div>
        <div className="kpi"><span className="l">חובות פתוחים · נכון ל-{fmtDate(range.to > today() ? today() : range.to)}</span><span className="v num debt">{nis(debtTotal)}</span><span className="sub">שולם מראש: <span className="credit num">{nis(creditTotal)}</span></span></div>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-title">הכנסות בטווח <span className="muted xs">שולם / לא שולם</span></div>
          <div style={{ height: 220 }}>
            {chart.length ? <ResponsiveContainer><BarChart data={chart} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="30%">
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} orientation="right" width={52} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
              <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="paid" name="שולם" stackId="a" fill="#4ADE9E" radius={[0, 0, 4, 4]} /><Bar dataKey="open" name="לא שולם" stackId="a" fill="#FF7A5C" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer> : <div className="empty">אין נתונים בטווח</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-title">מי חייב, מי בזכות <button className="btn sm ghost" onClick={() => go('clients')}>כל הלקוחות</button></div>
          <BalanceStrip balances={balances} clients={clients} onPick={(c) => go('client', c.id)} filterIds={f.groupId ? new Set(groups.find((g) => g.id === f.groupId)?.memberIds) : null} />
        </div>
        <div className="card span" style={{ gridColumn: '1/-1' }}>
          <div className="card-title">12 חודשים אחרונים <span className="muted xs">מהסיכומים החודשיים, ללא תלות בסינון</span></div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer><BarChart data={trend} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="35%">
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} orientation="right" width={52} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
              <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="charged" name="צפוי" fill="#33406A" radius={[4, 4, 0, 0]}>{trend.map((t, i) => <Cell key={i} fill={i === trend.length - 1 ? '#F4C15D' : '#33406A'} />)}</Bar>
              <Bar dataKey="paid" name="שולם" fill="#4ADE9E" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </div>
      </div>

      <SessionsTable sessions={filtered} onEdit={setEdit} title="פירוט" />
      {edit && <SessionEditor session={edit} onClose={() => setEdit(null)} />}
      <Sheet open={pickClient} onClose={() => setPickClient(false)} title="סנן לפי לקוח">
        <ClientPicker clients={clients} balances={balances} value="" onChange={(id) => { setF({ ...f, clientId: id }); setPickClient(false) }} activeOnly={false} />
      </Sheet>
    </div>
  )
}
