// ── Dominio Corsa ───────────────────────────────────────────
// Dodicesimo modulo puro di src/lib/ (nessun React, nessun Firestore). Contiene
// la tassonomia delle fasi di una scheda di corsa "stile Garmin", i tipi di
// durata, le zone di passo del profilo e le STIME che trasformano una scheda in
// una durata e una distanza — quelle che disegnano il grafico delle fasi.
//
// ── Scheda e sessione sono due cose diverse ──
// La SCHEDA (`runWorkouts`) è la ricetta riutilizzabile: nome + struttura di
// fasi e ripetute. La SESSIONE (`runs`) è la corsa fatta un certo giorno, e
// porta una COPIA della struttura: se domani la scheda passa da 5 a 6 ripetute,
// la corsa di ieri resta quella che è stata davvero.
//
// ── Struttura (`items`) ──
// Un array piatto di fasi e ripetute, a un solo livello (niente ripetute dentro
// ripetute — la stessa scelta dello screenshot Garmin di riferimento):
//   Step   = { kind: 'step', id, stepType, notes, duration, target }
//   Repeat = { kind: 'repeat', id, times, skipLastRecovery, steps: [Step] }
//
// `duration` cambia forma in base al tipo, con l'unità canonica a DB e la
// formattazione solo a display (stessa disciplina di athletics.js):
//   { type: 'time',     sec }
//   { type: 'distance', meters, unit: 'm'|'km' }   (unit serve solo al display)
//   { type: 'calories', kcal }
//   { type: 'hr',       bpm, condition: 'sotto'|'sopra', estimatedSec }
//
// ── Perché la zona è su ogni fase ──
// Il grafico è disegnato sulla durata, ma solo le fasi a tempo la dichiarano.
// Una fase "1 km" dura quanto il passo a cui la corri: la zona (`target`) è ciò
// che traduce distanza ↔ tempo, attraverso la tabella zone → passo del profilo.
// Le fasi a frequenza cardiaca ("fino a quando la FC scende sotto 130") non si
// possono ricavare da nessun passo: per quelle l'utente dà una durata stimata,
// e il grafico le disegna tratteggiate (`rough`).

import { HR_ZONES } from './athletics'

// ── Tipi di fase ───────────────────────────────────────────
// Colori sui token di palette, nessuna tinta nuova: riscaldamento rosso, corsa
// blu, defaticamento verde come nel grafico Garmin; camminata, recupero e
// riposo condividono il grigio (si distinguono per altezza, cioè per zona).
export const STEP_TYPES = [
  { id: 'riscaldamento', label: 'Riscaldamento', color: 'var(--color-loss)',  defaultTarget: 'z1',        defaultSec: 600 },
  { id: 'corsa',         label: 'Corsa',         color: 'var(--color-draw)',  defaultTarget: 'z3',        defaultSec: 300 },
  { id: 'camminata',     label: 'Camminata',     color: 'var(--color-slate)', defaultTarget: 'camminata', defaultSec: 120 },
  { id: 'recupero',      label: 'Recupero',      color: 'var(--color-slate)', defaultTarget: 'camminata', defaultSec: 60 },
  { id: 'riposo',        label: 'Riposo',        color: 'var(--color-slate)', defaultTarget: 'fermo',     defaultSec: 60 },
  { id: 'defaticamento', label: 'Defaticamento', color: 'var(--color-win)',   defaultTarget: 'z1',        defaultSec: 300 },
  { id: 'altro',         label: 'Altro',         color: 'var(--color-amber)', defaultTarget: 'z2',        defaultSec: 300 },
]

export const STEP_TYPES_BY_ID = Object.fromEntries(STEP_TYPES.map(t => [t.id, t]))

export function stepTypeMeta(id) {
  return STEP_TYPES_BY_ID[id] || STEP_TYPES_BY_ID.altro
}

// Tipi di fase che "Salta l'ultima fase di recupero" può saltare alla fine
// dell'ultima iterazione di una ripetuta.
const RECOVERY_TYPES = new Set(['recupero', 'riposo'])

// ── Tipi di durata ─────────────────────────────────────────
export const DURATION_TYPES = [
  { id: 'time',     label: 'Tempo' },
  { id: 'distance', label: 'Distanza' },
  { id: 'calories', label: 'Calorie' },
  { id: 'hr',       label: 'Frequenza cardiaca' },
]

export const HR_CONDITIONS = [
  { id: 'sotto', label: 'Scende sotto', symbol: '<' },
  { id: 'sopra', label: 'Sale sopra',   symbol: '>' },
]

export const DEFAULT_HR_ESTIMATE_SEC = 120

// ── Obiettivi di intensità (zone) ──────────────────────────
// `level` è l'altezza relativa della barra nel grafico (0..1): più la zona è
// alta, più la barra è alta — il grafico dice anche l'intensità, non solo
// quanto dura ogni fase. I nomi delle zone sono gli stessi di HR_ZONES, per non
// avere due vocabolari per le stesse cinque zone nella stessa app.
export const TARGETS = [
  { id: 'fermo',     label: 'Fermo',     name: 'Nessun movimento',  level: 0.16, color: 'var(--color-surface-2)' },
  { id: 'camminata', label: 'Camminata', name: 'Passo di camminata', level: 0.3, color: 'var(--color-slate)' },
  ...HR_ZONES.map((z, i) => ({
    id: `z${z.id}`, label: z.label, name: z.name, zoneIndex: i,
    level: 0.44 + i * 0.14, color: z.color,
  })),
]

export const TARGETS_BY_ID = Object.fromEntries(TARGETS.map(t => [t.id, t]))

export function targetMeta(id) {
  return TARGETS_BY_ID[id] || TARGETS_BY_ID.z2
}

// ── Profilo corsa: zone → passo ────────────────────────────
// Shape persistita in `profile.running`:
//   { zones: [{ fast, slow } × 5], walk: { fast, slow }, weightKg }
// Il passo è in SECONDI AL KM (canonico): `fast` è il passo più veloce del
// range, cioè il numero più piccolo. Z1 è la zona più lenta, Z5 la più veloce.
export const PACE_LIMITS = { min: 120, max: 1200 }       // 2:00 – 20:00 /km, corsa
export const WALK_PACE_LIMITS = { min: 300, max: 1800 }  // 5:00 – 30:00 /km, camminata
export const WEIGHT_LIMITS = { min: 30, max: 250 }

// Default del passo di camminata, precompilato la prima volta che si apre la
// tabella: chi la compila pensa alle zone di corsa, e la camminata è una riga
// che quasi nessuno conosce a memoria.
export const DEFAULT_WALK = { fast: 570, slow: 690 }      // 9:30 – 11:30 /km

// Costo energetico approssimato (kcal per kg per km). La corsa costa ~1 kcal
// per kg per km quasi indipendentemente dalla velocità (ACSM); la camminata a
// passo normale circa la metà. Serve solo a stimare le fasi a calorie, ed è
// dichiarato come stima come tutto il resto del grafico.
export const KCAL_PER_KG_KM = { run: 1.0, walk: 0.5 }

export function emptyRunningProfile() {
  return {
    zones: HR_ZONES.map(() => ({ fast: null, slow: null })),
    walk: { ...DEFAULT_WALK },
    weightKg: null,
  }
}

// Elenco dei problemi della tabella (vuoto = pronta). È anche il gate per
// registrare una corsa: senza zone valide nessuna fase si può tradurre in una
// durata, e il grafico mentirebbe.
export function runningProfileIssues(running) {
  const issues = []
  const zones = running?.zones
  if (!Array.isArray(zones) || zones.length !== HR_ZONES.length) {
    return ['Compila il passo di tutte e 5 le zone.']
  }

  let missing = false
  zones.forEach((z, i) => {
    if (!isNum(z?.fast) || !isNum(z?.slow)) { missing = true; return }
    const label = HR_ZONES[i].label
    if (z.fast < PACE_LIMITS.min || z.slow > PACE_LIMITS.max) {
      issues.push(`${label}: il passo deve stare tra ${formatPace(PACE_LIMITS.min)} e ${formatPace(PACE_LIMITS.max)} /km.`)
    } else if (z.fast >= z.slow) {
      issues.push(`${label}: il passo veloce deve essere minore del passo lento.`)
    }
  })
  if (missing) issues.unshift('Compila il passo di tutte e 5 le zone.')

  // Ordine: ogni zona dev'essere più veloce della precedente (sul punto medio,
  // così due range che si toccano o si sovrappongono di poco restano validi).
  if (!missing) {
    for (let i = 1; i < zones.length; i++) {
      if (mid(zones[i]) >= mid(zones[i - 1])) {
        issues.push(`${HR_ZONES[i].label} deve essere più veloce di ${HR_ZONES[i - 1].label}.`)
      }
    }
  }

  const walk = running?.walk
  if (!isNum(walk?.fast) || !isNum(walk?.slow)) {
    issues.push('Compila il passo di camminata.')
  } else if (walk.fast < WALK_PACE_LIMITS.min || walk.slow > WALK_PACE_LIMITS.max) {
    issues.push(`Camminata: il passo deve stare tra ${formatPace(WALK_PACE_LIMITS.min)} e ${formatPace(WALK_PACE_LIMITS.max)} /km.`)
  } else if (walk.fast >= walk.slow) {
    issues.push('Camminata: il passo veloce deve essere minore del passo lento.')
  } else if (!missing && mid(walk) <= mid(zones[0])) {
    issues.push('La camminata deve essere più lenta di Z1.')
  }

  if (running?.weightKg != null && (!isNum(running.weightKg) || running.weightKg < WEIGHT_LIMITS.min || running.weightKg > WEIGHT_LIMITS.max)) {
    issues.push(`Il peso deve stare tra ${WEIGHT_LIMITS.min} e ${WEIGHT_LIMITS.max} kg.`)
  }

  return issues
}

export function isRunningReady(running) {
  return runningProfileIssues(running).length === 0
}

// Passo di riferimento (s/km) di un obiettivo: il punto medio del range.
// `fermo` non ha passo (null): la fase non percorre distanza.
export function targetPace(targetId, running) {
  if (targetId === 'fermo') return null
  if (targetId === 'camminata') return isNum(running?.walk?.fast) ? mid(running.walk) : null
  const t = TARGETS_BY_ID[targetId]
  const z = t?.zoneIndex != null ? running?.zones?.[t.zoneIndex] : null
  return isNum(z?.fast) && isNum(z?.slow) ? mid(z) : null
}

// Range di passo leggibile per un obiettivo ("5:10–5:40 /km"), o null.
export function targetPaceRange(targetId, running) {
  if (targetId === 'fermo') return null
  const t = TARGETS_BY_ID[targetId]
  const r = targetId === 'camminata' ? running?.walk : running?.zones?.[t?.zoneIndex]
  if (!isNum(r?.fast) || !isNum(r?.slow)) return null
  return `${formatPace(r.fast)}–${formatPace(r.slow)} /km`
}

// ── Costruzione ────────────────────────────────────────────

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export function emptyStep(stepType = 'corsa') {
  const meta = stepTypeMeta(stepType)
  return {
    kind: 'step',
    id: newId(),
    stepType: meta.id,
    notes: '',
    duration: { type: 'time', sec: meta.defaultSec },
    target: meta.defaultTarget,
  }
}

export function emptyRepeat() {
  return {
    kind: 'repeat',
    id: newId(),
    times: 5,
    skipLastRecovery: false,
    steps: [
      { ...emptyStep('corsa'), target: 'z4', duration: { type: 'time', sec: 60 } },
      { ...emptyStep('recupero'), duration: { type: 'time', sec: 60 } },
    ],
  }
}

// Struttura di partenza di una scheda nuova: riscaldamento, corsa,
// defaticamento — lo stesso scheletro che propone Garmin, così si parte
// modificando invece che da una pagina vuota.
export function starterItems() {
  return [
    { ...emptyStep('riscaldamento') },
    { ...emptyStep('corsa'), target: 'z2', duration: { type: 'time', sec: 1200 } },
    { ...emptyStep('defaticamento') },
  ]
}

// Copia profonda con id NUOVI: duplicare una fase o una ripetuta non deve
// produrre due elementi con lo stesso id (l'editor li indirizza per id).
export function cloneItem(item) {
  if (item.kind === 'repeat') {
    return { ...item, id: newId(), steps: item.steps.map(s => ({ ...s, id: newId(), duration: { ...s.duration } })) }
  }
  return { ...item, id: newId(), duration: { ...item.duration } }
}

// ── Validazione di una fase ────────────────────────────────

export const MAX_REPEAT_TIMES = 50
export const MAX_NOTE_LENGTH = 150

// Il problema della fase (stringa) o null. Il wizard non salva finché una fase
// ha un problema: una fase senza durata non si può disegnare né stimare.
export function stepIssue(step, running) {
  const d = step?.duration || {}
  const fermo = step?.target === 'fermo'
  switch (d.type) {
    case 'time':
      return isNum(d.sec) && d.sec > 0 ? null : 'Indica la durata della fase.'
    case 'distance':
      if (fermo) return 'Una fase da fermo non può durare una distanza.'
      return isNum(d.meters) && d.meters > 0 ? null : 'Indica la distanza della fase.'
    case 'calories':
      if (fermo) return 'Una fase da fermo non può durare delle calorie.'
      if (!isNum(running?.weightKg)) return 'Per le fasi a calorie serve il peso nel profilo.'
      return isNum(d.kcal) && d.kcal > 0 ? null : 'Indica le calorie della fase.'
    case 'hr':
      if (!isNum(d.bpm) || d.bpm < 40 || d.bpm > 230) return 'Indica una frequenza cardiaca tra 40 e 230 bpm.'
      return isNum(d.estimatedSec) && d.estimatedSec > 0 ? null : 'Indica una durata stimata per disegnare la fase.'
    default:
      return 'Scegli il tipo di durata.'
  }
}

export function workoutIssues(items, running) {
  const issues = []
  const list = Array.isArray(items) ? items : []
  if (countSteps(list) === 0) issues.push('Aggiungi almeno una fase.')
  list.forEach(item => {
    if (item.kind === 'repeat') {
      if (item.steps.length === 0) issues.push('Una ripetuta non ha fasi.')
      item.steps.forEach(s => { const m = stepIssue(s, running); if (m) issues.push(m) })
    } else {
      const m = stepIssue(item, running)
      if (m) issues.push(m)
    }
  })
  return [...new Set(issues)]
}

export function countSteps(items) {
  return (items || []).reduce((n, it) => n + (it.kind === 'repeat' ? it.steps.length : 1), 0)
}

// ── Normalizzazione (al salvataggio) ───────────────────────
// Ogni fase tiene SOLO i campi del proprio tipo di durata: cambiare tipo
// nell'editor lascia i valori vecchi nel draft (così tornare indietro non li
// perde), ma a DB non devono finire.
export function normalizeItems(items) {
  return (items || [])
    .map(item => {
      if (item.kind === 'repeat') {
        const steps = (item.steps || []).map(normalizeStep)
        if (steps.length === 0) return null
        return {
          kind: 'repeat',
          id: item.id || newId(),
          times: clampInt(item.times, 1, MAX_REPEAT_TIMES) ?? 1,
          skipLastRecovery: Boolean(item.skipLastRecovery),
          steps,
        }
      }
      return normalizeStep(item)
    })
    .filter(Boolean)
}

function normalizeStep(step) {
  const d = step.duration || {}
  let duration
  switch (d.type) {
    case 'distance':
      duration = { type: 'distance', meters: clampInt(d.meters, 1, 100000), unit: d.unit === 'km' ? 'km' : 'm' }
      break
    case 'calories':
      duration = { type: 'calories', kcal: clampInt(d.kcal, 1, 5000) }
      break
    case 'hr':
      duration = {
        type: 'hr',
        bpm: clampInt(d.bpm, 40, 230),
        condition: d.condition === 'sopra' ? 'sopra' : 'sotto',
        estimatedSec: clampInt(d.estimatedSec, 1, 6 * 3600),
      }
      break
    default:
      duration = { type: 'time', sec: clampInt(d.sec, 1, 6 * 3600) }
  }
  return {
    kind: 'step',
    id: step.id || newId(),
    stepType: STEP_TYPES_BY_ID[step.stepType] ? step.stepType : 'altro',
    notes: (step.notes || '').trim().slice(0, MAX_NOTE_LENGTH),
    duration,
    target: TARGETS_BY_ID[step.target] ? step.target : stepTypeMeta(step.stepType).defaultTarget,
  }
}

// Due strutture sono "uguali" se lo sono una volta normalizzate: serve al
// wizard per capire se la scheda di libreria è stata modificata (e proporre di
// aggiornarla). Gli id restano nel confronto: sono copiati dalla scheda.
export function sameItems(a, b) {
  return JSON.stringify(normalizeItems(a)) === JSON.stringify(normalizeItems(b))
}

// ── Espansione e stime ─────────────────────────────────────

// Srotola le ripetute nella sequenza reale di fasi. Con `skipLastRecovery`
// l'ultima iterazione perde la fase finale se è un recupero/riposo: finita
// l'ultima ripetuta si passa direttamente alla fase successiva (è il
// comportamento dell'opzione omonima di Garmin).
export function flattenItems(items) {
  const out = []
  ;(items || []).forEach(item => {
    if (item.kind !== 'repeat') { out.push({ step: item, repeatId: null, iteration: null }); return }
    const times = Math.max(1, item.times || 1)
    for (let it = 0; it < times; it++) {
      item.steps.forEach((s, k) => {
        const last = it === times - 1 && k === item.steps.length - 1
        if (last && item.skipLastRecovery && RECOVERY_TYPES.has(s.stepType) && item.steps.length > 1) return
        out.push({ step: s, repeatId: item.id, iteration: it })
      })
    }
  })
  return out
}

// Stima di una fase: `{ sec, km, secEstimated, kmEstimated, rough }`, oppure
// null se la fase non è stimabile (profilo incompleto, fase non valida).
//  · secEstimated/kmEstimated: il valore non è quello dichiarato, è ricavato
//  · rough: la durata viene da una stima dell'utente, non dal passo (fasi a FC)
export function estimateStep(step, running) {
  const d = step?.duration || {}
  const pace = targetPace(step?.target, running)          // s/km, null se fermo
  const fermo = step?.target === 'fermo'
  if (!fermo && pace == null) return null

  switch (d.type) {
    case 'time': {
      if (!isNum(d.sec) || d.sec <= 0) return null
      return { sec: d.sec, km: fermo ? 0 : d.sec / pace, secEstimated: false, kmEstimated: !fermo, rough: false }
    }
    case 'distance': {
      if (fermo || !isNum(d.meters) || d.meters <= 0) return null
      const km = d.meters / 1000
      return { sec: km * pace, km, secEstimated: true, kmEstimated: false, rough: false }
    }
    case 'calories': {
      if (fermo || !isNum(d.kcal) || d.kcal <= 0 || !isNum(running?.weightKg)) return null
      const cost = step.target === 'camminata' ? KCAL_PER_KG_KM.walk : KCAL_PER_KG_KM.run
      const km = d.kcal / (running.weightKg * cost)
      return { sec: km * pace, km, secEstimated: true, kmEstimated: true, rough: false }
    }
    case 'hr': {
      if (!isNum(d.estimatedSec) || d.estimatedSec <= 0) return null
      return { sec: d.estimatedSec, km: fermo ? 0 : d.estimatedSec / pace, secEstimated: true, kmEstimated: !fermo, rough: true }
    }
    default:
      return null
  }
}

// Totali della scheda + i segmenti del grafico, nella sequenza reale (ripetute
// srotolate). Le fasi non stimabili restano fuori dai totali ma sono contate in
// `unknown`, così la UI può dichiararle invece di sottostimare in silenzio.
export function workoutTotals(items, running) {
  const segments = []
  let sec = 0, km = 0, unknown = 0
  let secEstimated = false, kmEstimated = false, rough = false

  flattenItems(items).forEach(({ step, repeatId }) => {
    const e = estimateStep(step, running)
    if (!e) { unknown++; return }
    sec += e.sec
    km += e.km
    secEstimated = secEstimated || e.secEstimated
    kmEstimated = kmEstimated || e.kmEstimated
    rough = rough || e.rough
    segments.push({
      stepId: step.id, repeatId,
      stepType: step.stepType, target: step.target,
      sec: e.sec, km: e.km, rough: e.rough,
    })
  })

  return { sec, km, secEstimated, kmEstimated, rough, unknown, segments }
}

// Durata della sessione eseguita, in minuti: il dato reale dell'orologio se
// c'è, altrimenti la stima della scheda (flag `estimated`, da dichiarare col
// prefisso "~" come le ore stimate delle partite).
export function runMinutes(run, running) {
  const real = run?.athletics?.durationSec
  if (isNum(real) && real > 0) return { minutes: real / 60, estimated: false }
  const t = workoutTotals(run?.items, running)
  return { minutes: t.sec / 60, estimated: true }
}

// Nome da mostrare per una sessione: quello attuale della scheda se esiste
// ancora, altrimenti quello copiato al salvataggio. Così una rinomina della
// scheda non ha niente da propagare sulle sessioni.
export function runDisplayName(run, workouts = []) {
  const w = run?.workoutId ? workouts.find(x => x.id === run.workoutId) : null
  return w?.name || run?.workoutName || 'Corsa'
}

// Uso delle schede ricavato dalle sessioni (quante volte, l'ultima quando):
// non è un campo della scheda, per la stessa ragione per cui il record H2H non
// è un campo dell'avversario.
export function workoutUsage(runs = []) {
  const usage = {}
  runs.forEach(r => {
    if (!r.workoutId) return
    const u = usage[r.workoutId] || (usage[r.workoutId] = { count: 0, lastDate: null })
    u.count++
    if (!u.lastDate || r.date > u.lastDate) u.lastDate = r.date
  })
  return usage
}

// Schede ordinate per ultimo uso (le mai usate in fondo, per nome).
export function sortWorkoutsByUse(workouts = [], runs = []) {
  const usage = workoutUsage(runs)
  return [...workouts].sort((a, b) => {
    const la = usage[a.id]?.lastDate || ''
    const lb = usage[b.id]?.lastDate || ''
    if (la !== lb) return la < lb ? 1 : -1
    return (a.name || '').localeCompare(b.name || '')
  })
}

// ── Passo: parsing e formattazione ─────────────────────────

// Accetta "5:30", "5.30", "5,30" (il tastierino decimale di iOS non ha i due
// punti) e "530" → 330 s/km. Ritorna null se non è un passo leggibile.
export function parsePace(str) {
  if (str === null || str === undefined) return null
  const s = String(str).trim()
  if (!s) return null
  let m, sec
  const parts = s.split(/[:.,]/)
  if (parts.length === 2) {
    m = Number(parts[0])
    sec = parts[1].length === 1 ? Number(parts[1]) * 10 : Number(parts[1])
  } else if (/^\d{3,4}$/.test(s)) {
    m = Number(s.slice(0, -2))
    sec = Number(s.slice(-2))
  } else if (/^\d{1,2}$/.test(s)) {
    m = Number(s)
    sec = 0
  } else {
    return null
  }
  if (!Number.isInteger(m) || !Number.isInteger(sec) || sec > 59 || m < 0) return null
  const total = m * 60 + sec
  return total > 0 ? total : null
}

// 330 → "5:30"
export function formatPace(sec) {
  if (!isNum(sec) || sec <= 0) return '—'
  const total = Math.round(sec)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Passo medio reale (s/km) da distanza e durata dell'orologio.
export function avgPaceSec(athletics) {
  const km = athletics?.distanceKm
  const sec = athletics?.durationSec
  if (!isNum(km) || !isNum(sec) || km <= 0 || sec <= 0) return null
  return sec / km
}

// ── Formattazione di fasi e totali ─────────────────────────

// "0:15", "10:00", "1:05:00" — come la lista fasi Garmin.
export function formatStepTime(sec) {
  if (!isNum(sec)) return '—'
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatKm(km, decimals = 1) {
  if (!isNum(km)) return '—'
  return `${km.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} km`
}

export function formatMeters(meters, unit = 'm') {
  if (!isNum(meters)) return '—'
  if (unit === 'km' || meters >= 1000) return formatKm(meters / 1000, meters % 100 === 0 ? 1 : 2)
  return `${Math.round(meters)} m`
}

// Il valore "dichiarato" della fase, la seconda riga delle card.
export function formatStepDuration(duration) {
  const d = duration || {}
  switch (d.type) {
    case 'time':     return formatStepTime(d.sec)
    case 'distance': return formatMeters(d.meters, d.unit)
    case 'calories': return isNum(d.kcal) ? `${Math.round(d.kcal)} kcal` : '—'
    case 'hr': {
      const c = HR_CONDITIONS.find(x => x.id === d.condition) || HR_CONDITIONS[0]
      return isNum(d.bpm) ? `Fino a FC ${c.symbol} ${Math.round(d.bpm)} bpm` : '—'
    }
    default: return '—'
  }
}

// La riga di stima sotto il valore dichiarato: si mostra la grandezza che la
// fase NON dichiara (una fase a tempo ha la distanza stimata e viceversa).
export function formatStepEstimate(step, running) {
  const e = estimateStep(step, running)
  if (!e) return null
  const type = step.duration?.type
  if (type === 'time') return e.km > 0 ? `St. Distanza: ${formatKm(e.km)}` : null
  if (type === 'distance') return `St. Tempo: ${formatStepTime(e.sec)}`
  if (type === 'calories') return `St. ${formatStepTime(e.sec)} · ${formatKm(e.km)}`
  if (type === 'hr') return `Stima: ${formatStepTime(e.sec)}${e.km > 0 ? ` · ${formatKm(e.km)}` : ''}`
  return null
}

// "Z3 · Aerobica" — con il range di passo quando c'è.
export function formatTarget(targetId, running) {
  const t = targetMeta(targetId)
  const range = targetPaceRange(targetId, running)
  const head = t.zoneIndex != null ? `${t.label} · ${t.name}` : t.label
  return range ? `${head} · ${range}` : head
}

// ── Helpers ────────────────────────────────────────────────

function mid(r) {
  return (r.fast + r.slow) / 2
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function clampInt(v, min, max) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(Math.min(max, Math.max(min, n)))
}
