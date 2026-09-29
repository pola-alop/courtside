import { useState } from 'react'
import {
  workoutTotals, stepTypeMeta, targetMeta, formatStepTime, formatKm,
} from '../../lib/running'

const AXES = [
  { id: 'time',     label: 'Tempo' },
  { id: 'distance', label: 'Distanza' },
]

// Grafico delle fasi "stile Garmin": una barra per fase, nella sequenza reale
// (ripetute srotolate).
//  · LARGHEZZA proporzionale alla durata stimata — o alla distanza, con il
//    selettore Tempo/Distanza;
//  · ALTEZZA in base alla zona (Fermo → Z5): il grafico dice anche quanto è
//    intensa ogni fase, non solo quanto dura;
//  · COLORE in base al tipo di fase (riscaldamento rosso, corsa blu,
//    defaticamento verde, camminata/recupero/riposo grigio).
// Le fasi a frequenza cardiaca hanno una durata stimata dall'utente, non
// ricavata dal passo: sono tratteggiate, per non spacciare la stima per misura.
//
// Barre in flex (non SVG): con `flex-grow` pari alla grandezza misurata le
// larghezze restano proporzionali dopo i gap, e una fase da 10 secondi in una
// scheda da un'ora resta comunque visibile grazie al `minWidth`.
export default function WorkoutChart({ items, running, compact = false, showTotals = true, showToggle = true }) {
  const [axis, setAxis] = useState('time')
  const totals = workoutTotals(items, running)
  const measure = s => (axis === 'time' ? s.sec : s.km)
  const segments = totals.segments.filter(s => measure(s) > 0)
  const height = compact ? 30 : 110

  return (
    <div>
      {showToggle && !compact && (
        <div className="flex justify-end gap-1.5 mb-2">
          {AXES.map(a => (
            <button key={a.id} onClick={() => setAxis(a.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: axis === a.id ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                color: axis === a.id ? 'var(--color-white)' : 'var(--color-slate)',
                fontFamily: 'var(--font-display)'
              }}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {segments.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl text-xs"
             style={{ height, background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
          {compact ? '—' : 'Aggiungi una fase per vedere il grafico'}
        </div>
      ) : (
        <div className="flex items-end w-full" style={{ height, gap: compact ? 1 : 2 }}>
          {segments.map((s, i) => {
            const color = stepTypeMeta(s.stepType).color
            return (
              <div key={`${s.stepId}-${i}`}
                title={`${stepTypeMeta(s.stepType).label} · ${formatStepTime(s.sec)}`}
                style={{
                  flex: `${measure(s)} 1 0`,
                  minWidth: compact ? 1 : 2,
                  height: `${targetMeta(s.target).level * 100}%`,
                  background: s.rough
                    ? `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`
                    : color,
                  boxShadow: s.rough ? `inset 0 0 0 1px ${color}` : 'none',
                  borderRadius: compact ? '2px 2px 0 0' : '4px 4px 0 0',
                }} />
            )
          })}
        </div>
      )}

      {showTotals && (
        <div className={`grid grid-cols-2 gap-4 ${compact ? 'mt-1.5' : 'mt-3'}`}>
          <Total compact={compact} label="Tempo totale"
                 value={`${totals.secEstimated ? '~' : ''}${formatStepTime(totals.sec)}`} />
          <Total compact={compact} label="St. Distanza"
                 value={`${totals.kmEstimated ? '~' : ''}${formatKm(totals.km)}`} />
        </div>
      )}

      {!compact && totals.unknown > 0 && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--color-amber)' }}>
          {totals.unknown === 1 ? '1 fase non è stimabile' : `${totals.unknown} fasi non sono stimabili`} e
          resta fuori dal grafico: completane la durata.
        </p>
      )}
      {!compact && totals.rough && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--color-slate)' }}>
          Le fasi tratteggiate finiscono a una frequenza cardiaca: la loro durata è la tua stima.
        </p>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Total({ label, value, compact }) {
  if (compact) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
        {label}: <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{value}</span>
      </p>
    )
  }
  return (
    <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <p className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate)' }}>{label}</p>
    </div>
  )
}
