// ── Statistiche: rendimento in partita ──────────────────────
// Quinto modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa
// linea di tennis.js / training.js / athletics.js / wear.js.
//
// ── Perché quasi tutto è espresso in GAME e non in partite ──
// Il match non registra i dati punto per punto (niente ace, prime di servizio,
// vincenti/gratuiti), quindi le statistiche classiche del tennis televisivo non
// sono ricavabili. Quello che invece abbiamo è il punteggio set per set, cioè
// una granularità a livello di game: e il "game win %" è una stima del livello
// molto più stabile del "match win %", perché una partita produce ~20 game e un
// solo risultato. Con qualche decina di partite il win/loss è ancora rumore,
// mentre il GW% è già un segnale. Per questo il GW% è la metrica portante e il
// win% è il contorno.
//
// ── Perché ogni metrica dichiara una soglia minima ──
// Su un campione amatoriale una percentuale calcolata su 3 partite non è una
// statistica, è un aneddoto. Ogni blocco ha una MIN_* e sotto soglia mostra
// quante sessioni mancano invece del numero: è l'unica cosa che impedisce alla
// pagina di mentire nei primi mesi.

import {
  MATCH_FORMATS, MATCH_TYPES, countSets, hasScore, isTiebreakSet, setKind, setWinner,
} from './tennis'
import { levelLabel, playstyleLabel } from './opponents'

// ── Soglie minime di campione ──────────────────────────────
export const MIN_CORE     = 5   // per mostrare qualunque aggregato
export const MIN_CLUTCH   = 12  // confronto atteso/reale: serve stabilità sul GW%
export const MIN_SPLIT    = 5   // per riga di uno split (superficie, mano, ...)
export const MIN_TIEBREAK = 6
export const MIN_FIRSTSET = 5   // per ciascuno dei due rami (vinto/perso il 1°)
export const MIN_SET_SLOT = 6   // per colonna della curva di tenuta
export const MIN_OPPONENT = 3   // per riga H2H "parlante"
export const MIN_BRIDGE   = 5   // per bucket del ponte allenamenti → partite

// Rolling del GW%: 10 partite è il compromesso tra reattività e rumore.
export const ROLLING_WINDOW = 10

// ── Periodo ────────────────────────────────────────────────
// Stats possiede l'orizzonte LUNGO. La finestra mobile di 30 giorni è già della
// Panoramica (è il presente, serve ad agire); se anche Stats mostrasse 30
// giorni avremmo due pagine che dicono la stessa cosa con due layout diversi.

export const PERIODS = [
  { id: '90',  label: '90 giorni', days: 90  },
  { id: '365', label: '12 mesi',   days: 365 },
  { id: 'all', label: 'Sempre',    days: null },
]

export const DEFAULT_PERIOD = '365'

// Finestra che termina oggi (shift 0) o `shift` finestre più indietro, estremi
// inclusi. `null` per "Sempre" (nessun filtro).
export function periodRange(periodId, shift = 0) {
  const period = PERIODS.find(p => p.id === periodId)
  if (!period || !period.days) return null
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - shift * period.days)
  const start = new Date(end)
  start.setDate(end.getDate() - (period.days - 1))
  return { start, end }
}

// Mezzanotte LOCALE della data di una sessione: confrontare gli ISO grezzi
// farebbe cadere le sessioni serali nel giorno (e nel periodo) sbagliato.
export function dayTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function filterPeriod(items, range) {
  if (!range) return items
  const from = range.start.getTime()
  const to   = range.end.getTime()
  return items.filter(i => {
    const t = dayTime(i.date)
    return t != null && t >= from && t <= to
  })
}

// ── Primitive sul punteggio ────────────────────────────────

// I documenti legacy possono non avere `format`: si ricade su ATP, che è il
// formato più comune e non introduce set decisivi a regole speciali. Stessa
// tolleranza già usata da gamesInMatch in tennis.js.
function formatOf(match) {
  return MATCH_FORMATS[match?.format] || MATCH_FORMATS.atp
}

// Set effettivamente giocati, arricchiti con tipo ed esito. L'indice è quello
// ORIGINALE nell'array (il tipo di set dipende dalla posizione: il decisivo può
// avere regole diverse), quindi si mappa prima e si filtra dopo.
export function playedSets(match) {
  const fmt = formatOf(match)
  return (match?.sets || [])
    .map((set, index) => {
      const kind = setKind(fmt, index)
      return { set, index, kind, isSuperTb: kind === 'superTb', winner: setWinner(set, kind, fmt) }
    })
    .filter(s => hasScore(s.set))
}

// Game vinti da ciascuno in un match. Il super tie-break è ESCLUSO: 10-7 sono
// punti, non game, e sommarli falserebbe il GW% verso il basso o verso l'alto a
// seconda di come è andato. Viene contato a parte, come tie-break.
export function gamesOf(match) {
  let me = 0, opp = 0
  playedSets(match).forEach(({ set, isSuperTb }) => {
    if (isSuperTb) return
    me  += set.me  || 0
    opp += set.opp || 0
  })
  return { me, opp, total: me + opp }
}

// Ordina per data crescente senza mutare l'array in ingresso (getMatches lo
// restituisce desc, ma le serie storiche vanno lette in avanti).
export function chronological(items) {
  return [...items].sort((a, b) => (dayTime(a.date) || 0) - (dayTime(b.date) || 0))
}

// ── Aggregato di base ──────────────────────────────────────

export function coreStats(matches) {
  const perMatch = chronological(matches).map(match => {
    const g = gamesOf(match)
    return { match, gamesMe: g.me, gamesOpp: g.opp, result: match.result }
  })

  const wins   = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const draws  = matches.filter(m => m.result === 'draw').length
  const decided = wins + losses

  const gamesMe  = perMatch.reduce((s, x) => s + x.gamesMe, 0)
  const gamesOpp = perMatch.reduce((s, x) => s + x.gamesOpp, 0)

  let setsMe = 0, setsOpp = 0
  matches.forEach(m => {
    const r = countSets((m.sets || []).filter(hasScore), formatOf(m))
    setsMe  += r.setsMe
    setsOpp += r.setsOpp
  })

  return {
    n: matches.length,
    wins, losses, draws, decided,
    winRate:  decided ? wins / decided : null,
    gamesMe, gamesOpp,
    gameWinRate: gamesMe + gamesOpp ? gamesMe / (gamesMe + gamesOpp) : null,
    setsMe, setsOpp,
    setWinRate: setsMe + setsOpp ? setsMe / (setsMe + setsOpp) : null,
    avgMargin: matches.length ? (gamesMe - gamesOpp) / matches.length : null,
    perMatch,
  }
}

// Serie storica del GW% su finestra mobile: risponde a "sto migliorando?"
// meglio di qualunque conteggio di vittorie, perché si muove anche quando il
// win/loss resta fermo.
export function rollingGameWinRate(perMatch, window = ROLLING_WINDOW) {
  if (perMatch.length < window) return []
  const out = []
  for (let i = window - 1; i < perMatch.length; i++) {
    const slice = perMatch.slice(i - window + 1, i + 1)
    const me  = slice.reduce((s, x) => s + x.gamesMe, 0)
    const opp = slice.reduce((s, x) => s + x.gamesOpp, 0)
    out.push({ date: slice[slice.length - 1].match.date, value: me + opp ? me / (me + opp) : null })
  }
  return out
}

// ── Atteso vs reale (il "clutch delta") ────────────────────
// Dal GW% si ricava la probabilità di vincere un set e quindi il match,
// modellando ogni game come indipendente con probabilità p. È una
// semplificazione dichiarata (ignora l'alternanza al servizio e la
// correlazione tra i punti), ma è esattamente ciò che serve qui: dà il
// risultato che *ci si aspetterebbe* da un giocatore che vince quella quota di
// game in modo neutro. Lo scarto con il risultato reale misura quanto rendi nei
// momenti che contano — vincere i game giusti invece che tanti game.
//
// Il modello i.i.d. sui PUNTI sarebbe grossolanamente sbilanciato a favore del
// più forte; sui GAME invece regge, perché l'alternanza al servizio è già
// assorbita dentro il game. Taratura di riferimento: un top player vince ~58,5%
// dei game complessivi (~87% al servizio, ~30% in risposta) e ~83% dei match al
// meglio dei 3 — matchWinProb(0.585, 'atp') restituisce ~0,83. Se si tocca
// setWinProb o matchWinProb, questo è il caso da ri-verificare.
//
// Nota: lo stesso motore servirà all'area Previsioni, ed è il motivo per cui
// vive in un modulo puro invece che dentro un componente.

export function setWinProb(p) {
  const memo = new Map()
  const f = (a, b) => {
    if (a === 6 && b <= 4) return 1
    if (b === 6 && a <= 4) return 0
    if (a === 7) return 1
    if (b === 7) return 0
    if (a === 6 && b === 6) return p   // tie-break approssimato come un game
    const key = a * 10 + b
    if (memo.has(key)) return memo.get(key)
    const v = p * f(a + 1, b) + (1 - p) * f(a, b + 1)
    memo.set(key, v)
    return v
  }
  return f(0, 0)
}

export function matchWinProb(p, formatKey) {
  const fmt = MATCH_FORMATS[formatKey] || MATCH_FORMATS.atp
  const ps  = setWinProb(p)
  const g = (a, b) => {
    if (a === fmt.setsToWin) return 1
    if (b === fmt.setsToWin) return 0
    // Nel formato Amatoriale il set decisivo è un super tie-break: non è un set
    // a game, quindi si modella con p invece che con la probabilità di set.
    const isDecider = a + b === fmt.maxSets - 1
    const q = (isDecider && fmt.superTbDeciding) ? p : ps
    return q * g(a + 1, b) + (1 - q) * g(a, b + 1)
  }
  return g(0, 0)
}

// I pareggi (solo amichevoli interrotte) restano fuori dal confronto: non hanno
// un "atteso" con cui misurarsi.
export function clutchDelta(matches, gameWinRate) {
  const decided = matches.filter(m => m.result === 'win' || m.result === 'loss')
  if (!decided.length || gameWinRate == null) return null
  const p = Math.min(0.99, Math.max(0.01, gameWinRate))
  const expected = decided.reduce((s, m) => s + matchWinProb(p, m.format), 0) / decided.length
  const actual   = decided.filter(m => m.result === 'win').length / decided.length
  return { expected, actual, delta: actual - expected, n: decided.length, matches: decided }
}

// ── Come vinci e come perdi ────────────────────────────────

// Il punteggio medio di un set nelle vittorie e nelle sconfitte. "Vinco 6-3 e
// perdo 5-7" è un giocatore completamente diverso da "vinco 7-6 e perdo 1-6":
// il primo ha un tetto, il secondo un problema di solidità.
export function winLossProfile(matches) {
  const side = (result) => {
    const list = matches.filter(m => m.result === result)
    let me = 0, opp = 0, sets = 0, margin = 0
    list.forEach(m => {
      const g = gamesOf(m)
      margin += g.me - g.opp
      playedSets(m).forEach(({ set, isSuperTb }) => {
        if (isSuperTb) return
        me  += set.me  || 0
        opp += set.opp || 0
        sets++
      })
    })
    return {
      n: list.length,
      matches: list,
      avgMe:  sets ? me / sets : null,
      avgOpp: sets ? opp / sets : null,
      avgMargin: list.length ? margin / list.length : null,
    }
  }
  return { win: side('win'), loss: side('loss') }
}

// Peso del primo set: quanto tieni il vantaggio e quanto rimonti.
export function firstSetImpact(matches) {
  const branch = () => ({ n: 0, wins: 0, matches: [] })
  const won  = branch()
  const lost = branch()

  matches.forEach(m => {
    if (m.result !== 'win' && m.result !== 'loss') return
    if (formatOf(m).maxSets < 2) return           // ICS: un set secco è il match
    const first = playedSets(m).find(s => s.index === 0)
    if (!first || !first.winner) return
    const target = first.winner === 'me' ? won : lost
    target.n++
    target.matches.push(m)
    if (m.result === 'win') target.wins++
  })

  return {
    won, lost,
    holdRate:     won.n  ? won.wins / won.n   : null,   // vinto il 1° → vinta
    comebackRate: lost.n ? lost.wins / lost.n : null,   // perso il 1° → vinta
  }
}

// Curva di tenuta: GW% set per set. Se cala vistosamente nel decisivo, cali
// alla distanza — e la sezione Fisico dirà se è gambe o testa.
export function setIndexPerformance(matches) {
  const slots = []
  matches.forEach(m => {
    playedSets(m).forEach(({ set, index, isSuperTb }) => {
      if (isSuperTb) return   // punti, non game
      if (!slots[index]) slots[index] = { index, n: 0, gamesMe: 0, gamesOpp: 0, matches: [] }
      slots[index].n++
      slots[index].gamesMe  += set.me  || 0
      slots[index].gamesOpp += set.opp || 0
      slots[index].matches.push(m)
    })
  })
  return slots
    .filter(Boolean)
    .map(s => ({ ...s, rate: s.gamesMe + s.gamesOpp ? s.gamesMe / (s.gamesMe + s.gamesOpp) : null }))
}

// Set decisivi: quante volte sei arrivato all'ultimo set possibile e come è
// andata. Include il super tie-break, che è a tutti gli effetti un decisivo.
export function deciderRecord(matches) {
  const played = []
  let won = 0
  matches.forEach(m => {
    const fmt = formatOf(m)
    if (fmt.maxSets < 2) return
    const decider = playedSets(m).find(s => s.index === fmt.maxSets - 1)
    if (!decider || !decider.winner) return
    played.push(m)
    if (decider.winner === 'me') won++
  })
  return { n: played.length, won, lost: played.length - won, matches: played }
}

// Distribuzione dei punteggi di set: quanto sono equilibrati i set che vinci
// e quelli che perdi. Bucket per game concessi/raccolti da chi perde il set.
export const SET_BUCKETS = [
  { id: 'dominante',  label: 'Dominante',  sub: '6-0 / 6-1' },
  { id: 'solido',     label: 'Solido',     sub: '6-2 / 6-3' },
  { id: 'combattuto', label: 'Combattuto', sub: '6-4 / 7-5' },
  { id: 'tiebreak',   label: 'Tie-break',  sub: '7-6' },
]

function bucketOf(loserGames, tiebreak) {
  if (tiebreak) return 'tiebreak'
  if (loserGames <= 1) return 'dominante'
  if (loserGames <= 3) return 'solido'
  return 'combattuto'
}

export function setBalance(matches) {
  const empty = () => SET_BUCKETS.reduce((a, b) => ({ ...a, [b.id]: 0 }), {})
  const won = empty(), lost = empty()
  let bagelsGiven = 0, bagelsReceived = 0, total = 0

  matches.forEach(m => {
    playedSets(m).forEach(({ set, isSuperTb, winner }) => {
      if (isSuperTb || !winner) return
      const loserGames = winner === 'me' ? (set.opp || 0) : (set.me || 0)
      const bucket = bucketOf(loserGames, isTiebreakSet(set))
      if (winner === 'me') { won[bucket]++;  if (loserGames === 0) bagelsGiven++ }
      else                 { lost[bucket]++; if (loserGames === 0) bagelsReceived++ }
      total++
    })
  })

  return { won, lost, total, bagelsGiven, bagelsReceived }
}

// Tie-break e super tie-break restano separati: sono due prove diverse (7 punti
// dentro un set, 10 punti al posto di un set) e mescolarle nasconderebbe
// proprio il dato interessante.
export function tiebreakRecord(matches) {
  const normal  = { won: 0, lost: 0, matches: [] }
  const superTb = { won: 0, lost: 0, matches: [] }

  matches.forEach(m => {
    playedSets(m).forEach(({ set, isSuperTb, winner }) => {
      if (isSuperTb) {
        if (!winner) return
        winner === 'me' ? superTb.won++ : superTb.lost++
        superTb.matches.push(m)
        return
      }
      if (!isTiebreakSet(set)) return
      set.me === 7 ? normal.won++ : normal.lost++
      normal.matches.push(m)
    })
  })

  const rate = t => (t.won + t.lost ? t.won / (t.won + t.lost) : null)
  const all  = { won: normal.won + superTb.won, lost: normal.lost + superTb.lost }
  return {
    normal:  { ...normal,  n: normal.won + normal.lost,   rate: rate(normal)  },
    superTb: { ...superTb, n: superTb.won + superTb.lost, rate: rate(superTb) },
    all:     { ...all,     n: all.won + all.lost,         rate: rate(all)     },
  }
}

// Serie in corso e record storici. Un pareggio interrompe la serie senza
// estenderla: non è né una vittoria né una sconfitta.
export function streaks(matches) {
  const ordered = chronological(matches).map(m => m.result)

  let current = { type: null, count: 0 }
  for (let i = ordered.length - 1; i >= 0; i--) {
    const r = ordered[i]
    if (r !== 'win' && r !== 'loss') break
    if (current.type == null) current = { type: r, count: 1 }
    else if (r === current.type) current.count++
    else break
  }

  const best = (type) => {
    let max = 0, run = 0
    ordered.forEach(r => {
      run = r === type ? run + 1 : 0
      if (run > max) max = run
    })
    return max
  }

  return { current, bestWin: best('win'), worstLoss: best('loss') }
}

// ── Split ──────────────────────────────────────────────────
// Le stesse due metriche portanti tagliate per una dimensione. Le righe sono
// ordinate per SCOSTAMENTO dal GW% complessivo, non alfabeticamente: di uno
// split interessa dove sei anomalo, non l'elenco completo.

export const SPLIT_DIMENSIONS = [
  { id: 'surface',   label: 'Superficie', source: 'match' },
  { id: 'type',      label: 'Tipo',       source: 'match' },
  { id: 'format',    label: 'Formato',    source: 'match' },
  { id: 'hand',      label: 'Mano',       source: 'opponent' },
  { id: 'level',     label: 'Livello',    source: 'opponent' },
  { id: 'playstyle', label: 'Stile',      source: 'opponent' },
]

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// `level` e `playstyle` sono vocabolario controllato (src/lib/opponents.js),
// quindi la chiave è direttamente l'id salvato — niente più normalizzazione
// di testo libero.
function splitKey(dimension, match, opponent) {
  switch (dimension) {
    case 'surface': return match.surface || null
    case 'type':    return match.type || null
    case 'format':  return match.format || null
    case 'hand':    return opponent?.hand || null
    case 'level':   return opponent?.level     || null
    case 'playstyle': return opponent?.playstyle || null
    default: return null
  }
}

function splitLabel(dimension, key) {
  switch (dimension) {
    case 'type':   return MATCH_TYPES.find(t => t.id === key)?.label || cap(key)
    case 'format': return MATCH_FORMATS[key]?.label || cap(key)
    case 'hand':   return key === 'destro' ? 'Destrorsi' : 'Mancini'
    case 'level':     return levelLabel(key) || cap(key)
    case 'playstyle': return playstyleLabel(key) || cap(key)
    default: return cap(key)
  }
}

export function splitBy(matches, opponentsById, dimension, overallRate) {
  const groups = new Map()

  matches.forEach(m => {
    const opponent = opponentsById.get(m.opponentId)
    const key = splitKey(dimension, m, opponent)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  })

  return [...groups.entries()]
    .map(([key, list]) => {
      const core = coreStats(list)
      return {
        key,
        label: splitLabel(dimension, key),
        matches: list,
        n: list.length,
        wins: core.wins, losses: core.losses, draws: core.draws,
        winRate: core.winRate,
        rate: core.gameWinRate,
        delta: core.gameWinRate != null && overallRate != null ? core.gameWinRate - overallRate : null,
        enough: list.length >= MIN_SPLIT,
      }
    })
    .sort((a, b) => {
      if (a.enough !== b.enough) return a.enough ? -1 : 1
      return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
    })
}

// ── Avversari ──────────────────────────────────────────────

export function opponentBreakdown(matches, opponents) {
  const byId = new Map()
  matches.forEach(m => {
    if (!m.opponentId) return
    if (!byId.has(m.opponentId)) byId.set(m.opponentId, [])
    byId.get(m.opponentId).push(m)
  })

  const rows = [...byId.entries()].map(([id, list]) => {
    const core = coreStats(list)
    const known = opponents.find(o => o.id === id)
    return {
      id,
      name: known?.name || list[0].opponentName || 'Avversario',
      matches: list,
      n: list.length,
      wins: core.wins, losses: core.losses, draws: core.draws,
      winRate: core.winRate,
      rate: core.gameWinRate,
      enough: list.length >= MIN_OPPONENT,
    }
  }).sort((a, b) => b.n - a.n)

  const qualified = rows.filter(r => r.enough && r.winRate != null)
  const nemesis   = [...qualified].sort((a, b) => a.winRate - b.winRate)[0] || null
  const favourite = [...qualified].sort((a, b) => b.winRate - a.winRate)[0] || null

  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.n, 0)

  return {
    rows,
    distinct: rows.length,
    top3Share: matches.length ? top3 / matches.length : null,
    nemesis:   nemesis   && nemesis.winRate   <= 0.4 ? nemesis   : null,
    favourite: favourite && favourite.winRate >= 0.6 ? favourite : null,
  }
}

// Punteggi notevoli. Il "miglior risultato" non è pesabile per forza
// dell'avversario (il livello è testo libero), quindi si usa il margine in
// game: è un fatto oggettivo del punteggio, non una stima.
export function notableScorelines(matches) {
  const withMargin = matches
    .filter(m => m.result === 'win' || m.result === 'loss')
    .map(m => {
      const g = gamesOf(m)
      return { match: m, margin: g.me - g.opp }
    })
  const wins   = withMargin.filter(x => x.match.result === 'win')
  const losses = withMargin.filter(x => x.match.result === 'loss')
  return {
    bestWin:    wins.length   ? wins.reduce((a, b) => (b.margin > a.margin ? b : a))   : null,
    tightestWin: wins.length  ? wins.reduce((a, b) => (b.margin < a.margin ? b : a))   : null,
    worstLoss:  losses.length ? losses.reduce((a, b) => (b.margin < a.margin ? b : a)) : null,
  }
}

// ── Ponte allenamenti → partite ────────────────────────────
// È il vero payoff del diario allenamenti: dice se il lavoro svolto si vede in
// campo. Va letto con prudenza (correlazione, non causa: nei periodi in cui ti
// alleni di più stai anche meglio fisicamente e giochi con più continuità), ma
// è l'unica domanda a cui nessun'altra sezione può rispondere.

const PREP_WINDOW_DAYS = 14

export const PREP_BUCKETS = [
  { id: 'none',  label: 'Nessuno',      test: c => c === 0 },
  { id: 'few',   label: '1-2 sessioni', test: c => c >= 1 && c <= 2 },
  { id: 'many',  label: '3+ sessioni',  test: c => c >= 3 },
]

export const REST_BUCKETS = [
  { id: 'short', label: '0-1 giorni', test: d => d <= 1 },
  { id: 'mid',   label: '2-3 giorni', test: d => d >= 2 && d <= 3 },
  { id: 'long',  label: '4+ giorni',  test: d => d >= 4 },
]

const DAY_MS = 24 * 60 * 60 * 1000

// Ogni match viene annotato con quante sessioni lo precedono nei 14 giorni e
// con quanti giorni di stacco arriva dall'ultima attività (partita o
// allenamento). Il giorno stesso del match non conta come preparazione.
function annotate(matches, sessions) {
  const sessionDays = sessions.map(s => dayTime(s.date)).filter(t => t != null).sort((a, b) => a - b)
  return matches.map(m => {
    const t = dayTime(m.date)
    if (t == null) return { match: m, prep: null, rest: null }
    const prep = sessionDays.filter(d => d < t && d >= t - PREP_WINDOW_DAYS * DAY_MS).length
    const last = sessionDays.filter(d => d < t).pop()
    return { match: m, prep, rest: last != null ? Math.round((t - last) / DAY_MS) : null }
  })
}

function bucketize(annotated, buckets, pick) {
  return buckets.map(b => {
    const list = annotated.filter(a => pick(a) != null && b.test(pick(a))).map(a => a.match)
    const core = coreStats(list)
    return {
      key: b.id,
      label: b.label,
      matches: list,
      n: list.length,
      wins: core.wins, losses: core.losses,
      winRate: core.winRate,
      rate: core.gameWinRate,
      enough: list.length >= MIN_BRIDGE,
    }
  })
}

// Sotto questa soglia di allenamenti registrati il blocco non ha senso: i
// bucket sarebbero tutti "nessuna sessione" e la conclusione sarebbe un
// artefatto di quanto poco è stato registrato, non del gioco.
export const MIN_BRIDGE_TRAININGS = 10

export function trainingBridge(matches, trainings) {
  // Le sessioni precedenti includono le partite stesse: due partite in una
  // settimana sono carico quanto due allenamenti.
  const sessions  = [...trainings, ...matches]
  const annotated = annotate(matches, sessions)
  return {
    prep: bucketize(annotated, PREP_BUCKETS, a => a.prep),
    rest: bucketize(annotated, REST_BUCKETS, a => a.rest),
    trainingsCount: trainings.length,
    missing: Math.max(0, MIN_BRIDGE_TRAININGS - trainings.length),
    available: trainings.length >= MIN_BRIDGE_TRAININGS,
  }
}

// ── Report completo ────────────────────────────────────────
// Un'unica funzione che restituisce tutto il necessario alla sezione, così il
// componente fa un solo useMemo e non deve conoscere l'ordine dei calcoli.

export function buildRendimento({ matches = [], trainings = [], opponents = [] }) {
  const core = coreStats(matches)
  const opponentsById = new Map(opponents.map(o => [o.id, o]))

  const report = {
    core,
    rolling:   rollingGameWinRate(core.perMatch),
    clutch:    clutchDelta(matches, core.gameWinRate),
    profile:   winLossProfile(matches),
    firstSet:  firstSetImpact(matches),
    setIndex:  setIndexPerformance(matches),
    decider:   deciderRecord(matches),
    balance:   setBalance(matches),
    tiebreaks: tiebreakRecord(matches),
    streaks:   streaks(matches),
    splits:    SPLIT_DIMENSIONS.reduce((acc, d) => {
      acc[d.id] = splitBy(matches, opponentsById, d.id, core.gameWinRate)
      return acc
    }, {}),
    opponents: opponentBreakdown(matches, opponents),
    notable:   notableScorelines(matches),
    bridge:    trainingBridge(matches, trainings),
    enough:    matches.length >= MIN_CORE,
    missing:   Math.max(0, MIN_CORE - matches.length),
  }

  // Nessun insight finché la sezione stessa non è calcolabile: una frase che
  // rimanda a un blocco che mostra "servono ancora N partite" è una promessa
  // non mantenuta, e il tap non porterebbe da nessuna parte.
  report.insights = report.enough ? rendimentoInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Un numero non dice niente; "vinci il 61% dei game ma solo il 48% delle
// partite" dice tutto. Ogni regola ha una soglia di campione e una di effetto
// minimo, e produce una frase con dentro i numeri che l'hanno generata. Il peso
// (effetto × radice del campione) serve solo a ordinarle: una differenza grossa
// su pochi dati non deve superare una differenza netta su molti.

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const pp  = v => `${Math.round(Math.abs(v) * 100)}`

// `weight` può essere forzato: serve alle frasi che sono un avvertimento sulla
// lettura e non un risultato, che altrimenti scavalcherebbero i risultati veri
// solo perché calcolate su tutto il campione.
function insight(o) {
  const weight = o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n)
  return { ...o, weight }
}

export function rendimentoInsights(r) {
  const out = []
  const { core } = r

  // Clutch — la più importante: separa "gioca bene" da "vince".
  if (r.clutch && r.clutch.n >= MIN_CLUTCH && Math.abs(r.clutch.delta) >= 0.05) {
    const bad = r.clutch.delta < 0
    out.push(insight({
      id: 'clutch', target: 'clutch', tone: bad ? 'bad' : 'good', icon: bad ? '⚠️' : '🎯',
      effect: r.clutch.delta, n: r.clutch.n,
      text: bad
        ? `Vinci il ${pct(core.gameWinRate)} dei game ma solo il ${pct(r.clutch.actual)} delle partite: nei punti che contano rendi sotto il tuo livello.`
        : `Vinci il ${pct(core.gameWinRate)} dei game e il ${pct(r.clutch.actual)} delle partite: nei momenti decisivi rendi sopra il tuo livello.`,
    }))
  }

  // Tenuta alla distanza: primo set contro set decisivo.
  const first = r.setIndex[0]
  const last  = r.setIndex[r.setIndex.length - 1]
  if (first && last && first !== last && first.n >= MIN_SET_SLOT && last.n >= MIN_SET_SLOT
      && first.rate != null && last.rate != null && Math.abs(last.rate - first.rate) >= 0.06) {
    const drop = last.rate < first.rate
    out.push(insight({
      id: 'tenuta', target: 'tenuta', tone: drop ? 'bad' : 'good', icon: drop ? '📉' : '📈',
      effect: last.rate - first.rate, n: Math.min(first.n, last.n),
      text: drop
        ? `Nel ${last.index + 1}° set vinci il ${pct(last.rate)} dei game contro il ${pct(first.rate)} del primo: cali alla distanza.`
        : `Nel ${last.index + 1}° set vinci il ${pct(last.rate)} dei game contro il ${pct(first.rate)} del primo: cresci alla distanza.`,
    }))
  }

  // Peso del primo set.
  if (r.firstSet.lost.n >= MIN_FIRSTSET && r.firstSet.comebackRate != null) {
    if (r.firstSet.comebackRate >= 0.3) {
      out.push(insight({
        id: 'rimonta', target: 'primo-set', tone: 'good', icon: '💪',
        effect: r.firstSet.comebackRate, n: r.firstSet.lost.n,
        text: `Hai rimontato ${r.firstSet.lost.wins} delle ${r.firstSet.lost.n} partite in cui hai perso il primo set: non ti stacchi mai davvero.`,
      }))
    } else if (r.firstSet.comebackRate <= 0.1) {
      out.push(insight({
        id: 'rimonta', target: 'primo-set', tone: 'bad', icon: '🚪',
        effect: 0.3 - r.firstSet.comebackRate, n: r.firstSet.lost.n,
        text: `Quando perdi il primo set la partita è chiusa: solo ${r.firstSet.lost.wins} vittorie su ${r.firstSet.lost.n}. La partenza vale più di quanto pensi.`,
      }))
    }
  }
  if (r.firstSet.won.n >= MIN_FIRSTSET && r.firstSet.holdRate != null && r.firstSet.holdRate <= 0.65) {
    out.push(insight({
      id: 'crollo', target: 'primo-set', tone: 'bad', icon: '🕳',
      effect: 0.85 - r.firstSet.holdRate, n: r.firstSet.won.n,
      text: `Hai perso ${r.firstSet.won.n - r.firstSet.won.wins} partite su ${r.firstSet.won.n} dopo aver vinto il primo set: il problema è chiudere, non partire.`,
    }))
  }

  // Tie-break: la misura più pura dei momenti di pressione.
  const tb = r.tiebreaks.all
  if (tb.n >= MIN_TIEBREAK && tb.rate != null && Math.abs(tb.rate - 0.5) >= 0.15) {
    const bad = tb.rate < 0.5
    out.push(insight({
      id: 'tiebreak', target: 'tiebreak', tone: bad ? 'bad' : 'good', icon: bad ? '😤' : '🧊',
      effect: tb.rate - 0.5, n: tb.n,
      text: bad
        ? `Nei tie-break vinci ${tb.won} su ${tb.n}: è lì che lasci per strada le partite equilibrate.`
        : `Nei tie-break vinci ${tb.won} su ${tb.n}: sotto pressione tieni meglio dell'avversario.`,
    }))
  }

  // Split: si tiene solo lo scostamento più forte per dimensione, e solo le
  // due dimensioni più significative in assoluto — sei righe di split in cima
  // alla pagina sarebbero rumore, non insight.
  const splitInsights = []
  SPLIT_DIMENSIONS.forEach(dim => {
    const rows = (r.splits[dim.id] || []).filter(x => x.enough && x.delta != null)
    if (rows.length < 2) return
    const top = rows[0]
    if (Math.abs(top.delta) < 0.06) return
    const below = top.delta < 0
    splitInsights.push(insight({
      id: `split-${dim.id}`, target: 'split', tone: below ? 'bad' : 'good',
      icon: dim.id === 'surface' ? '🎾' : dim.id === 'hand' ? '✋' : dim.id === 'type' ? '🏆' : '🔍',
      effect: top.delta, n: top.n,
      text: `${dim.id === 'hand' ? 'Contro i' : 'Su'} ${top.label.toLowerCase()} vinci il ${pct(top.rate)} dei game, ${pp(top.delta)} punti ${below ? 'sotto' : 'sopra'} la tua media (${top.n} partite).`,
    }))
  })
  splitInsights.sort((a, b) => b.weight - a.weight).slice(0, 2).forEach(i => out.push(i))

  // Serie in corso: non è un'analisi, ma è il primo dato che chiunque cerca.
  if (r.streaks.current.count >= 3) {
    const win = r.streaks.current.type === 'win'
    out.push(insight({
      id: 'streak', target: 'livello', tone: win ? 'good' : 'bad', icon: win ? '🔥' : '🧊',
      effect: 0.05 * r.streaks.current.count, n: r.streaks.current.count,
      text: win
        ? `Sei a ${r.streaks.current.count} vittorie consecutive.`
        : `${r.streaks.current.count} sconfitte di fila: la serie negativa più lunga è di ${r.streaks.worstLoss}.`,
    }))
  }

  // Nemesi.
  if (r.opponents.nemesis) {
    const nem = r.opponents.nemesis
    out.push(insight({
      id: 'nemesi', target: 'avversari', tone: 'bad', icon: '👤',
      effect: 0.5 - (nem.winRate ?? 0), n: nem.n,
      text: `Contro ${nem.name} hai perso ${nem.losses} delle ${nem.n} partite giocate, con il ${pct(nem.rate)} dei game.`,
    }))
  }

  // Ponte allenamenti → partite.
  if (r.bridge.available) {
    const ready = r.bridge.prep.filter(b => b.enough && b.rate != null)
    if (ready.length >= 2) {
      const best  = ready.reduce((a, b) => (b.rate > a.rate ? b : a))
      const worst = ready.reduce((a, b) => (b.rate < a.rate ? b : a))
      if (best !== worst && best.rate - worst.rate >= 0.06) {
        out.push(insight({
          id: 'bridge', target: 'ponte', tone: 'good', icon: '🔗',
          effect: best.rate - worst.rate, n: Math.min(best.n, worst.n),
          text: `Quando arrivi da ${best.label.toLowerCase()} nelle due settimane precedenti vinci il ${pct(best.rate)} dei game, contro il ${pct(worst.rate)} con ${worst.label.toLowerCase()}.`,
        }))
      }
    }
  }

  // Varietà degli avversari: se il campione è concentrato su due persone, il
  // GW% misura loro, non te. È un avvertimento sulla lettura di tutto il resto.
  if (core.n >= 10 && r.opponents.top3Share != null && r.opponents.top3Share >= 0.7 && r.opponents.distinct >= 2) {
    out.push(insight({
      id: 'varieta', target: 'avversari', tone: 'neutral', icon: 'ℹ️',
      effect: r.opponents.top3Share - 0.5, n: core.n, weight: 0.35,
      text: `Il ${pct(r.opponents.top3Share)} delle tue partite è contro 3 avversari: queste medie descrivono soprattutto quei confronti.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Formattazione condivisa ────────────────────────────────

export function formatPct(v, fallback = '—') {
  return v == null ? fallback : `${Math.round(v * 100)}%`
}

export function formatGames(v) {
  return v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits: 1 })
}

export function formatSigned(v, digits = 1) {
  if (v == null) return '—'
  const s = v.toLocaleString('it-IT', { maximumFractionDigits: digits })
  return v > 0 ? `+${s}` : s
}
