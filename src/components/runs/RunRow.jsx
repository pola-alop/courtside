import { intensityMeta } from '../../lib/training'
import {
  runDisplayName, runMinutes, workoutTotals, avgPaceSec, formatPace, formatKm, formatStepTime,
} from '../../lib/running'
import WorkoutChart from './WorkoutChart'

// Riga compatta della lista allenamenti per una corsa: stessa forma di
// TrainingRow (data + intensità, titolo + durata), con il grafico delle fasi
// in miniatura al posto dei chip del focus. I numeri sono quelli REALI
// dell'orologio quando ci sono, altrimenti la stima della scheda con il "~".
export default function RunRow({ run, workouts = [], running, onClick }) {
  const intensity = intensityMeta(run.intensity)
  const { minutes, estimated } = runMinutes(run, running)
  const plan = workoutTotals(run.items, running)
  const realKm = run.athletics?.distanceKm
  const pace = avgPaceSec(run.athletics)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col gap-2 transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {formatShortDate(run.date)}
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
          🏃 {runDisplayName(run, workouts)}
        </p>
        <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-draw)', fontFamily: 'var(--font-mono)' }}>
          {estimated ? '~' : ''}{formatStepTime(minutes * 60)}
        </span>
      </div>

      <WorkoutChart items={run.items} running={running} compact showTotals={false} />

      <p className="text-xs truncate" style={{ color: 'var(--color-slate)' }}>
        {typeof realKm === 'number'
          ? [formatKm(realKm, 2), pace ? `${formatPace(pace)} /km` : null].filter(Boolean).join(' · ')
          : `~${formatKm(plan.km)} pianificati`}
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
