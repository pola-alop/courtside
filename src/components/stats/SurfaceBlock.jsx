import { Card, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { surfaceIcon } from '../../lib/tennis'
import { formatDuration, formatHoursValue } from '../../lib/activity'

// Blocco 7 — coerenza tra la superficie su cui ti alleni e quella su cui giochi.
//
// "Ti alleni per l'82% sulla terra e giochi il 60% delle partite sul cemento" è
// un alert vero, non una curiosità: rimbalzo, scivolata e tempo di preparazione
// sono diversi, e buona parte di quello che si costruisce in allenamento su una
// superficie non si trasferisce sull'altra.
//
// Due serie (allenamento / partita) con due tinte ben separate, e ogni riga ha
// comunque la sua etichetta: la superficie non è mai affidata al solo colore.
const TRAINING_COLOR = 'var(--color-teal-dark)'
const MATCH_COLOR    = 'var(--color-amber)'

export default function SurfaceBlock({ report }) {
  const s = report.surfaces
  const info = <InfoButton title="Ti alleni dove giochi?"><SurfaceInfo /></InfoButton>

  if (!s.rows.length) return null

  return (
    <Card id="superfici" title="Coerenza superficie" sub="Ti alleni dove giochi?" titleExtra={info}>

      {!s.comparable ? (
        <NotEnough
          need={Math.ceil(Math.max(s.missingTraining, s.missingMatch) / 60)}
          unit={s.missingTraining >= s.missingMatch ? 'ore di allenamento' : 'ore di partita'}
          what="Per confrontare le due distribuzioni" />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            <Legend color={TRAINING_COLOR} label={`Allenamento ${formatHoursValue(s.trainingMinutes)} h`} />
            <Legend color={MATCH_COLOR} label={`Partite ${formatHoursValue(s.matchMinutes, s.estimated)} h`} />
          </div>

          <div className="space-y-3">
            {s.rows.map(row => <SurfaceRow key={row.key} row={row} />)}
          </div>

          {s.worst && s.worst.gap != null && Math.abs(s.worst.gap) >= 0.15 && (
            <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--color-white)' }}>
              {s.worst.gap > 0
                ? `Giochi il ${pct(s.worst.matchShare)} delle partite su ${s.worst.key} ma ci fai solo il ${pct(s.worst.trainingShare)} degli allenamenti: la superficie che conta è quella che prepari di meno.`
                : `Ti alleni per il ${pct(s.worst.trainingShare)} su ${s.worst.key} ma ci giochi solo il ${pct(s.worst.matchShare)} delle partite: buona parte del lavoro va trasferita su un'altra superficie.`}
            </p>
          )}
        </>
      )}

      <Note>
        Le quote sono pesate sui <strong>minuti</strong>, non sul numero di sessioni: mezz'ora sul
        cemento non vale quanto due ore sulla terra.
        {s.unknownMinutes > 0 && ` ${formatDuration(s.unknownMinutes)} sono su sessioni senza superficie indicata e restano fuori dal calcolo.`}
        {' '}Il confronto ha senso solo se entrambi i lati hanno abbastanza minuti: con due partite
        registrate la loro distribuzione è un aneddoto, non una distribuzione.
      </Note>
    </Card>
  )
}

// Due barre affiancate per superficie invece di due grafici separati: il
// confronto è tra la coppia, e metterle a due centimetri di distanza
// costringerebbe a tenerne una a memoria.
function SurfaceRow({ row }) {
  const gapPoints = row.gap != null ? Math.round(row.gap * 100) : null
  const notable = gapPoints != null && Math.abs(gapPoints) >= 15

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {surfaceIcon(row.key)} {cap(row.key)}
        </span>
        {notable && (
          <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'var(--color-loss-bg)', color: 'var(--color-loss)',
                  fontFamily: 'var(--font-mono)',
                }}>
            {gapPoints > 0 ? '+' : ''}{gapPoints}
          </span>
        )}
      </div>

      <Track label="All." share={row.trainingShare} color={TRAINING_COLOR} minutes={row.trainingMinutes} />
      <Track label="Part." share={row.matchShare} color={MATCH_COLOR} minutes={row.matchMinutes} />
    </div>
  )
}

function Track({ label, share, color, minutes }) {
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-[8px] w-7 shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      <div className="h-1.5 rounded-full flex-1" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${Math.max(0, Math.min(1, share ?? 0)) * 100}%`, background: color }} />
      </div>
      <span className="text-[9px] w-14 text-right shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {share == null ? '—' : `${Math.round(share * 100)}%`}
        <span style={{ color: 'var(--color-slate)' }}> · {formatDuration(minutes)}</span>
      </span>
    </div>
  )
}

function SurfaceInfo() {
  return (
    <>
      <InfoItem>
        Confronta su quali superfici ti <em>alleni</em> con quelle su cui <em>giochi</em> le
        partite. Non è una curiosità: rimbalzo, scivolata e tempo che hai per preparare il colpo
        cambiano davvero, e una parte di quello che costruisci su una superficie non si trasferisce
        sull'altra.
      </InfoItem>
      <InfoItem title="Le due barre di ogni superficie">
        <strong>All.</strong> è la quota dei tuoi minuti di allenamento su quella superficie,
        <strong> Part.</strong> la quota dei minuti di partita. Sono due percentuali su due totali
        diversi (il 100% degli allenamenti e il 100% delle partite), quindi si leggono l'una contro
        l'altra: se sono simili sei coerente, se sono lontane no.
      </InfoItem>
      <InfoItem title="Il badge rosso (+22 / -18)">
        La distanza in punti percentuali tra le due quote, mostrata quando supera i 15 punti.
        Positivo: giochi lì più di quanto ti alleni. Negativo: ti alleni lì più di quanto giochi. Un
        badge grosso non è un errore da correggere per forza — spesso il circolo ha solo campi in
        terra e i tornei sono al coperto — ma è la spiegazione più semplice di un rendimento che
        cala su una superficie specifica (che trovi negli split di Rendimento).
      </InfoItem>
      <InfoItem title="Pesate sui minuti">
        Le quote contano i minuti, non le sessioni: mezz'ora di servizi sul cemento non vale quanto
        due ore di lezione sulla terra. Le sessioni per cui non hai indicato la superficie restano
        fuori dal calcolo invece di finire in un gruppo «altro» che non significherebbe niente.
      </InfoItem>
      <InfoItem>
        Il blocco compare solo quando entrambi i lati hanno abbastanza minuti registrati: la
        distribuzione delle superfici calcolata su due partite non è una distribuzione.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>{label}</span>
    </span>
  )
}

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
