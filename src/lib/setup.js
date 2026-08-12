// ── Statistiche: setup ──────────────────────────────────────
// Nono modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa
// linea di tennis.js / training.js / athletics.js / wear.js / stats.js /
// activity.js / technique.js / physical.js.
//
// ── La domanda ──
// Rendimento chiede "quanto sono forte", Attività "quanto ci sono stato",
// Tecnica "su cosa sto lavorando", Fisico "come sto". Qui la domanda è: **il
// materiale cambia qualcosa?** — e la risposta onesta, quasi sempre, è "non
// abbastanza da poterlo misurare". Questa sezione esiste per dirlo con dei
// numeri invece che per aria, ed è l'unica della pagina scritta più per
// SMONTARE una credenza che per costruirne una.
//
// ── Perché il campione qui è più severo che altrove ──────────
// Il GW% per racchetta/corda/tensione è esattamente il tipo di numero su cui un
// tennista costruisce una superstizione: "con la 24 kg vinco". Il problema è che
// una differenza di 5 punti percentuali di game vinti tra due setup, su una
// decina di partite per parte, è quello che il caso produce da solo praticamente
// sempre. Per questo qui non basta la soglia di campione delle altre sezioni:
// ogni riga porta il proprio **margine di errore**, il confronto tra due setup
// dichiara se sono *distinguibili* o no, e quando non lo sono la sezione dice
// quante partite servirebbero per distinguerli davvero.
//
// Il margine è calcolato trattando la PARTITA come unità indipendente (la
// deviazione standard delle percentuali di game per partita, divisa per la
// radice del numero di partite), non il singolo game: due game dello stesso
// match non sono indipendenti — stesso avversario, stesso giorno, stesse gambe —
// e usare i game come campione gonfierebbe la precisione di un fattore quattro,
// che è precisamente l'errore che genera la superstizione.
//
// ── Perché questa sezione IGNORA il periodo scelto in pagina ──
// Un setup cambia lentamente: una racchetta dura anni, un'incordatura settimane.
// Ritagliare su 90 giorni butterebbe via esattamente i confronti che la sezione
// deve fare (il setup precedente resterebbe fuori dalla finestra), e la vita
// reale delle corde è per costruzione una domanda su tutto lo storico: le
// incordature concluse sono quelle che hai già cambiato. L'usura, poi, è un
// fatto del PRESENTE — le corde sono consumate adesso, non "erano consumate a
// giugno" — stessa logica per cui gli alert di usura in Panoramica compaiono solo
// a offset 0 e per cui ACWR e trascuratezza in Attività/Tecnica non seguono il
// periodo. Qui quella logica vale per l'intera sezione, e la UI lo dichiara.

import { gamesInMatch } from './tennis'
import { dayTime, gamesOf } from './stats'
import { todayTime } from './activity'
import {
  trainingGameEquivalents, surfaceFactor, computeWear,
  STRING_LIFE_GAMES, STRING_LIFE_DAYS, SHOE_LIFE_GAMES,
} from './wear'

// ── Soglie minime di campione ──────────────────────────────
// Volutamente più alte che in Rendimento (dove MIN_SPLIT è 5): là uno split
// descrive una situazione di gioco che esiste comunque (la terra è la terra),
// qui una riga sotto soglia diventa una convinzione sul materiale.
export const MIN_SETUP_MATCHES = 8   // partite per riga, perché la riga mostri una percentuale
export const MIN_SETUP_ROWS    = 2   // righe sopra soglia, perché esista un confronto
export const MIN_MOUNTS        = 3   // incordature concluse, per calibrare il budget di gioco
export const MIN_PLAY_DRIVEN   = 2   // di quelle, quante devono essere finite per gioco e non per tempo
export const MIN_SHOE_GAMES    = 60  // game pesati, perché una scarpa abbia una riga di chilometraggio

// Ampiezza dell'intervallo di confidenza: 1,96 ≈ 95%.
const Z = 1.96

// Oltre questo scostamento dal budget in wear.js la taratura va considerata
// sbagliata per questo utente (±25%: sotto è dentro il rumore di una mediana su
// quattro o cinque incordature).
const CALIBRATION_TOLERANCE = 0.25

// Massimo di partite che ha senso indicare come "servirebbero N partite": oltre,
// il messaggio utile non è più il numero ma "questa differenza non la misurerai".
const REQUIRED_CAP = 400

// ── Dimensioni del confronto ───────────────────────────────
// Una per volta, come gli split di Rendimento: quattro tabelle affiancate
// sarebbero una pagina di numeri da leggere tutta.
export const SETUP_DIMENSIONS = [
  { id: 'racket',  label: 'Racchetta', unit: 'racchette' },
  { id: 'string',  label: 'Corda',     unit: 'corde'     },
  { id: 'tension', label: 'Tensione',  unit: 'tensioni'  },
  { id: 'full',    label: 'Setup',     unit: 'setup'     },
]

// ── Etichette dell'attrezzatura ────────────────────────────

export function itemLabel(item) {
  if (!item) return 'Non dichiarata'
  const model = [item.brand, item.model || item.name].filter(Boolean).join(' ').trim()
  if (item.nickname) return model ? `${item.nickname} (${model})` : item.nickname
  return model || 'Senza nome'
}

export function stringLabel(mount) {
  if (!mount) return null
  const s = [mount.brand, mount.model].filter(Boolean).join(' ').trim()
  return s || null
}

// "24/23 kg", oppure "24 kg" quando verticali e orizzontali coincidono.
export function tensionLabel(mount) {
  if (!mount) return null
  const { mains, crosses } = mount
  if (mains == null && crosses == null) return null
  if (mains === crosses) return `${mains} kg`
  return `${mains ?? '—'}/${crosses ?? '—'} kg`
}

// ── Timeline delle incordature ─────────────────────────────
// Una racchetta porta l'incordatura attuale in `strings` e le precedenti in
// `stringsHistory`. Messe in fila per `mountedAt` diventano una timeline: ogni
// voce copre l'intervallo che va dal proprio montaggio a quello successivo, ed è
// quella la chiave che dice con quali corde è stata giocata una certa partita.
//
// I documenti vecchi possono avere i campi flat (stringBrand/stringTension/...)
// invece di `strings`: stesso fallback già presente in EquipmentCard e in
// addStringsEntry, replicato qui perché la timeline non può saltare la prima
// incordatura di una racchetta solo perché è anteriore alla migrazione di schema.

function legacyStrings(item) {
  if (!item) return null
  const has = item.stringBrand || item.stringModel || item.stringTensionMains ||
              item.stringTensionCrosses || item.stringTension || item.stringDate
  if (!has) return null
  return {
    brand:          item.stringBrand || null,
    model:          item.stringModel || null,
    tensionMains:   item.stringTensionMains   ?? item.stringTension ?? null,
    tensionCrosses: item.stringTensionCrosses ?? item.stringTension ?? null,
    mountedAt:      item.stringDate || null,
  }
}

function normalizeMount(entry) {
  if (!entry) return null
  const legacy = entry.tension ?? null
  return {
    brand:     entry.brand || null,
    model:     entry.model || null,
    mains:     entry.tensionMains   ?? legacy ?? null,
    crosses:   entry.tensionCrosses ?? legacy ?? null,
    mountedAt: entry.mountedAt || null,
    time:      dayTime(entry.mountedAt),
  }
}

// Incordature di una racchetta, in ordine cronologico, con l'intervallo coperto.
// `endTime` è il montaggio successivo (esclusivo) o `null` per quella attuale —
// stessa convenzione di `stringWear` in wear.js, dove una sessione conta per
// l'incordatura se `date >= mountedAt`.
export function stringMounts(racket) {
  const raw = [...(racket?.stringsHistory || []), racket?.strings || legacyStrings(racket)]
  const entries = raw.map(normalizeMount).filter(Boolean)

  // Senza data di montaggio una voce non è collocabile sulla timeline: non si
  // butta in silenzio, si conta e si dichiara.
  const dated   = entries.filter(e => e.time != null).sort((a, b) => a.time - b.time)
  const undated = entries.length - dated.length

  const mounts = dated.map((e, i) => ({
    ...e,
    index: i,
    racketId: racket?.id || null,
    endTime: i < dated.length - 1 ? dated[i + 1].time : null,
    current: i === dated.length - 1,
  }))

  return { mounts, undated }
}

// L'incordatura montata in un certo giorno. Il giorno del montaggio appartiene
// alla NUOVA incordatura (`>=`), come in wear.js.
function mountAt(mounts, day) {
  if (day == null) return null
  for (let i = mounts.length - 1; i >= 0; i--) {
    const m = mounts[i]
    if (day >= m.time && (m.endTime == null || day < m.endTime)) return m
  }
  return null
}

// ── Vita reale di un'incordatura ───────────────────────────
// Il cuore della sezione: da `stringsHistory` + `mountedAt` escono gli intervalli
// veri, e dentro ciascuno si contano i game davvero giocati (partite + game-eq
// degli allenamenti, con le stesse tariffe di wear.js). Il risultato è una
// misura della vita reale delle tue corde, con cui si può dire se il budget di
// STRING_LIFE_GAMES scritto in wear.js è tarato bene *per te* — che è il metodo
// di validazione già annotato in CLAUDE.md per le tariffe di allenamento.
//
// ── Come si riconosce la fine ──
// `brokeStrings` esiste solo sugli allenamenti (il wizard partita non lo chiede),
// quindi le rotture sono osservabili solo lì: è un limite del dato e va
// dichiarato, non aggirato. Se dentro l'intervallo c'è una sessione con
// `brokeStrings`, l'incordatura è finita quel giorno — anche se la nuova è stata
// registrata più tardi — e i game si contano fino a lì.

const DAY_MS = 86400000

function mountLife(mount, sessions) {
  // Sessioni giocate con quella racchetta dentro l'intervallo del montaggio.
  const inside = sessions.filter(s =>
    s.racketId === mount.racketId &&
    s.day >= mount.time &&
    (mount.endTime == null || s.day < mount.endTime)
  )

  const breakDay = inside
    .filter(s => s.broke)
    .reduce((last, s) => (last == null || s.day > last ? s.day : last), null)

  // La rotta è la fine vera: i game oltre quel giorno apparterrebbero a
  // un'incordatura mai registrata, non a questa.
  const counted   = breakDay == null ? inside : inside.filter(s => s.day <= breakDay)
  const orphaned  = inside.length - counted.length
  const endTime   = breakDay != null ? breakDay : mount.endTime

  const matchGames    = counted.filter(s => s.kind === 'match').reduce((sum, s) => sum + s.stringGames, 0)
  const trainingGames = counted.filter(s => s.kind === 'training').reduce((sum, s) => sum + s.stringGames, 0)
  const games         = matchGames + trainingGames

  const closedTime = endTime != null ? endTime : todayTime()
  const days       = Math.max(0, Math.round((closedTime - mount.time) / DAY_MS))

  // Quale asse ha "chiuso" l'incordatura: il gioco o il tempo. Serve alla
  // calibrazione — una corda cambiata dopo tre mesi e otto game non dice niente
  // sul budget in game, dice che si gioca poco.
  const playRatio = games / STRING_LIFE_GAMES
  const ageRatio  = days / STRING_LIFE_DAYS

  return {
    ...mount,
    key: `${mount.racketId}:${mount.mountedAt}`,
    label: stringLabel(mount) || 'Corda non indicata',
    tension: tensionLabel(mount),
    endTime,
    ended: endTime != null,
    broke: breakDay != null,
    breakDay,
    orphaned,
    sessions: counted.length,
    matchCount: counted.filter(s => s.kind === 'match').length,
    trainingCount: counted.filter(s => s.kind === 'training').length,
    matchGames, trainingGames,
    games: Math.round(games),
    days,
    playRatio, ageRatio,
    driver: playRatio >= ageRatio ? 'play' : 'age',
    gamesPerWeek: days > 0 ? (games / days) * 7 : null,
  }
}

// ── Calibrazione del budget ────────────────────────────────
// Il modello di usura si auto-verifica invece di restare una costante decisa a
// tavolino: la mediana dei game davvero giocati prima di un cambio corde È il
// tuo budget reale.
//
// Due cautele che il numero da solo non porta:
//   1. le incordature senza NESSUNA sessione registrata restano fuori — non
//      misurano una vita corta, misurano un diario incompleto, e trascinerebbero
//      la mediana verso lo zero proprio nei primi mesi d'uso dell'app;
//   2. il budget in GAME si suggerisce solo se abbastanza incordature sono
//      finite per gioco e non per tempo. Chi reincorda ogni tre mesi giocando
//      poco non sta misurando la resistenza della corda, sta misurando il
//      calendario — e in quel caso la risposta onesta non è un numero nuovo, è
//      "per te la restrizione non è il gioco".

// "ok" = il budget in wear.js descrive bene le tue corde; "high" = l'app le
// crede più durature di quanto siano; "low" = l'app allarma prima del necessario.
function verdictFor(ratio) {
  if (Math.abs(ratio - 1) <= CALIBRATION_TOLERANCE) return 'ok'
  return ratio > 1 ? 'low' : 'high'
}

function median(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function calibration(lives) {
  const ended    = lives.filter(l => l.ended)
  const usable   = ended.filter(l => l.sessions > 0)
  const skipped  = ended.length - usable.length
  const current  = lives.find(l => !l.ended) || null

  const base = {
    mountsTotal: lives.length,
    ended: ended.length,
    n: usable.length,
    skipped,
    current,
    enough: usable.length >= MIN_MOUNTS,
    missing: Math.max(0, MIN_MOUNTS - usable.length),
  }

  if (!base.enough) return { ...base, games: null, days: null, broken: null, suggestion: null }

  const gamesList = usable.map(l => l.games)
  const daysList  = usable.map(l => l.days)
  const broken    = usable.filter(l => l.broke)
  const playDriven = usable.filter(l => l.driver === 'play')

  const medianGames = median(gamesList)
  const medianDays  = median(daysList)

  // Il suggerimento sul budget in game esiste solo se il gioco è davvero ciò che
  // consuma le tue corde.
  const playRelevant = playDriven.length >= MIN_PLAY_DRIVEN && medianGames > 0
  const suggestion = playRelevant
    ? {
        axis: 'play',
        value: Math.round(medianGames / 10) * 10,
        current: STRING_LIFE_GAMES,
        ratio: medianGames / STRING_LIFE_GAMES,
        verdict: verdictFor(medianGames / STRING_LIFE_GAMES),
        playDriven: playDriven.length,
      }
    : {
        axis: 'age',
        value: Math.round(medianDays / 5) * 5,
        current: STRING_LIFE_DAYS,
        ratio: medianDays / STRING_LIFE_DAYS,
        verdict: 'time-driven',
        playDriven: playDriven.length,
      }

  return {
    ...base,
    games:  { median: medianGames, min: Math.min(...gamesList), max: Math.max(...gamesList) },
    days:   { median: medianDays,  min: Math.min(...daysList),  max: Math.max(...daysList)  },
    broken: { n: broken.length, medianGames: broken.length ? median(broken.map(l => l.games)) : null },
    playDriven: playDriven.length,
    suggestion,
  }
}

// ── Confronto tra setup ────────────────────────────────────
// Il GW% è la metrica portante di tutta la pagina (una partita produce ~20 game
// e un solo risultato: si stabilizza ~5 volte più in fretta del win/loss), ed è
// quella che si usa anche qui. La novità rispetto a Rendimento è che ogni riga
// porta la propria incertezza.

function stdev(values) {
  if (values.length < 2) return null
  const m = values.reduce((s, v) => s + v, 0) / values.length
  const varsum = values.reduce((s, v) => s + (v - m) ** 2, 0)
  return Math.sqrt(varsum / (values.length - 1))
}

function rowStats(matches) {
  let me = 0, opp = 0
  const rates = []
  matches.forEach(m => {
    const g = gamesOf(m)
    me += g.me
    opp += g.opp
    if (g.total > 0) rates.push(g.me / g.total)
  })

  const games = me + opp
  const rate  = games > 0 ? me / games : null
  const sd    = stdev(rates)
  const se    = sd != null && rates.length > 0 ? sd / Math.sqrt(rates.length) : null
  const moe   = se != null ? Z * se : null

  return {
    n: matches.length,
    games, gamesMe: me, gamesOpp: opp,
    wins:   matches.filter(m => m.result === 'win').length,
    losses: matches.filter(m => m.result === 'loss').length,
    draws:  matches.filter(m => m.result === 'draw').length,
    rate, sd, moe,
    lo: rate != null && moe != null ? Math.max(0, rate - moe) : null,
    hi: rate != null && moe != null ? Math.min(1, rate + moe) : null,
  }
}

// Due righe sono distinguibili se i loro intervalli di confidenza non si
// sovrappongono. È un test conservativo — e va benissimo che lo sia: l'errore da
// evitare qui è dichiarare una differenza che non c'è.
function separable(a, b) {
  if (!a || !b || a.lo == null || b.lo == null) return false
  return a.lo > b.hi || b.lo > a.hi
}

// Quante partite PER LATO servirebbero per distinguere una differenza di
// `delta`, data la variabilità `sd` delle tue partite. È il numero che sostituisce
// la superstizione con un piano: "non lo sai, e per saperlo ti servono 60 partite
// con ciascun setup" è un'informazione, "con la 24 vinci" no.
export function requiredMatches(delta, sd) {
  if (!delta || !sd || delta <= 0) return null
  const n = Math.ceil(2 * ((Z * sd) / delta) ** 2)
  return n > REQUIRED_CAP ? null : Math.max(2, n)
}

// Chiave e etichetta di una partita per ciascuna dimensione. `null` = la partita
// non è classificabile su quella dimensione (attrezzatura non dichiarata, o
// nessuna incordatura registrata per quella data): non finisce in una riga
// "altro", viene contata a parte come non dichiarata.
function classify(dimension, match, byId, mountsByRacket) {
  const racketId = match.equipment?.racchetta || null
  const racket   = racketId ? byId.get(racketId) : null
  if (!racketId) return null

  if (dimension === 'racket') {
    return { key: racketId, label: itemLabel(racket) }
  }

  const mount = mountAt(mountsByRacket.get(racketId) || [], dayTime(match.date))
  if (!mount) return null

  if (dimension === 'string') {
    const label = stringLabel(mount)
    return label ? { key: label.toLowerCase(), label } : null
  }

  if (dimension === 'tension') {
    const label = tensionLabel(mount)
    return label ? { key: label, label } : null
  }

  // Setup completo: è la dimensione che risponde davvero alla domanda ("questo
  // telaio con questa corda a questi kg"), ed è anche quella che frammenta di
  // più il campione — quasi sempre resterà sotto soglia, ed è giusto che si veda.
  const parts = [itemLabel(racket), stringLabel(mount), tensionLabel(mount)].filter(Boolean)
  return { key: parts.join('|').toLowerCase(), label: parts.join(' · ') }
}

export function setupComparison(matches, equipment, mountsByRacket) {
  const byId = new Map((equipment || []).map(i => [i.id, i]))
  const overall = rowStats(matches)

  const dimensions = {}
  SETUP_DIMENSIONS.forEach(dim => {
    const groups = new Map()
    let undeclared = 0

    matches.forEach(m => {
      const c = classify(dim.id, m, byId, mountsByRacket)
      if (!c) { undeclared++; return }
      if (!groups.has(c.key)) groups.set(c.key, { key: c.key, label: c.label, matches: [] })
      groups.get(c.key).matches.push(m)
    })

    const rows = [...groups.values()]
      .map(g => {
        const st = rowStats(g.matches)
        return {
          ...g, ...st,
          enough: st.n >= MIN_SETUP_MATCHES,
          delta: st.rate != null && overall.rate != null ? st.rate - overall.rate : null,
        }
      })
      // Ordine per campione, non per percentuale: mettere in cima la riga con il
      // GW% più alto suggerirebbe una classifica proprio dove il messaggio è che
      // una classifica non è ancora leggibile.
      .sort((a, b) => b.n - a.n)

    const eligible = rows.filter(r => r.enough)
    const comparable = eligible.length >= MIN_SETUP_ROWS
    // Con due sole righe a percentuale identica `best` e `worst` sarebbero lo
    // stesso oggetto: il gap resta 0 (che è la verità) e non diventa "nessun
    // confronto disponibile", che sarebbe un'altra cosa.
    const best  = eligible.length ? eligible.reduce((x, r) => (r.rate > x.rate ? r : x)) : null
    const worst = eligible.length ? eligible.reduce((x, r) => (r.rate < x.rate ? r : x)) : null
    const gap   = comparable && best && worst ? best.rate - worst.rate : null

    // La sd di riferimento per il calcolo di "quante partite servirebbero" è
    // quella complessiva: è la variabilità delle TUE partite, e non dipende da
    // quale setup avevi in mano.
    dimensions[dim.id] = {
      id: dim.id,
      label: dim.label,
      rows,
      undeclared,
      comparable,
      best, worst, gap,
      separable: gap != null ? separable(best, worst) : false,
      required: gap != null ? requiredMatches(gap, overall.sd) : null,
    }
  })

  return { overall, dimensions }
}

// ── Chilometraggio scarpe ──────────────────────────────────
// Due numeri diversi, e tenerli distinti è il punto del blocco:
//   - i GAME PESATI per superficie, che sono l'unità con cui wear.js decide se
//     la suola è finita (il cemento consuma 1,4 volte la terra);
//   - i CHILOMETRI veri, quando `athletics.distanceKm` è stato trascritto — che
//     non sono una stima ma una misura, e coprono solo le sessioni in cui hai
//     compilato i dati dell'orologio.
// Il primo c'è sempre, il secondo quasi mai: presentarli insieme senza dichiarare
// la differenza di copertura farebbe leggere come "chilometraggio" una cifra che
// descrive un quinto delle uscite.

export function shoeMileage(shoes, matches, trainings) {
  return shoes.map(shoe => {
    const ms = matches.filter(m => m.equipment?.scarpa === shoe.id)
    const ts = trainings.filter(t => t.equipment?.scarpa === shoe.id)

    const bySurface = new Map()
    const add = (surface, raw, km, hasKm) => {
      const key = surface || 'non indicata'
      if (!bySurface.has(key)) bySurface.set(key, { surface: key, raw: 0, weighted: 0, km: 0, kmSessions: 0, sessions: 0 })
      const b = bySurface.get(key)
      b.raw      += raw
      b.weighted += raw * surfaceFactor(surface)
      b.sessions += 1
      if (hasKm) { b.km += km; b.kmSessions += 1 }
    }

    let km = 0, kmSessions = 0
    ms.forEach(m => {
      const d = distanceOf(m)
      add(m.surface, gamesInMatch(m), d ?? 0, d != null)
      if (d != null) { km += d; kmSessions++ }
    })
    ts.forEach(t => {
      const d = distanceOf(t)
      add(t.surface, trainingGameEquivalents(t).shoes, d ?? 0, d != null)
      if (d != null) { km += d; kmSessions++ }
    })

    const surfaces = [...bySurface.values()].sort((a, b) => b.weighted - a.weighted)
    const raw      = surfaces.reduce((s, x) => s + x.raw, 0)
    const weighted = surfaces.reduce((s, x) => s + x.weighted, 0)
    const sessions = ms.length + ts.length

    // Il livello di usura viene da computeWear e non ricalcolato qui: la soglia
    // che colora il badge in Equipment e quella che colora questa riga devono
    // essere lo stesso numero, per sempre.
    const wear = computeWear(shoe, matches, trainings)

    return {
      id: shoe.id,
      item: shoe,
      label: itemLabel(shoe),
      active: shoe.active !== false,
      declaredSurfaces: Array.isArray(shoe.surface) ? shoe.surface : (shoe.surface ? [shoe.surface] : []),
      matchCount: ms.length,
      trainingCount: ts.length,
      sessions,
      raw, weighted,
      ratio: weighted / SHOE_LIFE_GAMES,
      percent: Math.round((weighted / SHOE_LIFE_GAMES) * 100),
      level: wear?.level || 'ok',
      km: kmSessions > 0 ? km : null,
      kmSessions,
      kmShare: sessions > 0 ? kmSessions / sessions : null,
      // Chilometri per ora di gioco non si calcola qui: la durata è facoltativa
      // e la sezione Fisico la possiede già. Qui il km è un totale, non un ritmo.
      kmPerSession: kmSessions > 0 ? km / kmSessions : null,
      surfaces,
      enough: weighted >= MIN_SHOE_GAMES,
      // Coerenza tra la superficie per cui la scarpa è dichiarata e quella su cui
      // la usi davvero: è l'unica cosa azionabile del blocco.
      offSurface: offSurfaceShare(shoe, surfaces),
    }
  }).sort((a, b) => b.weighted - a.weighted)
}

// Quota di game pesati giocati su una superficie diversa da quelle per cui la
// scarpa è dichiarata in catalogo. `null` quando la scarpa non dichiara nessuna
// superficie (custom senza il campo compilato): senza il riferimento non c'è
// niente da confrontare, e inventare un "fuori superficie" sarebbe un falso.
function offSurfaceShare(shoe, surfaces) {
  const declared = Array.isArray(shoe.surface) ? shoe.surface : (shoe.surface ? [shoe.surface] : [])
  if (declared.length === 0) return null
  const known = surfaces.filter(s => s.surface !== 'non indicata')
  const total = known.reduce((s, x) => s + x.weighted, 0)
  if (total <= 0) return null
  const off = known.filter(s => !declared.includes(s.surface)).reduce((s, x) => s + x.weighted, 0)
  return { share: off / total, declared, total }
}

function distanceOf(session) {
  const d = session?.athletics?.distanceKm
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null
}

// ── Copertura ──────────────────────────────────────────────
// Come in Fisico, la copertura è un dato di prima classe e sta in testa: tutta
// la sezione descrive SOLO le sessioni in cui l'attrezzatura è stata dichiarata,
// e la dichiarazione è facoltativa in entrambi i wizard.

export function setupCoverage(matches, trainings) {
  const side = (list, type) => {
    const n = list.filter(s => s.equipment?.[type]).length
    return { n, total: list.length, share: list.length ? n / list.length : null }
  }
  const all = [...matches, ...trainings]
  return {
    racket: {
      matches:   side(matches, 'racchetta'),
      trainings: side(trainings, 'racchetta'),
      all:       side(all, 'racchetta'),
    },
    shoe: {
      matches:   side(matches, 'scarpa'),
      trainings: side(trainings, 'scarpa'),
      all:       side(all, 'scarpa'),
    },
  }
}

// ── Report completo ────────────────────────────────────────
// Punto d'ingresso unico, stesso contratto di buildRendimento / buildActivity /
// buildTechnique / buildPhysical: restituisce anche gli insight, così il
// componente fa un solo useMemo e non deve conoscere l'ordine dei calcoli.
//
// Riceve lo storico INTERO, non il periodo: vedi la nota in testa al file.

export function buildSetup({ matches = [], trainings = [], equipment = [] }) {
  const rackets = equipment.filter(i => i.type === 'racchetta')
  const shoes   = equipment.filter(i => i.type === 'scarpa')

  // Sessioni normalizzate per il calcolo della vita delle corde: partite e
  // allenamenti diventano la stessa cosa (un giorno, una racchetta, dei game
  // sull'asse corde, eventualmente una rottura).
  const sessions = [
    ...matches.map(m => ({
      kind: 'match', id: m.id, day: dayTime(m.date),
      racketId: m.equipment?.racchetta || null,
      stringGames: gamesInMatch(m),
      broke: false,   // il wizard partita non chiede la rottura: vedi la nota sopra
    })),
    ...trainings.map(t => ({
      kind: 'training', id: t.id, day: dayTime(t.date),
      racketId: t.equipment?.racchetta || null,
      stringGames: trainingGameEquivalents(t).strings,
      broke: Boolean(t.brokeStrings),
    })),
  ].filter(s => s.day != null && s.racketId)

  // Timeline delle incordature, racchetta per racchetta.
  const mountsByRacket = new Map()
  let undatedMounts = 0
  const lives = []

  rackets.forEach(r => {
    const { mounts, undated } = stringMounts(r)
    undatedMounts += undated
    mountsByRacket.set(r.id, mounts)
    mounts.forEach(m => lives.push({ ...mountLife(m, sessions), racket: r, racketLabel: itemLabel(r) }))
  })

  lives.sort((a, b) => b.time - a.time)

  const comparison = setupComparison(matches, equipment, mountsByRacket)
  const cal        = calibration(lives)

  const report = {
    rackets, shoes,
    coverage: setupCoverage(matches, trainings),
    comparison,
    strings: {
      lives,
      current: lives.filter(l => !l.ended),
      undatedMounts,
      // Le rotture sono osservabili solo dagli allenamenti: il conteggio serve
      // alla UI per dichiararlo invece di far credere che siano tutte.
      breaks: lives.filter(l => l.broke).length,
      calibration: cal,
    },
    shoeStats: shoeMileage(shoes, matches, trainings),
    totals: {
      matches: matches.length,
      trainings: trainings.length,
    },
  }

  // La sezione si apre se c'è qualcosa da dire su almeno uno dei tre fronti.
  report.enough =
    report.comparison.dimensions.racket.rows.length > 0 ||
    lives.length > 0 ||
    report.shoeStats.some(s => s.sessions > 0)

  report.insights = report.enough ? setupInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Stesso motore a regole delle altre quattro sezioni. La differenza è il segno
// di metà delle frasi: qui la regola più importante è quella che NEGA una
// differenza, non quella che ne trova una.

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const pp  = v => `${Math.round(Math.abs(v) * 100)}`

function insight(o) {
  return { ...o, tab: 'setup', weight: o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n) }
}

export function setupInsights(r) {
  const out = []

  // 1. Calibrazione del budget corde: è la frase più forte della sezione,
  //    perché è l'unica che cambia un numero dell'app invece di descrivere te.
  const s = r.strings.calibration?.suggestion
  if (r.strings.calibration?.enough && s) {
    if (s.verdict === 'low' || s.verdict === 'high') {
      const tooHigh = s.verdict === 'high'
      out.push(insight({
        id: 'calibrazione', target: 'vita-corde', tone: 'neutral', icon: '🎯',
        effect: Math.abs(s.ratio - 1), n: r.strings.calibration.n, weight: 2.0,
        text: tooHigh
          ? `Cambi le corde in media dopo ${s.value} game, ma il modello di usura ne assume ${s.current}: l'app ti dice "corde ok" quando tu le senti già andate.`
          : `Cambi le corde in media dopo ${s.value} game, contro i ${s.current} assunti dal modello: l'app ti allarma prima del necessario.`,
      }))
    } else if (s.verdict === 'time-driven') {
      out.push(insight({
        id: 'calibrazione', target: 'vita-corde', tone: 'neutral', icon: '📆',
        effect: 0.4, n: r.strings.calibration.n, weight: 1.2,
        text: `Le tue incordature finiscono per tempo, non per gioco: in media ${s.value} giorni e pochi game. Il budget in game non è la tua restrizione.`,
      }))
    }
  }

  // 2. L'antidoto alla superstizione. Quando due setup sopra soglia NON sono
  //    distinguibili, dirlo vale più di qualunque percentuale.
  const dims = ['racket', 'string', 'tension']
  for (const id of dims) {
    const d = r.comparison.dimensions[id]
    if (!d?.comparable || d.gap == null) continue

    if (d.separable) {
      out.push(insight({
        id: `setup-${id}`, target: 'confronto', tone: 'good', icon: '✅',
        effect: d.gap, n: Math.min(d.best.n, d.worst.n), weight: 1.6,
        text: `${d.best.label}: ${pct(d.best.rate)} dei game contro ${pct(d.worst.rate)} di ${d.worst.label}. È l'unica differenza di setup che sopravvive al margine di errore.`,
      }))
    } else if (d.gap >= 0.03) {
      out.push(insight({
        id: `setup-${id}`, target: 'confronto', tone: 'neutral', icon: '🎲',
        effect: d.gap, n: Math.min(d.best.n, d.worst.n), weight: 1.1,
        text: d.required
          ? `Tra ${d.best.label} e ${d.worst.label} ci sono ${pp(d.gap)} punti di game vinti, ma il campione non li distingue dal caso: servirebbero ~${d.required} partite per lato.`
          : `Tra ${d.best.label} e ${d.worst.label} ci sono ${pp(d.gap)} punti di game vinti, ma rientrano nel margine di errore: non è una differenza che i tuoi dati possano mostrare.`,
      }))
    }
    break   // una sola frase sul confronto: la dimensione più fine è già coperta dal blocco
  }

  // 3. Rotture: sono l'unica misura oggettiva di fine vita che l'app possiede.
  const breaks = r.strings.breaks
  if (breaks >= 2 && r.strings.calibration?.broken?.medianGames != null) {
    out.push(insight({
      id: 'rotture', target: 'vita-corde', tone: 'neutral', icon: '💥',
      effect: 0.4, n: breaks, weight: 1.0,
      text: `Hai rotto le corde ${breaks} volte, in media dopo ${Math.round(r.strings.calibration.broken.medianGames)} game: è il tuo limite fisico vero, quello che non dipende da come le senti.`,
    }))
  }

  // 4. Scarpe usate fuori dalla loro superficie. È l'unica frase azionabile del
  //    blocco chilometraggio: una suola da terra sul cemento dura la metà.
  const off = r.shoeStats
    .filter(x => x.enough && x.offSurface && x.offSurface.share >= 0.35)
    .sort((a, b) => b.offSurface.share - a.offSurface.share)[0]
  if (off) {
    out.push(insight({
      id: 'scarpe-superficie', target: 'scarpe', tone: 'bad', icon: '👟',
      effect: off.offSurface.share, n: off.sessions, weight: 1.0,
      text: `${pct(off.offSurface.share)} del gioco con ${off.label} è su una superficie diversa da quella per cui è fatta (${off.offSurface.declared.join(', ')}): è così che una suola si consuma prima.`,
    }))
  }

  // 5. Copertura: non è un'analisi, è un avvertimento sulla lettura di tutte le
  //    altre frasi. Peso basso di proposito.
  const cov = r.coverage.racket.all
  if (cov.total >= 10 && cov.share != null && cov.share < 0.6) {
    out.push(insight({
      id: 'copertura-setup', target: 'copertura-setup', tone: 'neutral', icon: 'ℹ️',
      effect: 0.6 - cov.share, n: cov.total, weight: 0.3,
      text: cov.n === 0
        ? `Nessuna delle tue ${cov.total} sessioni dichiara la racchetta: senza, il confronto tra setup e la vita delle corde restano chiusi.`
        : `Solo ${cov.n} ${cov.n === 1 ? 'sessione' : 'sessioni'} su ${cov.total} ${cov.n === 1 ? 'dichiara' : 'dichiarano'} la racchetta: tutta la sezione Setup descrive quelle.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Formattazione condivisa ────────────────────────────────

// "58% ± 8" — il margine è parte del numero, non una nota: senza, il 58% si
// legge come una misura invece che come una stima.
export function formatRateWithMoe(rate, moe) {
  if (rate == null) return '—'
  const base = `${Math.round(rate * 100)}%`
  if (moe == null) return base
  return `${base} ± ${Math.round(moe * 100)}`
}

export function formatGamesShort(games) {
  const n = Math.round(games || 0)
  return n >= 1000 ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k` : String(n)
}

export function formatKm(km) {
  if (km == null) return '—'
  return km.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatDays(days) {
  if (days == null) return '—'
  if (days < 60) return `${days} ${days === 1 ? 'giorno' : 'giorni'}`
  const months = days / 30.4
  return `${months.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi`
}

export function formatMountDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })
}
