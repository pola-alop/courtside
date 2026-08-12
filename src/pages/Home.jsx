import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthState } from '../hooks/useAuth'
import { useMatches } from '../hooks/useMatches'
import { useTrainings } from '../hooks/useTrainings'
import { useEquipment } from '../hooks/useEquipment'
import { useProfile } from '../hooks/useProfile'
import Onboarding from '../components/home/Onboarding'
import MatchRow from '../components/matches/MatchRow'
import TrainingRow from '../components/trainings/TrainingRow'
import { buildHome, ALERT_TONES, STRIP_DAYS, IDLE_BAD } from '../lib/home'
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
// L'alternativa — sollevare le modali in App.jsx — avrebbe richiesto uno stato
// globale che il progetto non ha e che nessun'altra parte dell'app chiede.

const ADD_MATCH_TO    = '/matches?add=match'
const ADD_TRAINING_TO = '/matches?add=training'

// Stessa grammatica della striscia di densità della Panoramica
// (`ActivityTimeline`): ambra = partita, teal = allenamento, gradiente =
// entrambi. Due strisce con due codici colore diversi nella stessa app
// costringerebbero a impararli tutti e due.
const COLOR_MATCH    = 'var(--color-amber)'
const COLOR_TRAINING = 'var(--color-teal-dark)'
const COLOR_EMPTY    = 'var(--color-surface-2)'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthState()
  const { matches,   loading: matchLoading } = useMatches()
  const { trainings, loading: trainLoading } = useTrainings()
  const { equipment, loading: equipLoading } = useEquipment()
  const { profile,   loading: profileLoading } = useProfile()

  const report = useMemo(
    () => buildHome({ matches, trainings, equipment }),
    [matches, trainings, equipment]
  )

  const firstName = (user?.displayName || '').trim().split(' ')[0] || null

  // Il profilo entra nel gate pur servendo al solo onboarding: è una lettura di
  // un documento, parte in parallelo alle altre tre, e senza di lei il primo
  // passo della checklist si spunterebbe da solo un istante dopo il montaggio.
  const loading = matchLoading || trainLoading || equipLoading || profileLoading

  if (loading) return <Spinner />

  if (matches.length === 0 && trainings.length === 0) {
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

  const { rhythm, idle, alerts, checks, last, strip, career } = report

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
            <MatchRow match={last.item} onClick={() => navigate(`/matches?match=${last.item.id}`)} />
          ) : (
            <TrainingRow training={last.item} onClick={() => navigate(`/matches?training=${last.item.id}`)} />
          )}
        </div>
      )}

      {/* ── Striscia di continuità ── */}
      <div className="px-6 pb-6">
        <SectionTitle>Continuità</SectionTitle>
        <div className="rounded-2xl p-4"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STRIP_DAYS}, 1fr)`, gap: 3 }}>
            {strip.map(d => (
              <div key={d.day}
                   title={`${cellTitle(d)}`}
                   style={{ aspectRatio: '1', borderRadius: 3, background: cellColor(d.match, d.training) }} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              {STRIP_DAYS} giorni fa
            </span>
            <span className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>
              Oggi
            </span>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--color-white)' }}>
            {streakText(rhythm.streakWeeks)}
          </p>
        </div>
      </div>

      {/* ── Carriera: i totali di sempre, una riga sola ── */}
      <div className="px-6 pb-32">
        <p className="text-[11px] text-center leading-relaxed"
           style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
          {careerText(career)}
        </p>
      </div>
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
function idleText(sinceLast) {
  if (sinceLast == null) return 'Nessuna sessione registrata.'
  if (sinceLast === 0) return 'Hai giocato oggi.'
  if (sinceLast === 1) return 'Hai giocato ieri.'
  if (sinceLast >= IDLE_BAD) return `Sei fermo da ${sinceLast} giorni.`
  return `${sinceLast} giorni dall'ultima sessione.`
}

function streakText(weeks) {
  if (!weeks) return 'Striscia interrotta: nessuna sessione nelle ultime due settimane.'
  if (weeks === 1) return '1 settimana di fila con almeno una sessione.'
  return `${weeks} settimane di fila con almeno una sessione.`
}

function careerText(c) {
  const parts = []
  if (c.matches)   parts.push(`${c.matches} ${c.matches === 1 ? 'partita' : 'partite'}`)
  if (c.trainings) parts.push(`${c.trainings} ${c.trainings === 1 ? 'allenamento' : 'allenamenti'}`)
  if (c.minutes)   parts.push(`${c.estimated ? '~' : ''}${Math.round(c.minutes / 60)} h in campo`)
  if (c.matches)   parts.push(`${c.wins}V · ${c.draws}P · ${c.losses}S`)
  return parts.join(' · ')
}

function cellColor(match, training) {
  if (match && training) return `linear-gradient(135deg, ${COLOR_MATCH} 50%, ${COLOR_TRAINING} 50%)`
  if (match)    return COLOR_MATCH
  if (training) return COLOR_TRAINING
  return COLOR_EMPTY
}

function cellTitle(d) {
  const label = new Date(d.day).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  const what = d.match && d.training ? 'partita e allenamento'
    : d.match ? 'partita'
    : d.training ? 'allenamento'
    : 'niente'
  return `${label} — ${what}`
}

function joinList(items) {
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}
