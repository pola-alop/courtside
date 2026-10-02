// ── Statistiche dai dettagli del .FIT (lap e serie) ─────────
// Modulo puro (nessun React, nessun Firestore). Il riassunto in `athletics`
// basta alle statistiche di Corsa, Palestra e Fisico; queste invece hanno
// bisogno di ciò che sta in `users/{uid}/fitDetails/{fitId}` — i lap per fase e
// le serie sottocampionate — e si leggono un documento per volta (vedi
// `useFitDetailsBatch`). Qui si lavora su documenti GIÀ letti.
//
// Tre analisi:
//  · tenuta nelle ripetute  — il passo della prima contro l'ultima ripetizione;
//  · deriva cardiaca        — FC/velocità nella seconda metà contro la prima, nelle
//                             corse continue (il «disaccoppiamento» classico);
//  · FC per terzi di partita — come cambia il battito dall'inizio alla fine.
//
// ── Soglie STATICHE, per scelta dell'utente (2026-10-02) ──
// Non si ricalibrano sui suoi dati: una soglia di lettura calcolata sulle sole
// derive dell'utente segnalerebbe «alta» sempre la sua parte peggiore, qualunque
// sia il valore vero. Le soglie di validità definiscono quando un dato è
// misurabile; quelle di lettura (parole come «stabile») sono valori di partenza
// da ritarare a mano con più dati. Tarate su due corse a ripetute e una partita
// reali: nessuna corsa continua con .FIT era disponibile, quindi le soglie della
// deriva sono quelle comuni in letteratura e non sono state verificate sui dati.
//
// ── Cosa NON si legge ──
// Il recupero tra i punti nel tennis: la serie ha un campione ogni 5-10 s.

import { lapPaceSec } from './fit'

// ── Soglie ─────────────────────────────────────────────────
// Validità
export const MIN_LAP_SEC          = 15    // un lap più corto è dominato dall'avvio da fermo (la prima ripetizione di 10 s va 3 km/h più piano delle altre)
export const MIN_LAP_M            = 20    // sotto, il passo è rumore del GPS
export const MIN_REPS             = 3     // ripetizioni dello stesso step perché se ne legga la tenuta
export const MIN_SCHEME_SESSIONS  = 3     // sessioni della stessa scheda per il confronto nel tempo
export const DRIFT_WARMUP_SEC     = 600   // i primi 10 minuti non entrano nella deriva
export const DRIFT_MIN_SEC        = 1200  // tempo valido minimo (20 minuti) per misurarla
export const DRIFT_MIN_KMH10      = 60    // 6 km/h, in 0,1 km/h come la serie: sotto è cammino o sosta
export const THIRDS_MIN_SEC       = 1200  // durata minima di una partita per dividerla in terzi
export const THIRDS_MIN_SAMPLES   = 3     // campioni di FC in ogni terzo
export const MIN_DRIFT_N          = 3     // sessioni per dire una media
export const MAX_FIT_SESSIONS     = 40    // sessioni lette per blocco (le più recenti del periodo)
// Lettura
export const HOLD_TOLERANCE_PCT   = 3     // entro ±3% sul passo la tenuta «regge»
export const DRIFT_STABLE_PCT     = 5     // sotto: stabile
export const DRIFT_HIGH_PCT       = 10    // sopra: alta
export const THIRDS_TOLERANCE_BPM = 3     // entro ±3 bpm tra primo e ultimo terzo il battito «resta»

// ── Quali sessioni leggere ─────────────────────────────────
// Solo quelle col `fitId`, le ultime `max` in ordine cronologico. `total` dice
// quante ce n'erano, perché il tetto va dichiarato.

export function pickLatest(sessions, max = MAX_FIT_SESSIONS) {
  const withFit = sessions.filter(s => s.fitId).sort((a, b) => a.day - b.day)
  return { list: withFit.slice(-max), total: withFit.length, capped: withFit.length > max }
}

// ── Tenuta nelle ripetute ──────────────────────────────────
// Le ripetizioni dello stesso step della scheda (`step` del lap) con `kind`
// 'active'. Il riscaldamento e gli esercizi (kind 'warmup') non sono ripetute di
// lavoro. Una sessione ha più blocchi, uno per step.
//
// Passo: prima contro ULTIMA ripetizione. FC: dalla SECONDA all'ultima, perché
// la prima parte dal recupero precedente (nei dati reali 109 bpm contro 147 nelle
// altre) e confrontarla direbbe solo quanto ti eri riposato.

export function repeatHold(laps) {
  const groups = new Map()
  ;(laps || []).forEach(l => {
    if (l?.kind !== 'active' || !Number.isInteger(l.step)) return
    if (!(l.sec >= MIN_LAP_SEC) || !(l.m >= MIN_LAP_M) || lapPaceSec(l) == null) return
    if (!groups.has(l.step)) groups.set(l.step, [])
    groups.get(l.step).push(l)
  })

  const blocks = []
  groups.forEach((reps, step) => {
    if (reps.length < MIN_REPS) return
    const paces = reps.map(lapPaceSec)
    const first = paces[0], last = paces[paces.length - 1]
    const deltaPct = round1(((last - first) / first) * 100)
    const hrFrom = reps[1].hr, hrTo = reps[reps.length - 1].hr
    blocks.push({
      step, n: reps.length, label: blockLabel(reps),
      paces, firstPace: first, lastPace: last,
      deltaSec: last - first, deltaPct,
      verdict: holdVerdict(deltaPct),
      hrFrom: isNum(hrFrom) ? hrFrom : null,
      hrTo: isNum(hrTo) ? hrTo : null,
      hrDelta: isNum(hrFrom) && isNum(hrTo) ? hrTo - hrFrom : null,
    })
  })
  return blocks.sort((a, b) => a.step - b.step)
}

// Passo più alto = più lento: positivo = la tenuta cala.
export function holdVerdict(deltaPct) {
  if (deltaPct > HOLD_TOLERANCE_PCT) return 'fades'
  if (deltaPct < -HOLD_TOLERANCE_PCT) return 'improves'
  return 'holds'
}

// «8 × 50″» se le ripetizioni hanno la stessa durata, «4 × 100 m» se la stessa
// distanza (con la distanza è il tempo a variare), altrimenti «5 ripetute».
function blockLabel(reps) {
  const n = reps.length
  const same = (vals, tol) => vals.every(v => Math.abs(v - vals[0]) <= tol)
  const secs = reps.map(r => r.sec), ms = reps.map(r => r.m)
  if (same(secs, 0.6)) return `${n} × ${fmtSec(mean(secs))}`
  if (same(ms, Math.max(2, ms[0] * 0.02))) {
    const m = mean(ms)
    return `${n} × ${m >= 1000 ? `${(m / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`}`
  }
  return `${n} ripetute`
}

function fmtSec(sec) {
  const s = Math.round(sec)
  return s < 60 ? `${s}″` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Le sessioni a ripetute con i loro blocchi. `byId` = { fitId: dettagli | null }.
// `missing` = senza documento dei dettagli; `noBlocks` = documento letto ma senza
// nemmeno un blocco leggibile (ripetute troppo brevi, o meno di MIN_REPS).
export function holdReport(sessions, byId) {
  const rows = []
  let missing = 0, noBlocks = 0
  sessions.forEach(s => {
    const d = byId[s.fitId]
    if (!d) { missing++; return }
    const blocks = repeatHold(d.laps)
    if (blocks.length === 0) { noBlocks++; return }
    rows.push({
      id: s.id, day: s.day, label: s.label, schemeKey: s.schemeKey,
      blocks, deltaPct: mean(blocks.map(b => b.deltaPct)),
    })
  })

  // La stessa scheda nel tempo: come cambia la tenuta media di una scheda
  // eseguita più volte. Una scheda senza nome (`schemeKey` null) non si raggruppa.
  const byScheme = new Map()
  rows.forEach(r => {
    if (!r.schemeKey) return
    if (!byScheme.has(r.schemeKey)) byScheme.set(r.schemeKey, [])
    byScheme.get(r.schemeKey).push(r)
  })
  const schemes = []
  byScheme.forEach((list, key) => {
    if (list.length < MIN_SCHEME_SESSIONS) return
    const points = list.map(r => ({ day: r.day, value: r.deltaPct }))
    schemes.push({
      key, name: list[list.length - 1].label, n: list.length, points,
      first: points[0].value, last: points[points.length - 1].value,
    })
  })

  return {
    n: rows.length, rows, missing, noBlocks, schemes,
    deltaPct: rows.length ? mean(rows.map(r => r.deltaPct)) : null,
  }
}

// ── Deriva cardiaca (corse continue) ───────────────────────
// Il disaccoppiamento: il rapporto FC/velocità della seconda metà contro la
// prima. Su un'andatura costante una condizione aerobica solida lo tiene quasi
// fermo; sale quando il cuore deve lavorare di più per la stessa velocità.
// Si guarda il solo tempo in movimento (sopra DRIFT_MIN_KMH10, dopo il
// riscaldamento) e le metà sono per campioni validi, non per orologio.

export function cardiacDrift(details) {
  const hr = details?.series?.hr, speed = details?.series?.speed, step = details?.step
  if (!Array.isArray(hr) || !Array.isArray(speed) || !(step > 0)) return { ok: false, reason: 'noseries' }

  const pts = []
  const n = Math.min(hr.length, speed.length)
  for (let i = 0; i < n; i++) {
    if (i * step < DRIFT_WARMUP_SEC) continue
    const h = hr[i], v = speed[i]
    if (!isNum(h) || h <= 0 || !isNum(v) || v < DRIFT_MIN_KMH10) continue
    pts.push({ h, v: v / 10 })
  }
  const validSec = pts.length * step
  if (validSec < DRIFT_MIN_SEC) return { ok: false, reason: 'short', validSec }

  const half = Math.floor(pts.length / 2)
  const side = (list) => ({ hr: mean(list.map(p => p.h)), kmh: mean(list.map(p => p.v)) })
  const first = side(pts.slice(0, half)), second = side(pts.slice(pts.length - half))
  const driftPct = round1(((second.hr / second.kmh) / (first.hr / first.kmh) - 1) * 100)
  return { ok: true, driftPct, first, second, validSec, verdict: driftVerdict(driftPct) }
}

// Un valore negativo (stessa velocità con meno battiti) è «stabile»: la parola
// avverte solo di chi sale.
export function driftVerdict(driftPct) {
  if (driftPct > DRIFT_HIGH_PCT) return 'high'
  if (driftPct > DRIFT_STABLE_PCT) return 'moderate'
  return 'stable'
}

export function driftReport(sessions, byId) {
  const rows = []
  let missing = 0, short = 0
  sessions.forEach(s => {
    const d = byId[s.fitId]
    if (!d) { missing++; return }
    const r = cardiacDrift(d)
    if (!r.ok) { short++; return }
    rows.push({ id: s.id, day: s.day, label: s.label, km: s.km, ...r })
  })
  return {
    n: rows.length, rows, missing, short,
    driftPct: rows.length >= MIN_DRIFT_N ? mean(rows.map(r => r.driftPct)) : null,
  }
}

// ── FC per terzi di partita ────────────────────────────────
// Si divide l'intera serie (riscaldamento e pause comprese: non c'è modo
// onesto di separarli dal file) in tre parti uguali per tempo. Dice come cambia
// il battito, non perché: la stanchezza lo alza, ma anche un game combattuto.

export function hrByThirds(details) {
  const hr = details?.series?.hr, step = details?.step
  if (!Array.isArray(hr) || !(step > 0)) return { ok: false, reason: 'noseries' }
  const durationSec = hr.length * step
  if (durationSec < THIRDS_MIN_SEC) return { ok: false, reason: 'short', durationSec }

  const size = hr.length / 3
  const thirds = [0, 1, 2].map(k => {
    const vals = hr.slice(Math.round(k * size), Math.round((k + 1) * size)).filter(v => isNum(v) && v > 0)
    return vals.length >= THIRDS_MIN_SAMPLES ? mean(vals) : null
  })
  if (thirds.some(v => v == null)) return { ok: false, reason: 'gaps', durationSec }

  // Il delta è tra i valori arrotondati che si leggono, così il numero mostrato
  // e la parola che lo accompagna non si contraddicono mai (+3 «resta», +4 «sale»).
  const shown = thirds.map(Math.round)
  const deltaBpm = shown[2] - shown[0]
  return { ok: true, thirds: shown, deltaBpm, deltaPct: round1((deltaBpm / shown[0]) * 100), durationSec, verdict: thirdsVerdict(deltaBpm) }
}

export function thirdsVerdict(deltaBpm) {
  if (deltaBpm > THIRDS_TOLERANCE_BPM) return 'rises'
  if (deltaBpm < -THIRDS_TOLERANCE_BPM) return 'falls'
  return 'steady'
}

export function thirdsReport(sessions, byId) {
  const rows = []
  let missing = 0, short = 0
  sessions.forEach(s => {
    const d = byId[s.fitId]
    if (!d) { missing++; return }
    const r = hrByThirds(d)
    if (!r.ok) { short++; return }
    rows.push({ id: s.id, day: s.day, label: s.label, ...r })
  })
  const enough = rows.length >= MIN_DRIFT_N
  return {
    n: rows.length, rows, missing, short,
    thirds: enough ? [0, 1, 2].map(k => mean(rows.map(r => r.thirds[k]))) : null,
    deltaBpm: enough ? mean(rows.map(r => r.deltaBpm)) : null,
  }
}

// ── Helpers ────────────────────────────────────────────────

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

// Un decimale: è ciò che si mostra, e le soglie si applicano a questo.
function round1(v) {
  return Math.round(v * 10) / 10
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length
}
