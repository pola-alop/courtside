import { Card, BarRow, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { MIN_BRIDGE, formatPct } from '../../lib/stats'

// Blocco 5 — il ponte allenamenti → partite.
//
// È l'unica domanda a cui nessun'altra sezione può rispondere, ed è il vero
// motivo per cui vale la pena registrare gli allenamenti: il lavoro svolto si
// vede in campo? Due tagli complementari — quanto hai lavorato nelle due
// settimane precedenti, e con quanto stacco arrivi alla partita.
//
// Va letto come correlazione, non come causa: nei periodi in cui ti alleni di
// più stai anche meglio fisicamente e giochi con più continuità, e la pagina lo
// dice invece di lasciarlo intendere.
export default function BridgeBlock({ report, onDrill }) {
  const { bridge, core } = report
  const info = <InfoButton title="L'allenamento si vede in campo?"><BridgeInfo /></InfoButton>

  if (!bridge.available) {
    return (
      <Card id="ponte" title="L'allenamento si vede in campo?" titleExtra={info} sub="Rendimento in funzione del lavoro svolto prima">
        <NotEnough need={bridge.missing} unit="allenamenti registrati"
                   what="Per collegare allenamenti e partite" />
      </Card>
    )
  }

  const usable = [...bridge.prep, ...bridge.rest].filter(b => b.enough).length

  return (
    <Card id="ponte" title="L'allenamento si vede in campo?" titleExtra={info} sub="Rendimento in funzione del lavoro svolto prima">
      <Group title="Sessioni nei 14 giorni precedenti" rows={bridge.prep} overall={core.gameWinRate} onDrill={onDrill} />
      <div className="mt-4">
        <Group title="Giorni di stacco dall'ultima attività" rows={bridge.rest} overall={core.gameWinRate} onDrill={onDrill} />
      </div>

      {usable < 2 && (
        <Note>
          Nessun confronto è ancora leggibile: servono almeno {MIN_BRIDGE} partite in due
          gruppi diversi perché la differenza significhi qualcosa.
        </Note>
      )}

      <Note>
        Le partite contano come carico quanto gli allenamenti: due match in una
        settimana non sono riposo. Questo blocco descrive una correlazione — nei
        periodi in cui ti alleni di più stai anche meglio fisicamente e giochi con più
        continuità — quindi va usato per formulare un'ipotesi, non per concludere.
      </Note>
    </Card>
  )
}

function BridgeInfo() {
  return (
    <>
      <InfoItem>
        Confronta il tuo rendimento in partita (percentuale di game vinti) in base a quanto ti sei
        allenato prima di scendere in campo.
      </InfoItem>
      <InfoItem title="Sessioni nei 14 giorni precedenti">
        Le partite sono raggruppate in base a quanti allenamenti hai fatto nei 14 giorni prima, per
        vedere se allenarsi di più (o di meno) è associato a un rendimento diverso.
      </InfoItem>
      <InfoItem title="Giorni di stacco dall'ultima attività">
        Le partite sono raggruppate in base a quanti giorni sono passati dall'ultima sessione
        (allenamento o partita) prima di scendere in campo, per vedere se arrivare "fresco" o
        "fermo da tempo" fa la differenza.
      </InfoItem>
      <InfoItem>
        Ogni riga mostra la percentuale di game vinti in quel gruppo, con sotto quante partite e il
        record V-S. È un confronto tra gruppi (una correlazione), non la prova che allenarsi di più
        causi il risultato: chi si allena di più magari sta anche meglio fisicamente o gioca con
        più continuità per altri motivi.
      </InfoItem>
    </>
  )
}

// ── Componenti interni ─────────────────────────────────────

function Group({ title, rows, overall, onDrill }) {
  const populated = rows.filter(r => r.n > 0)
  if (populated.length === 0) return null

  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        {title}
      </p>
      <div className="space-y-3">
        {populated.map(row => (
          <BarRow key={row.key}
                  label={row.label}
                  value={formatPct(row.rate)}
                  rate={row.rate}
                  tick={overall ?? undefined}
                  dim={!row.enough}
                  color={overall != null && row.rate != null && row.rate >= overall
                    ? 'var(--color-win)' : 'var(--color-loss)'}
                  sub={`${row.n} ${row.n === 1 ? 'partita' : 'partite'} · ${row.wins}V · ${row.losses}S`}
                  onClick={() => onDrill(row.label, row.matches, title)} />
        ))}
      </div>
    </div>
  )
}
