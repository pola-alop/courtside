import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthState } from '../hooks/useAuth'
import { useMatches } from '../hooks/useMatches'
import { useTrainings } from '../hooks/useTrainings'
import { useRuns } from '../hooks/useRuns'
import { useGymSessions } from '../hooks/useGymSessions'
import { useGymExercises } from '../hooks/useGymExercises'
import { useRunWorkouts } from '../hooks/useRunWorkouts'
import { useGymWorkouts } from '../hooks/useGymWorkouts'
import { useEquipment } from '../hooks/useEquipment'
import { useProfile } from '../hooks/useProfile'
import { useOpponents } from '../hooks/useOpponents'
import { usePlans } from '../hooks/usePlans'
import Onboarding from '../components/home/Onboarding'
import Calendar from '../components/home/Calendar'
import PlanModal from '../components/home/PlanModal'
import MatchRow from '../components/matches/MatchRow'
import TrainingRow from '../components/trainings/TrainingRow'
import { buildHome, ALERT_TONES, IDLE_BAD } from '../lib/home'
import { buildCalendar } from '../lib/calendar'
import { formatDaysAgo } from '../lib/technique'

// Home — "adesso".
//
// ── Il lavoro che fa questa pagina, e che non fa nessun'altra ──
// La Panoramica di Matches è già la sintesi di come sta andando su una finestra
// mobile di 30 giorni, e Stats possiede il tempo lungo: una terza dashboard
// sarebbe la stessa cosa detta un'altra volta. Quello che nessuna delle due può
// fare è (1) mettere in fila cose vere ADESSO che nascono in domini diversi —
// le corde stanno in Equipment, il carico in Stats/Attività, il colpo trascurato
// in Stats/Tecnica — e (2) far registrare una sessione al primo tap dopo
// l'apertura, che è l'unico momento in cui l'app viene davvero aperta.
//
// Da qui la regola: nessun selettore di periodo, nessun grafico, nessun numero
// che abbia bisogno di una finestra temporale per significare qualcosa. Se ce
// l'ha, è roba della Panoramica o di Stats.
//
// I link portano l'intenzione nell'URL (`/matches?add=match`,
// `/stats?tab=attivita&focus=carico`, `/equipment?item=<id>`): le pagine di
// destinazione la leggono e aprono da sole il wizard, il tab o la modale giusta.
// I dettagli delle sessioni si aprono con `from=home`, che li fa tornare qui
// alla chiusura invece di lasciare l'utente in Matches. Lo stesso vale per
// "Registra" (da un programma o da un giorno passato vuoto): il wizard si apre
// in Matches già precompilato (`&plan=<id>` o `&date=YYYY-MM-DD`) e salvando
// si torna qui, dove il programma risulta fatto da solo.
// L'unica modale di proprietà di questa pagina è quella dei programmi
// (`PlanModal`): i programmi esistono solo qui, quindi non c'è un'altra pagina
// a cui mandare l'intenzione.
// L'alternativa — sollevare le modali in App.jsx — avrebbe richiesto uno stato
// globale che il progetto non ha e che nessun'altra parte dell'app chiede.

const ADD_MATCH_TO    = '/matches?add=match'
const ADD_TRAINING_TO = '/matches?add=training'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthState()
  const { matches,   loading: matchLoading } = useMatches()
  const { trainings, loading: trainLoading } = useTrainings()
  const { equipment, loading: equipLoading } = useEquipment()
  const { profile,   loading: profileLoading } = useProfile()
  // Corse e palestre entrano nel carico (ACWR e avviso: l'avviso di Home e il
  // blocco di Stats › Attività devono dire la stessa cosa) e nel calendario.
  // Le schede servono alle righe del foglio di un giorno con più sessioni, che
  // sono le stesse delle liste di Matches.
  const { runs, loading: runLoading } = useRuns()
  const { sessions: gymSessions, loading: gymLoading } = useGymSessions()
  const { index: exerciseIndex, loading: exerciseLoading } = useGymExercises()
  const { workouts: runWorkouts, loading: runWorkoutLoading } = useRunWorkouts()
  const { workouts: gymWorkouts, loading: gymWorkoutLoading } = useGymWorkouts()
  // I programmi del calendario, e l'anagrafica per i nomi degli avversari che
  // mostrano (derivati, non copiati) e per sceglierli nella modale.
  const { plans, loading: planLoading, add: addPlan, update: updatePlan, remove: removePlan } = usePlans()
  const { opponents, loading: opponentLoading } = useOpponents()
  // { date: 'YYYY-MM-DD', plan?: programma da vedere/modificare } o null.
  const [planTarget, setPlanTarget] = useState(null)

  const report = useMemo(
    () => buildHome({
      matches, trainings, equipment, runs, gymSessions,
      index: exerciseIndex, running: profile?.running || null,
    }),
    [matches, trainings, equipment, runs, gymSessions, exerciseIndex, profile]
  )

  const calendar = useMemo(
    () => buildCalendar({ matches, trainings, runs, gymSessions, plans }),
    [matches, trainings, runs, gymSessions, plans]
  )

  // `kind` è già il nome del parametro del deep link (match|training|run|gym).
  const openSession = (s) => navigate(`/matches?${s.kind}=${s.id}&from=home`)

  // "Registra": da un programma (`PlanModal`) il wizard parte da ciò che il
  // programma sapeva, da un giorno passato vuoto (foglio del giorno) dalla
  // sola data. `kind` è anche qui il valore di `add`.
  const registerPlan = (plan) => navigate(`/matches?add=${plan.kind}&plan=${plan.id}&from=home`)
  const registerDay = ({ kind, date }) => navigate(`/matches?add=${kind}&date=${date}&from=home`)

  const savePlan = async (data, id) => {
    if (id) await updatePlan(id, data)
    else await addPlan(data)
  }

  const rawFirstName = (user?.displayName || '').trim().split(' ')[0] || null
  const firstName = rawFirstName
    ? rawFirstName[0].toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : null

  // Il profilo entra nel gate pur servendo al solo onboarding: è una lettura di
  // un documento, parte in parallelo alle altre tre, e senza di lei il primo
  // passo della checklist si spunterebbe da solo un istante dopo il montaggio.
  const loading = matchLoading || trainLoading || equipLoading || profileLoading
    || runLoading || gymLoading || exerciseLoading || runWorkoutLoading || gymWorkoutLoading
    || planLoading || opponentLoading

  // Lo spinner vale solo per il PRIMO caricamento. La Home ora scrive (i
  // programmi), e ogni mutazione ricarica con `loading` di nuovo a true: senza
  // questo, salvare un programma farebbe sparire la pagina per un istante e
  // chiuderebbe il foglio del giorno da cui era partito. Stato aggiustato
  // durante il render, non in un effect (vedi "selected item derivato").
  const [ready, setReady] = useState(false)
  if (!loading && !ready) setReady(true)

  if (!ready) return <Spinner />

  // Una sessione di qualsiasi dominio basta: chi ha solo corse o palestra deve
  // vedere il calendario. I programmi no — l'onboarding chiede di registrare.
  if (matches.length + trainings.length + runs.length + gymSessions.length === 0) {
    return (
      <Onboarding
        name={firstName}
        profileDone={Boolean(profile?.dominantHand || profile?.level || profile?.birthYear)}
        equipmentDone={equipment.length > 0}
        addMatchTo={ADD_MATCH_TO}
        addTrainingTo={ADD_TRAINING_TO}
      />
    )
  }

  const { rhythm, idle, alerts, checks, last, career } = report

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header: chi sei e da quanto non giochi ── */}
      <div className="px-6 pt-12 pb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1"
           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
          {todayLabel()}
        </p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        {/* Il ritmo è qui e NON tra gli avvisi: metterlo in entrambi i posti
            sarebbe la stessa frase due volte a 200px di distanza. */}
        <p className="text-sm mt-1.5" style={{ color: idle.color }}>
          {idleText(rhythm.sinceLast)}
        </p>
      </div>

      {/* ── Le due azioni: il vero motivo per cui si apre l'app ── */}
      <div className="px-6 pb-6">
        <div className="flex gap-2">
          <Link to={ADD_MATCH_TO}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-center transition-all active:scale-95"
            style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
            + Partita
          </Link>
          <Link to={ADD_TRAINING_TO}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-center transition-all active:scale-95"
            style={{ background: 'var(--color-surface)', color: 'var(--color-teal)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
            + Allenamento
          </Link>
        </div>
      </div>

      {/* ── Calendario: il mese corrente, il fatto e la serie di settimane ──
          Ha preso il posto della striscia di continuità: dice la stessa cosa
          meglio, e la serie conta tutti i domini, non solo il tennis. */}
      <div className="px-6 pb-6">
        <SectionTitle>Calendario</SectionTitle>
        <Calendar
          calendar={calendar}
          runWorkouts={runWorkouts}
          gymWorkouts={gymWorkouts}
          opponents={opponents}
          index={exerciseIndex}
          running={profile?.running || null}
          onOpen={openSession}
          onPlan={setPlanTarget}
          onRegister={registerDay}
        />
      </div>

      {/* ── Da sistemare ── */}
      <div className="px-6 pb-6">
        <SectionTitle>Da sistemare</SectionTitle>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map(a => <AlertRow key={a.id} alert={a} />)}
          </div>
        ) : (
          <AllClear checks={checks} />
        )}
      </div>

      {/* ── Ultima sessione ──
          Le righe sono le stesse delle liste di Matches: stesso oggetto, stessa
          forma, e il tap porta al suo dettaglio come là. */}
      {last && (
        <div className="px-6 pb-6">
          <div className="flex items-baseline justify-between mb-2">
            <SectionTitle noMargin>Ultima sessione</SectionTitle>
            <span className="text-[11px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
              {formatDaysAgo(last.days)}
            </span>
          </div>
          {last.kind === 'match' ? (
            <MatchRow match={last.item} onClick={() => navigate(`/matches?match=${last.item.id}&from=home`)} />
          ) : (
            <TrainingRow training={last.item} onClick={() => navigate(`/matches?training=${last.item.id}&from=home`)} />
          )}
        </div>
      )}

      {/* ── Carriera: i totali di sempre, una riga sola ──
          Sono di tennis: con sole corse o palestra la riga è vuota e non c'è.
          Il padding in fondo resta, perché è lo spazio della bottom nav. */}
      <div className="px-6 pb-32">
        {careerText(career) && (
          <p className="text-[11px] text-center leading-relaxed"
             style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
            {careerText(career)}
          </p>
        )}
      </div>

      {/* Dopo il calendario nel DOM: aperta dal foglio di un giorno, ci sta
          sopra, e chiudendola si torna al foglio aggiornato. */}
      {planTarget && (
        <PlanModal
          key={planTarget.plan?.id || planTarget.date}
          date={planTarget.date}
          plan={planTarget.plan || null}
          plans={plans}
          opponents={opponents}
          runWorkouts={runWorkouts}
          gymWorkouts={gymWorkouts}
          trainings={trainings}
          runs={runs}
          gymSessions={gymSessions}
          onSave={savePlan}
          onDelete={removePlan}
          onRegister={registerPlan}
          onClose={() => setPlanTarget(null)}
        />
      )}
    </div>
  )
}

// ── Componenti interni ─────────────────────────────────────

function SectionTitle({ children, noMargin }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wider ${noMargin ? '' : 'mb-2'}`}
       style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  )
}

// L'avviso non spiega il problema: porta dove il problema si guarda per intero.
function AlertRow({ alert }) {
  const tone = ALERT_TONES[alert.tone] || ALERT_TONES.warn
  return (
    <Link to={alert.to}
      className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-[0.99]"
      style={{ background: tone.bg, border: '1px solid var(--color-surface-2)' }}>
      <span className="text-sm shrink-0">{alert.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="text-xs block truncate"
              style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          {alert.title}
        </span>
        <span className="text-[10px] block truncate" style={{ color: tone.color }}>{alert.sub}</span>
      </span>
      <span className="text-sm shrink-0" style={{ color: 'var(--color-slate)' }}>›</span>
    </Link>
  )
}

// Il silenzio è il risultato buono, ma va dichiarato: "tutto a posto" senza dire
// cosa è stato guardato non è rassicurante, è vago. E se non c'erano dati per
// nessuno dei tre controlli non compare nulla — dire che va tutto bene senza
// aver potuto verificare niente è il modo più veloce di rendersi inaffidabili.
function AllClear({ checks }) {
  const done = [
    checks.wear      && 'materiale',
    checks.load      && 'carico',
    checks.technique && 'rotazione dei colpi',
  ].filter(Boolean)

  if (done.length === 0) return null

  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
         style={{ background: 'var(--color-win-bg)', border: '1px solid var(--color-surface-2)' }}>
      <span className="text-sm shrink-0">✅</span>
      <span className="flex-1 min-w-0">
        <span className="text-xs block" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
          Tutto a posto.
        </span>
        <span className="text-[10px] block" style={{ color: 'var(--color-win)' }}>
          Nessun avviso su {joinList(done)}.
        </span>
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center pt-32">
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
           style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function todayLabel() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Sotto la settimana è una constatazione, sopra è un fatto da guardare in
// faccia: cambia la frase, non solo il colore.
// Il ritmo è di tennis, e la Home si apre anche con sole corse o palestra
// (gate dell'onboarding): senza tennis va detto quale sessione manca.
function idleText(sinceLast) {
  if (sinceLast == null) return 'Nessuna sessione di tennis registrata.'
  if (sinceLast === 0) return 'Hai giocato oggi.'
  if (sinceLast === 1) return 'Hai giocato ieri.'
  if (sinceLast >= IDLE_BAD) return `Sei fermo da ${sinceLast} giorni.`
  return `${sinceLast} giorni dall'ultima sessione.`
}

function careerText(c) {
  const parts = []
  if (c.matches)   parts.push(`${c.matches} ${c.matches === 1 ? 'partita' : 'partite'}`)
  if (c.trainings) parts.push(`${c.trainings} ${c.trainings === 1 ? 'allenamento' : 'allenamenti'}`)
  if (c.minutes)   parts.push(`${c.estimated ? '~' : ''}${Math.round(c.minutes / 60)} h in campo`)
  if (c.matches)   parts.push(`${c.wins}V · ${c.draws}P · ${c.losses}S`)
  return parts.join(' · ')
}

function joinList(items) {
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}
