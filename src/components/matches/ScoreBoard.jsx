import { MATCH_FORMATS, setKind, setWinner, isTiebreakSet, hasScore } from '../../lib/tennis'

// Punteggio stile tennis: due righe (io / avversario), un valore per set.
// Il vincitore di ogni set ha il numero più acceso; i punti del tie-break
// compaiono ad apice. `size`: 'sm' (riga lista) | 'md' (dettaglio).
export default function ScoreBoard({ sets, format, retired, opponentName, size = 'sm' }) {
  const fmt = MATCH_FORMATS[format]
  if (!fmt) return null

  const played = (sets || []).filter(hasScore)
  const cells = played.map((s, i) => ({
    set: s,
    kind: setKind(fmt, i),
    winner: setWinner(s, setKind(fmt, i), fmt),
  }))

  const nameCls = size === 'md' ? 'text-sm' : 'text-xs'
  const scoreCls = size === 'md' ? 'text-lg' : 'text-sm'
  const nameW = size === 'md' ? '5.5rem' : '3.75rem'

  return (
    <div className="flex flex-col gap-1">
      <PlayerRow
        name="Tu"
        cells={cells}
        who="me"
        retired={retired === 'me'}
        nameCls={nameCls} scoreCls={scoreCls} nameW={nameW}
      />
      <PlayerRow
        name={opponentName || 'Avversario'}
        cells={cells}
        who="opp"
        retired={retired === 'opp'}
        nameCls={nameCls} scoreCls={scoreCls} nameW={nameW}
      />
    </div>
  )
}

function PlayerRow({ name, cells, who, retired, nameCls, scoreCls, nameW }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`${nameCls} font-semibold truncate`}
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)', width: nameW }}>
        {name}
      </span>
      <div className="flex items-center gap-2">
        {cells.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--color-slate)' }}>—</span>
        )}
        {cells.map((c, i) => {
          const games = who === 'me' ? c.set.me : c.set.opp
          const isWinner = c.winner === who
          const tb = tbSuperscript(c, who)
          return (
            <span key={i} className={`${scoreCls} font-bold tabular-nums leading-none`}
                  style={{ color: isWinner ? 'var(--color-white)' : 'var(--color-slate)',
                           fontFamily: 'var(--font-mono)' }}>
              {games}{tb != null && <sup className="text-[0.6em] font-semibold ml-0.5">{tb}</sup>}
            </span>
          )
        })}
        {retired && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-loss-bg)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)' }}>
            RIT.
          </span>
        )}
      </div>
    </div>
  )
}

// Punti tie-break da mostrare ad apice: solo nei set normali finiti al tie-break
// (7-6) e con i punti registrati. Nei super tie-break i punti sono già il valore
// principale del "set", quindi niente apice.
function tbSuperscript(cell, who) {
  if (cell.kind === 'superTb') return null
  if (!isTiebreakSet(cell.set)) return null
  const tb = who === 'me' ? cell.set.tbMe : cell.set.tbOpp
  return tb == null ? null : tb
}
