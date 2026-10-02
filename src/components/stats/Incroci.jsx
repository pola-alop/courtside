import { useState } from 'react'
import { Card, Tile, BarRow, NotEnough, SampleTag, Note, InfoButton, InfoItem } from './StatsUI'
import {
  FACTORS, DOMAINS, MIN_TENNIS, MIN_OFFCOURT, MIN_TRAIN_ROW, MIN_CORR, MIN_PERCEIVED,
  MIN_DELTA_PP, MIN_DELTA_BPM, RECENT_DAYS, WINDOW_DAYS,
} from '../../lib/crossStats'
import { MIN_BRIDGE, formatPct } from '../../lib/stats'
import { MIN_SIDE, formatDelta } from '../../lib/physical'
import { ACWR_MIN, ACWR_MAX } from '../../lib/activity'

// Sezione "Incroci" — risponde a "corsa e palestra aiutano o pesano sul mio
// tennis?". Unisce i tre domini: ogni sessione di tennis si legge in funzione di
// quando è stata l'ultima corsa o palestra.
//
// I blocchi vanno dal quadro alla conseguenza:
//   1. Cosa c'è da incrociare   — quante sessioni, e di chi è il carico
//   2. Come arrivi in campo     — il GW% delle partite per cosa hai fatto prima
//   3. Il carico con cui ci arrivi — lo stesso GW% per fascia di ACWR
//   4. Gli allenamenti di tennis — il voto che dai ai colpi, per cosa c'era prima
//   5. Il cuore in campo        — la FC a parità di velocità, e i km corsi
//   6. Sforzo e orologio        — l'intensità dichiarata contro il carico Garmin
//
// ── Un solo selettore per tre blocchi ──
// I blocchi 2, 4 e 5 rispondono alla stessa domanda su tre esiti diversi
// (risultato, voto, cuore). Il fattore («palestra con le gambe», «corsa
// dura»…) è uno solo e si sceglie in cima: tre selettori uguali uno sotto
// l'altro farebbero perdere il filo.
//
// ── Niente drill-down ──
// Come Attività e Fisico: i numeri nascono da sessioni di domini diversi, e
// l'elenco esiste già nel tab Allenamenti.

export default function Incroci({ report, periodLabel }) {
  const [chosen, setChosen] = useState(null)

  if (!report.enough) return <NotReady report={report} />

  const firstAvailable = report.matches.factors.find(f => f.available)
  const fid = chosen || firstAvailable?.id || FACTORS[0].id
  const pick = (block) => block.factors.find(f => f.id === fid)

  return (
    <div className="space-y-3">
      <CoverageCard report={report} periodLabel={periodLabel} />
      <FactorPicker factors={report.matches.factors} value={fid} onChange={setChosen} />
      <MatchesCard report={report} factor={pick(report.matches)} />
      <LoadCard report={report} />
      <TrainingsCard report={report} factor={pick(report.trainings)} />
      <BodyCard report={report} factor={report.body.available ? pick(report.body) : null} />
      <PerceivedCard report={report} />

      <Note>
        Tutto qui è <strong>correlazione, non causa</strong>. Nei periodi in cui ti alleni di più
        giochi anche di più e meglio, una settimana senza palestra è spesso una settimana storta, e
        due sessioni nello stesso giorno non si distinguono. Il giorno stesso della partita non conta
        come «prima»: non sappiamo cosa sia venuto per primo. Ogni gruppo dichiara il proprio
        campione e sotto soglia non parla; le durate stimate non entrano mai nei confronti di
        rendimento e di condizione, solo nel carico (dove portano il «~»).
      </Note>
    </div>
  )
}

function NotReady({ report }) {
  return (
    <div className="pt-4 space-y-3">
      {report.missingTennis > 0 && (
        <NotEnough need={report.missingTennis} unit="sessioni di tennis nel periodo"
                   what="Per incrociare il tennis con il resto" />
      )}
      {report.missingOffCourt > 0 && (
        <NotEnough need={report.missingOffCourt} unit="corse o palestre registrate"
                   what="Per avere qualcosa da confrontare" />
      )}
      <Note>
        Servono almeno {MIN_TENNIS} sessioni di tennis nel periodo e {MIN_OFFCOURT} tra corse e
        palestre in tutto lo storico. Le corse e le palestre si registrano da Matches › Allenamenti
        › + Allenamento; con il file .FIT dell'orologio i dati arrivano da soli, e il confronto
        sulla frequenza cardiaca si apre.
      </Note>
    </div>
  )
}

// ── Blocco 1 — Cosa c'è da incrociare ──────────────────────

function CoverageCard({ report, periodLabel }) {
  const c = report.coverage
  const share = c.share
  const info = <InfoButton title="Cosa c'è da incrociare"><CoverageInfo /></InfoButton>

  return (
    <Card id="incroci-copertura" title="Cosa c'è da incrociare" titleExtra={info}
          sub={`Il tennis del periodo (${periodLabel || 'periodo'}) e tutta la preparazione che lo precede`}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Partite" value={c.matches} sub="nel periodo" />
        <Tile label="Allenam." value={c.trainings} sub="nel periodo" />
        <Tile label="Corse" value={c.runs} sub="in tutto" color="var(--color-draw)" />
        <Tile label="Palestre" value={c.gyms} sub="in tutto" color="var(--color-zone-6)" />
      </div>

      <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>
        Partite con una corsa nei 7 giorni prima: <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{c.matchesAfterRun}</span> su {c.matches}
        {' · '}con una palestra: <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{c.matchesAfterGym}</span> su {c.matches}
      </p>

      {share.total > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
          <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
            Di chi è il carico del periodo
          </p>
          <div className="flex w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
            {DOMAINS.map(d => share.shares[d.id] > 0 && (
              <div key={d.id} style={{ width: `${share.shares[d.id] * 100}%`, background: d.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {DOMAINS.map(d => (
              <span key={d.id} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-slate)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                {d.label}
                <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{formatPct(share.shares[d.id])}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function CoverageInfo() {
  return (
    <>
      <InfoItem>
        Questa sezione mette in fila corsa, palestra e tennis. Per ogni partita o allenamento guarda
        cosa hai fatto nei {WINDOW_DAYS} giorni prima e se questo si vede nel risultato, nel voto o
        nel cuore.
      </InfoItem>
      <InfoItem title="Quote di carico">
        Il carico è <em>durata × sforzo</em>, lo stesso di Attività: un'ora di corsa leggera pesa
        meno di un'ora di partita. La barra dice quanta parte del carico del periodo viene dal campo
        e quanta da fuori.
      </InfoItem>
    </>
  )
}

// ── Selettore del fattore ──────────────────────────────────

function FactorPicker({ factors, value, onChange }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
        Cosa confronto con il tennis
      </p>
      <div className="flex flex-wrap gap-2">
        {factors.map(f => {
          const active = f.id === value
          return (
            <button key={f.id} onClick={() => onChange(f.id)}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 flex items-center gap-1.5"
              style={{
                background: active ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                color: active ? 'var(--color-white)' : 'var(--color-slate)',
                opacity: f.available || active ? 1 : 0.6,
                fontFamily: 'var(--font-display)',
              }}>
              <span>{f.icon}</span>{f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MissingFactor({ factor }) {
  return (
    <NotEnough need={factor.missing} unit={`sessioni di ${factor.short} registrate`}
               what={`Per leggere cosa cambia dopo ${factor.short}`} />
  )
}

// ── Blocco 2 — Come arrivi in campo ────────────────────────

function MatchesCard({ report, factor }) {
  const m = report.matches
  const info = <InfoButton title="Come arrivi in campo"><MatchesInfo /></InfoButton>

  return (
    <Card id="incroci-partite" title="Come arrivi in campo" titleExtra={info}
          sub={`Game vinti per cosa hai fatto prima · ${factor.label.toLowerCase()}`}
          right={<SampleTag n={m.n} />}>
      {!factor.available ? <MissingFactor factor={factor} /> : (
        <>
          <div className="space-y-3">
            {factor.buckets.map(b => (
              <BarRow key={b.id} label={b.label}
                      sub={b.n === 0 ? 'nessuna partita'
                        : `${b.n} ${b.n === 1 ? 'partita' : 'partite'} · ${b.wins}V ${b.losses}S${b.enough ? '' : ` · meno di ${MIN_BRIDGE}, non leggibile`}`}
                      value={formatPct(b.rate)} rate={b.rate} tick={m.overall} dim={!b.enough} />
            ))}
          </div>
          <Gap gap={factor.gap} unit="pp" threshold={MIN_DELTA_PP}
               missing={`Nessun confronto leggibile: servono almeno ${MIN_BRIDGE} partite sia in «${factor.buckets[0].label.toLowerCase()}» sia in «${factor.buckets[2].label.toLowerCase()}».`} />
        </>
      )}
      <Note>
        La tacca verticale è il tuo GW% del periodo. «{factor.buckets[0].label}» è la finestra della
        stanchezza ({RECENT_DAYS} giorni), «{factor.buckets[1].label.toLowerCase()}» quella del lavoro
        che si assorbe: se la prima va peggio e la seconda meglio della media, il carico si paga
        subito e rende dopo.
      </Note>
    </Card>
  )
}

function MatchesInfo() {
  return (
    <>
      <InfoItem>
        Ogni partita viene messa in uno di tre gruppi in base a quanti giorni prima hai fatto
        l'attività scelta: <strong>ieri o l'altro ieri</strong>, <strong>da 3 a 7 giorni prima</strong>, oppure{' '}
        <strong>nessuna nei 7 giorni</strong>. Il numero è la percentuale di game vinti (GW%), la
        misura più stabile che hai: si assesta con molte meno partite del win/loss.
      </InfoItem>
      <InfoItem title="Come si legge">
        Se i game vinti dopo la palestra sono più bassi che senza, <em>potrebbe</em> essere
        stanchezza. Potrebbe anche essere che nelle settimane di palestra giochi con avversari più
        forti, o di sera dopo il lavoro: il confronto non può saperlo. Serve a formulare
        un'ipotesi da provare in campo, non a concludere.
      </InfoItem>
      <InfoItem title="«Palestra con le gambe»">
        Una palestra in cui i muscoli delle gambe hanno fatto almeno 2 serie equivalenti. È la
        versione che ha più senso guardare per la stanchezza: le spalle stanche cambiano poco la
        partita, le gambe molto.
      </InfoItem>
      <InfoItem title="«Corsa dura»">
        Una corsa dichiarata intensa, o con almeno il 20% del tempo nelle zone cardiache 4-6 (dove
        c'è l'orologio): le ripetute contano anche se le hai segnate «leggere».
      </InfoItem>
      <InfoItem title="Il campione">
        Ogni gruppo ha bisogno di almeno {MIN_BRIDGE} partite. Sotto, la riga è attenuata e non
        entra nel confronto: due partite non sono un gruppo.
      </InfoItem>
    </>
  )
}

// ── Blocco 3 — Il carico con cui ci arrivi ─────────────────

function LoadCard({ report }) {
  const l = report.byLoad
  const info = <InfoButton title="Il carico con cui ci arrivi"><LoadInfo /></InfoButton>

  return (
    <Card id="incroci-carico" title="Il carico con cui ci arrivi" titleExtra={info}
          sub="Game vinti per fascia di ACWR il giorno prima della partita"
          right={<SampleTag n={l.used} />}>
      {l.used === 0 ? (
        <NotEnough need={1} unit="partite con 28 giorni di storico alle spalle"
                   what="Per misurare il carico con cui arrivi" />
      ) : (
        <>
          <div className="space-y-3">
            {l.rows.map(r => (
              <BarRow key={r.id} label={r.label}
                      sub={`${r.hint} · ${r.n} ${r.n === 1 ? 'partita' : 'partite'}${r.n > 0 && !r.enough ? ` · meno di ${MIN_BRIDGE}, non leggibile` : ''}`}
                      value={formatPct(r.rate)} rate={r.rate} tick={report.matches.overall} dim={!r.enough} />
            ))}
          </div>
          <Gap gap={l.gap} unit="pp" threshold={MIN_DELTA_PP}
               missing={`Nessun confronto leggibile: servono almeno ${MIN_BRIDGE} partite sia con il carico alto sia con quello ottimale.`} />
        </>
      )}
      {l.skipped > 0 && l.used > 0 && (
        <p className="text-[9px] mt-3" style={{ color: 'var(--color-slate)' }}>
          {l.skipped} {l.skipped === 1 ? 'partita esclusa' : 'partite escluse'}: meno di 28 giorni di storico o di
          4 sessioni prima, quindi l'ACWR non era ancora calcolabile.
        </p>
      )}
    </Card>
  )
}

function LoadInfo() {
  return (
    <>
      <InfoItem>
        Lo stesso rapporto acuto/cronico del blocco «Carico e rischio» di Attività, calcolato per
        ogni partita sul <strong>giorno prima</strong> e con <strong>tutto</strong> il carico: tennis,
        corsa e palestra. La partita stessa non entra: è carico, e farla contare nel proprio acuto
        gonfierebbe proprio le partite lunghe.
      </InfoItem>
      <InfoItem title="Le tre fasce">
        Sotto carico: ACWR sotto {ACWR_MIN}. Ottimale: da {ACWR_MIN} a {ACWR_MAX}. Alto: sopra{' '}
        {ACWR_MAX} (qui il picco vero sta con il «sopra la fascia»: le partite giocate in picco sono
        troppo poche per stare da sole).
      </InfoItem>
    </>
  )
}

// ── Blocco 4 — Gli allenamenti di tennis ───────────────────

function TrainingsCard({ report, factor }) {
  const t = report.trainings
  const info = <InfoButton title="Gli allenamenti di tennis"><TrainingsInfo /></InfoButton>

  return (
    <Card id="incroci-allenamenti" title="Gli allenamenti di tennis" titleExtra={info}
          sub={`Il voto che dai ai colpi, per cosa c'era prima · ${factor.label.toLowerCase()}`}
          right={<SampleTag n={t.n} unit="con voto" />}>
      {!factor.available ? <MissingFactor factor={factor} /> : t.n === 0 ? (
        <NotEnough need={MIN_TRAIN_ROW} unit="allenamenti con le stelline dei colpi"
                   what="Un allenamento non ha un risultato: il suo esito è il voto" />
      ) : (
        <>
          <div className="space-y-3">
            {factor.buckets.map(b => (
              <BarRow key={b.id} label={b.label}
                      sub={b.n === 0 ? 'nessun allenamento con voto'
                        : `${b.n} ${b.n === 1 ? 'allenamento' : 'allenamenti'}${b.enough ? '' : ` · meno di ${MIN_TRAIN_ROW}, non leggibile`}`}
                      value={b.avg == null ? '—' : `${b.avg.toLocaleString('it-IT', { maximumFractionDigits: 1 })} / 5`}
                      rate={b.avg == null ? 0 : b.avg / 5} tick={t.overall == null ? undefined : t.overall / 5}
                      dim={!b.enough} />
            ))}
          </div>
          {factor.gap ? (
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
              {Math.abs(factor.gap.diff) < 0.2
                ? 'I voti sono gli stessi, con o senza.'
                : <>Voto medio <strong style={{ color: factor.gap.diff < 0 ? 'var(--color-amber)' : 'var(--color-win)' }}>
                    {factor.gap.diff < 0 ? 'più basso' : 'più alto'} di {Math.abs(factor.gap.diff).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                  </strong> quando c'è stata {factor.short} ieri o l'altro ieri.</>}
            </p>
          ) : (
            <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>
              Nessun confronto leggibile: servono almeno {MIN_TRAIN_ROW} allenamenti con voto sia in «ieri o l'altro ieri» sia in «nessuna nei 7 giorni».
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function TrainingsInfo() {
  return (
    <>
      <InfoItem>
        Un allenamento non ha un punteggio. Il suo esito è la media delle stelline (1-5) che dai ai
        colpi lavorati, quindi qui entrano solo gli allenamenti in cui le hai date.
      </InfoItem>
      <InfoItem title="Cosa misura davvero">
        Le stelline sono il colpo <em>e</em> come ti sentivi quel giorno. Un voto più basso dopo la
        palestra può voler dire gambe pesanti, ma anche un giorno storto: da solo il numero non
        distingue.
      </InfoItem>
    </>
  )
}

// ── Blocco 5 — Il cuore in campo ───────────────────────────

function BodyCard({ report, factor }) {
  const b = report.body
  const info = <InfoButton title="Il cuore in campo"><BodyInfo /></InfoButton>

  if (!b.available) {
    return (
      <Card id="incroci-condizione" title="Il cuore in campo" titleExtra={info}
            sub="La frequenza cardiaca a parità di velocità, per cosa c'era prima">
        <NotEnough need={b.missing} unit="sessioni di tennis con FC, distanza e durata"
                   what="Per confrontare il cuore a parità di velocità" />
        <Note>
          Il confronto usa lo stesso modello dell'economia cardiaca di Fisico, quindi servono le
          stesse sessioni: con il file .FIT dell'orologio ci sono tutte.
        </Note>
      </Card>
    )
  }

  const max = Math.max(1, ...(factor?.available ? factor.buckets.map(x => Math.abs(x.dev || 0)) : [0]))

  return (
    <Card id="incroci-condizione" title="Il cuore in campo" titleExtra={info}
          sub={`Battiti rispetto al solito, a pari velocità · ${factor.label.toLowerCase()}`}
          right={<SampleTag n={b.n} unit="sessioni" />}>
      {!factor.available ? <MissingFactor factor={factor} /> : (
        <>
          <div className="space-y-3">
            {factor.buckets.map(x => <DevRow key={x.id} bucket={x} max={max} />)}
          </div>
          <Gap gap={factor.gap} unit="bpm" threshold={MIN_DELTA_BPM} lowerIsBetter
               missing={`Nessun confronto leggibile: servono almeno ${MIN_SIDE} sessioni sia in «${factor.buckets[0].label.toLowerCase()}» sia in «${factor.buckets[2].label.toLowerCase()}».`} />
        </>
      )}

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
          Più lavoro fuori campo, cuore diverso?
        </p>
        <div className="space-y-3">
          {b.correlations.map(c => <CorrelationRow key={c.id} c={c} />)}
        </div>
      </div>

      <Note>
        {b.corrected
          ? 'Ogni sessione è riportata alla stessa velocità con il modello dell\'economia cardiaca di Fisico, poi confrontata con la FC abituale del suo tipo (partita o allenamento).'
          : 'Il modello non ha trovato un legame netto tra velocità e battiti su queste sessioni, quindi si confrontano le FC grezze rispetto alla media del loro tipo: va bene finché le velocità sono simili.'}
        {' '}Verde = il cuore ha lavorato meno del solito, ambra = di più.
      </Note>
    </Card>
  )
}

// Barra divergente dal solito (0): meno battiti a sinistra in verde, più battiti
// a destra in ambra. Il verde sta sul negativo come nell'economia cardiaca.
function DevRow({ bucket, max }) {
  const dev = bucket.dev
  const half = dev == null ? 0 : Math.min(1, Math.abs(dev) / max) * 50
  const color = dev == null || Math.abs(dev) < 1 ? 'var(--color-slate)' : dev < 0 ? 'var(--color-win)' : 'var(--color-amber)'
  return (
    <div style={{ opacity: bucket.enough ? 1 : 0.45 }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {bucket.label}
        </span>
        <span className="text-[11px] shrink-0 font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {dev == null ? '—' : `${formatDelta(dev, 0)} bpm`}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 relative" style={{ background: 'var(--color-surface-2)' }}>
        <div className="absolute top-0 bottom-0 rounded-full"
             style={{ left: dev != null && dev < 0 ? `${50 - half}%` : '50%', width: `${half}%`, background: color }} />
        <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'var(--color-white)', opacity: 0.35 }} />
      </div>
      <p className="text-[9px] mt-1" style={{ color: 'var(--color-slate)' }}>
        {bucket.n} {bucket.n === 1 ? 'sessione' : 'sessioni'}{bucket.n > 0 && !bucket.enough ? ` · meno di ${MIN_SIDE}, non leggibile` : ''}
      </p>
    </div>
  )
}

function CorrelationRow({ c }) {
  const where = c.unit === 'km' ? 'km corsi nelle 4 settimane prima' : 'palestre nelle 4 settimane prima'
  if (!c.available) {
    return (
      <p className="text-[10px]" style={{ color: 'var(--color-slate)' }}>
        <span style={{ color: 'var(--color-white)' }}>{where}</span>: servono {c.n < MIN_CORR ? `ancora ${MIN_CORR - c.n} sessioni` : 'sessioni con valori diversi'} per
        leggere un legame.
      </p>
    )
  }
  const strong = c.r != null && Math.abs(c.r) >= 0.4
  const per = c.unit === 'km' ? 10 : 1
  const effect = c.slope * per
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {where}
        </span>
        <span className="text-[11px] shrink-0 font-semibold"
              style={{ color: strong ? 'var(--color-teal)' : 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          r {c.r == null ? '—' : c.r.toFixed(2).replace('.', ',')}
        </span>
      </div>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
        {strong
          ? <>Ogni {per === 1 ? 'palestra' : `${per} km`} in più: {formatDelta(effect, 1)} battiti a pari velocità · </>
          : 'Nessun legame netto · '}
        {c.n} sessioni
      </p>
    </div>
  )
}

function BodyInfo() {
  return (
    <>
      <InfoItem>
        La frequenza cardiaca <strong>a parità di velocità</strong> è il segnale più onesto di come
        sta il corpo: se dopo una palestra il cuore lavora di più per andare alla stessa velocità, le
        gambe non erano fresche.
      </InfoItem>
      <InfoItem title="Perché «rispetto al solito»">
        Una partita ha sempre più battiti di un allenamento, quindi ogni sessione si confronta con la
        media del suo tipo: il numero è lo scarto, non la FC. Positivo = il cuore ha lavorato più del
        solito.
      </InfoItem>
      <InfoItem title="Più lavoro, cuore diverso?">
        Mette in relazione i km corsi (o le palestre fatte) nelle 4 settimane prima di ogni sessione
        con quello scarto. <strong>r</strong> va da −1 a +1: vicino a 0 non c'è legame, negativo
        vuol dire «più lavoro, cuore più tranquillo» (la corsa che si vede in campo), positivo il
        contrario. Sotto 0,4 in valore assoluto non lo leggo come un segnale. Le sessioni non sono
        indipendenti tra loro, quindi è un indizio, non una prova.
      </InfoItem>
    </>
  )
}

// ── Blocco 6 — Sforzo dichiarato e orologio ────────────────

function PerceivedCard({ report }) {
  const rows = report.perceived
  const any = rows.some(r => r.enough)
  const info = <InfoButton title="Sforzo dichiarato e orologio"><PerceivedInfo /></InfoButton>
  const max = Math.max(0.0001, ...rows.flatMap(r => r.rows.map(x => x.avg || 0)))

  return (
    <Card id="incroci-percepito" title="Sforzo dichiarato e orologio" titleExtra={info}
          sub="Quanto carico Garmin al minuto c'è dietro leggera, media e intensa">
      {!any ? (
        <NotEnough need={Math.max(1, Math.min(...rows.map(r => r.missing)))} unit="sessioni con intensità e carico Garmin"
                   what="Per confrontare la tua scala con l'orologio" />
      ) : (
        <div className="space-y-4">
          {rows.filter(r => r.enough).map(r => (
            <div key={r.id}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-[11px] flex-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{r.label}</span>
                <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  {r.n} sessioni{r.r != null ? ` · r ${r.r.toFixed(2).replace('.', ',')}` : ''}
                </span>
              </div>
              {r.rows.map(x => (
                <div key={x.id} className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] w-12 shrink-0" style={{ color: x.color, fontFamily: 'var(--font-display)' }}>{x.label}</span>
                  <div className="h-1.5 rounded-full flex-1" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${((x.avg || 0) / max) * 100}%`, background: x.color }} />
                  </div>
                  <span className="text-[9px] w-16 shrink-0 text-right" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                    {x.avg == null ? '—' : `${x.avg.toLocaleString('it-IT', { maximumFractionDigits: 1 })}/min`} · {x.n}
                  </span>
                </div>
              ))}
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-slate)' }}>
                {r.r == null ? '' : r.r >= 0.5
                  ? 'La tua scala segue l\'orologio: intensa è davvero più carico.'
                  : r.r >= 0.2
                    ? 'Legame debole tra quello che dichiari e quello che misura l\'orologio.'
                    : 'Quello che dichiari e quello che misura l\'orologio non vanno insieme: contano due cose diverse.'}
              </p>
            </div>
          ))}
        </div>
      )}
      {any && rows.some(r => !r.enough) && (
        <p className="text-[9px] mt-3" style={{ color: 'var(--color-slate)' }}>
          Non mostrati ({rows.filter(r => !r.enough).map(r => r.label.toLowerCase()).join(', ')}): meno di {MIN_PERCEIVED} sessioni con
          intensità dichiarata e carico Garmin.
        </p>
      )}
    </Card>
  )
}

function PerceivedInfo() {
  return (
    <>
      <InfoItem>
        L'intensità che scegli (leggera, media, intensa) è <em>sensazione</em>; il carico Garmin è
        <em> fisiologia</em> (quanto il corpo è stato sollecitato, dalle frequenze cardiache). Qui
        si mettono a confronto: per ogni sessione, carico Garmin diviso i minuti, mediato per
        intensità dichiarata.
      </InfoItem>
      <InfoItem title="Cosa ci puoi leggere">
        Se «intensa» ha davvero più carico al minuto di «leggera», la tua scala funziona. Se le
        barre sono piatte, o capovolte, nel dominio guardato sensazione e orologio dicono cose
        diverse: succede nella palestra, dove il cuore lavora poco anche con pesi pesanti, e nelle
        corse a ripetute dichiarate «leggere». È il motivo per cui l'orologio non decide al posto
        tuo quanto è stata dura una sessione.
      </InfoItem>
      <InfoItem title="Attenzione">
        In corsa e palestra il wizard preseleziona «media»: una media dichiarata può essere
        semplicemente il valore che non hai toccato.
      </InfoItem>
    </>
  )
}

// ── Scarto tra i due gruppi ────────────────────────────────

// La frase sotto un confronto: dice di quanto, in che verso, e se è sopra la
// soglia che separa un effetto da una fluttuazione. `lowerIsBetter` rovescia i
// colori (con i battiti, meno è meglio).
function Gap({ gap, unit, threshold, missing, lowerIsBetter = false }) {
  if (!gap) {
    return <p className="text-[10px] mt-3" style={{ color: 'var(--color-slate)' }}>{missing}</p>
  }
  const value = unit === 'pp' ? gap.diff * 100 : gap.diff
  const small = Math.abs(gap.diff) < threshold
  const worse = lowerIsBetter ? gap.diff > 0 : gap.diff < 0
  const color = small ? 'var(--color-slate)' : worse ? 'var(--color-amber)' : 'var(--color-win)'
  return (
    <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-white)' }}>
      Ieri o l'altro ieri contro nessuna nei 7 giorni:{' '}
      <strong style={{ color, fontFamily: 'var(--font-mono)' }}>
        {formatDelta(value, 0)} {unit === 'pp' ? 'punti' : 'battiti'}
      </strong>
      {small
        ? <span style={{ color: 'var(--color-slate)' }}> — sotto la soglia di {unit === 'pp' ? `${Math.round(threshold * 100)} punti` : `${threshold} battiti`}, è quello che il caso produce da solo.</span>
        : null}
    </p>
  )
}
