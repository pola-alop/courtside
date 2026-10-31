// Undicesimo modulo puro di src/lib/ (nessun React/Firestore): vocabolario
// controllato per Livello/classifica e Stile di gioco dell'anagrafica
// avversari, prima campi di testo libero. Sostituisce i valori arbitrari con
// un elenco fisso così i dropdown di AddOpponentModal/OpponentDetailModal e
// gli split di Stats condividono la stessa unica fonte di verità.

import { dayTime } from './stats'
import { todayTime, WEEKDAYS, MONTHS_SHORT } from './activity'
import { plansWithStatus, toCalendarSessions } from './calendar'

const DAY_MS = 86400000

// Classificazione federale FITP: quarta categoria da 4.6 (ingresso) a 4.1,
// terza da 3.5 a 3.1, seconda da 2.8 a 2.1, poi la prima categoria
// (Nazionale). NC precede la classifica vera e propria. Elenco dal metodo di
// classificazione FITP (fitp.it, classifiche 2026).
export const LEVELS = [
  { id: 'nc',   label: 'NC (non classificato)' },
  { id: '4.6',  label: '4.6' },
  { id: '4.5',  label: '4.5' },
  { id: '4.4',  label: '4.4' },
  { id: '4.3',  label: '4.3' },
  { id: '4.2',  label: '4.2' },
  { id: '4.1',  label: '4.1' },
  { id: '3.5',  label: '3.5' },
  { id: '3.4',  label: '3.4' },
  { id: '3.3',  label: '3.3' },
  { id: '3.2',  label: '3.2' },
  { id: '3.1',  label: '3.1' },
  { id: '2.8',  label: '2.8' },
  { id: '2.7',  label: '2.7' },
  { id: '2.6',  label: '2.6' },
  { id: '2.5',  label: '2.5' },
  { id: '2.4',  label: '2.4' },
  { id: '2.3',  label: '2.3' },
  { id: '2.2',  label: '2.2' },
  { id: '2.1',  label: '2.1' },
  { id: '1cat', label: '1ª categoria (Nazionale)' },
]

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]))
export const levelLabel = id => LEVEL_BY_ID[id]?.label || null

// Le 5 tipologie di giocatore riconosciute dalla stessa FITP (fitp.it,
// "Giocare a tennis" › Tecnica e stili di gioco) più "Regolarista", termine
// amatoriale italiano molto diffuso per chi gioca di pura rimessa senza
// necessariamente contrattaccare — distinto dal contrattaccante da fondo.
export const PLAYSTYLES = [
  { id: 'regolarista',      label: 'Regolarista (di rimessa)' },
  { id: 'contrattaccante',  label: 'Contrattaccante da fondo' },
  { id: 'aggressivo-fondo', label: 'Aggressivo da fondo campo' },
  { id: 'attacco',          label: "Giocatore d'attacco (servizio potente)" },
  { id: 'serve-volley',     label: 'Serve & volley' },
  { id: 'completo',         label: 'Completo (a tutto campo)' },
]

export const PLAYSTYLE_BY_ID = Object.fromEntries(PLAYSTYLES.map(p => [p.id, p]))
export const playstyleLabel = id => PLAYSTYLE_BY_ID[id]?.label || null

// ── Nome e cognome ─────────────────────────────────────────
// Lo stesso modulo tiene tutto ciò che deriva da Nome/Cognome (iniziali, forma
// breve) così le card, i selettori e il punteggio non hanno più una propria
// copia dell'euristica "l'ultima parola è il cognome".
//
// Sul documento `firstName` (obbligatorio) e `lastName` (facoltativo) sono la
// fonte; `name` è la loro composizione, salvata a ogni scrittura, così ricerca,
// programmi, calendario e Stats continuano a leggere un'unica stringa.

// Divide un nome libero sul primo spazio: Nome = prima parola, Cognome = il
// resto (i cognomi composti, "Di Gaetano", restano interi). Serve alla
// migrazione dei documenti vecchi e come ripiego finché non sono migrati.
export function splitName(name) {
  const trimmed = (name || '').trim()
  const match = trimmed.match(/^(\S+)\s+(.+)$/)
  if (!match) return { firstName: trimmed, lastName: '' }
  return { firstName: match[1], lastName: match[2].replace(/\s+/g, ' ') }
}

// I tre campi da scrivere insieme. Cognome vuoto → null.
export function opponentNameFields(firstName, lastName) {
  const first = (firstName || '').trim().replace(/\s+/g, ' ')
  const last = (lastName || '').trim().replace(/\s+/g, ' ')
  return { firstName: first, lastName: last || null, name: last ? `${first} ${last}` : first }
}

// Nome e cognome di un avversario, anche se il documento è ancora quello vecchio.
export function opponentParts(opponent) {
  const first = (opponent?.firstName || '').trim()
  if (first) return { firstName: first, lastName: (opponent.lastName || '').trim() }
  return splitName(opponent?.name)
}

// "MR"; con il cognome vuoto le prime due lettere del nome; "?" se non c'è nulla.
export function opponentInitials(opponent) {
  const { firstName, lastName } = opponentParts(opponent)
  if (!firstName) return '?'
  if (!lastName) return firstName.slice(0, 2).toUpperCase()
  return (firstName[0] + lastName[0]).toUpperCase()
}

// "Di Gaetano M."; con il cognome vuoto il solo nome; null se non c'è nulla.
export function opponentShortName(opponent) {
  const { firstName, lastName } = opponentParts(opponent)
  if (!firstName) return null
  if (!lastName) return firstName
  return `${lastName} ${firstName[0].toUpperCase()}.`
}

// ── Gruppi di avversari ────────────────────────────────────
// `users/{uid}/opponentGroups`: { name, memberIds: [opponentId] }. L'appartenenza
// sta sul gruppo e non sull'avversario; gli id di avversari eliminati restano
// nell'array e si ignorano in lettura.

export const cleanGroupName = name => (name || '').trim().replace(/\s+/g, ' ')

// Il problema di un nome di gruppo, o null: vuoto, oppure già usato (senza
// distinguere le maiuscole). `excludeId` è il gruppo che si sta rinominando.
export function groupNameIssue(name, groups, excludeId = null) {
  const clean = cleanGroupName(name)
  if (!clean) return 'Il nome del gruppo non può essere vuoto.'
  const taken = groups.some(g => g.id !== excludeId && cleanGroupName(g.name).toLowerCase() === clean.toLowerCase())
  return taken ? 'Esiste già un gruppo con questo nome.' : null
}

// ── Rotazione ──────────────────────────────────────────────
// L'ordine con cui si apre un gruppo: chi è ora di chiamare viene prima. Tre
// fasce, in quest'ordine:
//  · `never`   — nessuna partita registrata contro di lui, per cognome;
//  · `played`  — ha giocato, dall'ultima partita più lontana alla più recente
//                (a parità, per cognome);
//  · `planned` — ha una partita in programma da oggi in avanti e ancora da fare:
//                scende in fondo, per data del programma. Vale anche per chi non
//                ha mai giocato (`lastDay` null).
// Contano solo le PARTITE con `opponentId`: gli allenamenti con lui come compagno
// non entrano. Un programma passato e non registrato ("non svolto") non conta, e
// uno di oggi già giocato è `done`, quindi l'avversario torna in `played` con
// l'ultima partita di oggi. Lo stato dei programmi è quello di `plansWithStatus`.
// `today` si passa solo per collaudare su date fisse.
const BAND_ORDER = { never: 0, played: 1, planned: 2 }

export function groupRotation(group, { opponents = [], matches = [], plans = [], today = todayTime() } = {}) {
  const now = startOfDay(today)

  const lastDay = new Map()
  matches.forEach(m => {
    const day = dayTime(m?.date)
    if (!m?.opponentId || day == null) return
    if (!lastDay.has(m.opponentId) || day > lastDay.get(m.opponentId)) lastDay.set(m.opponentId, day)
  })

  const matchPlans = plans.filter(p => p?.kind === 'match')
  const plannedDay = new Map()
  plansWithStatus(matchPlans, toCalendarSessions({ matches }), now).forEach(p => {
    const id = p.details?.opponentId
    if (!id || p.status !== 'todo') return
    if (!plannedDay.has(id) || p.day < plannedDay.get(id)) plannedDay.set(id, p.day)
  })

  return groupMembers(group, opponents)
    .map(opponent => {
      const last = lastDay.get(opponent.id) ?? null
      const planned = plannedDay.get(opponent.id) ?? null
      const band = planned != null ? 'planned' : last != null ? 'played' : 'never'
      return { opponent, band, lastDay: last, plannedDay: planned }
    })
    .sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band]
      || (a.band === 'played' ? a.lastDay - b.lastDay : 0)
      || (a.band === 'planned' ? a.plannedDay - b.plannedDay : 0)
      || bySurname(a.opponent, b.opponent))
}

// Per cognome, poi per nome; senza cognome vale il nome (come la forma breve).
function bySurname(a, b) {
  const pa = opponentParts(a)
  const pb = opponentParts(b)
  const cmp = (x, y) => x.localeCompare(y, 'it', { sensitivity: 'base' })
  return cmp(pa.lastName || pa.firstName, pb.lastName || pb.firstName) || cmp(pa.firstName, pb.firstName)
}

// "Ultima partita: 4 mesi fa · 12/06". Soglie statiche: oggi, ieri, giorni sotto
// i 14, settimane sotto le 8, mesi sotto i 12, poi anni. L'anno compare nella
// data solo oltre l'anno di distanza.
export function lastMatchText(lastDay, today = todayTime()) {
  const now = startOfDay(today)
  const days = Math.max(0, Math.round((now - lastDay) / DAY_MS))
  const then = new Date(lastDay)
  const nowDate = new Date(now)
  const months = (nowDate.getFullYear() - then.getFullYear()) * 12 + nowDate.getMonth() - then.getMonth()
    - (nowDate.getDate() < then.getDate() ? 1 : 0)

  let ago
  if (days === 0) ago = 'oggi'
  else if (days === 1) ago = 'ieri'
  else if (days < 14) ago = `${days} giorni fa`
  else if (days < 56) ago = `${Math.floor(days / 7)} settimane fa`
  else if (months < 12) ago = `${months} ${months === 1 ? 'mese' : 'mesi'} fa`
  else {
    const years = Math.floor(months / 12)
    ago = `${years} ${years === 1 ? 'anno' : 'anni'} fa`
  }

  const dd = String(then.getDate()).padStart(2, '0')
  const mm = String(then.getMonth() + 1).padStart(2, '0')
  const date = months >= 12 ? `${dd}/${mm}/${String(then.getFullYear()).slice(-2)}` : `${dd}/${mm}`
  return `Ultima partita: ${ago} · ${date}`
}

// "In programma oggi" / "domani" / "sab 8 nov".
export function plannedText(plannedDay, today = todayTime()) {
  const days = Math.round((plannedDay - startOfDay(today)) / DAY_MS)
  if (days <= 0) return 'In programma oggi'
  if (days === 1) return 'In programma domani'
  const d = new Date(plannedDay)
  return `In programma ${WEEKDAYS[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`
}

function startOfDay(time) {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Gli avversari membri del gruppo, nell'ordine di `opponents`; gli id che non
// corrispondono più a un avversario si ignorano.
export function groupMembers(group, opponents) {
  const ids = new Set(group?.memberIds || [])
  return opponents.filter(o => ids.has(o.id))
}

// I gruppi di cui fa parte un avversario.
export function groupsOf(opponentId, groups) {
  return groups.filter(g => (g.memberIds || []).includes(opponentId))
}
