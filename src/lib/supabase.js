import { createClient } from '@supabase/supabase-js'
import { addDays } from './format.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

// ---- mapping between DB rows (snake_case) and the app model (camelCase) ----
export function rowToSub(r) {
  return {
    id: r.id,
    name: r.name,
    mono: r.mono,
    brand: r.brand,
    cat: r.cat,
    amount: Number(r.amount),
    cur: r.cur,
    cycle: r.cycle,
    next: r.next_charge,
    method: r.method || '',
    status: r.status,
    trialEnd: r.trial_end || undefined,
    notes: r.notes || '',
  }
}

export function subToRow(s, userId) {
  return {
    user_id: userId,
    name: s.name,
    mono: s.mono,
    brand: s.brand,
    cat: s.cat,
    amount: s.amount,
    cur: s.cur,
    cycle: s.cycle,
    next_charge: s.next || null,
    method: s.method || null,
    status: s.status,
    trial_end: s.trialEnd || null,
    notes: s.notes || null,
  }
}

// ===== Demo mode (in-memory) — active when Supabase isn't configured yet =====
let _demo = null
function demoStore() {
  if (!_demo) _demo = demoSeed().map((s, i) => ({ ...s, id: 'demo-' + i }))
  return _demo
}

// ---- CRUD (each falls back to the in-memory store in demo mode) ----
export async function fetchSubs() {
  if (!isSupabaseConfigured) return demoStore().map((s) => ({ ...s }))
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(rowToSub)
}

export async function insertSub(sub, userId) {
  if (!isSupabaseConfigured) {
    const rec = { ...sub, id: 'demo-' + Date.now() }
    demoStore().push(rec)
    return { ...rec }
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(subToRow(sub, userId))
    .select()
    .single()
  if (error) throw error
  return rowToSub(data)
}

export async function updateSub(id, sub, userId) {
  if (!isSupabaseConfigured) {
    const store = demoStore()
    const idx = store.findIndex((s) => s.id === id)
    if (idx >= 0) store[idx] = { ...store[idx], ...sub, id }
    return { ...store[idx] }
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .update(subToRow(sub, userId))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToSub(data)
}

// Partial update (e.g. just the status when pausing/cancelling).
export async function patchSub(id, patch) {
  if (!isSupabaseConfigured) {
    const store = demoStore()
    const idx = store.findIndex((s) => s.id === id)
    if (idx >= 0) store[idx] = { ...store[idx], ...patch }
    return idx >= 0 ? { ...store[idx] } : null
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToSub(data)
}

export async function removeSub(id) {
  if (!isSupabaseConfigured) {
    _demo = demoStore().filter((s) => s.id !== id)
    return
  }
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)
  if (error) throw error
}

export async function seedDemo(userId) {
  if (!isSupabaseConfigured) {
    const add = demoSeed().map((s, i) => ({ ...s, id: 'demo-' + Date.now() + '-' + i }))
    demoStore().push(...add)
    return add.map((s) => ({ ...s }))
  }
  const rows = demoSeed().map((s) => subToRow(s, userId))
  const { data, error } = await supabase.from('subscriptions').insert(rows).select()
  if (error) throw error
  return data.map(rowToSub)
}

// 8 realistic example subscriptions, with next-charge dates relative to "today"
// so the demo always looks fresh whenever it is loaded.
export function demoSeed() {
  return [
    { name: 'Netflix', mono: 'N', brand: '#e50914', cat: 'streaming', amount: 13.99, cur: 'EUR', cycle: 'monthly', next: addDays(3), method: 'Tarjeta ·4291', status: 'active', notes: 'Plan Estándar con anuncios' },
    { name: 'Disney+', mono: 'D', brand: '#1f80e0', cat: 'streaming', amount: 9.99, cur: 'EUR', cycle: 'monthly', next: addDays(2), method: 'Tarjeta ·4291', status: 'trial', trialEnd: addDays(2), notes: 'Prueba gratuita de 7 días — empieza a cobrar pronto' },
    { name: 'Spotify', mono: 'S', brand: '#1db954', cat: 'music', amount: 10.99, cur: 'EUR', cycle: 'monthly', next: addDays(8), method: 'PayPal', status: 'active', notes: 'Premium Individual' },
    { name: 'ChatGPT Plus', mono: 'G', brand: '#10a37f', cat: 'ai', amount: 20, cur: 'USD', cycle: 'monthly', next: addDays(14), method: 'Tarjeta ·8830', status: 'active', notes: 'Facturado en dólares' },
    { name: 'iCloud+', mono: 'i', brand: '#3693f3', cat: 'cloud', amount: 2.99, cur: 'EUR', cycle: 'monthly', next: addDays(16), method: 'Tarjeta ·4291', status: 'active', notes: '200 GB' },
    { name: 'Basic-Fit', mono: 'B', brand: '#f7901e', cat: 'health', amount: 39.99, cur: 'EUR', cycle: 'monthly', next: addDays(17), method: 'Tarjeta ·4291', status: 'active', notes: 'Cuota Premium' },
    { name: 'PlayStation Plus', mono: 'P', brand: '#0070d1', cat: 'games', amount: 71.99, cur: 'EUR', cycle: 'yearly', next: addDays(151), method: 'PayPal', status: 'active', notes: 'Plan Extra anual' },
    { name: 'midominio.com', mono: '@', brand: '#06b6d4', cat: 'hosting', amount: 11.98, cur: 'EUR', cycle: 'yearly', next: addDays(263), method: 'Tarjeta ·8830', status: 'active', notes: 'Renovación de dominio .com' },
  ]
}
