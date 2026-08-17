import { Card, BarRow, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { MIN_MIX_MIN, formatDuration, formatHoursValue } from '../../lib/activity'

// Blocco 5 — il mix dei blocchi, e blocco 6 — con chi.
//
// Risponde a "che tipo di tennista sono?": da cesto o da match play. È anche il
// blocco che rende visibile lo squilibrio — un 4% dei minuti sul servizio è un
// dato che cambia la programmazione della settimana, ma nessuno se ne accorge
// guardando una sessione alla volta.
//
// ── Perché le partite sono dentro il denominatore ──
// Escluderle direbbe che chi gioca tre partite a settimana e non fa mai match
// play in allenamento non gioca mai punti, che è falso. Compaiono quindi come
// una riga a sé, dentro il totale dei minuti in campo.
//
// ── Perché il colore è per FAMIGLIA e non per tipo ──
// Otto tipi significano otto tinte, e otto tinte distinguibili tra loro non
// esistono nella palette dell'app (verificato: le coppie adiacenti finiscono
// sotto la soglia di separazione, anche per chi non ha problemi di visione dei
// colori). L'identità della riga la porta la sua etichetta, che c'è sempre; il
// colore porta l'unica distinzione che serve a colpo d'occhio — palla alimentata
// contro gioco vero — con tre tinte ben separate invece di otto confuse.

const FAMILY = {
  feed:  { id: 'feed',  label: 'Palla alimentata', color: 'var(--color-teal-dark)', kinds: ['macchina', 'lezione', 'servizio'] },
  live:  { id: 'live',  label: 'Gioco vero',       color: 'var(--color-amber)',     kinds: ['sparring', 'gruppo', 'matchplay', 'partita'] },
  other: { id: 'other', label: 'Senza palla',      color: 'var(--color-slate)',     kinds: ['atletica'] },
}

const FAMILY_OF = Object.values(FAMILY).reduce((acc, f) => {
  f.kinds.forEach(k => { acc[k] = f })
  return acc
}, {})

export default function MixBlock({ report }) {
  return (
    <>
      <MixCard report={report} />
      <CompanyCard report={report} />
    </>
  )
}

// ── Mix dei blocchi ────────────────────────────────────────

function MixCard({ report }) {
  const mix = report.mix
  const info = <InfoButton title="Che tipo di tennista sono?"><MixInfo /></InfoButton>

  if (!mix.enough) {
    return (
      <Card id="mix" title="Mix del lavoro" titleExtra={info} sub="Come si distribuiscono i tuoi minuti in campo">
        <NotEnough need={Math.ceil((MIN_MIX_MIN - mix.total) / 60)} unit="ore registrate"
                   what="Per scomporre il lavoro" />
      </Card>
    )
  }

  const rows = mix.rows.filter(r => r.minutes > 0)
  const max = Math.max(1, ...rows.map(r => r.minutes))

  return (
    <Card id="mix" title="Mix del lavoro" titleExtra={info} sub="Come si distribuiscono i tuoi minuti in campo">

      {/* Tre serie: barra a segmenti con distanziatori, più legenda con i valori
          accanto al colore. */}
      <FamilyBar mix={mix} />

      <div className="space-y-3 mt-4">
        {rows.map(r => (
          <BarRow key={r.id}
                  label={`${r.icon} ${r.label}`}
                  value={`${Math.round(r.share * 100)}%`}
                  rate={r.minutes / max}
                  color={(FAMILY_OF[r.id] || FAMILY.other).color}
                  sub={`${formatDuration(r.minutes)}${r.id === 'partita' && mix.estimated ? ' (stimate)' : ''}`} />
        ))}
      </div>

      <Note>
        Le barre sono in scala sul tipo più praticato ({formatDuration(max)}), non sul 100%:
        a piena larghezza si leggono i rapporti tra le righe, che è la cosa che interessa.
        La percentuale accanto a ogni barra è invece la quota reale sul totale
        ({formatHoursValue(mix.total, mix.estimated)} ore).
      </Note>

      <IntensityBar mix={mix} />
    </Card>
  )
}

function FamilyBar({ mix }) {
  const other = Math.max(0, mix.total - mix.ball)
  const parts = [
    { ...FAMILY.feed,  minutes: mix.feed },
    { ...FAMILY.live,  minutes: mix.live },
    { ...FAMILY.other, minutes: other },
  ].filter(p => p.minutes > 0)

  return (
    <div>
      <div className="h-3 rounded-full overflow-hidden flex gap-[2px]" style={{ background: 'var(--color-surface-2)' }}>
        {parts.map(p => (
          <div key={p.id} title={`${p.label}: ${formatDuration(p.minutes)}`}
               style={{ width: `${(p.minutes / mix.total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {parts.map(p => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
              {p.label} <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round((p.minutes / mix.total) * 100)}%</span>
            </span>
          </span>
        ))}
      </div>
      {mix.feedShare != null && (
        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
          {mix.feedShare >= 0.6
            ? `Sei un giocatore da costruzione: il ${Math.round(mix.feedShare * 100)}% dei minuti con la palla è su palla alimentata. Il gesto lo curi, la decisione sotto pressione la alleni meno.`
            : mix.liveShare >= 0.8
              ? `Sei un giocatore da gioco: il ${Math.round(mix.liveShare * 100)}% dei minuti con la palla è punto vero. Il gesto lo costruisci poco fuori dal campo di gioco.`
              : `Il lavoro è bilanciato: ${Math.round(mix.feedShare * 100)}% su palla alimentata, ${Math.round(mix.liveShare * 100)}% di gioco vero.`}
        </p>
      )}
    </div>
  )
}

// L'intensità è un dato dei soli allenamenti: la partita non ha (e non deve
// avere) un campo intensità, quindi includerla qui significherebbe inventarne
// una. "Non indicata" non prende una tinta propria — è assenza di dato, non una
// quarta categoria — e si disegna come traccia vuota tratteggiata.
function IntensityBar({ mix }) {
  if (!mix.intensityTotal) return null
  const parts = mix.intensity.filter(i => i.minutes > 0)

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        Intensità · solo allenamenti
      </p>
      <div className="h-3 rounded-full overflow-hidden flex gap-[2px]" style={{ background: 'var(--color-surface-2)' }}>
        {parts.map(p => (
          <div key={p.id || 'none'} title={`${p.label}: ${formatDuration(p.minutes)}`}
               style={{
                 width: `${p.share * 100}%`,
                 background: p.id ? p.color : 'transparent',
                 border: p.id ? 'none' : '1px dashed var(--color-slate)',
               }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {parts.map(p => (
          <span key={p.id || 'none'} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0"
                  style={p.id ? { background: p.color } : { border: '1px dashed var(--color-slate)' }} />
            <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
              {p.label} <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(p.share * 100)}%</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function MixInfo() {
  return (
    <>
      <InfoItem>
        Prende tutti i minuti che hai passato in campo e li divide per tipo di lavoro. Risponde alla
        domanda «che tipo di tennista sono?» e, soprattutto, rende visibili gli squilibri: il 4% dei
        minuti sul servizio è un dato che cambia come organizzi la settimana, ma guardando una
        sessione alla volta non lo si vede mai.
      </InfoItem>
      <InfoItem title="Palla alimentata / Gioco vero / Senza palla">
        La divisione più importante, e il criterio è <em>chi decide la palla che ricevi</em>. Nel
        cesto col maestro, alla macchina e nel secchiello di servizi la palla è controllata (o non
        c'è avversario): stai costruendo il <strong>gesto</strong>. Con lo sparring, in gruppo, nel
        match play e in partita la palla arriva da un avversario: stai costruendo la
        <strong> decisione</strong>. L'atletica resta fuori da entrambi perché è tennis senza palla.
        Non esiste un rapporto giusto, ma gli estremi dicono qualcosa: solo cesto significa gesti
        puliti che si sfaldano quando l'avversario decide lui, solo gioco significa portarsi dietro
        per anni gli stessi difetti tecnici.
      </InfoItem>
      <InfoItem title="Le righe con la percentuale">
        Una riga per tipo di blocco, più una riga «Partite». Le partite sono dentro il totale di
        proposito: escluderle direbbe che chi gioca tre partite a settimana e non fa mai match play
        in allenamento non gioca mai punti. La percentuale è la quota reale sul totale dei minuti;
        la lunghezza della barra è invece in scala sul tipo più praticato, così anche le voci piccole
        restano leggibili e i rapporti tra le righe si vedono a piena larghezza.
      </InfoItem>
      <InfoItem title="Intensità">
        Come si dividono i minuti di <em>allenamento</em> tra leggera, media e intensa — quello che
        hai segnato nel wizard. Le partite non compaiono perché non hanno un campo intensità, e
        assegnargliene una sarebbe inventare un dato. «Non indicata» è la quota di sessioni per cui
        il campo, che è facoltativo, è rimasto vuoto: è disegnata come traccia vuota perché è
        assenza di dato, non una quarta intensità.
      </InfoItem>
      <InfoItem>
        Il colore raggruppa per famiglia, non per singolo tipo: otto tinte distinguibili tra loro
        non esistono in una palette sola, e una riga che si distingue solo per una sfumatura è una
        riga che si legge sbagliata. L'identità di ogni riga la porta la sua etichetta.
      </InfoItem>
    </>
  )
}

// ── Con chi ────────────────────────────────────────────────

function CompanyCard({ report }) {
  const c = report.company
  const info = <InfoButton title="Con chi giochi"><CompanyInfo /></InfoButton>

  if (!c.total) return null
  const rows = c.rows.filter(r => r.minutes > 0)
  const max = Math.max(1, ...rows.map(r => r.minutes))

  return (
    <Card id="con-chi" title="Con chi" sub="Quota dei minuti di allenamento, per compagnia"
          titleExtra={info}>
      <div className="space-y-3">
        {rows.map(r => (
          <BarRow key={r.id}
                  label={`${r.icon} ${r.label}`}
                  value={`${Math.round(r.share * 100)}%`}
                  rate={r.minutes / max}
                  color="var(--color-teal-dark)"
                  sub={formatDuration(r.minutes)} />
        ))}
      </div>

      {c.named.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
            Persone che hai segnato
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.named.map(p => (
              <span key={p.label} className="px-2.5 py-1 rounded-full text-[10px]"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                {p.label}
                <span className="ml-1.5" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  {p.n}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <Note>
        La compagnia si ricava dal <strong>tipo di blocco</strong>, non dal campo "con chi" del
        wizard: quello è un'etichetta libera e facoltativa, mentre il blocco c'è sempre ed è già la
        risposta — una lezione è col maestro per definizione. Le partite non compaiono qui: hanno
        sempre e solo un avversario, e vivono nella sezione Rendimento.
      </Note>
    </Card>
  )
}

function CompanyInfo() {
  return (
    <>
      <InfoItem>
        Con chi passi i tuoi minuti di allenamento. Serve a vedere se stai delegando tutto al
        maestro, se giochi sempre e solo con lo stesso compagno, o se una parte del lavoro la fai da
        solo.
      </InfoItem>
      <InfoItem title="Le quattro righe">
        <strong>Col maestro</strong>: i blocchi di lezione individuale. <strong>Uno contro uno</strong>:
        sparring e match di allenamento. <strong>In gruppo</strong>: i corsi collettivi.
        <strong> Da solo</strong>: secchiello di servizi, macchina o muro, atletica — tutto ciò che
        puoi fare senza aspettare nessuno, ed è di solito la quota che manca a chi si allena poco.
      </InfoItem>
      <InfoItem title="Da dove viene il dato">
        Dal tipo dei blocchi che componi nel wizard, non dal campo «con chi»: quello è facoltativo e
        libero, il blocco invece c'è sempre e dice già tutto — una lezione è col maestro per
        definizione. Il campo «con chi», quando l'hai compilato, alimenta solo l'elenco dei nomi in
        fondo, con accanto quante sessioni avete fatto insieme.
      </InfoItem>
      <InfoItem>
        Le partite non sono contate qui: hanno sempre e solo un avversario, e il taglio per
        avversario esiste già nella sezione Rendimento.
      </InfoItem>
    </>
  )
}
