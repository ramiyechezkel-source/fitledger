import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Users, UsersRound, Plus, MoreHorizontal } from 'lucide-react'
import { useAuth, useClients, useGroups, usePayments, useMonthly, useSettings, useSessions, useOpenSessions, useSessionsPaidAfter, computeBalances } from './lib/store'
import { presetRange, today } from './lib/dates'
import { ToastProvider, Loading } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddSession from './pages/AddSession'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Groups from './pages/Groups'
import More from './pages/More'

const NAV = [
  { id: 'dash', label: 'דשבורד', Icon: LayoutDashboard },
  { id: 'clients', label: 'לקוחות', Icon: Users },
  { id: 'add', fab: true },
  { id: 'groups', label: 'קבוצות', Icon: UsersRound },
  { id: 'more', label: 'עוד', Icon: MoreHorizontal },
]

function readHash() { const [p, arg] = location.hash.replace('#', '').split('/'); return { page: p || 'dash', arg: arg || null } }

export default function App() {
  const user = useAuth()
  const [route, setRoute] = useState(readHash)
  useEffect(() => { const h = () => setRoute(readHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const go = (page, arg) => { location.hash = arg ? `${page}/${arg}` : page; window.scrollTo(0, 0) }
  const [range, setRange] = useState(() => { const [from, to] = presetRange('month'); return { preset: 'month', from, to } })
  if (user === undefined) return <div className="login"><Loading /></div>
  if (!user) return <Login />
  return <ToastProvider><Shell user={user} route={route} go={go} range={range} setRange={setRange} /></ToastProvider>
}

function Shell({ user, route, go, range, setRange }) {
  const [clients] = useClients()
  const [groups] = useGroups()
  const [payments] = usePayments()
  const [monthly] = useMonthly()
  const settings = useSettings()
  const [sessions, sessErr] = useSessions(range.from, range.to)
  const [openSessions] = useOpenSessions()
  const asOf = range.to < today() ? range.to : today()
  const [paidAfter] = useSessionsPaidAfter(asOf)
  const balances = useMemo(() => computeBalances({ openSessions: openSessions || [], paidAfter: paidAfter || [], payments: payments || [], asOf }), [openSessions, paidAfter, payments, asOf])
  const data = { clients, groups, payments, monthly, settings, sessions, balances }
  const page = route.page
  const cur = page === 'client' ? 'clients' : page

  return (
    <div className="shell">
      <nav className="nav" aria-label="ניווט">
        <div className="brand hide-mobile"><div className="logo"><img src={import.meta.env.BASE_URL + 'icon.svg'} width="22" height="22" alt="" /></div>FitLedger</div>
        {NAV.map((n) => n.fab
          ? <button key={n.id} className={`fab ${cur === 'add' ? 'on' : ''}`} onClick={() => go('add')} aria-label="רישום אימון"><span className="circle"><Plus size={24} strokeWidth={2.5} /><span className="hide-mobile">רישום אימון</span></span></button>
          : <button key={n.id} className={cur === n.id ? 'on' : ''} onClick={() => go(n.id)}><n.Icon size={22} strokeWidth={cur === n.id ? 2.4 : 1.8} /><span>{n.label}</span></button>)}
      </nav>
      <div className="grow">
        <header className="topbar hide-desktop"><div className="brand"><div className="logo"><img src={import.meta.env.BASE_URL + 'icon.svg'} width="20" height="20" alt="" /></div>FitLedger</div></header>
        <main className="main">
          {sessErr && <div className="banner debt">{sessErr.code === 'resource-exhausted' ? 'המכסה היומית החינמית נגמרה. השירות חוזר בסביבות 10:00 בבוקר. מה שכבר נטען מוצג מהזיכרון.' : sessErr.code === 'permission-denied' ? 'אין הרשאה לקרוא נתונים. התחבר מחדש.' : 'שגיאה בטעינת נתונים: ' + sessErr.message}</div>}
          {page === 'dash' && <Dashboard data={data} range={range} setRange={setRange} go={go} />}
          {page === 'add' && <AddSession data={data} go={go} />}
          {page === 'clients' && <Clients data={data} go={go} />}
          {page === 'client' && <ClientDetail id={route.arg} data={data} go={go} range={range} />}
          {page === 'groups' && <Groups data={data} go={go} />}
          {page === 'more' && <More data={data} user={user} />}
        </main>
      </div>
    </div>
  )
}
