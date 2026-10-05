import { useState } from 'react'
import { Card, Tile, BarRow, NotEnough, SampleTag, Note, InfoButton, InfoItem, WeekBars, Sparkline, ZoneBar } from './StatsUI'
import BodyMap, { BodyMapLegend } from '../gym/BodyMap'
import {
  MUSCLES, heatColor, formatVolume, muscleLabel, WEEK_FULL_SETS,
} from '../../lib/gym'
import {
  MIN_GYM, NEGLECT_DAYS, TRAINED_POINTS, MIN_PROGRESS, MIN_BALANCE_SETS, MIN_WATCH,
  MIN_REPS_SETS, MIN_ZONES_GYM, MIN_DENSITY, MAX_RECORDS,
  muscleContributorsOver,
} from '../../lib/gymStats'
import { MIN_WEEKS } from '../../lib/activity'
import { HR_ZONES, formatDuration, formatTrainingEffect } from '../../lib/athletics'

// Sezione "Palestra" — risponde a "cosa alleno in palestra, e sto progredendo?".
//
// L'unità qui è la SERIA, e tutto nasce dalle schede registrate (mai dal .FIT:
// i dati dell'orologio, dove trascritti, sono solo il contorno dell'ultimo
// blocco). I blocchi vanno da quanto a cosa a come sta cambiando:
//   1. Volume            — sessioni, serie, kg sollevati, e come varia settimana per settimana
//   2. Costanza          — settimane attive, striscia, buco più lungo
//   3. Muscoli allenati  — il manichino sul periodo e sugli ultimi 7 giorni
//   4. Muscoli trascurati — da quanti giorni non alleni ciascun muscolo
//   5. Bilancio          — spinta, trazione, gambe e core
//   6. Esercizi          — i più fatti e le fasce di ripetizioni (forza, ipertrofia, resistenza)
//   7. Progressione      — il massimale stimato di ogni esercizio, nel tempo
//   8. Record            — i massimi battuti nel periodo, contro quelli di prima
//   9. Dall'orologio     — FC, zone, carico, calorie, training effect e riposo tra le serie,
//                          dai file .FIT e dove trascritti
//
// ── Niente drill-down alle sessioni ──
// Come Attività, Tecnica e Fisico: l'elenco delle sessioni esiste già nel tab
// Allenamenti, e il dettaglio di una sessione ha il suo manichino.

export default function Palestra({ report, periodLabel }) {
  if (!report.enough) {
    return (
      <div className="pt-4">
        <NotEnough need={report.missing} unit="sessioni di palestra" what="Per analizzare la palestra" />
        <Note>
          {report.total > report.n
            ? <>Hai {report.total} sessioni in tutto ma solo {report.n} nel periodo scelto. </>
            : null}
          Servono almeno {MIN_GYM} sessioni perché un numero significhi qualcosa. Si registrano da
          Matches › Allenamenti › + Allenamento › Palestra.
        </Note>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <VolumeCard report={report} periodLabel={periodLabel} />
      <ConsistencyCard report={report} />
      <MusclesCard report={report} />
      <NeglectCard report={report} />
      <BalanceCard report={report} />
      <ExercisesCard report={report} />
      <ProgressCard report={report} />
      <RecordsCard report={report} />
      <WatchCard report={report} />

      <Note>
        Tutto qui nasce dalle serie delle tue schede: i muscoli si ricavano dagli esercizi (1 punto
        per serie sui muscoli principali, 0,5 sui secondari), non dai dati dell'orologio. La scala
        del manichino è assoluta, quindi settimane e periodi diversi si leggono con lo stesso colore.
      </Note>
    </div>
  )
}

// ── Blocco 1 — Volume ──────────────────────────────────────

function VolumeCard({ report, periodLabel }) {
  const v = report.volume
  const delta = v.prev && v.prev.sets > 0 ? v.sets / v.prev.sets - 1 : null

  return (
    <Card id="volume" title="Volume" sub={periodLabel ? `Periodo: ${periodLabel.toLowerCase()}` : undefined}
          right={<SampleTag n={v.sessions} unit="sessioni" />}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Sessioni" value={v.sessions} />
        <Tile label="Serie" value={v.sets} sub={v.setsPerSession ? `${fmt(v.setsPerSession)}/sess.` : undefined} />
        <Tile label="Volume" value={formatVolume(v.volumeKg)} />
        <Tile label="A settimana" value={fmt(v.perWeek)} sub="sessioni" />
      </div>

      {delta != null && (
        <p className="text-[11px] mt-3" style={{ color: delta >= 0 ? 'var(--color-win)' : 'var(--color-amber)' }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% di serie rispetto al periodo precedente
          <span style={{ color: 'var(--color-slate)' }}> ({v.prev.sets} serie)</span>
        </p>
      )}

      {v.weekly.length > 1 && (
        <WeekBars title="Serie a settimana" weeks={v.weekly} value={w => w.sets} format={n => `${Math.round(n)} serie`} />
      )}
    </Card>
  )
}

// ── Blocco 1b — Costanza ───────────────────────────────────

function ConsistencyCard({ report }) {
  const c = report.consistency
  const info = (
    <InfoButton title="Come si legge la costanza">
      <InfoItem title="Settimane attive">
        Su quante settimane del periodo ti sei allenato almeno una volta. Le due settimane
        parziali agli estremi non contano: non sono settimane in cui hai saltato, sono settimane
        in cui non c'era il tempo.
      </InfoItem>
      <InfoItem title="Striscia e ultima sessione">
        Sono fatti del presente: si calcolano su tutto lo storico rispetto a oggi, qualunque
        periodo tu abbia scelto. Una settimana in corso ancora vuota non interrompe la striscia.
      </InfoItem>
      <InfoItem title="Buco più lungo">
        I giorni consecutivi senza palestra tra due sessioni del periodo.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="costanza-palestra" title="Costanza" titleExtra={info}>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Settimane attive" value={c.enoughWeeks ? `${c.activeWeeks}/${c.weeks}` : '—'}
              sub={c.enoughWeeks && c.activeShare != null ? `${Math.round(c.activeShare * 100)}%` : `servono ${MIN_WEEKS}`}
              color={c.enoughWeeks ? 'var(--color-teal)' : 'var(--color-slate)'} />
        <Tile label="Striscia" value={c.streakWeeks} sub="settimane" />
        <Tile label="Buco più lungo" value={c.longestGap || '—'} sub={c.longestGap ? 'giorni' : undefined} />
        <Tile label="Ultima sessione" value={c.sinceLast == null ? '—' : c.sinceLast === 0 ? 'oggi' : c.sinceLast}
              sub={c.sinceLast ? 'giorni fa' : undefined} />
      </div>
    </Card>
  )
}

// ── Blocco 2 — Muscoli allenati ────────────────────────────

function MusclesCard({ report }) {
  const [view, setView] = useState('period')       // period | week
  const [selected, setSelected] = useState(null)
  const data = view === 'period' ? report.muscles.period : report.muscles.lastWeek
  const ranked = MUSCLES.filter(m => data.perWeek[m.id]).sort((a, b) => data.perWeek[b.id] - data.perWeek[a.id])
  const contributors = selected ? muscleContributorsOver(data.sessions, report.index, selected) : []

  return (
    <Card id="muscoli" title="Muscoli allenati"
          titleExtra={<InfoButton title="Come si legge il manichino?"><MusclesInfo /></InfoButton>}
          right={<SampleTag n={data.sessions.length} unit={data.sessions.length === 1 ? 'sessione' : 'sessioni'} />}>
      <div className="flex gap-2 mb-3">
        {[{ id: 'period', label: 'Periodo' }, { id: 'week', label: 'Ultimi 7 giorni' }].map(o => (
          <button key={o.id} onClick={() => { setView(o.id); setSelected(null) }}
            className="flex-1 py-1.5 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: view === o.id ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
              color: view === o.id ? 'var(--color-white)' : 'var(--color-slate)',
              fontFamily: 'var(--font-display)',
            }}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl py-2" style={{ background: 'var(--color-bg)' }}>
        <BodyMap heat={data.heat} selected={selected} onSelect={setSelected} />
      </div>
      <div className="mt-3"><BodyMapLegend /></div>
      <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--color-slate)' }}>
        Rosso pieno a {WEEK_FULL_SETS} serie equivalenti a settimana
      </p>

      {selected && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--color-surface-2)' }}>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
              {muscleLabel(selected)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {data.perWeek[selected] ? `${fmt(data.perWeek[selected])} serie eq./sett.` : 'Non allenato'}
            </p>
          </div>
          {contributors.slice(0, 6).map(c => (
            <div key={c.exercise.id} className="flex items-baseline justify-between gap-2 mt-1.5">
              <span className="text-[11px] truncate" style={{ color: 'var(--color-white)' }}>{c.exercise.name}</span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--color-slate)' }}>
                {c.sets} serie · {c.role === 'primary' ? 'principale' : 'secondario'}
              </span>
            </div>
          ))}
        </div>
      )}

      {ranked.length === 0 ? (
        <p className="text-[11px] text-center mt-3" style={{ color: 'var(--color-slate)' }}>
          Nessuna sessione di palestra negli ultimi 7 giorni.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {ranked.map(m => (
            <BarRow key={m.id} label={m.label} value={`${fmt(data.perWeek[m.id])}/sett.`}
                    rate={data.heat[m.id]} color={heatColor(Math.max(0.05, data.heat[m.id]))}
                    onClick={() => setSelected(s => (s === m.id ? null : m.id))} />
          ))}
        </div>
      )}
    </Card>
  )
}

function MusclesInfo() {
  return (
    <>
      <InfoItem title="Serie equivalenti">
        Ogni serie conta 1 punto per i muscoli principali dell'esercizio e 0,5 per quelli
        secondari: una panca piana dà 1 al petto e 0,5 a tricipiti e spalle.
      </InfoItem>
      <InfoItem title="La scala del colore">
        È assoluta: il muscolo non toccato ha il colore dello sfondo, poi si va dal giallo (poco)
        all'arancio al rosso pieno, che sono {WEEK_FULL_SETS} serie equivalenti <em>a settimana</em>.
        Nel periodo si usa la media settimanale, contando le settimane dalla tua prima sessione.
      </InfoItem>
      <InfoItem title="Perché 12">
        Le linee guida sull'allenamento per l'ipertrofia indicano una fascia di circa 10-20 serie a
        settimana per gruppo muscolare. Il rosso pieno sta dentro quella fascia.
      </InfoItem>
    </>
  )
}

// ── Blocco 3 — Muscoli trascurati ──────────────────────────

function NeglectCard({ report }) {
  const rows = [...report.muscles.recency].sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
  const stale = rows.filter(r => r.days == null || r.days >= NEGLECT_DAYS)

  return (
    <Card id="trascurati" title="Muscoli trascurati"
          sub="Da quanti giorni non alleni ciascun muscolo, su tutto lo storico"
          titleExtra={<InfoButton title="Cosa vuol dire «allenato»?">
            <InfoItem>
              Una sessione conta per un muscolo solo se gli dà almeno {TRAINED_POINTS} serie
              equivalenti: mezza serie da muscolo secondario non è allenarlo. Sopra i {NEGLECT_DAYS} giorni
              la riga diventa ambra.
            </InfoItem>
          </InfoButton>}>
      {stale.length === 0 && (
        <p className="text-[11px] mb-3" style={{ color: 'var(--color-win)' }}>
          Hai allenato tutti i muscoli negli ultimi {NEGLECT_DAYS} giorni.
        </p>
      )}
      <div className="space-y-2.5">
        {rows.map(r => {
          const isStale = r.days == null || r.days >= NEGLECT_DAYS
          return (
            <BarRow key={r.id} label={r.label}
                    value={r.days == null ? 'mai' : r.days === 0 ? 'oggi' : `${r.days} gg`}
                    rate={r.days == null ? 1 : Math.min(1, r.days / 60)}
                    color={isStale ? 'var(--color-amber)' : 'var(--color-teal-dark)'}
                    dim={false} />
          )
        })}
      </div>
    </Card>
  )
}

// ── Blocco 4 — Bilancio ────────────────────────────────────

function BalanceCard({ report }) {
  const b = report.balance
  return (
    <Card id="bilancio" title="Bilancio dei movimenti" right={<SampleTag n={b.total} unit="serie" />}>
      {!b.enough ? (
        <NotEnough need={MIN_BALANCE_SETS - b.total} unit="serie" what="Per il bilancio" />
      ) : (
        <>
          <div className="space-y-2.5">
            {b.rows.filter(r => r.sets > 0).map(r => (
              <BarRow key={r.id} label={r.label} value={`${r.sets} serie · ${Math.round(r.share * 100)}%`}
                      rate={r.share} color={r.color} />
            ))}
          </div>
          {b.ratio != null && (
            <p className="text-[11px] mt-3" style={{ color: 'var(--color-slate)' }}>
              Spinta / trazione: <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{fmt(b.ratio)}</span>
              {' '}(un rapporto vicino a 1 vuol dire equilibrio)
            </p>
          )}
        </>
      )}
    </Card>
  )
}

// ── Blocco 4b — Esercizi e fasce di ripetizioni ────────────

function ExercisesCard({ report }) {
  const m = report.mix
  const info = (
    <InfoButton title="Esercizi e fasce di ripetizioni">
      <InfoItem title="Gli esercizi più fatti">
        Contati per serie, non per sessioni: tre serie di panca pesano tre, indipendentemente da
        quante volte ci sei tornato.
      </InfoItem>
      <InfoItem title="Le fasce">
        Il numero di ripetizioni di una serie orienta lo stimolo: fino a 5 si parla di forza, da 6
        a 12 di ipertrofia, da 13 in su di resistenza muscolare. I confini sono quelli di uso
        comune e non un obiettivo: una scheda tutta in una fascia lascia fuori gli altri stimoli.
      </InfoItem>
      <InfoItem title="Cosa non conta">
        Gli esercizi a tempo (plank, isometrie) non hanno ripetizioni e restano fuori dalle fasce.
        Servono {MIN_REPS_SETS} serie con le ripetizioni perché il mix significhi qualcosa.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="esercizi" title="Esercizi" titleExtra={info}
          sub="I più fatti e come ripeti"
          right={<SampleTag n={m.distinct} unit={m.distinct === 1 ? 'esercizio' : 'esercizi'} />}>
      <div className="space-y-2.5">
        {m.top.map(r => (
          <BarRow key={r.exercise.id} label={r.exercise.name}
                  value={`${r.sets} serie · ${r.sessions} ${r.sessions === 1 ? 'volta' : 'volte'}`}
                  rate={m.top[0].sets ? r.sets / m.top[0].sets : 0} />
        ))}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
          Fasce di ripetizioni · {m.repSets} serie
        </p>
        {!m.bandsEnough ? (
          <NotEnough need={m.bandsMissing} unit="serie con le ripetizioni" what="Per il mix delle fasce" />
        ) : (
          <div className="space-y-2.5">
            {m.bands.map(b => (
              <BarRow key={b.id} label={`${b.label} · ${b.hint}`} value={`${Math.round(b.share * 100)}%`}
                      rate={b.share} color="var(--color-teal-dark)" />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Blocco 5 — Progressione ────────────────────────────────

function ProgressCard({ report }) {
  const rows = report.progress.slice(0, 8)
  return (
    <Card id="progressione" title="Progressione"
          sub="Il valore migliore di ogni sessione, per gli esercizi fatti almeno 3 volte"
          titleExtra={<InfoButton title="Il massimale stimato"><ProgressInfo /></InfoButton>}
          right={<SampleTag n={report.progress.length} unit="esercizi" />}>
      {rows.length === 0 ? (
        <NotEnough need={MIN_PROGRESS} unit="sessioni con lo stesso esercizio" what="Per la progressione" />
      ) : (
        <div className="space-y-3">
          {rows.map(p => (
            <div key={p.exercise.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {p.exercise.name}
                </span>
                <span className="text-[11px] shrink-0 font-semibold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                  {fmt(p.last)} {p.unit}
                </span>
                <span className="text-[11px] shrink-0 w-12 text-right"
                      style={{ color: p.delta > 0.005 ? 'var(--color-win)' : p.delta < -0.005 ? 'var(--color-loss)' : 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                  {p.delta > 0.005 ? '+' : ''}{Math.round(p.delta * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Sparkline points={p.points} />
                <p className="text-[10px]" style={{ color: 'var(--color-slate)' }}>
                  {p.n} sessioni · record {fmt(p.pr)} {p.unit}{p.prIsLast ? ' 🏅' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ProgressInfo() {
  return (
    <>
      <InfoItem title="Massimale stimato">
        Per gli esercizi con il carico è il peso che solleveresti una volta sola, stimato dalla serie
        migliore di ogni sessione con la formula di Epley: kg × (1 + ripetizioni ÷ 30). Si calcola
        solo fino a 12 ripetizioni, oltre la stima non regge.
      </InfoItem>
      <InfoItem title="Corpo libero e tempo">
        Per gli esercizi a corpo libero è il massimo di ripetizioni in una serie, per quelli a tempo
        i secondi della serie più lunga.
      </InfoItem>
      <InfoItem title="Quando compare">
        Servono almeno {MIN_PROGRESS} sessioni con lo stesso esercizio nel periodo, e per quelli con
        il carico serve che i kg siano stati scritti.
      </InfoItem>
    </>
  )
}

// ── Blocco 5b — Record ─────────────────────────────────────

function RecordsCard({ report }) {
  const rows = report.records.slice(0, MAX_RECORDS)
  const info = (
    <InfoButton title="Come si leggono i record">
      <InfoItem>
        Il valore migliore di ogni esercizio nel periodo contro il migliore che avevi <em>prima</em>:
        il massimale stimato per gli esercizi con il carico, le ripetizioni per il corpo libero, i
        secondi per quelli a tempo. Compaiono solo gli esercizi che hai migliorato.
      </InfoItem>
      <InfoItem title="Se l'esercizio è nuovo">
        Se l'hai iniziato nel periodo non c'è un «prima»: il riferimento è la sua prima sessione, e
        un record c'è solo se poi l'hai superata.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="record-palestra" title="Record" titleExtra={info} sub="Rispetto a prima del periodo"
          right={<SampleTag n={report.records.length} unit={report.records.length === 1 ? 'esercizio' : 'esercizi'} />}>
      {rows.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--color-slate)' }}>
          Nessun esercizio ha superato il suo massimo precedente in questo periodo.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.exercise.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                 style={{ background: 'var(--color-surface-2)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] truncate" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                  {r.exercise.name} 🏅
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-slate)' }}>
                  da {fmt(r.previous)} a {fmt(r.value)} {r.unit}{r.unit === 'kg' ? ' di massimale stimato' : ''} · {shortDay(new Date(r.date).getTime())}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-win)', fontFamily: 'var(--font-mono)' }}>
                +{Math.round(r.delta * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Blocco 6 — Dall'orologio ───────────────────────────────

function WatchCard({ report }) {
  const w = report.watch
  const z = w.zones
  const info = (
    <InfoButton title="Dall'orologio">
      <InfoItem title="Misurate e trascritte">
        Le sessioni importate dal file .FIT hanno tutti i campi, misurati; quelle trascritte a
        mano ne hanno solo alcuni. Ogni media dichiara su quante sessioni è calcolata.
      </InfoItem>
      <InfoItem title="Il carico Garmin">
        Il «Carico allenamento» dell'orologio, basato sul consumo di ossigeno dopo lo sforzo. In
        palestra è molto più basso che in una corsa: conta il confronto tra sessioni, non il
        valore assoluto. C'è solo nelle sessioni importate dal file.
      </InfoItem>
      <InfoItem title="Riposo tra le serie: una stima">
        L'orologio dice quanto è durata la sessione, la scheda quante serie hai fatto. Togliendo il
        tempo stimato di esecuzione (circa 3 secondi a ripetizione) il resto è, in media, il
        riposo tra una serie e l'altra. Mescola anche cambi di attrezzo e pause: è un ordine di
        grandezza, non un cronometro. Servono {MIN_DENSITY} sessioni con la durata dell'orologio.
      </InfoItem>
    </InfoButton>
  )

  return (
    <Card id="orologio" title="Dall'orologio" titleExtra={info}
          sub={w.n ? `${w.measured} dal file .FIT · ${w.manual} trascritte a mano` : 'Solo le sessioni con i dati dell\'orologio'}
          right={<SampleTag n={w.n} unit={w.n === 1 ? 'sessione' : 'sessioni'} />}>
      {!w.enough ? (
        <NotEnough need={MIN_WATCH - w.n} unit="sessioni con i dati dell'orologio" what="Per le medie" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {w.durationSec.n > 0 && <Tile label="Durata media" value={formatDuration(Math.round(w.durationSec.value))} sub={`su ${w.durationSec.n}`} />}
            {w.avgHr.n > 0 && <Tile label="FC media" value={`${Math.round(w.avgHr.value)}`} sub={`bpm · su ${w.avgHr.n}`} color="var(--color-loss)" />}
            {w.calories.n > 0 && <Tile label="Calorie" value={Math.round(w.calories.value).toLocaleString('it-IT')} sub={`kcal · su ${w.calories.n}`} color="var(--color-amber)" />}
            {w.trainingEffect.n > 0 && <Tile label="TE aerobico" value={formatTrainingEffect(w.trainingEffect.value)} sub={`su ${w.trainingEffect.n}`} />}
            {w.anaerobic.n > 0 && <Tile label="TE anaerobico" value={formatTrainingEffect(w.anaerobic.value)} sub={`su ${w.anaerobic.n}`} />}
            {w.load.n > 0 && <Tile label="Carico Garmin" value={fmt(w.load.value)} sub={`max ${fmt(w.load.max)} · su ${w.load.n}`} color="var(--color-amber)" />}
          </div>

          {w.density.enough && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Tile label="Serie all'ora" value={Math.round(w.density.setsPerHour)} sub={`su ${w.density.n}`} />
              <Tile label="Riposo tra le serie" value={`~${Math.round(w.density.restSec)} s`} sub="stima" />
            </div>
          )}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
            <p className="text-[9px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--color-slate)' }}>
              Zone di frequenza cardiaca
            </p>
            {!z.enough ? (
              <NotEnough need={MIN_ZONES_GYM - z.n} unit="sessioni con le zone" what="Per la distribuzione" />
            ) : (
              <>
                <ZoneBar shares={z.shares} />
                <div className="space-y-1.5 mt-3">
                  {HR_ZONES.map((zone, i) => (
                    z.secs[i] > 0 ? (
                      <div key={zone.id} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: zone.color }} />
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
                          {zone.label}
                        </span>
                        <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--color-slate)' }}>{zone.name}</span>
                        <span className="text-[11px] shrink-0" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>
                          {formatDuration(z.secs[i])}
                        </span>
                        <span className="text-[11px] w-9 text-right shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                          {Math.round(z.shares[i] * 100)}%
                        </span>
                      </div>
                    ) : null
                  ))}
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--color-slate)' }}>
                  Su {z.n} sessioni, {formatDuration(z.total)} registrati. In palestra la FC resta bassa: le serie sono brevi e il riposo la fa scendere.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Helpers ────────────────────────────────────────────────

const fmt = (v) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })

function shortDay(t) {
  return new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
