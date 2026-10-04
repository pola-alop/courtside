import { useState } from 'react'
import { WEEKDAY_INITIALS } from '../../lib/calendar'
import CalendarDay from './CalendarDay'
import CalendarDaySheet from './CalendarDaySheet'

// Il calendario della Home: il mese corrente, una riga per settimana (lunedì →
// domenica), e a destra la fiammella delle settimane di fila con almeno
// un'attività di qualsiasi dominio. Tutto quello che disegna viene da
// `buildCalendar` (src/lib/calendar.js): qui non si ricava niente.
//
// La fiammella è l'ottava colonna della stessa griglia, così la barra resta
// allineata alle righe senza misurarle: scende fino alla settimana corrente (e
// riparte dall'alto a ogni mese) ed è accesa solo sulle righe che fanno parte
// della serie. La fiamma è piena se la settimana in corso ha già un'attività,
// attenuata se la serie viene dalla settimana scorsa e aspetta ancora questa,
// spenta a zero.
//
// Il tap su un giorno con una sessione va dritto al dettaglio; con più sessioni
// apre il foglio con l'elenco. La navigazione la decide la pagina (`onOpen`).
const FLAME_COL = 22

export default function Calendar({ calendar, runWorkouts, gymWorkouts, index, running, onOpen }) {
  const [openKey, setOpenKey] = useState(null)
  const { weeks, streak } = calendar

  const openDay = openKey
    ? weeks.flatMap(w => w.days).find(d => d.key === openKey) || null
    : null

  const tapDay = (day) => {
    if (day.sessions.length === 1) onOpen(day.sessions[0])
    else setOpenKey(day.key)
  }

  const columns = `repeat(7, minmax(0, 1fr)) ${FLAME_COL}px`

  return (
    <div className="rounded-2xl p-3"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-sm font-semibold mb-2 px-1"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {calendar.title}
      </p>

      <div className="mb-1 px-1" style={{ display: 'grid', gridTemplateColumns: columns, columnGap: 3 }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={i} className="text-[10px] text-center font-semibold"
                style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
            {d}
          </span>
        ))}
        <span />
      </div>

      {weeks.map((week, i) => (
        <div key={week.index}
             className="rounded-xl"
             style={{
               display: 'grid', gridTemplateColumns: columns, columnGap: 3, padding: '3px 4px',
               background: week.isCurrent ? 'var(--color-week-bg)' : 'transparent',
             }}>
          {week.days.map(day => (
            <CalendarDay key={day.key} day={day} onClick={() => tapDay(day)} />
          ))}
          <FlameCell row={i} streak={streak} />
        </div>
      ))}

      {openDay && (
        <CalendarDaySheet
          day={openDay}
          runWorkouts={runWorkouts}
          gymWorkouts={gymWorkouts}
          index={index}
          running={running}
          onOpen={onOpen}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

// Una cella della colonna della fiammella. Il segmento sborda di 3px sopra e
// sotto per coprire il padding delle righe, così la barra è continua.
function FlameCell({ row, streak }) {
  if (row > streak.row) return <span />

  if (row < streak.row) {
    return (
      <span className="relative flex justify-center">
        <span className="absolute"
              style={{
                top: row === 0 ? 0 : -3, bottom: -3, width: 4,
                borderRadius: row === 0 ? '2px 2px 0 0' : 0,
                background: barColor(isLit(row, streak)),
              }} />
      </span>
    )
  }

  const tone = flameTone(streak)
  return (
    <span className="relative flex flex-col items-center justify-center" title={flameTitle(streak)}>
      {row > 0 && (
        <span className="absolute"
              style={{ top: -3, height: 'calc(50% - 7px)', width: 4, background: barColor(isLit(row - 1, streak) && isLit(row, streak)) }} />
      )}
      <span className="text-[13px] leading-none" style={{ opacity: tone.opacity, filter: tone.filter }}>🔥</span>
      <span className="text-[10px] font-bold leading-none mt-0.5"
            style={{ color: tone.color, fontFamily: 'var(--font-mono)' }}>
        {streak.weeks}
      </span>
    </span>
  )
}

// ── Helpers ────────────────────────────────────────────────

function isLit(row, streak) {
  return streak.fromRow != null && row >= streak.fromRow && row <= streak.toRow
}

function barColor(lit) {
  return lit ? 'var(--color-flame)' : 'var(--color-surface-2)'
}

function flameTone(streak) {
  if (!streak.weeks) return { opacity: 0.35, filter: 'grayscale(1)', color: 'var(--color-slate)' }
  if (!streak.activeThisWeek) return { opacity: 0.5, filter: 'none', color: 'var(--color-white)' }
  return { opacity: 1, filter: 'none', color: 'var(--color-flame)' }
}

function flameTitle(streak) {
  if (!streak.weeks) return 'Nessuna serie in corso: registra un\'attività per accenderla.'
  const n = streak.weeks === 1 ? '1 settimana di fila' : `${streak.weeks} settimane di fila`
  return streak.activeThisWeek
    ? `${n} con almeno un'attività.`
    : `${n} con almeno un'attività: registrane una questa settimana per allungarla.`
}
