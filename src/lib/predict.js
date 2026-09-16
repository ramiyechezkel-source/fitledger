import { today, weekday, addDays } from './dates'

/** חיזוי "מי צפוי היום": לקוחות/קבוצות שהתאמנו באותו יום בשבוע לפחות פעמיים ב-6 השבועות האחרונים. */
export function predictToday(recentSessions, clients, groups, date = today()) {
  const wd = weekday(date)
  const from = addDays(date, -42)
  const byClient = {}, byGroup = {}
  for (const s of recentSessions || []) {
    if (s.date < from || s.date >= date || weekday(s.date) !== wd) continue
    if (s.groupId && s.gkey) { byGroup[s.groupId] = byGroup[s.groupId] || new Set(); byGroup[s.groupId].add(s.date); continue }
    if (s.type === 'other') continue
    byClient[s.clientId] = byClient[s.clientId] || { dates: new Set(), amount: s.amount }
    byClient[s.clientId].dates.add(s.date)
  }
  const cs = (clients || []).filter((c) => c.active !== false && !c.isGroupRow && byClient[c.id]?.dates.size >= 2)
    .map((c) => ({ ...c, hits: byClient[c.id].dates.size, price: byClient[c.id].amount || c.defaultPrice }))
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))
  const gs = (groups || []).filter((g) => g.active !== false && byGroup[g.id]?.size >= 2).map((g) => ({ ...g, hits: byGroup[g.id].size }))
  return { clients: cs, groups: gs }
}

/** דלי גיל חוב לפי ימים מהאימון הכי ישן שלא שולם. */
export function ageBucket(days) {
  if (days == null) return null
  if (days <= 30) return { id: 'a1', label: 'עד חודש' }
  if (days <= 90) return { id: 'a2', label: `${Math.round(days / 30)} חודשים` }
  return { id: 'a3', label: 'מעל 3 חודשים' }
}

export const waLink = (name, amount, count) => `https://wa.me/?text=${encodeURIComponent(`היי ${name}, תזכורת קטנה: יתרה לתשלום ${amount} ₪ עבור ${count} אימונים. תודה!`)}`
