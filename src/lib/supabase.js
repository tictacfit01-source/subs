import { createClient } from '@supabase/supabase-js'

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

// ---- CRUD ----
export async function fetchSubs() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(rowToSub)
}

export async function insertSub(sub, userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(subToRow(sub, userId))
    .select()
    .single()
  if (error) throw error
  return rowToSub(data)
}

export async function updateSub(id, sub, userId) {
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
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)
  if (error) throw error
}
