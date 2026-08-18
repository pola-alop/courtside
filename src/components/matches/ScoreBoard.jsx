import { MATCH_FORMATS, setKind, setWinner, isTiebreakSet, hasScore } from '../../lib/tennis'

// Punteggio stile tennis: due righe (io / avversario), un valore per set.
// Il vincitore di ogni set ha il numero più acceso; i punti del tie-break
// compaiono ad apice. `size`: 'sm' (riga lista) | 'md' (dettaglio).
// In entrambe le taglie il nome avversario è compattato in "Cognome N." quando
// ha più parole. La colonna nome NON ha più una larghezza fissa: le due righe
// (io/avversario) sono celle di un'unica griglia CSS, quindi la colonna si
// allarga a `max-content` in base al nome più lungo tra le due, restando
// allineata al punteggio senza mai troncare il cognome con "…" (bug: un nome
// di una sola parola più lungo della larghezza fissa veniva tagliato anche se
// non c'era nessun cognome da compattare). Il nome per esteso resta comunque
// disponibile via `title` quando viene compattato.
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
  const fullOpponentName = opponentName || 'Avversario'
  const opponentDisplay = compactName(fullOpponentName)
  const colCount = Math.max(cells.length, 1)

  return (
    <div className="grid gap-x-3 gap-y-1 items-center"
         style={{ gridTemplateColumns: `max-content repeat(${colCount}, max-content) max-content` }}>
      <PlayerRow
        row={1}
        name="Tu"
        cells={cells}
        who="me"
        retired={retired === 'me'}
        nameCls={nameCls} scoreCls={scoreCls}
      />
      <PlayerRow
        row={2}
        name={opponentDisplay}
        title={opponentDisplay !== fullOpponentName ? fullOpponentName : undefined}
        cells={cells}
        who="opp"
        retired={retired === 'opp'}
        nameCls={nameCls} scoreCls={scoreCls}
      />
    </div>
  )
}

function PlayerRow({ row, name, title, cells, who, retired, nameCls, scoreCls }) {
  return (
    <>
      <span className={`${nameCls} font-semibold`}
            title={title}
            style={{ gridRow: row, gridColumn: 1, color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {name}
      </span>
      {cells.length === 0 && (
        <span className="text-xs" style={{ gridRow: row, gridColumn: 2, color: 'var(--color-slate)' }}>—</span>
      )}
      {cells.map((c, i) => {
        const games = who === 'me' ? c.set.me : c.set.opp
        const isWinner = c.winner === who
        const tb = tbSuperscript(c, who)
        return (
          <span key={i} className={`${scoreCls} font-bold tabular-nums leading-none`}
                style={{ gridRow: row, gridColumn: i + 2,
                         color: isWinner ? 'var(--color-white)' : 'var(--color-slate)',
                         fontFamily: 'var(--font-mono)' }}>
            {games}{tb != null && <sup className="text-[0.6em] font-semibold ml-0.5">{tb}</sup>}
          </span>
        )
      })}
      {retired && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded justify-self-start"
              style={{ gridRow: row, gridColumn: cells.length + 2,
                       background: 'var(--color-loss-bg)', color: 'var(--color-loss)', fontFamily: 'var(--font-display)' }}>
          RIT.
        </span>
      )}
    </>
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

// "Nome Cognome" → "Cognome N." (stesso ordine nome/cognome atteso da
// getInitials in OpponentCard.jsx). Nomi di una sola parola restano invariati.
function compactName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name || 'Avversario'
  const surname = parts[parts.length - 1]
  const firstInitial = parts[0][0].toUpperCase()
  return `${surname} ${firstInitial}.`
}
