// ── Riassunto delle note per un allenamento programmato ─────
// Modulo puro di src/lib/ (nessun React, nessun Firestore, nessuna rete): dice
// QUALI partite e QUALI note finiscono nel riassunto, costruisce il prompt e lo
// schema, e ripulisce ciò che il modello risponde. La chiamata al modello sta
// in `src/firebase/ai.js`, la schermata in `PlanSummary.jsx`.
//
// ── Il periodo ──
// Dal giorno dell'ultimo allenamento di tennis SVOLTO prima del programma fino
// al programma. Il tetto è `MAX_WINDOW_DAYS` (60): senza allenamenti, o con
// l'ultimo più vecchio di così, si parte da 60 giorni prima e il riassunto lo
// dichiara (`capped`). Una partita dello stesso giorno dell'allenamento conta
// solo se di entrambe si conosce l'ora (`sessionMoment`): senza non si sa
// quale venne prima, e un riassunto sbagliato è peggio di uno più corto.
//
// ── Cosa si manda al modello, e cosa mai ──
// Data, ora, tipo, superficie, esito e punteggio della partita e il TESTO delle
// note. Mai il nome dell'avversario (né quello del compagno): `maskNames`
// toglie anche i nomi dell'anagrafica che l'utente avesse scritto dentro una
// nota. Nel tier gratuito Google può usare i testi inviati (privacy accettata
// dall'utente, vedi la roadmap 2.2.0 punto 8).
//
// ── Cosa il modello può dire ──
// `{ summary, highlights, suggestedFocus }`. I colpi sono id di `FOCUS_BY_ID`:
// il prompt li elenca, lo schema li vincola e `sanitizeSummary` scarta qualsiasi
// altro valore. Sono SUGGERIMENTI letti dalle note, non un calcolo: i colpi
// trascurati (`neglectedFocus`) sono un'altra cosa, deterministica, e la UI le
// tiene separate e le dichiara entrambe.

import { dayTime } from './stats'
import { sessionMoment, readTime } from './sessionTime'
import { FOCUS_CATEGORIES, FOCUS_BY_ID, FOCUS_IDS } from './training'
import { toFocusSessions, neglect, NEGLECT_WARN } from './technique'
import { MATCH_TYPES } from './tennis'

export const MAX_WINDOW_DAYS = 60
export const MAX_MATCHES      = 15    // le più recenti, se nel periodo ce ne sono di più
export const MAX_HIGHLIGHTS   = 6
export const MAX_SUGGESTED    = 4
export const MAX_NEGLECTED    = 3
const MAX_SUMMARY_CHARS   = 900
const MAX_HIGHLIGHT_CHARS = 220

// Modelli di AI Logic (Gemini Developer API, utilizzabili senza Blaze). Il
// primo è quello preferito; se è sovraccarico (errore 5xx, «high demand», un
// picco temporaneo del tier gratuito) o ritirato (404) si riprova una volta con
// il secondo, che gira su risorse diverse. Per cambiare modello basta toccare
// queste due costanti.
export const SUMMARY_MODEL = 'gemini-3.8-flash'
export const SUMMARY_FALLBACK_MODEL = 'gemini-3.5-flash-lite'

const DAY_MS = 86400000

// ── Il periodo e le partite ─────────────────────────────────

// Il giorno 'YYYY-MM-DD' del programma come mezzanotte locale (`dayTime` legge
// anche questa forma).
function planDay(plan) {
  return dayTime(plan?.date)
}

// `a` precede `b`? Per giorni; a parità di giorno solo se di entrambe si
// conosce l'ora. Con l'ora ignota di una delle due il risultato è `false`: non
// lo sappiamo, quindi non lo diciamo.
function isBefore(a, b) {
  const da = dayTime(a.date), db = dayTime(b.date)
  if (da == null || db == null) return false
  if (da !== db) return da < db
  const ma = sessionMoment(a), mb = sessionMoment(b)
  return ma != null && mb != null && ma < mb
}

// L'ultimo allenamento di tennis svolto prima del programma, o null.
export function lastTrainingBefore(trainings, plan) {
  const target = { date: plan.date, time: plan.time }
  let best = null
  ;(trainings || []).forEach(t => {
    if (!isBefore(t, target)) return
    if (!best || isBefore(best, t)) best = t
  })
  return best
}

// Le partite del periodo (tutte, con o senza note), dalla più recente.
export function windowMatches(matches, plan, lastTraining) {
  const pDay = planDay(plan)
  if (pDay == null) return { matches: [], from: null, capped: false }

  const floor = pDay - MAX_WINDOW_DAYS * DAY_MS
  const lastDay = lastTraining ? dayTime(lastTraining.date) : null
  const capped = lastDay == null || lastDay < floor
  const target = { date: plan.date, time: plan.time }

  const inWindow = (matches || []).filter(m => {
    const d = dayTime(m.date)
    if (d == null) return false
    if (!isBefore(m, target)) return false
    if (capped) return d >= floor
    return isBefore(lastTraining, m)
  })
  inWindow.sort((a, b) => (dayTime(b.date) - dayTime(a.date)) || ((sessionMoment(b) || 0) - (sessionMoment(a) || 0)))
  return { matches: inWindow, from: capped ? floor : lastDay, capped }
}

// ── Mascheramento dei nomi ──────────────────────────────────

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Sostituisce nome e cognome dell'anagrafica (parole intere, senza distinguere
// le maiuscole, almeno 3 lettere) con «l'avversario»: una nota può citare la
// persona e il nome non deve lasciare l'app.
export function maskNames(text, opponents) {
  const words = new Set()
  ;(opponents || []).forEach(o => {
    ;[o.firstName, o.lastName, ...(o.name ? o.name.split(/\s+/) : [])].forEach(w => {
      const t = (w || '').trim()
      if (t.length >= 3) words.add(t)
    })
  })
  let out = String(text || '')
  ;[...words].sort((a, b) => b.length - a.length).forEach(w => {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(w)}(?![\\p{L}\\p{N}])`, 'giu'), "l'avversario")
  })
  return out
}

// ── Punteggio ───────────────────────────────────────────────

function scoreText(m) {
  const sets = (m.sets || []).map(s => {
    const tb = s.tbMe != null && s.tbOpp != null ? `(${Math.min(s.tbMe, s.tbOpp)})` : ''
    return `${s.me}-${s.opp}${tb}`
  })
  if (!sets.length) return ''
  return sets.join(' ') + (m.retired ? ' (ritiro)' : '')
}

// ── L'ingresso del riassunto ────────────────────────────────

function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Tutto ciò che serve a generare (e a riconoscere se il riassunto salvato è
// ancora valido). `signature` cambia se arriva una nota nuova, se una nota viene
// modificata o tolta, o se cambia l'insieme delle partite: è ciò che accende
// «Aggiorna».
export function collectSummaryInput(plan, { matches = [], trainings = [], opponents = [] } = {}) {
  const last = plan ? lastTrainingBefore(trainings, plan) : null
  const win = plan ? windowMatches(matches, plan, last) : { matches: [], from: null, capped: false }

  const withNotes = win.matches.filter(m => (m.notes || []).some(n => n && String(n.text || '').trim()))
  const used = withNotes.slice(0, MAX_MATCHES)

  const items = used.map(m => ({
    id: m.id,
    date: String(m.date || '').slice(0, 10),
    time: readTime(m.time),
    type: m.type || null,
    surface: m.surface || null,
    result: m.result || null,
    completed: m.completed !== false,
    score: scoreText(m),
    notes: (m.notes || [])
      .map(n => maskNames(String(n?.text || '').trim(), opponents))
      .filter(Boolean),
  }))

  const signature = hash(JSON.stringify(used.map(m => [
    m.id, (m.notes || []).map(n => [n?.createdAt || '', String(n?.text || '')]),
  ])))

  return {
    planDate: plan?.date || null,
    since: last ? { date: String(last.date).slice(0, 10), time: readTime(last.time) } : null,
    from: win.from,
    capped: win.capped,
    total: win.matches.length,
    withNotes: withNotes.length,
    used: items.length,
    truncated: withNotes.length > items.length,
    matches: items,
    signature,
  }
}

// ── Prompt e schema ─────────────────────────────────────────

const TYPE_LABEL = Object.fromEntries(MATCH_TYPES.map(t => [t.id, t.label.toLowerCase()]))
const RESULT_LABEL = { win: 'vinta', loss: 'persa', draw: 'pareggiata' }

function focusCatalog() {
  return FOCUS_CATEGORIES
    .map(c => `${c.label}: ${c.items.map(i => `${i.id} (${i.label})`).join(', ')}`)
    .join('\n')
}

export function buildPrompt(input) {
  const system = [
    "Sei l'assistente di un tennista amatore italiano che prepara il prossimo allenamento.",
    "Ricevi SOLO le note che l'atleta ha scritto sulle sue ultime partite. Riassumile e indica su quali colpi lavorare.",
    '',
    'Regole:',
    "- Usa esclusivamente ciò che è scritto nelle note. Non aggiungere osservazioni, cause o consigli tecnici che nelle note non ci sono. Non inventare risultati o dettagli.",
    "- «summary»: da 2 a 4 frasi in italiano, in seconda persona (\"hai\", \"ti\"), sul filo comune delle note. Se le note sono poche o contrastanti, dillo.",
    `- «highlights»: da 2 a ${MAX_HIGHLIGHTS} punti salienti, brevi, ciascuno ancorato a ciò che le note dicono (anche quando una cosa va bene, non solo i problemi).`,
    `- «suggestedFocus»: fino a ${MAX_SUGGESTED} colpi da allenare, SOLO se le note li motivano chiaramente, scelti ESCLUSIVAMENTE tra gli id del catalogo qui sotto, dal più al meno urgente. Se nessuno è motivato, lista vuota. Sono suggerimenti: li sceglie il maestro.`,
    '- Non nominare persone e non citare avversari. Nessun elenco di partite, nessun saluto, nessun consiglio generico.',
    '',
    'Catalogo dei colpi (id e etichetta):',
    focusCatalog(),
  ].join('\n')

  const lines = [`Note delle partite giocate dall'ultimo allenamento al prossimo (${input.used} partite con note):`, '']
  input.matches.forEach((m, i) => {
    const head = [
      `Partita ${i + 1}`,
      [m.date, m.time].filter(Boolean).join(' '),
      m.surface,
      TYPE_LABEL[m.type] || m.type,
      m.result ? RESULT_LABEL[m.result] || m.result : null,
      m.score || null,
      m.completed ? null : 'interrotta',
    ].filter(Boolean).join(' · ')
    lines.push(head)
    m.notes.forEach(n => lines.push(`  - ${n}`))
    lines.push('')
  })
  return { system, prompt: lines.join('\n').trim(), focusIds: FOCUS_IDS }
}

// ── La risposta del modello ─────────────────────────────────

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Normalizza ciò che arriva (stringa JSON o oggetto): testi corti e puliti, solo
// id di colpi che esistono, nessun doppione. `null` se non resta nulla di utile.
export function sanitizeSummary(raw) {
  let obj = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch { return null }
  }
  if (!obj || typeof obj !== 'object') return null

  const summary = clean(obj.summary, MAX_SUMMARY_CHARS)
  const highlights = (Array.isArray(obj.highlights) ? obj.highlights : [])
    .map(h => clean(h, MAX_HIGHLIGHT_CHARS)).filter(Boolean).slice(0, MAX_HIGHLIGHTS)
  const suggestedFocus = [...new Set(Array.isArray(obj.suggestedFocus) ? obj.suggestedFocus : [])]
    .filter(id => typeof id === 'string' && FOCUS_BY_ID[id]).slice(0, MAX_SUGGESTED)

  if (!summary && !highlights.length) return null
  return { summary, highlights, suggestedFocus }
}

// Il documento da salvare sul programma (`plan.summary`).
export function buildSavedSummary(result, input, { model = SUMMARY_MODEL, now = new Date() } = {}) {
  return {
    ...result,
    matches: input.matches.map(m => ({ id: m.id, date: m.date })),
    signature: input.signature,
    capped: input.capped,
    since: input.since,
    model,
    generatedAt: now.toISOString(),
  }
}

// Il riassunto salvato è ancora quello delle note di oggi?
export function isStale(saved, input) {
  return !saved || saved.signature !== input.signature
}

// ── Seconda fonte, deterministica: i colpi trascurati ───────
// Voci toccate almeno due volte e ferme da `NEGLECT_WARN` giorni o più (la stessa
// regola di «Da quanto non lo tocchi» in Stats › Tecnica). Non dipende dalle note
// né dal modello: c'è anche senza rete o con la quota finita.
export function neglectedFocus(trainings) {
  const rows = neglect(toFocusSessions(trainings)).rows
  return rows
    .filter(r => r.n >= 2 && r.days >= NEGLECT_WARN)
    .slice(0, MAX_NEGLECTED)
    .map(r => ({ id: r.id, label: r.label, days: r.days, n: r.n }))
}

