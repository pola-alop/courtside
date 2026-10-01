// ── Statistiche: corsa ──────────────────────────────────────
// Modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa linea
// di gymStats.js / physical.js / activity.js. Risponde a "quanto e come corro, e
// sto migliorando?": volume, costanza, passo e progressione, efficienza
// cardiaca, intensità, stimolo e carico Garmin, dinamiche di corsa e record.
//
// ── L'unità è il CHILOMETRO (e il minuto) ──
// Come il battito per Fisico e la serie per Palestra. Tutto nasce da
// `run.athletics`, che una corsa porta con la stessa shape di partite e
// allenamenti, ma — a differenza loro — con la distanza e la durata sempre
// pensate per esserci. I campi sono comunque facoltativi (si possono
// trascrivere a mano): ogni aggregato porta il PROPRIO `n`, e la copertura sta
// in testa alla sezione.
//
// ── Qui NON si stima mai ──
// `runMinutes` in running.js ripiega sulla stima della scheda quando manca
// l'orologio. In una statistica sarebbe un'invenzione: la scheda dice cosa
// avresti dovuto fare, non cosa hai fatto, e un passo "stimato" farebbe vedere
// un progresso che è solo la tabella zone del profilo. Si usano solo i dati
// dell'orologio, e le corse che non li hanno restano fuori dai conteggi che li
// richiedono (ma contano per sessioni e costanza).
//
// ── Continue contro ripetute ──
// Il passo medio di una corsa a ripetute mescola scatti e recuperi: confrontarlo
// con quello di una corsa continua non ha senso. Il trend del passo e
// l'efficienza cardiaca guardano perciò le sole corse CONTINUE (nessun gruppo
// `repeat` nella struttura). Per le altre l'unico confronto onesto è "la stessa
// scheda nel tempo", che ha la stessa struttura per costruzione.
//
// ── Cosa segue il periodo e cosa è "adesso" ──
// Volume, passo, efficienza, intensità, stimolo, carico e dinamiche seguono il
// periodo scelto. Giorni dall'ultima corsa, striscia e record leggono l'intero
// storico (stessa logica di ACWR in activity.js).
//
// ── Cosa NON c'è (ancora) ──
// Tutto ciò che richiede i lap o le serie del file (tenuta nelle ripetute,
// deriva cardiaca): vive in `fitDetails`, un documento per volta, e questo modulo
// lavora solo sul riassunto già in `athletics`. Vedi il punto aperto in CLAUDE.md.

import { dayTime } from './stats'
import { hasAthletics, readZones, zonesTotalSec, avgSpeedKmh } from './athletics'
import { avgPaceSec, runDisplayName } from './running'
import { weekBuckets, consistency, LOAD_RPE, DEFAULT_RPE } from './activity'
import { zoneMix, stimulus, cardiacEconomy, MIN_ZONES, MIN_TE } from './physical'
import { weeksInWindow } from './gymStats'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_RUN         = 3   // corse nel periodo, per aprire la sezione
export const MIN_RUN_PREV    = 3   // corse nel periodo precedente, per il delta
export const MIN_PACE        = 6   // corse continue, per il trend del passo (e l'efficienza)
export const MIN_PACE_SIDE   = 3   // corse continue per metà del periodo
export const MIN_SCHEME      = 3   // esecuzioni della stessa scheda, per il suo confronto
export const MIN_LOAD        = 3   // corse con il carico Garmin
export const MIN_DYNAMICS    = 4   // corse con le dinamiche, per la media
export const MIN_DYN_HALVES  = 6   // corse con quel campo, per il confronto tra metà
export const MIN_RECORD_KM   = 3   // km minimi perché una corsa valga per il record di passo
export const MIN_PACE_KM     = 1   // km minimi perché il passo medio di una corsa sia un dato
export const MIN_RECORDS     = 5   // corse totali, per dire «record» in un insight
export const CHART_WEEKS     = 16  // settimane massime nei grafici settimanali
export const STALE_DAYS      = 14  // giorni senza correre per segnalarlo

// ── Sessioni normalizzate ──────────────────────────────────
// Una corsa → una forma piatta, una volta sola. Come `toAthleticSessions` in
// physical.js, le corse senza dati NON vengono scartate: sono il denominatore
// della copertura e contano per volume (sessioni) e costanza.

export function toRunSessions(runs = [], workouts = []) {
  const out = []
  runs.forEach(r => {
    const day = dayTime(r.date)
    if (day == null) return
    const a = r.athletics || null
    const zonesSec = zonesTotalSec(a?.zones)
    const durationSec = isNum(a?.durationSec) && a.durationSec > 0 ? a.durationSec : null
    out.push({
      id: r.id, kind: 'run', day, date: r.date,
      label: runDisplayName(r, workouts),
      schemeKey: r.workoutId || (r.workoutName ? `n:${String(r.workoutName).trim().toLowerCase()}` : null),
      intensity: r.intensity || null,
      rpe: LOAD_RPE[r.intensity] ?? DEFAULT_RPE,
      continuous: !(r.items || []).some(it => it.kind === 'repeat'),
      has: hasAthletics(a),
      measured: a?.source === 'fit',
      km: isNum(a?.distanceKm) && a.distanceKm > 0 ? a.distanceKm : null,
      durationSec,
      minutes: durationSec ? durationSec / 60 : 0,
      speed: avgSpeedKmh(a),
      paceSec: avgPaceSec(a),
      hr: isNum(a?.avgHr) ? a.avgHr : null,
      maxHr: isNum(a?.maxHr) ? a.maxHr : null,
      te: isNum(a?.trainingEffect) ? a.trainingEffect : null,
      anTe: isNum(a?.anaerobicTrainingEffect) ? a.anaerobicTrainingEffect : null,
      zones: zonesSec > 0 ? readZones(a.zones) : null,
      zonesSec,
      load: isNum(a?.trainingLoad) ? a.trainingLoad : null,
      ascent: isNum(a?.ascentM) ? a.ascentM : null,
      dynamics: a?.dynamics || null,
    })
  })
  return out.sort((a, b) => a.day - b.day)
}

// ── Copertura ──────────────────────────────────────────────

export const RUN_COVERAGE_FIELDS = [
  { id: 'distance', label: 'Distanza',        pick: s => s.km },
  { id: 'duration', label: 'Durata',          pick: s => s.durationSec },
  { id: 'hr',       label: 'FC media',        pick: s => s.hr },
  { id: 'zones',    label: 'Zone FC',         pick: s => (s.zonesSec > 0 ? s.zonesSec : null) },
  { id: 'te',       label: 'Training effect', pick: s => s.te },
  { id: 'dynamics', label: 'Dinamiche',       pick: s => s.dynamics },
]

export function runCoverage(sessions) {
  const withData = sessions.filter(s => s.has)
  const measured = withData.filter(s => s.measured)
  return {
    total: sessions.length,
    n: withData.length,
    share: sessions.length ? withData.length / sessions.length : null,
    measured: measured.length,
    manual: withData.length - measured.length,
    none: sessions.length - withData.length,
    fields: RUN_COVERAGE_FIELDS.map(f => {
      const n = withData.filter(s => f.pick(s) != null).length
      return { id: f.id, label: f.label, n, share: withData.length ? n / withData.length : null }
    }),
  }
}

// ── Volume ─────────────────────────────────────────────────

export function runVolume(sessions, previous, range, allSessions) {
  const withKm = sessions.filter(s => s.km != null)
  const withTime = sessions.filter(s => s.durationSec != null)
  const withAscent = sessions.filter(s => s.ascent != null)
  const km = sum(withKm, s => s.km)
  const sec = sum(withTime, s => s.durationSec)
  const weeks = weeksInWindow(range, allSessions)

  const prevKm = previous.length >= MIN_RUN_PREV ? sum(previous.filter(s => s.km != null), s => s.km) : null

  const weekly = weekBuckets(sessions, range).map(w => ({
    start: w.start, n: w.n, km: sum(w.sessions, s => s.km),
  })).slice(-CHART_WEEKS)

  return {
    sessions: sessions.length,
    km, kmN: withKm.length,
    sec, timeN: withTime.length,
    ascent: sum(withAscent, s => s.ascent), ascentN: withAscent.length,
    perWeek: sessions.length / weeks,
    kmPerWeek: withKm.length ? km / weeks : null,
    kmPerRun: withKm.length ? km / withKm.length : null,
    prevKm,
    deltaKm: prevKm ? km / prevKm - 1 : null,
    weekly,
  }
}

// ── Passo: trend sulle corse continue ──────────────────────
// Il passo di ogni metà è calcolato sui TOTALI (tempo totale / km totali), non
// come media dei passi: una corsa di 12 km pesa più di una di 3. Con un numero
// dispari di corse quella centrale resta fuori da entrambe le metà.

export function paceTrend(sessions) {
  const ok = sessions.filter(s => s.continuous && s.paceSec != null && s.km >= MIN_PACE_KM && s.durationSec != null)
  const n = ok.length
  if (n < MIN_PACE) return { available: false, n, missing: MIN_PACE - n }

  const half = Math.floor(n / 2)
  const sideOf = (list) => ({
    n: list.length,
    pace: sum(list, s => s.durationSec) / sum(list, s => s.km),
    km: sum(list, s => s.km),
    from: list[0].day, to: list[list.length - 1].day,
  })
  const enoughSides = half >= MIN_PACE_SIDE
  const first = enoughSides ? sideOf(ok.slice(0, half)) : null
  const second = enoughSides ? sideOf(ok.slice(n - half)) : null

  const best = ok.reduce((b, s) => (s.paceSec < b.paceSec ? s : b), ok[0])
  return {
    available: true, n,
    points: ok.map(s => ({ id: s.id, day: s.day, paceSec: s.paceSec, km: s.km, hr: s.hr, label: s.label })),
    halves: enoughSides ? {
      first, second,
      // Negativo = passo più basso = più veloce nella seconda metà.
      delta: second.pace - first.pace,
      dropped: n % 2 === 1,
    } : null,
    missingSides: Math.max(0, MIN_PACE_SIDE - half),
    best: { id: best.id, day: best.day, paceSec: best.paceSec, km: best.km },
  }
}

// ── La stessa scheda nel tempo ─────────────────────────────
// L'unico confronto del passo valido anche per le ripetute: stessa struttura,
// stesse fasi. Prima ed ultima esecuzione + la migliore; il campione (`n`) è il
// numero di esecuzioni con un passo.

export function schemeProgress(sessions) {
  const by = new Map()
  sessions.forEach(s => {
    if (!s.schemeKey || s.paceSec == null) return
    if (!by.has(s.schemeKey)) by.set(s.schemeKey, [])
    by.get(s.schemeKey).push(s)
  })

  return [...by.entries()]
    .filter(([, list]) => list.length >= MIN_SCHEME)
    .map(([key, list]) => {
      const first = list[0], last = list[list.length - 1]
      const best = list.reduce((b, s) => (s.paceSec < b.paceSec ? s : b), list[0])
      return {
        key, name: last.label, n: list.length,
        continuous: list.every(s => s.continuous),
        first: { paceSec: first.paceSec, hr: first.hr, day: first.day },
        last: { paceSec: last.paceSec, hr: last.hr, day: last.day },
        best: { paceSec: best.paceSec, day: best.day },
        // Negativo = più veloce. Relativo al primo passo.
        delta: last.paceSec / first.paceSec - 1,
        deltaSec: last.paceSec - first.paceSec,
        points: list.map(s => ({ day: s.day, value: s.paceSec })),
      }
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'it'))
}

// ── Intensità ──────────────────────────────────────────────
// Il tempo per zona, sommato (non la media delle percentuali), letto in tre
// fasce: facile Z0-Z2, media Z3, dura Z4-Z6. La regola più usata dagli
// allenatori è «circa l'80% facile e il 20% duro»; qui non è un obiettivo, è un
// riferimento per leggere la distribuzione.

export function runIntensity(sessions) {
  const withZones = sessions.filter(s => s.zones)
  const mix = zoneMix(withZones).all
  const sh = mix.shares
  const declared = { leggera: 0, media: 0, intensa: 0, none: 0 }
  sessions.forEach(s => { declared[s.intensity in declared ? s.intensity : 'none']++ })
  return {
    n: mix.n,
    enough: mix.n >= MIN_ZONES,
    missing: Math.max(0, MIN_ZONES - mix.n),
    secs: mix.secs, total: mix.total, shares: sh,
    easy: sh[0] + sh[1] + sh[2],
    mid: sh[3],
    hard: sh[4] + sh[5] + sh[6],
    dominant: mix.dominant,
    declared,
  }
}

// ── Stimolo (training effect) e carico Garmin ──────────────

export function runStimulus(sessions) {
  const s = stimulus(sessions.filter(x => x.has)).all
  const enough = s.aerobicN >= MIN_TE
  return {
    aerobic: s.aerobic, anaerobic: s.anaerobic,
    aerobicN: s.aerobicN, anaerobicN: s.anaerobicN,
    enough, missing: Math.max(0, MIN_TE - s.aerobicN),
  }
}

export function runLoad(sessions, range) {
  const ok = sessions.filter(s => s.load != null)
  const peak = ok.reduce((b, s) => (!b || s.load > b.load ? s : b), null)
  const weekly = weekBuckets(sessions, range).map(w => ({
    start: w.start,
    load: sum(w.sessions, s => s.load),
    n: w.sessions.filter(s => s.load != null).length,
  })).slice(-CHART_WEEKS)
  const weekPeak = weekly.reduce((m, w) => Math.max(m, w.load), 0)
  return {
    n: ok.length,
    enough: ok.length >= MIN_LOAD,
    missing: Math.max(0, MIN_LOAD - ok.length),
    avg: ok.length ? sum(ok, s => s.load) / ok.length : null,
    peak: peak ? { id: peak.id, day: peak.day, load: peak.load, label: peak.label } : null,
    weekly, weekPeak,
  }
}

// ── Dinamiche di corsa ─────────────────────────────────────
// Media di ogni campo e confronto tra la prima e la seconda metà delle corse
// che lo hanno. Stride, cadenza e oscillazione cambiano con la velocità, non
// solo con la tecnica: per questo ogni metà porta il proprio passo medio, così
// chi legge vede se il «miglioramento» è solo una corsa più veloce.

export const DYNAMICS_ROWS = [
  { id: 'avgPowerW',    label: 'Potenza media',        unit: 'W',   digits: 0, better: 'up' },
  { id: 'normPowerW',   label: 'Potenza normalizzata', unit: 'W',   digits: 0, better: 'up' },
  { id: 'cadenceSpm',   label: 'Cadenza',              unit: 'spm', digits: 0, better: null },
  { id: 'strideM',      label: 'Lunghezza del passo',  unit: 'm',   digits: 2, better: null },
  { id: 'vertOscCm',    label: 'Oscillazione verticale', unit: 'cm', digits: 1, better: 'down' },
  { id: 'contactMs',    label: 'Contatto al suolo',    unit: 'ms',  digits: 0, better: 'down' },
  { id: 'vertRatioPct', label: 'Rapporto verticale',   unit: '%',   digits: 1, better: 'down' },
]

export function runDynamics(sessions) {
  const withDyn = sessions.filter(s => s.dynamics)
  const rows = DYNAMICS_ROWS.map(row => {
    const ok = withDyn.filter(s => isNum(s.dynamics[row.id]))
    const n = ok.length
    const value = n ? mean(ok.map(s => s.dynamics[row.id])) : null
    const half = Math.floor(n / 2)
    const enoughHalves = n >= MIN_DYN_HALVES && half >= MIN_PACE_SIDE
    let halves = null
    if (enoughHalves) {
      const side = (list) => ({
        n: list.length,
        value: mean(list.map(s => s.dynamics[row.id])),
        paceSec: paceOf(list),
      })
      const first = side(ok.slice(0, half)), second = side(ok.slice(n - half))
      halves = { first, second, delta: second.value - first.value }
    }
    return { ...row, n, value, enough: n >= MIN_DYNAMICS, halves }
  })
  return {
    n: withDyn.length,
    enough: withDyn.length >= MIN_DYNAMICS,
    missing: Math.max(0, MIN_DYNAMICS - withDyn.length),
    rows: rows.filter(r => r.n > 0),
  }
}

// ── Record (sull'intero storico) ───────────────────────────
// Sono fatti del presente: «la corsa più lunga che hai fatto» non cambia con il
// periodo scelto. Ogni record dice se è stato stabilito dentro il periodo.

export function runRecords(allSessions, periodIds) {
  const pick = (list, score, better) => list.reduce((b, s) => (b == null || better(score(s), score(b)) ? s : b), null)
  const row = (id, label, s, value) => s && ({
    id, label, runId: s.id, day: s.day, name: s.label, value, inPeriod: periodIds.has(s.id),
  })

  const longest = pick(allSessions.filter(s => s.km != null), s => s.km, (a, b) => a > b)
  const longestTime = pick(allSessions.filter(s => s.durationSec != null), s => s.durationSec, (a, b) => a > b)
  const fastest = pick(
    allSessions.filter(s => s.continuous && s.paceSec != null && s.km >= MIN_RECORD_KM),
    s => s.paceSec, (a, b) => a < b)
  const climb = pick(allSessions.filter(s => s.ascent != null && s.ascent > 0), s => s.ascent, (a, b) => a > b)

  return [
    row('distanza', 'Corsa più lunga', longest, longest?.km),
    row('durata', 'Corsa più lunga per tempo', longestTime, longestTime?.durationSec),
    row('passo', `Miglior passo (corsa continua, almeno ${MIN_RECORD_KM} km)`, fastest, fastest?.paceSec),
    row('dislivello', 'Più dislivello', climb, climb?.ascent),
  ].filter(Boolean)
}

// ── Report ─────────────────────────────────────────────────

export function buildRun({ runs, allRuns = runs, previousRuns = [], workouts = [], range = null }) {
  const sessions = toRunSessions(runs, workouts)
  const all = toRunSessions(allRuns, workouts)
  const previous = toRunSessions(previousRuns, workouts)
  const periodIds = new Set(sessions.map(s => s.id))
  const continuous = sessions.filter(s => s.continuous)

  const report = {
    n: sessions.length,
    total: all.length,
    enough: sessions.length >= MIN_RUN,
    missing: Math.max(0, MIN_RUN - sessions.length),
    coverage: runCoverage(sessions),
    volume: runVolume(sessions, previous, range, all),
    consistency: consistency(sessions, range, all),
    pace: paceTrend(sessions),
    schemes: schemeProgress(sessions),
    economy: cardiacEconomy(continuous.filter(s => s.has)),
    intensity: runIntensity(sessions),
    stimulus: runStimulus(sessions),
    load: runLoad(sessions, range),
    dynamics: runDynamics(sessions),
    records: runRecords(all, periodIds),
  }
  report.insights = report.enough ? runInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Stesso formato delle altre sezioni: { id, target, tone, icon, text, weight, tab }.

const one = v => v.toLocaleString('it-IT', { maximumFractionDigits: 1 })
const pace = sec => `${Math.floor(Math.round(sec) / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`

function insight(o) {
  return { ...o, tab: 'corsa' }
}

export function runInsights(r) {
  const out = []

  // Efficienza cardiaca: come in Fisico, la frase che parla di miglioramento vero.
  const h = r.economy.available ? r.economy.halves : null
  if (h && Math.abs(h.delta) >= 3) {
    const better = h.delta < 0
    out.push(insight({
      id: 'economia-corsa', target: 'economia-corsa', tone: better ? 'good' : 'bad', icon: better ? '❤️‍🔥' : '📛',
      weight: better ? 2.1 : 1.6,
      text: better
        ? `Nelle corse continue, a parità di velocità, la tua FC è scesa di ${Math.round(-h.delta)} battiti nella seconda metà del periodo: il motore sta migliorando.`
        : `Nelle corse continue, a parità di velocità, la tua FC è salita di ${Math.round(h.delta)} battiti nella seconda metà del periodo: stessa corsa, più fatica.`,
    }))
  }

  // Passo delle corse continue.
  const ph = r.pace.available ? r.pace.halves : null
  if (ph && Math.abs(ph.delta) >= 10) {
    const faster = ph.delta < 0
    out.push(insight({
      id: 'passo', target: 'passo', tone: faster ? 'good' : 'neutral', icon: faster ? '🏃' : '🐢', weight: faster ? 1.8 : 1.0,
      text: `Nelle corse continue il passo è passato da ${pace(ph.first.pace)} a ${pace(ph.second.pace)} /km (${faster ? '−' : '+'}${Math.round(Math.abs(ph.delta))} s/km).`,
    }))
  }

  // La stessa scheda: il miglioramento (o il calo) più netto.
  const moved = r.schemes.filter(s => Math.abs(s.delta) >= 0.03).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  if (moved[0]) {
    const s = moved[0]
    const faster = s.delta < 0
    out.push(insight({
      id: 'scheda', target: 'passo', tone: faster ? 'good' : 'neutral', icon: faster ? '📈' : '📉',
      weight: faster ? 1.7 + Math.min(0.3, Math.abs(s.delta)) : 0.9,
      text: `«${s.name}»: passo medio da ${pace(s.first.paceSec)} a ${pace(s.last.paceSec)} /km in ${s.n} esecuzioni (${faster ? 'più veloce' : 'più lento'} del ${Math.round(Math.abs(s.delta) * 100)}%).`,
    }))
  }

  // Distribuzione dell'intensità.
  const it = r.intensity
  if (it.enough && it.hard >= 0.3) {
    out.push(insight({
      id: 'intensita-corsa', target: 'intensita-corsa', tone: 'neutral', icon: '🔥', weight: 1.1,
      text: `Il ${Math.round(it.hard * 100)}% del tuo tempo di corsa è in Z4-Z6: la regola più usata è circa il 20% duro e l'80% facile.`,
    }))
  }

  // Volume contro il periodo precedente.
  const v = r.volume
  if (v.deltaKm != null && Math.abs(v.deltaKm) >= 0.25) {
    const up = v.deltaKm > 0
    out.push(insight({
      id: 'volume-corsa', target: 'volume-corsa', tone: up ? 'good' : 'neutral', icon: up ? '👟' : '🛌', weight: 1.1,
      text: up
        ? `Hai corso il ${Math.round(v.deltaKm * 100)}% di chilometri in più rispetto al periodo precedente.`
        : `Hai corso il ${Math.round(-v.deltaKm * 100)}% di chilometri in meno rispetto al periodo precedente.`,
    }))
  }

  // Inattività: un fatto del presente.
  const c = r.consistency
  if (r.total >= 6 && c.sinceLast != null && c.sinceLast >= STALE_DAYS) {
    out.push(insight({
      id: 'ferma-corsa', target: 'costanza-corsa', tone: 'neutral', icon: '⏸', weight: Math.min(1.5, 0.8 + c.sinceLast / 100),
      text: `Non corri da ${c.sinceLast} giorni.`,
    }))
  }

  // Record battuti nel periodo.
  if (r.total >= MIN_RECORDS) {
    const rec = r.records.find(x => x.id === 'distanza' && x.inPeriod)
    if (rec) {
      out.push(insight({
        id: 'record-corsa', target: 'record', tone: 'good', icon: '🏅', weight: 1.2,
        text: `La tua corsa più lunga di sempre l'hai fatta in questo periodo: ${one(rec.value)} km.`,
      }))
    }
  }

  // Copertura: un avvertimento sulla lettura di tutto il resto.
  const cv = r.coverage
  if (cv.total >= 6 && cv.share != null && cv.share < 0.5) {
    out.push(insight({
      id: 'copertura-corsa', target: 'copertura-corsa', tone: 'neutral', icon: 'ℹ️', weight: 0.3,
      text: `Solo ${cv.n} corse su ${cv.total} hanno dati dell'orologio: la sezione Corsa descrive quelle.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Helpers ────────────────────────────────────────────────

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function sum(list, pick) {
  return (list || []).reduce((s, x) => s + (pick(x) || 0), 0)
}

function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

// Passo sui totali delle corse che hanno distanza e durata, o null.
function paceOf(list) {
  const ok = list.filter(s => s.km != null && s.durationSec != null)
  const km = sum(ok, s => s.km)
  return km > 0 ? sum(ok, s => s.durationSec) / km : null
}
