import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityTimeline from './ActivityTimeline'
import { RESULT_META, matchMinutes, hasRealDuration } from '../../lib/tennis'
import { totalMinutes, formatHours, focusLabel, FOCUS_BY_ID } from '../../lib/training'
import { computeWear, wearLevelMeta } from '../../lib/wear'

// Landing di sintesi dell'area Matches: risponde a "come sto andando" prima
// ancora di entrare nel dettaglio di partite o allenamenti.
//
// ── Perché una finestra mobile di 30 giorni e non il mese solare ──
// Il mese solare ha un difetto strutturale come unità di sintesi: il 1° del
// mese la panoramica è azzerata, e per tutta la prima metà il confronto col
// "mese scorso" è ingiusto (10 giorni contro 31). Una finestra di 30 giorni
// che scorre con oggi è sempre piena e sempre confrontabile con i 30 giorni
// precedenti — che è esattamente il delta mostrato sulle tile.
//
// Le frecce spostano la finestra INDIETRO nel tempo e governano tutto ciò che
// è misurabile in un periodo (tile, delta, attività, forma, colpi più
// lavorati): una sola nozione di "periodo selezionato" in pagina, non due.
// L'unica eccezione è l'alert usura, che è un fatto del presente — le corde
// sono consumate *ora*, non "erano consumate a giugno" — e infatti compare
// solo sulla finestra corrente.

const PERIOD_DAYS     = 30
const TOP_FOCUS       = 3   // in mezza larghezza le etichette lunghe si troncano
const FORM_MATCHES    = 5
const MAX_WEAR_ALERTS = 2

export default function Overview({
  matches = [], trainings = [], equipment = [],
  onSelectMatch, onSelectTraining, onAddMatch, onAddTraining,
}) {
  const [offset, setOffset] = useState(0)

  const range     = periodRange(offset)
  const prevRange = periodRange(offset + 1)
  const current   = collect(matches, trainings, range)
  const previous  = collect(matches, trainings, prevRange)

  // I colpi più lavorati nel periodo: l'analisi completa vivrà in Stats
  // (heatmap del focus), qui basta il vertice della classifica.
  const focusCounts = {}
  current.trainings.forEach(t => (t.focus || []).forEach(id => {
    if (FOCUS_BY_ID[id]) focusCounts[id] = (focusCounts[id] || 0) + 1
  }))
  const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]).slice(0, TOP_FOCUS)

  // Forma: gli ultimi 5 match giocati FINO alla fine del periodo selezionato,
  // non solo dentro la finestra — cinque scontri possono coprire più di 30
  // giorni, e una "forma" a due pallini non direbbe niente. `matches` arriva
  // già ordinato per data desc da getMatches.
  const formMatches = matches
    .filter(m => dayTime(m.date) != null && dayTime(m.date) <= range.end.getTime())
    .slice(0, FORM_MATCHES)
    .reverse()

  // L'usura è un fatto del presente: nessun alert quando si guarda indietro.
  const wearAlerts = offset !== 0 ? [] : equipment
    .filter(e => e.active !== false)
    .map(item => ({ item, wear: computeWear(item, matches, trainings) }))
    .filter(x => x.wear && x.wear.ratio != null && x.wear.level === 'high')
    .sort((a, b) => b.wear.ratio - a.wear.ratio)
    .slice(0, MAX_WEAR_ALERTS)

  if (matches.length === 0 && trainings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 text-center">
        <span className="text-5xl mb-4 opacity-60">🗂</span>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Ancora niente da riassumere.
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>
          Registra una partita o un allenamento per popolare la panoramica.
        </p>
        <QuickActions onAddMatch={onAddMatch} onAddTraining={onAddTraining} />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Periodo — governa tile, delta, attività, forma e colpi */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <ArrowButton label="Periodo precedente" onClick={() => setOffset(offset + 1)}>‹</ArrowButton>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest"
               style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {offset === 0 ? `Ultimi ${PERIOD_DAYS} giorni` : `${PERIOD_DAYS} giorni`}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {shortDate(range.start)} – {shortDate(range.end)}
            </p>
          </div>
          <ArrowButton label="Periodo successivo" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 1))}>›</ArrowButton>
        </div>
        {offset > 0 && (
          <div className="flex justify-center mt-2">
            <button onClick={() => setOffset(0)}
              className="px-3 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95"
              style={{ background: 'var(--color-surface)', color: 'var(--color-amber)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
              Torna a oggi
            </button>
          </div>
        )}
      </div>

      {/* Tile di sintesi del periodo, con delta sui 30 giorni precedenti */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Partite" color="var(--color-amber)"
                  value={String(current.matches.length)}
                  delta={deltaInfo(current.matches.length, previous.matches.length)} />
        <StatTile label="Allenamenti" color="var(--color-teal)"
                  value={String(current.trainings.length)}
                  delta={deltaInfo(current.trainings.length, previous.trainings.length)} />
        <StatTile label="Ore in campo" color="var(--color-white)"
                  value={`${current.estimated ? '~' : ''}${formatHours(current.minutes)}`}
                  delta={deltaInfo(current.minutes / 60, previous.minutes / 60, formatDecimal)} />
        <StatTile label="Giorni" color="var(--color-win)"
                  value={String(current.days)}
                  delta={deltaInfo(current.days, previous.days)} />
      </div>

      {/* Le ore delle partite senza dati atletici sono stimate dai game: dirlo
          una volta sotto le tile è più onesto di una "~" senza spiegazione. */}
      {current.estimated && (
        <p className="text-[10px] -mt-2" style={{ color: 'var(--color-slate)' }}>
          ~ Le partite senza dati atletici hanno la durata stimata dai game giocati.
        </p>
      )}

      {wearAlerts.length > 0 && (
        <div className="space-y-2">
          {wearAlerts.map(({ item, wear }) => <WearAlert key={item.id} item={item} wear={wear} />)}
        </div>
      )}

      <ActivityTimeline
        matches={current.matches}
        trainings={current.trainings}
        range={range}
        onSelectMatch={onSelectMatch}
        onSelectTraining={onSelectTraining}
      />

      {(formMatches.length > 0 || topFocus.length > 0) && (
        <div className="flex gap-2 items-stretch">
          {formMatches.length > 0 && <FormCard matches={formMatches} onSelectMatch={onSelectMatch} />}
          {topFocus.length > 0 && <TopFocusCard items={topFocus} />}
        </div>
      )}

      <QuickActions onAddMatch={onAddMatch} onAddTraining={onAddTraining} />
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function StatTile({ label, value, color, delta }) {
  return (
    <div className="rounded-2xl px-1 py-2.5 text-center min-w-0"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-lg font-bold truncate" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide leading-tight mt-0.5" style={{ color: 'var(--color-slate)' }}>{label}</p>
      {delta && (
        <p className="text-[9px] font-medium mt-1" style={{ color: delta.color, fontFamily: 'var(--font-mono)' }}>
          {delta.arrow}{delta.text}
        </p>
      )}
    </div>
  )
}

// L'unica riga azionabile della pagina: porta dritta all'attrezzatura da
// sostituire, invece di limitarsi a informare.
function WearAlert({ item, wear }) {
  const meta = wearLevelMeta(wear.level)
  return (
    <Link to="/equipment"
      className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-[0.99]"
      style={{ background: meta.boxBg, border: '1px solid var(--color-surface-2)' }}>
      <span className="text-sm shrink-0">{meta.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="text-xs block truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {itemName(item)}
        </span>
        <span className="text-[10px] block truncate" style={{ color: meta.color }}>{wear.label}</span>
      </span>
      <span className="text-xs shrink-0 font-semibold" style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>
        {wear.percent}%
      </span>
      <span className="text-sm shrink-0" style={{ color: 'var(--color-slate)' }}>›</span>
    </Link>
  )
}

// Andamento degli ultimi scontri: cinque lettere senza un totale non dicono se
// stai andando bene in assoluto, quindi sotto i pallini c'è il record.
function FormCard({ matches, onSelectMatch }) {
  const record = {
    win:  matches.filter(m => m.result === 'win').length,
    draw: matches.filter(m => m.result === 'draw').length,
    loss: matches.filter(m => m.result === 'loss').length,
  }

  return (
    <div className="flex-1 min-w-0 rounded-2xl p-3"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        Forma
      </p>
      <div className="flex gap-1.5 mt-2.5">
        {matches.map(m => {
          const meta = RESULT_META[m.result] || RESULT_META.draw
          return (
            <button key={m.id} onClick={() => onSelectMatch?.(m.id)}
              title={`${meta.label} — ${m.opponentName || 'avversario'}`}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all active:scale-90"
              style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
              {resultLetter(m.result)}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] mt-2.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {record.win}V · {record.draw}P · {record.loss}S
      </p>
    </div>
  )
}

function TopFocusCard({ items }) {
  const max = items[0][1]
  return (
    <div className="flex-1 min-w-0 rounded-2xl p-3"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        Più lavorati
      </p>
      <div className="space-y-2 mt-2.5">
        {items.map(([id, count]) => (
          <div key={id}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] flex-1 min-w-0 truncate"
                    style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {focusLabel(id)}
              </span>
              <span className="text-[10px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {count}
              </span>
            </div>
            <div className="h-1 rounded-full mt-1"
                 style={{ width: `${(count / max) * 100}%`, minWidth: 6, background: 'var(--color-teal-dark)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Il "+" in header è nascosto nel tab Panoramica: senza questi bottoni la
// landing dell'app sarebbe l'unica schermata da cui non si può registrare nulla.
function QuickActions({ onAddMatch, onAddTraining }) {
  return (
    <div className="flex gap-2">
      <button onClick={onAddMatch}
        className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        + Partita
      </button>
      <button onClick={onAddTraining}
        className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-surface)', color: 'var(--color-teal)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
        + Allenamento
      </button>
    </div>
  )
}

function ArrowButton({ children, onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 transition-all active:scale-90"
      style={{
        background: 'var(--color-surface)',
        color: disabled ? 'var(--color-surface-2)' : 'var(--color-teal)',
        border: '1px solid var(--color-surface-2)',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'var(--font-display)',
      }}>
      {children}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Finestra di PERIOD_DAYS giorni che termina oggi (offset 0) o `offset`
// finestre più indietro. Estremi inclusi.
function periodRange(offset) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - offset * PERIOD_DAYS)
  const start = new Date(end)
  start.setDate(end.getDate() - (PERIOD_DAYS - 1))
  return { start, end }
}

// Mezzanotte LOCALE della data di una sessione: confrontare gli ISO grezzi
// farebbe cadere le sessioni serali nel giorno (e nel periodo) sbagliato.
function dayTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function inRange(dateStr, range) {
  const t = dayTime(dateStr)
  return t != null && t >= range.start.getTime() && t <= range.end.getTime()
}

// Tutto ciò che serve alle tile per una finestra temporale. `estimated` dice se
// almeno una partita ha la durata stimata invece che misurata, così il totale
// delle ore può dichiararlo.
function collect(matches, trainings, range) {
  const ms = matches.filter(m => inRange(m.date, range))
  const ts = trainings.filter(t => inRange(t.date, range))

  const matchMin    = ms.reduce((sum, m) => sum + matchMinutes(m), 0)
  const trainingMin = ts.reduce((sum, t) => sum + totalMinutes(t.blocks), 0)

  // Un giorno conta una volta sola anche se ci sono più sessioni
  const days = new Set([
    ...ms.map(m => dayTime(m.date)),
    ...ts.map(t => dayTime(t.date)),
  ]).size

  return {
    matches: ms,
    trainings: ts,
    minutes: matchMin + trainingMin,
    estimated: ms.some(m => !hasRealDuration(m)),
    days,
  }
}

function deltaInfo(current, previous, format = v => String(Math.round(v))) {
  const diff = current - previous
  if (Math.abs(diff) < 0.05) return { arrow: '=', text: '', color: 'var(--color-slate)' }
  return {
    arrow: diff > 0 ? '▲' : '▼',
    text: format(Math.abs(diff)),
    color: diff > 0 ? 'var(--color-win)' : 'var(--color-loss)',
  }
}

function formatDecimal(v) {
  return v.toLocaleString('it-IT', { maximumFractionDigits: 1 })
}

function shortDate(date) {
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function resultLetter(result) {
  return { win: 'V', loss: 'S', draw: 'P' }[result] || '?'
}

function itemName(item) {
  return item.nickname || item.model || item.name || 'Attrezzatura'
}
