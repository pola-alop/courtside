import { Card, Tile, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import MovementBlock from './MovementBlock'
import OutcomeBlock from './OutcomeBlock'
import { HR_ZONES, formatDuration, formatTrainingEffect, trainingEffectLabel } from '../../lib/athletics'
import { MIN_SIDE } from '../../lib/physical'

// Sezione "Fisico" — risponde a "come sto fisicamente, e sto migliorando?".
//
// L'unità qui non è né il game né il minuto: è il BATTITO. Tutto nasce da un
// campo solo — `athletics` — che le partite e gli allenamenti portano con la
// stessa identica shape, e che si compila trascrivendo a mano i dati
// dell'orologio. I blocchi vanno da com'è fatto lo sforzo a cosa ha prodotto:
//   0. Copertura dei dati  — su quante sessioni stiamo davvero ragionando
//   1. Zone FC             — dove passa il tuo tempo, e come cambia in partita
//   2. Profilo di stimolo  — che allenamento è, per te, il tennis
//   3. Movimento           — quanto ti muovi, a che ritmo, e come cambia
//   4. Economia cardiaca   — la metrica di fitness vera
//   5. Fisico ↔ risultato  — come sono fatte le partite che perdi
//
// ── Perché la copertura sta in TESTA e non in fondo ──
// Qui ogni singolo campo è facoltativo, e ogni blocco ha un campione diverso: la
// FC media può esserci su 13 sessioni e la distanza su 6. Un numero letto senza
// sapere su quante sessioni è calcolato non è un'informazione, è una
// suggestione — quindi la copertura è il primo blocco, non una nota a piè di
// pagina, e ogni card ripete il proprio `n`.
//
// ── Perché niente drill-down ──
// Come in Attività e Tecnica: i numeri nascono da partite e allenamenti insieme,
// e l'elenco delle sessioni esiste già ed è la Panoramica. Il dettaglio atletico
// di una singola sessione si legge dal suo detail modal, dove è già completo.

export default function Fisico({ report, periodLabel }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} unit="sessioni con dati atletici"
                   what="Per analizzare la tua condizione" />
        <Note>
          {report.total > report.n
            ? <>Hai {report.total} sessioni nel periodo ma solo {report.n} con i dati dell'orologio trascritti. </>
            : null}
          I dati atletici si aggiungono dal dettaglio di una partita o di un allenamento: distanza,
          durata, FC media e massima, zone e training effect sono tutti facoltativi, e ogni campo che
          compili apre un pezzo diverso di questa sezione.
        </Note>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CoverageCard report={report} periodLabel={periodLabel} />
      <ZonesCard report={report} />
      <StimulusCard report={report} />
      <MovementBlock report={report} />
      <OutcomeBlock report={report} />

      <Note>
        Tutti i numeri di questa sezione nascono da dati che hai trascritto a mano dall'orologio, e
        ogni campo è indipendente dagli altri: le medie qui sopra hanno campioni diversi, ed è per
        questo che ogni blocco porta il proprio «su quante sessioni». Le partite senza dati atletici
        non vengono stimate — in Attività la durata di un match si stima dai game, qui no: la stima
        cresce con i game giocati e farebbe apparire da sola una differenza tra vittorie e sconfitte
        che non è stata misurata.
      </Note>
    </div>
  )
}

// ── Blocco 0 — Copertura dei dati ──────────────────────────
// Non è un blocco di servizio: è la chiave di lettura di tutto ciò che segue, e
// per questo è il primo. Dichiara due cose diverse — su quante sessioni hai
// trascritto qualcosa, e di quelle quali campi hai davvero compilato.

function CoverageCard({ report, periodLabel }) {
  const c = report.coverage

  return (
    <Card id="copertura" title="Copertura dei dati" sub={periodLabel ? `Periodo: ${periodLabel.toLowerCase()}` : undefined}
          titleExtra={<InfoButton title="Cos'è la copertura dei dati?"><CoverageInfo /></InfoButton>}>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none"
             style={{ color: coverageColor(c.share), fontFamily: 'var(--font-display)' }}>
            {c.n}<span className="text-lg" style={{ color: 'var(--color-slate)' }}>/{c.total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Sessioni con dati atletici
          </p>
        </div>
        <p className="text-lg font-bold shrink-0"
           style={{ color: coverageColor(c.share), fontFamily: 'var(--font-display)' }}>
          {Math.round((c.share ?? 0) * 100)}%
        </p>
      </div>

      <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full"
             style={{ width: `${(c.share ?? 0) * 100}%`, background: coverageColor(c.share) }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Tile label="Partite" value={`${c.matches.n}/${c.matches.total}`} color="var(--color-amber)"
              sub={c.matches.share != null ? `${Math.round(c.matches.share * 100)}%` : '—'} />
        <Tile label="Allenamenti" value={`${c.trainings.n}/${c.trainings.total}`} color="var(--color-teal)"
              sub={c.trainings.share != null ? `${Math.round(c.trainings.share * 100)}%` : '—'} />
      </div>

      {/* Quale campo manca, quando trascrivi. È l'unica parte azionabile del
          blocco: dice cosa aggiungere alla routine per sbloccare un blocco. */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
          Campi compilati · sulle {c.n} sessioni trascritte
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

      <Note>
        Ogni blocco di questa sezione usa solo le sessioni in cui il campo che gli serve è
        compilato, e lo dichiara: è per questo che i «su quante sessioni» qui sotto non coincidono
        tra loro. Se un blocco non compare o resta chiuso, la riga corrispondente qui sopra dice
        quale campo gli manca.
      </Note>
    </Card>
  )
}

function CoverageInfo() {
  return (
    <>
      <InfoItem>
        Quante delle tue sessioni del periodo hanno i dati dell'orologio trascritti. È il primo
        blocco della sezione e non un dettaglio tecnico: tutto ciò che leggi più sotto è calcolato
        <strong> solo</strong> su queste sessioni, non su tutte quelle che hai giocato.
      </InfoItem>
      <InfoItem title="Perché conta così tanto">
        Una media su 3 sessioni su 31 non è una media, è un aneddoto: descrive le tre volte in cui
        ti sei ricordato di trascrivere i dati, che di solito non sono tre volte a caso — sono le
        partite importanti, o quelle in cui ti sei sentito bene. Sapere che la copertura è al 45%
        cambia quanto peso dare a tutto il resto.
      </InfoItem>
      <InfoItem title="Partite / Allenamenti">
        La copertura separata per i due tipi di sessione. Se trascrivi le partite e non gli
        allenamenti, i confronti «partita contro allenamento» di questa sezione restano chiusi:
        servono almeno {MIN_SIDE} sessioni per lato.
      </InfoItem>
      <InfoItem title="Campi compilati">
        Anche quando trascrivi, non trascrivi tutto: puoi avere la FC media e non la distanza. Ogni
        campo apre blocchi diversi — la distanza e la durata aprono il Movimento, la FC media più la
        distanza aprono l'Economia cardiaca, le zone aprono la distribuzione, il training effect
        apre il Profilo di stimolo. Le barre dicono quale campo stai saltando più spesso.
      </InfoItem>
      <InfoItem>
        Non esiste un obiettivo di copertura da raggiungere: i campi sono facoltativi apposta,
        perché trascriverli è un lavoro. Serve solo a sapere quanto sono solidi i numeri che stai
        guardando.
      </InfoItem>
    </>
  )
}

// ── Blocco 1 — Zone di frequenza cardiaca ──────────────────
// La somma dei secondi zona per zona su tutto il periodo, non la media delle
// percentuali delle singole sessioni: pesare per il tempo è l'unico modo di non
// far contare un riscaldamento di venti minuti quanto una partita di due ore.

function ZonesCard({ report }) {
  const z = report.zones
  const info = <InfoButton title="Cosa sono le zone di frequenza cardiaca?"><ZonesInfo /></InfoButton>

  if (!z.enough) {
    return (
      <Card id="zone" title="Zone di frequenza cardiaca" titleExtra={info}
            sub="Dove passa il tuo tempo in campo">
        <NotEnough need={z.missing} unit="sessioni con le zone trascritte"
                   what="Per la distribuzione delle zone" />
      </Card>
    )
  }

  const dominant = z.all.dominant != null ? HR_ZONES[z.all.dominant] : null

  return (
    <Card id="zone" title="Zone di frequenza cardiaca" titleExtra={info}
          sub="Dove passa il tuo tempo in campo"
          right={<SampleTag n={z.all.n} unit="sessioni" />}>

      <ZoneBar shares={z.all.shares} />

      <div className="space-y-1.5 mt-3">
        {HR_ZONES.map((zone, i) => (
          z.all.secs[i] > 0 ? (
            <div key={zone.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: zone.color }} />
              <span className="text-[11px] font-semibold shrink-0"
                    style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {zone.label}
              </span>
              <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--color-slate)' }}>{zone.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                {formatDuration(z.all.secs[i])}
              </span>
              <span className="text-[11px] w-9 text-right shrink-0"
                    style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(z.all.shares[i] * 100)}%
              </span>
            </div>
          ) : null
        ))}
      </div>

      {dominant && (
        <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--color-white)' }}>
          Passi la maggior parte del tempo in <strong>{dominant.label} · {dominant.name}</strong>, e
          il {Math.round((z.all.highShare ?? 0) * 100)}% del tempo totale sopra la soglia (Z4-Z5),
          su {formatDuration(z.all.total)} registrati.
        </p>
      )}

      {/* Il confronto è il punto del blocco: la distribuzione aggregata dice
          com'è fatto il tuo tennis, il confronto dice se lo stai allenando. */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
          Partita contro allenamento
        </p>

        {z.comparable ? (
          <>
            <SideBar label="Partite" side={z.match} />
            <SideBar label="Allenamenti" side={z.training} className="mt-3" />

            {z.highGap != null && (
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
                {Math.abs(z.highGap) < 0.08
                  ? `Sopra soglia stai praticamente lo stesso tempo in partita (${Math.round(z.match.highShare * 100)}%) e in allenamento (${Math.round(z.training.highShare * 100)}%): ti alleni all'intensità a cui giochi.`
                  : z.highGap > 0
                    ? `In partita stai in Z4-Z5 il ${Math.round(z.match.highShare * 100)}% del tempo, in allenamento il ${Math.round(z.training.highShare * 100)}%: ti alleni più piano di come giochi, e la differenza la paghi nei finali di set.`
                    : `In allenamento stai in Z4-Z5 il ${Math.round(z.training.highShare * 100)}% del tempo, in partita il ${Math.round(z.match.highShare * 100)}%: gli allenamenti sono più duri delle partite, il che va bene finché arrivi fresco a giocare.`}
              </p>
            )}
          </>
        ) : (
          <NotEnough
            need={Math.max(z.missingMatch, z.missingTraining)}
            unit={z.missingMatch >= z.missingTraining ? 'partite con le zone' : 'allenamenti con le zone'}
            what="Per confrontare partita e allenamento" />
        )}
      </div>

      <Note>
        I secondi sono <strong>sommati</strong> zona per zona su tutto il periodo, non mediati tra le
        sessioni: così una partita di due ore pesa il doppio di un allenamento da un'ora, che è
        esattamente quello che deve fare. Le percentuali sono sul tempo registrato dall'orologio
        ({formatDuration(z.all.total)}), che può essere meno della durata reale delle sessioni se
        l'hai avviato in ritardo.
      </Note>
    </Card>
  )
}

// Barra impilata delle cinque zone. Le zone a 0 non occupano spazio: uno
// spicchio da 0px con il suo bordo diventerebbe una riga di colore fantasma.
function ZoneBar({ shares, height = 10 }) {
  return (
    <div className="flex w-full rounded-full overflow-hidden"
         style={{ height, background: 'var(--color-surface-2)' }}>
      {HR_ZONES.map((z, i) => (
        shares[i] > 0
          ? <div key={z.id} title={`${z.label} · ${z.name}: ${Math.round(shares[i] * 100)}%`}
                 style={{ width: `${shares[i] * 100}%`, background: z.color }} />
          : null
      ))}
    </div>
  )
}

// Una riga del confronto: etichetta, quota sopra soglia, barra. La quota Z4-Z5
// è ripetuta in cifre perché è l'unico numero che si confronta davvero tra i due
// lati — a occhio, due barre impilate simili sono indistinguibili.
function SideBar({ label, side, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        <span className="text-[9px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {side.n} {side.n === 1 ? 'sessione' : 'sessioni'} · {formatDuration(side.total)}
        </span>
        <span className="text-[11px] shrink-0 font-semibold"
              style={{ color: 'var(--color-zone-4)', fontFamily: 'var(--font-mono)' }}>
          {Math.round((side.highShare ?? 0) * 100)}% Z4-5
        </span>
      </div>
      <ZoneBar shares={side.shares} height={8} />
    </div>
  )
}

function ZonesInfo() {
  return (
    <>
      <InfoItem>
        L'orologio divide la frequenza cardiaca in cinque fasce, dalla più leggera alla più dura:
        <strong> Z1 riscaldamento</strong>, <strong>Z2 facile</strong>, <strong>Z3 aerobica</strong>,
        <strong> Z4 soglia</strong>, <strong>Z5 massimale</strong>. Questo blocco somma quanto tempo
        hai passato in ognuna, su tutte le sessioni del periodo.
      </InfoItem>
      <InfoItem title="Come si legge la barra">
        È la fotografia di che tipo di sforzo è il tennis per il tuo cuore. Molto Z2-Z3 significa
        uno sforzo continuo e sostenibile; molto Z4-Z5 significa uno sforzo che consuma e da cui
        serve recuperare. Non c'è una distribuzione «giusta»: c'è la tua, ed è quella con cui
        confrontare gli allenamenti.
      </InfoItem>
      <InfoItem title="Perché i secondi si sommano e non si mediano">
        Se si facesse la media delle percentuali delle singole sessioni, un riscaldamento di venti
        minuti peserebbe quanto una partita di due ore. Sommando i secondi, ogni sessione pesa per
        quanto è durata davvero.
      </InfoItem>
      <InfoItem title="La quota Z4-Z5">
        Il tempo sopra la soglia, cioè la parte di sforzo che non è sostenibile a lungo. È l'unico
        numero delle zone che si confronta davvero tra partita e allenamento: due barre impilate
        simili a occhio sono indistinguibili, una differenza di 20 punti percentuali sopra soglia
        no.
      </InfoItem>
      <InfoItem title="Partita contro allenamento">
        Il confronto che vale il blocco. Se in partita passi il 35% del tempo sopra soglia e in
        allenamento il 10%, stai preparando un'intensità che non è quella in cui giochi: i colpi
        li hai provati, ma non con quel cuore. Compare da {MIN_SIDE} sessioni per lato in su,
        perché sotto sarebbero due giornate storte messe a confronto.
      </InfoItem>
      <InfoItem>
        Le percentuali sono calcolate sul tempo che l'orologio ha registrato nelle zone, non sulla
        durata della sessione: se l'hai avviato a metà riscaldamento, quei minuti non ci sono.
      </InfoItem>
    </>
  )
}

// ── Blocco 2 — Profilo di stimolo ──────────────────────────
// Il training effect di Garmin/Firstbeat dice, sulla stessa scala 0-5, quanto
// una sessione ha stimolato il sistema aerobico e quanto quello anaerobico.
// Mediati sul periodo rispondono a una domanda che nessuna app di tennis pone:
// il tennis, PER TE, che allenamento è.

function StimulusCard({ report }) {
  const s = report.stimulus
  const info = <InfoButton title="Cos'è il profilo di stimolo?"><StimulusInfo /></InfoButton>

  if (!s.enough) {
    return (
      <Card id="stimolo" title="Profilo di stimolo" titleExtra={info}
            sub="Che allenamento è, per te, il tennis">
        <NotEnough need={s.missing} unit="sessioni con il training effect"
                   what="Per il profilo di stimolo" />
      </Card>
    )
  }

  return (
    <Card id="stimolo" title="Profilo di stimolo" titleExtra={info}
          sub="Che allenamento è, per te, il tennis"
          right={<SampleTag n={s.all.aerobicN} unit="sessioni" />}>

      <div className="flex gap-3">
        <TeValue label="Aerobico" value={s.all.aerobic} n={s.all.aerobicN} dot="var(--color-draw)" />
        <TeValue label="Anaerobico" value={s.all.anaerobic} n={s.all.anaerobicN} dot="var(--color-slate)" />
      </div>

      <div className="mt-4 space-y-3">
        <TeAxis label="Aerobico" value={s.all.aerobic} />
        {s.all.anaerobic != null && <TeAxis label="Anaerobico" value={s.all.anaerobic} />}
      </div>

      {s.profile && (
        <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--color-white)' }}>
          <strong>{s.profile.label}</strong>
          {s.all.anaerobic != null
            ? ` — ${s.profile.hint}. Il tuo tennis stimola il sistema aerobico a ${formatTrainingEffect(s.all.aerobic)} (${trainingEffectLabel(s.all.aerobic)?.toLowerCase()}) e quello anaerobico a ${formatTrainingEffect(s.all.anaerobic)} (${trainingEffectLabel(s.all.anaerobic)?.toLowerCase()}).`
            : `. L'effetto anaerobico non è ancora stato trascritto abbastanza volte: senza, il profilo resta metà.`}
        </p>
      )}

      {s.comparable && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
            Partita contro allenamento · effetto aerobico
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="In partita" value={formatTrainingEffect(s.match.aerobic)}
                  sub={`${s.match.aerobicN} sess.`} color="var(--color-amber)" />
            <Tile label="In allenamento" value={formatTrainingEffect(s.training.aerobic)}
                  sub={`${s.training.aerobicN} sess.`} color="var(--color-teal)" />
          </div>
        </div>
      )}

      <Note>
        Il training effect è un numero che calcola l'orologio, non l'app: stima quanto una singola
        sessione ha spostato la tua condizione, sulla scala 0-5 di Garmin/Firstbeat. Qui è
        <strong> mediato</strong> sulle sessioni del periodo in cui l'hai trascritto, quindi
        descrive la sessione tipo — non la somma del lavoro fatto.
        {s.all.anaerobicN < s.all.aerobicN && ` L'effetto anaerobico è compilato su ${s.all.anaerobicN} sessioni contro le ${s.all.aerobicN} dell'aerobico: sono due campioni diversi.`}
      </Note>
    </Card>
  )
}

function TeValue({ label, value, n, dot }) {
  return (
    <div className="flex-1 min-w-0 pt-2" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
      <p className="text-2xl font-bold leading-none"
         style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
        {formatTrainingEffect(value)}
      </p>
      <span className="text-[10px] flex items-center gap-1.5 mt-1" style={{ color: 'var(--color-slate)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
        {label}
      </span>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {n} {n === 1 ? 'sessione' : 'sessioni'}
      </p>
    </div>
  )
}

// Un asse del training effect con la sua fascia. La barra a segmenti ricalca
// quella di AthleticsSection (stesse soglie, stessi colori): è duplicata invece
// che estratta perché lì è un componente privato del dettaglio sessione, e
// condividerla significherebbe esportare una primitiva visiva da un file che
// non ne esporta nessun'altra — stessa scelta già fatta per heatColor, che vive
// identico in Attivita.jsx e Tecnica.jsx.
const TE_SEGMENT_COLORS = ['var(--color-slate)', 'var(--color-slate)', 'var(--color-draw)', 'var(--color-win)', 'var(--color-amber)']

function TeAxis({ label, value }) {
  if (value == null) return null
  const pct = Math.min(100, Math.max(0, (value / 5) * 100))
  const dotColor = value >= 5 ? 'var(--color-loss)' : TE_SEGMENT_COLORS[Math.min(4, Math.floor(Math.max(0, value)))]

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px]" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>{trainingEffectLabel(value)}</span>
      </div>
      <div className="relative flex h-2">
        {TE_SEGMENT_COLORS.map((color, i) => (
          <div key={i} className="h-full"
               style={{
                 flex: 1, background: color,
                 marginRight: i < TE_SEGMENT_COLORS.length - 1 ? 2 : 0,
                 borderTopLeftRadius: i === 0 ? 9999 : 0,
                 borderBottomLeftRadius: i === 0 ? 9999 : 0,
                 borderTopRightRadius: i === TE_SEGMENT_COLORS.length - 1 ? 9999 : 0,
                 borderBottomRightRadius: i === TE_SEGMENT_COLORS.length - 1 ? 9999 : 0,
               }} />
        ))}
        <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full"
             style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: dotColor, border: '3px solid var(--color-surface)' }} />
      </div>
    </div>
  )
}

function StimulusInfo() {
  return (
    <>
      <InfoItem>
        Il <strong>training effect</strong> è un numero che calcola il tuo orologio (Garmin,
        Firstbeat e derivati) alla fine di ogni attività: stima quanto quella singola sessione ha
        spostato la tua condizione, sulla scala 0-5. Ne esistono due, uno per ciascun motore del
        corpo, e il tennis li usa entrambi.
      </InfoItem>
      <InfoItem title="Aerobico e anaerobico">
        L'<strong>aerobico</strong> è lo sforzo continuo, quello che sostieni per un'ora: correre
        avanti e indietro per due set. L'<strong>anaerobico</strong> è lo sforzo esplosivo che non
        puoi sostenere: lo scatto sulla palla corta, il cambio di direzione, il salto sullo smash.
        Un tennista che gioca palleggiando da fondo campo avrà un profilo quasi solo aerobico; uno
        che gioca a strappi avrà l'anaerobico alto.
      </InfoItem>
      <InfoItem title="La scala 0-5">
        Sotto 1 nessun effetto, 1-2 effetto minore, 2-3 mantenimento (la sessione mantiene la
        condizione che hai), 3-4 miglioramento, 4-5 forte miglioramento, 5 eccessivo. Le barre
        colorate qui sopra sono le stesse che vedi nel dettaglio di una sessione, con le stesse
        soglie.
      </InfoItem>
      <InfoItem title="Cosa significa la media">
        È la media delle sessioni del periodo in cui hai trascritto il dato, quindi descrive la
        <strong> sessione tipo</strong>, non il totale del lavoro: dieci allenamenti da 2,5 non
        fanno 25. Se la media aerobica sta a 2,5 il tuo tennis, da solo, ti mantiene dove sei — è
        l'informazione che dice se serve altro lavoro fuori dal campo per progredire.
      </InfoItem>
      <InfoItem title="Perché i due numeri hanno campioni diversi">
        Aerobico e anaerobico sono due campi separati nel wizard, e capita di trascriverne solo uno.
        Ognuno porta il proprio «su quante sessioni»: se sono diversi, i due valori non sono
        calcolati sulle stesse giornate e il confronto tra loro va preso con più cautela.
      </InfoItem>
      <InfoItem title="Partita contro allenamento">
        L'effetto aerobico medio in partita e in allenamento. Compare solo se hai abbastanza
        sessioni trascritte di entrambi i tipi. Se l'allenamento sta molto sotto, sta mantenendo
        una condizione che le partite invece consumano.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

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
