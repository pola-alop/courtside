// Modulo puro di src/lib/ (nessun React/Firestore). Le COMPETIZIONI A SQUADRE
// (2.2.0, Fase 6): un torneo a squadre con un girone all'italiana (e, se c'è,
// una fase finale a eliminazione) fatto di scontri a squadre (`teamTies.js`).
//
// Documento `users/{uid}/teamCompetitions`:
//   { name, season, teams: [{ id, name }], myTeamId, legs: 1|2,
//     formula: { singles, doubles }, points: { win, draw, loss },
//     qualifiers (0 = nessuna fase finale),
//     results: [{ a, b, leg, scoreA, scoreB, sets, games }] }
// `results` contiene SOLO i risultati degli scontri tra altre squadre (B–C):
// i miei scontri sono i `teamTies` della competizione, mai copiati qui.
//
// Sullo scontro (`teamTies`) la competizione aggiunge `competitionId`,
// `phase: 'girone'|'finale'`, `leg` (andata/ritorno), `opponentTeamId` (girone),
// `round` (finale, di `ROUNDS`) e `totals: { sets, games }` facoltativi.
//
// Sono SEMPRE ricavati, mai salvati: il calendario degli scontri, la classifica
// con gli spareggi, lo stato della competizione e il nome della squadra
// avversaria (le squadre hanno un id e un nome: rinominare una squadra non lascia
// nomi vecchi sugli scontri, regola del bug 4.1 della 2.0.0).

import { describeTie, formulaTotal, formulaIssue, readFormula } from './teamTies'
import { ROUND_BY_ID, roundOrder, nextRound } from './tennis'
import { roundPhrase } from './tournaments'

// ── Costanti (valori di partenza da ritoccare a mano) ──────

export const TEAMS_LIMITS = { min: 3, max: 8 }
// Il regolamento non è disponibile: 3-1-0 è la proposta, configurabile.
export const DEFAULT_POINTS = { win: 3, draw: 1, loss: 0 }
export const POINTS_LIMITS = { min: 0, max: 9 }
export const COMPETITION_NAME_MAX_LENGTH = 40
export const SEASON_MAX_LENGTH = 20
export const TOTAL_MAX = 99 // set o game totali di uno scontro

// ── Lettura dei documenti ──────────────────────────────────

const isInt = n => Number.isInteger(n)
const asInt = v => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)

export const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim()

export function newTeamId() {
  return `t${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

export function readPoints(points) {
  const read = {}
  for (const k of ['win', 'draw', 'loss']) {
    const n = asInt(points?.[k])
    if (n == null || n < POINTS_LIMITS.min || n > POINTS_LIMITS.max) return { ...DEFAULT_POINTS }
    read[k] = n
  }
  return read
}

// Una coppia di totali (set o game): `[noi, loro]` oppure null se manca o non è valida.
export function readPair(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) return null
  const [a, b] = [asInt(pair[0]), asInt(pair[1])]
  if (a == null || b == null || a < 0 || b < 0 || a > TOTAL_MAX || b > TOTAL_MAX) return null
  return [a, b]
}

function readResults(results, teamIds, legs) {
  return (Array.isArray(results) ? results : [])
    .map(r => ({
      a: r?.a, b: r?.b, leg: r?.leg === 2 ? 2 : 1,
      scoreA: asInt(r?.scoreA), scoreB: asInt(r?.scoreB),
      sets: readPair(r?.sets), games: readPair(r?.games),
    }))
    .filter(r => r.a !== r.b && teamIds.has(r.a) && teamIds.has(r.b)
      && r.leg <= legs && r.scoreA != null && r.scoreB != null && r.scoreA >= 0 && r.scoreB >= 0)
}

// Normalizza un documento Firestore (campi mancanti o sporchi non rompono niente).
export function readCompetition(doc) {
  const seen = new Set()
  const teams = (Array.isArray(doc?.teams) ? doc.teams : [])
    .filter(t => t && typeof t.id === 'string' && !seen.has(t.id) && seen.add(t.id))
    .map(t => ({ id: t.id, name: cleanName(t.name) }))
  const ids = new Set(teams.map(t => t.id))
  const legs = doc?.legs === 2 ? 2 : 1
  const qualifiers = Math.max(0, Math.min(teams.length - 1, asInt(doc?.qualifiers) ?? 0))
  return {
    ...doc,
    name: cleanName(doc?.name),
    season: cleanName(doc?.season),
    teams,
    myTeamId: ids.has(doc?.myTeamId) ? doc.myTeamId : null,
    legs,
    formula: readFormula(doc?.formula),
    points: readPoints(doc?.points),
    qualifiers: teams.length > 0 ? qualifiers : 0,
    results: readResults(doc?.results, ids, legs),
  }
}

export const teamName = (competition, teamId) =>
  competition?.teams?.find(t => t.id === teamId)?.name || null

// ── Gli scontri della competizione ─────────────────────────

export const isFinalTie = tie => tie?.phase === 'finale'
export const legOf = tie => (tie?.leg === 2 ? 2 : 1)

const byDate = (a, b) => new Date(a.date) - new Date(b.date)

export const competitionTies = (competition, ties = []) =>
  ties.filter(t => competition && t.competitionId === competition.id).sort(byDate)

export const groupTies = (competition, ties = []) =>
  competitionTies(competition, ties).filter(t => !isFinalTie(t))

export const finalTies = (competition, ties = []) =>
  competitionTies(competition, ties).filter(isFinalTie)

// Il nome della squadra avversaria è quello ATTUALE della competizione (la
// copia salvata sullo scontro resta solo di ripiego, se la squadra non esiste più).
export function withCompetitionNames(ties = [], competitions = []) {
  const byId = new Map(competitions.map(c => [c.id, c]))
  return ties.map(t => {
    const name = teamName(byId.get(t.competitionId), t.opponentTeamId)
    return name && name !== t.opponentTeam ? { ...t, opponentTeam: name } : t
  })
}

// «Girone · Andata», «Quarti»: il contesto da scrivere accanto a uno scontro.
export function tieContext(tie, competition = null) {
  if (!tie?.competitionId) return null
  if (isFinalTie(tie)) return ROUND_BY_ID[tie.round]?.label || 'Fase finale'
  const leg = competition?.legs === 2 ? ` · ${legOf(tie) === 2 ? 'Ritorno' : 'Andata'}` : ''
  return `Girone${leg}`
}

// ── Calendario degli scontri del girone ────────────────────

export const fixtureKey = (a, b, leg) => `${leg}|${[a, b].sort().join('|')}`

// Tutte le coppie del girone (una volta per andata, e per il ritorno se c'è):
// l'ordine delle giornate lo decide la federazione, non si inventa.
export function fixtures(competition) {
  const teams = competition?.teams || []
  const legs = competition?.legs === 2 ? 2 : 1
  const list = []
  for (let leg = 1; leg <= legs; leg++) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        list.push({ key: fixtureKey(teams[i].id, teams[j].id, leg), leg, a: teams[i].id, b: teams[j].id })
      }
    }
  }
  return list
}

const outcomeOf = (sa, sb) => (sa > sb ? 'a' : sb > sa ? 'b' : 'draw')

// Ogni scontro del calendario con ciò che se ne sa:
//   mine     → c'è `tie` (se già creato) e il risultato viene dagli incontri;
//   altrimenti → il risultato inserito a mano in `results` (se c'è).
// `decided` = si conosce l'esito (scontro vinto/perso/pari, oppure risultato
// inserito). `scoreA`/`scoreB` sono gli incontri vinti dalle due squadre
// (a e b del calendario); `sets`/`games` sono `[a, b]` o null.
export function resolveFixtures(competition, ties = [], matches = [], today = new Date()) {
  const mineId = competition?.myTeamId
  const mineTies = groupTies(competition, ties)
  const results = competition?.results || []

  return fixtures(competition).map(f => {
    const mine = Boolean(mineId) && (f.a === mineId || f.b === mineId)
    const base = {
      ...f, mine, tie: null, info: null, decided: false, outcome: null,
      scoreA: null, scoreB: null, sets: null, games: null, resultKey: null,
    }
    if (mine) {
      const otherId = f.a === mineId ? f.b : f.a
      const tie = mineTies.find(t => t.opponentTeamId === otherId && legOf(t) === f.leg) || null
      if (!tie) return base
      const info = describeTie(tie, matches, today)
      const decided = info.status === 'won' || info.status === 'lost' || info.status === 'draw'
      const mineIsA = f.a === mineId
      const us = info.result.us
      const them = info.result.them
      const totals = readTotals(tie.totals)
      const orient = pair => (pair ? (mineIsA ? pair : [pair[1], pair[0]]) : null)
      return {
        ...base, tie, info, decided,
        outcome: decided ? outcomeOf(mineIsA ? us : them, mineIsA ? them : us) : null,
        scoreA: decided ? (mineIsA ? us : them) : null,
        scoreB: decided ? (mineIsA ? them : us) : null,
        sets: orient(totals.sets), games: orient(totals.games),
      }
    }
    const r = results.find(x => fixtureKey(x.a, x.b, x.leg) === f.key)
    if (!r) return base
    const straight = r.a === f.a
    const orient = pair => (pair ? (straight ? pair : [pair[1], pair[0]]) : null)
    const scoreA = straight ? r.scoreA : r.scoreB
    const scoreB = straight ? r.scoreB : r.scoreA
    return {
      ...base, decided: true, outcome: outcomeOf(scoreA, scoreB), scoreA, scoreB,
      sets: orient(r.sets), games: orient(r.games), resultKey: f.key,
    }
  })
}

// I totali facoltativi di uno scontro mio: `{ sets: [noi, loro]|null, games: ... }`.
export function readTotals(totals) {
  return { sets: readPair(totals?.sets), games: readPair(totals?.games) }
}

// ── Classifica ─────────────────────────────────────────────

function emptyRow(team, mineId) {
  return {
    teamId: team.id, name: team.name, mine: team.id === mineId,
    played: 0, won: 0, drawn: 0, lost: 0, points: 0,
    rubFor: 0, rubAgainst: 0,
    setsFor: 0, setsAgainst: 0, setsKnown: true,
    gamesFor: 0, gamesAgainst: 0, gamesKnown: true,
  }
}

function addSide(row, outcomeSide, mine, theirs, sets, games, points) {
  row.played += 1
  row.rubFor += mine
  row.rubAgainst += theirs
  if (outcomeSide === 'win') { row.won += 1; row.points += points.win }
  else if (outcomeSide === 'draw') { row.drawn += 1; row.points += points.draw }
  else { row.lost += 1; row.points += points.loss }
  if (sets) { row.setsFor += sets[0]; row.setsAgainst += sets[1] } else row.setsKnown = false
  if (games) { row.gamesFor += games[0]; row.gamesAgainst += games[1] } else row.gamesKnown = false
}

const sideOutcome = (outcome, side) => (outcome === 'draw' ? 'draw' : outcome === side ? 'win' : 'loss')
const swap = pair => (pair ? [pair[1], pair[0]] : null)

// Raggruppa le righe per valore (dal più alto), conservando l'ordine d'arrivo.
function partition(rows, valueOf) {
  const parts = []
  const sorted = [...rows].sort((x, y) => valueOf(y) - valueOf(x))
  sorted.forEach(r => {
    const last = parts[parts.length - 1]
    if (last && valueOf(last[0]) === valueOf(r)) last.push(r)
    else parts.push([r])
  })
  return parts
}

// Punti degli scontri DIRETTI tra le squadre del gruppo. `null` se qualcuno di
// quegli scontri non è ancora deciso: una miniclassifica a metà non dice niente.
function directValues(group, all, points) {
  const ids = new Set(group.map(r => r.teamId))
  const needed = all.filter(f => ids.has(f.a) && ids.has(f.b))
  if (needed.some(f => !f.decided)) return null
  const value = new Map(group.map(r => [r.teamId, 0]))
  needed.forEach(f => {
    value.set(f.a, value.get(f.a) + points[sideOutcome(f.outcome, 'a')])
    value.set(f.b, value.get(f.b) + points[sideOutcome(f.outcome, 'b')])
  })
  return value
}

// Criteri generali, nell'ordine: differenza incontri → differenza set → game.
// Set e game si usano solo se TUTTE le squadre in parità li hanno per ogni
// scontro giocato: altrimenti non si inventa un ordine e si dichiara.
const GENERAL = [
  { id: 'incontri', known: () => true, value: r => r.rubFor - r.rubAgainst },
  { id: 'set', known: g => g.every(r => r.setsKnown), value: r => r.setsFor - r.setsAgainst },
  { id: 'game', known: g => g.every(r => r.gamesKnown), value: r => r.gamesFor - r.gamesAgainst },
]

function applyGeneral(cluster, i) {
  if (cluster.rows.length === 1) return [cluster]
  if (i >= GENERAL.length) return [{ ...cluster, unresolved: 'parita' }]
  const c = GENERAL[i]
  if (!c.known(cluster.rows)) return [{ ...cluster, unresolved: c.id }]
  const parts = partition(cluster.rows, c.value)
  if (parts.length === 1) return applyGeneral(cluster, i + 1)
  return parts.flatMap(p => applyGeneral({ rows: p, by: c.id, unresolved: null, directIncomplete: cluster.directIncomplete }, i + 1))
}

// Squadre a pari punti → gruppi ordinati. Prima gli scontri diretti (miniclassifica
// dei soli scontri tra loro, e se divide il gruppo si riparte dai sottogruppi),
// poi i criteri generali.
function resolveGroup(group, all, points, by = null) {
  if (group.length === 1) return [{ rows: group, by, unresolved: null, directIncomplete: false }]
  const dir = directValues(group, all, points)
  if (dir) {
    const parts = partition(group, r => dir.get(r.teamId))
    if (parts.length > 1) return parts.flatMap(p => resolveGroup(p, all, points, 'diretti'))
  }
  return applyGeneral({ rows: group, by, unresolved: null, directIncomplete: dir === null }, 0)
}

const listNames = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`)

function noteOf(cluster) {
  const names = listNames(cluster.rows.map(r => r.name))
  const direct = cluster.directIncomplete ? ' Gli scontri diretti non sono ancora tutti decisi.' : ''
  switch (cluster.unresolved) {
    case 'set':   return `${names}: pari merito, lo spareggio per set non si può calcolare (mancano set e game di qualche scontro).${direct}`
    case 'game':  return `${names}: pari merito, lo spareggio per game non si può calcolare (mancano set e game di qualche scontro).${direct}`
    case 'parita': return `${names}: pari merito, tutti i criteri sono in parità.${direct}`
    default: return null
  }
}

// La classifica del girone, ricavata da scontri e risultati. Ritorna
//   rows        → una riga per squadra, già ordinata (`rank`, `tied`, `tiebreak`,
//                 `qualification` 'in'|'out'|'uncertain'|null);
//   fixtures    → il calendario risolto;
//   complete    → tutti gli scontri sono decisi (altrimenti la classifica è parziale);
//   missingResults → scontri tra altre squadre senza risultato;
//   toPlay      → miei scontri non ancora decisi;
//   notes       → spareggi non calcolabili, da dichiarare.
export function buildStandings(competition, ties = [], matches = [], today = new Date()) {
  const teams = competition?.teams || []
  const points = competition?.points || DEFAULT_POINTS
  const all = resolveFixtures(competition, ties, matches, today)

  const rows = new Map(teams.map(t => [t.id, emptyRow(t, competition?.myTeamId)]))
  all.filter(f => f.decided).forEach(f => {
    addSide(rows.get(f.a), sideOutcome(f.outcome, 'a'), f.scoreA, f.scoreB, f.sets, f.games, points)
    addSide(rows.get(f.b), sideOutcome(f.outcome, 'b'), f.scoreB, f.scoreA, swap(f.sets), swap(f.games), points)
  })

  const clusters = partition([...rows.values()], r => r.points)
    .flatMap(group => resolveGroup(group, all, points))

  const q = competition?.qualifiers || 0
  const ranked = []
  let position = 1
  clusters.forEach(cluster => {
    const ordered = [...cluster.rows].sort((x, y) => x.name.localeCompare(y.name, 'it'))
    const tied = ordered.length > 1
    const worst = position + ordered.length - 1
    ordered.forEach(r => {
      ranked.push({
        ...r,
        rank: position,
        tied,
        tiebreak: { by: cluster.by, unresolved: cluster.unresolved, directIncomplete: cluster.directIncomplete },
        diffRubbers: r.rubFor - r.rubAgainst,
        diffSets: r.setsKnown ? r.setsFor - r.setsAgainst : null,
        diffGames: r.gamesKnown ? r.gamesFor - r.gamesAgainst : null,
        qualification: q === 0 ? null : worst <= q ? 'in' : position > q ? 'out' : 'uncertain',
      })
    })
    position += ordered.length
  })

  const missingResults = all.filter(f => !f.mine && !f.decided).length
  const toPlay = all.filter(f => f.mine && !f.decided).length
  return {
    rows: ranked,
    fixtures: all,
    complete: missingResults === 0 && toPlay === 0,
    missingResults,
    toPlay,
    decided: all.filter(f => f.decided).length,
    total: all.length,
    notes: clusters.map(noteOf).filter(Boolean),
  }
}

// ── Fase finale ────────────────────────────────────────────

// La fase finale nella forma che `runLadder`/`TournamentLadder` leggono per un
// torneo: `path` (uno scontro per turno, in ordine di tabellone), `lastRoundId`,
// `status`, `nextRoundId`. Un gradino porta lo scontro (`tie`) e `result`:
// 'win'|'loss' se deciso, null se ancora da giocare. `null` se non ci sono scontri.
export function finalsRun(competition, ties = [], matches = [], today = new Date()) {
  const path = finalTies(competition, ties)
    .filter(t => ROUND_BY_ID[t.round]?.depth != null)
    .map(t => {
      const info = describeTie(t, matches, today)
      const result = info.status === 'won' ? 'win' : info.status === 'lost' ? 'loss' : null
      return { id: t.id, round: t.round, date: t.date, tie: t, info, result, opponentName: t.opponentTeam }
    })
    .sort((a, b) => roundOrder(a.round) - roundOrder(b.round) || new Date(a.date) - new Date(b.date))
  if (path.length === 0) return null

  const last = path[path.length - 1]
  const depth = ROUND_BY_ID[last.round].depth
  let status = 'ongoing'
  let nextRoundId = null
  if (last.result === 'win') {
    if (depth === 1) status = 'champion'
    else nextRoundId = nextRound(last.round)?.id || null
  } else if (last.result === 'loss') {
    status = depth === 1 ? 'finalist' : 'eliminated'
  }
  return { id: `${competition.id}__finale`, path, lastRoundId: last.round, nextRoundId, status, stale: false }
}

// ── Stato della competizione ───────────────────────────────

const TONES = {
  neutral: { color: 'var(--color-slate)', bg: 'var(--color-surface-2)' },
  active:  { color: 'var(--color-teal)',  bg: 'rgba(72,179,176,0.16)' },
  gold:    { color: 'var(--color-amber)', bg: 'rgba(244,163,0,0.16)' },
  win:     { color: 'var(--color-win)',   bg: 'var(--color-win-bg)' },
  loss:    { color: 'var(--color-loss)',  bg: 'var(--color-loss-bg)' },
}

const ordinal = n => `${n}°`

// Dove si trova la mia squadra: tutto ricavato, nessuna soglia da tarare.
//   upcoming  → nessuno scontro deciso;      group → girone in corso;
//   done      → girone concluso (senza fase finale);
//   out-group → fuori dal girone;           qualified → qualificata, finale da giocare;
//   finals / champion / finalist / out-finals → dalla fase finale.
export function competitionStatus(competition, ties = [], matches = [], today = new Date(), standings = null) {
  const run = finalsRun(competition, ties, matches, today)
  if (run) {
    if (run.status === 'champion') return { key: 'champion', label: 'Vinta', icon: '🏆', ...TONES.gold }
    if (run.status === 'finalist') return { key: 'finalist', label: 'Finalista', icon: '🥈', ...TONES.gold }
    if (run.status === 'eliminated') {
      return { key: 'out-finals', label: `Eliminata ${roundPhrase(run.lastRoundId, 'in')}`, icon: '', ...TONES.loss }
    }
    return { key: 'finals', label: 'Fase finale', icon: '▶', ...TONES.active }
  }

  const st = standings || buildStandings(competition, ties, matches, today)
  const mine = st.rows.find(r => r.mine)
  if (!st.complete) {
    return st.decided === 0
      ? { key: 'upcoming', label: 'Da iniziare', icon: '', ...TONES.neutral }
      : { key: 'group', label: 'Girone in corso', icon: '▶', ...TONES.active }
  }
  if (!mine) return { key: 'done', label: 'Girone concluso', icon: '', ...TONES.neutral }
  if (competition.qualifiers === 0) {
    return { key: 'done', label: `Girone concluso · ${ordinal(mine.rank)}`, icon: '', ...TONES.neutral }
  }
  if (mine.qualification === 'in') return { key: 'qualified', label: 'Qualificata', icon: '✓', ...TONES.win }
  if (mine.qualification === 'out') return { key: 'out-group', label: `Fuori dal girone · ${ordinal(mine.rank)}`, icon: '', ...TONES.loss }
  return { key: 'tied', label: 'Spareggio da definire', icon: '', ...TONES.neutral }
}

// Più recenti prima (per l'ultima attività: la data dell'ultimo scontro, o della creazione).
export function sortCompetitions(competitions = [], ties = []) {
  const last = c => {
    const dates = competitionTies(c, ties).map(t => new Date(t.date).getTime()).filter(Number.isFinite)
    return dates.length ? Math.max(...dates) : 0
  }
  return [...competitions].sort((a, b) => last(b) - last(a) || a.name.localeCompare(b.name, 'it'))
}

// ── Scrittura e controlli dei form ─────────────────────────

// Un `<input>` numerico vuoto vale null (nessun valore d'ufficio).
export const toCount = asInt

// Per il form della competizione: nulla viene riempito d'ufficio.
export function competitionIssue({ name, teams, myTeamId, formula, points, qualifiers }) {
  if (!cleanName(name)) return 'Scrivi il nome della competizione.'
  if (teams.length < TEAMS_LIMITS.min || teams.length > TEAMS_LIMITS.max) {
    return `Servono da ${TEAMS_LIMITS.min} a ${TEAMS_LIMITS.max} squadre.`
  }
  if (teams.some(t => !cleanName(t.name))) return 'Scrivi il nome di ogni squadra.'
  const lower = teams.map(t => cleanName(t.name).toLowerCase())
  if (new Set(lower).size !== lower.length) return 'Due squadre hanno lo stesso nome.'
  if (!teams.some(t => t.id === myTeamId)) return 'Indica quale squadra è la tua.'
  const fIssue = formulaIssue(formula)
  if (fIssue) return fIssue
  for (const [k, label] of [['win', 'la vittoria'], ['draw', 'il pareggio'], ['loss', 'la sconfitta']]) {
    const n = points?.[k]
    if (!isInt(n) || n < POINTS_LIMITS.min || n > POINTS_LIMITS.max) {
      return `Scrivi i punti per ${label} (da ${POINTS_LIMITS.min} a ${POINTS_LIMITS.max}).`
    }
  }
  if (!isInt(qualifiers) || qualifiers < 0 || qualifiers > teams.length - 1) {
    return `Le qualificate vanno da 0 a ${teams.length - 1}.`
  }
  return null
}

// Quanto una squadra è già usata: scontri con lei e risultati che la citano.
export function teamUsage(competition, ties, teamId) {
  const tiesN = groupTies(competition, ties).filter(t => t.opponentTeamId === teamId).length
  const resultsN = (competition?.results || []).filter(r => r.a === teamId || r.b === teamId).length
  return tiesN + resultsN
}

// Il ritorno non si toglie se qualcosa lo usa.
export function legUsage(competition, ties, leg) {
  return groupTies(competition, ties).filter(t => legOf(t) === leg).length
    + (competition?.results || []).filter(r => r.leg === leg).length
}

// Controlli sulla modifica di una competizione esistente: quello che è già
// usato non si toglie, e la mia squadra non si cambia a scontri avviati.
export function competitionBlockIssue(competition, ties, { teams, myTeamId, legs }) {
  const removed = competition.teams.filter(t => !teams.some(x => x.id === t.id))
  for (const t of removed) {
    if (teamUsage(competition, ties, t.id) > 0) return `${t.name} ha già scontri o risultati: non si può togliere.`
  }
  if (competition.legs === 2 && legs === 1 && legUsage(competition, ties, 2) > 0) {
    return 'Il ritorno ha già scontri o risultati: non si può togliere.'
  }
  if (competition.myTeamId && myTeamId !== competition.myTeamId && groupTies(competition, ties).length > 0) {
    return 'La tua squadra non si cambia dopo aver creato scontri del girone.'
  }
  return null
}

// Guard di eliminazione: una competizione con scontri non si elimina (si
// eliminano prima gli scontri, e questi solo senza partite collegate).
export function competitionDeleteIssue(competition, ties = []) {
  const n = competitionTies(competition, ties).length
  if (n === 0) return null
  return `Ha ${n} ${n === 1 ? 'scontro' : 'scontri'}: eliminali prima di eliminare la competizione.`
}

// Controlli sul risultato di uno scontro tra altre squadre. `total` = incontri
// della formula. Un risultato è l'esito finale: una squadra supera la metà
// degli incontri, oppure è parità con tutti gli incontri decisi.
export function resultIssue({ scoreA, scoreB, sets, games }, total) {
  if (!isInt(scoreA) || !isInt(scoreB) || scoreA < 0 || scoreB < 0) return 'Scrivi gli incontri vinti da entrambe le squadre.'
  if (scoreA + scoreB > total) return `Gli incontri sono ${total}: la somma non può superarli.`
  const decided = scoreA * 2 > total || scoreB * 2 > total || (scoreA === scoreB && scoreA + scoreB === total)
  if (!decided) return 'Il risultato deve essere definitivo (una squadra oltre la metà, o parità a incontri finiti).'
  return pairIssue('set', sets) || pairIssue('game', games)
}

// Set o game facoltativi: tutti e due vuoti vanno bene, uno solo no.
export function pairIssue(label, pair) {
  if (!pair) return null
  const [a, b] = pair
  const empty = v => v === '' || v == null
  if (empty(a) && empty(b)) return null
  if (empty(a) || empty(b)) return `Compila entrambi i valori dei ${label}, o lascia vuoti tutti e due.`
  const [x, y] = [asInt(a), asInt(b)]
  if (x == null || y == null || x < 0 || y < 0 || x > TOTAL_MAX || y > TOTAL_MAX) return `I ${label} vanno da 0 a ${TOTAL_MAX}.`
  return null
}

// L'elenco `results` con un risultato nuovo o riscritto (una voce per scontro).
export function withResult(results, entry) {
  const key = fixtureKey(entry.a, entry.b, entry.leg)
  const rest = (Array.isArray(results) ? results : []).filter(r => fixtureKey(r.a, r.b, r.leg) !== key)
  return [...rest, {
    a: entry.a, b: entry.b, leg: entry.leg === 2 ? 2 : 1,
    scoreA: entry.scoreA, scoreB: entry.scoreB,
    sets: readPair(entry.sets), games: readPair(entry.games),
  }]
}

export function withoutResult(results, a, b, leg) {
  const key = fixtureKey(a, b, leg)
  return (Array.isArray(results) ? results : []).filter(r => fixtureKey(r.a, r.b, r.leg) !== key)
}

// Il numero totale di incontri di uno scontro della competizione.
export const fixtureTotal = competition => formulaTotal(readFormula(competition?.formula))
