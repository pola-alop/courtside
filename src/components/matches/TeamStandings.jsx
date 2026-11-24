// La classifica di una competizione a squadre. Presentazionale: arriva già
// calcolata da `buildStandings` (la pagina e le card non ricalcolano niente).
// `compact` = la versione della card (posizione, squadra, punti); altrimenti
// quella del dettaglio, con una seconda riga per squadra (V-P-S, incontri, e
// set e game quando ci sono) e le note sugli spareggi non calcolabili.
// Nomi e righe vanno a capo: niente testo tagliato.
export default function TeamStandings({ standings, qualifiers = 0, compact = false }) {
  const { rows } = standings

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pb-1 text-[9px] uppercase tracking-wider"
           style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
        <span className="w-6 shrink-0 text-center">#</span>
        <span className="flex-1 min-w-0">Squadra</span>
        {!compact && <span className="w-6 shrink-0 text-center">G</span>}
        {!compact && <span className="w-8 shrink-0 text-center">Inc.</span>}
        <span className="w-8 shrink-0 text-center">Pt</span>
      </div>

      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.teamId} className="flex items-start gap-2 rounded-xl px-2 py-1.5"
               style={{
                 background: r.mine ? 'rgba(72,179,176,0.12)' : 'var(--color-surface-2)',
                 borderLeft: `3px solid ${qualColor(r.qualification)}`,
               }}>
            <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums pt-0.5"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
              {r.rank}{r.tied ? '=' : ''}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm wrap-anywhere"
                 style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)', fontWeight: r.mine ? 700 : 500 }}>
                {r.name}{r.mine ? ' (tu)' : ''}
              </p>
              {!compact && (
                <p className="text-[10px] mt-0.5 wrap-anywhere" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  {detailLine(r)}
                </p>
              )}
            </div>
            {!compact && (
              <span className="w-6 shrink-0 text-center text-xs tabular-nums pt-0.5"
                    style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{r.played}</span>
            )}
            {!compact && (
              <span className="w-8 shrink-0 text-center text-xs tabular-nums pt-0.5"
                    style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{signed(r.diffRubbers)}</span>
            )}
            <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums pt-0.5"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{r.points}</span>
          </div>
        ))}
      </div>

      {qualifiers > 0 && !compact && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--color-slate)' }}>
          <span className="inline-block rounded-sm" style={{ width: '0.5rem', height: '0.75rem', background: qualColor('in') }} />
          Qualificate alla fase finale: le prime {qualifiers}.
        </p>
      )}

      <StandingsNotes standings={standings} compact={compact} />
    </div>
  )
}

// Classifica parziale e spareggi non calcolabili, dichiarati. In versione
// compatta resta solo la riga sulla parzialità.
export function StandingsNotes({ standings, compact = false }) {
  const { complete, missingResults, toPlay, notes } = standings
  const lines = []
  if (missingResults > 0) {
    lines.push(`Classifica parziale: ${missingResults === 1 ? 'manca 1 risultato' : `mancano ${missingResults} risultati`} tra le altre squadre.`)
  }
  if (toPlay > 0 && !compact) {
    lines.push(toPlay === 1 ? 'Hai ancora 1 scontro da giocare.' : `Hai ancora ${toPlay} scontri da giocare.`)
  }
  if (!compact) lines.push(...notes)
  if (complete && lines.length === 0) return null
  if (lines.length === 0) return null

  return (
    <div className="mt-2 space-y-1">
      {lines.map(l => (
        <p key={l} className="text-[11px] leading-snug" style={{ color: 'var(--color-amber-light)' }}>{l}</p>
      ))}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function qualColor(q) {
  if (q === 'in') return 'var(--color-teal)'
  if (q === 'uncertain') return 'var(--color-amber)'
  return 'transparent'
}

const signed = n => (n > 0 ? `+${n}` : String(n))

// «V2 P0 S1 · set +1 · game +8»: set e game solo se li si conosce per ogni scontro.
function detailLine(r) {
  const parts = [`${r.won}V ${r.drawn}P ${r.lost}S`]
  if (r.diffSets != null && r.played > 0) parts.push(`set ${signed(r.diffSets)}`)
  if (r.diffGames != null && r.played > 0) parts.push(`game ${signed(r.diffGames)}`)
  return parts.join(' · ')
}
