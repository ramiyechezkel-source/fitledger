import { nis } from '../lib/format'
import { fmtDate } from '../lib/dates'
import { ArrowUpLeft, MessageCircle } from 'lucide-react'
import { waLink, ageBucket } from '../lib/predict'
import { daysBetween, today } from '../lib/dates'

/** פס יתרות: חוב נמשך ימינה (קורל), זכות שמאלה (מנטה). */
export default function BalanceStrip({ balances, clients, onPick, onOpen, selected, limit = 12, filterIds, aging = {} }) {
  const byId = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  let rows = Object.entries(balances).filter(([id, v]) => Math.round(v) !== 0 && byId[id])
  if (filterIds) rows = rows.filter(([id]) => filterIds.has(id))
  rows.sort((a, b) => a[1] - b[1])
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)))
  const shown = limit ? rows.slice(0, limit) : rows
  if (!rows.length) return <div className="empty"><b>אין יתרות פתוחות</b>כולם מאוזנים</div>
  return (
    <div className="strip">
      {shown.map(([id, v]) => (
        <div className={`strip-row ${selected?.has(id) ? 'sel' : ''}`} key={id} onClick={() => onPick && onPick(byId[id])} title="לחץ לסינון">
          <span className="name">{onOpen && <button className="open-btn" onClick={(e) => { e.stopPropagation(); onOpen(byId[id]) }} title="פתח דף לקוח"><ArrowUpLeft size={13} /></button>}{byId[id].name}{v < 0 && aging[id] && (() => { const bk = ageBucket(daysBetween(aging[id].oldest, today())); return <span className="xs muted" style={{ display: 'block', lineHeight: 1.2 }}><span className={`age ${bk.id}`} style={{ padding: '0 5px', fontSize: '.66rem' }}>{bk.label}</span> {aging[id].count} אימונים</span> })()}</span>
          <div className="track"><span className={`bar ${v < 0 ? 'd' : 'c'}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} /></div>
          <span className={`amt num ${v < 0 ? 'debt' : 'credit'}`}>{nis(v, { plus: true })}{v < 0 && <a className="wa-mini" href={waLink(byId[id].name, Math.round(-v), aging[id]?.count || 0)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="תזכורת בוואטסאפ"><MessageCircle size={13} /></a>}</span>
        </div>
      ))}
      {rows.length > shown.length && <div className="xs muted" style={{ paddingTop: 4 }}>ועוד {rows.length - shown.length} לקוחות עם יתרה, ראה במסך לקוחות</div>}
      <div className="legend"><span><i style={{ background: 'var(--debt)' }} />חייבים לך</span><span><i style={{ background: 'var(--credit)' }} />שילמו מראש</span></div>
    </div>
  )
}
