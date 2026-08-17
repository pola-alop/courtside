import TournamentCard from './TournamentCard'
import { palmares } from '../../lib/tournaments'

// Tab Tornei: il palmarès in cima, poi i cammini per anno, dal più recente.
// Presentazionale come `Overview` — i cammini arrivano già costruiti dalla
// pagina, che è la stessa che deve derivare da quella lista il torneo
// selezionato per il modale di dettaglio (pattern "selected item derivato").
export default function Tournaments({ runs = [], onSelectTournament }) {
  const p = palmares(runs)
  const groups = groupByYear(runs)

  return (
    <div className="space-y-5">

      {/* Palmarès — è di sempre, non del periodo: un titolo vinto due anni fa
          resta un titolo vinto, e questa è l'unica schermata dell'app che
          racconta una carriera invece di una forma. */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Palmarès
          </p>
          <p className="text-xs" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {p.matches} {p.matches === 1 ? 'partita' : 'partite'} · {p.wins}V–{p.losses}S
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Tile label="Tornei"  value={p.tournaments} />
          <Tile label="Titoli"  value={p.titles}     color={p.titles > 0 ? 'var(--color-amber)' : null} />
          <Tile label="Finali"  value={p.finals}     color={p.finals > 0 ? 'var(--color-amber-light)' : null} />
          <Tile label="Semi"    value={p.semifinals} color={p.semifinals > 0 ? 'var(--color-teal)' : null} />
        </div>
        {p.ongoing > 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-teal)' }}>
            ▶ {p.ongoing === 1 ? 'Un torneo è in corso' : `${p.ongoing} tornei sono in corso`}: registra il prossimo turno per completare il cammino.
          </p>
        )}
      </div>

      {groups.map(group => (
        <div key={group.year}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider"
               style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
              {group.year}
            </p>
            <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
            <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{group.runs.length}</span>
          </div>
          <div className="space-y-2">
            {group.runs.map(run => (
              <TournamentCard key={run.id} run={run} onClick={() => onSelectTournament(run.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Tile({ label, value, color }) {
  return (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-lg font-bold tabular-nums leading-none"
         style={{ color: color || 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wider mt-1"
         style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

// I cammini arrivano già ordinati dal più recente: si raggruppa preservando
// l'ordine, come `groupByMonth` fa con le partite.
function groupByYear(runs) {
  const groups = []
  const index = {}
  runs.forEach(run => {
    const d = new Date(run.endDate)
    const year = isNaN(d) ? '—' : d.getFullYear()
    if (index[year] == null) {
      index[year] = groups.length
      groups.push({ year, runs: [] })
    }
    groups[index[year]].runs.push(run)
  })
  return groups
}
