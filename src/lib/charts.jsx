// SVG charts ported from the Claude Design prototype (donut, sparkline, bars).

const ACCENT = '#6f74f5'

export function Donut({ cats, size = 132, stroke = 18 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  let off = 0
  const segs = cats
    .filter((x) => x.pct > 0)
    .map((cat, i) => {
      const len = (c * cat.pct) / 100
      const el = (
        <circle
          key={cat.key || i}
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={cat.color}
          strokeWidth={stroke}
          strokeDasharray={`${len} ${c - len}`}
          strokeDashoffset={-off}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      )
      off += len
      return el
    })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs}
    </svg>
  )
}

export function Spark({ series, w = 300, h = 56, fill = true, id = 'sg' }) {
  if (!series || series.length < 2) return null
  const max = Math.max(...series) * 1.08
  const min = Math.min(...series) * 0.94
  const span = max - min || 1
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - ((v - min) / span) * h])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = line + ` L${w} ${h} L0 ${h} Z`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.32} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.4} fill={ACCENT} stroke="#fff" strokeWidth={1.4} />
    </svg>
  )
}

export function Bars({ values, w = 280, h = 70, color = ACCENT }) {
  if (!values || !values.length) return null
  const max = Math.max(...values) * 1.12 || 1
  const n = values.length
  const gap = 7
  const bw = (w - gap * (n - 1)) / n
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {values.map((v, i) => {
        const bh = Math.max(3, (v / max) * h)
        return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={4} fill={i === n - 1 ? color : color + '66'} />
      })}
    </svg>
  )
}
