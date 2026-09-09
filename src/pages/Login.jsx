import { useState } from 'react'
import { login } from '../lib/store'
import { Field } from '../components/ui'

const MSG = { 'auth/invalid-credential': 'אימייל או סיסמה שגויים', 'auth/user-not-found': 'המשתמש לא קיים', 'auth/wrong-password': 'סיסמה שגויה', 'auth/too-many-requests': 'יותר מדי ניסיונות, נסה שוב בעוד כמה דקות', 'auth/network-request-failed': 'אין חיבור לאינטרנט' }

export default function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(email, pw) } catch (ex) { setErr(MSG[ex.code] || 'הכניסה נכשלה') } finally { setBusy(false) }
  }
  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div className="mark" aria-hidden><i style={{ height: 18, background: 'var(--debt)' }} /><i style={{ height: 28, background: 'var(--gold)' }} /><i style={{ height: 38, background: 'var(--credit)' }} /><i style={{ height: 44, background: 'var(--credit)' }} /></div>
        <div><h1>FitLedger</h1><div className="text2">הפנקס של המאמן</div></div>
        <Field label="אימייל"><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="סיסמה"><input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        {err && <div className="debt sm">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'נכנס…' : 'כניסה'}</button>
        <div className="xs muted">נשארים מחוברים במכשיר הזה עד יציאה יזומה.</div>
      </form>
    </div>
  )
}
