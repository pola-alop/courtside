import { KIND_META } from '../../lib/calendar'

// Un giorno della griglia del mese.
//
//  · con attività: cerchio pieno con l'icona della sessione principale e il
//    numero del giorno piccolo in apice; la partita ha il bordo ambra (stesso
//    codice colore della Panoramica), le altre sessioni nel pallino "+N";
//  · da oggi in avanti, con un programma e senza attività: cerchio TRATTEGGIATO
//    con l'icona del programmato attenuata (ambra se è una partita) e "+N" se
//    i programmi sono più d'uno — il tratteggio dice "previsto", il pieno
//    "fatto";
//  · senza attività: cerchio vuoto con il numero dentro — grigio nel passato,
//    chiaro da oggi in avanti;
//  · giorni del mese prima/dopo: le attività e i programmi si vedono comunque,
//    attenuati; da vuoti resta solo il numero, senza cerchio;
//  · oggi: anello teal, che convive con il bordo ambra della partita.
//
// Si toccano i giorni con attività e quelli programmabili (da oggi in avanti):
// cosa succede al tap lo decide il calendario. I giorni passati vuoti restano
// fermi finché "Registra" non saprà aprire il wizard con la data giusta.
export default function CalendarDay({ day, onClick }) {
  const has = day.sessions.length > 0
  const other = day.otherMonth != null

  const planned = !has && day.plannable && day.plans.length > 0
  const Cell = has || day.plannable ? TapCell : StillCell

  if (!has && !planned && other) {
    return (
      <Cell day={day} onClick={onClick}>
        <span className="flex items-center justify-center" style={{ width: '100%', maxWidth: 34, aspectRatio: '1' }}>
          <span className="text-[10px]" style={{ color: 'var(--color-slate)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
            {day.dayOfMonth}
          </span>
        </span>
      </Cell>
    )
  }

  const ring = day.isToday ? '0 0 0 2px var(--color-teal)' : 'none'

  if (planned) {
    const extra = day.plans.length - 1
    return (
      <Cell day={day} onClick={onClick}>
        <span className="relative flex items-center justify-center rounded-full"
              style={{
                width: '100%', maxWidth: 34, aspectRatio: '1',
                border: `2px dashed ${day.mainPlan === 'match' ? 'var(--color-amber)' : 'var(--color-slate)'}`,
                boxShadow: ring,
                opacity: other ? 0.4 : 1,
              }}>
          <span className="text-sm leading-none" style={{ opacity: 0.55 }}>{KIND_META[day.mainPlan].icon}</span>
          <span className={`absolute text-[8px] leading-none ${day.isToday ? 'font-bold' : ''}`}
                style={{ top: -3, right: -4, color: numberColor(day), fontFamily: 'var(--font-mono)' }}>
            {day.dayOfMonth}
          </span>
          {extra > 0 && (
            <span className="absolute flex items-center justify-center rounded-full text-[8px] font-bold leading-none"
                  style={{
                    bottom: -3, right: -4, minWidth: 13, height: 13, padding: '0 2px',
                    background: 'var(--color-surface-2)', color: 'var(--color-white)',
                    border: '1px dashed var(--color-slate)', fontFamily: 'var(--font-display)',
                  }}>
              +{extra}
            </span>
          )}
        </span>
      </Cell>
    )
  }

  if (!has) {
    return (
      <Cell day={day} onClick={onClick}>
        <span className="flex items-center justify-center rounded-full"
              style={{
                width: '100%', maxWidth: 34, aspectRatio: '1',
                border: '1px solid var(--color-surface-2)', boxShadow: ring,
              }}>
          <span className={`text-[11px] ${day.isToday ? 'font-bold' : ''}`}
                style={{ color: numberColor(day), fontFamily: 'var(--font-mono)' }}>
            {day.dayOfMonth}
          </span>
        </span>
      </Cell>
    )
  }

  return (
    <Cell day={day} onClick={onClick}>
      <span className="relative flex items-center justify-center rounded-full"
            style={{
              width: '100%', maxWidth: 34, aspectRatio: '1',
              background: 'var(--color-surface-2)',
              border: `2px solid ${day.main === 'match' ? 'var(--color-amber)' : 'transparent'}`,
              boxShadow: ring,
              opacity: other ? 0.4 : 1,
            }}>
        <span className="text-sm leading-none">{KIND_META[day.main].icon}</span>
        <span className={`absolute text-[8px] leading-none ${day.isToday ? 'font-bold' : ''}`}
              style={{ top: -3, right: -4, color: numberColor(day), fontFamily: 'var(--font-mono)' }}>
          {day.dayOfMonth}
        </span>
        {day.extra > 0 && (
          <span className="absolute flex items-center justify-center rounded-full text-[8px] font-bold leading-none"
                style={{
                  bottom: -3, right: -4, minWidth: 13, height: 13, padding: '0 2px',
                  background: 'var(--color-teal-dark)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)',
                }}>
            +{day.extra}
          </span>
        )}
      </span>
    </Cell>
  )
}

// ── Componenti interni ─────────────────────────────────────

function TapCell({ day, onClick, children }) {
  return (
    <button onClick={onClick}
      aria-label={ariaLabel(day)}
      className="flex items-center justify-center transition-all active:scale-90">
      {children}
    </button>
  )
}

function StillCell({ children }) {
  return <div className="flex items-center justify-center">{children}</div>
}

// ── Helpers ────────────────────────────────────────────────

function numberColor(day) {
  if (day.isToday) return 'var(--color-teal)'
  if (day.isPast) return 'var(--color-slate)'
  return 'var(--color-white)'
}

function ariaLabel(day) {
  const date = new Date(day.time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const done = day.sessions.map(s => KIND_META[s.kind].label.toLowerCase())
  const planned = day.plannable ? day.plans.map(p => `${KIND_META[p.kind].label.toLowerCase()} in programma`) : []
  const what = [...done, ...planned].join(', ')
  if (what) return `${date}: ${what}`
  return day.plannable ? `${date}: programma un'attività` : date
}
