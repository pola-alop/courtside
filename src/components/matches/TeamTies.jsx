import TeamTieCard from './TeamTieCard'
import TeamCompetitionCard from './TeamCompetitionCard'
import { describeTie, sortTies } from '../../lib/teamTies'
import { sortCompetitions } from '../../lib/teamCompetitions'

// Sezione «A squadre» del tab Tornei: le competizioni (girone e fase finale) e,
// sotto, gli scontri singoli (senza competizione), dal più recente, ciascuna
// con il suo tasto per crearne uno. Presentazionale: la pagina passa
// competizioni, scontri e partite e gestisce i modali. Il risultato di ogni
// card si ricava dagli incontri (`describeTie`/`buildStandings`), non è mai
// salvato. `ties` sono TUTTI gli scontri: le competizioni prendono i loro, la
// lista degli scontri singoli esclude quelli di una competizione.
export default function TeamTies({
  competitions = [], ties = [], matches = [],
  onSelect, onAdd, onSelectCompetition, onAddCompetition,
}) {
  const standalone = sortTies(ties.filter(t => !t.competitionId))
  const sortedCompetitions = sortCompetitions(competitions, ties)
  const empty = standalone.length === 0 && sortedCompetitions.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          A squadre
        </p>
        <div className="flex-1 h-px min-w-4" style={{ background: 'var(--color-surface-2)' }} />
        <button onClick={onAddCompetition}
                className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          ＋ Competizione
        </button>
        <button onClick={onAdd}
                className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          ＋ Scontro
        </button>
      </div>

      {empty ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            Nessuna competizione o scontro a squadre. Una competizione ha un girone con la
            sua classifica e, se c'è, una fase finale; uno scontro singolo è un incontro a sé.
            Poi collegherai le tue partite agli incontri e segnerai l'esito di quelli dei compagni.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCompetitions.length > 0 && (
            <div className="space-y-2">
              {sortedCompetitions.map(c => (
                <TeamCompetitionCard key={c.id} competition={c} ties={ties} matches={matches}
                                     onClick={() => onSelectCompetition(c.id)} />
              ))}
            </div>
          )}

          {standalone.length > 0 && (
            <div>
              {sortedCompetitions.length > 0 && (
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
                  Scontri singoli
                </p>
              )}
              <div className="space-y-2">
                {standalone.map(tie => (
                  <TeamTieCard key={tie.id} tie={tie} info={describeTie(tie, matches)} onClick={() => onSelect(tie.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
