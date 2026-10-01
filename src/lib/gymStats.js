// ── Statistiche: palestra ───────────────────────────────────
// Modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa linea
// di activity.js / technique.js / physical.js. Risponde a "cosa alleno in
// palestra, e sto progredendo?": volume, muscoli allenati (il manichino sul
// periodo), muscoli trascurati, bilancio spinta/trazione, progressione dei
// carichi, record battuti, costanza e — solo dove ci sono — i dati
// dell'orologio, distinguendo quelli misurati dal file .FIT da quelli trascritti.
//
// ── L'unità è la SERIA ──
// Come il minuto per Attività e il battito per Fisico: qui tutto nasce dalle
// serie della scheda. Un muscolo pesa 1 per serie se è primario nell'esercizio
// e 0,5 se è secondario (`muscleScores` in gym.js) — le "serie equivalenti".
//
// ── Scala ASSOLUTA anche sul periodo ──
// Sul periodo il manichino non guarda il totale ma la MEDIA SETTIMANALE: il
// rosso pieno sono `WEEK_FULL_SETS` serie equivalenti a settimana. Così 90
// giorni e 12 mesi si leggono con lo stesso colore, e una settimana leggera non
// sembra un'altra cosa da un mese pesante. Le settimane si contano dall'inizio
// del periodo, ma non prima della PRIMA sessione in assoluto: chi ha iniziato
// da tre settimane non deve vedersi diluire la media da nove settimane di nulla.
//
// ── Cosa segue il periodo e cosa è "adesso" ──
// Volume, manichino di periodo, bilancio e progressione seguono il periodo
// scelto in pagina. Muscoli trascurati e "ultimi 7 giorni" sono fatti del
// PRESENTE (stessa logica di ACWR in activity.js): si calcolano sull'intero
// storico rispetto a oggi.

import {
  MUSCLES, MOVEMENTS, resolveExercise, muscleScores, sumScores, estimate1RM, heatOf,
  workoutTotals, PRIMARY_WEIGHT, SECONDARY_WEIGHT, WEEK_FULL_SETS, REST_SEC,
} from './gym'
import { dayTime } from './stats'
import { readZones, zonesTotalSec } from './athletics'
import { consistency, LOAD_RPE, DEFAULT_RPE } from './activity'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_GYM         = 3   // sessioni nel periodo, per aprire la sezione
export const MIN_GYM_PREV    = 3   // sessioni nel periodo precedente, per il delta
export const MIN_PROGRESS    = 3   // sessioni di un esercizio, per la sua progressione
export const MIN_BALANCE_SETS = 20 // serie nel periodo, per il bilancio spinta/trazione
export const MIN_NEGLECT_SESSIONS = 6 // sessioni totali, per parlare di trascuratezza
export const NEGLECT_DAYS    = 21  // giorni senza allenare un muscolo per segnalarlo
export const TRAINED_POINTS  = 2   // serie equivalenti in una sessione per dire "allenato"
export const MIN_WATCH       = 3   // sessioni con l'orologio, per le medie
export const CHART_WEEKS     = 16  // settimane massime nel grafico del volume
export const MIN_REPS_SETS   = 20  // serie con ripetizioni, per il mix delle fasce
export const MIN_ZONES_GYM   = 3   // sessioni con le zone FC, per la loro distribuzione
export const MIN_DENSITY     = 3   // sessioni con la durata reale, per il riposo medio
export const STALE_DAYS      = 14  // giorni senza allenarsi per segnalarlo
export const MAX_RECORDS     = 6   // record mostrati

// Fasce di ripetizioni: il numero di ripetizioni di una serie orienta lo
// stimolo (forza, ipertrofia, resistenza muscolare). I confini sono quelli di
// uso comune in letteratura; non sono un obiettivo, un riferimento.
export const REP_BANDS = [
  { id: 'forza',      label: 'Forza',       hint: '1-5 ripetizioni',   test: r => r <= 5 },
  { id: 'ipertrofia', label: 'Ipertrofia',  hint: '6-12 ripetizioni',  test: r => r >= 6 && r <= 12 },
  { id: 'resistenza', label: 'Resistenza',  hint: '13+ ripetizioni',   test: r => r >= 13 },
]

const DAY_MS = 86400000

// ── Utility ────────────────────────────────────────────────

function mondayOf(t) {
  const d = new Date(t)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function nextWeek(t) {
  const d = new Date(t)
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

const totalSets = (sessions, index) => sessions.reduce((n, s) => n + workoutTotals(s.items, index).sets, 0)

// Settimane su cui dividere il totale del periodo (vedi l'intestazione).
export function weeksInWindow(range, allSessions) {
  const end = range ? range.end.getTime() : today()
  const times = allSessions.map(s => dayTime(s.date)).filter(t => t != null)
  if (!times.length) return 1
  const first = Math.min(...times)
  const start = range ? Math.max(range.start.getTime(), first) : first
  return Math.max(1, (end - start + DAY_MS) / (7 * DAY_MS))
}

// ── Muscoli ────────────────────────────────────────────────

// Per ogni muscolo: punteggio totale, media a settimana e intensità 0..1 sulla
// scala assoluta settimanale. `windowWeeks` è 1 per "ultimi 7 giorni".
export function muscleWindow(sessions, index, windowWeeks) {
  const total = sumScores(sessions.map(s => muscleScores(s.items, index)))
  const perWeek = {}
  const heat = {}
  Object.entries(total).forEach(([m, v]) => {
    perWeek[m] = v / windowWeeks
    heat[m] = heatOf(perWeek[m], WEEK_FULL_SETS)
  })
  return { total, perWeek, heat }
}

// Gli esercizi che hanno lavorato un muscolo su più sessioni, aggregati per
// esercizio: è il "perché è di quel colore" del tap sul manichino.
export function muscleContributorsOver(sessions, index, muscleId) {
  const by = {}
  sessions.forEach(s => (s.items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    const w = ex.primary.includes(muscleId) ? PRIMARY_WEIGHT : ex.secondary.includes(muscleId) ? SECONDARY_WEIGHT : 0
    const n = it.sets?.length || 0
    if (!w || !n) return
    const row = by[ex.id] || (by[ex.id] = { exercise: ex, sets: 0, points: 0, role: w === PRIMARY_WEIGHT ? 'primary' : 'secondary' })
    row.sets += n
    row.points += n * w
  }))
  return Object.values(by).sort((a, b) => b.points - a.points)
}

// Da quanti giorni non alleni ciascun muscolo (sull'intero storico): `days` null
// = mai allenato davvero. Si considera "allenato" una sessione con almeno
// TRAINED_POINTS serie equivalenti: mezza serie da secondario non è allenare.
export function muscleRecency(allSessions, index) {
  const now = today()
  const last = {}
  allSessions.forEach(s => {
    const t = dayTime(s.date)
    if (t == null) return
    const scores = muscleScores(s.items, index)
    Object.entries(scores).forEach(([m, v]) => {
      if (v >= TRAINED_POINTS && (last[m] == null || t > last[m])) last[m] = t
    })
  })
  return MUSCLES.map(m => ({
    id: m.id, label: m.label, region: m.region,
    days: last[m.id] == null ? null : Math.max(0, Math.round((now - last[m.id]) / DAY_MS)),
  }))
}

// ── Volume settimanale ─────────────────────────────────────

// Serie per settimana (lunedì-domenica) nelle ultime CHART_WEEKS del periodo,
// comprese le settimane vuote: un buco è un'informazione.
export function weeklyVolume(sessions, index, range) {
  const times = sessions.map(s => dayTime(s.date)).filter(t => t != null)
  if (!times.length) return []
  const endWeek = mondayOf(range ? range.end.getTime() : today())
  const firstAll = mondayOf(Math.min(...times))
  const startWeek = Math.max(firstAll, range ? mondayOf(range.start.getTime()) : firstAll)
  const weeks = []
  for (let t = startWeek; t <= endWeek; t = nextWeek(t)) weeks.push({ start: t, sets: 0, sessions: 0 })
  sessions.forEach(s => {
    const t = dayTime(s.date)
    const w = weeks.find(x => x.start === mondayOf(t))
    if (!w) return
    w.sets += workoutTotals(s.items, index).sets
    w.sessions += 1
  })
  return weeks.slice(-CHART_WEEKS)
}

// ── Bilancio degli schemi di movimento ─────────────────────

export function movementBalance(sessions, index) {
  const sets = Object.fromEntries(MOVEMENTS.map(m => [m.id, 0]))
  sessions.forEach(s => (s.items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    sets[ex.movement in sets ? ex.movement : 'other'] += it.sets?.length || 0
  }))
  const total = Object.values(sets).reduce((a, b) => a + b, 0)
  const rows = MOVEMENTS.map(m => ({ ...m, sets: sets[m.id], share: total ? sets[m.id] / total : 0 }))
  const ratio = sets.pull > 0 ? sets.push / sets.pull : null
  return { rows, total, push: sets.push, pull: sets.pull, ratio, enough: total >= MIN_BALANCE_SETS }
}

// ── Progressione ───────────────────────────────────────────

// Per ogni esercizio con almeno MIN_PROGRESS sessioni nel periodo, il valore
// migliore di ogni sessione: massimale stimato (Epley) per gli esercizi con
// carico, ripetizioni per il corpo libero, secondi per quelli a tempo. Le
// serie senza kg non hanno un massimale: se un esercizio con carico non ne ha
// in almeno MIN_PROGRESS sessioni, non ha progressione.
export function progression(sessions, index) {
  const by = {}
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  ordered.forEach(s => (s.items || []).forEach(it => {
    const ex = resolveExercise(it, index)
    const value = bestOfSession(it.sets, ex.mode)
    if (!value) return
    const row = by[ex.id] || (by[ex.id] = { exercise: ex, points: [] })
    const last = row.points[row.points.length - 1]
    if (last && last.date === s.date) last.value = Math.max(last.value, value)
    else row.points.push({ date: s.date, value })
  }))

  return Object.values(by)
    .filter(r => r.points.length >= MIN_PROGRESS)
    .map(r => {
      const first = r.points[0].value
      const last = r.points[r.points.length - 1].value
      const best = r.points.reduce((b, p) => (p.value > b.value ? p : b), r.points[0])
      return {
        exercise: r.exercise, points: r.points, n: r.points.length,
        first, last, delta: first > 0 ? last / first - 1 : 0,
        pr: best.value, prDate: best.date, prIsLast: best === r.points[r.points.length - 1],
        unit: r.exercise.mode === 'time' ? 's' : r.exercise.mode === 'reps' ? 'rip.' : 'kg',
      }
    })
    .sort((a, b) => b.n - a.n || a.exercise.name.localeCompare(b.exercise.name, 'it'))
}

// Il valore migliore di un esercizio in una sessione, per modalità.
function bestOfSession(sets, mode) {
  if (mode === 'time') return Math.max(0, ...sets.map(x => x.sec || 0))
  if (mode === 'reps') return Math.max(0, ...sets.map(x => x.reps || 0))
  return Math.max(0, ...sets.map(x => estimate1RM(x) || 0))
}

// ── Dati dall'orologio ─────────────────────────────────────
// Le sessioni con i dati dell'orologio, divise tra quelle MISURATE (importate dal
// file .FIT: hanno tutti i campi) e quelle trascritte a mano (solo alcuni). Ogni
// media porta il proprio `n`.
//
// ── Riposo medio tra le serie: una stima, e va detto ──
// La scheda dice quante serie e ripetizioni; l'orologio dice quanto è durata la
// sessione. Togliendo il tempo di esecuzione stimato (`SEC_PER_REP` per
// ripetizione) il resto è, in media, il riposo tra una serie e l'altra. Mescola
// anche cambi di attrezzo e pause: dà un ordine di grandezza, non un
// cronometro. Serve la durata REALE (non quella stimata dalla scheda, che
// sarebbe circolare).

export function watchSummary(sessions, index) {
  const withAth = sessions.filter(s => s.athletics && hasAny(s.athletics))
  const measured = withAth.filter(s => s.athletics.source === 'fit')
  const pick = (f) => withAth.map(s => s.athletics[f]).filter(v => typeof v === 'number')
  const hr = pick('avgHr'), kcal = pick('calories'), dur = pick('durationSec')
  const te = pick('trainingEffect'), an = pick('anaerobicTrainingEffect'), load = pick('trainingLoad')

  // Zone FC: secondi sommati zona per zona, non media delle percentuali.
  const withZones = withAth.filter(s => zonesTotalSec(s.athletics.zones) > 0)
  const secs = [0, 1, 2, 3, 4, 5, 6].map(() => 0)
  withZones.forEach(s => readZones(s.athletics.zones).forEach((v, i) => { secs[i] += v || 0 }))
  const zonesTotal = secs.reduce((a, b) => a + b, 0)

  // Densità: serie all'ora e riposo medio, sulle sole sessioni con durata reale.
  const dens = withAth
    .filter(s => typeof s.athletics.durationSec === 'number' && s.athletics.durationSec > 0)
    .map(s => {
      const t = workoutTotals(s.items, index)
      if (!t.sets) return null
      const exec = Math.max(0, t.estimatedSec - t.sets * REST_SEC)
      return {
        perHour: t.sets / (s.athletics.durationSec / 3600),
        restSec: Math.max(0, (s.athletics.durationSec - exec) / t.sets),
      }
    })
    .filter(Boolean)

  return {
    n: withAth.length,
    measured: measured.length,
    manual: withAth.length - measured.length,
    enough: withAth.length >= MIN_WATCH,
    avgHr: { n: hr.length, value: avg(hr) },
    calories: { n: kcal.length, value: avg(kcal) },
    durationSec: { n: dur.length, value: avg(dur) },
    trainingEffect: { n: te.length, value: avg(te) },
    anaerobic: { n: an.length, value: avg(an) },
    load: { n: load.length, value: avg(load), max: load.length ? Math.max(...load) : null },
    zones: {
      n: withZones.length,
      enough: withZones.length >= MIN_ZONES_GYM,
      secs, total: zonesTotal,
      shares: secs.map(v => (zonesTotal ? v / zonesTotal : 0)),
    },
    density: {
      n: dens.length,
      enough: dens.length >= MIN_DENSITY,
      setsPerHour: avg(dens.map(d => d.perHour)),
      restSec: avg(dens.map(d => d.restSec)),
    },
  }
}

function hasAny(a) {
  return ['avgHr', 'calories', 'durationSec', 'trainingEffect', 'anaerobicTrainingEffect', 'trainingLoad']
    .some(f => typeof a[f] === 'number') || zonesTotalSec(a.zones) > 0
}

// ── Costanza ───────────────────────────────────────────────
// Stesso motore di Attività (`consistency`): settimane attive, buco più lungo,
// striscia e giorni dall'ultima sessione. Striscia e ultima sessione sono fatti
// del presente e leggono l'intero storico.

function toDays(sessions) {
  return sessions
    .map(s => ({
      day: dayTime(s.date),
      minutes: (s.athletics?.durationSec || 0) / 60,
      rpe: LOAD_RPE[s.intensity] ?? DEFAULT_RPE,
    }))
    .filter(x => x.day != null)
    .sort((a, b) => a.day - b.day)
}

// ── Esercizi e fasce di ripetizioni ────────────────────────

export function exerciseMix(sessions, index) {
  const by = {}
  const bandSets = Object.fromEntries(REP_BANDS.map(b => [b.id, 0]))
  sessions.forEach(s => {
    const seen = new Set()
    ;(s.items || []).forEach(it => {
      const ex = resolveExercise(it, index)
      const n = it.sets?.length || 0
      if (!n) return
      const row = by[ex.id] || (by[ex.id] = { exercise: ex, sets: 0, sessions: 0 })
      row.sets += n
      if (!seen.has(ex.id)) { row.sessions++; seen.add(ex.id) }
      if (ex.mode === 'time') return
      ;(it.sets || []).forEach(set => {
        if (!(set.reps > 0)) return
        const band = REP_BANDS.find(b => b.test(set.reps))
        if (band) bandSets[band.id]++
      })
    })
  })
  const rows = Object.values(by).sort((a, b) => b.sets - a.sets || a.exercise.name.localeCompare(b.exercise.name, 'it'))
  const totalSets = rows.reduce((t, r) => t + r.sets, 0)
  const repSets = Object.values(bandSets).reduce((t, v) => t + v, 0)
  return {
    top: rows.slice(0, 6).map(r => ({ ...r, share: totalSets ? r.sets / totalSets : 0 })),
    distinct: rows.length,
    totalSets,
    bands: REP_BANDS.map(b => ({ id: b.id, label: b.label, hint: b.hint, sets: bandSets[b.id], share: repSets ? bandSets[b.id] / repSets : 0 })),
    repSets,
    bandsEnough: repSets >= MIN_REPS_SETS,
    bandsMissing: Math.max(0, MIN_REPS_SETS - repSets),
  }
}

// ── Record battuti nel periodo ─────────────────────────────
// Il valore migliore di un esercizio (stessa misura di `progression`) nel
// periodo, contro il migliore che avevi PRIMA del periodo. Se l'esercizio nasce
// dentro il periodo non c'è un «prima»: il riferimento è la sua prima sessione,
// e un record c'è solo se poi l'hai superata. Si legge l'intero storico per
// sapere cosa c'era prima.

export function recordsInPeriod(allSessions, periodIds, index) {
  const ordered = [...allSessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const by = {}
  ordered.forEach(s => {
    const inPeriod = periodIds.has(s.id)
    ;(s.items || []).forEach(it => {
      const ex = resolveExercise(it, index)
      const value = bestOfSession(it.sets || [], ex.mode)
      if (!value) return
      const row = by[ex.id] || (by[ex.id] = { exercise: ex, runningMax: 0, baseline: null, periodMax: 0, date: null })
      if (inPeriod) {
        if (row.baseline == null) row.baseline = row.runningMax || value
        if (value > row.periodMax) { row.periodMax = value; row.date = s.date }
      }
      row.runningMax = Math.max(row.runningMax, value)
    })
  })
  return Object.values(by)
    .filter(r => r.baseline != null && r.periodMax > r.baseline)
    .map(r => ({
      exercise: r.exercise, date: r.date, value: r.periodMax, previous: r.baseline,
      delta: r.periodMax / r.baseline - 1,
      unit: r.exercise.mode === 'time' ? 's' : r.exercise.mode === 'reps' ? 'rip.' : 'kg',
    }))
    .sort((a, b) => b.delta - a.delta)
}

// ── Report ─────────────────────────────────────────────────

export function buildGym({ sessions, allSessions, previousSessions = [], index, range }) {
  const n = sessions.length
  const weeks = weeksInWindow(range, allSessions)
  const sets = totalSets(sessions, index)
  const volumeKg = sessions.reduce((v, s) => v + workoutTotals(s.items, index).volumeKg, 0)

  // Ultimi 7 giorni: presente, sull'intero storico.
  const since = today() - 6 * DAY_MS
  const lastWeek = allSessions.filter(s => { const t = dayTime(s.date); return t != null && t >= since })

  const report = {
    index,
    n,
    total: allSessions.length,
    enough: n >= MIN_GYM,
    missing: Math.max(0, MIN_GYM - n),
    weeks,
    volume: {
      sessions: n, sets, volumeKg,
      perWeek: n / weeks,
      setsPerSession: n ? sets / n : null,
      prev: previousSessions.length >= MIN_GYM_PREV
        ? { sessions: previousSessions.length, sets: totalSets(previousSessions, index) }
        : null,
      weekly: weeklyVolume(sessions, index, range),
    },
    muscles: {
      period: { sessions, ...muscleWindow(sessions, index, weeks) },
      lastWeek: { sessions: lastWeek, ...muscleWindow(lastWeek, index, 1) },
      recency: muscleRecency(allSessions, index),
    },
    balance: movementBalance(sessions, index),
    progress: progression(sessions, index),
    consistency: consistency(toDays(sessions), range, toDays(allSessions)),
    mix: exerciseMix(sessions, index),
    records: recordsInPeriod(allSessions, new Set(sessions.map(s => s.id)), index),
    watch: watchSummary(sessions, index),
  }
  report.insights = report.enough ? gymInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Frasi che dicono cosa fare o cosa notare, nello stesso formato di
// physical.js / technique.js: { id, target, tone, icon, text, weight, tab }.

const one = v => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })

function insight(o) {
  return { ...o, tab: 'palestra' }
}

export function gymInsights(r) {
  const out = []

  // Trascuratezza: il muscolo già allenato che non tocchi da più tempo; solo se
  // non ce n'è nessuno, si dice quali non sono mai stati allenati davvero (con
  // 15 gruppi, i piccoli — trapezio, avambracci — sarebbero sempre in cima).
  if (r.total >= MIN_NEGLECT_SESSIONS) {
    const rec = r.muscles.recency
    const stale = rec.filter(m => m.days != null && m.days >= NEGLECT_DAYS).sort((a, b) => b.days - a.days)
    const never = rec.filter(m => m.days == null)
    if (stale[0]) {
      out.push(insight({
        id: 'trascurato', target: 'trascurati', tone: 'bad', icon: '⚠️',
        weight: Math.min(2, 1 + stale[0].days / 60),
        text: `Non alleni ${stale[0].label.toLowerCase()} da ${stale[0].days} giorni.`,
      }))
    } else if (never.length) {
      const names = never.slice(0, 3).map(m => m.label.toLowerCase())
      out.push(insight({
        id: 'trascurato', target: 'trascurati', tone: 'neutral', icon: '⚠️', weight: 0.9,
        text: `Non hai mai allenato davvero: ${names.join(', ')}${never.length > 3 ? ` e altri ${never.length - 3}` : ''}.`,
      }))
    }
  }

  // Bilancio spinta / trazione.
  const b = r.balance
  if (b.enough && b.ratio != null && (b.ratio >= 1.5 || b.ratio <= 0.67)) {
    const pushHeavy = b.ratio > 1
    out.push(insight({
      id: 'bilancio', target: 'bilancio', tone: 'bad', icon: '⚖️', weight: 1.4,
      text: pushHeavy
        ? `Fai ${one(b.ratio)} serie di spinta per ogni serie di trazione: aggiungere trazioni aiuta le spalle a restare in equilibrio.`
        : `Fai ${one(1 / b.ratio)} serie di trazione per ogni serie di spinta: il petto e le spalle stanno restando indietro.`,
    }))
  } else if (b.enough && b.pull === 0) {
    out.push(insight({
      id: 'bilancio', target: 'bilancio', tone: 'bad', icon: '⚖️', weight: 1.5,
      text: 'Nel periodo non hai fatto nessuna serie di trazione: solo spinta.',
    }))
  }

  // Progressione: il miglioramento più netto (e il primo peggioramento serio).
  const gains = r.progress.filter(p => p.exercise.mode !== 'time' && p.delta >= 0.05).sort((a, c) => c.delta - a.delta)
  if (gains[0]) {
    const p = gains[0]
    out.push(insight({
      id: 'progressione', target: 'progressione', tone: 'good', icon: '📈', weight: 1.7 + Math.min(0.3, p.delta),
      text: `${p.exercise.name}: da ${one(p.first)} a ${one(p.last)} ${p.unit}${p.unit === 'kg' ? ' di massimale stimato' : ''} in ${p.n} sessioni (+${Math.round(p.delta * 100)}%).`,
    }))
  }
  const drops = r.progress.filter(p => p.exercise.mode === 'reps-kg' && p.delta <= -0.1).sort((a, c) => a.delta - c.delta)
  if (drops[0]) {
    const p = drops[0]
    out.push(insight({
      id: 'regresso', target: 'progressione', tone: 'bad', icon: '📉', weight: 1.3,
      text: `${p.exercise.name}: il massimale stimato è sceso da ${one(p.first)} a ${one(p.last)} kg (${Math.round(p.delta * 100)}%).`,
    }))
  }

  // Record battuti nel periodo.
  const rec = r.records[0]
  if (rec && rec.delta >= 0.03) {
    out.push(insight({
      id: 'record-palestra', target: 'record-palestra', tone: 'good', icon: '🏅', weight: 1.5,
      text: `${rec.exercise.name}: nuovo massimo di periodo, da ${one(rec.previous)} a ${one(rec.value)} ${rec.unit} (+${Math.round(rec.delta * 100)}%).`,
    }))
  }

  // Fermo da tanto: un fatto del presente.
  const c = r.consistency
  if (r.total >= MIN_NEGLECT_SESSIONS && c.sinceLast != null && c.sinceLast >= STALE_DAYS) {
    out.push(insight({
      id: 'ferma-palestra', target: 'costanza-palestra', tone: 'neutral', icon: '⏸',
      weight: Math.min(1.5, 0.8 + c.sinceLast / 100),
      text: `Non ti alleni in palestra da ${c.sinceLast} giorni.`,
    }))
  }

  // Una sola fascia di ripetizioni.
  const top = [...r.mix.bands].sort((a, b) => b.share - a.share)[0]
  if (r.mix.bandsEnough && top && top.share >= 0.8) {
    out.push(insight({
      id: 'fasce', target: 'esercizi', tone: 'neutral', icon: '🎚', weight: 0.8,
      text: `Il ${Math.round(top.share * 100)}% delle tue serie è in fascia ${top.label.toLowerCase()} (${top.hint}): gli altri stimoli restano fuori.`,
    }))
  }

  // Volume contro il periodo precedente.
  const v = r.volume
  if (v.prev && v.prev.sets > 0) {
    const d = v.sets / v.prev.sets - 1
    if (Math.abs(d) >= 0.25) {
      out.push(insight({
        id: 'volume', target: 'volume', tone: d > 0 ? 'good' : 'neutral', icon: d > 0 ? '💪' : '🛌', weight: 1.1,
        text: d > 0
          ? `Hai fatto il ${Math.round(d * 100)}% di serie in più rispetto al periodo precedente.`
          : `Hai fatto il ${Math.round(-d * 100)}% di serie in meno rispetto al periodo precedente.`,
      }))
    }
  }

  return out
}
