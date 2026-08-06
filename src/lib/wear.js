// ── Quantificazione dell'usura dell'attrezzatura ────────────
// Modulo puro (nessun React, nessun Firestore) che CHIUDE IL CERCHIO tra le
// partite giocate (`useMatches`) e l'attrezzatura (`useEquipment`): i materiali
// di consumo — corde della racchetta e suola delle scarpe — non si consumano col
// tempo che passa, ma col gioco reale. Qui traduciamo le partite in una stima di
// usura leggibile (livello + percentuale) da mostrare in Equipment.
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

import { MATCH_FORMATS, setKind } from './tennis'

// ── Budget di vita (costanti tarabili) ──────────────────────
// Corde: due assi indipendenti, vince il più consumato.
//   - GIOCO: ~200 game ≈ ~20 ore di gioco a ~10 game/ora. In linea col fatto che
//     il poliestere perde resa dopo ~15-25 ore. Per chi gioca ~2 match/settimana
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

// Un super tie-break (set decisivo Amatoriale) non ha game: lo contiamo come un
// equivalente fisso di ~2 game (durata di un mini-set a 10 punti).
export const SUPER_TB_GAME_EQUIV = 2

// Oltre queste soglie di rapporto un capo passa di livello.
const MEDIUM_AT = 0.66
const HIGH_AT   = 1.0

// Soglia oltre cui un outfit viene segnalato come "molto usato" (solo conteggio).
export const OUTFIT_MATCH_LIMIT = 50

// ── Helpers puri ────────────────────────────────────────────

// Game giocati in un match, sommando i game di ogni set. Per il super tie-break
// (riconosciuto dal formato) si usa l'equivalente fisso. Se il match è legacy e
// non ha `format`, si sommano i punteggi grezzi (approssimazione accettabile).
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

// ── Usura corde (racchetta) ─────────────────────────────────
// Conta solo i match giocati CON questa racchetta e DOPO l'ultimo montaggio
// corde (`strings.mountedAt`): reincordare azzera il consumo di gioco. L'usura è
// il massimo tra l'asse gioco (game/budget) e l'asse tempo (giorni/budget).
function stringWear(item, matches) {
  const mountedAt   = item.strings?.mountedAt || item.stringDate || null
  const mountedTime = mountedAt ? new Date(mountedAt).getTime() : null

  const relevant = (matches || []).filter(m =>
    m.equipment?.racchetta === item.id &&
    (mountedTime == null || new Date(m.date).getTime() >= mountedTime)
  )
  const games      = relevant.reduce((sum, m) => sum + gamesInMatch(m), 0)
  const matchCount = relevant.length

  // Senza data di montaggio e senza partite non c'è nulla da dire
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
  const playPart = `${matchCount} ${matchCount === 1 ? 'partita' : 'partite'} · ${games} game`
  const agePart  = days != null ? `montate ${days} ${days === 1 ? 'giorno' : 'giorni'} fa` : 'data di montaggio ignota'
  const sub = driver === 'play'
    ? `${playPart} — ${agePart}`
    : `${agePart} — ${playPart}`

  return {
    kind: 'strings', level, ratio, percent, games, matchCount, days, driver,
    shortLabel: `${percent}%`, label, sub,
  }
}

// ── Usura suola (scarpa) ────────────────────────────────────
// Somma i game di ogni match giocato con questa scarpa, PESATI per la superficie
// di quel match. Nessun asse temporale: la suola si consuma col gioco.
function shoeWear(item, matches) {
  const relevant = (matches || []).filter(m => m.equipment?.scarpa === item.id)
  if (relevant.length === 0) return null

  let rawGames = 0, effGames = 0
  relevant.forEach(m => {
    const g = gamesInMatch(m)
    rawGames += g
    effGames += g * surfaceFactor(m.surface)
  })

  const matchCount = relevant.length
  const ratio      = effGames / SHOE_LIFE_GAMES
  const level      = levelFor(ratio)
  const percent    = Math.round(ratio * 100)

  const label = {
    ok:     'Suola in buono stato',
    medium: 'Suola in usura',
    high:   'Suola consumata',
  }[level]

  const sub = `${matchCount} ${matchCount === 1 ? 'partita' : 'partite'} · ${rawGames} game (pesati per superficie)`

  return {
    kind: 'shoes', level, ratio, percent, games: Math.round(effGames), rawGames,
    matchCount, shortLabel: `${percent}%`, label, sub,
  }
}

// ── Usura outfit (solo conteggio partite) ───────────────────
function outfitWear(item, matches) {
  const matchCount = (matches || []).filter(m => m.equipment?.outfit === item.id).length
  if (matchCount === 0) return null
  const level = matchCount > OUTFIT_MATCH_LIMIT ? 'medium' : 'ok'
  return {
    kind: 'outfit', level, matchCount, percent: null,
    shortLabel: `${matchCount} match`,
    label: `${matchCount} ${matchCount === 1 ? 'partita giocata' : 'partite giocate'}`,
    sub: null,
  }
}

// Dispatcher: dato un capo e la lista completa dei match, ne calcola l'usura.
// Ritorna null per i tipi senza usura tracciata (borsone) o senza dati.
export function computeWear(item, matches) {
  if (!item) return null
  if (item.type === 'racchetta') return stringWear(item, matches)
  if (item.type === 'scarpa')    return shoeWear(item, matches)
  if (item.type === 'outfit')    return outfitWear(item, matches)
  return null
}
