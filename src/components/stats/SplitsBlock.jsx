import { useState } from 'react'
import { Card, BarRow, Note, InfoButton, InfoItem } from './StatsUI'
import { SPLIT_DIMENSIONS, MIN_SPLIT, formatPct } from '../../lib/stats'

// Blocco 3 — gli split: le stesse due metriche portanti tagliate per una
// dimensione alla volta.
//
// Sei tabelle una sotto l'altra sarebbero una pagina di numeri da leggere tutta;
// un selettore mostra una dimensione per volta e le righe sono ordinate per
// SCOSTAMENTO dalla media, non alfabeticamente — di uno split interessa dove sei
// anomalo, non l'elenco completo. La tacca sulla barra è il tuo GW% complessivo:
// è quello il riferimento, non il 50%.
export default function SplitsBlock({ report, onDrill }) {
  const available = SPLIT_DIMENSIONS.filter(d => (report.splits[d.id] || []).length >= 2)
  const [dimension, setDimension] = useState('surface')

  if (available.length === 0) return null

  const active = available.find(d => d.id === dimension) || available[0]
  const rows = report.splits[active.id] || []
  const overall = report.core.gameWinRate

  return (
    <Card id="split" title="Dove sei anomalo" sub="Game vinti % per dimensione, confrontati con la tua media"
          titleExtra={<InfoButton title="Dove sei anomalo"><SplitsInfo /></InfoButton>}>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" style={{ minWidth: 0 }}>
        {available.map(d => (
          <button key={d.id} onClick={() => setDimension(d.id)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0 transition-all"
            style={{
              background: active.id === d.id ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
              color: active.id === d.id ? 'var(--color-white)' : 'var(--color-slate)',
              fontFamily: 'var(--font-display)',
            }}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-3">
        {rows.map(row => (
          <BarRow key={row.key}
                  label={row.label}
                  value={formatPct(row.rate)}
                  rate={row.rate}
                  tick={overall ?? undefined}
                  dim={!row.enough}
                  color={row.delta == null || Math.abs(row.delta) < 0.02
                    ? 'var(--color-slate)'
                    : row.delta > 0 ? 'var(--color-win)' : 'var(--color-loss)'}
                  badge={row.enough && row.delta != null ? <DeltaBadge delta={row.delta} /> : null}
                  sub={`${row.n} ${row.n === 1 ? 'partita' : 'partite'} · ${row.wins}V${row.draws ? ` · ${row.draws}P` : ''} · ${row.losses}S`}
                  onClick={() => onDrill(row.label, row.matches, `${active.label}: ${row.label}`)} />
        ))}
      </div>

      <Note>
        La tacca chiara è il tuo rendimento medio ({formatPct(overall)}): le barre vanno
        lette rispetto a quella, non al 50%. Le righe con meno di {MIN_SPLIT} partite
        sono in trasparenza.
      </Note>
    </Card>
  )
}

function SplitsInfo() {
  return (
    <>
      <InfoItem>
        Prende la tua percentuale di game vinti e la scompone per una caratteristica alla volta
        (superficie, tipo di partita, formato, mano dell'avversario, livello, stile di gioco), per
        scoprire dove rendi meglio o peggio della tua media.
      </InfoItem>
      <InfoItem title="I pulsanti in alto">
        Scelgono quale caratteristica guardare: es. "Superficie" mostra una riga per ogni tipo di
        campo su cui hai giocato (terra, cemento, ecc.).
      </InfoItem>
      <InfoItem title="Il numero e la barra">
        La percentuale di game vinti in quel sottoinsieme di partite (es. solo quelle su terra).
        Sotto trovi quante partite e il record V-P-S. Tocca la riga per vedere le partite.
      </InfoItem>
      <InfoItem title="Il badge colorato (+3 / -5)">
        Lo scostamento in punti percentuali rispetto alla tua media generale — mostrata anche dalla
        linea verticale chiara sulla barra: verde se in quella situazione rendi meglio del solito,
        rosso se rendi peggio.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function DeltaBadge({ delta }) {
  const points = Math.round(delta * 100)
  if (points === 0) return null
  const up = points > 0
  return (
    <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full"
          style={{
            background: up ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
            color: up ? 'var(--color-win)' : 'var(--color-loss)',
            fontFamily: 'var(--font-mono)',
          }}>
      {up ? '+' : ''}{points}
    </span>
  )
}
