import { useState, useRef } from 'react'
import { Upload, Download, LogOut, Database, FileSpreadsheet, Settings } from 'lucide-react'
import { logout, importSeed, isDbEmpty, importRows, saveSettings, wipeAll } from '../lib/store'
import { parseImport, downloadTemplate, exportSessions } from '../lib/excel'
import { nis, num } from '../lib/format'
import { Field, Stepper, useToast, Sheet } from '../components/ui'

export default function More({ data, user }) {
  const { settings, clients, groups, sessions } = data
  const toast = useToast()
  const [prog, setProg] = useState(null)
  const [preview, setPreview] = useState(null)
  const [price, setPrice] = useState(settings?.defaultPrice ?? 200)
  const fileRef = useRef()

  const loadHistory = async () => {
    if (!(await isDbEmpty())) return toast('בסיס הנתונים כבר מכיל אימונים, הטעינה בוטלה', 'err')
    if (!confirm('לטעון את כל ההיסטוריה מהאקסל של ניר? פעולה חד-פעמית.')) return
    setProg({ done: 0, total: 1 })
    try {
      const seed = await (await fetch(import.meta.env.BASE_URL + 'history.json')).json()
      await importSeed(seed, (done, total) => setProg({ done, total }))
      toast(`נטענו ${num(seed.sessions.length)} אימונים ו-${seed.clients.length} לקוחות`)
    } catch (e) { console.error(e); toast('הטעינה נכשלה: ' + e.message, 'err') } finally { setProg(null) }
  }
  const wipeAndReload = async () => {
    const word = prompt('פעולה זו מוחקת את כל הנתונים באפליקציה (כולל מה שנרשם ידנית!) וטוענת מחדש מהאקסל.\nכדי לאשר, הקלד: מחק')
    if (word !== 'מחק') return
    setProg({ done: 0, total: 1 })
    try {
      const n = await wipeAll((done, total) => setProg({ done, total }))
      const seed = await (await fetch(import.meta.env.BASE_URL + 'history.json')).json()
      await importSeed(seed, (done, total) => setProg({ done, total }))
      toast(`נמחקו ${num(n)} רשומות ונטענו ${num(seed.sessions.length)} אימונים מחדש`)
    } catch (e) { console.error(e); toast('נכשל: ' + e.message, 'err') } finally { setProg(null) }
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try { const r = await parseImport(f); setPreview(r) } catch (ex) { toast('לא הצלחתי לקרוא את הקובץ', 'err') }
    e.target.value = ''
  }
  const doImport = async () => {
    setProg({ done: 0, total: 1 })
    try { const r = await importRows(preview.rows, clients, groups); toast(`יובאו ${r.sessions} אימונים${r.newClients ? `, נוצרו ${r.newClients} לקוחות חדשים` : ''}`); setPreview(null) }
    catch (e) { console.error(e); toast('הייבוא נכשל', 'err') } finally { setProg(null) }
  }

  return (
    <div className="col" style={{ gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <h1>עוד</h1>
      <div className="card col" style={{ gap: 10 }}>
        <div className="card-title"><span className="row"><FileSpreadsheet size={18} />אקסל</span></div>
        <div className="sm text2">ייבוא בפורמט התבנית (תאריך, לקוח, קבוצה, סוג, סכום, שולם, קבלה, הערה). לקוחות שלא קיימים ייווצרו אוטומטית.</div>
        <div className="row wrap">
          <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} />ייבוא מאקסל</button>
          <button className="btn ghost" onClick={downloadTemplate}>הורד תבנית</button>
          <button className="btn ghost" onClick={() => exportSessions(sessions || [], 'fitledger-export.xlsx')}><Download size={16} />ייצוא הטווח הנוכחי</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <div className="card-title"><span className="row"><Settings size={18} />הגדרות</span></div>
        <Field label="מחיר ברירת מחדל לאימון חדש (ללקוח בלי מחיר קבוע)"><Stepper value={price} onChange={setPrice} /></Field>
        <button className="btn sm" onClick={async () => { await saveSettings({ defaultPrice: Number(price) || 200 }); toast('נשמר') }}>שמור</button>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <div className="card-title"><span className="row"><Database size={18} />נתונים</span></div>
        {settings?.seedLoaded ? <><div className="sm text2">ההיסטוריה מהאקסל נטענה ב-{settings.seedLoadedAt?.slice(0, 10)} ({num(settings.seedLoaded.rows)} שורות מקור, גרסת קובץ {settings.seedLoaded.generated}).</div>
          <button className="btn sm danger" disabled={!!prog} onClick={wipeAndReload} style={{ alignSelf: 'flex-start' }}>{prog ? `עובד… ${Math.round((prog.done / prog.total) * 100)}%` : 'מחק הכל וטען מחדש מהאקסל'}</button>
          <div className="xs muted">לשלב ההרצה בלבד: מוחק גם אימונים שנרשמו ידנית. אחרי שניר מתחיל לעבוד, לא להשתמש.</div></>
          : <><div className="sm text2">טעינה חד-פעמית של ההיסטוריה מהאקסל של ניר (2020–2026). אפשרית רק כשבסיס הנתונים ריק.</div><button className="btn primary" disabled={!!prog} onClick={loadHistory}>{prog ? `טוען… ${Math.round((prog.done / prog.total) * 100)}%` : 'טען היסטוריה מהאקסל'}</button></>}
        <div className="xs muted">מחובר כ-{user?.email}</div>
        <button className="btn ghost" onClick={logout} style={{ alignSelf: 'flex-start' }}><LogOut size={16} />יציאה</button>
      </div>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="תצוגה מקדימה לייבוא">
        {preview && <div className="col" style={{ gap: 10 }}>
          <div>{preview.rows.length} שורות תקינות{preview.errors.length ? `, ${preview.errors.length} שורות ידולגו` : ''}</div>
          {preview.errors.slice(0, 5).map((e, i) => <div key={i} className="xs debt">{e}</div>)}
          <div className="table-wrap" style={{ maxHeight: 260 }}><table className="t" style={{ minWidth: 0 }}><thead><tr><th>תאריך</th><th>לקוח</th><th>סכום</th><th>שולם</th></tr></thead><tbody>{preview.rows.slice(0, 20).map((r, i) => <tr key={i}><td className="num">{r.date}</td><td>{r.clientName}</td><td className="num">{nis(r.amount)}</td><td>{r.paid ? 'כן' : 'לא'}</td></tr>)}</tbody></table></div>
          <button className="btn primary block" disabled={!preview.rows.length || !!prog} onClick={doImport}>{prog ? 'מייבא…' : `ייבא ${preview.rows.length} אימונים`}</button>
        </div>}
      </Sheet>
    </div>
  )
}
