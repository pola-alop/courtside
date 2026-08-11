import { useState } from 'react'
import { Card, Tile, BarRow, Note, InfoButton, InfoItem } from './StatsUI'
import { MIN_OPPONENT, formatPct } from '../../lib/stats'
import { hasScore } from '../../lib/tennis'

const VISIBLE_ROWS = 5

// Blocco 4 — contro chi.
//
// L'H2H è ordinato per partite giocate e mostra il GW% accanto al record: due
// giocatori che ti battono entrambi 3-0 non sono lo stesso avversario se contro
// uno vinci il 48% dei game e contro l'altro il 30%.
//
// La varietà non è un dettaglio statistico ma un avvertimento sulla lettura di
// tutta la sezione: se il grosso delle partite è contro due o tre persone, ogni
// media della pagina descrive quei confronti più che il tuo livello.
export default function OpponentsBlock({ report, onDrill }) {
  const [expanded, setExpanded] = useState(false)
  const { rows, distinct, top3Share, nemesis, favourite } = report.opponents
  const { notable } = report

  if (rows.length === 0) return null

  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS)

  return (
    <Card id="avversari" title="Avversari" sub="Testa a testa, con i game oltre al record"
          titleExtra={<InfoButton title="Avversari"><OpponentsInfo /></InfoButton>}>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Avversari" value={String(distinct)} sub="affrontati" />
        <Tile label="Top 3" value={formatPct(top3Share)} sub="delle partite" />
        <Tile label="Media" value={(report.core.n / Math.max(1, distinct)).toLocaleString('it-IT', { maximumFractionDigits: 1 })} sub="partite a testa" />
      </div>

      <div className="space-y-3 mt-4">
        {shown.map(row => (
          <BarRow key={row.id}
                  label={row.name}
                  value={formatPct(row.rate)}
                  rate={row.rate} tick={0.5}
                  dim={!row.enough}
                  color={(row.winRate ?? 0) >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)'}
                  sub={`${row.wins}V${row.draws ? ` · ${row.draws}P` : ''} · ${row.losses}S su ${row.n}`}
                  onClick={() => onDrill(row.name, row.matches, 'Testa a testa')} />
        ))}
      </div>

      {rows.length > VISIBLE_ROWS && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-2 mt-1 text-[10px] font-medium transition-all"
          style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {expanded ? 'Mostra meno' : `Mostra tutti (${rows.length})`}
        </button>
      )}

      {(nemesis || favourite) && (
        <div className="flex gap-2 mt-3">
          {nemesis && <Highlight icon="😤" label="Nemesi" name={nemesis.name}
                                 detail={`${nemesis.losses}S su ${nemesis.n}`} color="var(--color-loss)"
                                 onClick={() => onDrill(nemesis.name, nemesis.matches, 'Testa a testa')} />}
          {favourite && <Highlight icon="😌" label="Cliente" name={favourite.name}
                                   detail={`${favourite.wins}V su ${favourite.n}`} color="var(--color-win)"
                                   onClick={() => onDrill(favourite.name, favourite.matches, 'Testa a testa')} />}
        </div>
      )}

      {(notable.bestWin || notable.worstLoss) && (
        <div className="mt-4 space-y-2">
          <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
            Punteggi notevoli
          </p>
          {notable.bestWin && <ScorelineRow entry={notable.bestWin} label="Vittoria più netta" color="var(--color-win)" onDrill={onDrill} />}
          {notable.tightestWin && notable.tightestWin.match.id !== notable.bestWin?.match.id && (
            <ScorelineRow entry={notable.tightestWin} label="Vittoria più sofferta" color="var(--color-amber)" onDrill={onDrill} />
          )}
          {notable.worstLoss && <ScorelineRow entry={notable.worstLoss} label="Sconfitta più pesante" color="var(--color-loss)" onDrill={onDrill} />}
        </div>
      )}

      <Note>
        Il "miglior risultato" è misurato con il margine in game e non con la forza
        dell'avversario: il livello nell'anagrafica è un campo libero, e pesarci sopra
        una classifica darebbe una precisione che il dato non ha. Le righe con meno di{' '}
        {MIN_OPPONENT} partite sono in trasparenza.
      </Note>
    </Card>
  )
}

function OpponentsInfo() {
  return (
    <>
      <InfoItem title="Avversari">
        Il numero di persone distinte contro cui hai giocato nel periodo.
      </InfoItem>
      <InfoItem title="Top 3">
        La quota di tutte le tue partite giocata contro le 3 persone che affronti più spesso. Se è
        molto alta, gran parte delle statistiche di questa pagina descrive soprattutto quei 2-3
        confronti, non il tuo livello generale.
      </InfoItem>
      <InfoItem title="Media">
        Quante partite hai giocato in media contro ogni singolo avversario.
      </InfoItem>
      <InfoItem title="Le righe testa a testa">
        Per ogni avversario, la percentuale di game vinti contro di lui/lei (non solo chi ha vinto
        la partita) e sotto il record V-P-S su quante partite. Tocca la riga per vedere le partite.
      </InfoItem>
      <InfoItem title="😤 Nemesi / 😌 Cliente">
        L'avversario contro cui perdi di più (Nemesi) e quello contro cui vinci di più (Cliente),
        tra quelli con abbastanza partite giocate.
      </InfoItem>
      <InfoItem title="Punteggi notevoli">
        Le partite con il margine di game più ampio in vittoria (Vittoria più netta) o in sconfitta
        (Sconfitta più pesante), più la vittoria conquistata con il margine più risicato (Vittoria
        più sofferta).
      </InfoItem>
      <InfoItem>
        Non essendoci un ranking di forza degli avversari nell'app, questi primati si basano solo
        sul punteggio (il margine in game), non su quanto fosse forte chi avevi di fronte.
      </InfoItem>
    </>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Highlight({ icon, label, name, detail, color, onClick }) {
  return (
    <button onClick={onClick}
            className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.98]"
            style={{ background: 'var(--color-surface-2)' }}>
      <span className="text-[9px] uppercase tracking-wide block" style={{ color: 'var(--color-slate)' }}>
        {icon} {label}
      </span>
      <span className="text-xs font-semibold block truncate mt-0.5"
            style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {name}
      </span>
      <span className="text-[10px] block" style={{ color, fontFamily: 'var(--font-mono)' }}>{detail}</span>
    </button>
  )
}

function ScorelineRow({ entry, label, color, onDrill }) {
  const m = entry.match
  return (
    <button onClick={() => onDrill(label, [m])}
            className="w-full flex items-center gap-2 text-left transition-all active:scale-[0.99]">
      <span className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 min-w-0">
        <span className="text-[10px] block truncate" style={{ color: 'var(--color-slate)' }}>
          {label} · {m.opponentName || 'avversario'}
        </span>
        <span className="text-[11px] block truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
          {scoreText(m)}
        </span>
      </span>
      <span className="text-[10px] shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {entry.margin > 0 ? '+' : ''}{entry.margin}
      </span>
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────

function scoreText(match) {
  const sets = (match.sets || []).filter(hasScore).map(s => `${s.me}-${s.opp}`).join(' ')
  return match.retired ? `${sets} rit.` : sets || '—'
}
