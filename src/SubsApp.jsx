import { useEffect, useRef, useState } from 'react'
import { supabase, fetchSubs, insertSub, updateSub, patchSub, removeSub } from './lib/supabase.js'
import {
  CATS, MONTHS, eur, monthly, fmt, fmt0, money, days, when, fdate,
  cycleShort, cycleWord, monoStyle, addDays,
} from './lib/format.js'
import { Donut } from './lib/charts.jsx'

function blankForm() {
  return {
    id: null, name: '', mono: '', brand: '#6f74f5', cat: 'streaming',
    amount: '', cur: 'EUR', cycle: 'monthly', next: addDays(17),
    method: '', status: 'active', trial: false, notes: '',
  }
}


export default function SubsApp({ session, theme, setTheme, toggleTheme }) {
  const userId = session.user.id

  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('dashboard')
  const [sortKey, setSortKey] = useState('amount')
  const [filterCat, setFilterCat] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState('add')
  const [form, setForm] = useState(blankForm())
  const [displayTotal, setDisplayTotal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const timerRef = useRef(null)

  // ---- load ----
  useEffect(() => {
    let alive = true
    fetchSubs()
      .then((data) => {
        if (!alive) return
        setSubs(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('No se pudieron cargar las suscripciones:', err)
        if (alive) {
          setLoadError(true)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [])

  // ---- count-up animation of the total ----
  const total = subs.filter((s) => s.status === 'active').reduce((a, s) => a + monthly(s), 0)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const target = total
    const from = displayTotal == null ? 0 : displayTotal
    const start = Date.now()
    const dur = 850
    timerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplayTotal(from + (target - from) * e)
      if (p >= 1) {
        clearInterval(timerRef.current)
        timerRef.current = null
        setDisplayTotal(target)
      }
    }, 28)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  // ---- form helpers ----
  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  function openAdd() {
    setSheetMode('add')
    setForm(blankForm())
    setSheetOpen(true)
  }
  function editCurrent() {
    const s = subs.find((x) => x.id === selectedId)
    if (!s) return
    setSheetMode('edit')
    setForm({
      id: s.id, name: s.name, mono: s.mono, brand: s.brand, cat: s.cat,
      amount: String(s.amount).replace('.', ','), cur: s.cur, cycle: s.cycle,
      next: s.next, method: s.method, status: s.status, trial: s.status === 'trial',
      notes: s.notes || '',
    })
    setSheetOpen(true)
  }

  async function saveForm() {
    const f = form
    const amt = parseFloat(String(f.amount).replace(',', '.')) || 0
    const status = f.trial ? 'trial' : f.status === 'trial' ? 'active' : f.status
    const mono = f.mono || (f.name.trim()[0] || '?').toUpperCase()
    const sub = {
      name: f.name.trim() || 'Sin nombre', mono, brand: f.brand, cat: f.cat,
      amount: amt, cur: f.cur, cycle: f.cycle, next: f.next, method: f.method,
      status, trialEnd: f.trial ? f.next : undefined, notes: f.notes,
    }
    setBusy(true)
    try {
      if (f.id) {
        const updated = await updateSub(f.id, sub, userId)
        setSubs((prev) => prev.map((s) => (s.id === f.id ? updated : s)))
      } else {
        const created = await insertSub(sub, userId)
        setSubs((prev) => [...prev, created])
      }
      setSheetOpen(false)
    } catch (e) {
      console.error(e)
      alert('No se pudo guardar: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteForm() {
    if (!form.id) return
    setBusy(true)
    try {
      await removeSub(form.id)
      setSubs((prev) => prev.filter((s) => s.id !== form.id))
      setSheetOpen(false)
      setScreen('dashboard')
    } catch (e) {
      console.error(e)
      alert('No se pudo eliminar: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id, status) {
    const prev = subs.find((s) => s.id === id)
    if (!prev) return
    setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)))
    try {
      await patchSub(id, { status })
    } catch (e) {
      console.error(e)
      setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, status: prev.status } : s)))
      alert('No se pudo actualizar: ' + e.message)
    }
  }
  const togglePause = () => {
    const s = subs.find((x) => x.id === selectedId)
    if (s) setStatus(s.id, s.status === 'paused' ? 'active' : 'paused')
  }
  const toggleCancel = () => {
    const s = subs.find((x) => x.id === selectedId)
    if (s) setStatus(s.id, s.status === 'cancelled' ? 'active' : 'cancelled')
  }

  const go = (s) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }
  const openDetail = (id) => {
    setSelectedId(id)
    setScreen('detail')
    window.scrollTo(0, 0)
  }

  async function handleExport() {
    if (!subs.length) return
    setExporting(true)
    try {
      const { exportToExcel } = await import('./lib/exportExcel.js')
      await exportToExcel(subs)
    } catch (e) {
      console.error(e)
      alert('No se pudo exportar el Excel: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleChangePwd() {
    if (pwd.length < 6) {
      setPwdMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setPwdBusy(true)
    setPwdMsg('')
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setPwdBusy(false)
    if (error) {
      setPwdMsg(error.message)
    } else {
      setPwdMsg('Contraseña actualizada ✓')
      setPwd('')
      setPwdOpen(false)
    }
  }

  // ================= derived data =================
  const active = subs.filter((s) => s.status === 'active')

  // category breakdown
  const map = {}
  active.forEach((s) => {
    map[s.cat] = (map[s.cat] || 0) + monthly(s)
  })
  let cats = Object.keys(map).map((k) => ({
    key: k, label: CATS[k].label, color: CATS[k].color, amount: map[k],
    pct: total ? (map[k] / total) * 100 : 0,
  }))
  cats.sort((a, b) => b.amount - a.amount)
  const maxCat = Math.max(1, ...cats.map((c) => c.amount))

  // spend grouped by payment method (free text, e.g. bank name)
  const methodMap = {}
  active.forEach((s) => {
    const k = (s.method && s.method.trim()) || 'Sin asignar'
    methodMap[k] = (methodMap[k] || 0) + monthly(s)
  })
  const methodBreakdown = Object.keys(methodMap)
    .map((k) => ({ method: k, amount: methodMap[k] }))
    .sort((a, b) => b.amount - a.amount)
  const maxMethod = Math.max(1, ...methodBreakdown.map((m) => m.amount))

  // upcoming (active or trial, within ~40 days)
  const upcoming = subs
    .filter((s) => s.status === 'active' || s.status === 'trial')
    .map((s) => ({ s, d: days(s.next) }))
    .filter((x) => x.d <= 40)
    .sort((a, b) => a.d - b.d)

  // list (filter + sort)
  let list = subs.slice()
  if (filterCat !== 'all') list = list.filter((s) => s.cat === filterCat)
  const order = { active: 0, trial: 1, paused: 2, cancelled: 3 }
  if (sortKey === 'amount') list.sort((a, b) => monthly(b) - monthly(a))
  else if (sortKey === 'date') list.sort((a, b) => days(a.next) - days(b.next))
  else list.sort((a, b) => a.name.localeCompare(b.name))
  list.sort((a, b) => order[a.status] - order[b.status])

  const usedCats = Array.from(new Set(subs.map((s) => s.cat)))
  const filterChips = [{ k: 'all', label: 'Todas' }].concat(usedCats.map((k) => ({ k, label: CATS[k].label })))
  const sortLabel = { amount: 'Importe', date: 'Fecha', name: 'Nombre' }[sortKey]

  const ranking = active.slice().sort((a, b) => monthly(b) - monthly(a)).slice(0, 5)

  const savings = active
    .filter((s) => s.cycle === 'monthly')
    .sort((a, b) => monthly(b) - monthly(a))
    .slice(0, 3)
    .map((s) => {
      const yr = eur(s.amount, s.cur) * 12
      const ann = yr * 0.83
      return { name: s.name, mono: s.mono, brand: s.brand, saveText: fmt0(yr - ann), monthlyYear: fmt0(yr), annualPrice: fmt0(ann) }
    })

  // detail
  const sel = subs.find((s) => s.id === selectedId)
  const isEmpty = !loading && subs.length === 0
  const showNav = screen !== 'detail'

  const themeIcon = theme === 'dark' ? '☀' : '☾'
  const screenTitle = { dashboard: 'Subs', stats: 'Estadísticas', calendar: 'Calendario', detail: 'Detalle', settings: 'Ajustes' }[screen] || 'Subs'

  // ---- shared small styles ----
  const dot = (color) => ({ width: 9, height: 9, borderRadius: 3, flexShrink: 0, background: color, display: 'inline-block' })

  if (loading) {
    return (
      <div className="frame" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="frame">
      {/* ===== TOP BAR ===== */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(18px)',
          background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
          borderBottom: '1px solid var(--line)', padding: '14px 18px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: 9,
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, color: '#fff', boxShadow: '0 4px 14px var(--accentSoft)',
            }}
          >
            S
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>{screenTitle}</div>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          style={{
            width: 36, height: 36, borderRadius: 11, border: '1px solid var(--line)',
            background: 'var(--panel)', color: 'var(--dim)', cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {themeIcon}
        </button>
      </div>

      {loadError && (
        <div style={{ margin: '12px 18px 0', background: 'color-mix(in srgb, var(--bad) 14%, var(--panel))', border: '1px solid color-mix(in srgb, var(--bad) 45%, transparent)', color: 'var(--bad)', fontSize: 12.5, fontWeight: 600, padding: '11px 14px', borderRadius: 12 }}>
          No se pudieron cargar tus datos. Revisa la conexión con Supabase (claves en .env) y recarga.
        </div>
      )}

      {/* ===== SCROLL AREA ===== */}
      <div style={{ flex: 1, padding: '0 0 110px' }}>
        {/* ============ EMPTY ============ */}
        {isEmpty && (screen === 'dashboard' || screen === 'stats' || screen === 'calendar') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 32px', minHeight: '60vh' }}>
            <div style={{ width: 88, height: 88, borderRadius: 26, background: 'linear-gradient(160deg, var(--panel2), var(--panel))', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)', marginBottom: 22 }}>
              <div style={{ fontSize: 38 }}>🪄</div>
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Añade tu primera suscripción</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>
              Netflix, Spotify, el gimnasio, tu dominio… Tenlo todo en un sitio y descubre cuánto se te va de verdad.
            </div>
            <button onClick={openAdd} style={{ marginTop: 24, padding: '14px 26px', borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 22px var(--accentSoft)' }}>
              + Añadir suscripción
            </button>
          </div>
        )}

        {/* ============ DASHBOARD ============ */}
        {screen === 'dashboard' && !isEmpty && (
          <>
            <div style={{ padding: '18px 18px 0' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 600 }}>
                  {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
                </div>
              </div>

              {/* the scary number card */}
              <div style={{ background: 'linear-gradient(165deg, var(--panel2), var(--panel))', border: '1px solid var(--line)', borderRadius: 22, padding: 22, boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 120% at 90% -20%, var(--accentSoft), transparent 60%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Gasto mensual</div>
                  <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
                    {fmt(displayTotal == null ? total : displayTotal)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>
                      {fmt0(total * 12)} <span style={{ color: 'var(--faint)' }}>/ año</span>
                    </div>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--faint)' }} />
                    <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{active.length} activas</div>
                  </div>
                </div>
              </div>

              {/* upcoming renewals header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 12px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Próximas renovaciones</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>30 días</div>
              </div>
            </div>

            {/* upcoming cards */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 18px 6px', scrollSnapType: 'x mandatory' }}>
              {upcoming.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--faint)', padding: '4px 0' }}>Nada en los próximos 30 días 🎉</div>
              )}
              {upcoming.map(({ s, d }) => {
                const trial = s.status === 'trial'
                const soon = d <= 3
                return (
                  <div
                    key={s.id}
                    onClick={() => openDetail(s.id)}
                    style={{
                      flexShrink: 0, width: 158, scrollSnapAlign: 'start',
                      background: trial ? 'linear-gradient(165deg, color-mix(in srgb, var(--warn) 16%, var(--panel)), var(--panel))' : 'var(--panel)',
                      border: `1px solid ${trial ? 'color-mix(in srgb, var(--warn) 45%, transparent)' : 'var(--line)'}`,
                      borderRadius: 18, padding: 15, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={monoStyle(s.brand, 34)}>{s.mono}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 7, whiteSpace: 'nowrap', background: soon || trial ? 'color-mix(in srgb, var(--warn) 22%, transparent)' : 'var(--panel2)', color: soon || trial ? 'var(--warn)' : 'var(--dim)' }}>
                        {trial ? '1er cobro ' + when(d) : when(d)}
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{fdate(s.next) + (trial ? ' · prueba' : '')}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>{money(s.amount, s.cur)}</div>
                  </div>
                )
              })}
            </div>

            {/* donut snapshot */}
            <div style={{ padding: '0 18px' }}>
              <div style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>En qué se va</div>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ position: 'relative', flexShrink: 0, width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Donut cats={cats} size={132} stroke={18} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase' }}>Total/mes</div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt0(total)}</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
                  {cats.map((c) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={dot(c.color)} />
                      <div style={{ fontSize: 12.5, color: 'var(--tx)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round(c.pct)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* all subs list */}
            <div style={{ padding: '0 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 12px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Todas <span style={{ color: 'var(--faint)', fontWeight: 600 }}>· {list.length}</span>
                </div>
                <button
                  onClick={() => setSortKey((k) => (k === 'amount' ? 'date' : k === 'date' ? 'name' : 'amount'))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 11px', fontSize: 12, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer' }}
                >
                  ↕ {sortLabel}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12 }}>
                {filterChips.map((f) => (
                  <button
                    key={f.k}
                    onClick={() => setFilterCat(f.k)}
                    style={{
                      flexShrink: 0, padding: '7px 13px', borderRadius: 10,
                      border: `1px solid ${filterCat === f.k ? 'transparent' : 'var(--line)'}`,
                      cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                      background: filterCat === f.k ? 'var(--accent)' : 'var(--panel)',
                      color: filterCat === f.k ? '#fff' : 'var(--dim)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {list.map((s) => {
                  const inactive = s.status === 'paused' || s.status === 'cancelled'
                  const badge = s.status === 'trial' ? 'Prueba' : s.status === 'paused' ? 'En pausa' : s.status === 'cancelled' ? 'Cancelada' : ''
                  const badgeColor = s.status === 'trial' ? 'var(--warn)' : 'var(--faint)'
                  return (
                    <div
                      key={s.id}
                      onClick={() => openDetail(s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: '13px 15px', cursor: 'pointer', opacity: inactive ? 0.55 : 1 }}
                    >
                      <div style={monoStyle(s.brand, 42)}>{s.mono}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                          {badge && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: `color-mix(in srgb, ${badgeColor} 18%, transparent)`, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.02em', flexShrink: 0 }}>{badge}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{CATS[s.cat].label + ' · ' + fdate(s.next)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{money(s.amount, s.cur)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>/ {cycleShort(s.cycle)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ============ STATS ============ */}
        {screen === 'stats' && !isEmpty && (
          <div style={{ padding: 18 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 20, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 600 }}>Gasto mensual total</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</div>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 6 }}>
                {fmt0(total * 12)} <span style={{ color: 'var(--faint)' }}>/ año</span> · {active.length} activas
              </div>
            </div>

            <div style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 700 }}>Gasto por categoría</div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cats.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={dot(c.color)} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.amount)}</div>
                    </div>
                    <div style={{ height: 8, borderRadius: 5, background: 'var(--panel2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${((c.amount / maxCat) * 100).toFixed(1)}%`, background: c.color, borderRadius: 5 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {methodBreakdown.length > 0 && (
              <>
                <div style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 700 }}>Por método de pago</div>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {methodBreakdown.map((mb) => (
                      <div key={mb.method}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{mb.method}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(mb.amount)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 5, background: 'var(--panel2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${((mb.amount / maxMethod) * 100).toFixed(1)}%`, background: 'var(--accent)', borderRadius: 5 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 700 }}>Las más caras</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {ranking.map((s, i) => (
                <div key={s.id} onClick={() => openDetail(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 15, padding: '13px 15px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--faint)', width: 18, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                  <div style={monoStyle(s.brand, 34)}>{s.mono}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(monthly(s))}
                    <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>/mes</span>
                  </div>
                </div>
              ))}
            </div>

            {savings.length > 0 && (
              <>
                <div style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 700 }}>
                  Mensual vs anual <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>· dónde ahorrar</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {savings.map((v, i) => (
                    <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 15, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={monoStyle(v.brand, 30)}>{v.mono}</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{v.name}</div>
                        </div>
                        <div style={{ background: 'var(--accentSoft)', color: 'var(--accent2)', fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8 }}>−{v.saveText}/año</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--dim)' }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.monthlyYear}/año mensual</span>
                        <span style={{ color: 'var(--faint)' }}>→</span>
                        <span style={{ color: 'var(--good)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.annualPrice}/año anual</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ UPCOMING ============ */}
        {screen === 'calendar' && !isEmpty && <CalendarView subs={subs} onOpen={openDetail} />}

        {/* ============ DETAIL ============ */}
        {screen === 'detail' && sel && (
          <Detail
            sel={sel}
            onBack={() => go('dashboard')}
            onEdit={editCurrent}
            onTogglePause={togglePause}
            onToggleCancel={toggleCancel}
          />
        )}

        {/* ============ SETTINGS ============ */}
        {screen === 'settings' && (
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>Cuenta</div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>Sesión iniciada como</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{session.user.email}</div>

              {!pwdOpen ? (
                <button onClick={() => { setPwdOpen(true); setPwdMsg('') }} style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Cambiar contraseña
                </button>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Nueva contraseña (mín. 6)" autoComplete="new-password" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14, outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={handleChangePwd} disabled={pwdBusy} style={{ flex: 1, padding: 11, borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: pwdBusy ? 0.7 : 1 }}>{pwdBusy ? 'Guardando…' : 'Guardar'}</button>
                    <button onClick={() => { setPwdOpen(false); setPwd(''); setPwdMsg('') }} style={{ padding: '11px 14px', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
              {pwdMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: pwdMsg.includes('✓') ? 'var(--good)' : 'var(--bad)', textAlign: 'center' }}>{pwdMsg}</div>}

              <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--bad)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                Cerrar sesión
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '22px 0 10px' }}>Moneda</div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Moneda principal</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>Los totales se muestran en EUR</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>EUR €</div>
              </div>
              <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Tipo de cambio USD→EUR</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>Fijo, para normalizar el total</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>0,92</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '22px 0 10px' }}>Datos</div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <button onClick={handleExport} disabled={subs.length === 0 || exporting} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'transparent', border: 'none', cursor: subs.length === 0 ? 'default' : 'pointer', opacity: subs.length === 0 ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>Descargar Excel</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{exporting ? 'Generando…' : 'Todas tus suscripciones y estadísticas (.xlsx)'}</div>
                </div>
                <span style={{ color: 'var(--accent2)', fontSize: 18 }}>⬇</span>
              </button>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 28 }}>Subs · control de suscripciones · v1</div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAV ===== */}
      {showNav && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center', justifyItems: 'center', padding: '10px 8px calc(10px + env(safe-area-inset-bottom))', background: 'color-mix(in srgb, var(--bg) 85%, transparent)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--line)' }}>
          <NavBtn icon="▦" label="Panel" on={screen === 'dashboard'} onClick={() => go('dashboard')} />
          <NavBtn icon="◔" label="Stats" on={screen === 'stats'} onClick={() => go('stats')} />
          <button onClick={openAdd} aria-label="Añadir suscripción" style={{ width: 48, height: 48, borderRadius: 15, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', cursor: 'pointer', boxShadow: '0 6px 18px var(--accentSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" style={{ display: 'block' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <NavBtn icon="◷" label="Calendario" on={screen === 'calendar'} onClick={() => go('calendar')} />
          <NavBtn icon="⚙" label="Ajustes" on={screen === 'settings'} onClick={() => go('settings')} />
        </div>
      )}

      {/* ===== ADD/EDIT SHEET ===== */}
      {sheetOpen && (
        <Sheet
          form={form}
          mode={sheetMode}
          busy={busy}
          setField={setField}
          setForm={setForm}
          onClose={() => setSheetOpen(false)}
          onSave={saveForm}
          onDelete={deleteForm}
        />
      )}
    </div>
  )
}

const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function stepDate(d, cycle, dir) {
  const nd = new Date(d)
  if (cycle === 'weekly') nd.setDate(nd.getDate() + 7 * dir)
  else if (cycle === 'yearly') nd.setFullYear(nd.getFullYear() + dir)
  else if (cycle === 'quarterly') nd.setMonth(nd.getMonth() + 3 * dir)
  else nd.setMonth(nd.getMonth() + dir)
  return nd
}

// Day-of-month numbers when this subscription charges within (y, m).
function chargeDaysInMonth(sub, y, m) {
  if (!sub.next) return []
  const monthStart = new Date(y, m, 1)
  const monthEnd = new Date(y, m, new Date(y, m + 1, 0).getDate(), 23, 59)
  let d = new Date(sub.next + 'T12:00:00')
  let g = 0
  while (d > monthEnd && g++ < 3000) d = stepDate(d, sub.cycle, -1)
  g = 0
  while (d < monthStart && g++ < 3000) d = stepDate(d, sub.cycle, 1)
  const out = []
  g = 0
  while (d <= monthEnd && g++ < 100) {
    if (d >= monthStart) out.push(d.getDate())
    d = stepDate(d, sub.cycle, 1)
  }
  return out
}

function CalendarView({ subs, onOpen }) {
  const now = new Date()
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selDay, setSelDay] = useState(null)
  const { y, m } = cur
  const active = subs.filter((s) => s.status === 'active' || s.status === 'trial')

  const byDay = {}
  active.forEach((s) => {
    chargeDaysInMonth(s, y, m).forEach((day) => {
      ;(byDay[day] = byDay[day] || []).push(s)
    })
  })

  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7 // 0 = Monday
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  const isToday = (day) => now.getFullYear() === y && now.getMonth() === m && now.getDate() === day

  const list = []
  Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((day) => byDay[day].forEach((s) => list.push({ day, s })))
  const monthTotal = list.reduce((acc, { s }) => acc + eur(s.amount, s.cur), 0)
  const shownList = selDay ? (byDay[selDay] || []).map((s) => ({ day: selDay, s })) : list

  const prev = () => { setSelDay(null); setCur(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })) }
  const next = () => { setSelDay(null); setCur(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })) }
  const navBtn = { width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--dim)', cursor: 'pointer', fontSize: 16 }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={prev} style={navBtn}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{MONTHS_FULL[m]} {y}</div>
        <button onClick={next} style={navBtn}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--faint)' }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day == null) return <div key={'e' + i} />
          const charges = byDay[day] || []
          const has = charges.length > 0
          const sel = selDay === day
          return (
            <div key={day} onClick={has ? () => setSelDay(sel ? null : day) : undefined} style={{ aspectRatio: '1', borderRadius: 10, cursor: has ? 'pointer' : 'default', border: '1px solid ' + (sel ? 'var(--accent2)' : isToday(day) ? 'var(--accent)' : 'var(--line)'), background: sel ? 'color-mix(in srgb, var(--accent) 26%, var(--panel))' : has ? 'color-mix(in srgb, var(--accent) 10%, var(--panel))' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <div style={{ fontSize: 12.5, fontWeight: isToday(day) || sel ? 800 : 600, color: sel || has ? 'var(--tx)' : isToday(day) ? 'var(--accent2)' : 'var(--dim)' }}>{day}</div>
              {has && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {charges.slice(0, 3).map((s, j) => (
                    <span key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: s.brand }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{selDay ? `Día ${selDay} de ${MONTHS_FULL[m].toLowerCase()}` : `Cobros de ${MONTHS_FULL[m].toLowerCase()}`}</div>
        {selDay ? (
          <button onClick={() => setSelDay(null)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todo el mes</button>
        ) : (
          list.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 600 }}>{fmt(monthTotal)}</div>
        )}
      </div>
      {shownList.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--faint)', textAlign: 'center', padding: '24px 0' }}>Sin cobros este mes 🎉</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shownList.map(({ day, s }, i) => (
            <div key={i} onClick={() => onOpen(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: '11px 13px', cursor: 'pointer' }}>
              <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{day}</div>
                <div style={{ fontSize: 9.5, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase' }}>{MONTHS[m]}</div>
              </div>
              <div style={monoStyle(s.brand, 34)}>{s.mono}</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.name}{s.status === 'trial' ? ' · prueba' : ''}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(s.amount, s.cur)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NavBtn({ icon, label, on, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', color: on ? 'var(--accent2)' : 'var(--faint)' }}>
      <div style={{ fontSize: 21 }}>{icon}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
    </button>
  )
}

function Detail({ sel, onBack, onEdit, onTogglePause, onToggleCancel }) {
  const d = days(sel.next)
  const trial = sel.status === 'trial'
  const cat = CATS[sel.cat]

  let banner = ''
  let bannerStyle = null
  if (trial) {
    banner = '⚡ Prueba gratuita — empieza a cobrar ' + when(d) + ' (' + fdate(sel.next) + ')'
    bannerStyle = { background: 'color-mix(in srgb, var(--warn) 16%, var(--panel))', border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)', color: 'var(--warn)', fontSize: 13, fontWeight: 600, padding: '13px 15px', borderRadius: 14, marginBottom: 14 }
  } else if (sel.status === 'paused') {
    banner = '⏸ En pausa — no cuenta para tu gasto mensual'
    bannerStyle = { background: 'var(--panel)', border: '1px solid var(--line2)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, padding: '13px 15px', borderRadius: 14, marginBottom: 14 }
  } else if (sel.status === 'cancelled') {
    banner = '✕ Cancelada — se conserva el histórico'
    bannerStyle = { background: 'var(--panel)', border: '1px solid var(--line2)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, padding: '13px 15px', borderRadius: 14, marginBottom: 14 }
  }

  const facts = [
    { k: 'Próximo cobro', v: fdate(sel.next) + ' · ' + when(d) },
    { k: 'Coste mensual', v: fmt(monthly(sel)) },
    { k: 'Ciclo', v: cycleWord(sel.cycle) },
    { k: 'Método de pago', v: sel.method || '—' },
  ]

  // deterministic little variation for the history chart
  const histVals = Array.from({ length: 6 }, (_, i) => sel.amount * (0.97 + ((i * 13) % 7) / 100))
  const histLabels = (() => {
    const out = []
    const base = sel.next ? new Date(sel.next + 'T12:00:00') : new Date()
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(base)
      dd.setMonth(dd.getMonth() - i - 1)
      out.push(MONTHS[dd.getMonth()])
    }
    return out
  })()

  return (
    <div style={{ animation: 'popIn .26s ease' }}>
      <div style={{ position: 'relative', background: `linear-gradient(165deg, ${sel.brand}, color-mix(in srgb, ${sel.brand} 55%, #000))` }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, width: 38, height: 38, borderRadius: 12, border: '1px solid var(--line2)', background: 'rgba(0,0,0,0.22)', color: '#fff', cursor: 'pointer', fontSize: 17, backdropFilter: 'blur(8px)' }}>‹</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, color: sel.brand, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>{sel.mono}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 14, color: '#fff' }}>{sel.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{cat.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, color: '#fff' }}>
            <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{money(sel.amount, sel.cur)}</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>/ {cycleShort(sel.cycle)}</span>
          </div>
          {sel.cur === 'USD' && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>≈ {fmt(monthly(sel))} /mes en EUR</div>}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {banner && <div style={bannerStyle}>{banner}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 4 }}>
          {facts.map((f) => (
            <div key={f.k} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{f.k}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4, color: 'var(--tx)' }}>{f.v}</div>
            </div>
          ))}
        </div>

        {sel.notes && (
          <>
            <div style={{ margin: '22px 0 10px', fontSize: 15, fontWeight: 700 }}>Notas</div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{sel.notes}</div>
          </>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Editar</button>
          <button onClick={onTogglePause} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--tx)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{sel.status === 'paused' ? 'Reanudar' : 'Pausar'}</button>
        </div>
        <button onClick={onToggleCancel} style={{ width: '100%', marginTop: 9, padding: 13, borderRadius: 14, border: '1px solid var(--line)', background: 'transparent', color: sel.status === 'cancelled' ? 'var(--good)' : 'var(--bad)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          {sel.status === 'cancelled' ? 'Reactivar suscripción' : 'Cancelar suscripción'}
        </button>
      </div>
    </div>
  )
}

function Sheet({ form, mode, busy, setField, setForm, onClose, onSave, onDelete }) {
  const f = form
  const input = { width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--tx)', fontSize: 15, outline: 'none' }
  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dim)' }
  const curBtn = (on) => ({ flex: 1, width: 36, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--dim)' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', animation: 'scrim .25s ease' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg2)', borderRadius: '26px 26px 0 0', borderTop: '1px solid var(--line2)', boxShadow: '0 -10px 50px rgba(0,0,0,0.5)', animation: 'sheetUp .34s cubic-bezier(.16,1,.3,1)', padding: '8px 20px 28px' }}>
        <div style={{ width: 38, height: 4, borderRadius: 3, background: 'var(--line2)', margin: '8px auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{mode === 'edit' ? 'Editar suscripción' : 'Nueva suscripción'}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--dim)', cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>

        <label style={{ ...label, marginBottom: 7 }}>Nombre</label>
        <input value={f.name} onChange={(e) => setField('name', e.target.value)} placeholder="Netflix, Spotify…" style={input} />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...label, marginBottom: 7 }}>Importe</label>
            <input value={f.amount} onChange={(e) => setField('amount', e.target.value)} inputMode="decimal" placeholder="0,00" style={{ ...input, fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div>
            <label style={{ ...label, marginBottom: 7 }}>Moneda</label>
            <div style={{ display: 'flex', gap: 4, background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 13, padding: 4 }}>
              <button onClick={() => setField('cur', 'EUR')} style={curBtn(f.cur === 'EUR')}>€</button>
              <button onClick={() => setField('cur', 'USD')} style={curBtn(f.cur === 'USD')}>$</button>
            </div>
          </div>
        </div>

        <label style={{ ...label, margin: '16px 0 8px' }}>Categoría</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {Object.keys(CATS).map((k) => {
            const on = f.cat === k
            const col = CATS[k].color
            return (
              <button
                key={k}
                onClick={() => setForm((prev) => ({ ...prev, cat: k, brand: col }))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? col : 'var(--line2)'}`, background: on ? `color-mix(in srgb, ${col} 18%, var(--panel))` : 'var(--panel)', color: on ? 'var(--tx)' : 'var(--dim)' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, background: col }} />
                {CATS[k].label}
              </button>
            )
          })}
        </div>

        <label style={{ ...label, margin: '16px 0 8px' }}>Ciclo de facturación</label>
        <div style={{ display: 'flex', gap: 4, background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 13, padding: 4 }}>
          {[['monthly', 'Mensual'], ['yearly', 'Anual'], ['quarterly', 'Trim.'], ['weekly', 'Sem.']].map(([k, l]) => (
            <button key={k} onClick={() => setField('cycle', k)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: f.cycle === k ? 'var(--accent)' : 'transparent', color: f.cycle === k ? '#fff' : 'var(--dim)' }}>{l}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...label, marginBottom: 7 }}>Próximo cobro</label>
            <input value={f.next || ''} onChange={(e) => setField('next', e.target.value)} type="date" style={{ ...input, fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...label, marginBottom: 7 }}>Método de pago</label>
            <input value={f.method} onChange={(e) => setField('method', e.target.value)} placeholder="Tarjeta ·1234" style={{ ...input, fontSize: 14 }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: 14, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 13 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>En prueba gratuita</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>Te avisa antes del primer cobro</div>
          </div>
          <button onClick={() => setField('trial', !f.trial)} style={{ width: 46, height: 27, borderRadius: 14, border: 'none', cursor: 'pointer', padding: 3, display: 'flex', background: f.trial ? 'var(--accent)' : 'var(--line2)', justifyContent: f.trial ? 'flex-end' : 'flex-start', transition: 'all .2s' }}>
            <div style={{ width: 21, height: 21, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </button>
        </div>

        <label style={{ ...label, margin: '16px 0 7px' }}>Notas <span style={{ color: 'var(--faint)' }}>(opcional)</span></label>
        <textarea value={f.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Plan, recordatorios…" style={{ ...input, minHeight: 64, fontSize: 14, resize: 'none' }} />

        <button onClick={onSave} disabled={busy} style={{ width: '100%', marginTop: 20, padding: 16, borderRadius: 15, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, boxShadow: '0 8px 22px var(--accentSoft)' }}>
          {busy ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Añadir suscripción'}
        </button>
        {mode === 'edit' && (
          <button onClick={onDelete} disabled={busy} style={{ width: '100%', marginTop: 9, padding: 13, borderRadius: 14, border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            Eliminar suscripción
          </button>
        )}
      </div>
    </div>
  )
}
