// תצוגה מקדימה ללא Firebase (לבדיקת עיצוב בלבד)
import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LayoutDashboard, Users, UsersRound, Plus, MoreHorizontal } from 'lucide-react'
import { ToastProvider } from './components/ui'
import Dashboard from './pages/Dashboard'
import AddSession from './pages/AddSession'
import Clients from './pages/Clients'
import Groups from './pages/Groups'
import Login from './pages/Login'
import { computeBalances } from './lib/store'
import { presetRange, monthKey } from './lib/dates'
import seed from '../public/history.json'
import './styles.css'

const monthly = {}
for (const s of seed.sessions) { const mk = monthKey(s.date); monthly[mk] = monthly[mk] || { id: mk, charged: 0, paid: 0, count: 0 }; monthly[mk].charged += s.amount; monthly[mk].paid += s.paid ? s.amount : 0; monthly[mk].count++ }

function Demo() {
  const page = new URLSearchParams(location.search).get('page') || 'dash'
  const [range, setRange] = useState(() => { const [from, to] = presetRange('month', '2026-09-02'); return { preset: 'month', from, to } })
  const sessions = useMemo(() => seed.sessions.filter((s) => s.date >= range.from && s.date <= range.to), [range])
  const balances = computeBalances({ openSessions: seed.sessions.filter((s) => !s.paid), payments: seed.payments, asOf: '2026-09-09' })
  const data = { clients: seed.clients, groups: seed.groups, payments: seed.payments, monthly: Object.values(monthly), settings: { defaultPrice: 200 }, sessions, balances }
  const go = () => {}
  if (page === 'login') return <Login />
  return (
    <ToastProvider><div className="shell">
      <nav className="nav"><div className="brand hide-mobile"><div className="logo" /> FitLedger</div>
        {[['dash', 'דשבורד', LayoutDashboard], ['clients', 'לקוחות', Users], ['fab'], ['groups', 'קבוצות', UsersRound], ['more', 'עוד', MoreHorizontal]].map(([id, label, Icon]) => id === 'fab'
          ? <button key={id} className={`fab ${page === 'add' ? 'on' : ''}`}><span className="circle"><Plus size={24} strokeWidth={2.5} /><span className="hide-mobile">רישום אימון</span></span></button>
          : <button key={id} className={page === id ? 'on' : ''}><Icon size={22} /><span>{label}</span></button>)}
      </nav>
      <div className="grow"><header className="topbar hide-desktop"><div className="brand"><div className="logo" />FitLedger</div></header>
        <main className="main">
          {page === 'dash' && <Dashboard data={data} range={range} setRange={setRange} go={go} />}
          {page === 'add' && <AddSession data={data} go={go} />}
          {page === 'clients' && <Clients data={data} go={go} />}
          {page === 'groups' && <Groups data={data} go={go} />}
        </main></div>
    </div></ToastProvider>)
}
createRoot(document.getElementById('root')).render(<Demo />)
