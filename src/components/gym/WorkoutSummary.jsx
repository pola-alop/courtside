import { workoutTotals, resolveExercise, formatVolume } from '../../lib/gym'

// Riga riassuntiva di una scheda: quanti esercizi e serie, e i primi nomi.
export default function WorkoutSummary({ items, index }) {
  const t = workoutTotals(items, index)
  const names = (items || []).map(it => resolveExercise(it, index).name)
  return (
    <>
      <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {t.exercises} {t.exercises === 1 ? 'esercizio' : 'esercizi'} · {t.sets} serie{t.volumeKg > 0 ? ` · ${formatVolume(t.volumeKg)}` : ''}
      </p>
      {names.length > 0 && (
        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-slate)' }}>
          {names.slice(0, 3).join(' · ')}{names.length > 3 ? ` · +${names.length - 3}` : ''}
        </p>
      )}
    </>
  )
}
