import { useState } from 'react'
import { Card, Tile, BarRow, NotEnough, SampleTag, Note, InfoButton, InfoItem, WeekBars, Sparkline } from './StatsUI'
import BodyMap, { BodyMapLegend } from '../gym/BodyMap'
import {
  MUSCLES, heatColor, formatVolume, muscleLabel, WEEK_FULL_SETS,
} from '../../lib/gym'
import {
  MIN_GYM, NEGLECT_DAYS, TRAINED_POINTS, MIN_PROGRESS, MIN_BALANCE_SETS, MIN_WATCH,
  muscleContributorsOver,
} from '../../lib/gymStats'
import { formatDuration, formatTrainingEffect } from '../../lib/athletics'

// Sezione "Palestra" — risponde a "cosa alleno in palestra, e sto progredendo?".
//
// L'unità qui è la SERIA, e tutto nasce dalle schede registrate (mai dal .FIT:
// i dati dell'orologio, dove trascritti, sono solo il contorno dell'ultimo
// blocco). I blocchi vanno da quanto a cosa a come sta cambiando:
//   1. Volume            — sessioni, serie, kg sollevati, e come varia settimana per settimana
//   2. Muscoli allenati  — il manichino sul periodo e sugli ultimi 7 giorni
//   3. Muscoli trascurati — da quanti giorni non alleni ciascun muscolo
//   4. Bilancio          — spinta, trazione, gambe e core
//   5. Progressione      — il massimale stimato di ogni esercizio, nel tempo
//   6. Dall'orologio     — FC, calorie e training effect, dove trascritti
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
      <MusclesCard report={report} />
      <NeglectCard report={report} />
      <BalanceCard report={report} />
      <ProgressCard report={report} />
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

// ── Blocco 6 — Dall'orologio ───────────────────────────────

function WatchCard({ report }) {
  const w = report.watch
  return (
    <Card id="orologio" title="Dall'orologio" sub="Solo le sessioni in cui hai trascritto i dati"
          right={<SampleTag n={w.n} unit={w.n === 1 ? 'sessione' : 'sessioni'} />}>
      {!w.enough ? (
        <NotEnough need={MIN_WATCH - w.n} unit="sessioni con i dati dell'orologio" what="Per le medie" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {w.durationSec.n > 0 && <Tile label="Durata media" value={formatDuration(Math.round(w.durationSec.value))} sub={`su ${w.durationSec.n}`} />}
          {w.avgHr.n > 0 && <Tile label="FC media" value={`${Math.round(w.avgHr.value)}`} sub={`bpm · su ${w.avgHr.n}`} color="var(--color-loss)" />}
          {w.calories.n > 0 && <Tile label="Calorie" value={Math.round(w.calories.value).toLocaleString('it-IT')} sub={`kcal · su ${w.calories.n}`} color="var(--color-amber)" />}
          {w.trainingEffect.n > 0 && <Tile label="TE aerobico" value={formatTrainingEffect(w.trainingEffect.value)} sub={`su ${w.trainingEffect.n}`} />}
          {w.anaerobic.n > 0 && <Tile label="TE anaerobico" value={formatTrainingEffect(w.anaerobic.value)} sub={`su ${w.anaerobic.n}`} />}
        </div>
      )}
    </Card>
  )
}

// ── Helpers ────────────────────────────────────────────────

const fmt = (v) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })
