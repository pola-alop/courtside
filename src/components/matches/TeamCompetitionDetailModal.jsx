import { useState } from 'react'
import TeamStandings from './TeamStandings'
import TournamentLadder from './TournamentLadder'
import TieStepCard from './TieStepCard'
import TeamResultModal from './TeamResultModal'
import {
  buildStandings, competitionStatus, finalsRun, teamName, tieContext, competitionDeleteIssue,
} from '../../lib/teamCompetitions'
import { tieStatusMeta, resultText, formulaText } from '../../lib/teamTies'

// Dettaglio di una competizione a squadre: classifica (con le qualificate e gli
// spareggi non calcolabili dichiarati), calendario degli scontri del girone e
// fase finale. Tutto ricavato da `buildStandings`/`finalsRun`: il modale non
// calcola niente. Dal calendario: «Crea scontro» per i miei (apre il form già
// sulla squadra), «Segna risultato» per quelli tra altre squadre (inserimento
// rapido). Gli scontri (del girone e della finale) si aprono sopra questo modale.
export default function TeamCompetitionDetailModal({
  competition, ties = [], matches = [], onClose, onSelectTie, onCreateTie,
  onSetResult, onClearResult, onEdit, onDelete,
}) {
  const [mode, setMode] = useState('view') // view | confirmDelete
  const [resultKey, setResultKey] = useState(null)
  const [busy, setBusy] = useState(false)

  const standings = buildStandings(competition, ties, matches)
  const status = competitionStatus(competition, ties, matches, new Date(), standings)
  const run = finalsRun(competition, ties, matches)
  const blocked = competitionDeleteIssue(competition, ties)
  const myRow = standings.rows.find(r => r.mine)
  const hasFinals = competition.qualifiers > 0 || Boolean(run)
  const resultFixture = resultKey ? standings.fixtures.find(f => f.key === resultKey) || null : null

  const details = [
    competition.season,
    `${competition.teams.length} squadre`,
    competition.legs === 2 ? 'andata e ritorno' : 'solo andata',
    formulaText(competition.formula),
    `punti ${competition.points.win}-${competition.points.draw}-${competition.points.loss}`,
  ].filter(Boolean).join(' · ')

  const name = id => teamName(competition, id) || '—'
  // Prima i miei scontri, poi gli altri; dentro ciascun gruppo l'ordine del calendario.
  const legs = competition.legs === 2 ? [1, 2] : [1]

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs mb-1 wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {details}
              </p>
              <h2 className="text-lg font-bold leading-tight wrap-anywhere"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {competition.name}
              </h2>
              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full mt-2"
                    style={{ background: status.bg, color: status.color, fontFamily: 'var(--font-display)' }}>
                {status.icon ? `${status.icon} ` : ''}{status.label}
              </span>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-slate)' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {mode === 'view' && <>
            <button
              onClick={onEdit}
              className="w-full mb-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
              ✏️ Modifica competizione
            </button>

            <SectionTitle>Classifica</SectionTitle>
            <TeamStandings standings={standings} qualifiers={competition.qualifiers} />

            <div className="mt-6">
              <SectionTitle>Calendario del girone</SectionTitle>
              {legs.map(leg => {
                const list = standings.fixtures.filter(f => f.leg === leg)
                const ordered = [...list.filter(f => f.mine), ...list.filter(f => !f.mine)]
                return (
                  <div key={leg} className="mb-3">
                    {competition.legs === 2 && (
                      <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                        {leg === 1 ? 'Andata' : 'Ritorno'}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {ordered.map(f => (
                        <FixtureRow key={f.key} fixture={f} name={name} competition={competition}
                          onOpenTie={() => onSelectTie(f.tie.id)}
                          onCreateTie={() => onCreateTie({
                            phase: 'girone', leg: f.leg,
                            opponentTeamId: f.a === competition.myTeamId ? f.b : f.a,
                          })}
                          onResult={() => setResultKey(f.key)} />
                      ))}
                    </div>
                  </div>
                )
              })}
              {!competition.myTeamId && (
                <p className="text-xs" style={{ color: 'var(--color-amber-light)' }}>
                  Nessuna squadra è indicata come tua: modifica la competizione per sceglierla.
                </p>
              )}
            </div>

            {hasFinals && (
              <div className="mt-6">
                <SectionTitle>Fase finale</SectionTitle>
                {myRow?.qualification === 'in' && standings.complete && !run && (
                  <p className="text-xs mb-3" style={{ color: 'var(--color-teal)' }}>
                    Sei tra le qualificate: crea lo scontro del primo turno quando conosci avversaria e data.
                  </p>
                )}
                {run && (
                  <TournamentLadder
                    run={run}
                    renderItem={item => <TieStepCard item={item} onClick={() => onSelectTie(item.tie.id)} />}
                  />
                )}
                <button
                  onClick={() => onCreateTie({ phase: 'finale' })}
                  className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px solid var(--color-teal-dark)' }}>
                  ＋ Scontro di fase finale
                </button>
              </div>
            )}

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
                🗑️ Elimina competizione
              </button>
            </div>
          </>}

          {mode === 'confirmDelete' && (
            <div className="pt-2 rounded-2xl p-4" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-sm mb-4 wrap-anywhere" style={{ color: 'var(--color-white)' }}>
                Eliminare «{competition.name}»? Anche i risultati delle altre squadre vanno persi. L'azione non può essere annullata.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('view')}
                        className="py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Annulla
                </button>
                <button
                  onClick={async () => { setBusy(true); await onDelete(); setBusy(false) }}
                  disabled={busy}
                  className="py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--color-loss)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
                  Elimina
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {resultFixture && (
        <TeamResultModal
          competition={competition}
          fixture={resultFixture}
          existing={resultFixture.decided ? resultFixture : null}
          onClose={() => setResultKey(null)}
          onSave={entry => onSetResult(entry)}
          onClear={(a, b, leg) => onClearResult(a, b, leg)}
        />
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider"
         style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
        {children}
      </p>
      <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
    </div>
  )
}

// Una riga del calendario. Miei: «Crea scontro» o, se esiste, la riga si apre
// sullo scontro (risultato e stato ricavati). Altri: il risultato inserito (tap
// per correggerlo) oppure «Segna risultato».
function FixtureRow({ fixture: f, name, competition, onOpenTie, onCreateTie, onResult }) {
  const title = f.mine
    ? `Tu vs ${name(f.a === competition.myTeamId ? f.b : f.a)}`
    : `${name(f.a)} – ${name(f.b)}`

  if (f.mine && f.tie) {
    const meta = tieStatusMeta(f.info.status)
    return (
      <button onClick={onOpenTie}
              className="w-full text-left rounded-xl px-3 py-2 flex flex-col items-stretch gap-0.5 transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-surface-2)', borderLeft: '3px solid var(--color-teal)' }}>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 basis-32 text-sm font-semibold wrap-anywhere"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: meta.bg, color: meta.color, fontFamily: 'var(--font-display)' }}>{meta.label}</span>
        </div>
        <p className="text-xs wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {resultText(f.info.result)} · {tieContext(f.tie, competition)} · {formatDate(f.tie.date)}
        </p>
      </button>
    )
  }

  if (f.mine) {
    return (
      <div className="rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
           style={{ background: 'var(--color-surface-2)', borderLeft: '3px solid var(--color-amber)' }}>
        <p className="min-w-0 flex-1 basis-32 text-sm font-semibold wrap-anywhere"
           style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
        <button onClick={onCreateTie}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
          Crea scontro
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
         style={{ background: 'var(--color-surface-2)' }}>
      <p className="min-w-0 flex-1 basis-32 text-sm wrap-anywhere"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
      {f.decided ? (
        <button onClick={onResult}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full tabular-nums"
                style={{ background: 'var(--color-surface)', color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
          {f.scoreA}-{f.scoreB} ✏️
        </button>
      ) : (
        <button onClick={onResult}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'var(--color-surface)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)', border: '1px dashed var(--color-teal-dark)' }}>
          Segna risultato
        </button>
      )}
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
