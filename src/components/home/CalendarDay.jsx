import { KIND_META } from '../../lib/calendar'

// Un giorno della griglia del mese.
//
//  · con attività: cerchio pieno con l'icona della sessione principale e il
//    numero del giorno piccolo in apice; la partita ha il bordo ambra (stesso
//    codice colore della Panoramica), le altre sessioni nel pallino "+N";
//  · senza attività: cerchio vuoto con il numero dentro — grigio nel passato,
//    chiaro da oggi in avanti;
//  · giorni del mese prima/dopo: le attività si vedono comunque, attenuate; da
//    vuoti resta solo il numero, senza cerchio;
//  · oggi: anello teal, che convive con il bordo ambra della partita.
//
// Si tocca solo un giorno con attività: "Registra" sui giorni passati vuoti e la
// programmazione dei giorni futuri arrivano con i programmi.
export default function CalendarDay({ day, onClick }) {
  const has = day.sessions.length > 0
  const other = day.otherMonth != null

  if (!has && other) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center" style={{ width: '100%', maxWidth: 34, aspectRatio: '1' }}>
          <span className="text-[10px]" style={{ color: 'var(--color-slate)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
            {day.dayOfMonth}
          </span>
        </div>
      </div>
    )
  }

  const ring = day.isToday ? '0 0 0 2px var(--color-teal)' : 'none'

  if (!has) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center rounded-full"
             style={{
               width: '100%', maxWidth: 34, aspectRatio: '1',
               border: '1px solid var(--color-surface-2)', boxShadow: ring,
             }}>
          <span className={`text-[11px] ${day.isToday ? 'font-bold' : ''}`}
                style={{ color: numberColor(day), fontFamily: 'var(--font-mono)' }}>
            {day.dayOfMonth}
          </span>
        </div>
      </div>
    )
  }

  return (
    <button onClick={onClick}
      aria-label={ariaLabel(day)}
      className="flex items-center justify-center transition-all active:scale-90">
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
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function numberColor(day) {
  if (day.isToday) return 'var(--color-teal)'
  if (day.isPast) return 'var(--color-slate)'
  return 'var(--color-white)'
}

function ariaLabel(day) {
  const date = new Date(day.time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const what = day.sessions.map(s => KIND_META[s.kind].label.toLowerCase()).join(', ')
  return `${date}: ${what}`
}
