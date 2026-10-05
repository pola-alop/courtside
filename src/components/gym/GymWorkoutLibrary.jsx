import { useState } from 'react'
import { sortWorkoutsByUse, workoutUsage } from '../../lib/gym'
import WorkoutSummary from './WorkoutSummary'

// Libreria delle schede di palestra, collassabile, nel tab Allenamenti con il
// filtro "Palestra" (stessa collocazione di WorkoutLibrary per la corsa): è il
// posto dove si rinomina, si ritocca o si elimina una scheda, e dove se ne
// prepara una senza doverla fare subito.
export default function GymWorkoutLibrary({ workouts, sessions, index, onSelect, onAdd }) {
  const [open, setOpen] = useState(false)
  const sorted = sortWorkoutsByUse(workouts, sessions)
  const usage = workoutUsage(sessions)

  return (
    <div className="rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          📋 Schede di palestra
        </span>
        <span className="text-xs flex items-center gap-2" style={{ color: 'var(--color-slate)' }}>
          {workouts.length}
          <span>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {sorted.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: 'var(--color-slate)' }}>
              Nessuna scheda: si crea registrando una sessione, oppure da qui.
            </p>
          )}
          {sorted.map(w => {
            const u = usage[w.id]
            return (
              <button key={w.id} onClick={() => onSelect(w.id)}
                className="w-full text-left rounded-xl p-3 transition-all active:scale-[0.98]"
                style={{ background: 'var(--color-surface-2)' }}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {w.name}
                  </span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--color-slate)' }}>
                    {u ? `${u.count} ${u.count === 1 ? 'sessione' : 'sessioni'}` : 'Mai fatta'}
                  </span>
                </div>
                <WorkoutSummary items={w.items} index={index} />
              </button>
            )
          })}
          <button onClick={onAdd}
            className="w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{ color: 'var(--color-teal)', border: '1px dashed var(--color-teal-dark)', fontFamily: 'var(--font-display)' }}>
            + Nuova scheda
          </button>
        </div>
      )}
    </div>
  )
}
