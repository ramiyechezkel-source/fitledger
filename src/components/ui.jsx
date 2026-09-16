import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { Check, X } from 'lucide-react'

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [t, setT] = useState(null)
  const show = useCallback((msg, kind = 'ok') => { setT({ msg, kind, id: Date.now() }) }, [])
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 2600); return () => clearTimeout(h) }, [t])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.kind}`} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- Sheet / Modal ---------- */
export function Sheet({ open, onClose, title, children, wide, actions }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="handle" />
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <div className="row">{actions}<button className="icon-btn" onClick={onClose} aria-label="סגור"><X size={18} /></button></div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, text, danger = true, label = 'מחק' }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text2" style={{ marginTop: 0 }}>{text}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose() }}>{label}</button>
      </div>
    </Sheet>
  )
}

/* ---------- Form bits ---------- */
export const Field = ({ label, children, hint }) => (
  <div className="field"><label>{label}</label>{children}{hint && <span className="xs muted">{hint}</span>}</div>
)
export const Toggle = ({ on, onChange, label, gold }) => (
  <button type="button" className={`toggle ${on ? 'on' : ''} ${gold ? 'gold' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
    <span className="sw" /><span>{label}</span>
  </button>
)
export const CheckBox = ({ on, onChange }) => (
  <button type="button" className={`check ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-checked={on} role="checkbox">{on && <Check size={14} strokeWidth={3} />}</button>
)
export function Stepper({ value, onChange, step = 10 }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(0, (Number(value) || 0) - step))}>−</button>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} className="num" />
      <button type="button" onClick={() => onChange((Number(value) || 0) + step)}>+</button>
    </div>
  )
}
export const Seg = ({ value, onChange, options }) => (
  <div className="seg">{options.map((o) => <button key={o.id} type="button" className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
)
export const Avatar = ({ name, group }) => <div className={`avatar ${group ? 'group' : ''}`}>{(name || '?').trim().slice(0, 2)}</div>
export const Empty = ({ title, text }) => <div className="empty"><b>{title}</b>{text}</div>
export const Loading = () => <div style={{ padding: 30 }}><div className="spinner" /></div>

/* ---------- Logo mark ---------- */
export const Logo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden><rect x="26" y="70" width="14" height="32" rx="4" fill="#FF7A5C"/><rect x="48" y="52" width="14" height="50" rx="4" fill="#F4C15D"/><rect x="70" y="34" width="14" height="68" rx="4" fill="#4ADE9E"/><rect x="92" y="22" width="14" height="80" rx="4" fill="#4ADE9E"/><rect x="20" y="106" width="88" height="3" rx="1.5" fill="#8B94AD"/></svg>
)
