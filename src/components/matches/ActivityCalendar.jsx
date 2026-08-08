// Calendario a puntini dell'attività in campo, stile "contribution graph":
// una cella per giorno, 7 righe (lun→dom) e una colonna per settimana.
// Unisce partite e allenamenti perché la domanda a cui risponde è "quanto sono
// stato in campo", non "quanto ho gareggiato" — ed è la vista che dà il colpo
// d'occhio sulla continuità che nessuna lista cronologica riesce a dare.

const WEEKS = 26          // ~6 mesi: entra in larghezza su mobile senza scroll
const DAYS_IN_WEEK = 7
const MONTH_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const COLOR_MATCH    = 'var(--color-amber)'
const COLOR_TRAINING = 'var(--color-teal-dark)'
const COLOR_EMPTY    = 'var(--color-surface-2)'

export default function ActivityCalendar({ matches = [], trainings = [] }) {
  const matchDays    = new Set(matches.map(m => dayKey(m.date)).filter(Boolean))
  const trainingDays = new Set(trainings.map(t => dayKey(t.date)).filter(Boolean))

  const { days, weeks } = buildGrid()
  const activeDays = days.filter(d => !d.future && (matchDays.has(d.key) || trainingDays.has(d.key))).length

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Attività
        </p>
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>
          {activeDays} {activeDays === 1 ? 'giorno' : 'giorni'} negli ultimi 6 mesi
        </span>
      </div>

      {/* Etichette dei mesi, allineate alle colonne-settimana */}
      <div className="mb-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: 2 }}>
        {weeks.map((w, i) => (
          <span key={i} className="text-[9px] leading-none truncate"
                style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
            {w.monthLabel || ''}
          </span>
        ))}
      </div>

      {/* Griglia: riempimento per colonna (una settimana alla volta, lun→dom) */}
      <div style={{
        display: 'grid',
        gridTemplateRows: `repeat(${DAYS_IN_WEEK}, 1fr)`,
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        gap: 2,
      }}>
        {days.map(d => (
          <div key={d.key}
               title={d.future ? '' : `${d.label}${dayTitle(matchDays.has(d.key), trainingDays.has(d.key))}`}
               style={{
                 aspectRatio: '1',
                 borderRadius: 2,
                 background: d.future ? 'transparent' : cellColor(matchDays.has(d.key), trainingDays.has(d.key)),
               }} />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <LegendDot color={COLOR_MATCH} label="Partita" />
        <LegendDot color={COLOR_TRAINING} label="Allenamento" />
        <LegendDot color={`linear-gradient(135deg, ${COLOR_MATCH} 50%, ${COLOR_TRAINING} 50%)`} label="Entrambi" />
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>{label}</span>
    </span>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Chiave giorno in ora LOCALE (non `toISOString`, che sposta al fuso UTC e
// farebbe cadere le sessioni serali nel giorno successivo).
function dayKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Costruisce WEEKS settimane consecutive che terminano con quella corrente,
// allineate al lunedì. I giorni successivi a oggi restano nella griglia ma
// vengono resi trasparenti: togliere le celle sfalserebbe l'allineamento.
function buildGrid() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // getDay(): 0 = domenica → lo riportiamo a una settimana che parte da lunedì
  const offsetToMonday = (today.getDay() + 6) % 7
  const start = new Date(today)
  start.setDate(today.getDate() - offsetToMonday - (WEEKS - 1) * DAYS_IN_WEEK)

  const days = []
  const weeks = []
  let previousMonth = null

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() + w * DAYS_IN_WEEK)

    // Etichetta il mese solo quando cambia rispetto alla settimana precedente
    const month = weekStart.getMonth()
    const isNewMonth = previousMonth === null || month !== previousMonth
    weeks.push({ monthLabel: isNewMonth ? MONTH_SHORT[month] : null })
    previousMonth = month

    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + d)
      days.push({
        key: dayKey(date),
        label: date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        future: date > today,
      })
    }
  }

  return { days, weeks }
}

function cellColor(hasMatch, hasTraining) {
  if (hasMatch && hasTraining) return `linear-gradient(135deg, ${COLOR_MATCH} 50%, ${COLOR_TRAINING} 50%)`
  if (hasMatch) return COLOR_MATCH
  if (hasTraining) return COLOR_TRAINING
  return COLOR_EMPTY
}

function dayTitle(hasMatch, hasTraining) {
  if (hasMatch && hasTraining) return ' — partita e allenamento'
  if (hasMatch) return ' — partita'
  if (hasTraining) return ' — allenamento'
  return ''
}
