// ── Dati atletici della partita ─────────────────────────────
// Modulo puro (nessun React, nessun Firestore) condiviso dal wizard e dal
// dettaglio match, come tennis.js e wear.js.
//
// Tutti i campi sono FACOLTATIVI: l'utente li trascrive a mano da orologio o
// app (Garmin, Apple Watch, Polar, Strava...), quindi qualunque sottoinsieme è
// valido e ciò che non compila resta `null`. Un match senza dati atletici ha
// `athletics: null` — i match registrati prima di questa feature non hanno il
// campo affatto, e vanno trattati allo stesso modo.
//
// Unità canoniche persistite su Firestore (mai formattate a DB):
//   distanceKm      km decimali          2.54
//   durationSec     secondi interi       3406  (= 56:46)
//   calories        kcal intere          525
//   avgHr / maxHr   bpm interi           130 / 168
//   trainingEffect  scala Garmin 0..5    3.4  (effetto aerobico)
//   anaerobicTrainingEffect  scala Garmin 0..5  1.8  (effetto anaerobico)
//   zones           [s×7] secondi per zona 0..6 (come Garmin), oppure null
//
// Campi che arrivano SOLO dall'import del file .FIT (facoltativi, `null` se
// la sessione è trascritta a mano):
//   trainingLoad    carico Garmin (EPOC), 1 decimale     140.6
//   maxSpeedKmh     velocità massima                     12.8
//   ascentM/descentM  dislivello in metri interi         33
//   hrBounds        [bpm×6] confini superiori delle zone 0..5 (la 6 è aperta)
//   dynamics        potenza, cadenza e dinamiche di corsa (solo corsa)
//   source          'fit' = misurato dall'orologio; assente = trascritto
//   fitId           identità del file importato (id del documento fitDetails)

// Zone di frequenza cardiaca: le 7 fasce che l'orologio Garmin registra nel
// file (`time_in_zone`): sotto la Z1, le cinque zone, sopra la Z5. L'indice
// nell'array è il numero della zona (0 = riposo, 6 = oltre il massimo): è lo
// stesso vocabolario delle zone di passo del Profilo e dei target delle fasi
// di corsa (`z0`…`z6`). I colori sono token definiti in index.css.
export const HR_ZONES = [
  { id: 0, label: 'Z0', name: 'Riposo',           color: 'var(--color-zone-0)' },
  { id: 1, label: 'Z1', name: 'Riscaldamento',    color: 'var(--color-zone-1)' },
  { id: 2, label: 'Z2', name: 'Facile',           color: 'var(--color-zone-2)' },
  { id: 3, label: 'Z3', name: 'Aerobica',         color: 'var(--color-zone-3)' },
  { id: 4, label: 'Z4', name: 'Soglia',           color: 'var(--color-zone-4)' },
  { id: 5, label: 'Z5', name: 'Massimale',        color: 'var(--color-zone-5)' },
  { id: 6, label: 'Z6', name: 'Oltre il massimo', color: 'var(--color-zone-6)' },
]

// Limiti di plausibilità per gli input del wizard. Non sono vincoli di dominio
// "veri", servono solo a intercettare errori di battitura evidenti.
export const ATHLETIC_LIMITS = {
  distanceKm:     { min: 0, max: 100,   step: 0.01 },
  calories:       { min: 0, max: 10000, step: 1 },
  hr:             { min: 20, max: 250,  step: 1 },
  trainingEffect: { min: 0, max: 5,     step: 0.1 },
  anaerobicTrainingEffect: { min: 0, max: 5, step: 0.1 },
  durationHours:  { min: 0, max: 23 },
}

// ── Costruzione e normalizzazione ──────────────────────────

export function emptyAthletics() {
  return {
    distanceKm: null,
    durationSec: null,
    calories: null,
    avgHr: null,
    maxHr: null,
    trainingEffect: null,
    anaerobicTrainingEffect: null,
    zones: null,
    trainingLoad: null,
    maxSpeedKmh: null,
    ascentM: null,
    descentM: null,
    hrBounds: null,
    dynamics: null,
    source: null,
    fitId: null,
  }
}

// Draft per gli editor: i dati salvati prima delle 7 zone avevano 5 posizioni
// (Z1…Z5), qui diventano 7 così le righe del form combaciano con l'indice.
export function athleticsDraft(a) {
  return { ...emptyAthletics(), ...(a || {}), zones: readZones(a?.zones) }
}

// Accetta il draft del wizard (o un documento legacy) e restituisce l'oggetto
// canonico da persistere, oppure `null` se non c'è nemmeno un dato compilato —
// così su Firestore non finiscono oggetti pieni di null.
export function normalizeAthletics(a) {
  if (!a) return null

  const zones = normalizeZones(a.zones)
  const out = {
    distanceKm:     round(clampTo(a.distanceKm, ATHLETIC_LIMITS.distanceKm), 2),
    durationSec:    intOrNull(a.durationSec, 0, 24 * 3600),
    calories:       intOrNull(a.calories, ATHLETIC_LIMITS.calories.min, ATHLETIC_LIMITS.calories.max),
    avgHr:          intOrNull(a.avgHr, ATHLETIC_LIMITS.hr.min, ATHLETIC_LIMITS.hr.max),
    maxHr:          intOrNull(a.maxHr, ATHLETIC_LIMITS.hr.min, ATHLETIC_LIMITS.hr.max),
    trainingEffect: round(clampTo(a.trainingEffect, ATHLETIC_LIMITS.trainingEffect), 1),
    anaerobicTrainingEffect: round(clampTo(a.anaerobicTrainingEffect, ATHLETIC_LIMITS.anaerobicTrainingEffect), 1),
    zones,
    trainingLoad: round(clampTo(a.trainingLoad, { min: 0, max: 2000 }), 1),
    maxSpeedKmh:  round(clampTo(a.maxSpeedKmh, { min: 0, max: 100 }), 1),
    ascentM:      intOrNull(a.ascentM, 0, 20000),
    descentM:     intOrNull(a.descentM, 0, 20000),
    hrBounds:     normalizeBounds(a.hrBounds),
    dynamics:     normalizeDynamics(a.dynamics),
    source:       a.source === 'fit' ? 'fit' : null,
    fitId:        typeof a.fitId === 'string' && a.fitId ? a.fitId : null,
  }
  return hasAthletics(out) ? out : null
}

// Le zone si leggono sempre a 7 posizioni. I documenti salvati con la tabella
// a 5 zone (Z1…Z5) vengono riportati in forma: Z0 e Z6 a zero. Ritorna null se
// non è un array.
export function readZones(zones) {
  if (!Array.isArray(zones)) return null
  if (zones.length === 5) return [0, ...zones, 0]
  return HR_ZONES.map((_, i) => zones[i] ?? 0)
}

// 7 durate in secondi, o null se nessuna zona è compilata.
function normalizeZones(zones) {
  const z = readZones(zones)
  if (!z) return null
  const filled = z.map(v => intOrNull(v, 0, 24 * 3600) ?? 0)
  return filled.some(v => v > 0) ? filled : null
}

function normalizeBounds(b) {
  if (!Array.isArray(b) || b.length < 6) return null
  const out = b.slice(0, 6).map(v => intOrNull(v, 0, 250))
  return out.every(v => v !== null) ? out : null
}

const DYNAMICS_FIELDS = {
  avgPowerW: [0, 2000], maxPowerW: [0, 3000], normPowerW: [0, 2000],
  cadenceSpm: [0, 300], strideM: [0, 5], vertOscCm: [0, 50],
  contactMs: [0, 1000], vertRatioPct: [0, 30],
}

function normalizeDynamics(d) {
  if (!d || typeof d !== 'object') return null
  const out = {}
  let any = false
  Object.entries(DYNAMICS_FIELDS).forEach(([key, [min, max]]) => {
    const v = round(clampTo(d[key], { min, max }), 2)
    out[key] = v
    if (v !== null) any = true
  })
  return any ? out : null
}

export function hasAthletics(a) {
  if (!a) return false
  return [a.distanceKm, a.durationSec, a.calories, a.avgHr, a.maxHr, a.trainingEffect, a.anaerobicTrainingEffect]
    .some(v => v !== null && v !== undefined) || zonesTotalSec(a.zones) > 0
}

// ── Validazione ────────────────────────────────────────────

// Incoerenze che sono quasi certamente errori di trascrizione. Ritorna un array
// di messaggi (vuoto = tutto ok); il wizard blocca il salvataggio finché non è
// vuoto, perché un dato sbagliato qui inquinerebbe le statistiche future.
export function athleticsIssues(a) {
  if (!a) return []
  const issues = []

  if (isNum(a.avgHr) && isNum(a.maxHr) && a.avgHr > a.maxHr) {
    issues.push('La frequenza cardiaca media non può superare la massima.')
  }

  const zonesTotal = zonesTotalSec(a.zones)
  // 5 secondi di tolleranza: i secondi del file sono arrotondati zona per zona.
  if (zonesTotal > 0 && isNum(a.durationSec) && zonesTotal > a.durationSec + 5) {
    issues.push('Il tempo totale nelle zone supera la durata della sessione.')
  }

  return issues
}

// ── Valori derivati ────────────────────────────────────────

export function zonesTotalSec(zones) {
  if (!Array.isArray(zones)) return 0
  return zones.reduce((sum, v) => sum + (isNum(v) ? v : 0), 0)
}

// Percentuale di ogni zona sul totale delle zone (non sulla durata del match:
// l'orologio può non coprire tutta la partita). Sempre a 7 posizioni.
export function zonePercents(zones) {
  const z = readZones(zones)
  const total = zonesTotalSec(z)
  if (total <= 0) return HR_ZONES.map(() => 0)
  return HR_ZONES.map((_, i) => ((z?.[i] || 0) / total) * 100)
}

// Velocità media in km/h, derivata: non si inserisce a mano perché è già
// implicita in distanza + durata.
export function avgSpeedKmh(a) {
  if (!a || !isNum(a.distanceKm) || !isNum(a.durationSec) || a.durationSec <= 0) return null
  return (a.distanceKm / a.durationSec) * 3600
}

// Scala del Training Effect di Garmin (0..5) — condivisa da aerobico e
// anaerobico: stessa suddivisione a soglie, cambia solo quale valore passi.
export function trainingEffectLabel(v) {
  if (!isNum(v)) return null
  if (v < 1) return 'Nessun effetto'
  if (v < 2) return 'Effetto minore'
  if (v < 3) return 'Mantenimento'
  if (v < 4) return 'Miglioramento'
  if (v < 5) return 'Forte miglioramento'
  return 'Eccessivo'
}

// ── Conversione durata ─────────────────────────────────────

export function splitDuration(sec) {
  const total = isNum(sec) ? Math.max(0, Math.round(sec)) : 0
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

// Ritorna null se tutte e tre le parti sono a zero, così un campo lasciato
// vuoto non diventa "0 secondi".
export function joinDuration(h, m, s) {
  const total = (num(h) || 0) * 3600 + (num(m) || 0) * 60 + (num(s) || 0)
  return total > 0 ? total : null
}

// ── Formattazione (display) ────────────────────────────────

// "56:46" sotto l'ora, "1:05:30" sopra.
export function formatDuration(sec) {
  if (!isNum(sec)) return '—'
  const { h, m, s } = splitDuration(sec)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function formatDistance(km) {
  if (!isNum(km)) return '—'
  return `${km.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}

export function formatSpeed(kmh) {
  if (!isNum(kmh)) return '—'
  return `${kmh.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/h`
}

export function formatCalories(kcal) {
  return isNum(kcal) ? `${Math.round(kcal).toLocaleString('it-IT')} kcal` : '—'
}

export function formatHr(bpm) {
  return isNum(bpm) ? `${Math.round(bpm)} bpm` : '—'
}

export function formatTrainingEffect(v) {
  if (!isNum(v)) return '—'
  return v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// ── Helpers ────────────────────────────────────────────────

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

// Converte input utente (stringa con virgola o punto) in numero, o null.
function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function clampTo(v, { min, max }) {
  const n = num(v)
  if (n === null) return null
  return Math.min(max, Math.max(min, n))
}

function intOrNull(v, min, max) {
  const n = num(v)
  if (n === null) return null
  return Math.round(Math.min(max, Math.max(min, n)))
}

function round(v, decimals) {
  if (v === null) return null
  const f = 10 ** decimals
  return Math.round(v * f) / f
}
