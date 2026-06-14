import * as XLSX from 'xlsx'
import { CATS, monthly, cycleWord } from './format.js'

const round2 = (n) => Math.round(n * 100) / 100
const statusLabel = (s) =>
  ({ active: 'Activa', trial: 'Prueba', paused: 'En pausa', cancelled: 'Cancelada' }[s] || s)

// Builds an .xlsx with all subscriptions + statistics and triggers the download.
export async function exportToExcel(subs) {
  const active = subs.filter((s) => s.status === 'active')
  const total = active.reduce((a, s) => a + monthly(s), 0)

  // --- Hoja: Resumen ---
  const resumen = [
    { Métrica: 'Gasto mensual total (€)', Valor: round2(total) },
    { Métrica: 'Gasto anual total (€)', Valor: round2(total * 12) },
    { Métrica: 'Suscripciones activas', Valor: active.length },
    { Métrica: 'Suscripciones totales', Valor: subs.length },
    { Métrica: 'En prueba', Valor: subs.filter((s) => s.status === 'trial').length },
    { Métrica: 'En pausa', Valor: subs.filter((s) => s.status === 'paused').length },
    { Métrica: 'Canceladas', Valor: subs.filter((s) => s.status === 'cancelled').length },
    { Métrica: 'Exportado', Valor: new Date().toLocaleString('es-ES') },
  ]

  // --- Hoja: Suscripciones (todas) ---
  const subsRows = subs.map((s) => ({
    Nombre: s.name,
    Categoría: CATS[s.cat]?.label || s.cat,
    Importe: s.amount,
    Moneda: s.cur,
    Ciclo: cycleWord(s.cycle),
    'Coste mensual (€)': round2(monthly(s)),
    'Próximo cobro': s.next || '',
    'Método de pago': s.method || '',
    Estado: statusLabel(s.status),
    Notas: s.notes || '',
  }))

  // --- Hoja: Por categoría (solo activas) ---
  const map = {}
  active.forEach((s) => {
    map[s.cat] = (map[s.cat] || 0) + monthly(s)
  })
  const catRows = Object.keys(map)
    .sort((a, b) => map[b] - map[a])
    .map((k) => ({
      Categoría: CATS[k]?.label || k,
      'Gasto mensual (€)': round2(map[k]),
      'Gasto anual (€)': round2(map[k] * 12),
      '% del total': total ? Math.round((map[k] / total) * 100) + '%' : '0%',
    }))

  // --- Hoja: Por método de pago ---
  const methodMap = {}
  active.forEach((s) => {
    const k = (s.method && s.method.trim()) || 'Sin asignar'
    methodMap[k] = (methodMap[k] || 0) + monthly(s)
  })
  const methodRows = Object.keys(methodMap)
    .sort((a, b) => methodMap[b] - methodMap[a])
    .map((k) => ({ 'Método de pago': k, 'Gasto mensual (€)': round2(methodMap[k]), 'Gasto anual (€)': round2(methodMap[k] * 12) }))

  const wb = XLSX.utils.book_new()
  const wsResumen = XLSX.utils.json_to_sheet(resumen)
  const wsSubs = XLSX.utils.json_to_sheet(subsRows.length ? subsRows : [{ Nombre: '(sin suscripciones)' }])
  const wsCat = XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ Categoría: '(sin datos)' }])
  const wsMethod = XLSX.utils.json_to_sheet(methodRows.length ? methodRows : [{ 'Método de pago': '(sin datos)' }])

  wsResumen['!cols'] = [{ wch: 26 }, { wch: 22 }]
  wsSubs['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 11 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 11 }, { wch: 30 }]
  wsCat['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }]
  wsMethod['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 16 }]

  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
  XLSX.utils.book_append_sheet(wb, wsSubs, 'Suscripciones')
  XLSX.utils.book_append_sheet(wb, wsCat, 'Por categoría')
  XLSX.utils.book_append_sheet(wb, wsMethod, 'Por método')

  XLSX.writeFile(wb, `subs-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
