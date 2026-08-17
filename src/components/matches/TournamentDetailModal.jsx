import MatchRow from './MatchRow'
import TournamentLadder from './TournamentLadder'
import { runStatusMeta, roundPhrase } from '../../lib/tournaments'
import { surfaceIcon } from '../../lib/tennis'

// Dettaglio di un'edizione di torneo. Non ha modalità di modifica né di
// eliminazione — e non è una dimenticanza: un torneo non è un documento, è la
// lettura di un gruppo di partite. Si corregge correggendo le partite, che è
// l'unico posto dove quei dati esistono davvero.
export default function TournamentDetailModal({ run, onClose, onSelectMatch }) {
  const meta = runStatusMeta(run)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs mb-1" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(run.startDate)}
                {run.endDate !== run.startDate && ` → ${formatDate(run.endDate)}`}
              </p>
              <h2 className="text-lg font-bold leading-tight"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {run.name}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-2"
                    style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
                {meta.icon && <span>{meta.icon}</span>}
                {meta.label}
              </span>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
              ✕
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatTile label="Partite" value={run.played} />
            <StatTile label="Vinte"   value={run.wins}   color="var(--color-win)" />
            <StatTile label="Perse"   value={run.losses} color="var(--color-loss)" />
            <StatTile label="Set"     value={`${run.setsMe}-${run.setsOpp}`} />
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider"
               style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              Il tuo cammino
            </p>
            <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
            {run.entryRoundId && (
              <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-slate)' }}>
                {roundPhrase(run.entryRoundId, 'from')}
              </span>
            )}
          </div>

          {run.path.length > 0 ? (
            <TournamentLadder run={run} onSelectMatch={onSelectMatch} />
          ) : (
            <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
                Nessuna partita di questo torneo ha un turno assegnato, quindi il
                tabellone non si può ricostruire.
              </p>
            </div>
          )}

          {/* Le partite senza turno restano visibili e apribili: sono partite a
              tutti gli effetti, solo non collocabili nel tabellone. */}
          {run.undated.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                 style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
                Senza turno
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--color-slate)' }}>
                Apri la partita e modificala per assegnare il turno: rientrerà nel cammino qui sopra.
              </p>
              <div className="space-y-2">
                {run.undated.map(m => (
                  <MatchRow key={m.id} match={m} onClick={() => onSelectMatch?.(m.id)} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 pb-2 flex items-center gap-2">
            <span className="text-xs shrink-0">{run.surfaces.map(surfaceIcon).join(' ')}</span>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-slate)' }}>
              I turni oltre la tua uscita sono disegnati per dare la misura del
              tabellone. Courtside non registra le partite degli altri giocatori:
              di questo torneo conosce solo il tuo cammino.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-2xl px-2 py-2.5 text-center" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-base font-bold tabular-nums"
         style={{ color: color || 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wider mt-0.5"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
