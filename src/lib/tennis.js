// ── Logica di scoring del tennis ────────────────────────────
// Modulo puro (nessun React, nessun Firestore) condiviso da wizard, lista e
// dettaglio match. Il "punto di vista" è sempre quello dell'utente: `me` = io.

// Superfici disponibili (stesse usate in equipment)
export const SURFACES = ['terra', 'cemento', 'erba', 'indoor']

// Tipi di match. Campionato e torneo richiedono un nome evento e NON possono
// finire in parità (deve esserci sempre un vincitore).
export const MATCH_TYPES = [
  { id: 'amichevole', label: 'Amichevole', needsEvent: false, allowsDraw: true  },
  { id: 'campionato', label: 'Campionato', needsEvent: true,  allowsDraw: false },
  { id: 'torneo',     label: 'Torneo',     needsEvent: true,  allowsDraw: false },
]

// ── Turni di un tabellone ───────────────────────────────────
// Un turno è definito dalla sua DISTANZA DALLA FINALE (`depth`: finale = 1,
// semifinale = 2, quarti = 3...), non dal numero di iscritti al tabellone.
// È l'unica definizione che regge i tabelloni FITP reali, che quasi mai sono
// una potenza di 2 piena: teste di serie che entrano più avanti, bye, tabelloni
// limitati (LIM 4.1) in cui metà dei giocatori parte da un turno diverso, main
// draw da 10-12 giocatori. Qualunque sia la forma del tabellone, però, finisce
// sempre con una finale: contare all'indietro da lì dà un turno ben definito
// per ogni partita, e rende confrontabili tornei di dimensioni diverse.
//
// `qualificazioni` sta fuori dalla scala (`depth: null`) perché è un tabellone
// a sé che precede il main draw: è un unico gradino anche quando le partite di
// qualificazione sono più d'una — dettagliarle vorrebbe dire chiedere all'utente
// una gerarchia che non guarderà mai.
export const ROUNDS = [
  { id: 'qualificazioni',      label: 'Qualificazioni',      short: 'Qual.',  depth: null },
  { id: 'sessantaquattresimi', label: 'Sessantaquattresimi', short: '64esimi', depth: 7 },
  { id: 'trentaduesimi',       label: 'Trentaduesimi',       short: '32esimi', depth: 6 },
  { id: 'sedicesimi',          label: 'Sedicesimi',          short: '16esimi', depth: 5 },
  { id: 'ottavi',              label: 'Ottavi',              short: 'Ottavi',  depth: 4 },
  { id: 'quarti',              label: 'Quarti',              short: 'Quarti',  depth: 3 },
  { id: 'semifinale',          label: 'Semifinale',          short: 'Semi',    depth: 2 },
  { id: 'finale',              label: 'Finale',              short: 'Finale',  depth: 1 },
]

// Lookup piatto id → meta, e posizione nella scala (0 = qualificazioni, poi dal
// turno più lontano dalla finale alla finale). L'ordine dell'array È la
// progressione nel tabellone: ordinare per `roundOrder` crescente ricostruisce
// il cammino, senza bisogno delle date.
export const ROUND_BY_ID = Object.fromEntries(ROUNDS.map(r => [r.id, r]))

export function roundOrder(roundId) {
  const i = ROUNDS.findIndex(r => r.id === roundId)
  return i === -1 ? -1 : i
}

export function roundMeta(roundId) {
  return ROUND_BY_ID[roundId] || null
}

export function roundLabel(roundId) {
  return ROUND_BY_ID[roundId]?.label || null
}

// Turno successivo nella scala (chi vince i quarti va in semifinale). `null`
// dopo la finale: non c'è nulla oltre.
export function nextRound(roundId) {
  const i = roundOrder(roundId)
  if (i === -1 || i >= ROUNDS.length - 1) return null
  return ROUNDS[i + 1]
}

// Formati di gioco. Ogni set normale si vince a `setTarget` game con scarto ≥2;
// a 6-6 si gioca un tie-break (`setTbTarget` punti, scarto ≥2 → set 7-6).
// - decidingSetTbTarget: tie-break del set decisivo diverso dagli altri
//   (Grand Slam: 10 punti nel 5° set) — resta comunque un set a game.
// - superTbDeciding: il set decisivo è un intero super tie-break a punti
//   (Amatoriale: 3° "set" a 10 punti, senza game).
export const MATCH_FORMATS = {
  grandslam: {
    id: 'grandslam', label: 'Grand Slam', sub: 'Al meglio dei 5 set',
    setsToWin: 3, maxSets: 5, setTarget: 6, setTbTarget: 7,
    decidingSetTbTarget: 10, superTbDeciding: false, superTbTarget: null,
  },
  atp: {
    id: 'atp', label: 'ATP Tour', sub: 'Al meglio dei 3 set',
    setsToWin: 2, maxSets: 3, setTarget: 6, setTbTarget: 7,
    decidingSetTbTarget: 7, superTbDeciding: false, superTbTarget: null,
  },
  amatoriale: {
    id: 'amatoriale', label: 'Amatoriale', sub: '2 set + super tie-break',
    setsToWin: 2, maxSets: 3, setTarget: 6, setTbTarget: 7,
    decidingSetTbTarget: 7, superTbDeciding: true, superTbTarget: 10,
  },
  ics: {
    id: 'ics', label: 'ICS', sub: '1 set secco',
    setsToWin: 1, maxSets: 1, setTarget: 6, setTbTarget: 7,
    decidingSetTbTarget: 7, superTbDeciding: false, superTbTarget: null,
  },
}

export const FORMAT_LIST = Object.values(MATCH_FORMATS)

// Un set vuoto (punteggio 0-0, nessun tie-break)
export const emptySet = () => ({ me: 0, opp: 0, tbMe: null, tbOpp: null })

// Tipo del set all'indice `index` di un formato: il set decisivo (l'ultimo
// possibile) può avere regole diverse.
export function setKind(fmt, index) {
  const isDecider = index === fmt.maxSets - 1
  if (isDecider && fmt.superTbDeciding) return 'superTb'
  if (isDecider && fmt.decidingSetTbTarget !== fmt.setTbTarget) return 'normalLongTb'
  return 'normal'
}

// Punti bersaglio del tie-break per un dato tipo di set
export function tbTargetForKind(fmt, kind) {
  if (kind === 'superTb') return fmt.superTbTarget
  if (kind === 'normalLongTb') return fmt.decidingSetTbTarget
  return fmt.setTbTarget
}

// Un set normale è "arrivato al tie-break" quando è 6-6 (→ si conclude 7-6)
export function isTiebreakSet(set) {
  return (set.me === 7 && set.opp === 6) || (set.me === 6 && set.opp === 7)
}

// Un punteggio di tie-break è valido solo se il vincitore raggiunge il target
// (7, 10...) con uno scarto di almeno 2 punti (regola del "vantaggio")
export function isValidTiebreakScore(tbMe, tbOpp, target) {
  const me = tbMe ?? 0
  const opp = tbOpp ?? 0
  const max = Math.max(me, opp)
  const min = Math.min(me, opp)
  return max >= target && max - min >= 2
}

// Verifica che il tie-break di un set sia coerente con lo scarto minimo di 2
// punti e, per i set normali arrivati a 7-6/6-7, che il suo vincitore
// coincida con chi ha vinto il set. Nel super tie-break (Amatoriale) il
// punteggio del "set" stesso è già il tie-break, quindi la regola dello
// scarto si applica direttamente a `me`/`opp`. `retired` sospende il
// controllo sul super tie-break, dato che un ritiro può interromperlo a
// punteggio parziale (non ancora concluso).
export function isTiebreakValid(set, kind, fmt, retired = null) {
  if (kind === 'superTb') {
    if (retired || !hasScore(set)) return true
    return isValidTiebreakScore(set.me, set.opp, tbTargetForKind(fmt, kind))
  }
  if (!isTiebreakSet(set)) return true
  const { tbMe, tbOpp } = set
  if (tbMe == null || tbOpp == null) return false
  if (!isValidTiebreakScore(tbMe, tbOpp, tbTargetForKind(fmt, kind))) return false
  const setWinnerSide = set.me === 7 ? 'me' : 'opp'
  const tbWinnerSide = tbMe > tbOpp ? 'me' : 'opp'
  return tbWinnerSide === setWinnerSide
}

// Vincitore di un singolo set: 'me' | 'opp' | null (set non ancora concluso)
export function setWinner(set, kind, fmt) {
  const { me, opp } = set
  if (kind === 'superTb') {
    const t = fmt.superTbTarget
    if (me >= t && me - opp >= 2) return 'me'
    if (opp >= t && opp - me >= 2) return 'opp'
    return null
  }
  const target = fmt.setTarget
  // Set chiuso al tie-break: 7-6
  if (me === 7 && opp === 6) return 'me'
  if (opp === 7 && me === 6) return 'opp'
  // Set normale: raggiunti i game bersaglio con scarto ≥2 (es. 6-4, 7-5)
  if (me >= target && me - opp >= 2) return 'me'
  if (opp >= target && opp - me >= 2) return 'opp'
  return null
}

// Conta i set vinti da ciascuno tra i set forniti
export function countSets(sets, fmt) {
  let setsMe = 0, setsOpp = 0
  sets.forEach((s, i) => {
    const w = setWinner(s, setKind(fmt, i), fmt)
    if (w === 'me') setsMe++
    else if (w === 'opp') setsOpp++
  })
  return { setsMe, setsOpp }
}

// Esito complessivo del match dal punto di vista dell'utente.
// Ritorna { result: 'win'|'loss'|'draw', completed, setsMe, setsOpp }.
// - retired: 'me' | 'opp' | null → chi si ritira perde a tavolino
// - match concluso: qualcuno raggiunge setsToWin
// - match interrotto (solo amichevole): vince chi ha più set; a pari set chi ha
//   più game (esclusi i punti dei super tie-break); a pari game → pareggio.
export function computeOutcome(sets, formatKey, retired = null) {
  const fmt = MATCH_FORMATS[formatKey]
  const cleaned = (sets || []).filter(hasScore)
  const { setsMe, setsOpp } = countSets(cleaned, fmt)

  if (retired === 'me')  return { result: 'loss', completed: true, setsMe, setsOpp }
  if (retired === 'opp') return { result: 'win',  completed: true, setsMe, setsOpp }

  if (setsMe >= fmt.setsToWin)  return { result: 'win',  completed: true, setsMe, setsOpp }
  if (setsOpp >= fmt.setsToWin) return { result: 'loss', completed: true, setsMe, setsOpp }

  // Match non concluso → regole di interruzione
  if (setsMe > setsOpp) return { result: 'win',  completed: false, setsMe, setsOpp }
  if (setsOpp > setsMe) return { result: 'loss', completed: false, setsMe, setsOpp }

  let gamesMe = 0, gamesOpp = 0
  cleaned.forEach((s, i) => {
    if (setKind(fmt, i) === 'superTb') return
    gamesMe += s.me || 0
    gamesOpp += s.opp || 0
  })
  if (gamesMe > gamesOpp) return { result: 'win',  completed: false, setsMe, setsOpp }
  if (gamesOpp > gamesMe) return { result: 'loss', completed: false, setsMe, setsOpp }
  return { result: 'draw', completed: false, setsMe, setsOpp }
}

// Un set ha un punteggio inserito (non 0-0 vuoto)
export function hasScore(set) {
  return (set.me || 0) > 0 || (set.opp || 0) > 0
}

// ── Game giocati e durata ───────────────────────────────────

// Un super tie-break (set decisivo Amatoriale) non ha game: lo contiamo come un
// equivalente fisso di ~2 game (durata di un mini-set a 10 punti).
export const SUPER_TB_GAME_EQUIV = 2

// Game giocati in un match, sommando i game di ogni set. Per il super tie-break
// (riconosciuto dal formato) si usa l'equivalente fisso. Se il match è legacy e
// non ha `format`, si sommano i punteggi grezzi (approssimazione accettabile).
// Vive qui e non in wear.js perché "quanti game sono stati giocati" è un fatto
// di scoring: l'usura ne è solo il primo consumatore, la durata il secondo.
export function gamesInMatch(match) {
  const fmt = MATCH_FORMATS[match?.format]
  const sets = match?.sets || []
  let games = 0
  sets.forEach((s, i) => {
    if (fmt && setKind(fmt, i) === 'superTb') {
      games += SUPER_TB_GAME_EQUIV
      return
    }
    games += (s?.me || 0) + (s?.opp || 0)
  })
  return games
}

// Minuti "in campo" di un game, usati solo per la STIMA (vedi `matchMinutes`).
// ~5 minuti è la taratura amatoriale: un 6-4 6-3 (19 game) esce a ~1h35, un
// 6-0 6-0 (12 game) a un'ora scarsa.
export const MINUTES_PER_GAME = 5

// Il match NON ha un campo durata: l'unico dato misurato è
// `athletics.durationSec`, che è facoltativo (lo si compila solo trascrivendo i
// dati dall'orologio). Un totale di "ore in campo" che contasse 0 le partite
// senza dati atletici mentirebbe verso il basso proprio nei mesi in cui si è
// giocato di più, quindi quando il dato reale manca la durata viene stimata dai
// game. Chi consuma questa funzione DEVE segnalare la stima all'utente
// (prefisso "~") invece di spacciarla per una misura — vedi `hasRealDuration`.
export function matchMinutes(match) {
  if (hasRealDuration(match)) return match.athletics.durationSec / 60
  return gamesInMatch(match) * MINUTES_PER_GAME
}

export function hasRealDuration(match) {
  return Number(match?.athletics?.durationSec) > 0
}

// Meta per la UI dell'esito (bollino + etichetta)
export const RESULT_META = {
  win:  { label: 'Vittoria',  color: 'var(--color-win)',  bg: 'var(--color-win-bg)'  },
  loss: { label: 'Sconfitta', color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' },
  draw: { label: 'Pareggio',  color: 'var(--color-draw)', bg: 'var(--color-draw-bg)' },
}

export const surfaceIcon = s =>
  ({ terra: '🟠', cemento: '🔵', erba: '🟢', indoor: '🏟' }[s] || '🎾')
