import { matchMinutes, hasRealDuration } from './tennis'
import { totalMinutes } from './training'
import {
  toSessions, currentRhythm, loadStatus, todayTime,
  ACWR_MAX, ACWR_HIGH, MONOTONY_HIGH,
} from './activity'
import { toFocusSessions, neglect, NEGLECT_BAD } from './technique'
import { computeWear } from './wear'

// Il report della Home — "adesso", niente altro.
//
// ── Perché questo modulo esiste, e perché non usa i cinque `build*` ──
// La Home potrebbe pescare i suoi avvisi dagli insight già calcolati da Stats,
// ma quelli nascono da cinque report completi (rendimento, attività, tecnica,
// fisico, setup): costruirli tutti all'apertura dell'app per stampare tre righe
// significherebbe pagare la pagina più pesante del progetto sulla schermata di
// ingresso. Qui si fanno i tre controlli mirati che servono davvero —
// `computeWear`, `loadStatus`, `neglect` — riusando le stesse funzioni pure,
// quindi senza una seconda verità: se cambia la soglia in `wear.js`, cambia
// anche l'avviso in Home.
//
// ── La regola che decide cosa può stare qui ──
// La Home non ha selettore di periodo e non ne avrà uno. Tutto ciò che mostra è
// vero ADESSO: usura, carico, trascuratezza, ritmo, ultima sessione, totali di
// sempre. Un numero che ha bisogno di una finestra temporale per avere senso
// appartiene alla Panoramica (30 giorni mobili) o a Stats (periodo scelto), non
// a questa pagina — è la stessa divisione dei ruoli che tiene separate quelle
// due, portata un piano più su.

export const STRIP_DAYS = 14   // giorni della striscia di continuità
export const MAX_ALERTS = 3    // oltre, il blocco "Da sistemare" diventa rumore
export const IDLE_WARN  = 7    // giorni dall'ultima sessione: da qui l'header si accende
export const IDLE_BAD   = 14

// Toni degli avvisi. Ricalcano `wearLevelMeta` (stessi boxBg/color) perché un
// avviso di usura e uno di carico devono avere lo stesso peso visivo: chi legge
// non deve dedurre da un colore diverso che uno dei due conta meno.
export const ALERT_TONES = {
  high: { color: '#ff7070',                  bg: 'rgba(220,80,80,0.12)' },
  warn: { color: 'var(--color-amber-light)', bg: 'rgba(244,163,0,0.12)' },
}

export function buildHome({ matches = [], trainings = [], equipment = [] }) {
  const sessions = toSessions(matches, trainings)
  const rhythm   = currentRhythm(sessions)
  const load     = loadStatus(sessions)
  const focusSessions = toFocusSessions(trainings)
  const missed   = focusSessions.length ? neglect(focusSessions) : null

  // Solo i capi attivi: un capo archiviato non è un problema da risolvere.
  const wearRows = (equipment || [])
    .filter(e => e.active !== false)
    .map(item => ({ item, wear: computeWear(item, matches, trainings) }))
    .filter(x => x.wear && x.wear.ratio != null)

  return {
    rhythm,
    idle: idleLevel(rhythm.sinceLast),
    alerts: buildAlerts({ wearRows, load, missed }),
    // Il "tutto a posto" si può dire solo per i controlli che hanno avuto i dati
    // per girare: dichiarare che va tutto bene senza aver potuto verificare
    // niente è il modo più veloce di rendere questo blocco inaffidabile.
    checks: {
      wear:      wearRows.length > 0,
      load:      load.available,
      technique: Boolean(missed?.rows.length),
    },
    last: lastSession(matches, trainings),
    strip: buildStrip(sessions),
    career: buildCareer(matches, trainings),
  }
}

// ── Avvisi ─────────────────────────────────────────────────
// Ogni avviso è una riga azionabile con la sua destinazione: la Home non spiega
// il problema, porta dove il problema si guarda per intero. Il peso decide
// l'ordine (come per gli insight di Stats) e taglia la coda a MAX_ALERTS: tre
// righe si leggono, sei si saltano.

function buildAlerts({ wearRows, load, missed }) {
  const out = []

  // ── Materiale ──
  wearRows
    .filter(x => x.wear.level === 'high')
    .forEach(({ item, wear }) => out.push({
      id: `wear-${item.id}`,
      // Il ratio spareggia tra due capi entrambi oltre soglia: prima il più consumato.
      weight: 90 + Math.min(9, wear.ratio),
      tone: 'high',
      icon: wear.kind === 'shoes' ? '👟' : wear.kind === 'strings' ? '🎾' : '👕',
      title: itemName(item),
      sub: `${wear.label} · ${wear.percent}%`,
      to: `/equipment?item=${item.id}`,
    }))

  // ── Carico ──
  // Solo l'eccesso. "Sotto carico" è vero anche in una settimana di riposo
  // voluta, e quando è davvero un problema lo dice già la riga dei giorni
  // dall'ultima sessione, in cima alla pagina.
  if (load.available && load.ratio != null) {
    if (load.ratio > ACWR_HIGH) {
      out.push({
        id: 'load-spike', weight: 100, tone: 'high', icon: '📈',
        title: 'Picco di carico',
        sub: `Questa settimana ${percentOver(load.ratio)} sopra la tua media delle 4 settimane`,
        to: '/stats?tab=attivita&focus=carico',
      })
    } else if (load.ratio > ACWR_MAX) {
      out.push({
        id: 'load-high', weight: 70, tone: 'warn', icon: '📈',
        title: 'Carico in salita',
        sub: `Questa settimana ${percentOver(load.ratio)} sopra la tua media delle 4 settimane`,
        to: '/stats?tab=attivita&focus=carico',
      })
    }

    // La monotonia è un fatto diverso dall'ACWR — stesso volume tutti i giorni,
    // nessuno scarico vero — ma con l'ACWR già fuori fascia sarebbero due righe
    // sullo stesso argomento, e la prima è la più urgente.
    if (load.ratio <= ACWR_MAX && load.monotony != null && load.monotony >= MONOTONY_HIGH) {
      out.push({
        id: 'load-monotony', weight: 50, tone: 'warn', icon: '🔁',
        title: 'Nessun giorno di scarico',
        sub: 'Il carico è distribuito uguale su tutta la settimana',
        to: '/stats?tab=attivita&focus=carico',
      })
    }
  }

  // ── Tecnica ──
  // `neglect.worst` è già filtrato su ciò che faceva parte del lavoro abituale
  // (almeno 2 sessioni): un colpo provato una volta sei mesi fa non è un colpo
  // che hai smesso di allenare.
  if (missed?.worst) {
    const w = missed.worst
    out.push({
      id: `neglect-${w.id}`,
      weight: w.days >= NEGLECT_BAD ? 60 : 40,
      tone: 'warn',
      icon: w.categoryIcon || '🎯',
      title: w.label,
      sub: `${w.days} giorni che non lo lavori`,
      to: '/stats?tab=tecnica&focus=trascuratezza',
    })
  }

  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_ALERTS)
}

// ── Ritmo ──────────────────────────────────────────────────
// Non è un avviso della lista ma il tono dell'header: metterlo anche tra gli
// avvisi vorrebbe dire dire due volte la stessa cosa a 200px di distanza.

function idleLevel(sinceLast) {
  if (sinceLast == null) return { level: 'none', color: 'var(--color-slate)' }
  if (sinceLast >= IDLE_BAD)  return { level: 'bad',  color: 'var(--color-loss)'  }
  if (sinceLast >= IDLE_WARN) return { level: 'warn', color: 'var(--color-amber)' }
  return { level: 'ok', color: 'var(--color-slate)' }
}

// ── Ultima sessione ────────────────────────────────────────
// Dà contesto all'azione che sta sopra ("l'ultima volta ho lavorato sul
// servizio") senza entrare in Matches. A parità di giorno viene prima la
// partita, come nell'agenda della Panoramica.

function lastSession(matches, trainings) {
  const candidates = []

  const lastMatch = mostRecent(matches)
  if (lastMatch) candidates.push({ kind: 'match', item: lastMatch, day: dayTime(lastMatch.date) })

  const lastTraining = mostRecent(trainings)
  if (lastTraining) candidates.push({ kind: 'training', item: lastTraining, day: dayTime(lastTraining.date) })

  if (!candidates.length) return null

  const best = candidates.sort((a, b) => b.day - a.day || (a.kind === 'match' ? -1 : 1))[0]
  return { ...best, days: Math.max(0, Math.round((todayTime() - best.day) / 86400000)) }
}

function mostRecent(list) {
  let best = null
  let bestDay = null
  ;(list || []).forEach(x => {
    const day = dayTime(x.date)
    if (day == null) return
    if (bestDay == null || day > bestDay) { best = x; bestDay = day }
  })
  return best
}

// ── Striscia di continuità ─────────────────────────────────
// Gli ultimi STRIP_DAYS giorni fino a oggi, una cella per giorno. Stesso codice
// colore della striscia di densità della Panoramica (ambra = partita, teal =
// allenamento, gradiente = entrambi): due strisce con due grammatiche diverse
// nella stessa app costringerebbero a impararle entrambe.

function buildStrip(sessions) {
  const today = todayTime()
  const byDay = new Map()
  sessions.forEach(s => {
    const row = byDay.get(s.day) || { match: false, training: false }
    if (s.kind === 'match') row.match = true
    else row.training = true
    byDay.set(s.day, row)
  })

  const out = []
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const row = byDay.get(day) || { match: false, training: false }
    out.push({ day, ...row })
  }
  return out
}

// ── Carriera ───────────────────────────────────────────────
// I totali di sempre. Non è analisi — quella è di Stats, che sa confrontarli con
// un periodo — è l'identità: "ecco quanto tennis hai messo qui dentro".

function buildCareer(matches, trainings) {
  const minutes = (matches || []).reduce((sum, m) => sum + matchMinutes(m), 0)
    + (trainings || []).reduce((sum, t) => sum + totalMinutes(t.blocks), 0)

  return {
    matches: (matches || []).length,
    trainings: (trainings || []).length,
    minutes,
    // Stessa onestà della tile "Ore in campo" della Panoramica: se anche una
    // sola partita ha la durata stimata dai game, il totale lo dichiara.
    estimated: (matches || []).some(m => !hasRealDuration(m)),
    wins:   (matches || []).filter(m => m.result === 'win').length,
    draws:  (matches || []).filter(m => m.result === 'draw').length,
    losses: (matches || []).filter(m => m.result === 'loss').length,
  }
}

// ── Helpers ────────────────────────────────────────────────

// Mezzanotte LOCALE, come ovunque nel progetto: confrontare gli ISO grezzi
// farebbe cadere le sessioni serali nel giorno sbagliato.
function dayTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(time, n) {
  const d = new Date(time)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function percentOver(ratio) {
  return `+${Math.round((ratio - 1) * 100)}%`
}

function itemName(item) {
  return item.nickname || item.model || item.name || 'Attrezzatura'
}
