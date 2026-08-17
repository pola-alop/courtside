// ── Tornei: il cammino dell'utente dentro un tabellone ──────
// Decimo modulo puro di `src/lib/` (nessun React, nessun Firestore).
//
// La decisione che regge tutto il file: **non esiste un documento "torneo"**.
// Un torneo è un fatto DERIVATO dalle partite già registrate — quelle con
// `type: 'torneo'` e lo stesso `eventName` — esattamente come il record H2H è
// derivato e non persistito. Aggiungere una collection `tournaments` avrebbe
// significato mantenere in sincrono due verità (le partite e il loro
// contenitore) e chiedere all'utente di creare il torneo prima di registrarci
// dentro una partita, cioè attrito prima ancora di aver giocato.
//
// L'unico dato nuovo che il match porta con sé è `round` (un tap nel wizard).
// Da quello si ricava tutto il resto — dove sei entrato, dove sei uscito, quanto
// mancava alla finale — senza trascrivere nemmeno una partita altrui.

import { ROUNDS, ROUND_BY_ID, roundOrder, nextRound } from './tennis'

// Due partite con lo stesso nome torneo ma distanti più di così sono due
// EDIZIONI diverse ("Summer IV Roma" 2025 e 2026), non lo stesso cammino.
// Separare per anno solare sarebbe sbagliato per i tornei a cavallo di dicembre;
// il buco temporale è il segnale giusto perché un torneo reale si esaurisce in
// giorni o al massimo poche settimane.
export const RUN_GAP_DAYS = 60

// Un cammino la cui ultima partita è una vittoria non finale è "in corso": il
// turno dopo si giocherà. Passato questo margine però è più probabile che il
// torneo sia finito e manchi la registrazione dell'ultima partita, quindi lo
// stato resta lo stesso ma la UI ne cambia la lettura (vedi `stale`).
export const ONGOING_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

// ── Costruzione ────────────────────────────────────────────

// `matches` è l'array di `useMatches` (già ordinato per data desc).
// Ritorna i cammini ordinati dal più recente al più vecchio.
export function buildTournaments(matches = [], today = Date.now()) {
  const groups = new Map()

  matches
    .filter(m => m.type === 'torneo' && normalizeName(m.eventName))
    .forEach(m => {
      const key = normalizeName(m.eventName)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(m)
    })

  const runs = []
  groups.forEach(list => {
    // In ordine cronologico crescente, poi spezzato in edizioni sui buchi
    const byDate = [...list].sort((a, b) => new Date(a.date) - new Date(b.date))
    let current = []
    byDate.forEach(m => {
      const prev = current[current.length - 1]
      if (prev && daysApart(prev.date, m.date) > RUN_GAP_DAYS) {
        runs.push(makeRun(current, today))
        current = []
      }
      current.push(m)
    })
    if (current.length > 0) runs.push(makeRun(current, today))
  })

  return runs.sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
}

function makeRun(matches, today) {
  const startDate = matches[0].date
  const endDate   = matches[matches.length - 1].date
  // Grafia dell'ultima registrazione: se l'utente ha corretto il nome strada
  // facendo, quella corretta è la più recente.
  const name = (matches[matches.length - 1].eventName || '').trim()

  // Il cammino è ordinato per POSIZIONE NEL TABELLONE, non per data: le due
  // cose coincidono quasi sempre, ma non quando un turno viene registrato in
  // ritardo, e il tabellone è la verità che conta qui.
  const path = matches
    .filter(m => ROUND_BY_ID[m.round])
    .sort((a, b) => roundOrder(a.round) - roundOrder(b.round) || new Date(a.date) - new Date(b.date))

  // Partite di torneo senza turno: quasi solo quelle registrate prima che il
  // campo esistesse. Non vengono buttate — restano nel record e la UI le mostra
  // a parte, invitando ad assegnare il turno.
  const undated = matches.filter(m => !ROUND_BY_ID[m.round])

  const last  = path[path.length - 1] || null
  const first = path[0] || null

  const wins   = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length

  let status = 'unknown'
  let nextRoundId = null
  if (last) {
    const depth = ROUND_BY_ID[last.round].depth
    if (last.result === 'win') {
      // Vinta la finale → titolo. Vinto un altro turno → si è passati al turno
      // successivo, che però non è (ancora) registrato.
      if (depth === 1) {
        status = 'champion'
      } else {
        status = 'ongoing'
        nextRoundId = nextRound(last.round)?.id || null
      }
    } else {
      status = depth === 1 ? 'finalist' : 'eliminated'
    }
  }

  return {
    // Chiave stabile finché il torneo non viene rinominato o la sua prima
    // partita spostata di data: regge il pattern "selected item derivato".
    id: `${normalizeName(name)}__${(startDate || '').slice(0, 10)}`,
    name,
    matches,
    path,
    undated,
    startDate,
    endDate,
    surfaces: [...new Set(matches.map(m => m.surface).filter(Boolean))],
    played: matches.length,
    wins,
    losses,
    setsMe:  matches.reduce((s, m) => s + (m.setsMe  || 0), 0),
    setsOpp: matches.reduce((s, m) => s + (m.setsOpp || 0), 0),
    entryRoundId: first?.round || null,
    lastRoundId:  last?.round  || null,
    nextRoundId,
    status,
    // Un cammino "in corso" da più di un mese non lo è davvero: manca un dato.
    stale: status === 'ongoing' && daysApart(endDate, today) > ONGOING_DAYS,
  }
}

// ── Il tabellone come scala verticale ──────────────────────

// Da `run` alla lista dei gradini da disegnare, **dalla finale all'ingresso**
// (l'ordine in cui vanno letti: la finale in cima è il traguardo).
//
// I gradini oltre l'uscita esistono e sono etichettati: è questo che restituisce
// il contesto perso rinunciando al tabellone completo — "uscito ai quarti"
// significa poco, "uscito ai quarti con due turni ancora davanti" significa
// tutto, e non è costato all'utente nessun dato aggiuntivo.
export function runLadder(run) {
  if (!run?.path?.length) return []

  const startIdx = roundOrder(run.path[0].round)
  const lastIdx  = roundOrder(run.lastRoundId)
  const steps = []

  for (let i = startIdx; i < ROUNDS.length; i++) {
    const round = ROUNDS[i]
    const played = run.path.filter(m => m.round === round.id)

    // Un turno vuoto PRIMA dell'ultimo giocato non è "non raggiunto": è un bye
    // o un ingresso diretto nel tabellone (tipico dei tabelloni FITP, dove chi
    // passa le qualificazioni può entrare a turno inoltrato).
    const state = played.length > 0 ? 'played' : (i < lastIdx ? 'bye' : 'unreached')

    steps.push({ round, matches: played, state })
  }

  return steps.reverse()
}

// ── Sintesi di carriera ────────────────────────────────────

export function palmares(runs = []) {
  const finals = runs.filter(r => reachedDepth(r) <= 1).length
  return {
    tournaments: runs.length,
    titles:      runs.filter(r => r.status === 'champion').length,
    finals,
    semifinals:  runs.filter(r => reachedDepth(r) <= 2).length,
    matches: runs.reduce((s, r) => s + r.played, 0),
    wins:    runs.reduce((s, r) => s + r.wins,   0),
    losses:  runs.reduce((s, r) => s + r.losses, 0),
    ongoing: runs.filter(r => r.status === 'ongoing' && !r.stale).length,
  }
}

// Profondità massima RAGGIUNTA (non solo giocata): chi vince i quarti ha
// raggiunto la semifinale anche se quella partita non è ancora registrata.
// `Infinity` quando non c'è nessun turno noto, così i confronti `<=` sono falsi
// senza casi speciali.
export function reachedDepth(run) {
  if (!run?.lastRoundId) return Infinity
  const depth = ROUND_BY_ID[run.lastRoundId]?.depth
  if (depth == null) return Infinity // uscito in qualificazione: mai entrato nel tabellone
  return run.status === 'ongoing' || run.status === 'champion' ? Math.max(depth - 1, 0) : depth
}

// ── Meta per la UI ─────────────────────────────────────────
// Stessa convenzione di `RESULT_META` in tennis.js: le etichette e i colori di
// un esito vivono accanto alla logica che lo calcola, non sparsi nei componenti.

// Preposizioni articolate per turno. L'italiano non ne ha una sola — "ai
// quarti", "agli ottavi", "in semifinale" — e una frase costruita a
// concatenazione ("Out a Semifinale") si nota subito in una schermata curata.
const ROUND_PHRASES = {
  qualificazioni:      { in: 'in qualificazione',        from: 'dalle qualificazioni' },
  sessantaquattresimi: { in: 'ai sessantaquattresimi',   from: 'dai sessantaquattresimi' },
  trentaduesimi:       { in: 'ai trentaduesimi',         from: 'dai trentaduesimi' },
  sedicesimi:          { in: 'ai sedicesimi',            from: 'dai sedicesimi' },
  ottavi:              { in: 'agli ottavi',              from: 'dagli ottavi' },
  quarti:              { in: 'ai quarti',                from: 'dai quarti' },
  semifinale:          { in: 'in semifinale',            from: 'dalla semifinale' },
  finale:              { in: 'in finale',                from: 'dalla finale' },
}

export function roundPhrase(roundId, kind = 'in') {
  return ROUND_PHRASES[roundId]?.[kind] || null
}

export function runStatusMeta(run) {
  switch (run?.status) {
    case 'champion':
      return { label: 'Titolo', icon: '🏆', color: 'var(--color-amber)', bg: 'rgba(244,163,0,0.16)' }
    case 'finalist':
      return { label: 'Finalista', icon: '🥈', color: 'var(--color-amber-light)', bg: 'rgba(244,163,0,0.12)' }
    case 'ongoing':
      return run.stale
        ? { label: 'Da completare', icon: '⏳', color: 'var(--color-slate)', bg: 'var(--color-surface-2)' }
        : { label: 'In corso', icon: '▶', color: 'var(--color-teal)', bg: 'rgba(72,179,176,0.16)' }
    case 'eliminated':
      return {
        label: `Out ${roundPhrase(run.lastRoundId, 'in')}`,
        icon: '', color: 'var(--color-loss)', bg: 'var(--color-loss-bg)',
      }
    default:
      return { label: 'Turni da indicare', icon: '', color: 'var(--color-slate)', bg: 'var(--color-surface-2)' }
  }
}

// ── Helpers ────────────────────────────────────────────────

// Raggruppare per nome vuol dire raggruppare per una stringa scritta a mano:
// stessa scelta degli split di Stats — si normalizza per confrontare, ma si
// mostra sempre la grafia originale.
function normalizeName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Distanza in giorni tra due istanti. Qui NON serve la mezzanotte locale di
// `dayTime` (stats.js): le soglie sono a 30 e 60 giorni, dove qualche ora di
// scarto non cambia mai il risultato — e importare stats.js trascinerebbe un
// modulo da 800 righe dentro il chunk della pagina Matches.
function daysApart(a, b) {
  return Math.abs(new Date(b) - new Date(a)) / DAY_MS
}
