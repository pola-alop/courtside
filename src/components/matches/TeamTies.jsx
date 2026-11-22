import TeamTieCard from './TeamTieCard'
import { describeTie, sortTies } from '../../lib/teamTies'

// Sezione «A squadre» del tab Tornei: gli scontri dal più recente, con il
// tasto per crearne uno. Presentazionale: la pagina passa scontri e partite e
// gestisce i modali. Il risultato di ogni card si ricava dagli incontri
// (`describeTie`), non è mai salvato.
export default function TeamTies({ ties = [], matches = [], onSelect, onAdd }) {
  const sorted = sortTies(ties)

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          A squadre
        </p>
        <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
        <button onClick={onAdd}
                className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          ＋ Scontro
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            Nessuno scontro a squadre. Crealo con «＋ Scontro»: poi collegherai le tue partite
            ai suoi incontri e segnerai l'esito di quelli dei compagni.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(tie => (
            <TeamTieCard key={tie.id} tie={tie} info={describeTie(tie, matches)} onClick={() => onSelect(tie.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
