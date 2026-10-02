// ── Statistiche: incroci tra corsa, palestra e tennis ───────
// Modulo puro di src/lib/ (nessun React, nessun Firestore). Punto 2 della
// roadmap 2.0.0: unire i dati delle nuove attività con quelli del tennis per
// capire se portano beneficio, affaticamento o simili.
//
// ── Due cose in un file ──
//  1. `toLoadSessions`: il normalizzatore del CARICO, tennis + corsa + palestra
//     nella stessa forma (minuti × sforzo, la scala di Foster già usata da
//     `loadStatus`). Serve ad ACWR e avviso in Home, che sono di tutto il corpo
//     e non solo del campo, e agli incroci qui sotto.
//  2. `buildCross`: la sezione Stats › Incroci.
//
// ── Come si misura un effetto, e cosa NON si può dire ──
// Ogni sessione di tennis (partita o allenamento) viene annotata con «quanti
// giorni fa» c'è stata l'ultima corsa / palestra, nei 7 giorni prima. Da lì tre
// gruppi che non si sovrappongono: ieri o l'altro ieri (la finestra della
// stanchezza), da 3 a 7 giorni prima (la finestra dell'allenamento che si
// assorbe), nessuna nei 7 giorni. Il giorno stesso non conta: non sappiamo cosa
// sia venuto prima, e una partita non si prepara con un'ora che deve ancora
// accadere. Tutto è CORRELAZIONE: nei periodi in cui ti alleni di più giochi
// anche di più e meglio, e una settimana senza palestra è spesso una settimana
// storta. Ogni gruppo dichiara il proprio campione e sotto soglia non parla.
//
// ── Cosa NON si stima ──
// Le durate stimate (partita senza orologio, palestra senza orologio) entrano
// nel carico, con il flag `estimated` come altrove. Nei confronti di rendimento
// e di condizione non entrano mai: lì contano solo risultati e dati misurati.

import { toSessions, loadStatus, LOAD_RPE, DEFAULT_RPE, ACWR_MIN, ACWR_MAX } from './activity'
import { coreStats, dayTime, filterPeriod, MIN_BRIDGE } from './stats'
import { runMinutes } from './running'
import { gymMinutes, muscleScores, MUSCLES_BY_ID } from './gym'
import { TRAINED_POINTS } from './gymStats'
import { toAthleticSessions, cardiacEconomy, MIN_SIDE } from './physical'
import { readZones, zonesTotalSec } from './athletics'
import { INTENSITIES } from './training'
import { calibrateIntensity } from './fit'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_TENNIS     = 5   // sessioni di tennis nel periodo, per aprire la sezione
export const MIN_OFFCOURT   = 4   // corse + palestre in tutto lo storico, per aprirla
export const MIN_FACTOR     = 4   // sessioni di un fattore (es. palestre), per parlarne
export const MIN_TRAIN_ROW  = 5   // allenamenti con voto per gruppo
export const MIN_CORR       = 8   // sessioni per una correlazione
export const MIN_PERCEIVED  = 5   // sessioni con sforzo dichiarato e carico Garmin, per dominio
export const MIN_DELTA_PP   = 0.06  // scarto minimo di GW% perché diventi una frase (6 punti)
export const MIN_DELTA_BPM  = 3     // scarto minimo di FC perché diventi una frase
export const MIN_CORR_R     = 0.4   // |r| minimo perché diventi una frase

export const RECENT_DAYS = 2    // «ieri o l'altro ieri»
export const WINDOW_DAYS = 7    // quanto indietro si guarda
export const LOOKBACK_DAYS = 28 // finestra dei km / delle palestre nel blocco correlazione

// Una corsa è «dura» se dichiarata intensa o se passa almeno il 20% del tempo
// in Z4-Z6 (dove c'è l'orologio): una corsa a ripetute può essere dichiarata
// «leggera» e costare comunque una seduta di scatti.
const HARD_RUN_SHARE = 0.2

// ── Domini ─────────────────────────────────────────────────
export const DOMAINS = [
  { id: 'tennis', label: 'Tennis',  color: 'var(--color-teal-dark)' },
  { id: 'run',    label: 'Corsa',   color: 'var(--color-draw)' },
  { id: 'gym',    label: 'Palestra', color: 'var(--color-zone-6)' },
]
export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map(d => [d.id, d]))

// ── Sessioni di carico ─────────────────────────────────────
// Una forma sola per i tre domini: `{ id, kind, domain, day, date, minutes,
// estimated, intensity, rpe, rpeDeclared, garmin, ... }`. Le sessioni senza
// una durata (una corsa senza orologio e senza profilo corsa, una scheda vuota)
// vengono scartate: un carico di zero minuti non esiste.
//
// Campi in più, solo per i domini che li usano:
//  · run: `km`, `hard`
//  · gym: `legs` (le gambe hanno lavorato davvero, almeno `TRAINED_POINTS`
//    serie equivalenti)
export function toLoadSessions({
  matches = [], trainings = [], runs = [], gymSessions = [], index = null, running = null,
}) {
  const athleticsOf = new Map()
  matches.forEach(m => athleticsOf.set(`match:${m.id}`, m.athletics))
  trainings.forEach(t => athleticsOf.set(`training:${t.id}`, t.athletics))

  const out = toSessions(matches, trainings).map(s => ({
    ...s, garmin: garminOf(athleticsOf.get(`${s.kind}:${s.id}`)),
  }))

  runs.forEach(r => {
    const day = dayTime(r.date)
    if (day == null) return
    const { minutes, estimated } = runMinutes(r, running)
    if (!(minutes > 0)) return
    const a = r.athletics || null
    out.push({
      id: r.id, kind: 'run', domain: 'run', day, date: r.date,
      minutes, estimated,
      intensity: r.intensity || null,
      rpe: LOAD_RPE[r.intensity] ?? DEFAULT_RPE,
      rpeDeclared: Boolean(LOAD_RPE[r.intensity]),
      garmin: garminOf(a),
      km: isNum(a?.distanceKm) && a.distanceKm > 0 ? a.distanceKm : null,
      hard: isHardRun(r),
    })
  })

  gymSessions.forEach(g => {
    const day = dayTime(g.date)
    if (day == null) return
    const { minutes, estimated } = gymMinutes(g, index)
    if (!(minutes > 0)) return
    out.push({
      id: g.id, kind: 'gym', domain: 'gym', day, date: g.date,
      minutes, estimated,
      intensity: g.intensity || null,
      rpe: LOAD_RPE[g.intensity] ?? DEFAULT_RPE,
      rpeDeclared: Boolean(LOAD_RPE[g.intensity]),
      garmin: garminOf(g.athletics),
      legs: legPoints(g, index) >= TRAINED_POINTS,
    })
  })

  return out.sort((a, b) => a.day - b.day)
}

function garminOf(a) {
  return isNum(a?.trainingLoad) && a.trainingLoad > 0 ? a.trainingLoad : null
}

function isHardRun(run) {
  if (run.intensity === 'intensa') return true
  const total = zonesTotalSec(run.athletics?.zones)
  if (total <= 0) return false
  const z = readZones(run.athletics.zones)
  return (z[4] + z[5] + z[6]) / total >= HARD_RUN_SHARE
}

function legPoints(session, index) {
  const scores = muscleScores(session.items, index)
  return Object.entries(scores)
    .filter(([id]) => MUSCLES_BY_ID[id]?.region === 'gambe')
    .reduce((s, [, v]) => s + v, 0)
}

// ── I fattori che si confrontano ───────────────────────────
export const FACTORS = [
  { id: 'gymLegs', label: 'Palestra con le gambe', icon: '🦵', short: 'palestra gambe', test: s => s.domain === 'gym' && s.legs },
  { id: 'gym',     label: 'Palestra',              icon: '🏋️', short: 'palestra',       test: s => s.domain === 'gym' },
  { id: 'runHard', label: 'Corsa dura',            icon: '⚡', short: 'corsa dura',     test: s => s.domain === 'run' && s.hard },
  { id: 'run',     label: 'Corsa',                 icon: '🏃', short: 'corsa',          test: s => s.domain === 'run' },
]

export const WHEN_BUCKETS = [
  { id: 'recent', label: 'Ieri o l\'altro ieri', test: d => d != null && d <= RECENT_DAYS },
  { id: 'week',   label: '3-7 giorni prima',     test: d => d != null && d > RECENT_DAYS },
  { id: 'none',   label: 'Nessuna nei 7 giorni', test: d => d == null },
]

// Fasce di ACWR con cui si arriva a una partita. «Alto» unisce il «sopra la
// fascia» e il picco: le partite giocate con un picco vero sono troppo poche
// per stare da sole.
export const LOAD_BUCKETS = [
  { id: 'low',  label: 'Sotto carico', hint: `ACWR sotto ${ACWR_MIN}`,                test: r => r < ACWR_MIN },
  { id: 'ok',   label: 'Ottimale',     hint: `ACWR ${ACWR_MIN}–${ACWR_MAX}`,          test: r => r >= ACWR_MIN && r <= ACWR_MAX },
  { id: 'high', label: 'Alto',         hint: `ACWR sopra ${ACWR_MAX}`,                test: r => r > ACWR_MAX },
]

function addDays(time, n) {
  const d = new Date(time)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function byDayMap(sessions) {
  const map = new Map()
  sessions.forEach(s => {
    if (!map.has(s.day)) map.set(s.day, [])
    map.get(s.day).push(s)
  })
  return map
}

// Giorni dall'ultima sessione che soddisfa `test`, guardando da ieri a una
// settimana fa; null se nella finestra non c'è.
function daysSince(byDay, day, test) {
  for (let d = 1; d <= WINDOW_DAYS; d++) {
    const list = byDay.get(addDays(day, -d))
    if (list && list.some(test)) return d
  }
  return null
}

function bucketOf(since) {
  return WHEN_BUCKETS.find(b => b.test(since)).id
}

// ── Partite in funzione di cosa hai fatto prima ────────────
function matchesAfter(matches, offByDay, factorTotals) {
  const overall = coreStats(matches).gameWinRate
  const rows = FACTORS.map(f => {
    const total = factorTotals[f.id]
    if (total < MIN_FACTOR) return { ...f, total, available: false, missing: MIN_FACTOR - total }

    const groups = { recent: [], week: [], none: [] }
    matches.forEach(m => {
      const day = dayTime(m.date)
      if (day == null) return
      groups[bucketOf(daysSince(offByDay, day, f.test))].push(m)
    })

    const buckets = WHEN_BUCKETS.map(b => {
      const list = groups[b.id]
      const core = coreStats(list)
      return {
        id: b.id, label: b.label, n: list.length, matches: list,
        wins: core.wins, losses: core.losses, winRate: core.winRate, rate: core.gameWinRate,
        enough: list.length >= MIN_BRIDGE,
      }
    })
    return { ...f, total, available: true, buckets, gap: gapOf(buckets, 'rate') }
  })
  return { n: matches.length, overall, factors: rows }
}

// Scarto tra «ieri o l'altro ieri» e «nessuna nei 7 giorni», solo se entrambi
// i gruppi hanno il campione: è il confronto che contiene l'ipotesi della
// stanchezza (e, letto al contrario, quella del beneficio).
function gapOf(buckets, key) {
  const recent = buckets.find(b => b.id === 'recent')
  const none = buckets.find(b => b.id === 'none')
  if (!recent?.enough || !none?.enough || recent[key] == null || none[key] == null) return null
  return { diff: recent[key] - none[key], recent, none }
}

// ── Partite in funzione del carico con cui ci arrivi ───────
// L'ACWR si calcola fino al giorno PRIMA: la partita stessa è carico, e farla
// entrare nel proprio acuto gonfierebbe proprio le partite lunghe.
function matchesByLoad(matches, loadSessions) {
  const groups = { low: [], ok: [], high: [] }
  let skipped = 0
  matches.forEach(m => {
    const day = dayTime(m.date)
    if (day == null) { skipped++; return }
    const st = loadStatus(loadSessions, addDays(day, -1))
    if (!st.available || st.ratio == null) { skipped++; return }
    groups[LOAD_BUCKETS.find(b => b.test(st.ratio)).id].push(m)
  })
  const rows = LOAD_BUCKETS.map(b => {
    const list = groups[b.id]
    const core = coreStats(list)
    return {
      id: b.id, label: b.label, hint: b.hint, n: list.length, matches: list,
      wins: core.wins, losses: core.losses, winRate: core.winRate, rate: core.gameWinRate,
      enough: list.length >= MIN_BRIDGE,
    }
  })
  const used = matches.length - skipped
  const ok = rows.find(r => r.id === 'ok')
  const high = rows.find(r => r.id === 'high')
  return {
    rows, used, skipped,
    gap: ok?.enough && high?.enough && ok.rate != null && high.rate != null
      ? { diff: high.rate - ok.rate, high, ok } : null,
  }
}

// ── Allenamenti di tennis: il voto che dai ai colpi ────────
// Un allenamento non ha un risultato. Il voto medio (1-5) dato ai colpi
// lavorati è la sensazione di come è andata, ed è l'unico esito che esiste.
function trainingScore(t) {
  const v = Object.values(t.ratings || {}).filter(isNum)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

function trainingsAfter(trainings, offByDay, factorTotals) {
  const scored = trainings
    .map(t => ({ t, day: dayTime(t.date), score: trainingScore(t) }))
    .filter(x => x.day != null && x.score != null)
  const overall = scored.length ? scored.reduce((s, x) => s + x.score, 0) / scored.length : null

  const rows = FACTORS.map(f => {
    const total = factorTotals[f.id]
    if (total < MIN_FACTOR) return { ...f, total, available: false, missing: MIN_FACTOR - total }
    const groups = { recent: [], week: [], none: [] }
    scored.forEach(x => groups[bucketOf(daysSince(offByDay, x.day, f.test))].push(x))
    const buckets = WHEN_BUCKETS.map(b => {
      const list = groups[b.id]
      return {
        id: b.id, label: b.label, n: list.length,
        avg: list.length ? list.reduce((s, x) => s + x.score, 0) / list.length : null,
        enough: list.length >= MIN_TRAIN_ROW,
      }
    })
    return { ...f, total, available: true, buckets, gap: gapOf(buckets, 'avg') }
  })
  return { n: scored.length, overall, factors: rows }
}

// ── Condizione in campo: la FC a parità di velocità ────────
// Riusa il modello dell'economia cardiaca di Fisico (FC ~ velocità), così una
// sessione più veloce non sembra «più faticosa» solo perché più veloce. In più
// toglie la differenza tra partite e allenamenti: ogni sessione si confronta
// con la FC abituale del suo tipo. Il risultato è uno scarto in battiti:
// positivo = il cuore ha lavorato più del solito a quella velocità.
function conditionAfter(athletic, offByDay, factorTotals, offSessions) {
  const usable = athletic.filter(s => s.has)
  const econ = cardiacEconomy(usable)
  if (!econ.available) return { available: false, n: econ.n, missing: econ.missing }

  const meanOf = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)
  const kindMean = {}
  ;['match', 'training'].forEach(k => {
    const list = econ.points.filter(p => p.kind === k)
    kindMean[k] = list.length >= 2 ? meanOf(list.map(p => p.adjusted)) : econ.meanHr
  })
  const points = econ.points.map(p => ({ ...p, dev: p.adjusted - kindMean[p.kind] }))

  const rows = FACTORS.map(f => {
    const total = factorTotals[f.id]
    if (total < MIN_FACTOR) return { ...f, total, available: false, missing: MIN_FACTOR - total }
    const groups = { recent: [], week: [], none: [] }
    points.forEach(p => groups[bucketOf(daysSince(offByDay, p.day, f.test))].push(p))
    const buckets = WHEN_BUCKETS.map(b => {
      const list = groups[b.id]
      return { id: b.id, label: b.label, n: list.length, dev: meanOf(list.map(p => p.dev)), enough: list.length >= MIN_SIDE }
    })
    return { ...f, total, available: true, buckets, gap: gapOf(buckets, 'dev') }
  })

  // Quanto carico «fuori dal campo» c'è stato nelle 4 settimane prima: stesso
  // scarto contro km corsi e contro sessioni di palestra.
  const corr = (valueOf, label, unit) => {
    const xs = points.map(p => valueOf(p.day))
    const mean = meanOf(xs)
    const varX = meanOf(xs.map(x => (x - mean) ** 2))
    if (points.length < MIN_CORR || !(varX > 0)) {
      return { id: label, label, unit, available: false, n: points.length, missing: Math.max(0, MIN_CORR - points.length) }
    }
    const ys = points.map(p => p.dev)
    const r = pearson(xs, ys)
    const meanY = meanOf(ys)
    const cov = meanOf(xs.map((x, i) => (x - mean) * (ys[i] - meanY)))
    return { id: label, label, unit, available: true, n: points.length, r, slope: cov / varX, meanX: mean }
  }
  const kmBefore = (day) => offSessions
    .filter(s => s.domain === 'run' && s.km != null && s.day < day && s.day >= addDays(day, -LOOKBACK_DAYS))
    .reduce((s, x) => s + x.km, 0)
  const gymBefore = (day) => offSessions
    .filter(s => s.domain === 'gym' && s.day < day && s.day >= addDays(day, -LOOKBACK_DAYS)).length

  return {
    available: true, n: points.length, corrected: econ.corrected,
    factors: rows,
    correlations: [
      corr(kmBefore, 'km corsi nelle 4 settimane prima', 'km'),
      corr(gymBefore, 'palestre nelle 4 settimane prima', 'sessioni'),
    ],
  }
}

function pearson(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

// ── Sforzo percepito contro carico dell'orologio ───────────
// Per ogni dominio: a parità di intensità dichiarata, quanto «carico Garmin al
// minuto» c'è dietro. Se leggera / media / intensa non si distinguono, la scala
// a tre livelli dice poco di quel dominio — ed è la lettura che spiega perché
// il suggerimento dall'orologio non sostituisce la scelta dell'utente.
function perceivedVsWatch(sessions) {
  return DOMAINS.map(d => {
    const ok = sessions.filter(s =>
      s.domain === d.id && s.rpeDeclared && s.garmin != null && !s.estimated && s.minutes > 0)
      .map(s => ({ ...s, perMin: s.garmin / s.minutes }))
    const rows = INTENSITIES.map(i => {
      const list = ok.filter(s => s.intensity === i.id)
      return {
        id: i.id, label: i.label, color: i.color, n: list.length,
        avg: list.length ? list.reduce((s, x) => s + x.perMin, 0) / list.length : null,
      }
    })
    const enough = ok.length >= MIN_PERCEIVED
    return {
      id: d.id, label: d.label, n: ok.length, enough, missing: Math.max(0, MIN_PERCEIVED - ok.length),
      rows,
      r: enough ? pearson(ok.map(s => s.rpe), ok.map(s => s.perMin)) : null,
    }
  })
}

// ── Report completo ────────────────────────────────────────
// `matches` e `trainings` sono quelli del PERIODO; `loadSessions` è l'intero
// storico di tutti i domini (serve a guardare indietro dall'inizio del periodo
// e a calcolare l'ACWR di ogni partita); `allMatches` è l'intero storico delle
// partite, per la calibrazione dell'intensità suggerita.
export function buildCross({ matches = [], trainings = [], loadSessions = [], allMatches = null, range = null }) {
  const offAll = loadSessions.filter(s => s.domain !== 'tennis')
  const offByDay = byDayMap(offAll)
  const factorTotals = Object.fromEntries(FACTORS.map(f => [f.id, offAll.filter(f.test).length]))

  const tennisN = matches.length + trainings.length
  const enough = tennisN >= MIN_TENNIS && offAll.length >= MIN_OFFCOURT

  const athletic = toAthleticSessions(matches, trainings)
  const periodLoad = filterPeriod(loadSessions, range)

  const withBefore = (list, test) => list.filter(x => {
    const day = dayTime(x.date)
    return day != null && daysSince(offByDay, day, test) != null
  }).length

  const report = {
    enough,
    missingTennis: Math.max(0, MIN_TENNIS - tennisN),
    missingOffCourt: Math.max(0, MIN_OFFCOURT - offAll.length),
    coverage: {
      matches: matches.length, trainings: trainings.length,
      runs: offAll.filter(s => s.domain === 'run').length,
      gyms: offAll.filter(s => s.domain === 'gym').length,
      matchesAfterRun: withBefore(matches, FACTORS.find(f => f.id === 'run').test),
      matchesAfterGym: withBefore(matches, FACTORS.find(f => f.id === 'gym').test),
      share: periodShare(periodLoad),
    },
  }
  if (!enough) { report.insights = []; return report }

  report.matches   = matchesAfter(matches, offByDay, factorTotals)
  report.byLoad    = matchesByLoad(matches, loadSessions)
  report.trainings = trainingsAfter(trainings, offByDay, factorTotals)
  report.body      = conditionAfter(athletic, offByDay, factorTotals, offAll)
  report.perceived = perceivedVsWatch(periodLoad)
  // La calibrazione dell'intensità suggerita legge TUTTE le partite, non il
  // periodo: serve il campione più ampio possibile, e le soglie sono le stesse
  // che vede il wizard.
  report.calibration = calibrateIntensity(allMatches || matches)
  report.insights  = crossInsights(report)
  return report
}

// Quota di carico per dominio nel periodo.
function periodShare(sessions) {
  const load = Object.fromEntries(DOMAINS.map(d => [d.id, 0]))
  sessions.forEach(s => { load[s.domain || 'tennis'] += s.minutes * s.rpe })
  const total = DOMAINS.reduce((s, d) => s + load[d.id], 0)
  return { load, total, shares: Object.fromEntries(DOMAINS.map(d => [d.id, total ? load[d.id] / total : 0])) }
}

// ── Insight ────────────────────────────────────────────────
// Stesso motore degli altri: soglia di campione + soglia di effetto, frase con
// i numeri dentro, `target` (id del blocco) e `tab`. Al massimo MAX_INSIGHTS:
// la sezione ha molte ipotesi e una frase per ognuna affogherebbe la lista di
// pagina, già condivisa con le altre sezioni.
const MAX_INSIGHTS = 3
const pct = v => `${Math.round(v * 100)}%`
const pp = v => `${Math.round(Math.abs(v) * 100)}`
const bpm = v => `${Math.round(Math.abs(v))}`

function insight(o) {
  return { ...o, tab: 'incroci', weight: o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n) }
}

export function crossInsights(r) {
  const out = []

  r.matches.factors.forEach(f => {
    if (!f.available || !f.gap || Math.abs(f.gap.diff) < MIN_DELTA_PP) return
    const worse = f.gap.diff < 0
    const n = Math.min(f.gap.recent.n, f.gap.none.n)
    out.push(insight({
      id: `cross-match-${f.id}`, family: 'match', target: 'incroci-partite', tone: worse ? 'bad' : 'good', icon: f.icon,
      effect: f.gap.diff, n,
      text: `Dopo ${f.short} nei due giorni prima vinci il ${pct(f.gap.recent.rate)} dei game, contro il ${pct(f.gap.none.rate)} senza ${f.short} nella settimana (${f.gap.recent.n} contro ${f.gap.none.n} partite): ${pp(f.gap.diff)} punti ${worse ? 'in meno' : 'in più'}.`,
    }))
  })

  if (r.byLoad.gap && Math.abs(r.byLoad.gap.diff) >= MIN_DELTA_PP) {
    const { diff, high, ok } = r.byLoad.gap
    out.push(insight({
      id: 'cross-load', family: 'load', target: 'incroci-carico', tone: diff < 0 ? 'bad' : 'good', icon: '📈',
      effect: diff, n: Math.min(high.n, ok.n),
      text: `Quando arrivi alla partita con il carico alto (ACWR sopra ${ACWR_MAX}) vinci il ${pct(high.rate)} dei game, contro il ${pct(ok.rate)} con il carico ottimale (${high.n} contro ${ok.n} partite).`,
    }))
  }

  if (r.body.available) {
    r.body.factors.forEach(f => {
      if (!f.available || !f.gap || Math.abs(f.gap.diff) < MIN_DELTA_BPM) return
      const n = Math.min(f.gap.recent.n, f.gap.none.n)
      out.push(insight({
        id: `cross-body-${f.id}`, family: 'body', target: 'incroci-condizione', tone: f.gap.diff > 0 ? 'bad' : 'good', icon: '❤️',
        effect: f.gap.diff / 10, n,
        text: `Dopo ${f.short} nei due giorni prima il cuore lavora ${bpm(f.gap.diff)} battiti ${f.gap.diff > 0 ? 'in più' : 'in meno'} a parità di velocità (${f.gap.recent.n} contro ${f.gap.none.n} sessioni di tennis con l'orologio).`,
      }))
    })
    r.body.correlations.forEach(c => {
      if (!c.available || c.r == null || Math.abs(c.r) < MIN_CORR_R) return
      out.push(insight({
        id: `cross-corr-${c.unit}`, family: 'corr', target: 'incroci-condizione', tone: c.r < 0 ? 'good' : 'bad', icon: '🔗',
        effect: c.r, n: c.n,
        text: `Più ${c.unit === 'km' ? 'corri' : 'ti alleni in palestra'}, ${c.r < 0 ? 'più basso' : 'più alto'} è il battito del tennis a parità di velocità (r ${c.r.toFixed(2).replace('.', ',')} su ${c.n} sessioni).`,
      }))
    })
  }

  // Una frase per famiglia: «palestra» e «palestra con le gambe» sono la stessa
  // ipotesi vista da due lati, e dirle entrambe è rumore. Resta la più forte.
  const best = new Map()
  out.forEach(i => { if (!best.has(i.family) || best.get(i.family).weight < i.weight) best.set(i.family, i) })
  return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, MAX_INSIGHTS)
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}
