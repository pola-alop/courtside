import { Link } from 'react-router-dom'
import { Card, Tile, BarRow, NotEnough, SampleTag, Note, InfoButton, InfoItem, ZoneBar, WeekBars, Sparkline } from './StatsUI'
import { EconomyChart } from './MovementBlock'
import {
  MIN_RUN, MIN_PACE, MIN_SCHEME, MIN_LOAD, MIN_DYNAMICS, MIN_RECORD_KM,
} from '../../lib/runStats'
import { MIN_WEEKS } from '../../lib/activity'
import { MIN_ZONES, MIN_TE, formatKmh, formatBpm, formatDelta, formatMinutes } from '../../lib/physical'
import { HR_ZONES, formatDuration, formatTrainingEffect, trainingEffectLabel } from '../../lib/athletics'
import { formatPace } from '../../lib/running'

// Sezione "Corsa" — risponde a "quanto e come corro, e sto migliorando?".
//
// L'unità qui è il CHILOMETRO (e il minuto), e tutto nasce da `run.athletics`:
// la scheda dice cosa avevi in programma, l'orologio cosa hai fatto, e una
// statistica descrive solo il secondo. Niente è stimato. I blocchi vanno da
// quanto a come sta cambiando:
//   0. Copertura          — su quante corse stiamo davvero ragionando
//   1. Volume             — corse, km, tempo, dislivello e come varia
//   2. Costanza           — settimane attive, striscia, buchi
//   3. Passo              — le corse continue e «la stessa scheda nel tempo»
//   4. Efficienza cardiaca — la FC a parità di velocità
//   5. Intensità          — quanto del tempo è facile e quanto duro
//   6. Stimolo e carico   — training effect e carico Garmin
//   7. Dinamiche          — potenza, cadenza, passo, oscillazione, contatto
//   8. Record             — sull'intero storico
//
// ── Continue contro ripetute ──
// Il passo medio di una corsa a ripetute non è confrontabile con quello di una
// continua. Il trend del passo e l'efficienza guardano solo le continue; per le
// altre c'è il confronto con se stesse (la stessa scheda).
//
// ── Niente drill-down ──
// Come Attività, Tecnica, Fisico e Palestra: l'elenco delle corse esiste già nel
// tab Allenamenti. Fanno eccezione i record, che portano alla corsa che li ha
// stabiliti (`/matches?run=<id>`).

export default function Corsa({ report, periodLabel }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} unit="corse" what="Per analizzare la corsa" />
        <Note>
          {report.total > report.n
            ? <>Hai {report.total} corse in tutto ma solo {report.n} nel periodo scelto. </>
            : null}
          Servono almeno {MIN_RUN} corse perché un numero significhi qualcosa. Si registrano da
          Matches › Allenamenti › + Allenamento › Corsa, e importando il file .FIT dell'orologio i
          dati arrivano da soli.
        </Note>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CoverageCard report={report} />
      <VolumeCard report={report} periodLabel={periodLabel} />
      <ConsistencyCard report={report} />
      <PaceCard report={report} />
      <EconomyCard report={report} />
      <IntensityCard report={report} />
      <LoadCard report={report} />
      <DynamicsCard report={report} />
      <RecordsCard report={report} />

      <Note>
        Tutto qui nasce dai dati dell'orologio delle tue corse, e nulla è stimato: la durata di una
        scheda è un'ipotesi, e un passo ricavato da quella mostrerebbe un «progresso» che è solo la
        tabella zone del Profilo. Le corse senza dati contano per le sessioni e la costanza, non per
        i numeri che li richiedono: ogni blocco dichiara su quante corse è calcolato.
      </Note>
    </div>
  )
}

// ── Blocco 0 — Copertura ───────────────────────────────────

function CoverageCard({ report }) {
  const c = report.coverage
  const info = (
    <InfoButton title="Cos'è la copertura?">
      <InfoItem>
        Quante delle corse del periodo hanno i dati dell'orologio. Tutti i blocchi sotto sono
        calcolati <strong>solo</strong> su quelle, e ognuno dichiara il proprio «su quante».
      </InfoItem>
      <InfoItem title="Dal file e a mano">
        Una corsa importata dal file .FIT ha tutti i campi, misurati. Una trascritta a mano ne ha
        solo alcuni, e i campi avanzati (zone, carico Garmin, dinamiche) non ci sono mai.
      </InfoItem>
      <InfoItem title="Campi compilati">
        Ogni campo apre blocchi diversi: distanza e durata il passo, la FC media l'efficienza, le
        zone l'intensità, il training effect lo stimolo, le dinamiche il blocco omonimo.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="copertura-corsa" title="Copertura dei dati" titleExtra={info}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none"
             style={{ color: coverageColor(c.share), fontFamily: 'var(--font-display)' }}>
            {c.n}<span className="text-lg" style={{ color: 'var(--color-slate)' }}>/{c.total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Corse con dati dell'orologio
          </p>
        </div>
        <p className="text-lg font-bold shrink-0"
           style={{ color: coverageColor(c.share), fontFamily: 'var(--font-display)' }}>
          {Math.round((c.share ?? 0) * 100)}%
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="Dal file .FIT" value={c.measured} color="var(--color-teal)" />
        <Tile label="A mano" value={c.manual} color="var(--color-amber)" />
        <Tile label="Senza dati" value={c.none} color="var(--color-slate)" />
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
          Campi compilati · sulle {c.n} corse con dati
        </p>
        <div className="space-y-2">
          {c.fields.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="text-[10px] w-24 shrink-0 truncate"
                    style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {f.label}
              </span>
              <span className="flex-1 h-1.5 rounded-full min-w-0" style={{ background: 'var(--color-surface-2)' }}>
                <span className="block h-full rounded-full"
                      style={{ width: `${(f.share ?? 0) * 100}%`, background: fieldColor(f.share) }} />
              </span>
              <span className="text-[10px] shrink-0 w-14 text-right"
                    style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {f.n}/{c.n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── Blocco 1 — Volume ──────────────────────────────────────

function VolumeCard({ report, periodLabel }) {
  const v = report.volume
  const info = (
    <InfoButton title="Come si legge il volume">
      <InfoItem>
        Le corse del periodo, i chilometri e il tempo che hai corso. Sono sommati solo sulle corse
        che hanno quel dato (distanza o durata dell'orologio): «su quante» sta sotto ogni numero.
      </InfoItem>
      <InfoItem title="A settimana">
        Chilometri divisi per le settimane del periodo, contate dalla tua prima corsa in poi: chi
        ha iniziato da tre settimane non deve vedersi diluire la media da nove settimane di nulla.
      </InfoItem>
      <InfoItem title="Il confronto">
        Il delta si fa contro un periodo precedente della stessa ampiezza, e compare solo se anche
        quello ha almeno qualche corsa.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="volume-corsa" title="Volume" titleExtra={info}
          sub={periodLabel ? `Periodo: ${periodLabel.toLowerCase()}` : undefined}
          right={<SampleTag n={v.sessions} unit={v.sessions === 1 ? 'corsa' : 'corse'} />}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Corse" value={v.sessions} sub={`${fmt(v.perWeek)}/sett.`} />
        <Tile label="Km" value={v.kmN ? fmt(v.km) : '—'} sub={v.kmN ? `su ${v.kmN}` : undefined} color="var(--color-draw)" />
        <Tile label="Tempo" value={v.timeN ? formatMinutes(v.sec / 60) : '—'} sub={v.timeN ? `su ${v.timeN}` : undefined} />
        <Tile label="Km a sett." value={v.kmPerWeek != null ? fmt(v.kmPerWeek) : '—'} />
      </div>

      {v.ascentN > 0 && (
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-slate)' }}>
          Dislivello positivo: <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{Math.round(v.ascent)} m</span>
          {' '}su {v.ascentN} {v.ascentN === 1 ? 'corsa' : 'corse'}
          {v.kmPerRun != null && <> · media {fmt(v.kmPerRun)} km a corsa</>}
        </p>
      )}

      {v.deltaKm != null && (
        <p className="text-[11px] mt-2" style={{ color: v.deltaKm >= 0 ? 'var(--color-win)' : 'var(--color-amber)' }}>
          {v.deltaKm >= 0 ? '▲' : '▼'} {Math.abs(Math.round(v.deltaKm * 100))}% di chilometri rispetto al periodo precedente
          <span style={{ color: 'var(--color-slate)' }}> ({fmt(v.prevKm)} km)</span>
        </p>
      )}

      {v.weekly.length > 1 && v.kmN > 0 && (
        <WeekBars title="Km a settimana" weeks={v.weekly} value={w => w.km} format={n => `${fmt(n)} km`} />
      )}
    </Card>
  )
}

// ── Blocco 2 — Costanza ────────────────────────────────────

function ConsistencyCard({ report }) {
  const c = report.consistency
  const info = (
    <InfoButton title="Come si legge la costanza">
      <InfoItem title="Settimane attive">
        Su quante settimane del periodo hai corso almeno una volta. Le due settimane parziali agli
        estremi non contano: non sono settimane in cui non hai corso, sono settimane in cui non
        c'era il tempo.
      </InfoItem>
      <InfoItem title="Striscia e ultima corsa">
        Sono fatti del presente: si calcolano su tutto lo storico rispetto a oggi, qualunque
        periodo tu abbia scelto. Una settimana in corso ancora vuota non interrompe la striscia.
      </InfoItem>
      <InfoItem title="Buco più lungo">
        I giorni consecutivi senza correre tra due corse del periodo. Gli estremi del periodo non
        contano come buchi.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="costanza-corsa" title="Costanza" titleExtra={info}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Settimane attive" value={c.enoughWeeks ? `${c.activeWeeks}/${c.weeks}` : '—'}
              sub={c.enoughWeeks && c.activeShare != null ? `${Math.round(c.activeShare * 100)}%` : `servono ${MIN_WEEKS}`}
              color={c.enoughWeeks ? 'var(--color-teal)' : 'var(--color-slate)'} />
        <Tile label="Striscia" value={c.streakWeeks} sub="settimane" />
        <Tile label="Buco più lungo" value={c.longestGap || '—'} sub={c.longestGap ? 'giorni' : undefined} />
        <Tile label="Ultima corsa" value={c.sinceLast == null ? '—' : c.sinceLast === 0 ? 'oggi' : c.sinceLast}
              sub={c.sinceLast ? 'giorni fa' : undefined} />
      </div>
    </Card>
  )
}

// ── Blocco 3 — Passo ───────────────────────────────────────

function PaceCard({ report }) {
  const p = report.pace
  const schemes = report.schemes
  const info = (
    <InfoButton title="Come si legge il passo">
      <InfoItem title="Solo le corse continue">
        Il passo medio di una corsa a ripetute mescola scatti e recuperi: confrontarlo con quello di
        una corsa continua non ha senso. Il trend guarda perciò le sole corse senza ripetute, di
        almeno 1 km.
      </InfoItem>
      <InfoItem title="Prima e seconda metà">
        Le corse continue sono divise in due metà cronologiche (se sono dispari quella centrale
        resta fuori). Il passo di ogni metà è calcolato sui totali, tempo diviso chilometri: una
        corsa di 12 km pesa più di una di 3. Un numero negativo è più veloce.
      </InfoItem>
      <InfoItem title="Attenzione">
        Il passo dipende anche dal percorso, dal caldo e da quanto lunga era la corsa. Il blocco
        dice se vai più forte, non perché: per capire se è condizione guarda l'efficienza cardiaca.
      </InfoItem>
      <InfoItem title="La stessa scheda nel tempo">
        L'unico confronto valido anche per le ripetute: stessa struttura, stesse fasi. Per ogni
        scheda eseguita almeno {MIN_SCHEME} volte si vede il passo medio della prima e dell'ultima
        esecuzione e come è andato in mezzo.
      </InfoItem>
    </InfoButton>
  )

  const h = p.available ? p.halves : null

  return (
    <Card id="passo" title="Passo" titleExtra={info}
          sub="Corse continue, e la stessa scheda nel tempo"
          right={p.available ? <SampleTag n={p.n} unit="corse continue" /> : undefined}>
      {!p.available ? (
        <NotEnough need={p.missing} unit="corse continue con distanza e durata" what="Per il trend del passo" />
      ) : h ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-4xl font-bold leading-none"
                 style={{ color: paceColor(h.delta), fontFamily: 'var(--font-display)' }}>
                {h.delta === 0 ? '0' : formatDelta(h.delta)}<span className="text-lg"> s/km</span>
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
                Seconda metà vs prima
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {formatPace(h.first.pace)} → {formatPace(h.second.pace)} /km
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)' }}>
                {h.first.n} + {h.second.n} corse{h.dropped ? ' · una fuori' : ''}
              </p>
            </div>
          </div>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
            {Math.abs(h.delta) < 5
              ? 'Il passo delle tue corse continue è rimasto praticamente identico tra la prima e la seconda metà del periodo.'
              : h.delta < 0
                ? `Nella seconda metà del periodo le tue corse continue sono più veloci di ${Math.round(-h.delta)} secondi al chilometro.`
                : `Nella seconda metà del periodo le tue corse continue sono più lente di ${Math.round(h.delta)} secondi al chilometro.`}
          </p>
        </>
      ) : (
        <NotEnough need={p.missingSides} unit="corse continue" what="Per confrontare inizio e fine periodo" />
      )}

      {p.available && (
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-slate)' }}>
          Miglior passo del periodo:{' '}
          <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{formatPace(p.best.paceSec)} /km</span>
          {' '}su {fmt(p.best.km)} km
        </p>
      )}

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
          La stessa scheda nel tempo
        </p>
        {schemes.length === 0 ? (
          <NotEnough need={MIN_SCHEME} unit="esecuzioni della stessa scheda" what="Per il confronto" />
        ) : (
          <div className="space-y-3">
            {schemes.map(s => (
              <div key={s.key}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] flex-1 min-w-0 truncate"
                        style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {s.name}
                  </span>
                  <span className="text-[11px] shrink-0 font-semibold"
                        style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                    {formatPace(s.last.paceSec)} /km
                  </span>
                  <span className="text-[11px] shrink-0 w-12 text-right"
                        style={{ color: paceColor(s.deltaSec, 3), fontFamily: 'var(--font-mono)' }}>
                    {s.deltaSec > 0 ? '+' : s.deltaSec < 0 ? '−' : ''}{Math.abs(Math.round(s.delta * 100))}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {/* Il valore è il passo cambiato di segno: la linea sale quando vai più forte. */}
                  <Sparkline points={s.points.map(pt => ({ value: -pt.value }))} />
                  <p className="text-[10px]" style={{ color: 'var(--color-slate)' }}>
                    {s.n} esecuzioni · da {formatPace(s.first.paceSec)} · migliore {formatPace(s.best.paceSec)}
                    {s.continuous ? '' : ' · con ripetute'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Blocco 4 — Efficienza cardiaca ─────────────────────────

function EconomyCard({ report }) {
  const e = report.economy
  const info = (
    <InfoButton title="Cos'è l'efficienza cardiaca?">
      <InfoItem>
        La domanda è una sola: <strong>a parità di velocità, il tuo cuore va più piano di prima?</strong>{' '}
        Se corri allo stesso ritmo con qualche battito in meno, la condizione sta salendo, e lo vedi
        prima che si veda sul passo.
      </InfoItem>
      <InfoItem title="Come si toglie l'effetto della velocità">
        È lo stesso modello del tab Fisico: nelle tue corse si guarda di quanti battiti sale la FC
        per ogni km/h in più, e con quella pendenza ogni corsa viene riportata alla tua velocità
        media. La correzione si applica solo se la relazione è abbastanza netta; altrimenti si
        confrontano le FC grezze e il blocco lo dice.
      </InfoItem>
      <InfoItem title="Solo corse continue">
        Come per il passo: con le ripetute la velocità media non dice a che ritmo ha lavorato il
        cuore. Servono almeno {MIN_PACE} corse continue con FC media, distanza e durata.
      </InfoItem>
      <InfoItem title="Il numero grande">
        FC della seconda metà del periodo meno quella della prima. Negativo (verde) è meglio: meno
        battiti per la stessa cosa. Sotto i 2 battiti è stabile, perché caldo, sonno e stress
        spostano la FC di qualche battito da soli.
      </InfoItem>
    </InfoButton>
  )

  if (!e.available) {
    return (
      <Card id="economia-corsa" title="Efficienza cardiaca" titleExtra={info} sub="FC media a parità di velocità">
        <NotEnough need={e.missing} unit="corse continue con FC media, distanza e durata"
                   what="Per misurare l'efficienza" />
      </Card>
    )
  }

  const h = e.halves
  return (
    <Card id="economia-corsa" title="Efficienza cardiaca" titleExtra={info}
          sub="FC media a parità di velocità, corse continue"
          right={<SampleTag n={e.n} unit="corse" />}>
      {h ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-4xl font-bold leading-none"
                 style={{ color: bpmColor(h.delta), fontFamily: 'var(--font-display)' }}>
                {formatDelta(h.delta)}
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
                Battiti, seconda metà vs prima
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {formatBpm(h.first.hr)} → {formatBpm(h.second.hr)} bpm
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)' }}>
                {e.corrected ? `a ${formatKmh(e.refSpeed)} km/h` : 'FC non corretta'}
              </p>
            </div>
          </div>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
            {Math.abs(h.delta) < 2
              ? 'A parità di velocità la tua FC è rimasta praticamente identica: la condizione è stabile.'
              : h.delta < 0
                ? `Corri alla stessa velocità con ${Math.round(-h.delta)} battiti in meno nella seconda metà del periodo: è il segno più precoce che la condizione sta salendo.`
                : `Alla stessa velocità la seconda metà del periodo ti costa ${Math.round(h.delta)} battiti in più: stanchezza accumulata, stop o condizione in calo.`}
          </p>
        </>
      ) : (
        <NotEnough need={e.missingSides} unit="corse" what="Per confrontare inizio e fine periodo" />
      )}

      <EconomyChart economy={e} />

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="FC media" value={formatBpm(e.meanHr)} sub="bpm" color="var(--color-loss)" />
        <Tile label="Velocità media" value={formatKmh(e.refSpeed)} sub="km/h" color="var(--color-teal)" />
        <Tile label="Battiti per km" value={e.beatsPerKm.value == null ? '—' : String(Math.round(e.beatsPerKm.value))}
              sub={`${e.beatsPerKm.n} corse`} />
      </div>

      <Note>
        {e.corrected
          ? <>La FC di ogni corsa è <strong>riportata a {formatKmh(e.refSpeed)} km/h</strong>, la tua velocità media del periodo ({e.beta.toLocaleString('it-IT', { maximumFractionDigits: 1 })} bpm per km/h in più).</>
          : <>Le tue corse non mostrano una relazione abbastanza netta tra velocità e battiti, quindi la FC è confrontata <strong>grezza</strong>, senza correzione.</>}
        {' '}Il confronto divide le corse in due metà cronologiche{h?.dropped ? ' e lascia fuori quella centrale' : ''}.
      </Note>
    </Card>
  )
}

// ── Blocco 5 — Intensità ───────────────────────────────────

function IntensityCard({ report }) {
  const it = report.intensity
  const info = (
    <InfoButton title="Come si legge l'intensità">
      <InfoItem title="Tre fasce">
        Il tempo passato in ogni zona cardiaca, sommato su tutte le corse (non la media delle
        percentuali: una corsa lunga pesa di più). Le sette zone sono raggruppate in facile
        (Z0-Z2), media (Z3) e dura (Z4-Z6).
      </InfoItem>
      <InfoItem title="L'80 / 20">
        Molti allenatori consigliano circa l'80% del tempo facile e il 20% duro. Non è un
        obiettivo da inseguire: è un riferimento per capire se le tue corse sono tutte a metà
        strada, né abbastanza facili per recuperare né abbastanza dure per stimolare.
      </InfoItem>
      <InfoItem title="Intensità dichiarata">
        Quella che scegli nel wizard (leggera, media, intensa): è una sensazione e c'è anche dove
        le zone mancano.
      </InfoItem>
    </InfoButton>
  )

  const d = it.declared
  const declaredTotal = d.leggera + d.media + d.intensa
  const declaredLine = declaredTotal
    ? [`${d.leggera} leggere`, `${d.media} medie`, `${d.intensa} intense`].join(' · ') + (d.none ? ` · ${d.none} non indicate` : '')
    : null

  return (
    <Card id="intensita-corsa" title="Intensità" titleExtra={info}
          sub="Quanto del tempo è facile e quanto duro"
          right={it.enough ? <SampleTag n={it.n} unit="corse" /> : undefined}>
      {!it.enough ? (
        <NotEnough need={it.missing} unit="corse con le zone FC" what="Per la distribuzione" />
      ) : (
        <>
          <ZoneBar shares={it.shares} />
          <div className="space-y-2.5 mt-4">
            <BarRow label="Facile · Z0-Z2" value={`${Math.round(it.easy * 100)}%`} rate={it.easy} color="var(--color-zone-2)" />
            <BarRow label="Media · Z3" value={`${Math.round(it.mid * 100)}%`} rate={it.mid} color="var(--color-zone-3)" />
            <BarRow label="Dura · Z4-Z6" value={`${Math.round(it.hard * 100)}%`} rate={it.hard} color="var(--color-zone-5)" />
          </div>
          <div className="space-y-1.5 mt-4">
            {HR_ZONES.map((zone, i) => (
              it.secs[i] > 0 ? (
                <div key={zone.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: zone.color }} />
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                    {zone.label}
                  </span>
                  <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--color-slate)' }}>{zone.name}</span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(it.secs[i])}
                  </span>
                  <span className="text-[11px] w-9 text-right shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(it.shares[i] * 100)}%
                  </span>
                </div>
              ) : null
            ))}
          </div>
          <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>
            Su {formatDuration(it.total)} registrati dall'orologio (servono {MIN_ZONES} corse con le zone).
          </p>
        </>
      )}

      {declaredLine && (
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-slate)' }}>
          Intensità dichiarata: <span style={{ color: 'var(--color-white)' }}>{declaredLine}</span>
        </p>
      )}
    </Card>
  )
}

// ── Blocco 6 — Stimolo e carico ────────────────────────────

function LoadCard({ report }) {
  const s = report.stimulus
  const l = report.load
  const info = (
    <InfoButton title="Stimolo e carico">
      <InfoItem title="Training effect">
        Quanto una corsa ha stimolato il sistema aerobico e quello anaerobico, sulla scala 0-5 di
        Garmin: sotto 2 è mantenimento, 3-4 un miglioramento, oltre 4 un forte miglioramento. Qui
        è la media delle corse in cui c'è (ne servono {MIN_TE}).
      </InfoItem>
      <InfoItem title="Carico Garmin">
        Il «Carico allenamento» dell'orologio, basato sul consumo di ossigeno dopo lo sforzo
        (EPOC). C'è solo nelle corse importate dal file, e l'unità è quella di Garmin: conta il
        confronto tra settimane, non il valore assoluto. Servono {MIN_LOAD} corse con il carico.
      </InfoItem>
      <InfoItem title="Cosa non è">
        Non è ancora il carico acuto/cronico (ACWR) della sezione Attività: quello usa minuti per
        sforzo dichiarato, e il passaggio al carico Garmin è un lavoro a parte.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="carico-corsa" title="Stimolo e carico" titleExtra={info} sub="Training effect e carico Garmin">
      {s.enough ? (
        <div className="grid grid-cols-2 gap-2">
          <Tile label="TE aerobico" value={formatTrainingEffect(s.aerobic)} sub={`${trainingEffectLabel(s.aerobic)} · su ${s.aerobicN}`} />
          {s.anaerobicN > 0 && (
            <Tile label="TE anaerobico" value={formatTrainingEffect(s.anaerobic)} sub={`${trainingEffectLabel(s.anaerobic)} · su ${s.anaerobicN}`} />
          )}
        </div>
      ) : (
        <NotEnough need={s.missing} unit="corse con il training effect" what="Per lo stimolo" />
      )}

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        {l.enough ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Carico medio" value={Math.round(l.avg)} sub={`su ${l.n} corse`} color="var(--color-amber)" />
              <Tile label="Corsa più pesante" value={Math.round(l.peak.load)} sub={dayLabel(l.peak.day)} />
              <Tile label="Settimana max" value={Math.round(l.weekPeak)} />
            </div>
            {l.weekly.length > 1 && (
              <WeekBars title="Carico Garmin a settimana" weeks={l.weekly} value={w => w.load}
                        format={n => `${Math.round(n)}`} color="var(--color-amber)" />
            )}
            <p className="text-[10px] mt-2" style={{ color: 'var(--color-slate)' }}>
              Una settimana somma solo le corse che hanno il carico: dove manca il file la barra è più bassa del vero.
            </p>
          </>
        ) : (
          <NotEnough need={l.missing} unit="corse con il carico Garmin" what="Per il carico" />
        )}
      </div>
    </Card>
  )
}

// ── Blocco 7 — Dinamiche di corsa ──────────────────────────

function DynamicsCard({ report }) {
  const d = report.dynamics
  const info = (
    <InfoButton title="Le dinamiche di corsa">
      <InfoItem>
        Potenza, cadenza e dinamiche vengono dal file dell'orologio (non si trascrivono a mano).
        Servono almeno {MIN_DYNAMICS} corse con il dato, e il confronto tra le due metà del periodo
        da 6 in su.
      </InfoItem>
      <InfoItem title="Dipendono dalla velocità">
        Lunghezza del passo, cadenza, oscillazione e contatto al suolo cambiano con il ritmo, non
        solo con la tecnica. Per questo sotto ogni confronto c'è il passo medio delle due metà: se
        sei andato più forte, buona parte del cambiamento è quello.
      </InfoItem>
      <InfoItem title="Verde e ambra">
        Per potenza è meglio di più; per oscillazione verticale, contatto al suolo e rapporto
        verticale è meglio di meno. Per cadenza e lunghezza del passo non c'è un verso migliore:
        restano neutri.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="dinamiche" title="Dinamiche di corsa" titleExtra={info} sub="Solo dalle corse importate dal file"
          right={d.enough ? <SampleTag n={d.n} unit="corse" /> : undefined}>
      {!d.enough ? (
        <NotEnough need={d.missing} unit="corse con le dinamiche" what="Per le dinamiche" />
      ) : (
        <div className="space-y-3">
          {d.rows.filter(r => r.enough).map(r => (
            <div key={r.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] flex-1 min-w-0 truncate"
                      style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {r.label}
                </span>
                <span className="text-[11px] shrink-0 font-semibold"
                      style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                  {r.value.toLocaleString('it-IT', { minimumFractionDigits: r.digits, maximumFractionDigits: r.digits })} {r.unit}
                </span>
                <span className="text-[9px] shrink-0 w-10 text-right" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  su {r.n}
                </span>
              </div>
              {r.halves && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
                  <span style={{ color: dynamicsColor(r) }}>
                    {formatDelta(r.halves.delta, r.digits)} {r.unit}
                  </span>
                  {' '}seconda metà vs prima
                  {r.halves.first.paceSec != null && r.halves.second.paceSec != null && (
                    <> · passo {formatPace(r.halves.first.paceSec)} → {formatPace(r.halves.second.paceSec)}</>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Blocco 8 — Record ──────────────────────────────────────

function RecordsCard({ report }) {
  const rows = report.records
  const info = (
    <InfoButton title="I record">
      <InfoItem>
        Calcolati su tutto lo storico, non sul periodo: «la corsa più lunga che hai fatto» non
        cambia a seconda della finestra scelta. Il segno «nel periodo» dice se l'hai stabilito di
        recente. Tocca una riga per aprire la corsa.
      </InfoItem>
      <InfoItem title="Il miglior passo">
        Vale solo per le corse continue di almeno {MIN_RECORD_KM} km: il passo di una corsa di
        poche centinaia di metri o a ripetute non è un record di velocità.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="record" title="Record" titleExtra={info} sub="Su tutto lo storico">
      {rows.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
          Nessun record ancora: servono corse con la distanza o la durata dell'orologio.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} to={`/matches?run=${r.runId}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.99]"
                  style={{ background: 'var(--color-surface-2)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[10px]" style={{ color: 'var(--color-slate)' }}>{r.label}</p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-white)' }}>
                  {r.name} · {dayLabel(r.day)}
                  {r.inPeriod && <span style={{ color: 'var(--color-win)' }}> · nel periodo 🏅</span>}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                {recordValue(r)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Helpers ────────────────────────────────────────────────

const fmt = (v) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })

function dayLabel(time) {
  return new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })
}

function recordValue(r) {
  if (r.id === 'distanza') return `${fmt(r.value)} km`
  if (r.id === 'durata') return formatDuration(r.value)
  if (r.id === 'passo') return `${formatPace(r.value)} /km`
  return `${Math.round(r.value)} m`
}

// Meno battiti = meglio: il verde sta sul negativo. Sotto i 2 bpm resta neutro
// (rumore fisiologico). Duplicata da MovementBlock, che la tiene privata.
function bpmColor(delta) {
  if (delta == null || Math.abs(delta) < 2) return 'var(--color-white)'
  return delta < 0 ? 'var(--color-win)' : 'var(--color-loss)'
}

// Passo più basso = più veloce = verde. Sotto `eps` secondi resta neutro.
function paceColor(deltaSec, eps = 5) {
  if (deltaSec == null || Math.abs(deltaSec) < eps) return 'var(--color-white)'
  return deltaSec < 0 ? 'var(--color-win)' : 'var(--color-amber)'
}

function dynamicsColor(r) {
  if (!r.better || !r.halves || r.halves.delta === 0) return 'var(--color-white)'
  const good = r.better === 'up' ? r.halves.delta > 0 : r.halves.delta < 0
  return good ? 'var(--color-win)' : 'var(--color-amber)'
}

function coverageColor(share) {
  if (share == null) return 'var(--color-white)'
  if (share >= 0.7) return 'var(--color-win)'
  if (share >= 0.4) return 'var(--color-amber)'
  return 'var(--color-loss)'
}

function fieldColor(share) {
  if (share == null) return 'var(--color-surface-2)'
  return share >= 0.7 ? 'var(--color-teal-dark)' : share >= 0.35 ? 'var(--color-amber)' : 'var(--color-slate)'
}
