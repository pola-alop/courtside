import { Card, Tile, NotEnough, Note, InfoButton, InfoItem } from './StatsUI'
import { DOMAINS, DOMAIN_BY_ID } from '../../lib/crossStats'
import {
  ACWR_MIN, ACWR_MAX, ACWR_HIGH, MONOTONY_HIGH, MIN_ACWR_DAYS, MIN_ACWR_SESS,
  LOAD_RPE, MATCH_RPE, formatDuration,
} from '../../lib/activity'

// Blocco 3 — carico settimanale, ACWR, monotonia e strain.
//
// È lo stesso identico dato di "Volume" letto con un'altra unità: non ore, ma
// DOSE. Un'ora di cesto blando e mezz'ora di match play sono la stessa ora e non
// sono la stessa dose, e il carico interno (durata × sforzo percepito, il
// session-RPE di Foster) è il modo standard di metterle sulla stessa scala.
//
// Due letture complementari:
//   · la serie storica del carico settimanale, che segue il periodo scelto;
//   · lo stato di ADESSO — ACWR, monotonia, strain — che è calcolato sempre
//     sull'intero storico rispetto a oggi, per lo stesso motivo per cui gli
//     alert di usura in Panoramica compaiono solo a offset 0: un rapporto
//     acuto/cronico riferito a tre mesi fa non dice niente su cosa fare domani.
//
// ── Il carico è di tutto il corpo, il volume no ──
// Qui entrano anche corsa e palestra (`report.loadWeeks`, `report.load`): al
// corpo non importa dove ha faticato, e un ACWR che ignorasse una settimana di
// corsa e ghisa direbbe «sei fresco» a chi non lo è. Le ore in campo del resto
// della sezione restano invece solo di tennis.
//
// L'unità del carico è arbitraria (minuti × RPE): conta il confronto tra
// settimane, non il valore assoluto. La pagina lo dichiara invece di far
// credere che "1.400" significhi qualcosa in sé.
export default function LoadBlock({ report }) {
  const { load } = report
  const weeks = report.loadWeeks || report.weeks

  return (
    <Card id="carico" title="Carico e rischio" sub="Tennis, corsa e palestra lette come dose di allenamento"
          titleExtra={<InfoButton title="Carico, ACWR, monotonia"><LoadInfo /></InfoButton>}>

      <WeeklyLoadChart weeks={weeks} />

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-surface-2)' }}>
        <p className="text-[9px] uppercase tracking-wide mb-2" style={{ color: 'var(--color-slate)' }}>
          Adesso · ultimi 7 giorni contro le ultime 4 settimane
        </p>

        {load.available ? <AcwrSection load={load} /> : <AcwrMissing load={load} />}
      </div>

      <Note>
        Il carico è <strong>durata × sforzo</strong>, e lo sforzo è l'<strong>intensità</strong> che
        hai segnato sulla sessione: {LOAD_RPE.leggera} se leggera, {LOAD_RPE.media} se media,
        {' '}{LOAD_RPE.intensa} se intensa. Dove il campo è vuoto si usa un valore di riferimento —
        {' '}{LOAD_RPE.media} per un allenamento, {MATCH_RPE} per una partita, che si gioca a punti
        veri e sta per definizione nella fascia alta. Corsa e palestra contano come il tennis; senza
        i dati dell'orologio la loro durata è quella stimata dalla scheda.
        {load.available && load.declaredShare != null && load.declaredShare < 1 && (
          <> Nelle ultime 4 settimane il <strong>{Math.round(load.declaredShare * 100)}%</strong> dei
          minuti ha uno sforzo dichiarato: il resto è assunto, quindi questi numeri sono un ordine di
          grandezza. Indicare l'intensità sulle {load.assumedSessions} sessioni che ne sono prive lo
          rende un dato.</>
        )}
        {' '}L'unità è arbitraria: conta come cambia da una settimana all'altra, non quanto vale.
      </Note>
    </Card>
  )
}

// Con il solo tennis è una serie sola (il carico), quindi nessuna legenda: il
// colore porta magnitudine, non identità. Con più domini il colore porta
// l'identità e la legenda ha il valore accanto. La settimana in corso è l'ultima barra ed è
// incompleta per costruzione, quindi viene distinta invece di essere letta come
// un crollo.
function WeeklyLoadChart({ weeks }) {
  if (weeks.length < 2) return null
  const max = Math.max(1, ...weeks.map(w => w.load))
  // Con corsa o palestra nel periodo le barre si impilano per dominio e la
  // legenda porta il valore accanto al colore; con il solo tennis restano a
  // serie singola e senza legenda, come prima.
  const stacked = weeks.some(w => w.sessions.some(s => (s.domain || 'tennis') !== 'tennis'))
  const totals = DOMAINS.map(d => ({
    ...d, load: weeks.reduce((sum, w) => sum + domainLoad(w, d.id), 0),
  }))
  const grand = totals.reduce((sum, d) => sum + d.load, 0)
  const withLoad = weeks.filter(w => w.load > 0)
  const avg = withLoad.length ? withLoad.reduce((s, w) => s + w.load, 0) / weeks.length : 0

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
          Carico settimanale
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          media {formatLoad(avg)}
        </span>
      </div>

      {/* Su "12 mesi" le barre sono 53: il distanziatore scende a 1px, come
          nell'andamento del GW% in Rendimento, o i vuoti coprirebbero i dati. */}
      <div className="relative h-16 flex items-end" style={{ gap: weeks.length > 26 ? 1 : 2 }}>
        {/* Riferimento orizzontale: la media del periodo. Senza, una barra alta
            non si distingue da una settimana normale in un periodo tranquillo. */}
        <div className="absolute left-0 right-0 h-px pointer-events-none"
             style={{ bottom: `${(avg / max) * 100}%`, background: 'var(--color-white)', opacity: 0.25 }} />
        {weeks.map((w, i) => {
          const title = `${weekLabel(w.start)} · ${w.n} sessioni · ${formatDuration(w.minutes)} · carico ${formatLoad(w.load)}`
          const height = `${Math.max(w.load > 0 ? 3 : 1, (w.load / max) * 100)}%`
          if (!stacked || w.load === 0) {
            return (
              <div key={w.start} className="flex-1 min-w-0 rounded-t-[2px]" title={title}
                   style={{
                     height,
                     background: w.load === 0
                       ? 'var(--color-surface-2)'
                       : i === weeks.length - 1 ? 'var(--color-teal-light)' : 'var(--color-teal-dark)',
                   }} />
            )
          }
          // La settimana in corso è più chiara perché incompleta, non perché
          // sia un dominio diverso: l'opacità non tocca i colori dei domini.
          return (
            <div key={w.start} className="flex-1 min-w-0 flex flex-col-reverse rounded-t-[2px] overflow-hidden" title={title}
                 style={{ height, opacity: i === weeks.length - 1 ? 0.6 : 1 }}>
              {DOMAINS.map(d => {
                const v = domainLoad(w, d.id)
                return v > 0 ? <div key={d.id} style={{ height: `${(v / w.load) * 100}%`, background: d.color }} /> : null
              })}
            </div>
          )
        })}
      </div>
      {stacked && grand > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {totals.filter(d => d.load > 0).map(d => (
            <span key={d.id} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-slate)' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              {d.label}
              <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{Math.round((d.load / grand) * 100)}%</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {weekLabel(weeks[0].start)}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          settimana in corso
        </span>
      </div>
    </div>
  )
}

function AcwrSection({ load }) {
  const zone = load.zone

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none" style={{ color: zone.color, fontFamily: 'var(--font-display)' }}>
            {load.ratio.toFixed(2)}<span className="text-lg">×</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--color-slate)' }}>
            Rapporto acuto / cronico
          </p>
        </div>
        {/* Lo stato non è mai affidato al solo colore: icona + parola, sempre. */}
        <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1"
              style={{ background: 'var(--color-surface-2)', color: zone.color, fontFamily: 'var(--font-display)' }}>
          <span>{zoneIcon(zone.id)}</span>{zone.label}
        </span>
      </div>

      <AcwrTrack ratio={load.ratio} />

      <div className="grid grid-cols-4 gap-2 mt-3">
        <Tile label="Acuto 7g" value={formatLoad(load.acute)} sub={`${load.sessions7} sess.`} />
        <Tile label="Cronico" value={formatLoad(load.chronic)} sub="media sett. 28g" />
        <Tile label="Monotonia" value={load.monotony == null ? '—' : `${load.monotonyCapped ? '≥' : ''}${load.monotony.toFixed(1)}`}
              color={load.monotony != null && load.monotony >= MONOTONY_HIGH ? 'var(--color-amber)' : 'var(--color-white)'}
              sub={monotonyLabel(load.monotony)} />
        <Tile label="Strain" value={load.strain == null ? '—' : formatLoad(load.strain)} sub="carico × monotonia" />
      </div>

      <AcuteByDomain byDomain={load.byDomain} />

      <DailyLoad daily={load.daily} />
    </>
  )
}

// Di chi è il carico degli ultimi 7 giorni. Compare solo se ne hanno prodotto
// più di un dominio: con il solo tennis sarebbe «tennis 100%», che non dice niente.
function AcuteByDomain({ byDomain }) {
  if (!byDomain) return null
  const parts = DOMAINS.filter(d => byDomain[d.id] > 0)
  if (parts.length < 2) return null
  const total = parts.reduce((s, d) => s + byDomain[d.id], 0)
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>Acuto di</span>
      {parts.map(d => (
        <span key={d.id} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-slate)' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_BY_ID[d.id].color }} />
          {d.label}
          <span style={{ color: 'var(--color-white)', fontFamily: 'var(--font-mono)' }}>{Math.round((byDomain[d.id] / total) * 100)}%</span>
        </span>
      ))}
    </div>
  )
}

// I sette carichi giornalieri che producono la monotonia. Mostrarli evita che
// "monotonia 2,3" resti un numero da credere sulla parola: la forma della
// settimana — piatta o alternata — si vede.
function DailyLoad({ daily }) {
  const max = Math.max(1, ...daily.map(d => d.load))
  return (
    <div className="mt-3">
      <p className="text-[9px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-slate)' }}>
        Ultimi 7 giorni
      </p>
      {/* Come il grafico dei giorni della settimana: altezza intrinseca, perché
          sotto ogni barra c'è la sua etichetta. */}
      <div className="flex gap-1 items-end">
        {daily.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
               title={`${d.label}: carico ${formatLoad(d.load)}`}>
            <div className="w-full rounded-t-[2px]"
                 style={{
                   height: `${Math.max(2, (d.load / max) * 26)}px`,
                   background: d.load ? 'var(--color-teal-dark)' : 'var(--color-surface-2)',
                 }} />
            <span className="text-[8px]" style={{ color: 'var(--color-slate)' }}>{d.label[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Traccia 0–2× con la fascia consigliata evidenziata. Una percentuale sola non
// dice da che parte della soglia stai: qui la soglia è disegnata.
function AcwrTrack({ ratio }) {
  const SCALE = 2
  const pos = Math.max(0, Math.min(1, ratio / SCALE))

  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        <div className="absolute top-0 bottom-0"
             style={{
               left: `${(ACWR_MIN / SCALE) * 100}%`,
               width: `${((ACWR_MAX - ACWR_MIN) / SCALE) * 100}%`,
               background: 'var(--color-win)', opacity: 0.35,
             }} />
        <div className="absolute top-0 bottom-0"
             style={{
               left: `${(ACWR_MAX / SCALE) * 100}%`,
               width: `${((ACWR_HIGH - ACWR_MAX) / SCALE) * 100}%`,
               background: 'var(--color-amber)', opacity: 0.28,
             }} />
        <div className="absolute top-0 bottom-0"
             style={{ left: `${(ACWR_HIGH / SCALE) * 100}%`, right: 0, background: 'var(--color-loss)', opacity: 0.28 }} />
        {/* Anello di superficie attorno al marker: senza, sul verde della fascia
            scomparirebbe proprio dove serve di più. */}
        <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full"
             style={{
               left: `${pos * 100}%`,
               transform: 'translate(-50%, -50%)',
               background: 'var(--color-white)',
               boxShadow: '0 0 0 2px var(--color-surface)',
             }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>0</span>
        <span className="text-[8px]" style={{ color: 'var(--color-win)', fontFamily: 'var(--font-mono)' }}>
          {ACWR_MIN}–{ACWR_MAX} consigliata
        </span>
        <span className="text-[8px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>{SCALE}×</span>
      </div>
    </div>
  )
}

function AcwrMissing({ load }) {
  if (load.reason === 'history') {
    return <NotEnough need={load.missingDays} unit="giorni di storico"
                      what={`Il carico cronico si costruisce su ${MIN_ACWR_DAYS} giorni`} />
  }
  if (load.reason === 'sessions') {
    return <NotEnough need={load.missingSessions} unit="sessioni negli ultimi 28 giorni"
                      what="Per un rapporto acuto/cronico sensato" />
  }
  return <NotEnough need={MIN_ACWR_SESS} unit="sessioni recenti"
                    what="Nelle ultime 4 settimane non c'è carico da confrontare" />
}

function LoadInfo() {
  return (
    <>
      <InfoItem>
        Le stesse ore del blocco Volume, lette come <strong>dose</strong>. Un'ora di palleggio
        tranquillo e un'ora di partita sono la stessa ora ma non chiedono al corpo la stessa cosa,
        quindi ogni sessione vale <em>durata × sforzo</em>. Il numero che esce è in unità arbitrarie:
        serve a confrontare una settimana con l'altra, non a dire nulla da solo.
      </InfoItem>
      <InfoItem title="Da dove viene lo sforzo">
        Dal campo <strong>intensità</strong> della sessione — quello che scegli tra leggera, media e
        intensa: nel wizard allenamento è nello step "Dettagli", in quello partita nello step
        "Atletica". Vale {LOAD_RPE.leggera} se leggera, {LOAD_RPE.media} se media,
        {' '}{LOAD_RPE.intensa} se intensa. Non c'è nessuna scala da 1 a 10 da compilare: tre livelli
        bastano, e chiederne di più significherebbe smettere di registrare le sessioni dopo tre
        settimane. Dove il campo è vuoto si usa un valore di riferimento — {LOAD_RPE.media} per un
        allenamento, {MATCH_RPE} per una partita — e sotto le barre trovi <em>quanti</em> dei tuoi
        minuti recenti hanno uno sforzo davvero dichiarato: più è alta quella quota, più questi
        numeri sono un dato invece che una stima.
      </InfoItem>
      <InfoItem title="Tennis, corsa e palestra">
        Il carico è di <strong>tutto il corpo</strong>: una corsa o una palestra pesano sull'ACWR come
        una sessione di tennis, con la stessa formula durata × sforzo (l'intensità che segni nel
        wizard). Le barre sono impilate per dominio, e le ore in campo del resto della sezione
        restano solo di tennis. Corsa e palestra senza dati dell'orologio entrano con la durata
        stimata dalla scheda, e il numero sotto le barre dice quanta parte è dichiarata.
      </InfoItem>
      <InfoItem title="Carico settimanale">
        Una barra per ogni settimana del periodo. La linea orizzontale chiara è la tua media, e
        l'ultima barra è la settimana in corso — è più chiara perché non è ancora finita, e va letta
        come incompleta, non come un calo.
      </InfoItem>
      <InfoItem title="Rapporto acuto / cronico (ACWR)">
        Il carico degli ultimi 7 giorni diviso per la tua media settimanale delle ultime 4 settimane.
        Risponde a: «sto chiedendo al corpo molto più di quello a cui è abituato?». A 1,0 stai
        facendo esattamente quanto sei abituato; a 1,8 stai facendo quasi il doppio in una settimana
        sola. È l'indicatore che negli sport di squadra si usa per prevenire gli infortuni da
        sovraccarico, ed è calcolato <strong>sempre su oggi</strong>, non sul periodo scelto in cima
        alla pagina: serve a decidere cosa fare domani.
      </InfoItem>
      <InfoItem title="La fascia 0,8–1,3">
        È l'intervallo in cui il carico cresce abbastanza da produrre adattamento senza superare
        quello che il corpo regge. Sotto 0,8 stai scaricando (va benissimo, se è voluto: dopo un
        torneo o in un periodo di riposo). Sopra 1,3 sei in aumento rapido; sopra 1,5 è un picco
        vero, ed è la situazione in cui statisticamente ci si fa male. Non è un divieto: è un
        cartello.
      </InfoItem>
      <InfoItem title="Monotonia">
        Quanto è piatta la settimana: la media dei carichi giornalieri divisa per quanto variano tra
        loro (i giorni di riposo contano, e sono metà del dato). Un valore alto — da 2,0 in su —
        significa la stessa dose ogni giorno, senza giornate di scarico vere. Sotto trovi i sette
        carichi giornalieri da cui esce, così la forma della settimana si vede invece di doverla
        credere sulla parola.
      </InfoItem>
      <InfoItem title="Strain">
        Carico settimanale × monotonia: la misura combinata di quanto e quanto piatto. Tanto carico
        distribuito bene produce uno strain moderato; lo stesso carico spalmato uguale su sette
        giorni ne produce molto di più. Anche questo è in unità arbitrarie e si legge nel confronto.
      </InfoItem>
      <InfoItem>
        Tutto questo blocco descrive quello che hai <em>registrato</em>. Se non segni gli
        allenamenti il carico risulta più basso del reale, e l'ACWR con lui: non è un dispositivo
        medico, è uno specchio del tuo diario. E lo sforzo resta una <em>sensazione</em>: il
        training effect dell'orologio non viene usato qui di proposito, perché è compilato solo su
        alcune sessioni e il carico salterebbe a seconda di quanto sei stato diligente a
        trascriverlo, non di quanto hai faticato.
      </InfoItem>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────

function formatLoad(v) {
  if (v == null) return '—'
  return Math.round(v).toLocaleString('it-IT')
}

function monotonyLabel(m) {
  if (m == null) return 'nessun carico'
  if (m >= MONOTONY_HIGH) return 'piatta'
  if (m >= 1.5) return 'media'
  return 'variata'
}

function zoneIcon(id) {
  return { low: '💤', ok: '✅', high: '⚠️', spike: '🚨' }[id] || 'ℹ️'
}

function domainLoad(week, domainId) {
  return week.sessions
    .filter(s => (s.domain || 'tennis') === domainId)
    .reduce((sum, s) => sum + s.minutes * s.rpe, 0)
}

function weekLabel(time) {
  return new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
