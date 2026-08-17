import { runLadder, runStatusMeta } from '../../lib/tournaments'
import { surfaceIcon } from '../../lib/tennis'

// Riga della lista Tornei: nome, date, esito e — la parte che fa il lavoro —
// una traccia orizzontale con un segmento per turno, dall'ingresso (a sinistra)
// alla finale (a destra). È il tabellone ridotto a una riga: si vede subito
// quanto era lungo il cammino, quanto se n'è percorso e dove ci si è fermati,
// senza aprire niente. Tap → dettaglio con la scala per intero.
export default function TournamentCard({ run, onClick }) {
  const meta  = runStatusMeta(run)
  const steps = runLadder(run).slice().reverse() // dall'ingresso alla finale

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3 flex flex-col gap-2 transition-all active:scale-[0.98]"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}
    >
      {/* Nome + esito */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {run.name}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {formatRange(run.startDate, run.endDate)}
            {run.surfaces.length > 0 && ` · ${run.surfaces.map(surfaceIcon).join(' ')}`}
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
          {meta.icon && <span>{meta.icon}</span>}
          {meta.label}
        </span>
      </div>

      {/* Traccia del cammino */}
      {steps.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1">
            {steps.map(s => (
              <span key={s.round.id} className="flex-1 rounded-full"
                    style={{ height: '0.375rem', background: trackColor(s, run) }} />
            ))}
          </div>
          <span className="text-xs font-semibold shrink-0 tabular-nums"
                style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {run.wins}V · {run.losses}S
          </span>
        </div>
      )}

      {/* Le partite senza turno non vengono nascoste: il cammino sopra è
          incompleto e va detto, altrimenti la traccia mente per omissione. */}
      {run.undated.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-amber)' }}>
          {run.undated.length === 1
            ? '1 partita senza turno'
            : `${run.undated.length} partite senza turno`}
        </p>
      )}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function trackColor(step, run) {
  if (step.round.id === 'finale' && run.status === 'champion') return 'var(--color-amber)'
  if (step.state === 'played') {
    return step.matches.every(m => m.result === 'win') ? 'var(--color-win)' : 'var(--color-loss)'
  }
  if (step.state === 'bye') return 'var(--color-surface-2)'
  if (run.nextRoundId === step.round.id && !run.stale) return 'rgba(72,179,176,0.45)'
  return 'var(--color-surface-2)'
}

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

// "3–8 giu 2026", oppure "28 mag – 2 giu 2026" a cavallo di due mesi, o la sola
// data quando il torneo si è giocato in un giorno.
function formatRange(startDate, endDate) {
  const a = new Date(startDate)
  const b = new Date(endDate)
  if (isNaN(a) || isNaN(b)) return '—'
  const year = b.getFullYear()
  if (a.toDateString() === b.toDateString()) {
    return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} ${year}`
  }
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${year}`
  }
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${year}`
}
