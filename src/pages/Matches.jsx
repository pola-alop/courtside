import { useState, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useOpponents } from '../hooks/useOpponents'
import { useMatches } from '../hooks/useMatches'
import { useTrainings } from '../hooks/useTrainings'
import { useEquipment } from '../hooks/useEquipment'
import { useRuns } from '../hooks/useRuns'
import { useRunWorkouts } from '../hooks/useRunWorkouts'
import { useGymSessions } from '../hooks/useGymSessions'
import { useGymWorkouts } from '../hooks/useGymWorkouts'
import { useGymExercises } from '../hooks/useGymExercises'
import { useProfile } from '../hooks/useProfile'
import { useFitDetails } from '../hooks/useFitDetails'
import { usePlans } from '../hooks/usePlans'
import OpponentCard from '../components/matches/OpponentCard'
import AddOpponentModal from '../components/matches/AddOpponentModal'
import OpponentDetailModal from '../components/matches/OpponentDetailModal'
import MatchRow from '../components/matches/MatchRow'
import AddMatchModal from '../components/matches/AddMatchModal'
import MatchDetailModal from '../components/matches/MatchDetailModal'
import Overview from '../components/matches/Overview'
import Tournaments from '../components/matches/Tournaments'
import TournamentDetailModal from '../components/matches/TournamentDetailModal'
import TrainingRow from '../components/trainings/TrainingRow'
import AddTrainingModal from '../components/trainings/AddTrainingModal'
import TrainingDetailModal from '../components/trainings/TrainingDetailModal'
import FocusProgress from '../components/trainings/FocusProgress'
import SessionTypePicker from '../components/trainings/SessionTypePicker'
import RunRow from '../components/runs/RunRow'
import AddRunModal from '../components/runs/AddRunModal'
import RunDetailModal from '../components/runs/RunDetailModal'
import WorkoutLibrary from '../components/runs/WorkoutLibrary'
import WorkoutEditModal from '../components/runs/WorkoutEditModal'
import GymRow from '../components/gym/GymRow'
import AddGymModal from '../components/gym/AddGymModal'
import GymDetailModal from '../components/gym/GymDetailModal'
import GymWorkoutLibrary from '../components/gym/GymWorkoutLibrary'
import GymWorkoutEditModal from '../components/gym/GymWorkoutEditModal'
import { MATCH_TYPES, SURFACES, RESULT_META, surfaceIcon } from '../lib/tennis'
import { buildTournaments } from '../lib/tournaments'
import { calibrateIntensity } from '../lib/fit'
import {
  TRAINING_KINDS, INTENSITIES, FOCUS_CATEGORIES, FOCUS_BY_ID,
  totalMinutes, formatHours,
} from '../lib/training'
import { isRunningReady, runMinutes, workoutUsage, sortWorkoutsByUse } from '../lib/running'
import { gymMinutes, workoutUsage as gymWorkoutUsage, sortWorkoutsByUse as sortGymWorkoutsByUse } from '../lib/gym'
import { planPrefill, keyToDay } from '../lib/calendar'

const TABS = [
  { id: 'panoramica',  label: 'Panoramica',  icon: '🗂' },
  { id: 'partite',     label: 'Partite',     icon: '🎾' },
  { id: 'tornei',      label: 'Tornei',      icon: '🏆' },
  { id: 'avversari',   label: 'Avversari',   icon: '👥' },
  { id: 'allenamenti', label: 'Allenamenti', icon: '🎯' },
]

// Tipo di allenamento nella lista unificata del tab Allenamenti.
const SPORT_FILTERS = [
  { id: 'all',    label: 'Tutti' },
  { id: 'tennis', label: 'Tennis', icon: '🎾' },
  { id: 'corsa',  label: 'Corsa',  icon: '🏃' },
  { id: 'palestra', label: 'Palestra', icon: '🏋️' },
]

const RESULT_FILTERS = [
  { id: 'all',  label: 'Tutte' },
  { id: 'win',  label: 'Vinte' },
  { id: 'loss', label: 'Perse' },
  { id: 'draw', label: 'Pari'  },
]

export default function Matches() {
  const { opponents, loading: oppLoading, add: addOpponent, update: updateOpponent, remove: removeOpponent } = useOpponents()
  const { matches,   loading: matchLoading, add: addMatch, update: updateMatch, remove: removeMatch, reload: reloadMatches } = useMatches()
  const { trainings, loading: trainLoading, add: addTraining, update: updateTraining, remove: removeTraining } = useTrainings()
  const { equipment } = useEquipment()
  const { runs, loading: runLoading, add: addRun, update: updateRun, remove: removeRun } = useRuns()
  const { workouts, loading: workoutLoading, add: addWorkout, update: updateWorkout, remove: removeWorkout } = useRunWorkouts()
  const { sessions: gymSessions, loading: gymLoading, add: addGymSession, update: updateGymSession, remove: removeGymSession } = useGymSessions()
  const { workouts: gymWorkouts, loading: gymWorkoutLoading, add: addGymWorkout, update: updateGymWorkout, remove: removeGymWorkout } = useGymWorkouts()
  const exerciseApi = useGymExercises()
  const { profile, loading: profileLoading } = useProfile()

  // Soglie del suggerimento «quanto è stata dura», imparate dalle partite con
  // un'intensità scelta dall'utente. Si ricalcolano a ogni cambio delle partite:
  // niente è salvato, quindi non può invecchiare.
  const intensityCalibration = useMemo(() => calibrateIntensity(matches), [matches])
  const running = profile?.running || null
  const runningReady = isRunningReady(running)

  // ── File .FIT importati ──
  // Il riassunto sta in `athletics` della sessione; i dettagli pesanti (serie,
  // lap, traccia) in users/{uid}/fitDetails/{fitId}. Si scrivono INSIEME alla
  // sessione, mai prima: un import annullato non deve lasciare documenti
  // orfani. Cancellare la sessione cancella anche i suoi dettagli.
  const { save: saveFitDetails, remove: removeFitDetails } = useFitDetails()

  // `fit` = { details, prevFitId }: i dettagli nuovi (se il file è stato
  // appena importato) e il file che la sessione aveva prima (da togliere se è
  // stato sostituito o svuotato).
  const commitFit = async (fit, athletics) => {
    if (!fit) return
    const next = athletics?.fitId || null
    if (fit.details && fit.details.fitId === next) await saveFitDetails(fit.details)
    if (fit.prevFitId && fit.prevFitId !== next) await removeFitDetails(fit.prevFitId)
  }
  const dropFit = async (athletics) => {
    if (athletics?.fitId) await removeFitDetails(athletics.fitId)
  }

  // Un file .FIT appartiene a UNA sessione. `fitUseFor(selfId)` ritorna la
  // funzione che dice, dato un fitId, quale altra sessione lo ha già (o null).
  const fitOwners = {}
  const dayLabel = d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  matches.forEach(m => { if (m.athletics?.fitId) fitOwners[m.athletics.fitId] = { id: m.id, text: `partita del ${dayLabel(m.date)}` } })
  trainings.forEach(t => { if (t.athletics?.fitId) fitOwners[t.athletics.fitId] = { id: t.id, text: `allenamento di tennis del ${dayLabel(t.date)}` } })
  runs.forEach(r => { if (r.athletics?.fitId) fitOwners[r.athletics.fitId] = { id: r.id, text: `corsa del ${dayLabel(r.date)}` } })
  gymSessions.forEach(g => { if (g.athletics?.fitId) fitOwners[g.athletics.fitId] = { id: g.id, text: `sessione di palestra del ${dayLabel(g.date)}` } })
  const fitUseFor = (selfId) => (fitId) => {
    const o = fitOwners[fitId]
    return o && o.id !== selfId ? o.text : null
  }

  // ── Intenzioni che arrivano dalla Home ──
  // La Home non tiene i wizard né i detail modal: sono di questa pagina, e
  // duplicarli là avrebbe voluto dire duplicare anche il loro cablaggio
  // (avversari, attrezzatura, catena "aggiungi avversario" dentro il wizard).
  // Arriva invece l'intenzione nell'URL — `?add=match`, `?match=<id>` — e la
  // pagina ci apre sopra lo stato iniziale.
  //
  // Sono initializer di `useState`, non un effect che sincronizza: il parametro
  // è già lo stato di partenza, e la rotta rimonta la pagina a ogni ingresso,
  // quindi non c'è niente da tenere in sincrono dopo il primo render.
  //
  // Degli id si tiene l'id e non l'oggetto (come per ogni selezione qui): se i
  // dati non sono ancora arrivati, la modale si apre da sola appena la `find`
  // derivata trova la sessione.
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('add')

  // ── "Registra" dal calendario della Home ──
  // `&plan=<id>` apre il wizard di `add` precompilato con ciò che il programma
  // sapeva (`planPrefill`); `&date=YYYY-MM-DD` (un giorno passato vuoto) solo
  // con la data. È una prop distinta da `initial`, che vuol dire modifica.
  // Il wizard legge il suo stato una volta sola, al montaggio: con un
  // programma deve quindi aspettare il programma stesso, l'anagrafica e le
  // schede, altrimenti partirebbe vuoto. I programmi si leggono sempre (sono
  // pochi), come fa la Home.
  // La precompilazione vale per il PRIMO wizard di quel tipo: chiuso quello,
  // un "+" qualsiasi riparte da zero (`prefillFor` torna null).
  const { plans, loading: planLoading } = usePlans()
  const planId = searchParams.get('plan')
  const dateParam = keyToDay(searchParams.get('date')) != null ? searchParams.get('date') : null
  const [prefillFor, setPrefillFor] = useState(() => (
    (planId || dateParam) && ['match', 'training', 'run', 'gym'].includes(intent) ? intent : null
  ))
  const prefillPlan = planId ? plans.find(p => p.id === planId && p.kind === intent) || null : null
  const prefill = prefillFor == null ? null
    : planId ? planPrefill(prefillPlan, { opponents, runWorkouts: workouts, gymWorkouts })
    : { date: dateParam }
  const waitPrefill = prefillFor != null && Boolean(planId)
    && (planLoading || oppLoading || workoutLoading || gymWorkoutLoading)
  const prefillOf = (kind) => (prefillFor === kind ? prefill : null)

  const [activeTab, setActiveTab] = useState(() => initialTab(searchParams))

  // Avversari
  const [showAddOpponent, setShowAddOpponent] = useState(intent === 'opponent')
  const [selectedOpponentId, setSelectedOpponentId] = useState(null)
  const [oppSearch, setOppSearch] = useState('')
  const [oppDeleteToast, setOppDeleteToast] = useState(false)

  // Partite
  const [showAddMatch, setShowAddMatch] = useState(intent === 'match')
  const [editingMatch, setEditingMatch] = useState(null)
  const [selectedMatchId, setSelectedMatchId] = useState(() => searchParams.get('match'))
  const [matchDeleteToast, setMatchDeleteToast] = useState(false)
  const [fType, setFType]         = useState('all')
  const [fEvent, setFEvent]       = useState('')
  const [fOpponent, setFOpponent] = useState('all')
  const [fSurface, setFSurface]   = useState('all')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo]     = useState('')
  const [fResult, setFResult]     = useState('all')

  // Tornei
  const [selectedTournamentId, setSelectedTournamentId] = useState(null)

  // Allenamenti — "+ Allenamento" apre prima la scelta del tipo (tennis/corsa)
  // Con una precompilazione il tipo è già deciso (tennis): niente scelta.
  const [showTypePicker, setShowTypePicker] = useState(intent === 'training' && prefillFor == null)
  const [showAddTraining, setShowAddTraining] = useState(intent === 'training' && prefillFor != null)
  const [editingTraining, setEditingTraining] = useState(null)
  const [selectedTrainingId, setSelectedTrainingId] = useState(() => searchParams.get('training'))
  const [trainingDeleteToast, setTrainingDeleteToast] = useState(false)
  const [fKind, setFKind]           = useState('all')
  const [fFocus, setFFocus]         = useState('all')
  const [fIntensity, setFIntensity] = useState('all')
  const [fTrDateFrom, setFTrDateFrom] = useState('')
  const [fTrDateTo, setFTrDateTo]     = useState('')
  const [fSport, setFSport]           = useState(() => (
    intent === 'run' || searchParams.get('run') ? 'corsa'
      : intent === 'gym' || searchParams.get('gym') ? 'palestra' : 'all'
  ))
  const [fWorkout, setFWorkout]       = useState('all')
  const [fGymWorkout, setFGymWorkout] = useState('all')

  // Corsa
  const [showAddRun, setShowAddRun] = useState(intent === 'run')
  const [editingRun, setEditingRun] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(() => searchParams.get('run'))
  const [runDeleteToast, setRunDeleteToast] = useState(false)
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [creatingWorkout, setCreatingWorkout] = useState(false)

  // Palestra
  const [showAddGym, setShowAddGym] = useState(intent === 'gym')
  const [editingGym, setEditingGym] = useState(null)
  const [selectedGymId, setSelectedGymId] = useState(() => searchParams.get('gym'))
  const [gymDeleteToast, setGymDeleteToast] = useState(false)
  const [editingGymWorkoutId, setEditingGymWorkoutId] = useState(null)
  const [creatingGymWorkout, setCreatingGymWorkout] = useState(false)

  // ── Ritorno in Home (`from=home`) ──
  // Il calendario della Home apre i dettagli qui, ma l'utente stava guardando
  // la Home: chiudere il dettaglio, o il wizard di modifica aperto da lì, lo
  // riporta indietro invece di lasciarlo in Matches. `navigate(-1)` quando c'è
  // una pagina precedente dell'app, così Indietro non trova la Home due volte;
  // altrimenti (link aperto a freddo) si sostituisce la voce con la Home.
  //
  // L'eliminazione è il caso delicato: i dettagli chiamano `onDelete(id)` e
  // subito `onClose()` senza aspettare. Tornare in Home dal `onClose` vorrebbe
  // dire ricaricare i dati mentre la sessione esiste ancora, e il giorno del
  // calendario resterebbe pieno. Per questo durante un'eliminazione la chiusura
  // non naviga, e si torna in Home solo a cancellazione finita (senza toast:
  // il giorno che si svuota è già la conferma).
  const navigate = useNavigate()
  const fromHome = searchParams.get('from') === 'home'
  const deletingRef = useRef(false)
  const backHome = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
  const closing = (clear) => () => {
    clear()
    if (fromHome && !deletingRef.current) backHome()
  }
  const deleting = (remove) => async (id) => {
    if (fromHome) deletingRef.current = true
    try {
      await remove(id)
    } finally {
      if (fromHome) backHome()
    }
  }

  // I tornei non sono documenti: sono la lettura delle partite di tipo torneo
  // raggruppate per evento ed edizione. Si ricostruiscono qui, una volta sola,
  // perché la stessa lista serve alla sezione e alla derivazione del torneo
  // selezionato — costruirla anche dentro `Tournaments` significherebbe due
  // sorgenti della stessa verità.
  const tournaments = buildTournaments(matches)

  // Item selezionati derivati (pattern "selected item derivato")
  const selectedOpponent = selectedOpponentId ? opponents.find(o => o.id === selectedOpponentId) || null : null
  const selectedMatch    = selectedMatchId ? matches.find(m => m.id === selectedMatchId) || null : null
  const selectedTraining = selectedTrainingId ? trainings.find(t => t.id === selectedTrainingId) || null : null
  const selectedTournament = selectedTournamentId ? tournaments.find(t => t.id === selectedTournamentId) || null : null
  const selectedRun      = selectedRunId ? runs.find(r => r.id === selectedRunId) || null : null
  const editingWorkout   = editingWorkoutId ? workouts.find(w => w.id === editingWorkoutId) || null : null
  const selectedGym          = selectedGymId ? gymSessions.find(g => g.id === selectedGymId) || null : null
  const editingGymWorkout   = editingGymWorkoutId ? gymWorkouts.find(w => w.id === editingGymWorkoutId) || null : null

  // Record H2H reale (chiusura del cerchio con la sezione Partite)
  const recordFor = (opponentId) => {
    const played = matches.filter(m => m.opponentId === opponentId)
    return {
      wins:   played.filter(m => m.result === 'win').length,
      losses: played.filter(m => m.result === 'loss').length,
      draws:  played.filter(m => m.result === 'draw').length,
    }
  }
  const matchesVs = (opponentId) => matches.filter(m => m.opponentId === opponentId)

  // ── Filtri partite ──
  const eventOptions = (fType === 'campionato' || fType === 'torneo')
    ? [...new Set(matches.filter(m => m.type === fType && m.eventName).map(m => m.eventName))]
    : []
  const opponentOptions = [...new Map(matches.map(m => [m.opponentId, m.opponentName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filteredMatches = matches.filter(m => {
    if (fType !== 'all' && m.type !== fType) return false
    if (fEvent && m.eventName !== fEvent) return false
    if (fOpponent !== 'all' && m.opponentId !== fOpponent) return false
    if (fSurface !== 'all' && m.surface !== fSurface) return false
    if (fDateFrom && m.date.slice(0, 10) < fDateFrom) return false
    if (fDateTo && m.date.slice(0, 10) > fDateTo) return false
    if (fResult !== 'all' && m.result !== fResult) return false
    return true
  })
  const monthGroups = groupByMonth(filteredMatches)

  const hasActiveFilters = fType !== 'all' || fEvent !== '' || fOpponent !== 'all'
    || fSurface !== 'all' || fDateFrom !== '' || fDateTo !== '' || fResult !== 'all'
  const resetFilters = () => {
    setFType('all')
    setFEvent('')
    setFOpponent('all')
    setFSurface('all')
    setFDateFrom('')
    setFDateTo('')
    setFResult('all')
  }

  // ── Filtri allenamenti ──
  // Il filtro per colpo elenca solo i focus davvero usati: la tassonomia
  // completa (~45 voci) in una select sarebbe illeggibile.
  const usedFocusIds = [...new Set(trainings.flatMap(t => t.focus || []))].filter(id => FOCUS_BY_ID[id])

  // Lista UNIFICATA tennis + corsa. Il range di date vale per entrambi; i
  // filtri di tennis (blocco, colpo, intensità) valgono solo con il chip
  // "Tennis" attivo e quello per scheda solo con "Corsa" — sono le uniche
  // viste in cui si vedono, e un filtro nascosto che taglia la lista
  // sembrerebbe un bug.
  const inDateRange = (date) => !(fTrDateFrom && date.slice(0, 10) < fTrDateFrom) && !(fTrDateTo && date.slice(0, 10) > fTrDateTo)

  const filteredTrainings = (fSport === 'corsa' || fSport === 'palestra') ? [] : trainings.filter(t => {
    if (fSport === 'tennis') {
      if (fKind !== 'all' && !(t.blocks || []).some(b => b.kind === fKind)) return false
      if (fFocus !== 'all' && !(t.focus || []).includes(fFocus)) return false
      if (fIntensity !== 'all' && t.intensity !== fIntensity) return false
    }
    return inDateRange(t.date)
  })
  const filteredRuns = (fSport === 'tennis' || fSport === 'palestra') ? [] : runs.filter(r => {
    if (fSport === 'corsa' && fWorkout !== 'all' && r.workoutId !== fWorkout) return false
    return inDateRange(r.date)
  })
  const filteredGym = (fSport === 'tennis' || fSport === 'corsa') ? [] : gymSessions.filter(g => {
    if (fSport === 'palestra' && fGymWorkout !== 'all' && g.workoutId !== fGymWorkout) return false
    return inDateRange(g.date)
  })
  const sessionEntries = [
    ...filteredTrainings.map(t => ({ sport: 'tennis', id: t.id, date: t.date, item: t })),
    ...filteredRuns.map(r => ({ sport: 'corsa', id: r.id, date: r.date, item: r })),
    ...filteredGym.map(g => ({ sport: 'palestra', id: g.id, date: g.date, item: g })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const trainingMonthGroups = groupByMonth(sessionEntries)

  // Solo le schede davvero corse compaiono nel filtro per scheda.
  const usage = workoutUsage(runs)
  const usedWorkouts = sortWorkoutsByUse(workouts.filter(w => usage[w.id]), runs)
  const gymUsage = gymWorkoutUsage(gymSessions)
  const usedGymWorkouts = sortGymWorkoutsByUse(gymWorkouts.filter(w => gymUsage[w.id]), gymSessions)

  const hasActiveTrainingFilters = fTrDateFrom !== '' || fTrDateTo !== ''
    || (fSport === 'tennis' && (fKind !== 'all' || fFocus !== 'all' || fIntensity !== 'all'))
    || (fSport === 'corsa' && fWorkout !== 'all')
    || (fSport === 'palestra' && fGymWorkout !== 'all')
  const resetTrainingFilters = () => {
    setFKind('all')
    setFFocus('all')
    setFIntensity('all')
    setFTrDateFrom('')
    setFTrDateTo('')
    setFWorkout('all')
    setFGymWorkout('all')
  }

  // Scelta del tipo di allenamento → wizard corrispondente.
  const pickSessionType = (type) => {
    setShowTypePicker(false)
    setShowAddTraining(type === 'tennis')
    setShowAddRun(type === 'corsa')
    setShowAddGym(type === 'palestra')
  }

  // Salvataggio di una corsa: il wizard consegna la sessione e la scheda, qui
  // si decide se la scheda va creata (nuova), aggiornata (modificata e con la
  // spunta "aggiorna anche la scheda") o lasciata com'è. La sessione porta
  // sempre la propria copia della struttura.
  const saveRun = async ({ run, workout, fitDetails }) => {
    await commitFit({ details: fitDetails, prevFitId: editingRun?.athletics?.fitId }, run.athletics)
    let workoutId = workout.id
    if (!workoutId) workoutId = await addWorkout({ name: workout.name, items: run.items })
    else if (workout.updateLibrary) await updateWorkout(workoutId, { items: run.items })
    const data = { ...run, workoutId }
    if (editingRun) await updateRun(editingRun.id, data)
    else await addRun(data)
  }

  // Salvataggio di una sessione di palestra: stessa orchestrazione della corsa.
  const saveGym = async ({ session, workout, fitDetails }) => {
    await commitFit({ details: fitDetails, prevFitId: editingGym?.athletics?.fitId }, session.athletics)
    let workoutId = workout.id
    if (!workoutId) workoutId = await addGymWorkout({ name: workout.name, items: session.items })
    else if (workout.updateLibrary) await updateGymWorkout(workoutId, { items: session.items })
    const data = { ...session, workoutId }
    if (editingGym) await updateGymSession(editingGym.id, data)
    else await addGymSession(data)
  }

  const oppQuery = oppSearch.trim().toLowerCase()
  const visibleOpponents = oppQuery ? opponents.filter(o => o.name.toLowerCase().includes(oppQuery)) : opponents

  // Nel tab Tornei il `+` apre comunque il wizard partita: un torneo non si
  // crea, nasce dalla prima partita che gli si attribuisce.
  const showAddButton = activeTab === 'avversari' || activeTab === 'partite'
    || activeTab === 'allenamenti' || activeTab === 'tornei'
  const onAdd = () => {
    if (activeTab === 'avversari') setShowAddOpponent(true)
    else if (activeTab === 'allenamenti') setShowTypePicker(true)
    else setShowAddMatch(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
            Il tuo tennis
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>
            Matches
          </h1>
        </div>
        {showAddButton && (
          <button onClick={onAdd}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-bold transition-all active:scale-95"
            style={{ background: 'var(--color-amber)', color: 'var(--color-bg)' }}>
            +
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-6 pb-4 overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                color: activeTab === tab.id ? 'var(--color-white)' : 'var(--color-slate)',
                fontFamily: 'var(--font-display)',
                border: activeTab === tab.id ? 'none' : '1px solid var(--color-surface-2)'
              }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenuto */}
      <div className="px-6 pb-32">

        {/* ── PARTITE ── */}
        {activeTab === 'partite' && (
          matchLoading ? (
            <Spinner />
          ) : matches.length === 0 ? (
            <EmptyState icon="🎾" title="Nessuna partita." sub="Registra il tuo primo match per iniziare lo storico." onAdd={() => setShowAddMatch(true)} />
          ) : (
            <div className="space-y-4">
              <MatchFilters
                type={fType} setType={t => { setFType(t); setFEvent('') }}
                event={fEvent} setEvent={setFEvent} eventOptions={eventOptions}
                opponent={fOpponent} setOpponent={setFOpponent} opponentOptions={opponentOptions}
                surface={fSurface} setSurface={setFSurface}
                dateFrom={fDateFrom} setDateFrom={setFDateFrom}
                dateTo={fDateTo} setDateTo={setFDateTo}
                result={fResult} setResult={setFResult}
                hasActiveFilters={hasActiveFilters}
                onReset={resetFilters}
              />

              {filteredMatches.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>
                  Nessuna partita con questi filtri.
                </p>
              ) : (
                <div className="space-y-6">
                  {monthGroups.map(group => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-wider"
                           style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                          {group.label}
                        </p>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-slate)' }}>{group.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map(m => (
                          <MatchRow key={m.id} match={m} onClick={() => setSelectedMatchId(m.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── TORNEI ── */}
        {activeTab === 'tornei' && (
          matchLoading ? (
            <Spinner />
          ) : tournaments.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="Nessun torneo."
              sub="Registra una partita di tipo Torneo indicando il turno: il tabellone si costruisce da solo."
              onAdd={() => setShowAddMatch(true)}
            />
          ) : (
            <Tournaments runs={tournaments} onSelectTournament={setSelectedTournamentId} />
          )
        )}

        {/* ── AVVERSARI ── */}
        {activeTab === 'avversari' && (
          oppLoading ? (
            <Spinner />
          ) : opponents.length === 0 ? (
            <EmptyState icon="👥" title="Nessun avversario." sub="Aggiungi chi affronti in campo per tenere traccia dei testa-a-testa." onAdd={() => setShowAddOpponent(true)} />
          ) : (
            <div className="space-y-3">
              <input
                value={oppSearch}
                onChange={e => setOppSearch(e.target.value)}
                placeholder="Cerca avversario..."
                className="w-full p-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-body)' }}
              />
              {visibleOpponents.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>Nessun avversario trovato.</p>
              ) : (
                <div className="space-y-2">
                  {visibleOpponents.map(o => (
                    <OpponentCard key={o.id} opponent={o} record={recordFor(o.id)} onClick={() => setSelectedOpponentId(o.id)} />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── ALLENAMENTI ── */}
        {activeTab === 'allenamenti' && (
          (trainLoading || runLoading || gymLoading) ? (
            <Spinner />
          ) : trainings.length === 0 && runs.length === 0 && workouts.length === 0 && gymSessions.length === 0 && gymWorkouts.length === 0 ? (
            <EmptyState icon="🎯" title="Nessun allenamento." sub="Registra sessioni di tennis, corse e palestra per vedere su cosa stai lavorando davvero." onAdd={() => setShowTypePicker(true)} />
          ) : (
            <div className="space-y-4">
              {/* Tipo di allenamento */}
              <div className="flex gap-2">
                {SPORT_FILTERS.map(f => (
                  <Chip key={f.id} active={fSport === f.id} onClick={() => setFSport(f.id)} icon={f.icon}>{f.label}</Chip>
                ))}
              </div>

              {(fSport === 'all' || fSport === 'tennis') && trainings.length > 0 && <FocusProgress trainings={trainings} />}
              {fSport === 'corsa' && (
                <WorkoutLibrary
                  workouts={workouts}
                  runs={runs}
                  running={running}
                  onSelect={setEditingWorkoutId}
                  onAdd={() => setCreatingWorkout(true)}
                />
              )}

              {fSport === 'palestra' && (
                <GymWorkoutLibrary
                  workouts={gymWorkouts}
                  sessions={gymSessions}
                  index={exerciseApi.index}
                  onSelect={setEditingGymWorkoutId}
                  onAdd={() => setCreatingGymWorkout(true)}
                />
              )}

              <TrainingFilters
                sport={fSport}
                kind={fKind} setKind={setFKind}
                focus={fFocus} setFocus={setFFocus} focusOptions={usedFocusIds}
                intensity={fIntensity} setIntensity={setFIntensity}
                workout={fSport === 'palestra' ? fGymWorkout : fWorkout}
                setWorkout={fSport === 'palestra' ? setFGymWorkout : setFWorkout}
                workoutOptions={fSport === 'palestra' ? usedGymWorkouts : usedWorkouts}
                dateFrom={fTrDateFrom} setDateFrom={setFTrDateFrom}
                dateTo={fTrDateTo} setDateTo={setFTrDateTo}
                hasActiveFilters={hasActiveTrainingFilters}
                onReset={resetTrainingFilters}
              />

              {sessionEntries.length === 0 ? (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-slate)' }}>
                  {hasActiveTrainingFilters
                    ? 'Nessun allenamento con questi filtri.'
                    : fSport === 'corsa' ? 'Nessuna corsa registrata.'
                    : fSport === 'palestra' ? 'Nessun allenamento di palestra registrato.' : 'Nessun allenamento registrato.'}
                </p>
              ) : (
                <div className="space-y-6">
                  {trainingMonthGroups.map(group => {
                    const hours = monthHours(group.items, running, exerciseApi.index)
                    return (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider"
                             style={{ color: 'var(--color-teal)', fontFamily: 'var(--font-display)' }}>
                            {group.label}
                          </p>
                          <div className="flex-1 h-px" style={{ background: 'var(--color-surface-2)' }} />
                          <span className="text-xs" style={{ color: 'var(--color-slate)' }}>
                            {hours.estimated ? '~' : ''}{formatHours(hours.minutes)} h
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.items.map(e => (
                            e.sport === 'corsa' ? (
                              <RunRow key={e.id} run={e.item} workouts={workouts} running={running} onClick={() => setSelectedRunId(e.id)} />
                            ) : e.sport === 'palestra' ? (
                              <GymRow key={e.id} session={e.item} workouts={gymWorkouts} index={exerciseApi.index} onClick={() => setSelectedGymId(e.id)} />
                            ) : (
                              <TrainingRow key={e.id} training={e.item} onClick={() => setSelectedTrainingId(e.id)} />
                            )
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* ── PANORAMICA ── */}
        {activeTab === 'panoramica' && (
          (matchLoading || trainLoading) ? <Spinner /> : (
            <Overview
              matches={matches}
              trainings={trainings}
              equipment={equipment}
              onSelectMatch={setSelectedMatchId}
              onSelectTraining={setSelectedTrainingId}
              onAddMatch={() => setShowAddMatch(true)}
              onAddTraining={() => setShowTypePicker(true)}
            />
          )
        )}
      </div>

      {/* ── Modali Avversari ── */}
      {showAddOpponent && (
        <AddOpponentModal onClose={() => setShowAddOpponent(false)} onSave={async (data) => { await addOpponent(data) }} />
      )}
      {selectedOpponent && (
        <OpponentDetailModal
          opponent={selectedOpponent}
          record={recordFor(selectedOpponent.id)}
          matches={matchesVs(selectedOpponent.id)}
          onClose={() => setSelectedOpponentId(null)}
          onSelectMatch={(matchId) => setSelectedMatchId(matchId)}
          onUpdate={async (id, data) => {
            await updateOpponent(id, data)
            // Le partite portano una copia del nome: dopo una rinomina vanno riallineate.
            if (data.name !== undefined) await reloadMatches()
          }}
          onDelete={async (id) => {
            // Guard difensiva: il bottone di eliminazione è già nascosto nel
            // modale quando ci sono match collegati, ma non fidarsi solo della UI.
            if (matchesVs(id).length > 0) return
            await removeOpponent(id)
            setSelectedOpponentId(null)
            setOppDeleteToast(true)
          }}
        />
      )}

      {/* ── Modale Torneo ── */}
      {/* Sta PRIMA dei modali partita (che nel JSX vengono dopo, quindi sopra
          nello stacking): dal cammino si apre il dettaglio di una partita — e
          da lì il wizard di modifica — senza chiudere il tabellone, e tornando
          indietro si è di nuovo nel torneo. Stessa coesistenza già usata da
          OpponentDetailModal con MatchDetailModal. */}
      {selectedTournament && (
        <TournamentDetailModal
          run={selectedTournament}
          onClose={() => setSelectedTournamentId(null)}
          onSelectMatch={(matchId) => setSelectedMatchId(matchId)}
        />
      )}

      {/* ── Modali Partite ── */}
      {(showAddMatch || editingMatch) && !waitPrefill && (
        <AddMatchModal
          initial={editingMatch}
          prefill={editingMatch ? null : prefillOf('match')}
          opponents={opponents}
          equipment={equipment}
          fitUse={fitUseFor(editingMatch?.id)}
          intensityCalibration={intensityCalibration}
          onClose={closing(() => { setShowAddMatch(false); setEditingMatch(null); setPrefillFor(null) })}
          onSave={async (data, fitDetails) => {
            await commitFit({ details: fitDetails, prevFitId: editingMatch?.athletics?.fitId }, data.athletics)
            if (editingMatch) await updateMatch(editingMatch.id, data)
            else await addMatch(data)
          }}
        />
      )}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          equipment={equipment}
          onClose={closing(() => setSelectedMatchId(null))}
          onEdit={() => { setEditingMatch(selectedMatch); setSelectedMatchId(null) }}
          onUpdate={async (id, data) => { await updateMatch(id, data) }}
          onDelete={deleting(async (id) => { await dropFit(selectedMatch.athletics); await removeMatch(id); setSelectedMatchId(null); setMatchDeleteToast(true) })}
        />
      )}

      {/* ── Modali Allenamenti ── */}
      {(showAddTraining || editingTraining) && !waitPrefill && (
        <AddTrainingModal
          initial={editingTraining}
          prefill={editingTraining ? null : prefillOf('training')}
          opponents={opponents}
          equipment={equipment}
          trainings={trainings}
          onClose={closing(() => { setShowAddTraining(false); setEditingTraining(null); setPrefillFor(null) })}
          onSave={async (data) => {
            if (editingTraining) await updateTraining(editingTraining.id, data)
            else await addTraining(data)
          }}
        />
      )}
      {selectedTraining && (
        <TrainingDetailModal
          training={selectedTraining}
          equipment={equipment}
          fitUse={fitUseFor(selectedTraining.id)}
          intensityCalibration={intensityCalibration}
          onClose={closing(() => setSelectedTrainingId(null))}
          onEdit={() => { setEditingTraining(selectedTraining); setSelectedTrainingId(null) }}
          onUpdate={async (id, data, fit) => { await commitFit(fit, data.athletics); await updateTraining(id, data) }}
          onDelete={deleting(async (id) => { await dropFit(selectedTraining.athletics); await removeTraining(id); setSelectedTrainingId(null); setTrainingDeleteToast(true) })}
        />
      )}

      {/* ── Allenamenti: scelta del tipo ── */}
      {showTypePicker && (
        <SessionTypePicker
          runningReady={runningReady}
          profileLoading={profileLoading}
          onPick={pickSessionType}
          onClose={() => setShowTypePicker(false)}
        />
      )}

      {/* ── Modali Corsa ── */}
      {/* Il wizard aspetta il profilo: senza zone di passo non c'è niente da
          stimare, e da `?add=run` si può arrivare prima che siano caricate.
          Con il profilo incompleto si mostra la scelta del tipo, che dice
          perché la corsa è bloccata e dove sbloccarla. */}
      {(showAddRun || editingRun) && !profileLoading && !waitPrefill && (
        runningReady ? (
          <AddRunModal
            initial={editingRun}
            prefill={editingRun ? null : prefillOf('run')}
            workouts={workouts}
            runs={runs.filter(r => r.id !== editingRun?.id)}
            running={running}
            fitUse={fitUseFor(editingRun?.id)}
            onClose={closing(() => { setShowAddRun(false); setEditingRun(null); setPrefillFor(null) })}
            onSave={saveRun}
          />
        ) : (
          <SessionTypePicker
            runningReady={false}
            onPick={pickSessionType}
            onClose={closing(() => { setShowAddRun(false); setEditingRun(null) })}
          />
        )
      )}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          workouts={workouts}
          running={running}
          fitUse={fitUseFor(selectedRun.id)}
          onClose={closing(() => setSelectedRunId(null))}
          onEdit={() => { setEditingRun(selectedRun); setSelectedRunId(null) }}
          onUpdate={async (id, data, fit) => { await commitFit(fit, data.athletics); await updateRun(id, data) }}
          onDelete={deleting(async (id) => { await dropFit(selectedRun.athletics); await removeRun(id); setSelectedRunId(null); setRunDeleteToast(true) })}
        />
      )}
      {(creatingWorkout || editingWorkout) && (
        <WorkoutEditModal
          workout={editingWorkout}
          runsCount={editingWorkout ? runs.filter(r => r.workoutId === editingWorkout.id).length : 0}
          running={running}
          onClose={() => { setCreatingWorkout(false); setEditingWorkoutId(null) }}
          onSave={async (data) => {
            if (editingWorkout) await updateWorkout(editingWorkout.id, data)
            else await addWorkout(data)
          }}
          onDelete={async (id) => { await removeWorkout(id) }}
        />
      )}

      {/* ── Modali Palestra ── */}
      {(showAddGym || editingGym) && !waitPrefill && (
        <AddGymModal
          initial={editingGym}
          prefill={editingGym ? null : prefillOf('gym')}
          workouts={gymWorkouts}
          sessions={gymSessions.filter(g => g.id !== editingGym?.id)}
          exerciseApi={exerciseApi}
          fitUse={fitUseFor(editingGym?.id)}
          onClose={closing(() => { setShowAddGym(false); setEditingGym(null); setPrefillFor(null) })}
          onSave={saveGym}
        />
      )}
      {selectedGym && (
        <GymDetailModal
          session={selectedGym}
          workouts={gymWorkouts}
          index={exerciseApi.index}
          fitUse={fitUseFor(selectedGym.id)}
          onClose={closing(() => setSelectedGymId(null))}
          onEdit={() => { setEditingGym(selectedGym); setSelectedGymId(null) }}
          onUpdate={async (id, data, fit) => { await commitFit(fit, data.athletics); await updateGymSession(id, data) }}
          onDelete={deleting(async (id) => { await dropFit(selectedGym.athletics); await removeGymSession(id); setSelectedGymId(null); setGymDeleteToast(true) })}
        />
      )}
      {(creatingGymWorkout || editingGymWorkout) && (
        <GymWorkoutEditModal
          workout={editingGymWorkout}
          sessionsCount={editingGymWorkout ? gymSessions.filter(g => g.workoutId === editingGymWorkout.id).length : 0}
          exerciseApi={exerciseApi}
          onClose={() => { setCreatingGymWorkout(false); setEditingGymWorkoutId(null) }}
          onSave={async (data) => {
            if (editingGymWorkout) await updateGymWorkout(editingGymWorkout.id, data)
            else await addGymWorkout(data)
          }}
          onDelete={async (id) => { await removeGymWorkout(id) }}
        />
      )}

      {/* Toast eliminazione */}
      {oppDeleteToast && <Toast title="Avversario eliminato" sub="È stato rimosso dalla tua anagrafica." onClose={() => setOppDeleteToast(false)} />}
      {matchDeleteToast && <Toast title="Partita eliminata" sub="È stata rimossa dallo storico." onClose={() => setMatchDeleteToast(false)} />}
      {trainingDeleteToast && <Toast title="Allenamento eliminato" sub="È stato rimosso dallo storico." onClose={() => setTrainingDeleteToast(false)} />}
      {runDeleteToast && <Toast title="Corsa eliminata" sub="È stata rimossa dallo storico." onClose={() => setRunDeleteToast(false)} />}
      {gymDeleteToast && <Toast title="Allenamento eliminato" sub="È stato rimosso dallo storico." onClose={() => setGymDeleteToast(false)} />}
    </div>
  )
}

// ── Filtri partite ─────────────────────────────────────────

function MatchFilters({
  type, setType, event, setEvent, eventOptions,
  opponent, setOpponent, opponentOptions,
  surface, setSurface,
  dateFrom, setDateFrom, dateTo, setDateTo,
  result, setResult,
  hasActiveFilters, onReset
}) {
  return (
    <div className="space-y-2">
      {/* Reset filtri */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95"
            style={{ background: 'var(--color-surface)', color: 'var(--color-amber)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
            <span>✕</span>
            <span>Cancella filtri</span>
          </button>
        </div>
      )}

      {/* Tipo */}
      <div className="overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          {[{ id: 'all', label: 'Tutti' }, ...MATCH_TYPES.map(t => ({ id: t.id, label: t.label }))].map(t => (
            <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>
          ))}
        </div>
      </div>

      {/* Range di date */}
      <div className="flex gap-2">
        <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Da" />
        <DateInput value={dateTo} onChange={setDateTo} placeholder="A" />
      </div>

      {/* Evento (solo campionato/torneo) + Avversario */}
      <div className="flex gap-2">
        {eventOptions.length > 0 && (
          <Select value={event} onChange={setEvent}>
            <option value="">Tutti gli eventi</option>
            {eventOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </Select>
        )}
        <Select value={opponent} onChange={setOpponent}>
          <option value="all">Tutti gli avversari</option>
          {opponentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
      </div>

      {/* Superficie */}
      <div className="overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          <Chip active={surface === 'all'} onClick={() => setSurface('all')}>Tutte</Chip>
          {SURFACES.map(s => (
            <Chip key={s} active={surface === s} onClick={() => setSurface(s)} icon={surfaceIcon(s)}>
              <span className="capitalize">{s}</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* Esito */}
      <div className="flex gap-2">
        {RESULT_FILTERS.map(r => (
          <Chip key={r.id} active={result === r.id} onClick={() => setResult(r.id)}
            dot={r.id !== 'all' ? RESULT_META[r.id]?.color : null}>
            {r.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

// ── Filtri allenamenti ─────────────────────────────────────

function TrainingFilters({
  sport,
  kind, setKind,
  focus, setFocus, focusOptions,
  intensity, setIntensity,
  workout, setWorkout, workoutOptions,
  dateFrom, setDateFrom, dateTo, setDateTo,
  hasActiveFilters, onReset
}) {
  // Le opzioni del filtro colpo sono raggruppate per categoria, così la select
  // resta navigabile anche con molte voci in uso.
  const groupedFocus = FOCUS_CATEGORIES
    .map(cat => ({ ...cat, items: cat.items.filter(i => focusOptions.includes(i.id)) }))
    .filter(cat => cat.items.length > 0)

  return (
    <div className="space-y-2">
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95"
            style={{ background: 'var(--color-surface)', color: 'var(--color-amber)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
            <span>✕</span>
            <span>Cancella filtri</span>
          </button>
        </div>
      )}

      {/* Range di date — vale per tennis e corsa */}
      <div className="flex gap-2">
        <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Da" />
        <DateInput value={dateTo} onChange={setDateTo} placeholder="A" />
      </div>

      {/* Scheda di corsa o di palestra */}
      {(sport === 'corsa' || sport === 'palestra') && workoutOptions.length > 0 && (
        <div className="flex">
          <Select value={workout} onChange={setWorkout}>
            <option value="all">Tutte le schede</option>
            {workoutOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </div>
      )}

      {sport === 'tennis' && <>
      {/* Tipo di blocco */}
      <div className="overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          <Chip active={kind === 'all'} onClick={() => setKind('all')}>Tutti</Chip>
          {TRAINING_KINDS.map(k => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)} icon={k.icon}>{k.label}</Chip>
          ))}
        </div>
      </div>

      {/* Colpo lavorato */}
      {groupedFocus.length > 0 && (
        <Select value={focus} onChange={setFocus}>
          <option value="all">Tutti i colpi e schemi</option>
          {groupedFocus.map(cat => (
            <optgroup key={cat.id} label={cat.label}>
              {cat.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </optgroup>
          ))}
        </Select>
      )}

      {/* Intensità */}
      <div className="flex gap-2">
        <Chip active={intensity === 'all'} onClick={() => setIntensity('all')}>Tutte</Chip>
        {INTENSITIES.map(i => (
          <Chip key={i.id} active={intensity === i.id} onClick={() => setIntensity(i.id)} dot={i.color}>
            {i.label}
          </Chip>
        ))}
      </div>
      </>}
    </div>
  )
}

function Chip({ active, onClick, children, dot, icon }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
      style={{
        background: active ? 'var(--color-teal-dark)' : 'var(--color-surface)',
        color: active ? 'var(--color-white)' : 'var(--color-slate)',
        border: active ? 'none' : '1px solid var(--color-surface-2)',
        fontFamily: 'var(--font-display)'
      }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}

function DateInput({ value, onChange, placeholder }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5 p-2.5 rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
      <span className="text-xs shrink-0" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-display)' }}>{placeholder}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 min-w-0 text-xs outline-none"
        style={{ background: 'transparent', color: 'var(--color-white)', fontFamily: 'var(--font-display)', colorScheme: 'dark' }}
      />
    </div>
  )
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="flex-1 min-w-0 p-2.5 rounded-xl text-xs outline-none"
      style={{ background: 'var(--color-surface)', color: 'var(--color-white)', border: '1px solid var(--color-surface-2)', fontFamily: 'var(--font-display)' }}>
      {children}
    </select>
  )
}

// ── Comuni ─────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center pt-20">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-teal-dark)', borderTopColor: 'transparent' }} />
    </div>
  )
}

function EmptyState({ icon, title, sub, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>{sub}</p>
      <button onClick={onAdd}
        className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
        + Aggiungi
      </button>
    </div>
  )
}

function Toast({ title, sub, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
         style={{ background: 'rgba(2,13,25,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs rounded-3xl p-6 text-center"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }}>
        <span className="text-4xl mb-3 block">✅</span>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-white)', fontFamily: 'var(--font-display)' }}>{title}</p>
        <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>{sub}</p>
        <button onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--color-amber)', color: 'var(--color-bg)', fontFamily: 'var(--font-display)' }}>
          Ok
        </button>
      </div>
    </div>
  )
}

// ── Helpers data ───────────────────────────────────────────

// Tab di partenza dedotto dall'intenzione nell'URL: si atterra dove la cosa
// chiesta vive, così chiudere la modale lascia nel contesto giusto invece che
// sulla Panoramica. Senza parametri (ingresso dalla bottom nav) resta la
// Panoramica, che è la landing dell'area.
function initialTab(searchParams) {
  const add = searchParams.get('add')
  if (add === 'match'    || searchParams.get('match'))    return 'partite'
  if (add === 'training' || searchParams.get('training')) return 'allenamenti'
  if (add === 'run'      || searchParams.get('run'))      return 'allenamenti'
  if (add === 'gym'      || searchParams.get('gym'))      return 'allenamenti'
  if (add === 'opponent') return 'avversari'
  return 'panoramica'
}

const MONTH_NAMES =['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function monthKey(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key) {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`
}

// Ore del mese nella lista allenamenti: minuti dei blocchi per il tennis,
// durata dell'orologio per corsa e palestra (o la stima della scheda, che
// accende il "~").
function monthHours(entries, running, exerciseIndex) {
  let minutes = 0
  let estimated = false
  entries.forEach(e => {
    if (e.sport === 'palestra') {
      const g = gymMinutes(e.item, exerciseIndex)
      minutes += g.minutes
      estimated = estimated || g.estimated
    } else if (e.sport === 'corsa') {
      const r = runMinutes(e.item, running)
      minutes += r.minutes
      estimated = estimated || r.estimated
    } else {
      minutes += totalMinutes(e.item.blocks)
    }
  })
  return { minutes, estimated }
}

// Raggruppa le partite (già ordinate per data desc) per mese, preservando l'ordine
function groupByMonth(matches) {
  const groups = []
  const index = {}
  matches.forEach(m => {
    const key = monthKey(m.date)
    if (index[key] == null) {
      index[key] = groups.length
      groups.push({ key, label: monthLabelFromKey(key), items: [] })
    }
    groups[index[key]].items.push(m)
  })
  return groups
}
