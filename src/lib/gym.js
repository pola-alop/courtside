// ── Dominio Palestra ────────────────────────────────────────
// Modulo puro di src/lib/ (nessun React, nessun Firestore). Contiene la
// tassonomia dei muscoli, il database degli esercizi (statico + quelli
// personalizzati dell'utente), la struttura di una scheda e le funzioni che la
// traducono in numeri: serie, ripetizioni, volume, durata stimata e — la cosa
// che fa funzionare il manichino — il PUNTEGGIO PER MUSCOLO.
//
// ── Scheda e sessione sono due cose diverse ──
// Come nella corsa: la SCHEDA (`gymWorkouts`) è la ricetta riutilizzabile, la
// SESSIONE (`gymSessions`) è l'allenamento fatto un certo giorno e porta una
// COPIA degli esercizi con le serie davvero eseguite. Cambiare la scheda non
// riscrive le sessioni passate.
//
// ── Struttura (`items`) ──
// Un array piatto di esercizi, in ordine di esecuzione:
//   Item = { id, exerciseId, snapshot?, sets: [Set] }
//   Set  = { reps, kg }   per gli esercizi a ripetizioni con carico
//        | { reps }       per quelli a corpo libero
//        | { sec }        per quelli a tempo (plank, farmer walk...)
// `kg` è facoltativo anche negli esercizi con carico: null = non registrato, e
// quella serie non entra nel volume.
//
// ── I muscoli NON si salvano sulla sessione ──
// Si ricavano dall'esercizio, ogni volta che servono. Correggere un esercizio
// del database corregge anche lo storico e il manichino delle sessioni passate.
// Fanno eccezione gli esercizi PERSONALIZZATI: se l'utente ne elimina uno, le
// sessioni che lo usavano devono restare leggibili, quindi l'item ne porta uno
// `snapshot` (nome, modalità, muscoli) che si usa solo se l'indice non lo trova.
//
// ── Chi comanda: la scheda ──
// Serie, ripetizioni e carichi sono SEMPRE quelli della scheda/sessione. Il file
// .FIT dell'orologio (sviluppo futuro) porterà solo i dati atletici — calorie,
// FC, training effect — nello stesso campo `athletics` delle altre sessioni.

import exercisesData from '../data/exercises.json'
import { workoutUsage, sortWorkoutsByUse } from './running'

// L'uso delle schede si ricava dalle sessioni con la stessa identica logica
// della corsa (conta per `workoutId`, ultima data): riesportata, non copiata.
export { workoutUsage, sortWorkoutsByUse }

// ── Muscoli ────────────────────────────────────────────────
// `region` raggruppa le liste (parte alta, core, gambe). Gli id sono quelli che
// il manichino (`components/gym/BodyMap.jsx`) usa per i suoi tracciati.
export const MUSCLES = [
  { id: 'petto',        label: 'Petto',        region: 'alto' },
  { id: 'spalle',       label: 'Spalle',       region: 'alto' },
  { id: 'trapezio',     label: 'Trapezio',     region: 'alto' },
  { id: 'dorsali',      label: 'Dorsali',      region: 'alto' },
  { id: 'bicipiti',     label: 'Bicipiti',     region: 'alto' },
  { id: 'tricipiti',    label: 'Tricipiti',    region: 'alto' },
  { id: 'avambracci',   label: 'Avambracci',   region: 'alto' },
  { id: 'addominali',   label: 'Addominali',   region: 'core' },
  { id: 'obliqui',      label: 'Obliqui',      region: 'core' },
  { id: 'lombari',      label: 'Lombari',      region: 'core' },
  { id: 'glutei',       label: 'Glutei',       region: 'gambe' },
  { id: 'quadricipiti', label: 'Quadricipiti', region: 'gambe' },
  { id: 'femorali',     label: 'Femorali',     region: 'gambe' },
  { id: 'adduttori',    label: 'Adduttori',    region: 'gambe' },
  { id: 'polpacci',     label: 'Polpacci',     region: 'gambe' },
]

export const MUSCLES_BY_ID = Object.fromEntries(MUSCLES.map(m => [m.id, m]))

export function muscleLabel(id) {
  return MUSCLES_BY_ID[id]?.label || id
}

export const MUSCLE_REGIONS = [
  { id: 'alto',  label: 'Parte alta' },
  { id: 'core',  label: 'Core' },
  { id: 'gambe', label: 'Gambe' },
]

// ── Esercizi ───────────────────────────────────────────────
// Modalità di registrazione: cosa si scrive per ogni serie.
export const EXERCISE_MODES = [
  { id: 'reps-kg', label: 'Ripetizioni e kg' },
  { id: 'reps',    label: 'Solo ripetizioni (corpo libero)' },
  { id: 'time',    label: 'A tempo' },
]

// Schema di movimento, per il bilancio spinta/trazione delle statistiche.
export const MOVEMENTS = [
  { id: 'push',  label: 'Spinta',   color: 'var(--color-amber)' },
  { id: 'pull',  label: 'Trazione', color: 'var(--color-draw)' },
  { id: 'legs',  label: 'Gambe',    color: 'var(--color-win)' },
  { id: 'core',  label: 'Core',     color: 'var(--color-teal)' },
  { id: 'other', label: 'Total body', color: 'var(--color-slate)' },
]

export const MOVEMENTS_BY_ID = Object.fromEntries(MOVEMENTS.map(m => [m.id, m]))

export const EQUIPMENT_TYPES = ['bilanciere', 'manubri', 'macchina', 'cavi', 'kettlebell', 'corpo libero', 'altro']

// Il movimento di un esercizio personalizzato non si chiede: si deduce dal
// primo muscolo primario.
const MOVEMENT_OF_MUSCLE = {
  petto: 'push', spalle: 'push', tricipiti: 'push',
  dorsali: 'pull', trapezio: 'pull', bicipiti: 'pull', avambracci: 'pull',
  quadricipiti: 'legs', femorali: 'legs', glutei: 'legs', adduttori: 'legs', polpacci: 'legs',
  addominali: 'core', obliqui: 'core', lombari: 'core',
}

export const CUSTOM_PREFIX = 'custom:'

export const isCustomId = (id) => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX)

// Esercizi del database, fissi nel bundle.
export const EXERCISES = exercisesData

// Indice id → esercizio, dei fissi e dei personalizzati (`gymExercises`).
// Quelli personalizzati hanno id `custom:<docId>` e il flag `custom`.
export function buildExerciseIndex(customExercises = []) {
  const index = {}
  EXERCISES.forEach(e => { index[e.id] = e })
  customExercises.forEach(c => {
    const id = CUSTOM_PREFIX + c.id
    index[id] = {
      id, custom: true, docId: c.id,
      name: c.name,
      equipment: c.equipment || 'altro',
      mode: c.mode || 'reps-kg',
      movement: MOVEMENT_OF_MUSCLE[c.primary?.[0]] || 'other',
      primary: c.primary || [],
      secondary: c.secondary || [],
    }
  })
  return index
}

// L'esercizio di un item: dall'indice, altrimenti dallo snapshot dell'item
// (esercizio personalizzato eliminato), altrimenti un segnaposto che non
// contribuisce a nessun muscolo.
export function resolveExercise(item, index) {
  const found = index?.[item?.exerciseId]
  if (found) return found
  if (item?.snapshot) return { id: item.exerciseId, custom: true, equipment: 'altro', movement: 'other', secondary: [], ...item.snapshot }
  return { id: item?.exerciseId, name: 'Esercizio non trovato', equipment: 'altro', mode: 'reps-kg', movement: 'other', primary: [], secondary: [] }
}

export function modeMeta(id) {
  return EXERCISE_MODES.find(m => m.id === id) || EXERCISE_MODES[0]
}

// Problemi di un esercizio personalizzato (vuoto = salvabile).
export function customExerciseIssues(form, customExercises = [], editingId = null) {
  const issues = []
  const name = (form?.name || '').trim()
  if (name.length < 2) issues.push('Dai un nome all\'esercizio.')
  else {
    const clash = [...EXERCISES.map(e => e.name), ...customExercises.filter(c => c.id !== editingId).map(c => c.name)]
      .some(n => n.trim().toLowerCase() === name.toLowerCase())
    if (clash) issues.push('Esiste già un esercizio con questo nome.')
  }
  if (!form?.primary?.length) issues.push('Scegli almeno un muscolo principale.')
  return issues
}

export function normalizeCustomExercise(form) {
  const primary = [...new Set(form.primary || [])].filter(id => MUSCLES_BY_ID[id])
  const secondary = [...new Set(form.secondary || [])].filter(id => MUSCLES_BY_ID[id] && !primary.includes(id))
  return {
    name: form.name.trim(),
    equipment: EQUIPMENT_TYPES.includes(form.equipment) ? form.equipment : 'altro',
    mode: EXERCISE_MODES.some(m => m.id === form.mode) ? form.mode : 'reps-kg',
    primary,
    secondary,
  }
}

// ── Costruzione ────────────────────────────────────────────

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export const DEFAULT_SETS = 3
export const DEFAULT_REPS = 10
export const DEFAULT_HOLD_SEC = 30

export const emptySet = (mode) => {
  if (mode === 'time') return { sec: DEFAULT_HOLD_SEC }
  if (mode === 'reps') return { reps: DEFAULT_REPS }
  return { reps: DEFAULT_REPS, kg: null }
}

export function emptyItem(exercise) {
  return {
    id: newId(),
    exerciseId: exercise.id,
    sets: Array.from({ length: DEFAULT_SETS }, () => emptySet(exercise.mode)),
  }
}

// Copia con id nuovo, per "Duplica esercizio".
export function cloneItem(item) {
  return { ...item, id: newId(), sets: item.sets.map(s => ({ ...s })) }
}

// ── Validazione ────────────────────────────────────────────

export const LIMITS = {
  reps: { min: 1, max: 200 },
  kg:   { min: 0, max: 500, step: 0.5 },
  sec:  { min: 1, max: 3600 },
  sets: { max: 30 },
  items: { max: 40 },
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function setIssue(set, mode) {
  if (mode === 'time') {
    return isNum(set?.sec) && set.sec >= LIMITS.sec.min && set.sec <= LIMITS.sec.max ? null : 'Indica la durata di ogni serie.'
  }
  if (!isNum(set?.reps) || set.reps < LIMITS.reps.min || set.reps > LIMITS.reps.max) return 'Indica le ripetizioni di ogni serie.'
  if (mode === 'reps-kg' && set.kg != null && (!isNum(set.kg) || set.kg < LIMITS.kg.min || set.kg > LIMITS.kg.max)) {
    return `Il carico deve stare tra ${LIMITS.kg.min} e ${LIMITS.kg.max} kg.`
  }
  return null
}

// Il problema di un item (stringa) o null.
export function itemIssue(item, index) {
  const ex = resolveExercise(item, index)
  if (!item?.sets?.length) return `${ex.name}: aggiungi almeno una serie.`
  for (const s of item.sets) {
    const p = setIssue(s, ex.mode)
    if (p) return `${ex.name}: ${p.charAt(0).toLowerCase()}${p.slice(1)}`
  }
  return null
}

// Elenco dei problemi (vuoto = pronta). Gate del wizard: una scheda senza
// esercizi, o con una serie senza ripetizioni, non si può registrare.
export function workoutIssues(items, index) {
  if (!items?.length) return ['Aggiungi almeno un esercizio.']
  return items.map(it => itemIssue(it, index)).filter(Boolean)
}

// Forma canonica da persistere: solo i campi della modalità, numeri veri, e lo
// snapshot per gli esercizi personalizzati.
export function normalizeItems(items, index) {
  return (items || []).map(it => {
    const ex = resolveExercise(it, index)
    const sets = (it.sets || []).map(s => {
      if (ex.mode === 'time') return { sec: Math.round(s.sec) }
      if (ex.mode === 'reps') return { reps: Math.round(s.reps) }
      return { reps: Math.round(s.reps), kg: isNum(s.kg) ? Math.round(s.kg * 2) / 2 : null }
    })
    const out = { id: it.id, exerciseId: it.exerciseId, sets }
    if (isCustomId(it.exerciseId)) {
      out.snapshot = { name: ex.name, equipment: ex.equipment, mode: ex.mode, movement: ex.movement, primary: ex.primary, secondary: ex.secondary }
    }
    return out
  })
}

// Uguaglianza strutturale delle liste (per "modificata rispetto alla scheda").
export function sameItems(a, b) {
  const strip = (items) => (items || []).map(it => ({ exerciseId: it.exerciseId, sets: it.sets }))
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

// ── Totali e stime ─────────────────────────────────────────

// Stima della durata quando l'orologio non c'è: ~3 s a ripetizione (minimo 20 s
// per serie) più un recupero fisso. È una stima e si mostra sempre con "~".
export const SEC_PER_REP = 3
export const MIN_SET_SEC = 20
export const REST_SEC = 75

function setWorkSec(set, mode) {
  if (mode === 'time') return set.sec || 0
  return Math.max(MIN_SET_SEC, (set.reps || 0) * SEC_PER_REP)
}

export function workoutTotals(items, index) {
  let sets = 0, reps = 0, volumeKg = 0, sec = 0
  ;(items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    ;(it.sets || []).forEach(s => {
      sets++
      if (ex.mode !== 'time') reps += s.reps || 0
      if (ex.mode === 'reps-kg' && isNum(s.kg)) volumeKg += (s.reps || 0) * s.kg
      sec += setWorkSec(s, ex.mode) + REST_SEC
    })
  })
  return { exercises: (items || []).length, sets, reps, volumeKg, estimatedSec: sec }
}

// Durata della sessione in minuti: il dato reale dell'orologio se c'è,
// altrimenti la stima (flag `estimated`, da dichiarare col "~").
export function gymMinutes(session, index) {
  const real = session?.athletics?.durationSec
  if (isNum(real) && real > 0) return { minutes: real / 60, estimated: false }
  return { minutes: workoutTotals(session?.items, index).estimatedSec / 60, estimated: true }
}

// Nome da mostrare: quello attuale della scheda se esiste ancora, altrimenti la
// copia salvata (la rinomina di una scheda non ha niente da propagare).
export function gymDisplayName(session, workouts = []) {
  const w = session?.workoutId ? workouts.find(x => x.id === session.workoutId) : null
  return w?.name || session?.workoutName || 'Palestra'
}

// Stima del massimale (Epley) da una serie: kg × (1 + reps/30). Sopra le 12
// ripetizioni la formula si allontana troppo dalla realtà, quindi non si stima.
export const MAX_REPS_FOR_1RM = 12
export function estimate1RM(set) {
  if (!isNum(set?.kg) || set.kg <= 0 || !isNum(set?.reps) || set.reps < 1 || set.reps > MAX_REPS_FOR_1RM) return null
  return set.reps === 1 ? set.kg : set.kg * (1 + set.reps / 30)
}

// ── Punteggio per muscolo (il cuore del manichino) ─────────
// Ogni serie vale 1 per i muscoli PRIMARI dell'esercizio e 0,5 per i
// SECONDARI: sono "serie equivalenti". La scala è ASSOLUTA — il rosso pieno è
// un numero di serie, non "il muscolo più lavorato di questa sessione" — così
// una sessione leggera non sembra tutta rossa.
export const PRIMARY_WEIGHT = 1
export const SECONDARY_WEIGHT = 0.5

// Serie equivalenti per il rosso pieno: in una sessione, e a settimana quando
// si guarda un periodo (media settimanale: 12 è dentro la fascia 10-20 serie a
// settimana per gruppo che le linee guida di ipertrofia indicano come efficace).
export const SESSION_FULL_SETS = 8
export const WEEK_FULL_SETS = 12

// { muscoloId: serieEquivalenti } per una lista di item. I muscoli mai toccati
// non compaiono.
export function muscleScores(items, index) {
  const scores = {}
  ;(items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    const n = it.sets?.length || 0
    if (!n) return
    ex.primary.forEach(m => { scores[m] = (scores[m] || 0) + n * PRIMARY_WEIGHT })
    ex.secondary.forEach(m => { scores[m] = (scores[m] || 0) + n * SECONDARY_WEIGHT })
  })
  return scores
}

// Somma i punteggi di più sessioni.
export function sumScores(list) {
  const out = {}
  list.forEach(s => Object.entries(s).forEach(([m, v]) => { out[m] = (out[m] || 0) + v }))
  return out
}

// Da punteggio a intensità 0..1, saturando al rosso pieno.
export function heatOf(points, full) {
  if (!points || points <= 0) return 0
  return Math.min(1, points / full)
}

// Gli esercizi che hanno lavorato un muscolo in una lista di item, per il
// dettaglio "perché è rosso" al tap sul manichino.
export function muscleContributors(items, index, muscleId) {
  const out = []
  ;(items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    const n = it.sets?.length || 0
    const role = ex.primary.includes(muscleId) ? 'primary' : ex.secondary.includes(muscleId) ? 'secondary' : null
    if (!role || !n) return
    out.push({ exercise: ex, sets: n, role, points: n * (role === 'primary' ? PRIMARY_WEIGHT : SECONDARY_WEIGHT) })
  })
  return out.sort((a, b) => b.points - a.points)
}

// Colore della scala giallo → arancio → rosso per t in 0..1, sui token di
// palette (`--color-muscle-*`, in index.css): color-mix tra due tinte, senza
// valori hardcoded nel componente. t = 0 non passa di qui (muscolo non toccato:
// lo colora il manichino con `--color-muscle-off`).
export function heatColor(t) {
  const x = Math.max(0, Math.min(1, t))
  if (x <= 0.5) {
    const p = Math.round((x / 0.5) * 100)
    return `color-mix(in srgb, var(--color-muscle-mid) ${p}%, var(--color-muscle-low))`
  }
  const p = Math.round(((x - 0.5) / 0.5) * 100)
  return `color-mix(in srgb, var(--color-muscle-high) ${p}%, var(--color-muscle-mid))`
}

// ── Formattazione ──────────────────────────────────────────

const nf = (v, d = 0) => v.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: d })

export function formatKg(kg) {
  return `${nf(kg, 1)} kg`
}

export function formatVolume(kg) {
  if (!kg) return '—'
  return kg >= 10000 ? `${nf(kg / 1000, 1)} t` : `${nf(Math.round(kg))} kg`
}

export function formatSeconds(sec) {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`
}

export function formatSet(set, mode) {
  if (mode === 'time') return formatSeconds(set.sec)
  if (mode === 'reps') return `${set.reps} rip.`
  return isNum(set.kg) ? `${set.reps} × ${formatKg(set.kg)}` : `${set.reps} rip.`
}

// "3 × 10 @ 40 kg" se le serie sono tutte uguali, altrimenti l'elenco.
export function summarizeSets(sets, mode) {
  if (!sets?.length) return '—'
  const first = sets[0]
  const uniform = sets.every(s => s.reps === first.reps && s.kg === first.kg && s.sec === first.sec)
  if (uniform) {
    if (mode === 'time') return `${sets.length} × ${formatSeconds(first.sec)}`
    const base = `${sets.length} × ${first.reps}`
    return mode === 'reps-kg' && isNum(first.kg) ? `${base} @ ${formatKg(first.kg)}` : base
  }
  return sets.map(s => formatSet(s, mode)).join(' · ')
}
