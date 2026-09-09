import { useState } from 'react'
import { PRESETS, presetRange, fmtDate, today } from '../lib/dates'
import { Sheet, Field } from './ui'

/** בורר טווח תאריכים: צ'יפים מהירים + טווח מותאם. */
export default function RangePicker({ range, setRange }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const pick = (id) => {
    if (id === 'custom') { setFrom(range.from); setTo(range.to); setOpen(true); return }
    const [f, t] = presetRange(id)
    setRange({ preset: id, from: f, to: t })
  }
  return (
    <>
      <div className="chips">
        {PRESETS.map((p) => <button key={p.id} className={`chip ${range.preset === p.id ? 'on' : ''}`} onClick={() => pick(p.id)}>{p.label}</button>)}
      </div>
      <div className="range-line">
        <span>{range.preset === 'all' ? 'כל ההיסטוריה' : <>{fmtDate(range.from)} <span className="muted">עד</span> {fmtDate(range.to)}</>}</span>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="טווח תאריכים">
        <div className="col">
          <Field label="מתאריך"><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="עד תאריך"><input type="date" className="input" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} /></Field>
          <button className="btn primary block" onClick={() => { setRange({ preset: 'custom', from, to }); setOpen(false) }}>החל</button>
        </div>
      </Sheet>
    </>
  )
}
