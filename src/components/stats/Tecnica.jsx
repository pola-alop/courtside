import { useState } from 'react'
import { Card, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import RatingsBlock from './RatingsBlock'
import BlindSpotBlock from './BlindSpotBlock'
import NeglectBlock from './NeglectBlock'
import { HEATMAP_MONTHS, formatDaysAgo } from '../../lib/technique'

// Sezione "Tecnica" — risponde a "su cosa sto lavorando, e sta funzionando?".
//
// È il diario dei focus letto come dati. I blocchi vanno da cosa hai fatto a
// quanto vale:
//   1. Heatmap del focus  — cosa hai lavorato, mese per mese, per categoria
//   2. Radar per categoria — la forma del tuo lavoro in un colpo d'occhio
//   3. Auto-valutazioni    — sta migliorando? (con la cautela che è un giudizio)
//   4. Punti ciechi        — il 2×2: valutazione bassa × volume basso
//   5. Trascuratezza       — cosa hai smesso di allenare, e da quanto
//   6. Copertura           — quante delle 47 voci hai mai toccato
//
// ── L'unità è la SESSIONE, e la pagina lo dichiara ──
// Il `focus` è della sessione, non del singolo blocco: non esiste alcun modo di
// sapere quanti dei 90 minuti sono andati sul dritto e quanti sul servizio.
// Pesare per minuti significherebbe spalmarli in parti uguali, cioè inventare un
// dato. Finché il legame focus↔blocco non esiste si conta per sessioni, e ogni
// blocco che mostra un numero lo scrive.
//
// ── Perché niente drill-down alla singola sessione ──
// Come in Attività: qui i numeri nascono dagli allenamenti, e l'elenco delle
// sessioni esiste già ed è la Panoramica. Il drill-down che serve davvero è un
// altro — dalla categoria alla singola voce — ed è dentro la heatmap.

export default function Tecnica({ report, periodLabel }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} unit="allenamenti con un focus segnato"
                   what="Per analizzare il tuo lavoro tecnico" />
        {report.trainings > report.n && (
          <Note>
            Hai {report.trainings} allenamenti nel periodo ma solo {report.n} con
            un focus indicato: il campo è facoltativo nel wizard, e questa sezione si costruisce
            tutta da lì.
          </Note>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <HeatmapCard report={report} periodLabel={periodLabel} />
      <RadarCard report={report} />
      <RatingsBlock report={report} />
      <BlindSpotBlock report={report} />
      <NeglectBlock report={report} />

      <Note>
        Tutta la sezione conta <strong>sessioni</strong>, non minuti: il focus è della sessione e non
        del singolo blocco, quindi dire "2 ore di dritto" richiederebbe di spalmare i minuti tra le
        voci in parti uguali — un numero che i tuoi allenamenti non contengono.
        {report.withoutFocus > 0 && ` Nel periodo ${report.withoutFocus} ${report.withoutFocus === 1 ? 'allenamento non ha' : 'allenamenti non hanno'} un focus segnato e ${report.withoutFocus === 1 ? 'resta fuori' : 'restano fuori'} da ogni conteggio.`}
      </Note>
    </div>
  )
}

// ── Blocco 1 — Heatmap del focus ───────────────────────────
// L'idea originale erano 47 righe (una per voce) × bucket temporali. Su mobile
// 47 righe da 6px sono un tappeto: la griglia diventa una texture e non si legge
// niente. Le 7 categorie stanno in uno schermo, e la voce singola si raggiunge
// aprendo la riga — il dettaglio non si perde, si mette a un tap.

function HeatmapCard({ report, periodLabel }) {
  const h = report.heatmap
  const [open, setOpen] = useState(null)

  if (!h.months.length) return null

  return (
    <Card id="heatmap" title="Heatmap del focus" sub="Cosa hai lavorato, mese per mese"
          titleExtra={<InfoButton title="Cos'è la heatmap del focus?"><HeatmapInfo /></InfoButton>}
          right={<SampleTag n={report.n} unit="sessioni" />}>

      {/* Intestazione dei mesi. La colonna delle etichette è larga quanto basta
          a "Transiz." a 9px: sotto, le categorie diventerebbero illeggibili. */}
      <div className="flex items-center" style={{ gap: 2 }}>
        <span style={{ width: LABEL_W }} />
        {h.months.map(m => (
          <span key={m.index} className="flex-1 min-w-0 text-center text-[7px]"
                style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {m.label}
          </span>
        ))}
      </div>

      <div className="space-y-[2px] mt-1">
        {h.rows.map(row => (
          <div key={row.id}>
            <button onClick={() => setOpen(open === row.id ? null : row.id)}
                    className="w-full flex items-center transition-all active:scale-[0.99]"
                    style={{ gap: 2 }}>
              <span className="flex items-center gap-1 shrink-0 text-left" style={{ width: LABEL_W }}>
                <span className="text-[9px] leading-none">{row.icon}</span>
                <span className="text-[9px] truncate"
                      style={{ color: open === row.id ? 'var(--color-teal)' : 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {row.short}
                </span>
              </span>
              {row.cells.map(cell => (
                <span key={cell.index} className="flex-1 min-w-0 rounded-[2px]"
                      title={`${row.label} · ${cell.label} ${cell.year}: ${cell.n === 0 ? 'mai' : `${cell.n} ${cell.n === 1 ? 'sessione' : 'sessioni'}`}`}
                      style={{ height: 18, background: heatColor(h.max ? cell.n / h.max : 0) }} />
              ))}
            </button>

            {open === row.id && <CategoryDetail category={report.usage.byCategory.find(c => c.id === row.id)} />}
          </div>
        ))}
      </div>

      {/* Riga di contesto: quante sessioni con focus ci sono in ogni mese. Senza,
          un mese spento sembra disinteresse quando invece è un mese fermo. */}
      <div className="flex items-center mt-1.5" style={{ gap: 2 }}>
        <span className="text-[7px] uppercase tracking-wide" style={{ width: LABEL_W, color: 'var(--color-slate)' }}>
          sessioni
        </span>
        {h.monthTotals.map(m => (
          <span key={m.index} className="flex-1 min-w-0 text-center text-[8px]"
                style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {m.n || '·'}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>mai</span>
        {[0, 0.25, 0.5, 0.75, 1].map(step => (
          <span key={step} className="w-4 h-2.5 rounded-[2px]" style={{ background: heatColor(step) }} />
        ))}
        <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
          {h.max} {h.max === 1 ? 'sessione' : 'sessioni'} nel mese
        </span>
      </div>

      <Note>
        Tocca una riga per aprire le singole voci di quella categoria.
        {' '}{periodLabel ? `Periodo: ${periodLabel.toLowerCase()}.` : ''}
        {h.truncated && ` La griglia mostra gli ultimi ${HEATMAP_MONTHS} mesi (${h.hiddenMonths === 1 ? 'uno più vecchio resta fuori' : `${h.hiddenMonths} più vecchi restano fuori`}): oltre, su mobile le colonne diventano illeggibili.`}
        {' '}Una cella conta le sessioni in cui almeno una voce della categoria era nel focus, non i
        minuti — il focus è della sessione, non del blocco.
      </Note>
    </Card>
  )
}

// Riga aperta: le voci della categoria lavorate nel periodo, con quante volte e
// da quanto non le tocchi. È il drill-down "categoria → voce" che sostituisce le
// 47 righe della heatmap piena.
function CategoryDetail({ category }) {
  if (!category) return null
  const max = Math.max(1, ...category.voci.map(v => v.n))
  const untouched = category.total - category.touched

  return (
    <div className="rounded-xl px-3 py-3 mt-1 mb-1" style={{ background: 'var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        {category.label} · {category.sessions} {category.sessions === 1 ? 'sessione' : 'sessioni'} nel periodo
      </p>

      {category.voci.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
          Nessuna voce di questa categoria nel periodo selezionato.
        </p>
      ) : (
        <div className="space-y-2">
          {category.voci.map(v => (
            <div key={v.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] flex-1 min-w-0 truncate"
                      style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {v.label}
                </span>
                {v.rating != null && (
                  <span className="text-[9px] shrink-0" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                    {v.rating.toLocaleString('it-IT', { maximumFractionDigits: 1 })}★
                  </span>
                )}
                <span className="text-[11px] shrink-0 font-semibold"
                      style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>
                  {v.n}
                </span>
              </div>
              <div className="h-1 rounded-full mt-1" style={{ background: 'var(--color-surface)' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${(v.n / max) * 100}%`, background: 'var(--color-teal-dark)' }} />
              </div>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
                ultima volta {formatDaysAgo(v.days)}
              </p>
            </div>
          ))}
        </div>
      )}

      {untouched > 0 && (
        <p className="text-[9px] mt-2.5" style={{ color: 'var(--color-slate)' }}>
          {untouched} {untouched === 1 ? 'voce' : 'voci'} di questa categoria non {untouched === 1 ? 'è' : 'sono'} mai
          {' '}{untouched === 1 ? 'entrata' : 'entrate'} in un allenamento: le trovi in Copertura.
        </p>
      )}
    </div>
  )
}

function HeatmapInfo() {
  return (
    <>
      <InfoItem>
        Una griglia in cui ogni riga è una delle 7 aree del diario (Servizio, Risposta, Fondo campo,
        Gioco a rete, Transizione, Schemi, Fisico e mentale) e ogni colonna è un mese. Più una cella
        è piena, più sessioni di quel mese avevano almeno una voce di quell'area nel focus.
      </InfoItem>
      <InfoItem title="Come si legge">
        Le righe scure sono le aree che stai trascurando, le bande verticali chiare sono i mesi in
        cui non hai giocato (la riga «sessioni» sotto la griglia lo conferma: se lì c'è un punto, il
        mese era vuoto per tutti). Una riga accesa solo a sinistra è un'area che hai lavorato mesi fa
        e poi abbandonato.
      </InfoItem>
      <InfoItem title="Cosa conta una cella">
        Le <strong>sessioni</strong>, non le ore. Il focus lo scegli per l'intera sessione, non per
        il singolo blocco: l'app non sa quanti dei tuoi 90 minuti sono andati sul dritto e quanti
        sul servizio, e dividerli in parti uguali sarebbe inventare un dato. Quindi una sessione di
        due ore in cui hai segnato «dritto» vale esattamente quanto una da 45 minuti.
      </InfoItem>
      <InfoItem title="Aprire una riga">
        Toccando una categoria si aprono le sue voci singole, con quante volte le hai lavorate nel
        periodo, la tua valutazione media (★) quando l'hai data, e quanti giorni sono passati
        dall'ultima volta. Le 47 voci non sono mostrate tutte insieme di proposito: 47 righe da 6px
        su un telefono sono una texture, non una tabella.
      </InfoItem>
      <InfoItem>
        Se un mese ti sembra sbagliato, controlla di aver segnato il focus: il campo è facoltativo,
        e le sessioni senza focus non compaiono da nessuna parte in questa sezione.
      </InfoItem>
    </>
  )
}

// ── Blocco 2 — Radar per categoria ─────────────────────────
// Il radar risponde a una domanda sola — "che forma ha il mio lavoro?" — e la
// risponde meglio di sette barre, perché la forma di un poligono si riconosce a
// colpo d'occhio mentre sette lunghezze vanno confrontate a coppie. I numeri
// esatti restano sotto: il radar dà la forma, la lista dà i valori.

function RadarCard({ report }) {
  const cats = report.usage.byCategory
  const max = Math.max(...cats.map(c => c.share), 0)
  const sorted = [...cats].sort((a, b) => b.n - a.n)

  return (
    <Card id="radar" title="La forma del tuo lavoro" sub="Quota di attenzione per area"
          titleExtra={<InfoButton title="Come si legge il radar"><RadarInfo /></InfoButton>}>

      <Radar cats={cats} max={max} />

      <div className="space-y-2 mt-3">
        {sorted.map(c => (
          <div key={c.id} className="flex items-baseline gap-2">
            <span className="text-[11px] shrink-0">{c.icon}</span>
            <span className="text-[11px] flex-1 min-w-0 truncate"
                  style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {c.label}
            </span>
            <span className="text-[9px] shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {c.touched}/{c.total} voci
            </span>
            <span className="text-[11px] shrink-0 font-semibold w-9 text-right"
                  style={{ color: c.n ? 'var(--color-teal)' : 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(c.share * 100)}%
            </span>
          </div>
        ))}
      </div>

      <Note>
        La quota è calcolata sulle <strong>coppie voce × sessione</strong> ({report.usage.total} in
        totale): una sessione in cui hai segnato tre voci di fondo campo e una di rete conta come
        tre quarti di fondo, non come metà e metà. Il poligono è in scala sull'area più lavorata
        ({Math.round(max * 100)}%), quindi disegna la forma del lavoro, non la sua dimensione.
      </Note>
    </Card>
  )
}

function Radar({ cats, max }) {
  const n = cats.length
  const CX = 100, CY = 96, R = 68

  const at = (i, t) => {
    const angle = (-90 + (i * 360) / n) * (Math.PI / 180)
    return [CX + Math.cos(angle) * R * t, CY + Math.sin(angle) * R * t]
  }
  const polygon = (t) => cats.map((_, i) => at(i, t).join(',')).join(' ')
  const shape = cats.map((c, i) => at(i, max ? c.share / max : 0).join(',')).join(' ')

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 200 192" className="w-full" style={{ maxWidth: 260 }} role="img"
           aria-label="Radar della quota di attenzione per area tecnica">
        {/* Griglia: quattro anelli come riferimento di scala, e un raggio per
            asse — senza, il poligono galleggia e non si capisce dove sia lo zero. */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <polygon key={t} points={polygon(t)} fill="none"
                   stroke="var(--color-surface-2)" strokeWidth="1" />
        ))}
        {cats.map((c, i) => {
          const [x, y] = at(i, 1)
          return <line key={c.id} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-surface-2)" strokeWidth="1" />
        })}

        {/* Una serie sola: nessuna legenda di colore, il colore porta identità di
            dato (il tuo lavoro) e non distingue categorie. */}
        <polygon points={shape} fill="var(--color-teal)" fillOpacity="0.22"
                 stroke="var(--color-teal)" strokeWidth="1.5" strokeLinejoin="round" />
        {cats.map((c, i) => {
          const [x, y] = at(i, max ? c.share / max : 0)
          return <circle key={c.id} cx={x} cy={y} r="2.5"
                         fill={c.n ? 'var(--color-teal)' : 'var(--color-slate)'} />
        })}

        {/* Le etichette sono le icone delle categorie: sette parole attorno a un
            cerchio di 260px si sovrapporrebbero, e il nome per esteso è comunque
            nella lista qui sotto, con accanto la percentuale. */}
        {cats.map((c, i) => {
          const [x, y] = at(i, 1.22)
          return (
            <text key={c.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="13" opacity={c.n ? 1 : 0.4}>
              {c.icon}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function RadarInfo() {
  return (
    <>
      <InfoItem>
        Sette assi, uno per area del diario, e su ciascuno la quota della tua attenzione che è
        finita lì. Serve a una cosa sola: vedere la <strong>forma</strong> del tuo lavoro in un
        colpo d'occhio. Un poligono allungato verso il basso a destra è un giocatore che lavora solo
        da fondo; un poligono regolare è un lavoro distribuito.
      </InfoItem>
      <InfoItem title="Come si calcola la quota">
        Si contano le coppie <em>voce × sessione</em>: se in un allenamento hai segnato dritto,
        rovescio e passante (tutte e tre di Fondo campo) più una volée, quella sessione vale 3 punti
        di attenzione al fondo e 1 alla rete — non metà e metà. È il modo di non far pesare uguale
        una voce messa di sfuggita e un'intera area di lavoro.
      </InfoItem>
      <InfoItem title="La scala del poligono">
        Il vertice più lontano è l'area che lavori di più, non il 100%: il radar disegna i
        <strong> rapporti</strong> tra le aree, che è la cosa che si legge a colpo d'occhio. Le
        percentuali vere sono nella lista sotto il grafico, insieme a quante voci distinte hai
        toccato su quante ne contiene l'area.
      </InfoItem>
      <InfoItem title="Un asse a zero">
        Il vertice cade al centro e l'icona è sbiadita: in questo periodo quell'area non è mai
        entrata in un allenamento. È il dato più utile del grafico, e di solito è il gioco a rete o
        la risposta — le due cose che quasi nessun amatore allena mai.
      </InfoItem>
      <InfoItem>
        Vale anche qui: si contano sessioni, non minuti. Il radar dice a cosa hai dedicato
        <em> attenzione</em>, non a cosa hai dedicato tempo.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

// Larghezza della colonna delle etichette nella heatmap: condivisa da
// intestazione, righe e riga dei totali, che devono restare allineate.
const LABEL_W = 54

// Rampa sequenziale a tono unico costruita sul teal del design system: la
// saturazione cresce con il valore, la tinta non cambia mai. È duplicata dalla
// stagionalità di Attivita.jsx come gli altri helper di formattazione dei
// blocchi (weekLabel sta in due file per lo stesso motivo): il file
// StatsUI.jsx esporta solo componenti, e la regola react-refresh del repo non
// ammette export di funzioni accanto a loro.
function heatColor(t) {
  const v = Math.max(0, Math.min(1, t || 0))
  if (v === 0) return 'var(--color-surface-2)'
  return `color-mix(in srgb, var(--color-teal) ${Math.round(18 + v * 82)}%, var(--color-surface-2))`
}
