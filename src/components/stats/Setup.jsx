import { useState } from 'react'
import { Card, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import StringLifeBlock from './StringLifeBlock'
import ShoeBlock from './ShoeBlock'
import {
  SETUP_DIMENSIONS, MIN_SETUP_MATCHES, MIN_SETUP_ROWS,
  formatRateWithMoe,
} from '../../lib/setup'

// Sezione "Setup" — risponde a "il materiale cambia qualcosa in campo?".
//
// È la più corta delle cinque, e di proposito: le domande a cui può rispondere
// sono tre, e due delle tre risposte sono numeri di manutenzione, non di
// rendimento. I blocchi:
//   0. Copertura      — su quante sessioni hai dichiarato l'attrezzatura
//   1. Il confronto   — GW% per racchetta / corda / tensione, col margine d'errore
//   2. Vita delle corde — quanto durano davvero, e se il modello è tarato per te
//   3. Chilometraggio scarpe — game pesati per superficie e km reali
//
// ── Perché questa sezione è scritta per SMONTARE, non per convincere ──
// Il GW% per tensione è il numero su cui un tennista costruisce una
// superstizione: "con la 24 kg vinco". Su una decina di partite per parte, una
// differenza di cinque punti percentuali è quello che il caso produce da solo
// praticamente sempre. Per questo il blocco del confronto non mostra una
// classifica ma un intervallo, e quando i due setup non sono distinguibili lo
// dice in chiaro — insieme a quante partite servirebbero per distinguerli.
//
// ── Perché ignora il periodo scelto in pagina ──
// Un setup cambia lentamente e l'usura è un fatto del presente: ritagliare su 90
// giorni butterebbe via il setup precedente, cioè esattamente il termine di
// paragone. La sezione lavora su tutto lo storico e lo dichiara in testa.

export default function Setup({ report, onDrill }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={1} unit="sessione con l'attrezzatura dichiarata"
                   what="Per analizzare il tuo materiale" />
        <Note>
          Questa sezione si costruisce da tre cose: la racchetta e le scarpe scelte nel wizard di
          una partita o di un allenamento, e lo storico delle incordature che registri dal dettaglio
          della racchetta in Equipment. Finché nessuna sessione dichiara l'attrezzatura non c'è
          niente da collegare.
        </Note>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <PeriodNotice />
      <CoverageCard report={report} />
      <ComparisonBlock report={report} onDrill={onDrill} />
      <StringLifeBlock report={report} />
      <ShoeBlock report={report} />

      <Note>
        Le tre domande di questa sezione hanno risposte di natura diversa, ed è utile tenerle
        separate. «Quanto durano le corde» e «quanto hai camminato con queste scarpe» sono
        <strong> misure</strong>: si contano game e chilometri, e i numeri valgono quanto è completo
        il tuo diario. «Con quale setup gioco meglio» è invece una <strong>stima</strong> su un
        campione piccolo, e quasi sempre la risposta onesta è che i tuoi dati non bastano a
        distinguere due materiali — il che non significa che la differenza non esista, ma che non è
        misurabile da qui.
      </Note>
    </div>
  )
}

// Il periodo non governa questa sezione, e va detto prima dei numeri: le altre
// quattro lo seguono, e un utente che ha appena cambiato periodo si aspetta che
// cambi anche questa.
function PeriodNotice() {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <span className="text-[11px] shrink-0">🗓</span>
      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-slate)' }}>
        Questa sezione usa <strong style={{ color: 'var(--color-white)' }}>tutto lo storico</strong> e
        non il periodo selezionato sopra: un setup dura mesi, e ritagliare su una finestra lascerebbe
        fuori proprio il materiale con cui confrontarlo. L'usura, poi, è un fatto di adesso.
      </p>
    </div>
  )
}

// ── Blocco 0 — Copertura ───────────────────────────────────
// Stessa disciplina di Fisico: la copertura sta in testa e non in fondo, perché
// dichiarare l'attrezzatura è facoltativo in entrambi i wizard e tutto ciò che
// segue descrive solo le sessioni in cui l'hai fatto.

function CoverageCard({ report }) {
  const c = report.coverage
  const total = report.totals.matches + report.totals.trainings

  return (
    <Card id="copertura-setup" title="Cosa hai dichiarato" sub={`Su ${total} sessioni registrate`}
          titleExtra={<InfoButton title="Cosa hai dichiarato"><CoverageInfo /></InfoButton>}>
      <div className="space-y-3">
        <CoverageRow icon="🎾" label="Racchetta" side={c.racket} />
        <CoverageRow icon="👟" label="Scarpe"    side={c.shoe} />
      </div>

      <Note>
        L'attrezzatura si sceglie nell'ultimo passo del wizard di una partita o di un allenamento, ed
        è facoltativa. Le sessioni che non la dichiarano non sono un errore, semplicemente non
        entrano in questa sezione — né nel calcolo dell'usura in Equipment.
      </Note>
    </Card>
  )
}

function CoverageRow({ icon, label, side }) {
  const share = side.all.share
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[11px] shrink-0">{icon}</span>
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        <span className="text-[9px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {side.matches.n}/{side.matches.total} part. · {side.trainings.n}/{side.trainings.total} all.
        </span>
        <span className="text-[11px] shrink-0 font-semibold"
              style={{ color: coverageColor(share), fontFamily: 'var(--font-mono)' }}>
          {share == null ? '—' : `${Math.round(share * 100)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${(share ?? 0) * 100}%`, background: coverageColor(share) }} />
      </div>
    </div>
  )
}

function CoverageInfo() {
  return (
    <>
      <InfoItem>
        Quante delle tue sessioni dicono quale racchetta e quali scarpe hai usato. È il primo blocco
        e non un dettaglio: ogni numero più sotto è calcolato <strong>solo</strong> su queste
        sessioni.
      </InfoItem>
      <InfoItem title="Perché conta">
        Se dichiari la racchetta in dieci partite su quaranta, il «61% dei game con questa
        racchetta» descrive quelle dieci — e di solito non sono dieci partite a caso, sono quelle in
        cui ti sei ricordato di compilare tutto, che spesso sono le più importanti. Sapere la
        copertura cambia quanto peso dare al resto.
      </InfoItem>
      <InfoItem title="Partite e allenamenti">
        Sono contati separatamente perché servono a cose diverse: le partite alimentano il confronto
        tra setup (che ha bisogno di un punteggio), gli allenamenti alimentano il consumo di corde e
        suola (che ha bisogno solo di sapere che hai giocato).
      </InfoItem>
      <InfoItem>
        Non c'è un obiettivo da raggiungere. Dichiarare l'attrezzatura è facoltativo apposta: serve
        solo a sapere quanto sono solidi i numeri che stai guardando.
      </InfoItem>
    </>
  )
}

// ── Blocco 1 — Il confronto tra setup ──────────────────────
// Il blocco più delicato della pagina. Non mostra una classifica: mostra dei
// punti con la loro incertezza, e dichiara se sono distinguibili.

function ComparisonBlock({ report, onDrill }) {
  const [dimension, setDimension] = useState('racket')
  const info = <InfoButton title="Il setup cambia qualcosa?"><ComparisonInfo /></InfoButton>

  const available = SETUP_DIMENSIONS.filter(d => (report.comparison.dimensions[d.id]?.rows.length || 0) > 0)
  if (available.length === 0) {
    return (
      <Card id="confronto" title="Il setup cambia qualcosa?" titleExtra={info}
            sub="Game vinti per racchetta, corda e tensione">
        <NotEnough need={1} unit="partite con la racchetta dichiarata"
                   what="Per confrontare i setup" />
      </Card>
    )
  }

  const active = available.find(d => d.id === dimension) || available[0]
  const d = report.comparison.dimensions[active.id]
  const overall = report.comparison.overall

  // Dominio del grafico: le percentuali di game vinti di un amatore stanno quasi
  // tutte tra il 40% e il 60%, e disegnarle su un asse 0-100 le schiaccerebbe in
  // un punto. L'asse si adatta ai dati (con i suoi estremi scritti sotto), che è
  // la stessa scelta delle barre divergenti dell'andamento in Rendimento.
  const domain = axisDomain(d.rows, overall.rate)

  return (
    <Card id="confronto" title="Il setup cambia qualcosa?" titleExtra={info}
          sub="Game vinti per racchetta, corda e tensione"
          right={<SampleTag n={overall.n} unit="partite" />}>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" style={{ minWidth: 0 }}>
        {available.map(dim => (
          <button key={dim.id} onClick={() => setDimension(dim.id)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0 transition-all"
            style={{
              background: active.id === dim.id ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
              color: active.id === dim.id ? 'var(--color-white)' : 'var(--color-slate)',
              fontFamily: 'var(--font-display)',
            }}>
            {dim.label}
          </button>
        ))}
      </div>

      <div className="space-y-3.5 mt-4">
        {d.rows.map(row => (
          <RateRow key={row.key} row={row} domain={domain} overall={overall.rate}
                   onClick={() => onDrill(row.label, row.matches, `${active.label}: ${row.label}`)} />
        ))}
      </div>

      {/* Estremi dell'asse: senza, un intervallo largo mezzo riquadro non ha
          scala e le barre tornano a essere una classifica. */}
      <div className="flex justify-between mt-2">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {Math.round(domain.min * 100)}%
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          la tacca chiara è la tua media ({Math.round((overall.rate ?? 0) * 100)}%)
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {Math.round(domain.max * 100)}%
        </span>
      </div>

      <Verdict d={d} />

      {d.undeclared > 0 && (
        <Note>
          {d.undeclared} {d.undeclared === 1 ? 'partita non è classificabile' : 'partite non sono classificabili'} su
          questa dimensione{active.id === 'racket'
            ? ' perché non dichiarano la racchetta'
            : ': la racchetta c\'è, ma per quella data non risulta nessuna incordatura registrata'}.
        </Note>
      )}
    </Card>
  )
}

// Una riga = un punto con il suo intervallo di confidenza. La barra piena delle
// altre sezioni qui sarebbe fuorviante: comunicherebbe una misura, mentre questo
// è un valore stimato con un'incertezza che spesso è più larga della differenza
// che si vorrebbe leggere.
function RateRow({ row, domain, overall, onClick }) {
  const pos = (v) => `${((v - domain.min) / (domain.max - domain.min)) * 100}%`
  const width = (a, b) => `${((b - a) / (domain.max - domain.min)) * 100}%`

  const color = !row.enough
    ? 'var(--color-slate)'
    : row.delta == null || Math.abs(row.delta) < 0.02
      ? 'var(--color-slate)'
      : row.delta > 0 ? 'var(--color-win)' : 'var(--color-loss)'

  return (
    <button onClick={onClick} className="w-full text-left transition-all active:scale-[0.99]"
            style={{ opacity: row.enough ? 1 : 0.5 }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {row.label}
        </span>
        <span className="text-[11px] shrink-0 font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {row.enough ? formatRateWithMoe(row.rate, row.moe) : `${Math.round((row.rate ?? 0) * 100)}%`}
        </span>
      </div>

      <div className="h-4 rounded-full mt-1.5 relative" style={{ background: 'var(--color-surface-2)' }}>
        {/* Intervallo di confidenza */}
        {row.lo != null && (
          <div className="absolute top-1/2 h-1.5 rounded-full"
               style={{
                 left: pos(clamp(row.lo, domain)),
                 width: width(clamp(row.lo, domain), clamp(row.hi, domain)),
                 transform: 'translateY(-50%)',
                 background: color, opacity: 0.3,
               }} />
        )}
        {/* Il valore osservato */}
        {row.rate != null && (
          <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full"
               style={{
                 left: pos(clamp(row.rate, domain)),
                 transform: 'translate(-50%, -50%)',
                 background: color, border: '2px solid var(--color-surface)',
               }} />
        )}
        {/* La media generale */}
        {overall != null && (
          <div className="absolute top-0 bottom-0 w-px"
               style={{ left: pos(clamp(overall, domain)), background: 'var(--color-white)', opacity: 0.35 }} />
        )}
      </div>

      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        {row.n} {row.n === 1 ? 'partita' : 'partite'} · {row.wins}V{row.draws ? ` · ${row.draws}P` : ''} · {row.losses}S
        {row.enough
          ? ` · ${Math.round(row.games)} game`
          : ` · servono ancora ${MIN_SETUP_MATCHES - row.n} partite`}
      </p>
    </button>
  )
}

// La conclusione del blocco, ed è la parte che vale più dei numeri sopra.
function Verdict({ d }) {
  if (!d.comparable) {
    const best = d.rows[0]
    return (
      <div className="mt-4">
        <NotEnough
          need={best ? Math.max(1, MIN_SETUP_MATCHES - best.n) : MIN_SETUP_MATCHES}
          unit="partite"
          what={`Per confrontare due ${d.label.toLowerCase()} servono ${MIN_SETUP_ROWS} voci da almeno ${MIN_SETUP_MATCHES} partite`} />
      </div>
    )
  }

  const points = Math.round((d.gap ?? 0) * 100)

  if (d.separable) {
    return (
      <div className="mt-4 rounded-xl px-3 py-3" style={{ background: 'var(--color-win-bg)' }}>
        <p className="text-[11px] font-semibold mb-1"
           style={{ color: 'var(--color-win)', fontFamily: 'var(--font-display)' }}>
          ✓ Differenza reale
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-white)' }}>
          Tra <strong>{d.best.label}</strong> e <strong>{d.worst.label}</strong> ci sono {points} punti
          di game vinti, e i due intervalli non si sovrappongono: è una delle rare differenze di
          setup che un campione amatoriale riesce a mostrare. Resta una correlazione — il periodo in
          cui usavi un materiale è anche il periodo dei suoi avversari e della tua forma.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl px-3 py-3" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-[11px] font-semibold mb-1"
         style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-display)' }}>
        🎲 Non distinguibile dal caso
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-white)' }}>
        {points > 0
          ? <>Tra <strong>{d.best.label}</strong> e <strong>{d.worst.label}</strong> ci sono {points} punti
            di game vinti, ma gli intervalli si sovrappongono: una differenza così, su questo numero di
            partite, è quello che il caso produce da solo. </>
          : <>Le voci sopra soglia rendono praticamente uguale. </>}
        {d.required
          ? <>Per poterla chiamare differenza servirebbero circa <strong>{d.required} partite</strong> con
            ciascun setup.</>
          : <>Una differenza di questa dimensione non è misurabile con il numero di partite che una
            stagione amatoriale produce.</>}
      </p>
    </div>
  )
}

function ComparisonInfo() {
  return (
    <>
      <InfoItem>
        Prende la tua percentuale di <strong>game vinti</strong> e la divide per materiale: una riga
        per racchetta, per corda, per tensione, o per il setup completo. Per ogni partita l'app sa
        quale racchetta hai usato, e dallo storico delle incordature ricava quali corde ci fossero
        sopra quel giorno.
      </InfoItem>
      <InfoItem title="Il pallino e la barretta chiara">
        Il pallino è la percentuale osservata. La barretta chiara intorno è il
        <strong> margine di errore</strong>: l'intervallo dentro cui sta ragionevolmente il tuo vero
        valore con quel setup. Il «± 8» accanto alla percentuale è la stessa cosa scritta in cifre —
        «58% ± 8» significa che il numero vero può stare tra il 50% e il 66%.
      </InfoItem>
      <InfoItem title="Perché serve un margine di errore">
        Perché è il numero che smonta le superstizioni sul materiale. Se giochi dieci partite con una
        tensione e dieci con un'altra, cinque punti di differenza tra le due escono per puro caso
        praticamente sempre: dipendono da chi hai incontrato e da com'eri quel giorno, non dai
        chilogrammi. Senza il margine, quei cinque punti diventano una convinzione.
      </InfoItem>
      <InfoItem title="Come si calcola">
        Dalla variabilità delle tue partite: si guarda quanto oscilla la percentuale di game vinti da
        una partita all'altra e si divide per la radice del numero di partite. L'unità è la
        <strong> partita</strong>, non il singolo game: due game della stessa partita non sono
        indipendenti (stesso avversario, stesso giorno, stesse gambe), e contarli come tali farebbe
        sembrare i numeri quattro volte più precisi di quanto siano.
      </InfoItem>
      <InfoItem title="«Non distinguibile dal caso»">
        Significa che gli intervalli dei due setup si sovrappongono: i dati non permettono di dire
        quale sia migliore. Non vuol dire che siano identici — vuol dire che, con queste partite, la
        differenza non è misurabile. Il numero di partite indicato è quante ne servirebbero per
        ciascun setup perché una differenza di quella dimensione diventi leggibile.
      </InfoItem>
      <InfoItem title={`La soglia di ${MIN_SETUP_MATCHES} partite`}>
        Sotto {MIN_SETUP_MATCHES} partite una riga resta in trasparenza e senza margine: è più severo
        del resto della pagina, perché altrove un numero fragile descrive una situazione di gioco,
        qui diventa una decisione d'acquisto.
      </InfoItem>
      <InfoItem title="Attenzione all'ordine dei fatti">
        Anche una differenza reale resta una correlazione. Il setup non è stato assegnato a caso:
        hai cambiato racchetta in un certo mese, e in quel mese giocavi contro certe persone, con
        una certa condizione fisica e una certa quantità di allenamento alle spalle. Il grafico non
        può separare il materiale da tutto il resto.
      </InfoItem>
      <InfoItem title="La tacca verticale chiara">
        La tua percentuale di game vinti complessiva. Le righe vanno lette rispetto a quella, non al
        50%. Tocca una riga per vedere le partite che l'hanno prodotta.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Asse adattato ai dati, con un margine ai lati e un'ampiezza minima: senza il
// minimo, tre righe quasi uguali riempirebbero tutta la larghezza e sembrerebbero
// lontanissime tra loro — l'errore opposto a quello dell'asse da zero.
const MIN_SPAN = 0.14

function axisDomain(rows, overall) {
  const values = []
  rows.forEach(r => {
    if (r.rate != null) values.push(r.rate)
    if (r.lo != null) { values.push(r.lo); values.push(r.hi) }
  })
  if (overall != null) values.push(overall)
  if (values.length === 0) return { min: 0.35, max: 0.65 }

  let min = Math.min(...values)
  let max = Math.max(...values)
  const pad = Math.max(0.02, (max - min) * 0.1)
  min -= pad
  max += pad

  if (max - min < MIN_SPAN) {
    const center = (max + min) / 2
    min = center - MIN_SPAN / 2
    max = center + MIN_SPAN / 2
  }
  return { min: Math.max(0, min), max: Math.min(1, max) }
}

function clamp(v, domain) {
  return Math.max(domain.min, Math.min(domain.max, v))
}

function coverageColor(share) {
  if (share == null) return 'var(--color-slate)'
  if (share >= 0.7) return 'var(--color-win)'
  if (share >= 0.4) return 'var(--color-amber)'
  return 'var(--color-loss)'
}
