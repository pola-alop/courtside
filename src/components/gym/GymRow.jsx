import { intensityMeta } from '../../lib/training'
import { formatDuration } from '../../lib/athletics'
import {
  gymDisplayName, gymMinutes, workoutTotals, muscleScores, heatOf, heatColor,
  muscleLabel, formatVolume, SESSION_FULL_SETS,
} from '../../lib/gym'

// Riga compatta della lista allenamenti per una sessione di palestra: stessa
// forma di TrainingRow e RunRow (data + intensità, titolo + durata), con i
// numeri della scheda e i tre muscoli più lavorati al posto del grafico. La
// durata è quella dell'orologio quando c'è, altrimenti la stima con il "~".
export default function GymRow({ session, workouts = [], index, onClick }) {
  const intensity = intensityMeta(session.intensity)
  const { minutes, estimated } = gymMinutes(session, index)
  const totals = workoutTotals(session.items, index)
  const top = Object.entries(muscleScores(session.items, index)).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col gap-2 transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatShortDate(session.date)}
        </span>
        {intensity && (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-surface-2)', color: intensity.color, fontFamily: 'var(--font-display)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: intensity.color }} />
            {intensity.label}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          🏋️ {gymDisplayName(session, workouts)}
        </p>
        <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
          {estimated ? '~' : ''}{formatDuration(Math.round(minutes * 60))}
        </span>
      </div>

      {top.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {top.map(([m, v]) => (
            <span key={m} className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: heatColor(Math.max(0.05, heatOf(v, SESSION_FULL_SETS))) }} />
              {muscleLabel(m)}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs truncate" style={{ color: 'var(--color-slate)' }}>
        {totals.exercises} {totals.exercises === 1 ? 'esercizio' : 'esercizi'} · {totals.sets} serie
        {totals.volumeKg > 0 ? ` · ${formatVolume(totals.volumeKg)}` : ''}
      </p>
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatShortDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  } catch { return dateStr }
}
