// Modulo puro di src/lib/ (nessun React/Firestore, nessun import: si carica
// anche da Node per i collaudi). Gli SCONTRI A SQUADRE (2.2.0, Fase 5): due
// squadre si affrontano in più incontri, per esempio 2 singolari + 1 doppio.
//
// A differenza di un torneo uno scontro NON si può ricavare dalle partite: ha
// dati che le partite dell'utente non hanno (la squadra avversaria e gli esiti
// degli incontri giocati dai compagni). Per questo ha un documento proprio,
// `users/{uid}/teamTies`:
//   { date (ISO, come le partite), opponentTeam, home: true|false|null,
//     formula: { singles, doubles }, rubbers: [{ slot, winner, score }] }
//
// Il legame con le partite sta **solo sulla partita** (`tieId` + `slot`, con
// `type: 'squadre'`), mai sullo scontro: non c'è una seconda copia da tenere
// allineata, e eliminando la partita l'incontro si libera da solo.
// `rubbers` contiene solo gli esiti dei compagni, uno per incontro: un
// incontro con una partita mia non ne ha.
//
// Il risultato dello scontro (2-1) si ricava sempre, non si salva.
//
// Incontri («slot»): `S1`, `S2`… sono i singolari, `D1`… i doppi, nell'ordine
// di gioco (prima i singolari). Gli id sono stabili: ridurre la formula toglie
// gli ultimi, non rinumera.

export const FORMULA_LIMITS = {
  singles: { min: 0, max: 6 },
  doubles: { min: 0, max: 3 },
}

// 2 singolari + 1 doppio: la formula di partenza del form, non un valore che
// si applica da solo a un documento che non ne ha uno valido.
export const DEFAULT_FORMULA = { singles: 2, doubles: 1 }

export const SCORE_MAX_LENGTH = 24
export const TEAM_NAME_MAX_LENGTH = 40

const clampInt = (n, { min, max }) => Math.min(max, Math.max(min, Math.round(Number(n))))

// Legge la formula di un documento: numeri interi nei limiti. Senza una formula
// leggibile ripiega sulla predefinita (un documento senza formula non esiste
// per come lo scrive l'app, ma il ripiego evita uno scontro senza incontri).
export function readFormula(formula) {
  const s = Number(formula?.singles)
  const d = Number(formula?.doubles)
  if (!Number.isFinite(s) || !Number.isFinite(d)) return { ...DEFAULT_FORMULA }
  const read = { singles: clampInt(s, FORMULA_LIMITS.singles), doubles: clampInt(d, FORMULA_LIMITS.doubles) }
  return read.singles + read.doubles > 0 ? read : { ...DEFAULT_FORMULA }
}

export const formulaTotal = f => f.singles + f.doubles

// «2 singolari + 1 doppio»
export function formulaText(formula) {
  const { singles, doubles } = readFormula(formula)
  const parts = []
  if (singles > 0) parts.push(`${singles} ${singles === 1 ? 'singolare' : 'singolari'}`)
  if (doubles > 0) parts.push(`${doubles} ${doubles === 1 ? 'doppio' : 'doppi'}`)
  return parts.join(' + ')
}

// Per il form: la formula scelta deve avere almeno un incontro.
export function formulaIssue(formula) {
  if (!formula || !(formula.singles + formula.doubles > 0)) return 'Serve almeno un incontro.'
  return null
}

// ── Incontri ───────────────────────────────────────────────

export const slotKind = slot => (String(slot).startsWith('D') ? 'doppio' : 'singolo')

export const slotLabel = slot => `${slotKind(slot) === 'doppio' ? 'Doppio' : 'Singolare'} ${String(slot).slice(1)}`

// Gli incontri della formula, nell'ordine di gioco.
export function slotsOf(formula) {
  const { singles, doubles } = readFormula(formula)
  const slots = []
  for (let i = 1; i <= singles; i++) slots.push(`S${i}`)
  for (let i = 1; i <= doubles; i++) slots.push(`D${i}`)
  return slots
}

// ── Lettura dello scontro ──────────────────────────────────

// Le partite collegate allo scontro (le mie), per data.
export const matchesOfTie = (matches = [], tieId) =>
  matches
    .filter(m => m.type === 'squadre' && tieId && m.tieId === tieId)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

const winnerOfMatch = m => (m?.result === 'win' ? 'us' : m?.result === 'loss' ? 'them' : null)

// Un incontro per ogni slot della formula:
//   state 'own'  → c'è una mia partita (`match`), l'esito viene da lì;
//   state 'mate' → esito segnato per un compagno (`winner`, `score`);
//   state 'open' → ancora niente.
// `excludeMatchId` serve al wizard: la partita che si sta modificando non
// occupa il suo stesso incontro.
export function tieRubbers(tie, matches = [], { excludeMatchId = null } = {}) {
  const mine = matchesOfTie(matches, tie?.id).filter(m => m.id !== excludeMatchId)
  const saved = Array.isArray(tie?.rubbers) ? tie.rubbers : []
  return slotsOf(tie?.formula).map(slot => {
    const base = { slot, kind: slotKind(slot), label: slotLabel(slot) }
    const match = mine.find(m => m.slot === slot)
    if (match) return { ...base, state: 'own', match, winner: winnerOfMatch(match), score: null }
    const r = saved.find(x => x?.slot === slot)
    if (r && (r.winner === 'us' || r.winner === 'them')) {
      return { ...base, state: 'mate', match: null, winner: r.winner, score: r.score || null }
    }
    return { ...base, state: 'open', match: null, winner: null, score: null }
  })
}

// Il risultato: incontri vinti da noi e da loro, quanti restano da decidere.
export function tieResult(rubbers) {
  const us = rubbers.filter(r => r.winner === 'us').length
  const them = rubbers.filter(r => r.winner === 'them').length
  const total = rubbers.length
  return { us, them, total, decided: us + them, pending: total - us - them }
}

export const resultText = r => `${r.us}-${r.them}`

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Stato dello scontro, nessuna soglia da tarare:
//   won / lost → uno ha vinto più della metà degli incontri (anche se ne
//                restano da giocare: lo scontro è deciso);
//   draw       → formula pari, tutto deciso, parità;
//   incomplete → la data è passata e lo scontro non è deciso: è un dato che
//                manca, non uno scontro in corso;
//   ongoing    → qualche incontro deciso, data di oggi o futura;
//   upcoming   → nessun incontro deciso, data di oggi o futura.
export function tieStatus(tie, rubbers, today = new Date()) {
  const r = tieResult(rubbers)
  if (r.total === 0) return 'upcoming'
  if (r.us * 2 > r.total) return 'won'
  if (r.them * 2 > r.total) return 'lost'
  if (r.pending === 0) return 'draw'
  const past = String(tie?.date || '').slice(0, 10) < dayKey(today)
  if (past) return 'incomplete'
  return r.decided > 0 ? 'ongoing' : 'upcoming'
}

export function tieStatusMeta(status) {
  switch (status) {
    case 'won':        return { label: 'Vinto',         color: 'var(--color-win)',   bg: 'var(--color-win-bg)' }
    case 'lost':       return { label: 'Perso',         color: 'var(--color-loss)',  bg: 'var(--color-loss-bg)' }
    case 'draw':       return { label: 'Pareggio',      color: 'var(--color-draw)',  bg: 'var(--color-draw-bg)' }
    case 'ongoing':    return { label: 'In corso',      color: 'var(--color-teal)',  bg: 'rgba(72,179,176,0.16)' }
    case 'incomplete': return { label: 'Da completare', color: 'var(--color-slate)', bg: 'var(--color-surface-2)' }
    default:           return { label: 'Da giocare',    color: 'var(--color-slate)', bg: 'var(--color-surface-2)' }
  }
}

// Tutto ciò che la UI mostra di uno scontro, calcolato in un colpo solo.
export function describeTie(tie, matches = [], today = new Date()) {
  const rubbers = tieRubbers(tie, matches)
  const result = tieResult(rubbers)
  return { rubbers, result, status: tieStatus(tie, rubbers, today) }
}

// Più recenti prima.
export const sortTies = ties => [...ties].sort((a, b) => new Date(b.date) - new Date(a.date))

export const homeLabel = home => (home === true ? 'In casa' : home === false ? 'In trasferta' : null)

// ── Incontri liberi (wizard) ───────────────────────────────

// Gli incontri dello scontro dove si può registrare una mia partita: liberi, di
// quella disciplina. La partita in modifica non occupa il proprio incontro.
export function freeSlots(tie, matches, { discipline, excludeMatchId = null } = {}) {
  return tieRubbers(tie, matches, { excludeMatchId })
    .filter(r => r.state === 'open' && (!discipline || r.kind === discipline))
    .map(r => r.slot)
}

// ── Scrittura ──────────────────────────────────────────────

export const cleanTeamName = s => String(s || '').replace(/\s+/g, ' ').trim()

export const cleanScore = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, SCORE_MAX_LENGTH)

// Per il form dello scontro: nome e data obbligatori, nessun valore d'ufficio.
export function tieIssue({ opponentTeam, date, formula }) {
  if (!cleanTeamName(opponentTeam)) return 'Scrivi il nome della squadra avversaria.'
  if (!date) return 'Scegli la data.'
  return formulaIssue(formula)
}

// Gli `rubbers` di un documento con l'esito di un incontro cambiato. Senza
// vincitore l'incontro torna aperto (anche il punteggio sparisce: non ha
// senso senza chi ha vinto). Si tiene una sola voce per slot.
export function withRubberResult(rubbers, slot, winner, score = null) {
  const rest = (Array.isArray(rubbers) ? rubbers : []).filter(r => r?.slot !== slot)
  if (winner !== 'us' && winner !== 'them') return rest
  return [...rest, { slot, winner, score: cleanScore(score) || null }]
}

// Il numero di ogni disciplina sotto il quale la formula non può scendere:
// l'incontro più alto già usato (una mia partita o un esito dei compagni).
export function formulaFloor(tie, matches = []) {
  const floor = { singles: 0, doubles: 0 }
  const used = [
    ...matchesOfTie(matches, tie?.id).map(m => m.slot),
    ...(Array.isArray(tie?.rubbers) ? tie.rubbers.map(r => r?.slot) : []),
  ]
  used.forEach(slot => {
    const n = Number(String(slot).slice(1))
    if (!Number.isFinite(n)) return
    const key = slotKind(slot) === 'doppio' ? 'doubles' : 'singles'
    floor[key] = Math.max(floor[key], n)
  })
  return floor
}

// Avviso se la formula nuova toglie un incontro già usato.
export function formulaBlockIssue(formula, floor) {
  if (formula.singles < floor.singles) return `Il singolare ${floor.singles} ha già un esito o una partita: non si può togliere.`
  if (formula.doubles < floor.doubles) return `Il doppio ${floor.doubles} ha già un esito o una partita: non si può togliere.`
  return null
}

// Guard di eliminazione: uno scontro con partite mie collegate non si elimina
// (si eliminano prima le partite). Ritorna il messaggio, o null se si può.
export function deleteIssue(tie, matches = []) {
  const n = matchesOfTie(matches, tie?.id).length
  if (n === 0) return null
  return `Ha ${n} ${n === 1 ? 'partita collegata' : 'partite collegate'}: eliminala prima di eliminare lo scontro.`
}
