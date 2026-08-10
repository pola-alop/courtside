// ── Quantificazione dell'usura dell'attrezzatura ────────────
// Modulo puro (nessun React, nessun Firestore) che CHIUDE IL CERCHIO tra il
// gioco reale (`useMatches` + `useTrainings`) e l'attrezzatura (`useEquipment`):
// i materiali di consumo — corde della racchetta e suola delle scarpe — non si
// consumano col tempo che passa, ma col gioco. Qui traduciamo partite e
// allenamenti in una stima di usura leggibile (livello + percentuale).
//
// Unità di misura scelta: il GAME.
//   - Il "match" è troppo grezzo: un 6-0 6-0 (12 game) e un 7-6 6-7 7-6 (~39
//     game) usurano in modo molto diverso, ma conterebbero uguale.
//   - Il "set" è grezzo a sua volta (un 7-6 = 13 game, un 6-0 = 6).
//   - Il "punto" non è memorizzato (salviamo solo i punti dei tie-break).
//   Il game è quindi il quanto più fine e affidabile che abbiamo, ed è un buon
//   proxy fisico sia dell'impatto pallina→corde (notching, perdita di tensione)
//   sia del tempo/attrito sul campo per la suola.
//
// L'usura è espressa come RAPPORTO (0..∞) tra il consumo accumulato e un
// "budget di vita" di riferimento. ratio ≥ 1 = oltre la vita consigliata.
//
// ── Perché gli allenamenti hanno DUE assi separati ──────────
// In partita usura corde e usura suola sono correlate (più game = più colpi E
// più movimento), quindi un'unica unità basta. In allenamento la correlazione
// si rompe: un secchiello di servizi consuma le corde e non la suola, una
// sessione di footwork fa l'esatto contrario. Per questo un allenamento non
// produce "N game equivalenti" ma DUE numeri distinti (corde / suola), che poi
// si sommano ai game reali delle partite sul budget corrispondente.
//
// Il fattore di conversione parte da un'osservazione sulla densità di colpi:
// un'ora di partita contiene ~10 game ≈ 65 punti ≈ ~160 contatti palla per
// giocatore, mentre un'ora di cesto col maestro ne produce 500-600. È il motivo
// per cui in allenamento le corde muoiono molto più in fretta che in partita, a
// parità di ore. Le tariffe qui sotto traducono questa densità in game/ora.

// `gamesInMatch` (e il suo equivalente per il super tie-break) vivono in
// tennis.js: contare i game è scoring, non usura. Qui restano solo i budget e
// le tariffe, che sono la parte davvero "di dominio usura".
import { gamesInMatch } from './tennis'

// ── Budget di vita (costanti tarabili) ──────────────────────
// Corde: due assi indipendenti, vince il più consumato.
//   - GIOCO: ~200 game ≈ ~20 ore di partita a ~10 game/ora. In linea col fatto
//     che il poliestere perde resa dopo ~15-25 ore. Per chi gioca ~2 match/sett
//     (~40 game/sett) sono ~5 settimane → coerente con "reincorda ~1 volta al
//     mese se giochi un paio di volte a settimana".
//   - TEMPO: ~90 giorni, perché le corde perdono tensione anche ferme nel telaio.
export const STRING_LIFE_GAMES = 200
export const STRING_LIFE_DAYS  = 90

// Scarpe: solo gioco (la suola si consuma con l'attrito, non stando nell'armadio),
// ma i game vengono PESATI per superficie perché il cemento distrugge le suole
// molto più della terra/erba. 800 game su superficie neutra ≈ ~5 mesi a ~40
// game/sett; sul cemento (×1.4) scende a ~3.5 mesi → coerente con la realtà.
export const SHOE_LIFE_GAMES = 800

// Fattore di abrasività per superficie (moltiplica i game "reali" in game "pesati")
export const SURFACE_WEAR = {
  cemento: 1.4,  // hard: la superficie più abrasiva
  terra:   0.9,  // clay: dolce con la suola
  erba:    0.8,  // grass: la più dolce
  indoor:  1.0,  // riferimento neutro
}

// ── Tariffe di usura degli allenamenti ──────────────────────
// Game-equivalenti prodotti da UN'ORA di ciascun tipo di blocco, per asse.
// Il riferimento è il match di allenamento (10/10): per definizione consuma
// come una partita vera, dato che è una partita. Tutto il resto si legge in
// rapporto a quello.
//
// ATTENZIONE: le chiavi devono restare allineate agli id di TRAINING_KINDS in
// src/lib/training.js. Un tipo senza tariffa qui semplicemente non produce
// usura (non rompe nulla, ma il dato si perde).
//
// Note sulla taratura:
//   - `macchina` ha la densità di colpi più alta in assoluto (nessun tempo
//     morto tra una palla e l'altra) ma un movimento contenuto.
//   - `servizio` è l'asimmetria più estrema: impatto altissimo sulle corde,
//     si sta praticamente fermi.
//   - `gruppo` è basso su entrambi gli assi perché si aspetta il proprio turno.
//   - `atletica` sta SOPRA la partita sulla suola: è movimento continuo, senza
//     le pause tra i punti e i cambi campo.
// Sono volutamente aggressive: dopo qualche settimana d'uso reale, confronta la
// percentuale mostrata dall'app con la sensazione in campo e ritarale.
export const TRAINING_WEAR_RATES = {
  lezione:   { strings: 28, shoes: 12 },
  sparring:  { strings: 22, shoes: 14 },
  gruppo:    { strings: 12, shoes:  7 },
  servizio:  { strings: 26, shoes:  3 },
  macchina:  { strings: 32, shoes: 10 },
  matchplay: { strings: 10, shoes: 10 },
  atletica:  { strings:  0, shoes: 16 },
}

// Moltiplicatore di intensità percepita, applicato a entrambi gli assi.
export const TRAINING_INTENSITY_FACTOR = {
  leggera: 0.8,
  media:   1.0,
  intensa: 1.25,
}

// Oltre queste soglie di rapporto un capo passa di livello.
const MEDIUM_AT = 0.66
const HIGH_AT   = 1.0

// Soglia oltre cui un outfit viene segnalato come "molto usato" (solo conteggio).
export const OUTFIT_MATCH_LIMIT = 50

// ── Helpers puri ────────────────────────────────────────────

// Game-equivalenti prodotti da una sessione di allenamento, per asse.
// I game "suola" NON sono ancora pesati per superficie: lo fa `shoeWear`, così
// la pesatura resta in un punto solo (come per i match).
export function trainingGameEquivalents(training) {
  const factor = TRAINING_INTENSITY_FACTOR[training?.intensity] ?? 1
  let strings = 0
  let shoes = 0
  ;(training?.blocks || []).forEach(b => {
    const rate = TRAINING_WEAR_RATES[b?.kind]
    if (!rate) return
    const hours = (Number(b?.minutes) || 0) / 60
    strings += hours * rate.strings * factor
    shoes   += hours * rate.shoes   * factor
  })
  return { strings, shoes }
}

export function surfaceFactor(surface) {
  return SURFACE_WEAR[surface] ?? 1
}

function levelFor(ratio) {
  if (ratio >= HIGH_AT)   return 'high'
  if (ratio >= MEDIUM_AT) return 'medium'
  return 'ok'
}

// Meta di presentazione condivisa da card e modale, così i colori/le icone
// dell'usura vivono in un unico posto (come RESULT_META in tennis.js).
export function wearLevelMeta(level) {
  return {
    ok:     { emoji: '✅', icon: '✓', badgeBg: 'rgba(72,179,176,0.2)', boxBg: 'rgba(72,179,176,0.12)', color: 'var(--color-teal-light)',  bar: 'var(--color-teal-dark)' },
    medium: { emoji: '⚠️', icon: '⚠', badgeBg: 'rgba(244,163,0,0.2)',  boxBg: 'rgba(244,163,0,0.12)',  color: 'var(--color-amber-light)', bar: 'var(--color-amber)'     },
    high:   { emoji: '🔴', icon: '●', badgeBg: 'rgba(220,80,80,0.2)',  boxBg: 'rgba(220,80,80,0.12)',  color: '#ff7070',                  bar: '#ff7070'                },
  }[level]
}

// "3 partite · 7 allenamenti · 412 game-eq". L'unità diventa "game-eq" solo
// quando gli allenamenti contribuiscono davvero: per chi registra solo partite
// il conteggio è di game reali, e chiamarli "equivalenti" sarebbe fuorviante.
function sessionsPart(matchCount, trainingCount, games, suffix = '') {
  const parts = []
  if (matchCount > 0)    parts.push(`${matchCount} ${matchCount === 1 ? 'partita' : 'partite'}`)
  if (trainingCount > 0) parts.push(`${trainingCount} ${trainingCount === 1 ? 'allenamento' : 'allenamenti'}`)
  if (parts.length === 0) parts.push('nessuna sessione')
  const unit = trainingCount > 0 ? 'game-eq' : 'game'
  return `${parts.join(' · ')} · ${Math.round(games)} ${unit}${suffix}`
}

// ── Usura corde (racchetta) ─────────────────────────────────
// Conta solo le sessioni giocate CON questa racchetta e DOPO l'ultimo montaggio
// corde (`strings.mountedAt`): reincordare azzera il consumo di gioco — vale
// tanto per le partite quanto per gli allenamenti. L'usura è il massimo tra
// l'asse gioco (game/budget) e l'asse tempo (giorni/budget).
function stringWear(item, matches, trainings) {
  const mountedAt   = item.strings?.mountedAt || item.stringDate || null
  const mountedTime = mountedAt ? new Date(mountedAt).getTime() : null

  const afterMount = (dateStr) =>
    mountedTime == null || new Date(dateStr).getTime() >= mountedTime

  const relevantMatches = (matches || []).filter(m =>
    m.equipment?.racchetta === item.id && afterMount(m.date)
  )
  const relevantTrainings = (trainings || []).filter(t =>
    t.equipment?.racchetta === item.id && afterMount(t.date)
  )

  const matchGames    = relevantMatches.reduce((sum, m) => sum + gamesInMatch(m), 0)
  const trainingGames = relevantTrainings.reduce((sum, t) => sum + trainingGameEquivalents(t).strings, 0)
  const games         = matchGames + trainingGames

  const matchCount    = relevantMatches.length
  const trainingCount = relevantTrainings.length

  // Senza data di montaggio e senza gioco non c'è nulla da dire
  if (mountedTime == null && games === 0) return null

  const days      = mountedTime != null ? Math.floor((Date.now() - mountedTime) / 86400000) : null
  const playRatio = games / STRING_LIFE_GAMES
  const ageRatio  = days != null ? days / STRING_LIFE_DAYS : 0
  const ratio     = Math.max(playRatio, ageRatio)
  const driver    = playRatio >= ageRatio ? 'play' : 'age'
  const level     = levelFor(ratio)
  const percent   = Math.round(ratio * 100)

  const label = {
    ok:     'Corde in buone condizioni',
    medium: 'Corde usate',
    high:   'Considera il cambio corde',
  }[level]

  // Sub: sempre i due assi, evidenziando quale sta "spingendo" l'usura
  const playPart = sessionsPart(matchCount, trainingCount, games)
  const agePart  = days != null ? `montate ${days} ${days === 1 ? 'giorno' : 'giorni'} fa` : 'data di montaggio ignota'
  const sub = driver === 'play'
    ? `${playPart} — ${agePart}`
    : `${agePart} — ${playPart}`

  return {
    kind: 'strings', level, ratio, percent, games: Math.round(games),
    matchCount, trainingCount, days, driver,
    shortLabel: `${percent}%`, label, sub,
  }
}

// ── Usura suola (scarpa) ────────────────────────────────────
// Somma i game di ogni sessione giocata con questa scarpa, PESATI per la
// superficie di quella sessione. Nessun asse temporale: la suola si consuma col
// gioco. Gli allenamenti contribuiscono con il proprio asse "shoes", che per
// l'atletica è più alto di una partita e per il secchiello di servizi quasi nullo.
function shoeWear(item, matches, trainings) {
  const relevantMatches   = (matches || []).filter(m => m.equipment?.scarpa === item.id)
  const relevantTrainings = (trainings || []).filter(t => t.equipment?.scarpa === item.id)
  if (relevantMatches.length === 0 && relevantTrainings.length === 0) return null

  let rawGames = 0, effGames = 0
  relevantMatches.forEach(m => {
    const g = gamesInMatch(m)
    rawGames += g
    effGames += g * surfaceFactor(m.surface)
  })
  relevantTrainings.forEach(t => {
    const g = trainingGameEquivalents(t).shoes
    rawGames += g
    effGames += g * surfaceFactor(t.surface)
  })

  const matchCount    = relevantMatches.length
  const trainingCount = relevantTrainings.length
  const ratio         = effGames / SHOE_LIFE_GAMES
  const level         = levelFor(ratio)
  const percent       = Math.round(ratio * 100)

  const label = {
    ok:     'Suola in buono stato',
    medium: 'Suola in usura',
    high:   'Suola consumata',
  }[level]

  const sub = sessionsPart(matchCount, trainingCount, rawGames, ' (pesati per superficie)')

  return {
    kind: 'shoes', level, ratio, percent, games: Math.round(effGames), rawGames: Math.round(rawGames),
    matchCount, trainingCount, shortLabel: `${percent}%`, label, sub,
  }
}

// ── Usura outfit (solo conteggio sessioni) ──────────────────
function outfitWear(item, matches, trainings) {
  const matchCount    = (matches || []).filter(m => m.equipment?.outfit === item.id).length
  const trainingCount = (trainings || []).filter(t => t.equipment?.outfit === item.id).length
  const total = matchCount + trainingCount
  if (total === 0) return null

  const level = total > OUTFIT_MATCH_LIMIT ? 'medium' : 'ok'
  return {
    kind: 'outfit', level, matchCount, trainingCount, percent: null,
    shortLabel: `${total} uscite`,
    label: `${total} ${total === 1 ? 'uscita' : 'uscite'}`,
    sub: trainingCount > 0
      ? `${matchCount} ${matchCount === 1 ? 'partita' : 'partite'} · ${trainingCount} ${trainingCount === 1 ? 'allenamento' : 'allenamenti'}`
      : null,
  }
}

// Dispatcher: dato un capo, la lista completa dei match e quella degli
// allenamenti, ne calcola l'usura. Ritorna null per i tipi senza usura
// tracciata (borsone) o senza dati.
export function computeWear(item, matches, trainings) {
  if (!item) return null
  if (item.type === 'racchetta') return stringWear(item, matches, trainings)
  if (item.type === 'scarpa')    return shoeWear(item, matches, trainings)
  if (item.type === 'outfit')    return outfitWear(item, matches, trainings)
  return null
}

// ── Sessioni collegate (guard per l'eliminazione) ───────────
// Conta le sessioni — partite E allenamenti — che citano questo capo (qualunque
// tipo, incluso il borsone, che non ha una funzione di usura dedicata).
// Un'attrezzatura con sessioni collegate non può essere eliminata — solo
// archiviata — perché servirà alle statistiche future. Includere anche gli
// allenamenti è essenziale: una racchetta usata SOLO in allenamento risulterebbe
// altrimenti eliminabile, perdendo tutto lo storico di usura.
export function linkedSessionsCount(item, matches, trainings) {
  if (!item) return 0
  const inMatches   = (matches   || []).filter(m => m.equipment?.[item.type] === item.id).length
  const inTrainings = (trainings || []).filter(t => t.equipment?.[item.type] === item.id).length
  return inMatches + inTrainings
}
