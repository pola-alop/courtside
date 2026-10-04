// ── Calendario della Home: il mese corrente, il fatto e il programmato ──
// Modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa linea
// degli altri: `buildCalendar` è il punto d'ingresso unico e restituisce tutto
// ciò che la griglia, le card della settimana e la fiammella devono disegnare.
//
// ── Perché il mese solare, qui sì ──
// La Panoramica ha scartato il mese come unità di SINTESI (il 1° del mese è
// azzerata). Qui il mese non riassume niente: è il foglio di calendario che
// l'utente ha in testa, e la Home lo mostra perché il mese corrente è "adesso".
// Nessun selettore, nessuna freccia: un mese diverso da questo è roba di Stats.
//
// ── Cosa è ricavato e cosa no ──
// Lo stato di un programma (fatto / da fare / non svolto) NON è salvato: si
// ricava confrontando il programma con le sessioni registrate quel giorno, come
// il record H2H e l'uso delle schede. Così una sessione registrata dalla strada
// normale (senza passare dal "Registra" del programma) lo segna fatto lo stesso,
// ed eliminarla lo riporta indietro senza che nessuno debba ricordarselo.
//
// ── Il giorno, sempre locale ──
// Le sessioni portano un ISO e passano da `dayTime` (mezzanotte locale), come
// ovunque. I programmi invece sono un GIORNO, non un istante, e salvano la
// stringa `'YYYY-MM-DD'` letta come data locale (`keyToDay`): un ISO a
// mezzanotte UTC farebbe scivolare il programma al giorno prima in qualunque
// fuso a ovest di Greenwich.

import { dayTime } from './stats'
import { todayTime, startOfWeek, addDays, currentRhythm, MONTHS_SHORT } from './activity'

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

// Ordine di importanza dei tipi di sessione: decide l'icona principale del
// giorno (gli altri finiscono nel "+N") e l'ordine dell'elenco del giorno. La
// partita viene prima, come nell'agenda della Panoramica.
export const KIND_PRIORITY = ['match', 'training', 'run', 'gym']

// Partita e allenamento hanno la stessa 🎾: la partita si riconosce dal bordo
// ambra, lo stesso codice colore della Panoramica. Le icone sono quelle di
// `SessionTypePicker` / `TrainingRow` / `RunRow`.
export const KIND_META = {
  match:    { icon: '🎾', label: 'Partita' },
  training: { icon: '🎾', label: 'Allenamento' },
  run:      { icon: '🏃', label: 'Corsa' },
  gym:      { icon: '🏋️', label: 'Palestra' },
  rest:     { icon: '💤', label: 'Riposo' },
}

// Cosa si può programmare. Ogni tipo tranne il riposo ha la sua collection di
// sessioni con cui verificarsi (partita ↔ `matches`, allenamento ↔ `trainings`,
// corsa ↔ `runs`, palestra ↔ `gymSessions`).
export const PLAN_KINDS = ['match', 'training', 'run', 'gym', 'rest']

// ── Punto d'ingresso ───────────────────────────────────────
// `today` si passa solo per collaudare su date fisse: l'app usa il default.
export function buildCalendar({
  matches = [], trainings = [], runs = [], gymSessions = [], plans = [],
  today = todayTime(),
}) {
  today = startOfDay(today)
  const sessions = toCalendarSessions({ matches, trainings, runs, gymSessions })
  const sessionsByDay = groupByDay(sessions)
  const plansByDay = planStatuses(plans, sessionsByDay, today)
  const thisWeek = startOfWeek(today)

  const ref = new Date(today)
  const year = ref.getFullYear()
  const month = ref.getMonth()

  const monthStart = startOfDay(new Date(year, month, 1))

  const weeks = monthRows(year, month).map((start, index) => {
    const end = addDays(start, 6)
    const days = []
    for (let i = 0; i < 7; i++) {
      const time = addDays(start, i)
      days.push(buildDay({ time, month, monthStart, today, thisWeek, sessionsByDay, plansByDay }))
    }
    return {
      index, start, end, days,
      isCurrent: start === thisWeek,
      isPast: end < today,
      isFuture: start > today,
    }
  })

  // Oggi sta sempre nel mese corrente, quindi la sua settimana è sempre una
  // delle righe della griglia: la ricerca non può fallire.
  const row = weeks.findIndex(w => w.isCurrent)
  const current = weeks[row]

  return {
    year, month,
    title: `${MONTHS[month]} ${year}`,
    today,
    weeks,
    currentWeek: {
      row,
      start: current.start,
      end: current.end,
      label: `${shortDate(current.start)} – ${shortDate(current.end)}`,
    },
    streak: buildStreak(sessions, today, row),
  }
}

// ── Sessioni ───────────────────────────────────────────────
// Una forma sola per i quattro domini. A differenza di `toSessions` e
// `toLoadSessions` qui non si scarta nulla che abbia una data valida: le
// statistiche lasciano fuori un allenamento senza blocchi o una corsa senza
// durata perché non sanno pesarli, ma il calendario mostra ciò che esiste, e il
// tap porta a un dettaglio vero. `item` è il documento originale, per l'elenco
// del giorno.
export function toCalendarSessions({ matches = [], trainings = [], runs = [], gymSessions = [] }) {
  const out = []
  const push = (list, kind) => (list || []).forEach(item => {
    const day = dayTime(item?.date)
    if (day == null) return
    out.push({ id: item.id, kind, day, date: item.date, item })
  })
  push(matches, 'match')
  push(trainings, 'training')
  push(runs, 'run')
  push(gymSessions, 'gym')
  // Cronologico: `currentRhythm` legge l'ultima sessione dalla coda.
  return out.sort((a, b) => a.day - b.day || bySessionOrder(a, b))
}

function groupByDay(sessions) {
  const map = new Map()
  sessions.forEach(s => {
    const list = map.get(s.day)
    if (list) list.push(s)
    else map.set(s.day, [s])
  })
  map.forEach(list => list.sort(bySessionOrder))
  return map
}

// Dentro lo stesso giorno: prima il tipo (KIND_PRIORITY), poi l'orario.
function bySessionOrder(a, b) {
  return KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind)
    || String(a.date).localeCompare(String(b.date))
}

// ── Programmi ──────────────────────────────────────────────
// Lo stato si calcola per tutti i programmi, anche quelli che la griglia non
// mostrerà: costa niente e tiene una sola regola.
//
//  · tipo di sessione: abbinamento UNO A UNO in ordine di orario. Due
//    allenamenti programmati e uno svolto → il primo è fatto, il secondo no.
//    Dire "fatti tutti e due" sarebbe la risposta più comoda, non quella vera.
//    I programmi senza orario vengono dopo quelli con orario.
//  · riposo: un giorno con una sessione registrata è un riposo non rispettato
//    (`missed`), anche oggi; senza sessioni è `done` solo quando il giorno è
//    finito, perché oggi si può ancora uscire a correre.
//  · non fatto: `missed` se il giorno è passato, `todo` se è oggi o futuro —
//    oggi c'è ancora tempo.
//
// `sessionId` è la sessione che ha "chiuso" il programma: dal programma fatto
// si arriva al suo dettaglio.
function planStatuses(plans, sessionsByDay, today) {
  const byDay = new Map()
  ;(plans || []).forEach(plan => {
    if (!PLAN_KINDS.includes(plan?.kind)) return
    const day = keyToDay(plan.date)
    if (day == null) return
    const list = byDay.get(day)
    if (list) list.push({ ...plan, day })
    else byDay.set(day, [{ ...plan, day }])
  })

  byDay.forEach((list, day) => {
    list.sort(byPlanOrder)
    const daySessions = sessionsByDay.get(day) || []
    const used = new Set()

    list.forEach(plan => {
      if (plan.kind === 'rest') {
        plan.status = daySessions.length ? 'missed' : day < today ? 'done' : 'todo'
        plan.sessionId = null
        return
      }
      const match = daySessions.find(s => s.kind === plan.kind && !used.has(s))
      if (match) {
        used.add(match)
        plan.status = 'done'
        plan.sessionId = match.id
      } else {
        plan.status = day < today ? 'missed' : 'todo'
        plan.sessionId = null
      }
    })
  })

  return byDay
}

function byPlanOrder(a, b) {
  const ta = a.time || null
  const tb = b.time || null
  if (ta !== tb) {
    if (ta == null) return 1
    if (tb == null) return -1
    return ta < tb ? -1 : 1
  }
  return PLAN_KINDS.indexOf(a.kind) - PLAN_KINDS.indexOf(b.kind)
    || String(a.id ?? '').localeCompare(String(b.id ?? ''))
}

// Il riposo esclude tutto il resto, nei due versi: un giorno di riposo non
// accetta altri programmi, e un giorno con qualcosa in programma non può
// diventare di riposo. `editingId` esclude il programma che si sta modificando
// (cambiare un allenamento in riposo, se è l'unico del giorno, è lecito).
// Restituisce il motivo del conflitto, o null.
export function planConflict(plansOfDay = [], kind, editingId = null) {
  const others = (plansOfDay || []).filter(p => p && p.id !== editingId)
  if (!others.length) return null
  if (others.some(p => p.kind === 'rest')) return 'rest-day'
  if (kind === 'rest') return 'day-busy'
  return null
}

// I programmi (grezzi, come arrivano da Firestore) di un giorno qualsiasi, anche
// fuori dalla griglia: servono a `planConflict` quando un programma si sposta.
export function plansOnDay(plans = [], key) {
  const day = keyToDay(key)
  if (day == null) return []
  return (plans || []).filter(p => keyToDay(p?.date) === day)
}

// Etichetta dello stato ricavato. Il riposo non si "fa": si rispetta o no.
export function planStatusLabel(plan) {
  if (plan?.kind === 'rest') {
    return { todo: 'In programma', done: 'Rispettato', missed: 'Non rispettato' }[plan.status] || 'In programma'
  }
  return { todo: 'Da fare', done: 'Fatto', missed: 'Non svolto' }[plan?.status] || 'Da fare'
}

// Il "chi" o il "cosa" di un programma: l'avversario, il compagno
// d'allenamento, la scheda. Nomi DERIVATI, non denormalizzati (regola nata dal
// bug della rinomina degli avversari): vince il nome attuale dell'anagrafica o
// della scheda, la copia salvata è solo il ripiego se quella non c'è più.
// null se il programma non ne ha uno (riposo, corsa senza scheda...).
export function planSubject(plan, { opponents = [], runWorkouts = [], gymWorkouts = [] } = {}) {
  const d = plan?.details || {}
  const byId = (list, id) => (id ? (list || []).find(x => x.id === id) : null)
  switch (plan?.kind) {
    case 'match':
      return byId(opponents, d.opponentId)?.name || d.opponentName || null
    case 'training':
      return byId(opponents, d.withWhom?.opponentId)?.name || d.withWhom?.label || null
    case 'run':
      return byId(runWorkouts, d.workoutId)?.name || d.workoutName || null
    case 'gym':
      return byId(gymWorkouts, d.workoutId)?.name || d.workoutName || null
    default:
      return null
  }
}

// ── Giorni ─────────────────────────────────────────────────
// La griglia del passato mostra solo ciò che è stato fatto: i programmi si
// vedono dalla settimana corrente in avanti. Quelli più vecchi restano a DB (un
// giorno serviranno a un "programmato vs fatto") ma qui sarebbero rumore.
function buildDay({ time, month, monthStart, today, thisWeek, sessionsByDay, plansByDay }) {
  const d = new Date(time)
  const sessions = sessionsByDay.get(time) || []
  const plans = time >= thisWeek ? (plansByDay.get(time) || []) : []
  const otherMonth = d.getMonth() === month ? null : time < monthStart ? 'prev' : 'next'

  return {
    time,
    key: dayKey(time),
    dayOfMonth: d.getDate(),
    otherMonth,
    isToday: time === today,
    isPast: time < today,
    isFuture: time > today,
    // Da oggi in avanti, fra i giorni della griglia — compresi quelli del mese
    // successivo nell'ultima riga.
    plannable: time >= today,
    sessions,
    main: sessions[0]?.kind ?? null,
    extra: Math.max(0, sessions.length - 1),
    plans,
    // Il programma che dà l'icona al cerchio tratteggiato dei giorni futuri:
    // il primo per orario, come nella card del giorno.
    mainPlan: plans[0]?.kind ?? null,
  }
}

// Le righe del mese: dal lunedì della settimana del 1° alla domenica della
// settimana dell'ultimo giorno. Da 4 righe (febbraio che comincia di lunedì in
// un anno non bisestile) a 6.
function monthRows(year, month) {
  const first = startOfDay(new Date(year, month, 1))
  const last = startOfDay(new Date(year, month + 1, 0))
  const rows = []
  for (let cursor = startOfWeek(first); cursor <= last; cursor = addDays(cursor, 7)) {
    rows.push(cursor)
  }
  return rows
}

// ── Fiammella ──────────────────────────────────────────────
// Settimane consecutive con almeno una sessione di QUALSIASI dominio: è la
// regola di `currentRhythm` (la settimana in corso conta appena ha un'attività
// ma non azzera finché non è finita), applicata alle sessioni dei quattro
// domini invece che al solo tennis. I programmi non contano.
//
// `row` è la riga della settimana corrente: la barra scende fin lì e riparte
// dall'alto a ogni mese, mentre il numero continua.
//
// `fromRow`–`toRow` sono le righe del mese che fanno parte della serie, le sole
// da colorare: con una serie di 2 settimane su 5 righe, una barra tutta accesa
// direbbe il falso. Se la settimana in corso non ha ancora un'attività la serie
// finisce alla riga prima; se finisce prima del mese (o è zero) sono null.
// Contano solo le sessioni fino a oggi, come per `activeThisWeek`: una data
// futura per errore non accende la fiamma e non sposta le righe.
function buildStreak(sessions, today, row) {
  const thisWeek = startOfWeek(today)
  const done = sessions.filter(s => s.day <= today)
  const weeks = currentRhythm(done, today).streakWeeks
  const activeThisWeek = done.some(s => s.day >= thisWeek)
  const toRow = activeThisWeek ? row : row - 1
  const lit = weeks > 0 && toRow >= 0
  return {
    weeks,
    row,
    activeThisWeek,
    fromRow: lit ? Math.max(0, toRow - weeks + 1) : null,
    toRow: lit ? toRow : null,
  }
}

// ── Helpers ────────────────────────────────────────────────

// `'YYYY-MM-DD'` del giorno locale: è la data con cui si salva un programma.
export function dayKey(time) {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Inverso di `dayKey`, letto come data LOCALE (`new Date('2026-10-04')` sarebbe
// mezzanotte UTC). Un valore in un altro formato ripiega su `dayTime`, così un
// documento scritto a mano non sparisce.
export function keyToDay(key) {
  if (typeof key !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return dayTime(key)
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Scarta il 31 febbraio e simili, che Date farebbe slittare al mese dopo.
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null
  return d.getTime()
}

function startOfDay(time) {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function shortDate(time) {
  const d = new Date(time)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
