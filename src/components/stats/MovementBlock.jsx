import { Card, Tile, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import {
  TREND_MONTHS,
  formatKm, formatKmh, formatBpm, formatDelta, formatMinutes, formatMonthLabel,
} from '../../lib/physical'

// Blocco 3 — Movimento, e blocco 4 — Economia cardiaca.
//
// Stanno nello stesso file perché sono lo stesso dato letto due volte: quanta
// strada fai e a che ritmo (movimento), e quanto ti costa farla (economia). Il
// secondo senza il primo non si legge — "meno battiti" significa qualcosa solo
// se sai a che velocità — ed è per questo che il movimento viene prima.
//
// ── L'economia cardiaca è la metrica di fitness vera dell'app ──
// Tutto il resto di Stats misura come hai giocato; questa misura come stai. La
// FC media a parità di velocità peggiora o migliora mesi prima che si veda nei
// risultati, perché il risultato dipende anche dall'avversario e la frequenza
// cardiaca no.

export default function MovementBlock({ report }) {
  return (
    <>
      <MovementCard report={report} />
      <EconomyCard report={report} />
    </>
  )
}

// ── Blocco 3 — Movimento ───────────────────────────────────

function MovementCard({ report }) {
  const m = report.movement
  const info = <InfoButton title="Cos'è il Movimento?"><MovementInfo /></InfoButton>

  if (!m.enough) {
    return (
      <Card id="movimento" title="Movimento" titleExtra={info} sub="Quanto ti muovi, e a che ritmo">
        <NotEnough need={m.missing} unit="sessioni con distanza e durata"
                   what="Per misurare il movimento" />
      </Card>
    )
  }

  return (
    <Card id="movimento" title="Movimento" titleExtra={info} sub="Quanto ti muovi, e a che ritmo"
          right={<SampleTag n={m.all.n} unit="sessioni" />}>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {formatKmh(m.all.kmPerHour)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Km per ora di gioco
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {formatKm(m.all.km, 1)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--color-slate)' }}>
            Km totali
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            in {m.all.hours.toLocaleString('it-IT', { maximumFractionDigits: 1 })} h
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Tile label="Km a sessione" value={formatKm(m.all.kmPerSession)} />
        <Tile label="Durata media" value={formatMinutes(m.all.minutesPerSession)} />
      </div>

      {m.comparable && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
            Partita contro allenamento
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Partite · km/h" value={formatKmh(m.match.kmPerHour)} color="var(--color-amber)"
                  sub={`${formatKm(m.match.kmPerSession)} km a partita`} />
            <Tile label="Allenamenti · km/h" value={formatKmh(m.training.kmPerHour)} color="var(--color-teal)"
                  sub={`${formatKm(m.training.kmPerSession)} km a sessione`} />
          </div>
        </div>
      )}

      <SpeedTrend trend={m.trend} />

      <Note>
        La velocità è calcolata sui <strong>totali</strong> (km totali diviso ore totali), non come
        media delle singole sessioni: così un'ora di partita non pesa quanto venti minuti di
        riscaldamento. Per gli allenamenti la durata è la somma dei blocchi che hai registrato, non
        il tempo dell'orologio: se l'orologio si mette in pausa e la tua stima dei blocchi include
        le pause, la velocità degli allenamenti risulta un po' più bassa di quella vera.
      </Note>
    </Card>
  )
}

// Trend mensile della velocità, disegnato come scostamento dalla media del
// periodo e non da zero: una serie che oscilla tra 2,5 e 3,0 km/h partendo da
// zero sembra piatta, mentre è esattamente lì che vive la differenza. Stessa
// scelta dell'andamento del GW% in Rendimento.
function SpeedTrend({ trend }) {
  if (trend.months.length < 2 || trend.avg == null) return null

  const diffs = trend.months.map(m => (m.kmPerHour != null ? m.kmPerHour - trend.avg : null))
  const max = Math.max(0.05, ...diffs.filter(d => d != null).map(Math.abs))
  const HALF = 20

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
        Velocità mese per mese · scostamento dalla media ({formatKmh(trend.avg)} km/h)
      </p>

      <div className="flex items-end" style={{ gap: 2 }}>
        {trend.months.map((m, i) => {
          const d = diffs[i]
          const h = d == null ? 0 : Math.max(2, (Math.abs(d) / max) * HALF)
          return (
            <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center"
                 title={`${formatMonthLabel(m)}: ${m.n === 0 ? 'nessuna sessione con distanza' : `${formatKmh(m.kmPerHour)} km/h su ${m.n} ${m.n === 1 ? 'sessione' : 'sessioni'}`}`}>
              <div className="w-full flex items-end justify-center" style={{ height: HALF }}>
                {d != null && d > 0 && (
                  <div className="w-full rounded-t-[2px]" style={{ height: h, background: 'var(--color-teal)' }} />
                )}
              </div>
              <div className="w-full" style={{ height: 1, background: 'var(--color-surface-2)' }} />
              <div className="w-full flex items-start justify-center" style={{ height: HALF }}>
                {d != null && d < 0 && (
                  <div className="w-full rounded-b-[2px]" style={{ height: h, background: 'var(--color-amber-dark)' }} />
                )}
                {d == null && (
                  <span className="text-[8px] leading-none mt-0.5" style={{ color: 'var(--color-slate)' }}>·</span>
                )}
              </div>
              {/* A 12 colonne restano ~25px per etichetta: "Gen" ci sta a 7px,
                  e la sola iniziale non basterebbe (Gen e Giu, Mar e Mag). */}
              <span className="text-[7px] mt-0.5 truncate w-full text-center"
                    style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {m.label}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[9px] mt-2 leading-relaxed" style={{ color: 'var(--color-slate)' }}>
        Sopra la linea i mesi in cui ti sei mosso più veloce della tua media, sotto quelli più
        lenti. Un punto al posto della barra è un mese senza sessioni con la distanza trascritta.
        {trend.truncated && ` Il grafico mostra gli ultimi ${TREND_MONTHS} mesi.`}
      </p>
    </div>
  )
}

function MovementInfo() {
  return (
    <>
      <InfoItem>
        Quanta strada copri in campo e a che ritmo, sommando le sessioni in cui hai trascritto
        <strong> sia la distanza sia la durata</strong> — servono entrambe, perché la velocità è il
        rapporto tra le due.
      </InfoItem>
      <InfoItem title="Km per ora di gioco">
        Il numero grande: i chilometri totali diviso le ore totali. È la misura di quanto è mobile
        il tuo tennis. Per dare un ordine di grandezza: nel tennis amatoriale ci si muove attorno ai
        2-3 km/h di media sull'intera durata (che include cambi campo, pause tra i punti e
        riscaldamento), molto meno di una camminata, perché la maggior parte del tempo si sta fermi.
        Il valore assoluto conta poco: conta come cambia il tuo.
      </InfoItem>
      <InfoItem title="Perché non è la media delle sessioni">
        Perché una media delle velocità darebbe lo stesso peso a una partita di due ore e a venti
        minuti di riscaldamento. Sommando prima km e ore, ogni sessione pesa per quanto è durata.
      </InfoItem>
      <InfoItem title="Km a sessione / Durata media">
        Quanto copri e quanto duri in una sessione tipo. Sono i due numeri che, moltiplicati e
        divisi tra loro, producono la velocità: servono a capire se un mese veloce è stato veloce
        perché ti sei mosso di più o perché le sessioni sono state più corte e intense.
      </InfoItem>
      <InfoItem title="Partita contro allenamento">
        In partita ci si muove quasi sempre di più che in allenamento, perché la palla la decide
        l'avversario. Se i due numeri sono uguali, o l'allenamento è molto giocato oppure le partite
        sono poco combattute.
      </InfoItem>
      <InfoItem title="Il grafico mensile">
        Le barre non partono da zero ma dalla tua media del periodo: sopra la linea i mesi più
        veloci, sotto quelli più lenti. Partendo da zero, una serie che oscilla tra 2,5 e 3,0 km/h
        sembrerebbe piatta, e invece è lì che sta tutta la differenza tra un mese in forma e uno
        storto.
      </InfoItem>
      <InfoItem>
        Un avvertimento sul dato: per un allenamento la durata non è quella dell'orologio ma la
        somma dei blocchi che hai registrato nel wizard. Se l'orologio si è messo in pausa e tu hai
        contato anche le pause, la velocità degli allenamenti esce leggermente più bassa del vero.
      </InfoItem>
    </>
  )
}

// ── Blocco 4 — Economia cardiaca ───────────────────────────
// La domanda è: a parità di velocità, il tuo cuore va più piano di prima? Se la
// risposta è sì stai migliorando, e lo sai mesi prima che si veda nei risultati.

function EconomyCard({ report }) {
  const e = report.economy
  const info = <InfoButton title="Cos'è l'economia cardiaca?"><EconomyInfo /></InfoButton>

  if (!e.available) {
    return (
      <Card id="economia" title="Economia cardiaca" titleExtra={info}
            sub="FC media a parità di velocità">
        <NotEnough need={e.missing} unit="sessioni con FC media, distanza e durata"
                   what="Per misurare l'economia cardiaca" />
        <Note>
          È la metrica di condizione più utile della sezione, ed è anche la più esigente: servono
          tutti e tre i campi sulla stessa sessione, perché la frequenza cardiaca da sola non dice
          niente se non si sa a che velocità ti stavi muovendo.
        </Note>
      </Card>
    )
  }

  const h = e.halves

  return (
    <Card id="economia" title="Economia cardiaca" titleExtra={info}
          sub="FC media a parità di velocità"
          right={<SampleTag n={e.n} unit="sessioni" />}>

      {h ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-4xl font-bold leading-none"
                 style={{ color: deltaColor(h.delta), fontFamily: 'var(--font-display)' }}>
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
              ? `La tua frequenza cardiaca a parità di velocità è rimasta praticamente identica tra la prima e la seconda metà del periodo: la condizione è stabile.`
              : h.delta < 0
                ? `Nella seconda metà del periodo copri la stessa strada alla stessa velocità con ${Math.round(Math.abs(h.delta))} battiti in meno: è il segno più precoce che la condizione sta salendo.`
                : `Nella seconda metà del periodo la stessa strada alla stessa velocità ti costa ${Math.round(h.delta)} battiti in più: stanchezza accumulata, stop, o condizione in calo.`}
          </p>
        </>
      ) : (
        <NotEnough need={e.missingSides} unit="sessioni" what="Per confrontare inizio e fine periodo" />
      )}

      <EconomyChart economy={e} />

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="FC media" value={formatBpm(e.meanHr)} sub="bpm" color="var(--color-loss)" />
        <Tile label="Velocità media" value={formatKmh(e.refSpeed)} sub="km/h" color="var(--color-teal)" />
        <Tile label="Battiti per km" value={e.beatsPerKm.value == null ? '—' : String(Math.round(e.beatsPerKm.value))}
              sub={`${e.beatsPerKm.n} sess.`} />
      </div>

      <Note>
        {e.corrected
          ? <>La FC di ogni sessione è <strong>riportata a {formatKmh(e.refSpeed)} km/h</strong>, la tua velocità media del periodo, usando la relazione tra velocità e battiti che emerge dalle tue sessioni ({e.beta.toLocaleString('it-IT', { maximumFractionDigits: 1 })} bpm per km/h in più). Senza questa correzione un periodo in cui hai giocato partite più combattute sembrerebbe un periodo in cui sei peggiorato.</>
          : <>Le tue sessioni non mostrano una relazione abbastanza netta tra velocità e battiti (o hanno velocità troppo simili tra loro), quindi la FC è confrontata <strong>grezza</strong>, senza correzione: correggere con un coefficiente stimato male sarebbe peggio che non correggere. Con velocità simili, del resto, confrontare le FC grezze è già un confronto a parità di velocità.</>}
        {' '}Il confronto divide le sessioni in due metà cronologiche{h?.dropped ? ' e, essendo dispari, lascia fuori quella centrale invece di assegnarla arbitrariamente a una delle due' : ''}.
        {' '}Partite e allenamenti sono contati insieme ({e.matchN} e {e.trainingN}): sono sforzi diversi, ma separarli dimezzerebbe un campione già piccolo.
      </Note>
    </Card>
  )
}

// Una sessione = un punto, in ordine cronologico. Non a scala temporale reale:
// con dieci punti sparsi su un anno, le date vere ammasserebbero tre sessioni
// in un pixel. L'asse x è l'ordine, e le due linee orizzontali sono le medie
// delle due metà — è il confronto che il blocco sta facendo, disegnato.
function EconomyChart({ economy }) {
  const pts = economy.points
  if (pts.length < 3) return null

  const W = 300, H = 96, PAD_T = 8, PAD_B = 14
  const values = pts.map(p => p.adjusted)
  // Due battiti di margine sopra e sotto: senza, una serie stabile verrebbe
  // riscalata fino a riempire tutta l'altezza e sembrerebbe un terremoto.
  const lo = Math.min(...values) - 2
  const hi = Math.max(...values) + 2

  const x = i => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * (W - 12) + 6)
  const y = v => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B)

  const h = economy.halves
  const half = Math.floor(pts.length / 2)

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label="Frequenza cardiaca a parità di velocità, sessione per sessione">
        {/* Linea della media generale: il riferimento rispetto a cui i punti
            stanno sopra o sotto. */}
        <line x1="0" y1={y((lo + hi) / 2)} x2={W} y2={y((lo + hi) / 2)}
              stroke="var(--color-surface-2)" strokeWidth="1" />

        {h && (
          <>
            <line x1={x(0)} y1={y(h.first.hr)} x2={x(half - 1)} y2={y(h.first.hr)}
                  stroke="var(--color-slate)" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1={x(pts.length - half)} y1={y(h.second.hr)} x2={x(pts.length - 1)} y2={y(h.second.hr)}
                  stroke={deltaColor(h.delta)} strokeWidth="1.5" strokeDasharray="3 2" />
          </>
        )}

        {/* Spezzata di collegamento: la serie è ordinata nel tempo, e senza la
            linea dieci punti sparsi non si leggono come un andamento. */}
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.adjusted)}`).join(' ')}
                  fill="none" stroke="var(--color-surface-2)" strokeWidth="1" />

        {pts.map((p, i) => (
          <circle key={`${p.id}-${i}`} cx={x(i)} cy={y(p.adjusted)} r="3"
                  fill={p.kind === 'match' ? 'var(--color-amber)' : 'var(--color-teal)'}>
            <title>{`${dayLabel(p.day)} · ${p.label}: ${formatBpm(p.adjusted)} bpm ${economy.corrected ? 'corretti' : ''} (${formatBpm(p.hr)} reali a ${formatKmh(p.speed)} km/h)`}</title>
          </circle>
        ))}

        <text x="2" y={H - 3} fontSize="8" fill="var(--color-slate)" fontFamily="var(--font-mono)">
          {dayLabel(pts[0].day)}
        </text>
        <text x={W - 2} y={H - 3} fontSize="8" textAnchor="end" fill="var(--color-slate)" fontFamily="var(--font-mono)">
          {dayLabel(pts[pts.length - 1].day)}
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        <Legend color="var(--color-amber)" label="Partite" />
        <Legend color="var(--color-teal)" label="Allenamenti" />
        {h && <Legend color={deltaColor(h.delta)} label="Media delle due metà" dashed />}
      </div>
    </div>
  )
}

function Legend({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm shrink-0"
            style={dashed ? { border: `1px dashed ${color}` } : { background: color }} />
      <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>{label}</span>
    </span>
  )
}

function EconomyInfo() {
  return (
    <>
      <InfoItem>
        La domanda a cui risponde è una sola: <strong>a parità di velocità, il tuo cuore va più
        piano di prima?</strong> Se copri la stessa strada allo stesso ritmo con 8 battiti in meno,
        stai migliorando — e lo vedi mesi prima che si veda nei risultati, perché il risultato
        dipende anche dall'avversario, la frequenza cardiaca no.
      </InfoItem>
      <InfoItem title="Perché non basta guardare la FC media">
        Perché la frequenza cardiaca sale quando ti muovi di più. Un periodo in cui hai giocato
        partite più combattute ha una FC media più alta anche se sei in forma migliore: senza
        togliere l'effetto della velocità, il numero misura quanto hai corso, non quanto vali.
      </InfoItem>
      <InfoItem title="Come si toglie l'effetto della velocità">
        Si guarda, nelle tue sessioni, di quanti battiti sale la FC per ogni km/h in più: è una
        semplice retta tracciata in mezzo ai tuoi dati. Con quella pendenza ogni sessione viene
        <strong> riportata alla tua velocità media</strong> — è come chiedersi «se quel giorno mi
        fossi mosso alla mia velocità solita, a quanto sarebbe stato il cuore?». I numeri del blocco
        sono queste frequenze corrette, non quelle grezze.
      </InfoItem>
      <InfoItem title="Quando la correzione non viene applicata">
        Se le tue sessioni hanno velocità troppo simili tra loro, o se velocità e battiti non
        risultano abbastanza legati, la pendenza sarebbe stimata male e correggere con un numero
        casuale è peggio che non correggere: in quel caso il blocco confronta le FC grezze e lo
        dichiara. Non è un problema — se le velocità sono tutte simili, confrontare le FC grezze
        <em> è</em> già un confronto a parità di velocità.
      </InfoItem>
      <InfoItem title="Il numero grande">
        La differenza tra la FC media della seconda metà del periodo e quella della prima. Negativo
        (verde) è meglio: meno battiti per fare la stessa cosa. Sotto i 2 battiti si considera
        stabile, perché una differenza così piccola sta dentro il rumore normale tra due giornate —
        caldo, sonno, caffè e stress spostano la FC di qualche battito da soli.
      </InfoItem>
      <InfoItem title="Il grafico">
        Un punto per sessione, in ordine cronologico (arancione le partite, verde acqua gli
        allenamenti), con l'altezza pari alla FC corretta. Le due linee tratteggiate sono la media
        della prima e della seconda metà: la distanza tra le due linee è il numero grande qui sopra.
        L'asse orizzontale è l'ordine delle sessioni, non il calendario, altrimenti tre sessioni
        nella stessa settimana finirebbero sovrapposte.
      </InfoItem>
      <InfoItem title="Battiti per km">
        Un secondo modo di leggere la stessa cosa, senza nessun modello dietro: quanti battiti ti
        costa in media un chilometro (FC media × minuti ÷ km). È più intuitivo, ma anche più
        confuso dalla velocità, quindi sta qui come contorno e non come metrica principale.
      </InfoItem>
      <InfoItem>
        Partite e allenamenti sono nello stesso calcolo. Sono sforzi diversi — in partita il cuore
        sale anche per la tensione — ma tenerli separati dimezzerebbe due volte un campione già
        piccolo. Il grafico li distingue per colore, così un eventuale squilibrio si vede.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Meno battiti = meglio: il verde sta sul negativo, al contrario di quasi tutti
// gli altri delta della pagina. Sotto i 2 bpm resta neutro perché una
// differenza così piccola è rumore fisiologico, non un miglioramento.
function deltaColor(delta) {
  if (delta == null || Math.abs(delta) < 2) return 'var(--color-white)'
  return delta < 0 ? 'var(--color-win)' : 'var(--color-loss)'
}

function dayLabel(time) {
  return new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
