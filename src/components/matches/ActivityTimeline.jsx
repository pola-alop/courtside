import { useState } from 'react'
import { RESULT_META, surfaceIcon, hasScore } from '../../lib/tennis'
import { formatMinutes, totalMinutes, blocksSummary, focusLabel, intensityMeta, FOCUS_BY_ID } from '../../lib/training'

// Attività del periodo, in due strati che rispondono a due domande diverse.
//
// 1. La STRISCIA di densità (una cella per giorno del periodo) risponde a
//    "quanto sono stato costante": è l'unica cosa che il vecchio contribution
//    graph a 26 settimane faceva davvero bene, e qui costa una riga sola.
// 2. L'AGENDA risponde a "cosa ho fatto". Una griglia-calendario, anche di un
//    solo mese, ha celle da ~45px su mobile: dentro non ci sta nessuna
//    informazione reale, solo un colore. Una lista dei soli giorni con
//    attività non spreca spazio in caselle vuote, mostra il punteggio e la
//    sessione per esteso, e soprattutto è tappabile fino al dettaglio.
//
// Riceve partite e allenamenti GIÀ filtrati per il periodo selezionato: la
// finestra temporale è governata da Overview, che la condivide con le tile.

const PREVIEW_DAYS = 6      // giorni mostrati prima di "mostra tutto"
const MAX_FOCUS_IN_ROW = 2

const COLOR_MATCH    = 'var(--color-amber)'
const COLOR_TRAINING = 'var(--color-teal-dark)'
const COLOR_EMPTY    = 'var(--color-surface-2)'

export default function ActivityTimeline({
  matches = [], trainings = [], range,
  onSelectMatch, onSelectTraining,
}) {
  const [showAll, setShowAll] = useState(false)

  const matchDays    = new Set(matches.map(m => dayKey(m.date)).filter(Boolean))
  const trainingDays = new Set(trainings.map(t => dayKey(t.date)).filter(Boolean))

  const days = eachDay(range)
  const groups = buildGroups(matches, trainings)
  const visibleGroups = showAll ? groups : groups.slice(0, PREVIEW_DAYS)
  const hiddenCount = groups.length - visibleGroups.length

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          Attività
        </p>
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>
          {groups.length} {groups.length === 1 ? 'giorno' : 'giorni'} in campo
        </span>
      </div>

      {/* Striscia di densità: una cella per giorno del periodo */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 2 }}>
        {days.map(d => (
          <div key={d.key}
               title={`${d.label}${dayTitle(matchDays.has(d.key), trainingDays.has(d.key))}`}
               style={{
                 aspectRatio: '1',
                 borderRadius: 2,
                 background: cellColor(matchDays.has(d.key), trainingDays.has(d.key)),
               }} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          {days[0]?.label}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
          {days[days.length - 1]?.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <LegendDot color={COLOR_MATCH} label="Partita" />
        <LegendDot color={COLOR_TRAINING} label="Allenamento" />
        <LegendDot color={`linear-gradient(135deg, ${COLOR_MATCH} 50%, ${COLOR_TRAINING} 50%)`} label="Entrambi" />
      </div>

      {/* Agenda dei soli giorni con attività */}
      {groups.length === 0 ? (
        <p className="text-xs text-center pt-5 pb-1" style={{ color: 'var(--color-slate)' }}>
          Nessuna attività in questo periodo.
        </p>
      ) : (
        <>
          <div className="h-px my-3" style={{ background: 'var(--color-surface-2)' }} />
          <div className="space-y-2.5">
            {visibleGroups.map(group => (
              <DayGroup key={group.key} group={group}
                        onSelectMatch={onSelectMatch} onSelectTraining={onSelectTraining} />
            ))}
          </div>
          {(hiddenCount > 0 || showAll) && (
            <button onClick={() => setShowAll(!showAll)}
              className="w-full text-center text-[11px] font-medium pt-3 transition-all active:scale-[0.98]"
              style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {showAll ? 'Mostra meno' : `Mostra altri ${hiddenCount} ${hiddenCount === 1 ? 'giorno' : 'giorni'}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

// Un giorno dell'agenda: la data è scritta una volta sola anche quando nello
// stesso giorno ci sono più sessioni (partita + allenamento, o due allenamenti).
function DayGroup({ group, onSelectMatch, onSelectTraining }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 shrink-0 text-[11px] pt-px"
            style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {group.label}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        {group.items.map(item => (
          item.type === 'match'
            ? <MatchLine key={item.data.id} match={item.data} onClick={() => onSelectMatch?.(item.data.id)} />
            : <TrainingLine key={item.data.id} training={item.data} onClick={() => onSelectTraining?.(item.data.id)} />
        ))}
      </div>
    </div>
  )
}

function MatchLine({ match, onClick }) {
  const meta = RESULT_META[match.result] || RESULT_META.draw
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 text-left transition-all active:scale-[0.99]">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="text-xs flex-1 min-w-0 truncate"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {match.opponentName || 'Avversario'}
      </span>
      <span className="text-[10px] shrink-0"
            style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {compactScore(match)}
      </span>
      <span className="text-[10px] shrink-0">{surfaceIcon(match.surface)}</span>
    </button>
  )
}

function TrainingLine({ training, onClick }) {
  const intensity = intensityMeta(training.intensity)
  const focusIds = (training.focus || []).filter(id => FOCUS_BY_ID[id])
  const focusLine = focusIds.length === 0 ? null : [
    focusIds.slice(0, MAX_FOCUS_IN_ROW).map(focusLabel).join(' · '),
    focusIds.length > MAX_FOCUS_IN_ROW ? `+${focusIds.length - MAX_FOCUS_IN_ROW}` : null,
  ].filter(Boolean).join(' ')

  return (
    <button onClick={onClick} className="w-full text-left transition-all active:scale-[0.99]">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_TRAINING }} />
        <span className="text-xs flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {sessionSummary(training)}
        </span>
        {intensity && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: intensity.color }}
                title={`Intensità ${intensity.label.toLowerCase()}`} />
        )}
      </div>
      {focusLine && (
        <p className="text-[10px] truncate" style={{ paddingLeft: 14, color: 'var(--color-slate)' }}>
          {focusLine}
        </p>
      )}
    </button>
  )
}

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
  return keyOf(d)
}

function keyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(date) {
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// Tutti i giorni del periodo, dal più vecchio al più recente
function eachDay(range) {
  const days = []
  const cursor = new Date(range.start)
  while (cursor <= range.end) {
    days.push({ key: keyOf(cursor), label: dayLabel(cursor) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// Raggruppa partite e allenamenti per giorno, dal più recente. Dentro lo stesso
// giorno le partite vengono prima: se hai giocato e ti sei allenato, la partita
// è l'evento che ricordi.
function buildGroups(matches, trainings) {
  const byDay = new Map()

  const push = (type, data) => {
    const key = dayKey(data.date)
    if (!key) return
    if (!byDay.has(key)) byDay.set(key, { key, label: dayLabel(new Date(data.date)), items: [] })
    byDay.get(key).items.push({ type, data })
  }

  matches.forEach(m => push('match', m))
  trainings.forEach(t => push('training', t))

  return [...byDay.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(g => ({ ...g, items: g.items.sort((a, b) => (a.type === b.type ? 0 : a.type === 'match' ? -1 : 1)) }))
}

// "6-4 6-2", con i soli set effettivamente giocati
function compactScore(match) {
  const sets = (match.sets || []).filter(hasScore)
  const score = sets.map(s => `${s.me}-${s.opp}`).join(' ')
  if (match.retired) return score ? `${score} rit.` : 'rit.'
  return score || '—'
}

// "1h 30 · Lezione · Match play"
function sessionSummary(training) {
  const minutes = totalMinutes(training.blocks)
  const parts = []
  if (minutes > 0) parts.push(formatMinutes(minutes))
  const blocks = blocksSummary(training.blocks)
  if (blocks) parts.push(blocks)
  return parts.length > 0 ? parts.join(' · ') : 'Allenamento'
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
