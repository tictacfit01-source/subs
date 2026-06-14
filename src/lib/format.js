// Pure helpers + constants, ported from the Claude Design prototype.

export const FX = { USD: 0.92, EUR: 1 }

export const CATS = {
  streaming: { label: 'Streaming', color: '#fb5b6b' },
  music: { label: 'Música', color: '#34d399' },
  ai: { label: 'Software / IA', color: '#818cf8' },
  health: { label: 'Gimnasio / Salud', color: '#fb923c' },
  hosting: { label: 'Hosting / Dominios', color: '#22d3ee' },
  cloud: { label: 'Nube', color: '#60a5fa' },
  games: { label: 'Juegos', color: '#c084fc' },
  internet: { label: 'Internet / Móvil', color: '#14b8a6' },
  utilities: { label: 'Luz / Suministros', color: '#eab308' },
  rent: { label: 'Alquiler', color: '#f472b6' },
  insurance: { label: 'Seguros', color: '#84cc16' },
  other: { label: 'Otros', color: '#94a3b8' },
}

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const eur = (amount, cur) => amount * (FX[cur] || 1)

export function monthly(s) {
  const e = eur(s.amount, s.cur)
  if (s.cycle === 'yearly') return e / 12
  if (s.cycle === 'quarterly') return e / 3
  if (s.cycle === 'weekly') return (e * 52) / 12
  return e
}

export const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
export const fmt0 = (n) => Math.round(n).toLocaleString('es-ES') + ' €'
export const money = (amount, cur) =>
  amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (cur === 'USD' ? ' $' : ' €')

// --- dates ---
export function todayNoon() {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}
export function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(n) {
  const d = todayNoon()
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
export function days(dateStr) {
  if (!dateStr) return 9999
  const d = new Date(dateStr + 'T12:00:00')
  return Math.round((d - todayNoon()) / 86400000)
}
export function when(n) {
  if (n < 0) return 'vencido'
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n < 31) return 'en ' + n + ' días'
  const m = Math.round(n / 30)
  return 'en ' + m + (m === 1 ? ' mes' : ' meses')
}
export function fdate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDate() + ' ' + MONTHS[d.getMonth()].toLowerCase()
}

export const cycleShort = (c) => ({ monthly: 'mes', yearly: 'año', quarterly: 'trim', weekly: 'sem' })[c] || 'mes'
export const cycleWord = (c) => ({ monthly: 'mensual', yearly: 'anual', quarterly: 'trimestral', weekly: 'semanal' })[c] || 'mensual'

// Inline-style object for the brand monogram badge.
export function monoStyle(brand, size) {
  const s = size || 42
  return {
    width: s,
    height: s,
    borderRadius: Math.round(s * 0.3),
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: Math.round(s * 0.42),
    color: '#fff',
    background: brand,
    boxShadow: `0 3px 10px ${brand}44`,
  }
}
