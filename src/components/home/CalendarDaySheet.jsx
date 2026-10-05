import MatchRow from '../matches/MatchRow'
import TrainingRow from '../trainings/TrainingRow'
import RunRow from '../runs/RunRow'
import GymRow from '../gym/GymRow'
import { KIND_META, KIND_PRIORITY, planStatusLabel, planSubject } from '../../lib/calendar'

// Il foglio di un giorno: le sessioni con le stesse righe delle liste di
// Matches (come "Ultima sessione"), nell'ordine del calendario — partita prima,
// poi per orario — e i programmi del giorno con il loro stato. Il tap su una
// sessione porta al suo dettaglio, quello su un programma alla `PlanModal`
// (che ha "Registra" per i non ancora fatti di oggi e dei giorni passati).
//
// I programmi arrivano solo dalla settimana corrente in avanti (`buildDay`):
// quelli dei giorni passati di questa settimana compaiono qui come "Non
// svolto", i più vecchi no.
//
// In fondo, da oggi in avanti, "+ Programma"; nei giorni passati "Registra"
// con i quattro tipi, che apre il wizard già sulla data del giorno.
export default function CalendarDaySheet({ day, runWorkouts, gymWorkouts, opponents, index, running, onOpen, onPlan, onRegister, onClose }) {
  const plans = day.plans
  const names = { opponents, runWorkouts, gymWorkouts }

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
              {countsText(day.sessions.length, plans.length, day.plannable)}
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-lg"
                  style={{ color: 'var(--color-slate)', background: 'var(--color-surface-2)' }}>
            ✕
          </button>
        </div>

        {day.sessions.length > 0 && (
          <div className="space-y-2">
            {plans.length > 0 && <SheetTitle>Fatto</SheetTitle>}
            {day.sessions.map(s => {
              const open = () => onOpen(s)
              if (s.kind === 'match') return <MatchRow key={s.id} match={s.item} onClick={open} />
              if (s.kind === 'run') return <RunRow key={s.id} run={s.item} workouts={runWorkouts} running={running} onClick={open} />
              if (s.kind === 'gym') return <GymRow key={s.id} session={s.item} workouts={gymWorkouts} index={index} onClick={open} />
              return <TrainingRow key={s.id} training={s.item} onClick={open} />
            })}
          </div>
        )}

        {plans.length > 0 && (
          <div className="space-y-2">
            {day.sessions.length > 0 && <SheetTitle>In programma</SheetTitle>}
            {plans.map(p => (
              <PlanRow key={p.id} plan={p} subject={planSubject(p, names)}
                       onClick={() => onPlan({ date: day.key, plan: p })} />
            ))}
          </div>
        )}

        {day.plannable && (
          <button onClick={() => onPlan({ date: day.key })}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', border: '1px dashed var(--color-teal-dark)', fontFamily: 'var(--font-display)' }}>
            + Programma
          </button>
        )}

        {!day.plannable && (
          <div className="space-y-2">
            <SheetTitle>Registra</SheetTitle>
            <div className="grid grid-cols-2 gap-2">
              {KIND_PRIORITY.map(kind => (
                <button key={kind} onClick={() => onRegister({ kind, date: day.key })}
                  className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    background: 'var(--color-surface-2)', color: 'var(--color-white)',
                    border: `1px solid ${kind === 'match' ? 'var(--color-amber)' : 'transparent'}`,
                    fontFamily: 'var(--font-display)',
                  }}>
                  <span>{KIND_META[kind].icon}</span>
                  <span>{KIND_META[kind].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

// Riga di un programma: stessa forma delle righe delle sessioni, ma col bordo
// tratteggiato del calendario — previsto, non fatto. La partita ha l'ambra.
function PlanRow({ plan, subject, onClick }) {
  const meta = KIND_META[plan.kind]
  const done = plan.status === 'done'
  const tone = done ? { color: 'var(--color-win)', bg: 'var(--color-win-bg)' }
    : plan.status === 'missed' ? { color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' }
    : { color: 'var(--color-teal)', bg: 'var(--color-week-bg)' }
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl px-3 py-2.5 flex items-center gap-3 transition-all active:scale-[0.99]"
      style={{
        background: 'var(--color-surface-2)',
        border: `1px dashed ${plan.kind === 'match' ? 'var(--color-amber)' : 'var(--color-slate)'}`,
      }}>
      <span className="text-lg shrink-0" style={{ opacity: done ? 1 : 0.6 }}>{meta.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="text-sm font-semibold block truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {meta.label}{subject ? ` · ${subject}` : ''}
        </span>
        <span className="text-[11px] block truncate" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {[plan.time, plan.notes].filter(Boolean).join(' · ') || 'Senza orario'}
        </span>
      </span>
      <span className="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full"
            style={{
              background: tone.bg,
              color: tone.color,
              fontFamily: 'var(--font-display)',
            }}>
        {planStatusLabel(plan)}
      </span>
    </button>
  )
}

function SheetTitle({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider"
       style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  )
}

// ── Helpers ────────────────────────────────────────────────

function dayTitle(time) {
  return new Date(time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function countsText(sessions, plans, plannable) {
  const parts = []
  if (sessions) parts.push(sessions === 1 ? '1 sessione' : `${sessions} sessioni`)
  if (plans) parts.push(plans === 1 ? '1 in programma' : `${plans} in programma`)
  return parts.join(' · ') || (plannable ? 'Niente in programma' : 'Niente registrato')
}
