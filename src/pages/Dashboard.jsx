import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { AlertTriangle, X, UserX, ArrowUpLeft } from 'lucide-react'
import RangePicker from '../components/RangePicker'
import BalanceStrip from '../components/BalanceStrip'
import SessionsTable from '../components/SessionsTable'
import SessionEditor from '../components/SessionEditor'
import { monthsBetween, fmtMonthShort, monthKey, fmtDate, addMonths, startOfMonth, endOfMonth, addDays, today, HE_MONTHS } from '../lib/dates'
import { nis, num, TYPE_LIST } from '../lib/format'
import { Loading } from '../components/ui'
import MultiSelect from '../components/MultiSelect'

const Tip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="rc-tip">{label}<br />{payload.map((p) => <div key={p.dataKey}><span style={{ color: p.fill }}>■</span> {p.name}: <b className="num">{nis(p.value)}</b></div>)}</div>) : null

export default function Dashboard({ data, range, setRange, go }) {
  const { clients, groups, sessions, balances, monthly, payments, openSessions = [] } = data
  const [f, setF] = useState({ clientIds: [], groupIds: [], types: [], status: [] })
  const [edit, setEdit] = useState(null)
  const [showFlags, setShowFlags] = useState(false)
  const [tab, setTab] = useState('view')
  const [mobile, setMobile] = useState(() => window.innerWidth < 900)
  useEffect(() => { const h = () => setMobile(window.innerWidth < 900); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const showView = !mobile || tab === 'view', showAnalysis = !mobile || tab === 'analysis'

  const groupMembers = useMemo(() => { if (!f.groupIds.length) return null; const set = new Set(); for (const gid of f.groupIds) for (const id of groups?.find((x) => x.id === gid)?.memberIds || []) set.add(id); return set }, [groups, f.groupIds])
  const clientSet = useMemo(() => f.clientIds.length ? new Set(f.clientIds) : null, [f.clientIds])
  const filtered = useMemo(() => (sessions || []).filter((s) =>
    (!clientSet || clientSet.has(s.clientId)) && (!f.groupIds.length || f.groupIds.includes(s.groupId) || groupMembers?.has(s.clientId)) && (!f.types.length || f.types.includes(s.type)) &&
    (!f.status.length || (f.status.includes('paid') && s.paid) || (f.status.includes('unpaid') && !s.paid)) && (!showFlags || s.flag)), [sessions, f, showFlags, groupMembers, clientSet])

  const k = useMemo(() => {
    let expected = 0, paid = 0, count = 0, unpaidCount = 0
    for (const s of filtered) { const a = Number(s.amount) || 0; expected += a; count++; if (s.paid) paid += a; else unpaidCount++ }
    return { expected, paid, open: expected - paid, count, unpaidCount }
  }, [filtered])
  const flagged = (sessions || []).filter((s) => s.flag).length
  // יתרות בהיקף הסינון: לקוח בודד / חברי קבוצה / כולם
  const scopeBal = useMemo(() => Object.entries(balances).filter(([id]) => clientSet ? clientSet.has(id) : groupMembers ? groupMembers.has(id) : true).map(([, v]) => v), [balances, clientSet, groupMembers])
  const creditTotal = scopeBal.filter((v) => v > 0).reduce((a, b) => a + b, 0)
  const debtTotal = -scopeBal.filter((v) => v < 0).reduce((a, b) => a + b, 0)
  const scopeLabel = clientSet ? (f.clientIds.length === 1 ? clients?.find((c) => c.id === f.clientIds[0])?.name : `${f.clientIds.length} לקוחות`) : groupMembers ? (f.groupIds.length === 1 ? groups.find((g) => g.id === f.groupIds[0])?.name : `${f.groupIds.length} קבוצות`) : null

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
    return months.map((mk) => ({ k: mk, label: fmtMonthShort(mk), charged: m[mk]?.charged || 0, paid: m[mk]?.paid || 0 }))
  }, [monthly])
  const avg12 = trend.slice(0, 11).reduce((a, t) => a + t.charged, 0) / 11
  const thisMonth = trend[trend.length - 1]
  const prevMonth = trend[trend.length - 2]
  // תחזית לחודש: לפי הקצב עד היום
  const forecast = useMemo(() => {
    const t = today(); const day = Number(t.slice(8, 10)); const days = Number(endOfMonth(t).slice(8, 10))
    const pace = day >= 3 ? ((thisMonth?.charged || 0) / day) * days : avg12
    return { value: pace, delta: prevMonth?.charged ? (pace - prevMonth.charged) / prevMonth.charged : null }
  }, [thisMonth, prevMonth, avg12])
  // גיל החוב: האימון הכי ישן שלא שולם, לכל לקוח
  const aging = useMemo(() => { const a = {}; for (const s of openSessions) { const x = a[s.clientId] || { oldest: '9999', count: 0 }; if (s.date < x.oldest) x.oldest = s.date; x.count++; a[s.clientId] = x } return a }, [openSessions])
  // לקוחות שנעלמו: פעילים, אימון אחרון לפני 21–120 יום
  const churn = useMemo(() => { const t = today(); const from = addDays(t, -120), to = addDays(t, -21)
    return (clients || []).filter((c) => c.active !== false && c.lastSeen && c.lastSeen >= from && c.lastSeen <= to && !groups?.some((g) => g.name === c.name))
      .map((c) => ({ ...c, days: Math.round((new Date(t) - new Date(c.lastSeen)) / 86400000) })).sort((a, b) => a.days - b.days).slice(0, 8) }, [clients, groups])

  // אפשרויות לפילטרים, עם ספירת אימונים בטווח
  const counts = useMemo(() => { const c = {}, g = {}, t = {}; for (const s of sessions || []) { c[s.clientId] = (c[s.clientId] || 0) + 1; if (s.groupId) g[s.groupId] = (g[s.groupId] || 0) + 1; t[s.type] = (t[s.type] || 0) + 1 } return { c, g, t } }, [sessions])
  const clientOpts = useMemo(() => [...(clients || [])].filter((c) => !c.isGroupRow).sort((a, b) => (counts.c[b.id] || 0) - (counts.c[a.id] || 0) || a.name.localeCompare(b.name)).map((c) => { const b = balances[c.id] || 0; return { id: c.id, label: c.name, dim: !counts.c[c.id], sub: counts.c[c.id] ? `${counts.c[c.id]} אימונים בטווח` : c.active === false ? 'לא פעיל' : 'ללא אימונים בטווח', badge: Math.abs(b) > .5 ? nis(b, { plus: true }) : undefined, badgeClass: b < 0 ? 'debt' : 'credit' } }), [clients, counts, balances])
  const groupOpts = useMemo(() => (groups || []).map((g) => ({ id: g.id, label: g.name, dim: !counts.g[g.id], sub: `${(g.memberIds || []).length} משתתפות${counts.g[g.id] ? ` · ${counts.g[g.id]} בטווח` : ''}` })), [groups, counts])
  const typeOpts = TYPE_LIST.map((t) => ({ id: t.id, label: t.label, dim: !counts.t[t.id], badge: counts.t[t.id] ? String(counts.t[t.id]) : undefined }))
  const hasFilter = f.clientIds.length || f.groupIds.length || f.types.length || f.status.length
  // סינון צולב: לחיצה על ערך בויזואל אחד מסננת את כולם (לחיצה חוזרת מבטלת)
  const toggleClient = (id) => setF((x) => ({ ...x, clientIds: x.clientIds.includes(id) ? x.clientIds.filter((c) => c !== id) : [...x.clientIds, id] }))
  const toggleGroup = (id) => setF((x) => ({ ...x, groupIds: x.groupIds.includes(id) ? x.groupIds.filter((c) => c !== id) : [...x.groupIds, id] }))
  const pickBar = (d) => { if (!d?.k) return; if (d.k.length === 7) setRange({ preset: 'custom', from: d.k + '-01', to: endOfMonth(d.k + '-01') }); else setRange({ preset: 'custom', from: d.k, to: d.k }) }
  const filtersBar = (
    <div className="filters">
      <MultiSelect label="לקוח" options={clientOpts} value={f.clientIds} onChange={(v) => setF({ ...f, clientIds: v })} />
      <MultiSelect label="קבוצה" options={groupOpts} value={f.groupIds} onChange={(v) => setF({ ...f, groupIds: v })} searchable={false} />
      <MultiSelect label="סוג" options={typeOpts} value={f.types} onChange={(v) => setF({ ...f, types: v })} searchable={false} />
      <MultiSelect label="סטטוס" options={[{ id: 'paid', label: 'שולם' }, { id: 'unpaid', label: 'לא שולם' }]} value={f.status} onChange={(v) => setF({ ...f, status: v })} searchable={false} />
      {hasFilter ? <button className="btn sm ghost" onClick={() => setF({ clientIds: [], groupIds: [], types: [], status: [] })}><X size={14} />נקה הכל</button> : null}
    </div>)

  const stripCard = (
    <div className="card">
      <div className="card-title">מי חייב, מי בזכות <button className="btn sm ghost" onClick={() => go('clients')}>כל הלקוחות</button></div>
      <BalanceStrip balances={balances} clients={clients || []} aging={aging} onPick={(c) => toggleClient(c.id)} onOpen={(c) => go('client', c.id)} selected={clientSet} filterIds={clientSet ? null : groupMembers} />
    </div>)
  const churnCard = (
    <div className="card">
      <div className="card-title"><span className="row"><UserX size={17} className="gold" />לא הגיעו לאחרונה</span><span className="muted xs">3+ שבועות בלי אימון</span></div>
      {churn.length ? <div className="list">{churn.map((c) => <div key={c.id} className="item click" onClick={() => toggleClient(c.id)} style={{ minHeight: 44, padding: '8px 4px', background: clientSet?.has(c.id) ? '#F4C15D14' : undefined, borderRadius: 8 }} title="לחץ לסינון"><button className="open-btn" onClick={(e) => { e.stopPropagation(); go('client', c.id) }} title="פתח דף לקוח"><ArrowUpLeft size={13} /></button><div className="grow title">{c.name}</div><span className="muted sm">{c.days} ימים · אחרון {fmtDate(c.lastSeen)}</span></div>)}</div> : <div className="empty"><b>כולם הגיעו</b>אין לקוח פעיל שנעדר</div>}
    </div>)
  if (!sessions || !clients) return <Loading />
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between"><h1>דשבורד</h1><span className="muted sm">{HE_MONTHS[new Date().getMonth()]} {new Date().getFullYear()}</span></div>
      <div><RangePicker range={range} setRange={setRange} />{filtersBar}</div>

      {flagged > 0 && !showFlags && <div className="banner"><AlertTriangle size={18} /><span className="grow">{flagged} רשומות מהאקסל מסומנות לבדיקה (כפילויות / חסר סכום).</span><button className="btn sm" onClick={() => { setRange({ preset: 'all', from: '2000-01-01', to: '2099-12-31' }); setShowFlags(true) }}>הצג</button></div>}
      {showFlags && <div className="banner"><span className="grow">מציג רק רשומות לבדיקה. לחץ על שורה כדי לאשר או למחוק.</span><button className="btn sm" onClick={() => setShowFlags(false)}>סגור</button></div>}

      {mobile && <div className="tabs2"><button className={tab === 'view' ? 'on' : ''} onClick={() => setTab('view')}>מבט</button><button className={tab === 'analysis' ? 'on' : ''} onClick={() => setTab('analysis')}>ניתוח</button></div>}
      {showView && <>
      <div className={`kpis ${mobile ? "compact" : ""}`}>
        <div className="kpi hero g-gold"><span className="bar" style={{ background: 'var(--gold)', color: 'var(--gold)' }} /><span className="l">צפוי בטווח</span><span className="v num">{nis(k.expected)}</span>
          <span className="sub">{num(k.count)} אימונים · שולם {k.expected ? Math.round((k.paid / k.expected) * 100) : 0}%</span>
          <div className="progress"><i style={{ width: `${k.expected ? (k.paid / k.expected) * 100 : 0}%` }} /></div></div>
        <div className="kpi g-credit"><span className="bar" style={{ background: 'var(--credit)', color: 'var(--credit)' }} /><span className="l">שולם</span><span className="v num credit">{nis(k.paid)}</span></div>
        <div className="kpi g-debt"><span className="bar" style={{ background: 'var(--debt)', color: 'var(--debt)' }} /><span className="l">עוד לא שולם</span><span className="v num debt">{nis(k.open)}</span><span className="sub">{num(k.unpaidCount)} אימונים</span></div>
        {(!mobile) && <div className="kpi g-blue"><span className="l">תחזית ל{HE_MONTHS[new Date().getMonth()]}</span><span className="v num">{nis(forecast.value)}</span>
          <span className="sub">{forecast.delta !== null && <span className={forecast.delta >= 0 ? 'credit' : 'debt'}>{forecast.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(forecast.delta * 100))}% </span>}מול חודש קודם</span><span className="sub muted">ממוצע חודשי {nis(avg12)}</span></div>}
        {(!mobile) && <div className="kpi g-debt"><span className="l">{scopeLabel ? `חוב של ${scopeLabel}` : 'חובות פתוחים'} · נכון ל-{fmtDate(range.to > today() ? today() : range.to)}</span><span className="v num debt">{nis(debtTotal)}</span><span className="sub">שולם מראש: <span className="credit num">{nis(creditTotal)}</span></span></div>}
      </div>

      <div className="card">
        <div className="card-title">הכנסות בטווח <span className="muted xs">שולם / לא שולם · לחיצה על עמודה מצמצמת את הטווח</span></div>
        <div style={{ height: 260 }}>
          {chart.length ? <ResponsiveContainer><BarChart data={chart} margin={{ top: 8, right: 0, left: -10, bottom: 0 }} barCategoryGap={chart.length > 20 ? '20%' : '38%'}>
            <CartesianGrid vertical={false} stroke="#ffffff0A" /><XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} orientation="right" width={56} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
            <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="paid" name="שולם" stackId="a" fill="#4ADE9E" radius={[0, 0, 4, 4]} className="glow-credit" maxBarSize={64} onClick={pickBar} /><Bar dataKey="open" name="לא שולם" stackId="a" fill="#FF7A5C" radius={[4, 4, 0, 0]} className="glow-debt" maxBarSize={64} onClick={pickBar} />
          </BarChart></ResponsiveContainer> : <div className="empty">אין נתונים בטווח</div>}
        </div>
      </div>

      {mobile ? stripCard : <div className="grid2">{stripCard}{churnCard}</div>}
      </>}
      {showAnalysis && <>
      {mobile && <div className="kpis compact" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="kpi g-blue"><span className="l">תחזית ל{HE_MONTHS[new Date().getMonth()]}</span><span className="v num">{nis(forecast.value)}</span><span className="sub">{forecast.delta !== null && <span className={forecast.delta >= 0 ? 'credit' : 'debt'}>{forecast.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(forecast.delta * 100))}% </span>}מול חודש קודם</span></div>
        <div className="kpi g-debt"><span className="l">{scopeLabel ? `חוב של ${scopeLabel}` : 'חובות פתוחים'}</span><span className="v num debt">{nis(debtTotal)}</span><span className="sub">זכות {nis(creditTotal)}</span></div>
      </div>}
      {mobile && churnCard}
      <div className="card">
        <div className="card-title">12 חודשים אחרונים <span className="muted xs">מהסיכומים החודשיים, ללא תלות בסינון</span></div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer><BarChart data={trend} margin={{ top: 8, right: 0, left: -10, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#ffffff0A" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} orientation="right" width={56} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
            <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="charged" name="צפוי" fill="#33406A" radius={[4, 4, 0, 0]} maxBarSize={40} onClick={pickBar}>{trend.map((t, i) => <Cell key={i} fill={i === trend.length - 1 ? '#F4C15D' : '#33406A'} className={i === trend.length - 1 ? 'glow-gold' : ''} />)}</Bar>
            <Bar dataKey="paid" name="שולם" fill="#4ADE9E" radius={[4, 4, 0, 0]} className="glow-credit" maxBarSize={40} onClick={pickBar} />
          </BarChart></ResponsiveContainer>
        </div>
      </div>

      <SessionsTable sessions={filtered} context={sessions} onEdit={setEdit} title="פירוט" onClient={toggleClient} onGroup={toggleGroup} selClients={clientSet} selGroups={new Set(f.groupIds)} />
      </>}
      {edit && <SessionEditor session={edit} onClose={() => setEdit(null)} groups={groups} clients={clients} />}
    </div>
  )
}
