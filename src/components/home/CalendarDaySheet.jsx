import MatchRow from '../matches/MatchRow'
import TrainingRow from '../trainings/TrainingRow'
import RunRow from '../runs/RunRow'
import GymRow from '../gym/GymRow'

// Il foglio di un giorno con più sessioni: le stesse righe delle liste di
// Matches (come "Ultima sessione"), nell'ordine del calendario — partita prima,
// poi per orario. Il tap porta al dettaglio della sessione.
export default function CalendarDaySheet({ day, runWorkouts, gymWorkouts, index, running, onOpen, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6"
      style={{ background: 'rgba(2,13,25,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl p-5 space-y-3 overflow-y-auto"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '85vh' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold first-letter:uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
              {dayTitle(day.time)}
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              {day.sessions.length} sessioni
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {day.sessions.map(s => {
            const open = () => onOpen(s)
            if (s.kind === 'match') return <MatchRow key={s.id} match={s.item} onClick={open} />
            if (s.kind === 'run') return <RunRow key={s.id} run={s.item} workouts={runWorkouts} running={running} onClick={open} />
            if (s.kind === 'gym') return <GymRow key={s.id} session={s.item} workouts={gymWorkouts} index={index} onClick={open} />
            return <TrainingRow key={s.id} training={s.item} onClick={open} />
          })}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function dayTitle(time) {
  return new Date(time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}
