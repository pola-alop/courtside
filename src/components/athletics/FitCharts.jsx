import { HR_ZONES, formatDuration } from '../../lib/athletics'

// Grafici dei dati misurati dall'orologio (file .FIT). Tutti SVG con viewBox
// fisso e `width: 100%`: si adattano alla larghezza della modale senza librerie.
// Le serie arrivano sottocampionate (vedi MAX_SERIES_POINTS in fit.js): un
// campione ogni `step` secondi, `null` dove l'orologio non ha registrato.

const W = 320
const PAD = { l: 30, r: 6, t: 8, b: 18 }

// ── Curva della frequenza cardiaca, con le zone ───────────
// Le fasce di colore sono le 7 zone dell'orologio, ai confini veri della
// persona (`bounds`, i bpm superiori delle zone 0…5): la curva dice a colpo
// d'occhio in quale zona si è passati e quando.
export function HrCurve({ hr, step, bounds }) {
  const vals = hr.filter(v => typeof v === 'number')
  if (vals.length < 2) return null

  const H = 140
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const yMin = Math.max(30, Math.floor((lo - 5) / 10) * 10)
  const yMax = Math.ceil((hi + 3) / 10) * 10
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const x = i => PAD.l + (i / (hr.length - 1)) * innerW
  const y = v => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * innerH

  const edges = Array.isArray(bounds) && bounds.length === 6 ? bounds : null
  const bands = edges ? HR_ZONES.map((z, i) => {
    const from = i === 0 ? -Infinity : edges[i - 1]
    const to = i === HR_ZONES.length - 1 ? Infinity : edges[i]
    const a = Math.max(from, yMin), b = Math.min(to, yMax)
    return b > a ? { z, top: y(b), height: y(a) - y(b) } : null
  }).filter(Boolean) : []

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Frequenza cardiaca durante la sessione">
      {bands.map(b => (
        <rect key={b.z.id} x={PAD.l} y={b.top} width={innerW} height={b.height} fill={b.z.color} opacity="0.22" />
      ))}
      {edges && edges.filter(e => e > yMin && e < yMax).map(e => (
        <g key={e}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(e)} y2={y(e)} stroke="var(--color-slate)" strokeWidth="0.4" strokeDasharray="2 3" />
          <text x={PAD.l - 4} y={y(e) + 3} textAnchor="end" fontSize="8" fill="var(--color-slate)">{e}</text>
        </g>
      ))}
      <path d={linePath(hr, x, y)} fill="none" stroke="var(--color-white)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <TimeAxis count={hr.length} step={step} x={x} y={H - 5} />
    </svg>
  )
}

// ── Serie generica (passo, altitudine, potenza) ───────────
// `invert`: più basso = più in alto nel grafico (il passo: un numero minore è
// più veloce). `fmt` formatta gli estremi mostrati sul lato sinistro.
export function LineSeries({ values, step, color, fmt, invert = false, height = 80 }) {
  const vals = values.filter(v => typeof v === 'number')
  if (vals.length < 2) return null

  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = hi - lo || 1
  const innerW = W - PAD.l - PAD.r
  const innerH = height - PAD.t - PAD.b
  const x = i => PAD.l + (i / (values.length - 1)) * innerW
  const y = v => {
    const t = (v - lo) / span
    return PAD.t + (invert ? t : 1 - t) * innerH
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} role="img">
      <text x={PAD.l - 4} y={PAD.t + 6} textAnchor="end" fontSize="8" fill="var(--color-slate)">{fmt(invert ? lo : hi)}</text>
      <text x={PAD.l - 4} y={height - PAD.b} textAnchor="end" fontSize="8" fill="var(--color-slate)">{fmt(invert ? hi : lo)}</text>
      <line x1={PAD.l} x2={W - PAD.r} y1={height - PAD.b} y2={height - PAD.b} stroke="var(--color-surface-2)" strokeWidth="0.6" />
      <path d={linePath(values, x, y)} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
      <TimeAxis count={values.length} step={step} x={x} y={height - 5} />
    </svg>
  )
}

// ── Traccia del percorso ───────────────────────────────────
// Solo la linea, senza mappa né tile (nessuna libreria, nessuna richiesta di
// rete). Le coordinate sono in gradi × 1e5; la longitudine si accorcia con il
// coseno della latitudine, altrimenti il percorso apparirebbe schiacciato.
export function RouteTrace({ route }) {
  const n = route?.lat?.length || 0
  if (n < 2) return null

  const size = 200
  const pad = 14
  const midLat = (Math.min(...route.lat) + Math.max(...route.lat)) / 2 / 1e5
  const k = Math.cos((midLat * Math.PI) / 180)
  const xs = route.lon.map(v => (v / 1e5) * k)
  const ys = route.lat.map(v => -v / 1e5)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = (size - pad * 2) / (Math.max(maxX - minX, maxY - minY) || 1)
  const ox = (size - (maxX - minX) * scale) / 2
  const oy = (size - (maxY - minY) * scale) / 2
  const px = i => ox + (xs[i] - minX) * scale
  const py = i => oy + (ys[i] - minY) * scale
  const points = xs.map((_, i) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }}
         role="img" aria-label="Traccia del percorso">
      <polyline points={points} fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(0)} cy={py(0)} r="4" fill="var(--color-win)" />
      <circle cx={px(n - 1)} cy={py(n - 1)} r="4" fill="var(--color-loss)" />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────

function TimeAxis({ count, step, x, y }) {
  const total = (count - 1) * step
  return (
    <>
      <text x={PAD.l} y={y} fontSize="8" fill="var(--color-slate)">0</text>
      <text x={x((count - 1) / 2)} y={y} textAnchor="middle" fontSize="8" fill="var(--color-slate)">{formatDuration(total / 2)}</text>
      <text x={W - PAD.r} y={y} textAnchor="end" fontSize="8" fill="var(--color-slate)">{formatDuration(total)}</text>
    </>
  )
}

// Il percorso della linea: un buco (null) interrompe il tratto invece di
// unire due punti lontani nel tempo con una retta inventata.
function linePath(values, x, y) {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (typeof v !== 'number') { pen = false; return }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}
