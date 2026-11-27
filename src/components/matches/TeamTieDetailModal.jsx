import { useState, useRef } from 'react'
import MatchRow from './MatchRow'
import {
  tieRubbers, tieResult, tieStatus, tieStatusMeta, formulaText, homeLabel,
  deleteIssue, SCORE_MAX_LENGTH,
} from '../../lib/teamTies'

// Dettaglio di uno scontro a squadre. Il risultato (2-1) è ricavato dagli
// incontri: le mie partite (apribili) e gli esiti dei compagni, segnati qui con
// un tap su Vinto / Perso e un punteggio facoltativo. Un incontro libero offre
// anche «Ho giocato io», che apre il wizard già collegato a quell'incontro.
// `context` («Girone · Andata», «Quarti») compare solo per gli scontri di una
// competizione.
export default function TeamTieDetailModal({
  tie, context = null, matches = [], onClose, onSelectMatch, onRegister, onSetRubber, onEdit, onDelete,
}) {
  const [mode, setMode] = useState('view') // view | confirmDelete
  const [busy, setBusy] = useState(false)
  const queue = useRef(Promise.resolve())

  const rubbers = tieRubbers(tie, matches)
  const result  = tieResult(rubbers)
  const status  = tieStatus(tie, rubbers)
  const meta    = tieStatusMeta(status)
  const blocked = deleteIssue(tie, matches)
  const details = [context, formatDate(tie.date), homeLabel(tie.home), formulaText(tie.formula)].filter(Boolean).join(' · ')

  // Le scritture partono in fila, una dopo l'altra: il punteggio che si salva
  // uscendo dal campo e il tap su Vinto/Perso subito dopo non si perdono a
  // vicenda. `busy` serve solo a non lasciar eliminare a metà.
  const run = (fn) => {
    setBusy(true)
    queue.current = queue.current
      .then(fn)
      .catch(() => {})
      .then(() => setBusy(false))
    return queue.current
  }

  return (
    <div
      className="app-overlay fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(2,13,25,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs mb-1 break-words" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {details}
              </p>
              <h2 className="text-lg font-bold leading-tight break-words"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                vs {tie.opponentTeam}
              </h2>
              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full mt-2"
                    style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>
                {meta.label}
              </span>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
              ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Noi"       value={result.us}      color="var(--color-win)" />
            <StatTile label="Loro"      value={result.them}    color="var(--color-loss)" />
            <StatTile label="Da segnare" value={result.pending} />
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {mode === 'view' && <>
            <button
              onClick={onEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              ✏️ Modifica scontro
            </button>

            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                Incontri
              </p>
              <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
            </div>

            {status === 'incomplete' && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-amber)' }}>
                La data è passata e lo scontro non è deciso: segna gli incontri che mancano.
              </p>
            )}

            <div className="space-y-3">
              {rubbers.map(r => (
                <RubberBlock key={`${r.slot}-${r.state}-${r.winner}-${r.score}`} rubber={r}
                  onSelectMatch={onSelectMatch}
                  onRegister={() => onRegister(r.slot)}
                  onResult={(winner, score) => run(() => onSetRubber(r.slot, winner, score))} />
              ))}
            </div>

            <p className="text-[11px] leading-relaxed mt-4" style={{ color: 'var(--color-slate)' }}>
              Le tue partite entrano nelle statistiche come ogni partita. Gli incontri dei
              compagni sono solo un esito: contano nel risultato dello scontro, non nelle tue statistiche.
            </p>

            <div className="mt-6 pb-2">
              {blocked && (
                <p className="text-xs mb-2" style={{ color: 'var(--color-slate)' }}>{blocked}</p>
              )}
              <button
                onClick={() => setMode('confirmDelete')}
                disabled={Boolean(blocked)}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: 'var(--color-surface-2)', color: 'var(--color-loss)',
                  fontFamily: 'var(--font-display)', border: '1px solid var(--color-loss-bg)',
                  opacity: blocked ? 0.4 : 1,
                }}>
                🗑️ Elimina scontro
              </button>
            </div>
          </>}

          {mode === 'confirmDelete' && (
            <div className="pt-2 rounded-2xl p-4" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--color-white)' }}>
                Eliminare lo scontro con {tie.opponentTeam}? Gli esiti dei compagni vanno persi. L'azione non può essere annullata.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('view')}
                        className="py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button onClick={() => run(async () => { await onDelete(); onClose() })} disabled={busy}
                        className="py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: 'var(--color-loss)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
                  Elimina
                </button>
              </div>
            </div>
          )}
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
      <p className="text-[9px] uppercase tracking-wider mt-0.5 whitespace-nowrap"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
    </div>
  )
}

// Un incontro. `key` cambia con lo stato, così il punteggio in modifica si
// rinfresca quando l'esito viene riscritto.
function RubberBlock({ rubber, onSelectMatch, onRegister, onResult }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {rubber.label}
      </p>

      {rubber.state === 'own' && (
        <MatchRow match={rubber.match} onClick={() => onSelectMatch?.(rubber.match.id)} />
      )}

      {rubber.state === 'mate' && (
        <MateResult rubber={rubber} onResult={onResult} />
      )}

      {rubber.state === 'open' && (
        <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-surface-2)' }}>
          <button onClick={onRegister}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
            🎾 Ho giocato io
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-slate)' }}>Ha giocato un compagno:</span>
            <ResultChip label="Vinto" active={false} color="var(--color-win)"  onClick={() => onResult('us', null)} />
            <ResultChip label="Perso" active={false} color="var(--color-loss)" onClick={() => onResult('them', null)} />
          </div>
        </div>
      )}
    </div>
  )
}

// Esito di un compagno: Vinto / Perso (un tap sulla scelta attiva la toglie),
// punteggio libero che si salva uscendo dal campo.
function MateResult({ rubber, onResult }) {
  const [score, setScore] = useState(rubber.score || '')
  const commitScore = () => {
    if (score.trim() !== (rubber.score || '')) onResult(rubber.winner, score)
  }

  return (
    <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--color-surface-2)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>Compagno:</span>
        <ResultChip label="Vinto" active={rubber.winner === 'us'} color="var(--color-win)"
                    onClick={() => onResult(rubber.winner === 'us' ? null : 'us', score)} />
        <ResultChip label="Perso" active={rubber.winner === 'them'} color="var(--color-loss)"
                    onClick={() => onResult(rubber.winner === 'them' ? null : 'them', score)} />
      </div>
      <input
        value={score}
        maxLength={SCORE_MAX_LENGTH}
        placeholder="Punteggio (facoltativo), es. 6-4 3-6 10-7"
        onChange={e => setScore(e.target.value)}
        onBlur={commitScore}
        className="w-full p-2.5 rounded-xl text-xs outline-none"
        style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid transparent', fontFamily: 'var(--font-mono)' }}
      />
    </div>
  )
}

function ResultChip({ label, active, color, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
      style={{
        background: active ? color : 'var(--color-surface)',
        color:      active ? 'var(--color-bg)' : color,
        border:     `1px solid ${color}`,
        fontFamily: 'var(--font-display)',
      }}>
      {label}
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
