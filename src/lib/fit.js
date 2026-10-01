// ── Import dei file .FIT di Garmin ──────────────────────────
// Modulo puro (nessun React, nessun Firestore, nessuna dipendenza): prende i
// MESSAGGI già decodificati dall'SDK Garmin (vedi fitFile.js, che si occupa di
// leggere il file e caricare l'SDK) e ne ricava ciò che l'app salva.
//
// ── Cosa si legge e cosa no ──
// Solo i messaggi DOCUMENTATI del profilo FIT. I messaggi `unknown_*` sono
// proprietari Garmin e cambiano tra firmware senza preavviso: non si usano.
// Il file originale non viene salvato: restano il riassunto (`athletics`) e i
// dettagli sottocampionati (`details`, in users/{uid}/fitDetails/{fitId}).
//
// ── Cosa NON si salva, di proposito ──
//  · il GPS del tennis: 3-5 m di precisione su un campo largo 11 m non è un
//    dato, è un'illusione. La traccia si tiene solo per la corsa;
//  · serie, ripetizioni e pesi della palestra: a comandare è la scheda;
//  · il file grezzo: un documento Firestore non supera 1 MiB.
//
// ── Unità (convertite una volta sola, qui) ──
//  · tempo in secondi interi, distanza in km (metri nei lap), velocità in m/s
//    dal file → km/h a DB (serie in 0,1 km/h), altitudine in 0,1 m;
//  · cadenza di corsa: il file dà i passi di UN piede al minuto, a DB passi
//    totali (spm = ×2);
//  · coordinate: gradi × 1e5 interi (~1 m), dai semicerchi del file;
//  · lunghezza del passo mm → m, oscillazione verticale mm → cm.

import { HR_ZONES, readZones } from './athletics'

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31)   // 1989-12-31T00:00:00Z
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31

export const MAX_SERIES_POINTS = 500
export const MAX_ROUTE_POINTS = 300
export const MIN_SERIES_STEP_SEC = 5
const MAX_CHART_PACE = 720   // 12:00 /km: oltre è una camminata, e allungherebbe la scala del grafico

// ── Tipo di sessione ───────────────────────────────────────

// Lo sport del file → il tipo di sessione dell'app.
export function fitKind(sport) {
  if (sport === 'tennis') return 'tennis'
  if (sport === 'running') return 'running'
  if (sport === 'training') return 'gym'
  return 'other'
}

export const KIND_LABELS = {
  tennis: 'tennis',
  running: 'corsa',
  gym: 'palestra / allenamento in sala',
  other: 'un altro sport',
}

// Un file di tennis non entra in una corsa e viceversa: si segnala, non si
// accetta in silenzio. `expected` è 'tennis' | 'running' | 'gym'.
export function sportMismatch(summary, expected) {
  if (!summary || summary.kind === expected) return null
  return `Questo file è un'attività di ${KIND_LABELS[summary.kind]}, ma stai registrando ${EXPECTED_LABELS[expected]}.`
}

const EXPECTED_LABELS = {
  tennis: 'una sessione di tennis',
  running: 'una corsa',
  gym: 'una sessione di palestra',
}

// ── Riassunto ──────────────────────────────────────────────

// Punto d'ingresso: messaggi decodificati → riassunto pronto per l'app, oppure
// lancia un Error con un testo leggibile se il file non è un'attività.
export function summarizeFit(messages) {
  const session = messages?.sessionMesgs?.[0]
  if (!session) throw new Error('Il file non contiene una sessione di attività.')

  const fileId = messages.fileIdMesgs?.[0]
  if (fileId?.type && fileId.type !== 'activity') {
    throw new Error('Il file non è un\'attività (è un file FIT di un altro tipo).')
  }

  const kind = fitKind(session.sport)
  const start = toDate(session.startTime) || toDate(messages.activityMesgs?.[0]?.timestamp)
  if (!start) throw new Error('Il file non riporta quando è iniziata l\'attività.')

  const durationSec = intOrNull(session.totalTimerTime ?? session.totalElapsedTime)
  const zonesMsg = (messages.timeInZoneMesgs || []).find(m => m.referenceMesg === 'session')
  const local = localStart(start, messages.activityMesgs?.[0])
  const fitId = buildFitId(fileId, start)

  const athletics = {
    distanceKm:   positive(session.totalDistance) ? round(session.totalDistance / 1000, 2) : null,
    durationSec,
    calories:     positive(session.totalCalories) ? Math.round(session.totalCalories) : null,
    avgHr:        positive(session.avgHeartRate) ? Math.round(session.avgHeartRate) : null,
    maxHr:        positive(session.maxHeartRate) ? Math.round(session.maxHeartRate) : null,
    trainingEffect:          isNum(session.totalTrainingEffect) ? session.totalTrainingEffect : null,
    anaerobicTrainingEffect: isNum(session.totalAnaerobicTrainingEffect) ? session.totalAnaerobicTrainingEffect : null,
    zones:        zonesFromMessage(zonesMsg),
    hrBounds:     boundsFromMessage(zonesMsg),
    trainingLoad: positive(session.trainingLoadPeak) ? round(session.trainingLoadPeak, 1) : null,
    maxSpeedKmh:  positive(speedOf(session, 'max')) ? round(speedOf(session, 'max') * 3.6, 1) : null,
    ascentM:      kind === 'running' && isNum(session.totalAscent) ? Math.round(session.totalAscent) : null,
    descentM:     kind === 'running' && isNum(session.totalDescent) ? Math.round(session.totalDescent) : null,
    dynamics:     kind === 'running' ? runDynamics(session) : null,
    source: 'fit',
    fitId,
  }

  const records = messages.recordMesgs || []
  const step = seriesStep(durationSec)
  const laps = kind === 'running' ? lapsFromMessages(messages.lapMesgs) : []

  const details = {
    fitId,
    kind,
    sport: session.sport || null,
    subSport: session.subSport || null,
    startUtc: start.toISOString(),
    localDate: local.date,
    device: messages.fileIdMesgs?.[0]?.garminProduct || null,
    step,
    series: buildSeries(records, start.getTime(), durationSec, step, kind),
    laps,
    route: kind === 'running' ? buildRoute(records) : null,
  }

  return {
    fitId,
    kind,
    sport: session.sport || null,
    subSport: session.subSport || null,
    startUtc: start.toISOString(),
    localDate: local.date,
    localTime: local.time,
    athletics,
    details,
    workout: kind === 'running' ? workoutFromMessages(messages) : null,
    // RPE dichiarato sull'orologio a fine corsa, in decimi (30 = 3/10).
    rpe: isNum(session.workoutRpe) ? session.workoutRpe / 10 : null,
  }
}

// Identità del file: numero di serie del dispositivo + istante di creazione.
// È deterministica, quindi serve da id del documento dei dettagli e da guardia
// contro il doppio import.
function buildFitId(fileId, start) {
  const serial = fileId?.serialNumber
  const created = toDate(fileId?.timeCreated) || start
  return `${serial ?? 'x'}_${Math.floor(created.getTime() / 1000)}`
}

// Data e ora LOCALI di inizio. Il file dà l'ora UTC (`timestamp`) e l'ora
// locale (`local_timestamp`) della stessa istante: la differenza è il fuso.
function localStart(start, activity) {
  const ts = toDate(activity?.timestamp)
  let offsetSec = 0
  if (ts && isNum(activity?.localTimestamp)) {
    const raw = activity.localTimestamp - (ts.getTime() - FIT_EPOCH_MS) / 1000
    offsetSec = Math.round(raw / 900) * 900   // i fusi orari sono multipli di 15 minuti
  }
  const d = new Date(start.getTime() + offsetSec * 1000)
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

// 7 secondi interi (sotto Z1, Z1…Z5, sopra Z5), oppure null.
function zonesFromMessage(msg) {
  const t = msg?.timeInHrZone
  if (!Array.isArray(t) || t.length === 0) return null
  const zones = readZones(HR_ZONES.map((_, i) => (isNum(t[i]) ? Math.round(t[i]) : 0)))
  return zones.some(v => v > 0) ? zones : null
}

function boundsFromMessage(msg) {
  const b = msg?.hrZoneHighBoundary
  if (!Array.isArray(b) || b.length < 6) return null
  const out = b.slice(0, 6).map(v => (isNum(v) ? Math.round(v) : null))
  return out.every(v => v !== null && v > 0) ? out : null
}

function runDynamics(s) {
  const out = {
    avgPowerW:    positive(s.avgPower) ? s.avgPower : null,
    maxPowerW:    positive(s.maxPower) ? s.maxPower : null,
    normPowerW:   positive(s.normalizedPower) ? s.normalizedPower : null,
    // Il file dà i passi di un piede: la cadenza di corsa è il doppio.
    cadenceSpm:   positive(s.avgRunningCadence ?? s.avgCadence) ? (s.avgRunningCadence ?? s.avgCadence) * 2 : null,
    strideM:      positive(s.avgStepLength) ? s.avgStepLength / 1000 : null,
    vertOscCm:    positive(s.avgVerticalOscillation) ? s.avgVerticalOscillation / 10 : null,
    contactMs:    positive(s.avgStanceTime) ? s.avgStanceTime : null,
    vertRatioPct: positive(s.avgVerticalRatio) ? s.avgVerticalRatio : null,
  }
  return Object.values(out).some(v => v !== null) ? out : null
}

// ── Serie temporali ────────────────────────────────────────
// Sottocampionate: un campione ogni `step` secondi, mai più di MAX_SERIES_POINTS
// punti per serie (un documento Firestore non supera 1 MiB e ogni elemento di un
// array pesa sugli indici). Ogni serie è un array di interi allineato nel tempo
// (campione i = secondo i × step); un buco è `null`.

export function seriesStep(durationSec) {
  const d = isNum(durationSec) && durationSec > 0 ? durationSec : 0
  return Math.max(MIN_SERIES_STEP_SEC, Math.ceil(d / MAX_SERIES_POINTS / 5) * 5)
}

export function buildSeries(records, startMs, durationSec, step, kind) {
  const n = isNum(durationSec) && durationSec > 0 ? Math.floor(durationSec / step) + 1 : 0
  if (n === 0) return {}

  const defs = {
    hr:    { pick: r => r.heartRate, scale: 1 },
    speed: { pick: r => speedOf(r), scale: 3.6 * 10 },           // m/s → 0,1 km/h
    alt:   { pick: r => r.enhancedAltitude ?? r.altitude, scale: 10 }, // m → 0,1 m
    power: { pick: r => r.power, scale: 1 },
  }
  // La cadenza è significativa solo nella corsa: nel tennis sono passi con
  // molte pause e non si legge come in una corsa.
  if (kind === 'running') defs.cad = { pick: r => r.cadence, scale: 2 }

  const sums = {}, counts = {}
  Object.keys(defs).forEach(k => { sums[k] = new Float64Array(n); counts[k] = new Uint16Array(n) })

  records.forEach(r => {
    const ts = toDate(r.timestamp)
    if (!ts) return
    const i = Math.floor((ts.getTime() - startMs) / 1000 / step)
    if (i < 0 || i >= n) return
    Object.entries(defs).forEach(([k, def]) => {
      const v = def.pick(r)
      if (!isNum(v)) return
      sums[k][i] += v
      counts[k][i]++
    })
  })

  const series = {}
  Object.entries(defs).forEach(([k, def]) => {
    const arr = Array.from({ length: n }, (_, i) => (counts[k][i] ? Math.round((sums[k][i] / counts[k][i]) * def.scale) : null))
    // Una serie senza nemmeno un valore non si salva.
    if (arr.some(v => v !== null && v !== 0) || (k === 'hr' && arr.some(v => v !== null))) series[k] = trimTail(arr)
  })
  return series
}

function trimTail(arr) {
  let end = arr.length
  while (end > 0 && arr[end - 1] === null) end--
  return arr.slice(0, end)
}

// Traccia GPS della corsa: coordinate in gradi × 1e5, ≤ MAX_ROUTE_POINTS punti.
export function buildRoute(records) {
  const pts = records.filter(r => isNum(r.positionLat) && isNum(r.positionLong))
  if (pts.length < 2) return null
  const stride = Math.max(1, Math.ceil(pts.length / MAX_ROUTE_POINTS))
  const lat = [], lon = []
  pts.forEach((r, i) => {
    if (i % stride !== 0 && i !== pts.length - 1) return
    lat.push(Math.round(r.positionLat * SEMICIRCLE_TO_DEG * 1e5))
    lon.push(Math.round(r.positionLong * SEMICIRCLE_TO_DEG * 1e5))
  })
  return { lat, lon }
}

// Serie velocità (0,1 km/h) → passo in s/km per il grafico; fermo o troppo
// lento (sotto 2,5 km/h) → null, un buco nella linea e non un passo di 24 min/km;
// le camminate si appiattiscono a 12:00 /km perché non dilatino la scala.
export function paceSeries(speed) {
  return (speed || []).map(v => (typeof v === 'number' && v >= 25 ? Math.min(MAX_CHART_PACE, Math.round(3600 / (v / 10))) : null))
}

// ── Lap (corsa) ────────────────────────────────────────────
// Un lap per fase eseguita: `step` è l'indice dello step della scheda del file
// (`wkt_step_index`), null per i lap fuori scheda (es. il pezzetto dopo la
// fine). Chiavi compatte: sono decine di righe.
export function lapsFromMessages(lapMesgs) {
  return (lapMesgs || []).map(l => ({
    step:   Number.isInteger(l.wktStepIndex) ? l.wktStepIndex : null,
    kind:   l.intensity || null,
    sec:    round(l.totalTimerTime ?? l.totalElapsedTime, 1),
    m:      round(l.totalDistance, 1),
    hr:     intOrNull(l.avgHeartRate),
    hrMax:  intOrNull(l.maxHeartRate),
    kmh:    positive(speedOf(l)) ? round(speedOf(l) * 3.6, 2) : null,
    power:  positive(l.avgPower) ? Math.round(l.avgPower) : null,
    cad:    positive(l.avgRunningCadence ?? l.avgCadence) ? Math.round((l.avgRunningCadence ?? l.avgCadence) * 2) : null,
  })).filter(l => isNum(l.sec) && l.sec > 0)
}

// Passo del lap in s/km, o null se fermo.
export function lapPaceSec(lap) {
  if (!lap || !isNum(lap.m) || !isNum(lap.sec) || lap.m < 5 || lap.sec <= 0) return null
  return lap.sec / (lap.m / 1000)
}

// ── Scheda eseguita (corsa) ────────────────────────────────
// Gli step del file in forma neutra, ripetute comprese.
//   { index, intensity, durationType, sec|meters|kcal|bpm, hrZone, notes, walk }
//   { repeat: true, index, from, times }
export function workoutFromMessages(messages) {
  const steps = messages?.workoutStepMesgs
  if (!Array.isArray(steps) || steps.length === 0) return null
  const name = (messages.workoutMesgs?.[0]?.wktName || '').trim()
  const list = steps.map((s, i) => {
    const index = isNum(s.messageIndex) ? s.messageIndex : i
    if (s.durationType === 'repeatUntilStepsCmplt') {
      return { repeat: true, index, from: s.durationStep ?? s.durationValue, times: s.repeatSteps ?? s.targetValue }
    }
    const out = {
      index,
      intensity: s.intensity || null,
      durationType: s.durationType || null,
      notes: typeof s.notes === 'string' ? s.notes.trim() : '',
      // "Camminata" è un recupero con esercizio run/1 (vedi exercise_title).
      walk: s.exerciseCategory === 'run' && s.exerciseName === 1,
      hrZone: s.targetType === 'heartRate' ? hrZoneOfTarget(s) : null,
    }
    switch (s.durationType) {
      case 'time':
        out.sec = s.durationTime ?? (isNum(s.durationValue) ? s.durationValue / 1000 : null)
        break
      case 'distance':
        out.meters = s.durationDistance ?? (isNum(s.durationValue) ? s.durationValue / 100 : null)
        break
      case 'calories':
        out.kcal = s.durationCalories ?? s.durationValue ?? null
        break
      case 'hrLessThan':
      case 'hrGreaterThan': {
        const v = s.durationHr ?? s.durationValue
        out.bpm = isNum(v) ? v : null
        out.bpmCondition = s.durationType === 'hrLessThan' ? 'sotto' : 'sopra'
        break
      }
    }
    return out
  })
  return { name, steps: list }
}

// Zona FC 1…5 di un target "frequenza cardiaca": il valore sta nel campo
// target_hr_zone (1…5); sopra 100 sarebbe una FC in bpm (+100), che non è una
// zona e si ignora.
function hrZoneOfTarget(s) {
  const z = s.targetHrZone ?? s.targetValue
  return Number.isInteger(z) && z >= 1 && z <= 5 ? z : null
}

const STEP_TYPE_BY_INTENSITY = {
  warmup: 'riscaldamento', cooldown: 'defaticamento', active: 'corsa',
  interval: 'corsa', rest: 'riposo', recovery: 'recupero',
}

// Le fasi del file → `items` dell'app (stessa shape di running.js), un solo
// livello di ripetute. `laps` serve a dare una durata alle fasi "open" (che
// finiscono quando si preme lap) e a dedurre la zona dal passo reale;
// `running` è il profilo (tabella zone → passo). Ogni fase porta `fitStep`,
// l'indice dello step del file: collega la fase ai suoi lap per il confronto
// pianificato contro reale.
export function itemsFromWorkout(workout, laps = [], running = null, maxHr = null) {
  const steps = workout?.steps || []
  const nodes = []
  let unsupported = false

  steps.forEach(s => {
    if (!s.repeat) { nodes.push({ kind: 'step', fit: s }); return }
    // Il blocco da ripetere: gli ultimi nodi che iniziano dallo step `from`.
    let startAt = nodes.length
    while (startAt > 0 && nodeStartIndex(nodes[startAt - 1]) >= s.from) startAt--
    const body = nodes.splice(startAt)
    const flat = []
    body.forEach(n => {
      if (n.kind === 'step') { flat.push(n.fit); return }
      // Ripetuta dentro una ripetuta: il modello ha un solo livello, quindi
      // l'interna si srotola.
      unsupported = true
      for (let k = 0; k < n.times; k++) flat.push(...n.steps)
    })
    nodes.push({ kind: 'repeat', from: s.from, times: Math.max(1, s.times || 1), steps: flat })
  })

  const convert = (fit) => {
    const real = laps.filter(l => l.step === fit.index)
    const type = stepTypeOf(fit)
    return {
      kind: 'step',
      id: newLocalId(),
      stepType: type,
      notes: fit.notes || '',
      duration: durationOf(fit, real, maxHr),
      target: targetOf(fit, type, real, running),
      fitStep: fit.index,
    }
  }

  const items = nodes.map(n => {
    if (n.kind === 'step') return convert(n.fit)
    return {
      kind: 'repeat', id: newLocalId(), times: n.times, skipLastRecovery: false,
      steps: n.steps.map(convert),
    }
  })
  return { items, unsupported }
}

function nodeStartIndex(n) {
  return n.kind === 'step' ? n.fit.index : n.from
}

function stepTypeOf(fit) {
  if (fit.intensity === 'recovery' && fit.walk) return 'camminata'
  return STEP_TYPE_BY_INTENSITY[fit.intensity] || 'altro'
}

function durationOf(fit, real, maxHr) {
  const realSec = real.length ? Math.round(real.reduce((s, l) => s + l.sec, 0) / real.length) : null
  switch (fit.durationType) {
    case 'time':
      if (isNum(fit.sec) && fit.sec > 0) return { type: 'time', sec: Math.round(fit.sec) }
      break
    case 'distance':
      if (isNum(fit.meters) && fit.meters > 0) {
        const m = Math.round(fit.meters)
        return { type: 'distance', meters: m, unit: m >= 1000 && m % 100 === 0 ? 'km' : 'm' }
      }
      break
    case 'calories':
      if (isNum(fit.kcal) && fit.kcal > 0) return { type: 'calories', kcal: Math.round(fit.kcal) }
      break
    case 'hrLessThan':
    case 'hrGreaterThan': {
      // Sotto o uguale a 100 il file intende una percentuale della FC massima.
      let bpm = fit.bpm
      if (isNum(bpm) && bpm <= 100 && isNum(maxHr)) bpm = Math.round((bpm / 100) * maxHr)
      else if (isNum(bpm) && bpm > 100) bpm -= 100
      if (isNum(bpm) && bpm >= 40 && bpm <= 230) {
        return { type: 'hr', bpm, condition: fit.bpmCondition, estimatedSec: realSec || 120 }
      }
      break
    }
  }
  // "Open" (fine con il tasto lap) e tutto ciò che il modello non ha: il tempo
  // realmente impiegato è l'unica durata onesta.
  return { type: 'time', sec: realSec || 60 }
}

// Zona della fase: il target a zona FC del file se c'è, altrimenti la zona il
// cui passo di riferimento è più vicino al passo realmente tenuto (se il
// profilo ha la tabella), altrimenti il default del tipo di fase.
function targetOf(fit, type, real, running) {
  if (fit.hrZone) return `z${fit.hrZone}`
  if (type === 'riposo') return 'fermo'
  if (type === 'camminata') return 'camminata'
  const meters = real.reduce((s, l) => s + (l.m || 0), 0)
  const sec = real.reduce((s, l) => s + (l.sec || 0), 0)
  if (meters >= 5 && sec > 0) {
    const pace = sec / (meters / 1000)
    // Più lento della camminata più veloce del profilo: è una camminata, anche
    // se il file la chiama recupero o corsa.
    if (isNum(running?.walk?.fast) && pace >= running.walk.fast) return 'camminata'
    const zone = zoneForPace(pace, running)
    if (zone !== null) return `z${zone}`
  }
  return DEFAULT_TARGETS[type] || 'z2'
}

// La zona (0…6) il cui passo di riferimento — il punto medio del range del
// profilo — è più vicino a `pace` (s/km), oppure null senza tabella.
export function zoneForPace(pace, running) {
  const zones = running?.zones
  if (!isNum(pace) || !Array.isArray(zones) || zones.length !== HR_ZONES.length) return null
  let best = null, bestDiff = Infinity
  zones.forEach((z, i) => {
    if (!isNum(z?.fast) || !isNum(z?.slow)) return
    const diff = Math.abs(pace - (z.fast + z.slow) / 2)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

// Gli stessi default di STEP_TYPES in running.js (non importato: serve solo
// per le fasi senza passo da cui dedurre la zona).
const DEFAULT_TARGETS = {
  riscaldamento: 'z1', corsa: 'z3', recupero: 'camminata',
  defaticamento: 'z1', altro: 'z2',
}

function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

// Intensità percepita dichiarata sull'orologio (RPE 1-10) → la scala a tre
// livelli dell'app.
export function intensityFromRpe(rpe) {
  if (!isNum(rpe) || rpe <= 0) return null
  if (rpe <= 3) return 'leggera'
  if (rpe <= 6) return 'media'
  return 'intensa'
}

// ── Confronto pianificato contro reale ─────────────────────

// Per ogni fase della sequenza srotolata (ripetute comprese) il lap che la
// descrive. Si abbina per indice dello step del file e numero d'ordine: la
// terza volta che compare lo step 3 è il terzo lap con `step === 3`. Le fasi
// senza `fitStep` (aggiunte a mano) non hanno lap. `flat` è l'output di
// `flattenItems` di running.js.
export function matchLaps(flat, laps) {
  const seen = {}
  return flat.map(({ step }) => {
    if (!Number.isInteger(step.fitStep)) return { lap: null }
    const all = laps.filter(l => l.step === step.fitStep)
    const k = seen[step.fitStep] || 0
    seen[step.fitStep] = k + 1
    return { lap: all[k] || null }
  })
}

// ── Helpers ────────────────────────────────────────────────

function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (isNum(v)) return new Date(FIT_EPOCH_MS + v * 1000)
  return null
}

// Velocità media/massima: i campi "enhanced" (più precisi) quando ci sono.
function speedOf(o, which = 'avg') {
  if (which === 'max') return o.enhancedMaxSpeed ?? o.maxSpeed
  return o.enhancedSpeed ?? o.enhancedAvgSpeed ?? o.speed ?? o.avgSpeed
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function positive(v) {
  return isNum(v) && v > 0
}

function intOrNull(v) {
  return isNum(v) ? Math.round(v) : null
}

function round(v, d) {
  if (!isNum(v)) return null
  const f = 10 ** d
  return Math.round(v * f) / f
}
