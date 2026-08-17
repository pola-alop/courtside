import { Card, Tile, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import LoadBlock from './LoadBlock'
import MixBlock from './MixBlock'
import SurfaceBlock from './SurfaceBlock'
import {
  MIN_WEEKS, MONTHS_SHORT, formatHoursValue, formatDuration,
} from '../../lib/activity'

// Sezione "Attività" — risponde a "quanto gioco, e con quanta costanza?".
//
// L'unità di misura qui è il MINUTO, non il game: Rendimento misura quanto sei
// forte, questa sezione misura quanto e come ci sei stato, in campo. I blocchi
// vanno dal totale alla sua forma:
//   1. Volume            — quante ore, come si dividono, come cambiano
//   2. Costanza          — settimane attive, striscia, buchi, giorni preferiti
//   3. Carico e ACWR     — la stessa attività letta come dose di allenamento
//   4. Stagionalità      — la forma dell'anno tennistico
//   5. Mix dei blocchi   — che tipo di tennista sono
//   6. Con chi           — maestro, compagno, gruppo, da solo
//   7. Superfici         — ti alleni dove giochi?
//
// ── Perché niente drill-down qui ──
// In Rendimento ogni numero apre le partite che l'hanno prodotto, perché sono
// tutti calcolati sui match. Qui la maggior parte dei numeri nasce dagli
// allenamenti, e aprire un elenco misto partite+allenamenti richiederebbe una
// modale nuova per un gesto che in questa sezione nessuno compie: da "ore in
// campo" non si vuole scendere alla singola sessione, si vuole confrontare i
// periodi. L'elenco delle sessioni esiste già, ed è la Panoramica.

export default function Attivita({ report, periodLabel }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} unit="sessioni" what="Per analizzare la tua attività" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <VolumeCard report={report} periodLabel={periodLabel} />
      <ConsistencyCard report={report} />
      <LoadBlock report={report} />
      <SeasonalityCard report={report} />
      <MixBlock report={report} />
      <SurfaceBlock report={report} />

      <Note>
        Le partite non hanno un campo durata: quando i dati atletici non sono stati
        trascritti la durata è <strong>stimata dai game giocati</strong> (5 minuti a game),
        ed è per questo che i totali che le contengono portano il prefisso «~».
        Gli allenamenti invece hanno sempre una durata reale, la somma dei loro blocchi.
      </Note>
    </div>
  )
}

// ── Blocco 1 — Volume ──────────────────────────────────────

function VolumeCard({ report, periodLabel }) {
  const v = report.volume

  return (
    <Card id="volume" title="Volume" titleExtra={<InfoButton title="Cos'è il Volume?"><VolumeInfo /></InfoButton>}
          right={<SampleTag n={v.n} unit="sessioni" />}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            {formatHoursValue(v.minutes, v.estimated)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Ore in campo
            {v.deltaMinutes != null && (
              <span className="ml-1.5" style={{
                color: Math.abs(v.deltaMinutes) < 30 ? 'var(--color-slate)'
                  : v.deltaMinutes > 0 ? 'var(--color-win)' : 'var(--color-loss)',
                fontFamily: 'var(--font-mono)',
              }}>
                {v.deltaMinutes > 0 ? '▲' : v.deltaMinutes < 0 ? '▼' : '='}
                {formatHoursValue(Math.abs(v.deltaMinutes))} h vs prima
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold leading-none"
             style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            {formatHoursValue(v.perWeekMinutes ?? 0, v.estimated)}
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--color-slate)' }}>
            Ore a settimana
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {v.perWeekSessions != null ? v.perWeekSessions.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '—'} sess./sett.
          </p>
        </div>
      </div>

      {/* Due serie sole (partite / allenamenti): la barra basta e la legenda sta
          sotto, con i valori accanto al colore — mai il colore da solo. */}
      <div className="mt-4">
        <div className="h-2.5 rounded-full overflow-hidden flex gap-[2px]" style={{ background: 'var(--color-surface-2)' }}>
          <div style={{ width: `${(v.minutes ? v.matchMin / v.minutes : 0) * 100}%`, background: 'var(--color-amber)' }} />
          <div style={{ width: `${(v.minutes ? v.trainingMin / v.minutes : 0) * 100}%`, background: 'var(--color-teal-dark)' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <LegendItem color="var(--color-amber)"
                      label={`Partite ${formatHoursValue(v.matchMin, v.estimated)} h`}
                      sub={`${Math.round((v.matchShare ?? 0) * 100)}%`} />
          <LegendItem color="var(--color-teal-dark)" align="right"
                      label={`Allenamenti ${formatHoursValue(v.trainingMin)} h`}
                      sub={`${100 - Math.round((v.matchShare ?? 0) * 100)}%`} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        <Tile label="Partite" value={String(v.matchCount)} color="var(--color-amber)" />
        <Tile label="Allenamenti" value={String(v.trainingCount)} color="var(--color-teal)" />
        <Tile label="Giorni in campo" value={String(v.activeDays)} sub={`su ${v.days}`} />
        <Tile label="Sessione media" value={formatDuration(v.avgSessionMinutes ?? 0)} />
      </div>

      <Note>
        {periodLabel ? `${periodLabel}: ` : ''}{v.days} giorni di calendario, di cui {v.activeDays} con
        almeno una sessione. La media settimanale è calcolata su {v.weeks.toLocaleString('it-IT', { maximumFractionDigits: 1 })} settimane
        (frazionarie: 90 giorni sono 12,9 settimane, non 13).
        {v.deltaMinutes == null && ' Il confronto con il periodo precedente compare quando anche quello ha abbastanza sessioni registrate.'}
      </Note>
    </Card>
  )
}

function VolumeInfo() {
  return (
    <>
      <InfoItem>
        Quante ore hai passato in campo nel periodo selezionato, sommando partite e allenamenti, e
        come quelle ore si distribuiscono.
      </InfoItem>
      <InfoItem title="Ore in campo">
        Il totale del periodo. Per gli allenamenti è la somma esatta dei blocchi che hai registrato
        (es. 30' di lezione + 30' di match play = 1 ora). Per le partite non esiste un campo durata:
        se hai trascritto i dati dell'orologio si usa la durata reale, altrimenti viene
        <strong> stimata dai game giocati</strong> contando 5 minuti a game. Quando almeno una
        partita è stimata, il numero porta il prefisso «~».
      </InfoItem>
      <InfoItem title="La freccia ▲ / ▼">
        Quante ore in più o in meno rispetto al periodo precedente della stessa durata (es. i 90
        giorni prima di questi 90). Compare solo se anche il periodo precedente ha abbastanza
        sessioni registrate, altrimenti il confronto direbbe solo che prima non usavi l'app.
      </InfoItem>
      <InfoItem title="Ore a settimana">
        Le ore totali divise per le settimane del periodo: è il numero da confrontare tra periodi di
        lunghezza diversa, perché "40 ore" significa cose opposte in 90 giorni o in 12 mesi. Sotto
        trovi quante sessioni fai in media a settimana.
      </InfoItem>
      <InfoItem title="La barra partite / allenamenti">
        Come si dividono le ore tra il giocare (arancione) e l'allenarsi (verde acqua). Non esiste
        una proporzione "giusta": serve a vedere se stai solo giocando partite senza costruire
        niente, o il contrario.
      </InfoItem>
      <InfoItem title="Giorni in campo / Sessione media">
        <strong>Giorni in campo</strong>: quanti giorni distinti hai giocato, su quanti giorni ha il
        periodo — due sessioni nello stesso giorno contano come un giorno solo.
        <strong> Sessione media</strong>: la durata media di una singola sessione.
      </InfoItem>
    </>
  )
}

// ── Blocco 2 — Costanza ────────────────────────────────────

function ConsistencyCard({ report }) {
  const c = report.consistency

  return (
    <Card id="costanza" title="Costanza" sub="Come è distribuito il volume, non quanto è grande"
          titleExtra={<InfoButton title="Cos'è la Costanza?"><ConsistencyInfo /></InfoButton>}>

      {c.enoughWeeks ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-3xl font-bold leading-none"
                 style={{ color: shareColor(c.activeShare), fontFamily: 'var(--font-display)' }}>
                {Math.round((c.activeShare ?? 0) * 100)}%
              </p>
              <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
                Settimane con almeno una sessione
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                {c.activeWeeks} su {c.weeks}
              </p>
            </div>
          </div>

          {/* Una cella per settimana del periodo: la striscia rende visibile
              dove sono i buchi, che è la cosa che la percentuale nasconde. */}
          <WeekStrip weeks={report.weeks} />
        </>
      ) : (
        <NotEnough need={MIN_WEEKS - c.weeks} unit="settimane"
                   what="Per misurare la costanza" />
      )}

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Tile label="Striscia attiva" value={c.streakWeeks ? `${c.streakWeeks}` : '—'}
              sub={c.streakWeeks === 1 ? 'settimana' : 'settimane'}
              color={c.streakWeeks >= 4 ? 'var(--color-win)' : 'var(--color-white)'} />
        <Tile label="Stop più lungo" value={c.longestGap ? `${c.longestGap}` : '—'} sub="giorni"
              color={c.longestGap >= 21 ? 'var(--color-amber)' : 'var(--color-white)'} />
        <Tile label="Ultima sessione" value={c.sinceLast == null ? '—' : c.sinceLast === 0 ? 'oggi' : `${c.sinceLast}`}
              sub={c.sinceLast === 0 ? '' : 'giorni fa'}
              color={c.sinceLast != null && c.sinceLast >= 14 ? 'var(--color-loss)' : 'var(--color-white)'} />
      </div>

      <WeekdayChart weekday={c.weekday} max={c.weekdayMax} />

      <Note>
        Striscia e ultima sessione sono calcolate su <strong>tutto lo storico rispetto a oggi</strong>,
        non sul periodo selezionato: sono lo stato attuale, e cambiarli scegliendo un altro
        periodo li renderebbe insensati. La settimana comincia di lunedì, e quella in corso non
        interrompe la striscia finché non finisce. La percentuale conta solo le settimane di cui il
        periodo contiene almeno 4 giorni già trascorsi — le due mezze settimane agli estremi la
        abbasserebbero senza che tu abbia saltato niente — mentre la striscia qui sopra le mostra
        tutte.
      </Note>
    </Card>
  )
}

function ConsistencyInfo() {
  return (
    <>
      <InfoItem>
        La media settimanale nasconde il modo in cui giochi: 8 ore in due settimane e poi tre
        settimane ferme danno la stessa media di 1,6 ore a settimana per cinque settimane, ma sono
        due stagioni completamente diverse. Questo blocco misura la distribuzione, non il totale.
      </InfoItem>
      <InfoItem title="Settimane con almeno una sessione">
        Su tutte le settimane del periodo, in quante sei sceso in campo almeno una volta. È la
        misura più onesta di costanza, perché non premia chi concentra tutto in pochi giorni. Sotto
        c'è la striscia: una cella per settimana, accesa in proporzione alle ore — i buchi si vedono
        a colpo d'occhio. Le settimane a cavallo dell'inizio e della fine del periodo, di cui restano
        meno di 4 giorni trascorsi, non entrano nel conteggio: non sono settimane in cui non hai
        giocato, sono settimane in cui non hai avuto modo.
      </InfoItem>
      <InfoItem title="Striscia attiva">
        Da quante settimane consecutive giochi almeno una volta, contate all'indietro da oggi. La
        settimana in corso non spezza la striscia finché non è finita: il lunedì mattina non hai
        ancora avuto modo di giocarci.
      </InfoItem>
      <InfoItem title="Stop più lungo">
        Il buco più lungo del periodo: quanti giorni consecutivi sei rimasto senza scendere in
        campo, tra una sessione e la successiva. L'inizio e la fine del periodo non contano come
        buco — sono solo il punto in cui il periodo è stato ritagliato.
      </InfoItem>
      <InfoItem title="Ultima sessione">
        Quanti giorni sono passati dall'ultima sessione registrata. Come la striscia, è calcolata su
        tutto lo storico rispetto a oggi.
      </InfoItem>
      <InfoItem title="Giorni della settimana">
        Quanti minuti giochi in media in ciascun giorno. Se il tennis è incastrato in uno o due
        giorni fissi, ogni volta che salta quel giorno salta la settimana intera: è la causa più
        comune di una costanza bassa a parità di buona volontà.
      </InfoItem>
    </>
  )
}

// Striscia settimanale: una cella per settimana del periodo, accesa in
// proporzione ai minuti. Stessa idea della striscia di densità di
// ActivityTimeline, ma con la settimana come unità invece del giorno — su 12
// mesi le celle giornaliere sarebbero 365 e diventerebbero illeggibili.
function WeekStrip({ weeks }) {
  if (!weeks.length) return null
  const max = Math.max(1, ...weeks.map(w => w.minutes))

  // Su "12 mesi" le celle sono 53: a 2px di distanziatore i vuoti mangerebbero
  // un terzo della larghezza e la striscia diventerebbe una fila di puntini.
  const gap = weeks.length > 26 ? 1 : 2

  return (
    <div className="mt-3">
      <div className="flex items-stretch h-6" style={{ gap }}>
        {weeks.map(w => (
          <div key={w.start} className="flex-1 min-w-0 rounded-[2px]"
               title={`${weekLabel(w.start)} · ${w.n === 0 ? 'nessuna sessione' : `${w.n} sessioni, ${formatDuration(w.minutes)}`}`}
               style={{
                 background: w.minutes > 0 ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                 opacity: w.minutes > 0 ? 0.35 + 0.65 * (w.minutes / max) : 1,
               }} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {weekLabel(weeks[0].start)}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {weekLabel(weeks[weeks.length - 1].start)}
        </span>
      </div>
    </div>
  )
}

// Una sola serie (i minuti), quindi nessuna legenda: il colore non porta
// identità, porta magnitudine. Ogni barra è etichettata dal suo giorno.
function WeekdayChart({ weekday, max }) {
  if (!max) return null
  return (
    <div className="mt-4">
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        Giorni della settimana · minuti totali
      </p>
      {/* Niente altezza fissa sulla riga: ogni colonna è conteggio + barra +
          etichetta, e un h-16 la farebbe sbordare sul blocco successivo. */}
      <div className="flex gap-1.5 items-end">
        {weekday.map(d => (
          <div key={d.index} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
               title={`${d.label}: ${d.n} sessioni, ${formatDuration(d.minutes)}`}>
            <span className="text-[8px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {d.n || ''}
            </span>
            <div className="w-full rounded-t-[3px]"
                 style={{
                   height: `${Math.max(2, (d.minutes / max) * 38)}px`,
                   background: d.minutes === max ? 'var(--color-teal)' : 'var(--color-teal-dark)',
                   opacity: d.minutes === 0 ? 0.25 : 1,
                 }} />
            <span className="text-[8px]" style={{ color: 'var(--color-slate)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Blocco 4 — Stagionalità ────────────────────────────────

function SeasonalityCard({ report }) {
  const s = report.seasonality
  if (!s.years.length) return null

  // Scala sequenziale a UN SOLO tono (teal chiaro → teal pieno): la heatmap
  // codifica una magnitudine, e una scala arcobaleno inventerebbe categorie che
  // nei dati non esistono. I mesi fuori dallo storico non sono "zero ore": sono
  // celle vuote, e si disegnano come tali.
  return (
    <Card id="stagionalita" title="Stagionalità" sub="La forma del tuo anno tennistico"
          titleExtra={<InfoButton title="Cos'è la Stagionalità?"><SeasonalityInfo /></InfoButton>}>

      <div style={{ display: 'grid', gridTemplateColumns: '20px repeat(12, 1fr)', gap: 2 }}>
        <span />
        {MONTHS_SHORT.map(m => (
          <span key={m} className="text-[7px] text-center" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {m[0]}
          </span>
        ))}
        {s.years.map(y => (
          <HeatRow key={y.year} year={y} max={s.max} estimated={s.estimated} />
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>0 h</span>
        {[0, 0.25, 0.5, 0.75, 1].map(step => (
          <span key={step} className="w-4 h-2.5 rounded-[2px]" style={{ background: heatColor(step) }} />
        ))}
        <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
          {formatHoursValue(s.max, s.estimated)} h
        </span>
        <span className="w-4 h-2.5 rounded-[2px] ml-2" style={{ border: '1px dashed var(--color-surface-2)' }} />
        <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>fuori storico</span>
      </div>

      {s.years.length >= 2 && <MonthAverage monthAvg={s.monthAvg} estimated={s.estimated} />}

      <Note>
        Ogni cella è un mese, più è piena più ore hai giocato; tienila premuta per il
        dettaglio. Con due o più stagioni i buchi strutturali dell'anno — agosto,
        dicembre — si separano da soli dai mesi in cui semplicemente non hai giocato.
        La heatmap segue il periodo selezionato: su «90 giorni» mostrerà tre celle.
      </Note>
    </Card>
  )
}

function HeatRow({ year, max, estimated }) {
  return (
    <>
      <span className="text-[8px] flex items-center" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
        {String(year.year).slice(2)}
      </span>
      {year.months.map(m => (
        <div key={m.month}
             className="rounded-[2px]"
             style={{
               height: 18,
               background: m.inSpan ? heatColor(max ? m.minutes / max : 0) : 'transparent',
               border: m.inSpan ? 'none' : '1px dashed var(--color-surface-2)',
             }}
             title={m.inSpan
               ? `${MONTHS_SHORT[m.month]} ${year.year}: ${m.n === 0 ? 'niente' : `${m.n} sessioni · ${formatHoursValue(m.minutes, estimated)} h`}`
               : `${MONTHS_SHORT[m.month]} ${year.year}: fuori dallo storico`} />
      ))}
    </>
  )
}

function MonthAverage({ monthAvg, estimated }) {
  const max = Math.max(1, ...monthAvg.map(m => m.minutes || 0))
  return (
    <div className="mt-4">
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        Media per mese, su tutte le stagioni
      </p>
      <div className="flex gap-[3px] items-end">
        {monthAvg.map(m => (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
               title={`${m.label}: ${m.minutes == null ? 'nessun dato' : `${formatHoursValue(m.minutes, estimated)} h di media su ${m.years} ${m.years === 1 ? 'stagione' : 'stagioni'}`}`}>
            <div className="w-full rounded-t-[3px]"
                 style={{
                   height: `${Math.max(2, ((m.minutes || 0) / max) * 32)}px`,
                   background: 'var(--color-teal-dark)',
                   opacity: m.minutes ? 1 : 0.25,
                 }} />
            <span className="text-[7px]" style={{ color: 'var(--color-slate)' }}>{m.label[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeasonalityInfo() {
  return (
    <>
      <InfoItem>
        Una griglia in cui ogni riga è un anno e ogni colonna un mese: più una cella è piena di
        colore, più ore hai giocato in quel mese. Serve a far emergere la forma del tuo anno
        tennistico senza che nessuno debba andarla a cercare.
      </InfoItem>
      <InfoItem title="Come si legge">
        La scala va dal verde acqua tenue (poche ore) a quello pieno (il tuo mese record, indicato
        nella legenda sotto). Le celle con il bordo tratteggiato sono mesi fuori dallo storico —
        prima della tua prima sessione o nel futuro — e sono cosa diversa da un mese vuoto, che è un
        mese in cui davvero non hai giocato. Tieni premuta una cella per vedere sessioni e ore.
      </InfoItem>
      <InfoItem title="Media per mese">
        Compare solo se hai almeno due stagioni registrate: è la media di ogni mese calcolata su
        tutti gli anni disponibili. È lì che si distingue il buco strutturale (agosto chiuso ogni
        anno, come per quasi tutti i circoli) dal caso isolato di una singola stagione.
      </InfoItem>
      <InfoItem>
        La griglia segue il periodo selezionato in cima alla pagina: con «90 giorni» vedrai tre
        celle, ed è su «12 mesi» o «Sempre» che questo blocco dice davvero qualcosa.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Rampa sequenziale a tono unico costruita sul teal del design system: la
// saturazione cresce con il valore, la tinta non cambia mai.
function heatColor(t) {
  const v = Math.max(0, Math.min(1, t || 0))
  if (v === 0) return 'var(--color-surface-2)'
  return `color-mix(in srgb, var(--color-teal) ${Math.round(18 + v * 82)}%, var(--color-surface-2))`
}

function shareColor(share) {
  if (share == null) return 'var(--color-white)'
  if (share >= 0.8) return 'var(--color-win)'
  if (share >= 0.6) return 'var(--color-teal)'
  return 'var(--color-amber)'
}

function LegendItem({ color, label, sub, align = 'left' }) {
  return (
    <span className={`flex items-center gap-1.5 min-w-0 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-[9px] truncate" style={{ color: 'var(--color-slate)' }}>
        {label} <span style={{ fontFamily: 'var(--font-mono)' }}>{sub}</span>
      </span>
    </span>
  )
}

function weekLabel(time) {
  return new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
