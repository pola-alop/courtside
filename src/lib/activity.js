// ── Statistiche: attività, volume e costanza ────────────────
// Sesto modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa
// linea di tennis.js / training.js / athletics.js / wear.js / stats.js.
//
// ── Perché una sezione separata da Rendimento ──
// Rendimento risponde a "quanto sono forte"; qui la domanda è "quanto gioco, e
// con quanta costanza". Sono due domande con due unità di misura diverse: là il
// game, qui il MINUTO. Tutto ciò che segue è costruito sui minuti in campo e su
// come si distribuiscono nel tempo, tra i tipi di lavoro e tra le superfici.
//
// ── La stima della durata si propaga qui, e va dichiarata ──
// Il match non ha un campo durata: `matchMinutes` usa `athletics.durationSec`
// quando c'è e altrimenti stima dai game (5 min/game). Questa sezione eredita
// quella convenzione e il suo obbligo: ovunque una somma contenga almeno una
// partita stimata, il consumatore deve mostrare il prefisso "~". Il flag si
// chiama `estimated` ed è propagato da ogni aggregato che somma minuti.
//
// ── Cosa si misura sul periodo e cosa "adesso" ──
// Volume, costanza-di-periodo, stagionalità, mix e superfici seguono il periodo
// selezionato in pagina. ACWR, striscia attiva e giorni dall'ultima sessione no:
// sono fatti del PRESENTE (come gli alert di usura in Panoramica, che compaiono
// solo a offset 0). Un rapporto acuto/cronico calcolato sulla finestra "90
// giorni fa" non direbbe niente su cosa fare domani, quindi vengono sempre
// calcolati sull'intero storico rispetto a oggi.

import { matchMinutes, hasRealDuration, SURFACES } from './tennis'
import { totalMinutes, normalizeBlocks, TRAINING_KINDS, INTENSITIES } from './training'
import { dayTime } from './stats'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_ACTIVITY   = 8   // sessioni nel periodo, per aprire la sezione
export const MIN_PREV       = 3   // sessioni nel periodo precedente, per il delta
export const MIN_WEEKS      = 4   // settimane nel periodo, per % settimane attive
export const MIN_MIX_MIN    = 300 // minuti totali, per il mix dei blocchi (5 ore)
export const MIN_SURFACE    = 180 // minuti per lato, per il confronto superfici
export const MIN_ACWR_DAYS  = 28  // storico necessario al carico cronico
export const MIN_ACWR_SESS  = 4   // sessioni nei 28 giorni, per un cronico sensato

// ── Carico interno (session-RPE di Foster) ─────────────────
// Il carico di una sessione è `durata × sforzo percepito`, il metodo standard
// (Foster 2001) per mettere sulla stessa scala un'ora di cesto blando e mezz'ora
// di match play. Lo sforzo qui non è una scala 1-10 chiesta all'utente ma la
// traduzione delle tre intensità del wizard: chiedere un RPE fine aggiungerebbe
// attrito di inserimento senza aggiungere segnale, per la stessa ragione per cui
// il wizard allenamento è corto.
//
// ── Da dove viene lo sforzo ──
// NON è inventato, ed è la stessa fonte per i due domini: il campo `intensity`
// della sessione (leggera / media / intensa), che il wizard allenamento chiede
// allo step 3 e il wizard partita allo step 7. È l'unico dato di sforzo che
// esista nei documenti — non c'è nessuna scala 1-10, e chiederla aggiungerebbe
// attrito senza aggiungere segnale, per la stessa ragione per cui il wizard
// allenamento è corto.
//
// Quando `intensity` manca si usa un valore di riferimento, e i due domini ne
// hanno uno diverso perché partono da posti diversi:
//  · allenamento → "media", che è anche il valore preselezionato dal wizard,
//    quindi in pratica il campo c'è quasi sempre;
//  · partita → MATCH_RPE, più alto di "media": una partita si gioca a punti
//    veri e sta per definizione nella fascia alta. È l'unico numero assunto
//    invece che misurato, e per questo `loadStatus` riporta `declaredShare`,
//    la quota di minuti con lo sforzo davvero dichiarato.
//
// L'unità del carico è arbitraria (minuti × RPE): conta il confronto nel tempo,
// non il valore assoluto.
export const LOAD_RPE = { leggera: 3, media: 5, intensa: 8 }
export const MATCH_RPE = 7
export const DEFAULT_RPE = LOAD_RPE.media   // allenamento senza intensità indicata

// Fascia di ACWR considerata "sweet spot" in letteratura: sotto si perde
// adattamento, sopra il rischio di infortunio cresce.
export const ACWR_MIN = 0.8
export const ACWR_MAX = 1.3
export const ACWR_HIGH = 1.5   // oltre: picco netto, non solo "sopra la fascia"

// Monotonia: sopra 2.0 il carico è considerato piatto (stessa dose ogni giorno,
// nessuna alternanza carico/scarico) ed è il fattore che, moltiplicato per il
// volume, produce lo strain.
export const MONOTONY_HIGH = 2.0
// Se il carico è identico tutti i giorni la deviazione standard è 0 e la
// monotonia sarebbe infinita: si taglia a un valore già ampiamente "alto"
// invece di propagare un Infinity dentro le formule e la UI.
const MONOTONY_CAP = 3.5

const DAY_MS = 24 * 60 * 60 * 1000

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
export const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

// ── Sessioni normalizzate ──────────────────────────────────
// Partite e allenamenti hanno shape diverse ma per questa sezione sono la stessa
// cosa: minuti in campo, in un giorno, su una superficie, con un certo sforzo.
// Normalizzarli una volta sola evita di ripetere `m.kind === 'match' ? ... : ...`
// in ognuno dei calcoli che seguono.

export function toSessions(matches = [], trainings = []) {
  const out = []

  matches.forEach(m => {
    const day = dayTime(m.date)
    if (day == null) return
    out.push({
      id: m.id, kind: 'match', day, date: m.date,
      minutes: matchMinutes(m),
      estimated: !hasRealDuration(m),
      surface: m.surface || null,
      intensity: m.intensity || null,
      rpe: LOAD_RPE[m.intensity] ?? MATCH_RPE,
      rpeDeclared: Boolean(LOAD_RPE[m.intensity]),
      blocks: [],
      withWhom: m.opponentName ? { label: m.opponentName } : null,
    })
  })

  trainings.forEach(t => {
    const day = dayTime(t.date)
    if (day == null) return
    const blocks = normalizeBlocks(t.blocks)
    out.push({
      id: t.id, kind: 'training', day, date: t.date,
      minutes: totalMinutes(blocks),
      estimated: false,
      surface: t.surface || null,
      intensity: t.intensity || null,
      rpe: LOAD_RPE[t.intensity] ?? DEFAULT_RPE,
      rpeDeclared: Boolean(LOAD_RPE[t.intensity]),
      blocks,
      withWhom: t.withWhom?.label ? t.withWhom : null,
    })
  })

  // Un allenamento senza blocchi validi non è una sessione (il wizard non lo
  // permette, ma un documento vecchio potrebbe averne). Le partite restano
  // sempre: una partita è avvenuta anche se il punteggio registrato è parziale.
  return out.filter(s => s.kind === 'match' || s.minutes > 0).sort((a, b) => a.day - b.day)
}

// ── Helpers di calendario ──────────────────────────────────
// Tutto passa per la mezzanotte LOCALE (come `dayTime` in stats.js): sommare e
// sottrarre millisecondi funziona finché non si attraversa un cambio d'ora,
// quindi gli spostamenti di giorno usano sempre un oggetto Date.

export function todayTime() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(time, n) {
  const d = new Date(time)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function daysBetween(a, b) {
  return Math.round((b - a) / DAY_MS)
}

// Lunedì della settimana che contiene `time`. La settimana tennistica comincia
// di lunedì: è la convenzione ISO ed è anche come sono organizzati i corsi.
export function startOfWeek(time) {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

// Indice del giorno della settimana con lunedì = 0 (Date.getDay() ha domenica = 0).
function weekdayIndex(time) {
  return (new Date(time).getDay() + 6) % 7
}

// Estremi effettivi dell'analisi. Con un periodo esplicito sono i suoi; su
// "Sempre" vanno dalla prima sessione registrata a oggi — non alla data
// dell'ultima sessione, altrimenti un mese di inattività finale sparirebbe
// invece di comparire come buco, che è esattamente il dato che interessa.
function spanOf(range, sessions) {
  if (range) return { start: startOfDay(range.start), end: startOfDay(range.end) }
  if (!sessions.length) return null
  return { start: sessions[0].day, end: Math.max(todayTime(), sessions[sessions.length - 1].day) }
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ── Volume ─────────────────────────────────────────────────

export function volume(sessions, range, previousSessions = null) {
  const matchesList   = sessions.filter(s => s.kind === 'match')
  const trainingsList = sessions.filter(s => s.kind === 'training')

  const matchMin    = sum(matchesList,   s => s.minutes)
  const trainingMin = sum(trainingsList, s => s.minutes)
  const minutes     = matchMin + trainingMin

  const span = spanOf(range, sessions)
  // Settimane frazionarie: un periodo di 90 giorni sono 12,86 settimane, non 13.
  // Arrotondare gonfierebbe o sgonfierebbe la media settimanale di ~8%.
  const days  = span ? daysBetween(span.start, span.end) + 1 : 0
  const weeks = days / 7

  const activeDays = new Set(sessions.map(s => s.day)).size

  const prev = previousSessions && previousSessions.length >= MIN_PREV
    ? sum(previousSessions, s => s.minutes)
    : null

  return {
    minutes, matchMin, trainingMin,
    matchCount: matchesList.length,
    trainingCount: trainingsList.length,
    n: sessions.length,
    estimated: matchesList.some(s => s.estimated),
    days, weeks, activeDays,
    perWeekMinutes:  weeks > 0 ? minutes / weeks : null,
    perWeekSessions: weeks > 0 ? sessions.length / weeks : null,
    avgSessionMinutes: sessions.length ? minutes / sessions.length : null,
    matchShare: minutes ? matchMin / minutes : null,
    previousMinutes: prev,
    deltaMinutes: prev != null ? minutes - prev : null,
    deltaShare: prev ? (minutes - prev) / prev : null,
  }
}

// ── Costanza ───────────────────────────────────────────────
// La media settimanale nasconde il modo in cui il volume è distribuito: 8 ore in
// due settimane e poi tre settimane ferme fanno la stessa media di 1,6 ore a
// settimana per cinque settimane, ma sono due stagioni diverse. Qui si misura la
// distribuzione, non il totale.

export function weekBuckets(sessions, range) {
  const span = spanOf(range, sessions)
  if (!span) return []

  const byWeek = new Map()
  sessions.forEach(s => {
    const key = startOfWeek(s.day)
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key).push(s)
  })

  const today = todayTime()
  const out = []
  let cursor = startOfWeek(span.start)
  const lastWeek = startOfWeek(span.end)
  // Guardia sul numero di iterazioni: "Sempre" su dati sporchi (una data del
  // 1970) genererebbe altrimenti decine di migliaia di settimane vuote.
  for (let guard = 0; cursor <= lastWeek && guard < 600; guard++) {
    const list = byWeek.get(cursor) || []
    // Giorni della settimana che stanno dentro il periodo E sono già passati.
    // Le settimane agli estremi ne hanno pochi: quella iniziale perché il
    // periodo è stato ritagliato lì in mezzo, quella finale perché è ancora in
    // corso. Contarle come settimane piene sgonfierebbe la % di settimane
    // attive di un tredicesimo su un periodo di 90 giorni.
    let elapsed = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i)
      if (d >= span.start && d <= span.end && d <= today) elapsed++
    }
    out.push({
      start: cursor,
      end: addDays(cursor, 6),
      sessions: list,
      n: list.length,
      minutes: sum(list, s => s.minutes),
      load: sum(list, s => s.minutes * s.rpe),
      elapsed,
      counted: elapsed >= WEEK_MIN_DAYS,
    })
    cursor = addDays(cursor, 7)
  }
  return out
}

// Una settimana entra nel conteggio della costanza solo se il periodo ne
// contiene almeno 4 giorni già trascorsi: sotto quella soglia non è una
// settimana in cui "non hai giocato", è una settimana in cui non hai avuto modo.
const WEEK_MIN_DAYS = 4

export function consistency(sessions, range, allSessions = sessions) {
  // La striscia visiva mostra tutte le settimane toccate dal periodo, ma la
  // percentuale si calcola sulle sole settimane "piene" (vedi WEEK_MIN_DAYS):
  // altrimenti i due mezzi-bordi del periodo la abbasserebbero sistematicamente.
  const weeks = weekBuckets(sessions, range).filter(w => w.counted)
  const active = weeks.filter(w => w.n > 0).length

  // Distribuzione per giorno della settimana: dice se il tennis è incastrato in
  // due giorni fissi (e quindi salta ogni volta che salta quel giorno) o se è
  // distribuito.
  const weekday = WEEKDAYS.map((label, index) => ({ index, label, n: 0, minutes: 0 }))
  sessions.forEach(s => {
    const slot = weekday[weekdayIndex(s.day)]
    slot.n++
    slot.minutes += s.minutes
  })
  const weekdayMax = Math.max(0, ...weekday.map(d => d.minutes))

  // Buco più lungo: giorni consecutivi senza NESSUNA sessione tra due sessioni
  // del periodo. Gli estremi del periodo sono esclusi di proposito — un periodo
  // che comincia il 1° gennaio con la prima sessione il 10 non è un buco di 9
  // giorni, è solo il punto in cui è stato ritagliato il periodo.
  const days = [...new Set(sessions.map(s => s.day))].sort((a, b) => a - b)
  let longestGap = 0, longestGapAt = null
  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1], days[i]) - 1
    if (gap > longestGap) { longestGap = gap; longestGapAt = { from: days[i - 1], to: days[i] } }
  }

  return {
    weeks: weeks.length,
    activeWeeks: active,
    activeShare: weeks.length ? active / weeks.length : null,
    enoughWeeks: weeks.length >= MIN_WEEKS,
    weekday, weekdayMax,
    longestGap, longestGapAt,
    ...currentRhythm(allSessions),
  }
}

// Striscia e ultimo stacco si calcolano SEMPRE sull'intero storico rispetto a
// oggi: sono lo stato attuale, non una proprietà del periodo scelto. Filtrarli
// sul periodo darebbe "striscia di 3 settimane" guardando i 90 giorni e "di 11"
// guardando i 12 mesi, per lo stesso identico fatto.
function currentRhythm(allSessions) {
  const today = todayTime()
  if (!allSessions.length) return { streakWeeks: 0, sinceLast: null, lastDay: null }

  const activeWeeks = new Set(allSessions.map(s => startOfWeek(s.day)))
  const thisWeek = startOfWeek(today)

  // La settimana in corso non ha ancora avuto tutto il tempo di riempirsi: se è
  // vuota si parte dalla precedente invece di dichiarare la striscia interrotta
  // il lunedì mattina.
  let cursor = activeWeeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7)
  let streak = 0
  while (activeWeeks.has(cursor) && streak < 600) {
    streak++
    cursor = addDays(cursor, -7)
  }

  // Il clamp copre la data futura per errore di battitura: "-3 giorni
  // dall'ultima sessione" sarebbe un numero senza significato.
  const lastDay = allSessions[allSessions.length - 1].day
  return { streakWeeks: streak, sinceLast: Math.max(0, daysBetween(lastDay, today)), lastDay }
}

// ── Stagionalità ───────────────────────────────────────────
// L'anno tennistico ha una forma: agosto e dicembre si svuotano, primavera e
// autunno si riempiono. Una heatmap mese × anno la fa emergere da sola, senza
// che nessuna regola debba andarla a cercare.

export function seasonality(sessions) {
  if (!sessions.length) return { years: [], max: 0, monthAvg: [], estimated: false }

  const byYear = new Map()
  sessions.forEach(s => {
    const d = new Date(s.day)
    const y = d.getFullYear()
    if (!byYear.has(y)) byYear.set(y, Array.from({ length: 12 }, () => ({ minutes: 0, n: 0 })))
    const cell = byYear.get(y)[d.getMonth()]
    cell.minutes += s.minutes
    cell.n++
  })

  const first = new Date(sessions[0].day)
  const last  = new Date(Math.max(sessions[sessions.length - 1].day, todayTime()))

  // Le celle fuori dallo storico (prima della prima sessione, dopo oggi) non
  // sono "zero ore": sono mesi che non esistono nei dati, e vanno disegnate
  // diversamente da un mese in cui davvero non si è giocato.
  const inSpan = (year, month) => {
    if (year < first.getFullYear() || year > last.getFullYear()) return false
    if (year === first.getFullYear() && month < first.getMonth()) return false
    if (year === last.getFullYear()  && month > last.getMonth())  return false
    return true
  }

  const years = [...byYear.keys()].sort((a, b) => b - a).map(year => ({
    year,
    months: byYear.get(year).map((cell, month) => ({
      month,
      minutes: cell.minutes,
      n: cell.n,
      inSpan: inSpan(year, month),
    })),
    minutes: sum(byYear.get(year), c => c.minutes),
  }))

  const max = Math.max(0, ...years.flatMap(y => y.months.map(m => m.minutes)))

  // Media per mese dell'anno su tutti gli anni disponibili: con due o più
  // stagioni distingue il buco strutturale (agosto, ogni anno) dal caso isolato.
  const monthAvg = MONTHS_SHORT.map((label, month) => {
    const cells = years.map(y => y.months[month]).filter(c => c.inSpan)
    return {
      month, label,
      minutes: cells.length ? sum(cells, c => c.minutes) / cells.length : null,
      years: cells.length,
    }
  })

  return { years, max, monthAvg, estimated: sessions.some(s => s.estimated) }
}

// ── Mix dei blocchi ────────────────────────────────────────
// "Che tipo di tennista sono?" — da cesto o da match play. Il denominatore sono
// TUTTI i minuti in campo, partite comprese: escluderle direbbe che uno che
// gioca tre partite a settimana e non fa mai match play in allenamento non gioca
// mai punti, che è falso. Le partite compaiono quindi come una riga a sé.

export const MIX_KINDS = [
  ...TRAINING_KINDS.map(k => ({ id: k.id, label: k.label, icon: k.icon })),
  { id: 'partita', label: 'Partite', icon: '🏆' },
]

// Alimentato vs live. Il criterio è chi decide la palla che ricevi: nel cesto,
// nella macchina e nel secchiello di servizi la palla è controllata (o assente),
// e si costruisce il gesto; con sparring, gruppo, match play e partita la palla
// arriva da un avversario, e si costruisce la decisione. L'atletica resta fuori
// da entrambi: è tennis senza palla, e includerla in una delle due parti
// falserebbe la lettura.
const FEED_KINDS = ['macchina', 'lezione', 'servizio']
const LIVE_KINDS = ['sparring', 'gruppo', 'matchplay', 'partita']

export function blockMix(sessions) {
  const byKind = new Map(MIX_KINDS.map(k => [k.id, 0]))

  sessions.forEach(s => {
    if (s.kind === 'match') {
      byKind.set('partita', byKind.get('partita') + s.minutes)
      return
    }
    s.blocks.forEach(b => {
      if (!byKind.has(b.kind)) return   // tipo sconosciuto (dato più vecchio della tassonomia)
      byKind.set(b.kind, byKind.get(b.kind) + b.minutes)
    })
  })

  const total = sum([...byKind.values()], v => v)
  const rows = MIX_KINDS
    .map(k => ({ ...k, minutes: byKind.get(k.id), share: total ? byKind.get(k.id) / total : 0 }))
    .sort((a, b) => b.minutes - a.minutes)

  const feed = sum(FEED_KINDS.map(id => byKind.get(id) || 0), v => v)
  const live = sum(LIVE_KINDS.map(id => byKind.get(id) || 0), v => v)
  const ball = feed + live

  // Intensità: solo allenamenti — la partita non ha (e non deve avere) un campo
  // intensità, quindi mescolarla qui significherebbe inventarne una.
  const intensity = [...INTENSITIES.map(i => ({ id: i.id, label: i.label, color: i.color, minutes: 0 })),
                     { id: null, label: 'Non indicata', color: 'var(--color-slate)', minutes: 0 }]
  sessions.filter(s => s.kind === 'training').forEach(s => {
    const slot = intensity.find(i => i.id === (s.intensity || null))
    if (slot) slot.minutes += s.minutes
  })
  const intensityTotal = sum(intensity, i => i.minutes)

  return {
    rows, total,
    estimated: sessions.some(s => s.kind === 'match' && s.estimated),
    enough: total >= MIN_MIX_MIN,
    feed, live, ball,
    feedShare: ball ? feed / ball : null,
    liveShare: ball ? live / ball : null,
    intensity: intensity.map(i => ({ ...i, share: intensityTotal ? i.minutes / intensityTotal : 0 })),
    intensityTotal,
  }
}

// ── Con chi ────────────────────────────────────────────────
// Quota di minuti passati col maestro, con un compagno, in gruppo o da solo.
// Si ricava dal TIPO DI BLOCCO, non dal campo "con chi" del wizard: quello è
// un'etichetta libera e facoltativa, mentre il blocco c'è sempre ed è già la
// risposta ("lezione" = maestro, per definizione).
export const COMPANY_BUCKETS = [
  { id: 'maestro',  label: 'Col maestro', icon: '🎓', kinds: ['lezione'] },
  { id: 'sparring', label: 'Uno contro uno', icon: '🤝', kinds: ['sparring', 'matchplay'] },
  { id: 'gruppo',   label: 'In gruppo',   icon: '👥', kinds: ['gruppo'] },
  { id: 'solo',     label: 'Da solo',     icon: '🎯', kinds: ['servizio', 'macchina', 'atletica'] },
]

export function company(sessions) {
  const rows = COMPANY_BUCKETS.map(b => ({ ...b, minutes: 0 }))
  const kindToBucket = new Map()
  COMPANY_BUCKETS.forEach(b => b.kinds.forEach(k => kindToBucket.set(k, b.id)))

  sessions.filter(s => s.kind === 'training').forEach(s => {
    s.blocks.forEach(b => {
      const bucket = kindToBucket.get(b.kind)
      if (!bucket) return
      rows.find(r => r.id === bucket).minutes += b.minutes
    })
  })

  const total = sum(rows, r => r.minutes)

  // Le persone con un nome: il campo "con chi" è facoltativo, quindi questa
  // lista è un di più che compare solo se è stato compilato.
  const byName = new Map()
  sessions.forEach(s => {
    const label = s.withWhom?.label?.trim()
    if (!label || s.kind === 'match') return
    if (!byName.has(label)) byName.set(label, { label, n: 0, minutes: 0 })
    const entry = byName.get(label)
    entry.n++
    entry.minutes += s.minutes
  })

  return {
    rows: rows.map(r => ({ ...r, share: total ? r.minutes / total : 0 })).sort((a, b) => b.minutes - a.minutes),
    total,
    named: [...byName.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 4),
  }
}

// ── Carico, ACWR, monotonia e strain ───────────────────────
// Il carico acuto (7 giorni) contro il carico cronico (media settimanale sui 28
// giorni) dice se stai chiedendo al corpo molto più di quanto sia abituato a
// reggere. La fascia 0,8–1,3 è il riferimento consolidato: sotto si perde
// adattamento, sopra cresce il rischio di infortunio.
//
// Monotonia e strain (Foster) costano due righe e aggiungono la dimensione che
// manca all'ACWR: non quanto carico, ma come è distribuito. Stesso volume tutti
// i giorni (monotonia alta) è peggio dello stesso volume concentrato con giorni
// di scarico veri, e lo strain — volume × monotonia — è la misura combinata.

function dailyLoadMap(sessions) {
  const map = new Map()
  sessions.forEach(s => map.set(s.day, (map.get(s.day) || 0) + s.minutes * s.rpe))
  return map
}

function windowDays(endTime, length) {
  const out = []
  for (let i = length - 1; i >= 0; i--) out.push(addDays(endTime, -i))
  return out
}

export function loadStatus(allSessions) {
  const today = todayTime()
  if (!allSessions.length) return { available: false, reason: 'no-data' }

  const daily = dailyLoadMap(allSessions)
  const load = (days) => sum(days, d => daily.get(d) || 0)

  const acuteDays   = windowDays(today, 7)
  const chronicDays = windowDays(today, 28)

  const acute    = load(acuteDays)
  const chronic  = load(chronicDays) / 4        // media settimanale sui 28 giorni
  const sessions28 = allSessions.filter(s => s.day >= addDays(today, -27) && s.day <= today)

  const history = daysBetween(allSessions[0].day, today) + 1
  const available = history >= MIN_ACWR_DAYS && sessions28.length >= MIN_ACWR_SESS && chronic > 0

  // Foster: monotonia = media / deviazione standard dei carichi GIORNALIERI
  // della settimana, zeri compresi. I giorni di riposo sono metà del dato: sono
  // loro a creare la variazione che la monotonia misura.
  const values = acuteDays.map(d => daily.get(d) || 0)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
  const monotony = mean === 0 ? null : (sd > 0 ? Math.min(MONOTONY_CAP, mean / sd) : MONOTONY_CAP)
  const strain = monotony != null ? acute * monotony : null

  return {
    available,
    reason: !available
      ? (history < MIN_ACWR_DAYS ? 'history' : sessions28.length < MIN_ACWR_SESS ? 'sessions' : 'chronic')
      : null,
    missingDays: Math.max(0, MIN_ACWR_DAYS - history),
    missingSessions: Math.max(0, MIN_ACWR_SESS - sessions28.length),
    acute, chronic,
    ratio: chronic > 0 ? acute / chronic : null,
    zone: acwrZone(chronic > 0 ? acute / chronic : null),
    monotony, strain,
    monotonyCapped: monotony === MONOTONY_CAP,
    // Quota dei minuti recenti in cui lo sforzo è stato DICHIARATO invece che
    // assunto dal valore di riferimento. Sotto il 100% il carico resta un
    // ordine di grandezza, e la UI lo dice invece di lasciarlo intendere.
    declaredShare: sum(sessions28, s => s.minutes)
      ? sum(sessions28.filter(s => s.rpeDeclared), s => s.minutes) / sum(sessions28, s => s.minutes)
      : null,
    assumedSessions: sessions28.filter(s => !s.rpeDeclared).length,
    sessions7: allSessions.filter(s => s.day >= addDays(today, -6) && s.day <= today).length,
    sessions28: sessions28.length,
    daily: acuteDays.map(d => ({ day: d, load: daily.get(d) || 0, label: WEEKDAYS[weekdayIndex(d)] })),
  }
}

export function acwrZone(ratio) {
  if (ratio == null) return null
  if (ratio < ACWR_MIN)  return { id: 'low',  label: 'Sotto carico', color: 'var(--color-draw)' }
  if (ratio <= ACWR_MAX) return { id: 'ok',   label: 'Ottimale',     color: 'var(--color-win)' }
  if (ratio <= ACWR_HIGH) return { id: 'high', label: 'Attenzione',  color: 'var(--color-amber)' }
  return { id: 'spike', label: 'Picco di carico', color: 'var(--color-loss)' }
}

// ── Coerenza superficie ────────────────────────────────────
// Allenarsi all'82% sulla terra e giocare il 60% delle partite sul cemento non è
// una curiosità: rimbalzo, scivolata e tempo di preparazione sono diversi, e
// buona parte di quello che si costruisce in allenamento non si trasferisce.

export function surfaceMix(sessions) {
  const side = (list) => {
    const by = new Map()
    let unknown = 0
    list.forEach(s => {
      if (!s.surface) { unknown += s.minutes; return }
      by.set(s.surface, (by.get(s.surface) || 0) + s.minutes)
    })
    const total = sum([...by.values()], v => v)
    return { by, total, unknown }
  }

  const training = side(sessions.filter(s => s.kind === 'training'))
  const match    = side(sessions.filter(s => s.kind === 'match'))

  const keys = [...new Set([...training.by.keys(), ...match.by.keys()])]
  const order = new Map(SURFACES.map((s, i) => [s, i]))
  const rows = keys
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(key => {
      const t = training.total ? (training.by.get(key) || 0) / training.total : null
      const m = match.total    ? (match.by.get(key)    || 0) / match.total    : null
      return {
        key,
        trainingShare: t, matchShare: m,
        trainingMinutes: training.by.get(key) || 0,
        matchMinutes: match.by.get(key) || 0,
        gap: t != null && m != null ? m - t : null,
      }
    })

  const comparable = training.total >= MIN_SURFACE && match.total >= MIN_SURFACE
  const worst = comparable
    ? rows.filter(r => r.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0] || null
    : null

  return {
    rows, comparable, worst,
    trainingMinutes: training.total, matchMinutes: match.total,
    unknownMinutes: training.unknown + match.unknown,
    missingTraining: Math.max(0, MIN_SURFACE - training.total),
    missingMatch: Math.max(0, MIN_SURFACE - match.total),
    estimated: sessions.some(s => s.kind === 'match' && s.estimated),
  }
}

// ── Report completo ────────────────────────────────────────
// Stesso contratto di `buildRendimento`: un solo punto d'ingresso che restituisce
// tutto il necessario alla sezione, insight compresi, così il componente fa un
// solo useMemo e non deve conoscere l'ordine dei calcoli.
//
// `allMatches`/`allTrainings` NON sono filtrati per periodo, e non è un errore:
// alimentano ACWR, striscia e ultimo stacco, che sono fatti del presente.

export function buildActivity({
  matches = [], trainings = [],
  allMatches = null, allTrainings = null,
  previousMatches = [], previousTrainings = [],
  range = null,
}) {
  const sessions = toSessions(matches, trainings)
  const all      = allMatches || allTrainings
    ? toSessions(allMatches || matches, allTrainings || trainings)
    : sessions
  const previous = toSessions(previousMatches, previousTrainings)

  const report = {
    n: sessions.length,
    enough: sessions.length >= MIN_ACTIVITY,
    missing: Math.max(0, MIN_ACTIVITY - sessions.length),
    sessions,
    volume:      volume(sessions, range, previous),
    consistency: consistency(sessions, range, all),
    weeks:       weekBuckets(sessions, range),
    seasonality: seasonality(sessions),
    mix:         blockMix(sessions),
    company:     company(sessions),
    load:        loadStatus(all),
    surfaces:    surfaceMix(sessions),
  }

  report.insights = report.enough ? activityInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Stesso motore a regole di `rendimentoInsights`: soglia di campione + soglia di
// effetto minimo, frase con dentro i numeri che l'hanno generata, `target` (id
// del blocco) + `tab`. Il peso serve solo all'ordinamento nella lista di pagina,
// che è condivisa con Rendimento.

const hours = min => (min / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })
const pct   = v => (v == null ? '—' : `${Math.round(v * 100)}%`)

function insight(o) {
  return { ...o, tab: 'attivita', weight: o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n) }
}

export function activityInsights(r) {
  const out = []

  // Carico: è l'unica frase di questa sezione che riguarda il rischio, quindi ha
  // un peso forzato alto — un ACWR a 1,8 deve stare in cima anche se calcolato
  // su una settimana sola.
  if (r.load.available && r.load.zone && r.load.zone.id !== 'ok') {
    const spike = r.load.ratio > ACWR_MAX
    out.push(insight({
      id: 'acwr', target: 'carico', tone: spike ? 'bad' : 'neutral', icon: spike ? '⚠️' : '💤',
      effect: Math.abs(r.load.ratio - 1), n: r.load.sessions28, weight: spike ? 2.2 : 0.8,
      text: spike
        ? `Carico degli ultimi 7 giorni a ${r.load.ratio.toFixed(2)}× la tua media delle 4 settimane: è un picco, e i picchi sono il momento in cui ci si fa male.`
        : `Carico degli ultimi 7 giorni a ${r.load.ratio.toFixed(2)}× la tua media delle 4 settimane: stai scaricando, va bene se è voluto.`,
    }))
  }

  if (r.load.available && r.load.monotony != null && r.load.monotony >= MONOTONY_HIGH && r.load.sessions7 >= 3) {
    out.push(insight({
      id: 'monotonia', target: 'carico', tone: 'neutral', icon: '📏',
      effect: r.load.monotony - MONOTONY_HIGH + 0.2, n: r.load.sessions7, weight: 0.7,
      text: `Il carico dell'ultima settimana è piatto (monotonia ${r.load.monotony.toFixed(1)}): stessa dose ogni giorno, senza giornate di scarico vere.`,
    }))
  }

  // Costanza.
  const c = r.consistency
  if (c.enoughWeeks && c.activeShare != null) {
    if (c.activeShare <= 0.6) {
      out.push(insight({
        id: 'costanza', target: 'costanza', tone: 'bad', icon: '📉',
        effect: 0.8 - c.activeShare, n: c.weeks,
        text: `Hai giocato in ${c.activeWeeks} settimane su ${c.weeks} (${pct(c.activeShare)}): il volume c'è, la continuità no.`,
      }))
    } else if (c.activeShare >= 0.9 && c.weeks >= 8) {
      out.push(insight({
        id: 'costanza', target: 'costanza', tone: 'good', icon: '🔁',
        effect: c.activeShare - 0.6, n: c.weeks,
        text: `Hai giocato in ${c.activeWeeks} settimane su ${c.weeks}: la costanza è il tuo punto forte.`,
      }))
    }
  }

  if (c.longestGap >= 21) {
    out.push(insight({
      id: 'buco', target: 'costanza', tone: 'neutral', icon: '🕳',
      effect: c.longestGap / 100, n: r.n, weight: 0.5,
      text: `Il periodo contiene uno stop di ${c.longestGap} giorni consecutivi senza scendere in campo.`,
    }))
  }

  if (c.sinceLast != null && c.sinceLast >= 14) {
    out.push(insight({
      id: 'fermo', target: 'costanza', tone: 'bad', icon: '⏸',
      effect: c.sinceLast / 100, n: r.n, weight: 1.4,
      text: `Sono ${c.sinceLast} giorni dall'ultima sessione registrata.`,
    }))
  }

  // Mix: uno squilibrio grosso su un blocco è il dato che cambia davvero la
  // programmazione della settimana.
  if (r.mix.enough) {
    const serve = r.mix.rows.find(x => x.id === 'servizio')
    if (serve && serve.share < 0.05) {
      out.push(insight({
        id: 'servizio', target: 'mix', tone: 'bad', icon: '🎯',
        effect: 0.1 - serve.share, n: Math.round(r.mix.total / 60),
        text: `Il servizio è il ${pct(serve.share)} dei tuoi minuti in campo: è il colpo che usi in metà dei punti e quello che alleni di meno.`,
      }))
    }
    if (r.mix.feedShare != null && r.mix.ball >= MIN_MIX_MIN) {
      if (r.mix.feedShare >= 0.65) {
        out.push(insight({
          id: 'cesto', target: 'mix', tone: 'neutral', icon: '🤖',
          effect: r.mix.feedShare - 0.5, n: Math.round(r.mix.ball / 60),
          text: `Il ${pct(r.mix.feedShare)} dei minuti con la palla è su palla alimentata (cesto, macchina, servizi): costruisci il gesto molto più di quanto giochi i punti.`,
        }))
      } else if (r.mix.liveShare >= 0.85) {
        out.push(insight({
          id: 'cesto', target: 'mix', tone: 'neutral', icon: '🎾',
          effect: r.mix.liveShare - 0.6, n: Math.round(r.mix.ball / 60),
          text: `Il ${pct(r.mix.liveShare)} dei minuti con la palla è gioco vero: giochi molto e costruisci poco il gesto.`,
        }))
      }
    }
  }

  // Coerenza superficie.
  if (r.surfaces.comparable && r.surfaces.worst && Math.abs(r.surfaces.worst.gap) >= 0.25) {
    const w = r.surfaces.worst
    const under = w.gap > 0   // giochi più partite di quanto ti alleni, su quella superficie
    out.push(insight({
      id: 'superfici', target: 'superfici', tone: 'bad', icon: '🟠',
      effect: Math.abs(w.gap), n: Math.round((r.surfaces.trainingMinutes + r.surfaces.matchMinutes) / 60),
      text: under
        ? `Giochi il ${pct(w.matchShare)} delle partite su ${w.key} ma ci fai solo il ${pct(w.trainingShare)} degli allenamenti.`
        : `Ti alleni per il ${pct(w.trainingShare)} su ${w.key} ma ci giochi solo il ${pct(w.matchShare)} delle partite.`,
    }))
  }

  // Volume: il confronto con il periodo precedente, quando esiste.
  const v = r.volume
  if (v.deltaShare != null && Math.abs(v.deltaShare) >= 0.3 && v.previousMinutes >= 300) {
    const up = v.deltaShare > 0
    out.push(insight({
      id: 'volume', target: 'volume', tone: 'neutral', icon: up ? '📈' : '📉',
      effect: Math.abs(v.deltaShare), n: v.n, weight: 0.6,
      text: `${v.estimated ? '~' : ''}${hours(v.minutes)} ore in campo, ${pct(Math.abs(v.deltaShare))} ${up ? 'in più' : 'in meno'} del periodo precedente.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Formattazione condivisa ────────────────────────────────

// Ore con una cifra decimale, prefissate da "~" quando la somma contiene almeno
// una partita a durata stimata. Il prefisso non è cosmetico: è la dichiarazione
// che quel numero è in parte una stima, e va usato ovunque si mostrino ore.
export function formatHoursValue(minutes, estimated = false) {
  return `${estimated ? '~' : ''}${(minutes / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })}`
}

// "1h 30" per le durate brevi, "12,5 h" per i totali: sotto le due ore la forma
// oraria è più leggibile del decimale.
export function formatDuration(minutes) {
  const n = Math.round(minutes || 0)
  if (n <= 0) return '—'
  if (n < 120) {
    const h = Math.floor(n / 60), m = n % 60
    if (h === 0) return `${m} min`
    return m === 0 ? `${h}h` : `${h}h ${m}`
  }
  return `${(n / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })} h`
}

// ── Helpers ────────────────────────────────────────────────

function sum(list, pick) {
  return (list || []).reduce((s, x) => s + (pick(x) || 0), 0)
}
