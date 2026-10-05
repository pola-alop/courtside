import { heatColor } from '../../lib/gym'
import { SILHOUETTE, HEAD, FRONT, BACK, FRONT_DETAILS, BACK_DETAILS } from './bodyPaths'

// Manichino umano frontale e dorsale che mostra quanto è stato allenato ogni
// muscolo. Componente PURO e di sola presentazione: riceve `heat`, una mappa
// { muscoloId: 0..1 }, e la traduce in colore. Chi lo usa decide cosa
// significa quel numero (una sessione, un periodo) e con che scala l'ha
// normalizzato — la scala del colore invece è una sola, ed è quella della
// legenda: sfondo = non toccato, poi giallo (poco) → arancio → rosso (tanto).
//
// Tocco su un muscolo → `onSelect(id)` (o null se si tocca quello già scelto).
// Il muscolo scelto ha il contorno chiaro.
//
// Si disegna solo la metà sinistra di ogni figura (`bodyPaths.js`) e la destra
// si ottiene specchiandola, quindi i due lati sono sempre identici e un tocco
// su uno dei due seleziona il muscolo intero.

const FIGURE_W = 200
const GAP = 20
const VIEW_W = FIGURE_W * 2 + GAP
const VIEW_H = 446

export default function BodyMap({ heat = {}, selected = null, onSelect }) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Manichino dei muscoli allenati"
         className="w-full h-auto block" style={{ maxHeight: 420 }}>
      <Figure x={0} muscles={FRONT} details={FRONT_DETAILS} label="Fronte"
              heat={heat} selected={selected} onSelect={onSelect} />
      <Figure x={FIGURE_W + GAP} muscles={BACK} details={BACK_DETAILS} label="Retro"
              heat={heat} selected={selected} onSelect={onSelect} />
    </svg>
  )
}

// ── Legenda ────────────────────────────────────────────────

// Scala dei colori: barra sfumata più lo swatch del muscolo non allenato.
export function BodyMapLegend() {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full"
              style={{ background: 'var(--color-muscle-off)', border: '1px solid var(--color-slate)' }} />
        <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>Non allenato</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>Poco</span>
        <span className="w-20 h-2 rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--color-muscle-low), var(--color-muscle-mid), var(--color-muscle-high))' }} />
        <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>Tanto</span>
      </div>
    </div>
  )
}

// ── Figura ─────────────────────────────────────────────────

function Figure({ x, muscles, details, label, heat, selected, onSelect }) {
  // Il contenuto di una metà, disegnato due volte: com'è a sinistra e
  // specchiato (x → 200 - x) a destra.
  const both = (render) => (
    <>
      <g>{render()}</g>
      <g transform={`translate(${FIGURE_W} 0) scale(-1 1)`}>{render()}</g>
    </>
  )

  return (
    <g transform={`translate(${x} 0)`}>
      {/* contorno esterno: si disegna prima il tratto, poi il riempimento */}
      {both(() => SILHOUETTE.map((d, i) => (
        <path key={i} d={d} style={{ fill: 'var(--color-bg)', stroke: 'var(--color-slate)', strokeWidth: 3, strokeLinejoin: 'round', opacity: 0.7 }} />
      )))}
      <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry}
               style={{ fill: 'var(--color-bg)', stroke: 'var(--color-slate)', strokeWidth: 3, opacity: 0.7 }} />
      {both(() => SILHOUETTE.map((d, i) => (
        <path key={i} d={d} style={{ fill: 'var(--color-bg)' }} />
      )))}

      {both(() => (
        <>
          {muscles.map(m => {
            const t = heat[m.id] || 0
            const isSelected = selected === m.id
            return (
              <path key={m.id} d={m.d}
                    onClick={onSelect ? () => onSelect(isSelected ? null : m.id) : undefined}
                    style={{
                      fill: t > 0 ? heatColor(t) : 'var(--color-muscle-off)',
                      stroke: isSelected ? 'var(--color-white)' : 'var(--color-bg)',
                      strokeWidth: isSelected ? 2 : 1.5,
                      strokeLinejoin: 'round',
                      cursor: onSelect ? 'pointer' : 'default',
                    }} />
            )
          })}
          {details.map((d, i) => (
            <path key={i} d={d} style={{ fill: 'none', stroke: 'var(--color-bg)', strokeWidth: 1.5, pointerEvents: 'none' }} />
          ))}
        </>
      ))}

      <text x={100} y={VIEW_H - 8} textAnchor="middle"
            style={{ fill: 'var(--color-slate)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
        {label}
      </text>
    </g>
  )
}
