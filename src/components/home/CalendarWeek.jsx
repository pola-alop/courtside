import { KIND_META, WEEKDAY_INITIALS } from '../../lib/calendar'

// La settimana corrente nel calendario della Home: al posto della riga di
// cerchi, l'intestazione `28 Set – 4 Ott` e sette card, una per giorno, con il
// fatto e il programmato. La card di oggi conta doppio, perché è lì che c'è da
// leggere l'orario di ciò che resta da fare. La settimana è sempre lunedì →
// domenica, anche a cavallo di due mesi, e i giorni dell'altro mese NON sono
// attenuati: questa riga è "adesso", e l'intestazione dice già quali mesi tocca.
//
// Dentro la card:
//  · le sessioni (cerchio pieno, bordo ambra la partita), nell'ordine del
//    calendario;
//  · i programmi ancora aperti (`openPlans`: un programma fatto lo rappresenta
//    la sua sessione) a cerchio tratteggiato — da fare normale, non svolto
//    attenuato e rosso; il riposo 💤 nel colore del suo stato;
//  · oltre `MAX_ITEMS` voci, un "+N" che apre il foglio del giorno.
// Tap su una sessione → il suo dettaglio, su un programma → `PlanModal` (che ha
// "Registra"), sul resto della card → quello che farebbe il giorno nella
// griglia (`onDay`). Tutto viene da `buildCalendar`: qui non si ricava niente.
//
// Sta nella stessa griglia a 8 colonne del mese: la fiammella è l'ottava, e
// copre anche la riga dell'intestazione, così la barra resta continua.
const MAX_ITEMS = 3

export default function CalendarWeek({ week, label, columnGap, flameCol, flame, onDay, onOpen, onPlan }) {
  const columns = `${week.days.map(d => (d.isToday ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)')).join(' ')} ${flameCol}px`

  return (
    <div className="rounded-xl"
         style={{
           display: 'grid', gridTemplateColumns: columns, columnGap, rowGap: 3, padding: '3px 4px',
           background: 'var(--color-week-bg)',
         }}>
      <p className="text-[10px] font-semibold px-0.5"
         style={{ gridColumn: '1 / span 7', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
      <div style={{ gridColumn: 8, gridRow: '1 / span 2', display: 'grid' }}>
        {flame}
      </div>
      {week.days.map((day, i) => (
        <WeekCard key={day.key} day={day} initial={WEEKDAY_INITIALS[i]}
                  onDay={() => onDay(day)} onOpen={onOpen}
                  onPlan={plan => onPlan({ date: day.key, plan })} />
      ))}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function WeekCard({ day, initial, onDay, onOpen, onPlan }) {
  const items = [
    ...day.sessions.map(s => ({ key: `s-${s.id}`, session: s })),
    ...day.openPlans.map(p => ({ key: `p-${p.id}`, plan: p })),
  ]
  const shown = items.slice(0, MAX_ITEMS)
  const hidden = items.length - shown.length

  return (
    <div role="button" tabIndex={0}
         aria-label={ariaLabel(day)}
         onClick={onDay}
         onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDay() } }}
         className="rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer"
         style={{
           minHeight: 92, padding: '4px 2px 5px',
           background: 'var(--color-surface)',
           border: `1px solid ${day.isToday ? 'var(--color-teal)' : 'var(--color-surface-2)'}`,
         }}>
      <span className="flex flex-col items-center leading-none">
        <span className="text-[8px] font-semibold" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          {initial}
        </span>
        <span className={`text-[11px] mt-0.5 ${day.isToday ? 'font-bold' : ''}`}
              style={{ color: numberColor(day), fontFamily: 'var(--font-mono)' }}>
          {day.dayOfMonth}
        </span>
      </span>

      {shown.map(item => (
        item.session
          ? <SessionDot key={item.key} session={item.session} onClick={() => onOpen(item.session)} />
          : <PlanDot key={item.key} plan={item.plan} showTime={day.isToday} onClick={() => onPlan(item.plan)} />
      ))}

      {hidden > 0 && (
        <span className="text-[9px] font-bold leading-none" style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          +{hidden}
        </span>
      )}
    </div>
  )
}

// Una sessione svolta: cerchio pieno, come nella griglia.
function SessionDot({ session, onClick }) {
  return (
    <DotButton onClick={onClick} label={KIND_META[session.kind].label}>
      <span className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 22, height: 22,
              background: 'var(--color-surface-2)',
              border: `2px solid ${session.kind === 'match' ? 'var(--color-amber)' : 'transparent'}`,
            }}>
        <span className="text-[11px] leading-none">{KIND_META[session.kind].icon}</span>
      </span>
    </DotButton>
  )
}

// Un programma aperto: tratteggiato. Sulla card di oggi porta accanto l'orario.
function PlanDot({ plan, showTime, onClick }) {
  const tone = planTone(plan)
  return (
    <DotButton onClick={onClick} label={`${KIND_META[plan.kind].label} in programma`}>
      <span className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 22, height: 22,
              background: tone.bg,
              border: `${tone.solid ? '2px solid' : '1.5px dashed'} ${tone.border}`,
            }}>
        <span className="text-[11px] leading-none" style={{ opacity: tone.iconOpacity }}>{KIND_META[plan.kind].icon}</span>
      </span>
      {showTime && plan.time && (
        <span className="text-[9px] leading-none" style={{ color: tone.text, fontFamily: 'var(--font-mono)' }}>
          {plan.time}
        </span>
      )}
    </DotButton>
  )
}

// Cerchio (22px) e orario (~27px) affiancati con 2px di spazio: a 360px la
// card di oggi ha 53px di contenuto e ci stanno (con 4px il wrap scattava
// già). Sotto (320px: 43px), o con un font più largo, l'orario va a capo
// sotto il cerchio invece di uscire dalla card.
function DotButton({ onClick, label, children }) {
  return (
    <button type="button" aria-label={label}
            onClick={e => { e.stopPropagation(); onClick() }}
            className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0.5 max-w-full transition-all active:scale-90">
      {children}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Da fare: tratteggio (ambra per la partita). Non svolto: tratteggio rosso e
// icona spenta. Il riposo rispettato è l'unico programma "pieno": non ha una
// sessione che lo rappresenti, quindi il suo fatto è il cerchio stesso.
function planTone(plan) {
  if (plan.kind === 'rest' && plan.status === 'done') {
    return { solid: true, border: 'var(--color-win)', bg: 'var(--color-win-bg)', iconOpacity: 1, text: 'var(--color-win)' }
  }
  if (plan.status === 'missed') {
    return { solid: false, border: 'var(--color-loss)', bg: 'var(--color-loss-bg)', iconOpacity: 0.5, text: 'var(--color-loss)' }
  }
  return {
    solid: false,
    border: plan.kind === 'match' ? 'var(--color-amber)' : 'var(--color-slate)',
    bg: 'transparent', iconOpacity: 0.55, text: 'var(--color-white)',
  }
}

function numberColor(day) {
  if (day.isToday) return 'var(--color-teal)'
  if (day.isPast) return 'var(--color-slate)'
  return 'var(--color-white)'
}

function ariaLabel(day) {
  const date = new Date(day.time).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  return day.plannable ? `${date}: apri il giorno o programma` : `${date}: apri il giorno o registra`
}
