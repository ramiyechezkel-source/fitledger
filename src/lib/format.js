export const nis = (n, opts = {}) => {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toLocaleString('he-IL')
  const sign = v < 0 ? '−' : opts.plus && v > 0 ? '+' : ''
  return `${sign}${s} ₪`
}
export const num = (n) => (Math.round(Number(n) || 0)).toLocaleString('he-IL')
export const TYPES = { personal: 'אישי', pair: 'זוגי', group: 'קבוצה', other: 'אחר' }
export const TYPE_LIST = Object.entries(TYPES).map(([id, label]) => ({ id, label }))
