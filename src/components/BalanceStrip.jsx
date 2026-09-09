import { nis } from '../lib/format'

/** פס יתרות: חוב נמשך ימינה (קורל), זכות שמאלה (מנטה). */
export default function BalanceStrip({ balances, clients, onPick, limit = 12, filterIds }) {
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
        <div className="strip-row" key={id} onClick={() => onPick && onPick(byId[id])}>
          <span className="name">{byId[id].name}</span>
          <div className="track"><span className={`bar ${v < 0 ? 'd' : 'c'}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} /></div>
          <span className={`amt num ${v < 0 ? 'debt' : 'credit'}`}>{nis(v, { plus: true })}</span>
        </div>
      ))}
      {rows.length > shown.length && <div className="xs muted" style={{ paddingTop: 4 }}>ועוד {rows.length - shown.length} לקוחות עם יתרה, ראה במסך לקוחות</div>}
      <div className="legend"><span><i style={{ background: 'var(--debt)' }} />חייבים לך</span><span><i style={{ background: 'var(--credit)' }} />שילמו מראש</span></div>
    </div>
  )
}
