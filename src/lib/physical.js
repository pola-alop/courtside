// ── Statistiche: fisico ─────────────────────────────────────
// Ottavo modulo puro di src/lib/ (nessun React, nessun Firestore), sulla stessa
// linea di tennis.js / training.js / athletics.js / wear.js / stats.js /
// activity.js / technique.js.
//
// ── La domanda ──
// Rendimento chiede "quanto sono forte", Attività "quanto ci sono stato",
// Tecnica "su cosa sto lavorando". Qui la domanda è "come sto fisicamente, e
// sto migliorando?". La materia prima è UN campo solo — `athletics` — presente
// sia sulle partite sia sugli allenamenti con la stessa identica shape, e per
// questa sezione i due domini sono la stessa cosa: un cuore, una distanza, un
// tempo.
//
// ── Tutto qui è FACOLTATIVO, e questo cambia il modo di scrivere la sezione ──
// I dati atletici si trascrivono a mano dall'orologio: non esiste nessuna
// garanzia che ci siano, e nemmeno che ci siano tutti insieme (una sessione può
// avere la FC media e non la distanza). Da qui due regole che valgono ovunque
// in questo file:
//   1. ogni aggregato porta il PROPRIO `n`, non quello della sezione — la media
//      della FC e quella della distanza nascono quasi sempre da campioni
//      diversi, e un solo "su 14 sessioni" in testa alla pagina sarebbe falso;
//   2. la copertura è un dato di prima classe (`coverage`), dichiarata in testa
//      alla sezione e non in fondo: una media su 3 sessioni su 31 non è una
//      media, è un aneddoto, e chi legge deve saperlo prima di leggere i numeri.
//
// ── La durata degli allenamenti non è quella dell'orologio ──
// Su un match `athletics.durationSec` è trascritto dall'orologio. Su un
// allenamento NON esiste un campo durata nell'editor atletico: viene iniettato
// al salvataggio dalla somma dei blocchi (vedi TrainingAthleticsEditor). Sono
// due misure leggermente diverse — la seconda include le pause che l'orologio
// può aver messo in pausa — e la velocità di un allenamento ne risente verso il
// basso. Il modulo li tratta insieme perché separarli dimezzerebbe due volte un
// campione già piccolo, ma la UI lo dichiara.
//
// ── Qui non si stima MAI la durata ──
// `matchMinutes` in tennis.js stima dai game quando il dato reale manca, ed è
// giusto per Attività (un totale di ore che conta 0 le partite non trascritte
// mentirebbe verso il basso). Qui sarebbe un disastro: la stima è game × 5, e
// le sconfitte hanno più game per costruzione — "le partite che perdi durano di
// più" verrebbe fuori anche da un giocatore che perde sempre 6-4 6-4 in 50
// minuti. In questa sezione si usa solo `athletics.durationSec`, e le sessioni
// che non ce l'hanno restano fuori dal conteggio.

import { gamesInMatch } from './tennis'
import { HR_ZONES, hasAthletics, zonesTotalSec, avgSpeedKmh, trainingEffectLabel } from './athletics'
import { dayTime } from './stats'
import { MONTHS_SHORT } from './activity'

// ── Soglie minime di campione ──────────────────────────────
// Più basse che altrove, e non per distrazione: qui il campione non è "quante
// sessioni hai fatto" ma "quante ne hai trascritte", che è sempre un
// sottoinsieme. Soglie da 12 renderebbero la sezione vuota per un anno intero.
// La contropartita è che la copertura va dichiarata ovunque, e infatti lo è.
export const MIN_PHYSICAL      = 5  // sessioni con almeno un dato atletico, per aprire la sezione
export const MIN_ZONES         = 4  // sessioni con le zone FC, per la distribuzione aggregata
export const MIN_SIDE          = 3  // per lato (partita / allenamento), in ogni confronto tra i due
export const MIN_TE            = 4  // sessioni con training effect
export const MIN_MOVEMENT      = 4  // sessioni con distanza + durata
export const MIN_ECONOMY       = 6  // sessioni con FC media + velocità
export const MIN_ECONOMY_SIDE  = 3  // per metà del periodo, per il confronto prima/dopo
export const MIN_OUTCOME       = 3  // partite per lato (vittorie / sconfitte)

// Colonne massime del trend di movimento: stessa ragione di HEATMAP_MONTHS in
// technique.js — su "Sempre" con tre stagioni le barre diventerebbero 36.
export const TREND_MONTHS = 12

// Correlazione minima tra velocità e FC perché la correzione dell'economia
// cardiaca abbia senso. Sotto questa soglia la pendenza è rumore, e correggere
// con un coefficiente casuale è peggio che non correggere affatto.
const MIN_ECONOMY_R = 0.35

// Le zone "alte": è lì che si costruisce (o si subisce) la partita. La quota di
// tempo in Z4+Z5 è l'unico numero delle zone che si confronta davvero tra
// partita e allenamento.
const HIGH_ZONES = [3, 4]   // indici 0-based di Z4 e Z5

// ── Sessioni normalizzate ──────────────────────────────────
// Partite e allenamenti portano lo stesso oggetto `athletics`, quindi la
// normalizzazione qui è molto più sottile che in Attività: serve solo ad
// appiattire i campi derivati (velocità, secondi totali nelle zone) una volta
// sola invece che dentro ognuno dei cinque calcoli.
//
// A differenza di `toFocusSessions` in technique.js, qui le sessioni SENZA dato
// NON vengono scartate: sono il denominatore della copertura, che è il primo
// numero che questa sezione mostra. Portano `has: false` e vengono filtrate da
// chi ha bisogno del solo sottoinsieme trascritto.

export function toAthleticSessions(matches = [], trainings = []) {
  const out = []

  matches.forEach(m => {
    const day = dayTime(m.date)
    if (day == null) return
    out.push(normalize({
      id: m.id, kind: 'match', day, date: m.date, athletics: m.athletics,
      result: m.result || null,
      games: gamesInMatch(m),
      surface: m.surface || null,
      label: m.opponentName || 'Partita',
    }))
  })

  trainings.forEach(t => {
    const day = dayTime(t.date)
    if (day == null) return
    out.push(normalize({
      id: t.id, kind: 'training', day, date: t.date, athletics: t.athletics,
      result: null,
      games: null,
      surface: t.surface || null,
      label: 'Allenamento',
    }))
  })

  return out.sort((a, b) => a.day - b.day)
}

function normalize(base) {
  const a = base.athletics || null
  const zonesSec = zonesTotalSec(a?.zones)
  return {
    ...base,
    has: hasAthletics(a),
    hr:     isNum(a?.avgHr) ? a.avgHr : null,
    maxHr:  isNum(a?.maxHr) ? a.maxHr : null,
    km:     isNum(a?.distanceKm) ? a.distanceKm : null,
    // Solo durate positive: uno 0 trascritto per sbaglio farebbe esplodere ogni
    // divisione che segue.
    durationSec: isNum(a?.durationSec) && a.durationSec > 0 ? a.durationSec : null,
    minutes: isNum(a?.durationSec) && a.durationSec > 0 ? a.durationSec / 60 : null,
    speed:  avgSpeedKmh(a),
    te:     isNum(a?.trainingEffect) ? a.trainingEffect : null,
    anTe:   isNum(a?.anaerobicTrainingEffect) ? a.anaerobicTrainingEffect : null,
    zones:  zonesSec > 0 ? a.zones : null,
    zonesSec,
  }
}

// ── Copertura ──────────────────────────────────────────────
// Il blocco che sta in testa alla sezione. Non è una nota a piè di pagina: è
// la chiave di lettura di tutto il resto, e per questo dichiara la copertura
// campo per campo — "14 sessioni su 31" non basta se poi la distanza c'è su 6
// e la FC su 13.

export const COVERAGE_FIELDS = [
  { id: 'duration', label: 'Durata',          pick: s => s.durationSec },
  { id: 'hr',       label: 'FC media',        pick: s => s.hr },
  { id: 'distance', label: 'Distanza',        pick: s => s.km },
  { id: 'zones',    label: 'Zone FC',         pick: s => (s.zonesSec > 0 ? s.zonesSec : null) },
  { id: 'te',       label: 'Training effect', pick: s => s.te },
]

export function coverage(sessions) {
  const side = (list) => {
    const withData = list.filter(s => s.has)
    return {
      total: list.length,
      n: withData.length,
      share: list.length ? withData.length / list.length : null,
    }
  }

  const withData = sessions.filter(s => s.has)

  return {
    ...side(sessions),
    matches:   side(sessions.filter(s => s.kind === 'match')),
    trainings: side(sessions.filter(s => s.kind === 'training')),
    // La copertura per campo si misura sulle sessioni trascritte, non su tutte:
    // dice "quando trascrivi, cosa trascrivi", che è l'informazione azionabile
    // (il campo che manca sempre è quello da aggiungere alla routine).
    fields: COVERAGE_FIELDS.map(f => ({
      id: f.id,
      label: f.label,
      n: withData.filter(s => f.pick(s) != null).length,
      share: withData.length ? withData.filter(s => f.pick(s) != null).length / withData.length : null,
    })),
    withData: withData.length,
  }
}

// ── Zone di frequenza cardiaca ─────────────────────────────
// La somma dei secondi zona per zona su tutto il periodo, non la media delle
// percentuali delle singole sessioni: pesare per il tempo è l'unico modo di non
// far contare un riscaldamento di 20 minuti quanto una partita di due ore.
//
// Il confronto partita vs allenamento è il punto del blocco. Se in partita passi
// il 40% del tempo in Z4-Z5 e in allenamento il 12%, ti stai allenando a
// un'intensità che non prepara a quello che poi fai in campo.

export function zoneMix(sessions) {
  const side = (list) => {
    const secs = HR_ZONES.map(() => 0)
    let n = 0
    list.forEach(s => {
      if (!s.zones) return
      n++
      HR_ZONES.forEach((_, i) => { secs[i] += s.zones[i] || 0 })
    })
    const total = sum(secs, v => v)
    const shares = secs.map(v => (total ? v / total : 0))
    return {
      n, secs, total, shares,
      highShare: total ? sum(HIGH_ZONES.map(i => secs[i]), v => v) / total : null,
      // Zona in cui passi più tempo: è la risposta di una riga alla domanda
      // "che sforzo è, per me, il tennis".
      dominant: total ? shares.indexOf(Math.max(...shares)) : null,
    }
  }

  const all      = side(sessions)
  const match    = side(sessions.filter(s => s.kind === 'match'))
  const training = side(sessions.filter(s => s.kind === 'training'))
  const comparable = match.n >= MIN_SIDE && training.n >= MIN_SIDE

  return {
    all, match, training,
    enough: all.n >= MIN_ZONES,
    missing: Math.max(0, MIN_ZONES - all.n),
    comparable,
    missingMatch:    Math.max(0, MIN_SIDE - match.n),
    missingTraining: Math.max(0, MIN_SIDE - training.n),
    highGap: comparable && match.highShare != null && training.highShare != null
      ? match.highShare - training.highShare
      : null,
  }
}

// ── Profilo di stimolo (training effect) ───────────────────
// Il training effect di Garmin/Firstbeat dice, sulla stessa scala 0-5, quanto
// una sessione ha stimolato il sistema aerobico e quanto quello anaerobico.
// Mediati sul periodo rispondono a una domanda che nessuna app di tennis pone:
// il tennis, PER TE, che allenamento è.
//
// Le due medie hanno campioni diversi di proposito: l'effetto anaerobico è un
// campo separato e capita di trascrivere solo il primo.

export function stimulus(sessions) {
  const side = (list) => {
    const aer = list.filter(s => s.te != null)
    const ana = list.filter(s => s.anTe != null)
    return {
      aerobic:   aer.length ? mean(aer, s => s.te)   : null,
      anaerobic: ana.length ? mean(ana, s => s.anTe) : null,
      aerobicN: aer.length,
      anaerobicN: ana.length,
      n: Math.max(aer.length, ana.length),
    }
  }

  const all      = side(sessions)
  const match    = side(sessions.filter(s => s.kind === 'match'))
  const training = side(sessions.filter(s => s.kind === 'training'))

  return {
    all, match, training,
    enough: all.aerobicN >= MIN_TE,
    missing: Math.max(0, MIN_TE - all.aerobicN),
    aerobicLabel:   trainingEffectLabel(all.aerobic),
    anaerobicLabel: trainingEffectLabel(all.anaerobic),
    // Il rapporto tra i due assi è ciò che definisce il profilo. Serve che
    // entrambi esistano e che l'aerobico non sia zero, altrimenti il rapporto
    // non è definito.
    ratio: all.aerobic > 0 && all.anaerobic != null ? all.anaerobic / all.aerobic : null,
    profile: stimulusProfile(all.aerobic, all.anaerobic),
    comparable: match.aerobicN >= MIN_SIDE && training.aerobicN >= MIN_SIDE,
  }
}

// Tre profili, tarati sul rapporto anaerobico/aerobico. Le soglie non sono
// fisiologiche: sono la scala su cui la frase cambia significato per chi legge.
// Nel tennis amatoriale il caso normale è "aerobico con punte", e vedersi
// classificati diversamente è di per sé l'informazione.
function stimulusProfile(aerobic, anaerobic) {
  if (aerobic == null) return null
  if (anaerobic == null) return { id: 'aerobico', label: 'Solo dato aerobico', hint: 'aerobico' }
  const ratio = aerobic > 0 ? anaerobic / aerobic : 0
  if (ratio >= 0.9) return { id: 'anaerobico', label: 'Prevalentemente anaerobico', hint: 'scatti e cambi di direzione' }
  if (ratio >= 0.4) return { id: 'misto',      label: 'Misto',                     hint: 'fondo con punte intense' }
  return { id: 'aerobico', label: 'Prevalentemente aerobico', hint: 'lavoro continuo di fondo' }
}

// ── Movimento ──────────────────────────────────────────────
// Quanto ti muovi, e a che ritmo. `kmPerHour` è calcolato sui TOTALI (km totali
// / ore totali) e non come media delle velocità delle singole sessioni: la
// seconda darebbe lo stesso peso a un'ora di partita e a venti minuti di
// riscaldamento.

export function movement(sessions) {
  const side = (list) => {
    const ok = list.filter(s => s.km != null && s.durationSec != null)
    const km = sum(ok, s => s.km)
    const hours = sum(ok, s => s.durationSec) / 3600
    return {
      n: ok.length,
      km, hours,
      kmPerHour: hours > 0 ? km / hours : null,
      kmPerSession: ok.length ? km / ok.length : null,
      minutesPerSession: ok.length ? sum(ok, s => s.minutes) / ok.length : null,
      sessions: ok,
    }
  }

  const all      = side(sessions)
  const match    = side(sessions.filter(s => s.kind === 'match'))
  const training = side(sessions.filter(s => s.kind === 'training'))

  return {
    all, match, training,
    enough: all.n >= MIN_MOVEMENT,
    missing: Math.max(0, MIN_MOVEMENT - all.n),
    comparable: match.n >= MIN_SIDE && training.n >= MIN_SIDE,
    trend: monthTrend(all.sessions),
  }
}

// Serie mensile della velocità: km e ore si sommano dentro il mese e la
// velocità si ricalcola sul totale, di nuovo per non pesare uguale sessioni di
// durata diversa. I mesi senza sessioni compaiono come buchi (n: 0) invece di
// sparire: una serie che salta da marzo a settembre senza dirlo suggerirebbe
// una continuità che non c'è.
function monthTrend(sessions) {
  if (!sessions.length) return { months: [], avg: null, truncated: false, hiddenMonths: 0 }

  const byMonth = new Map()
  sessions.forEach(s => {
    const d = new Date(s.day)
    const key = d.getFullYear() * 12 + d.getMonth()
    if (!byMonth.has(key)) byMonth.set(key, { key, year: d.getFullYear(), month: d.getMonth(), km: 0, sec: 0, n: 0 })
    const cell = byMonth.get(key)
    cell.km += s.km
    cell.sec += s.durationSec
    cell.n++
  })

  const keys = [...byMonth.keys()].sort((a, b) => a - b)
  const first = keys[0], last = keys[keys.length - 1]

  const full = []
  for (let k = first; k <= last; k++) {
    const cell = byMonth.get(k)
    full.push(cell
      ? { ...cell, label: MONTHS_SHORT[cell.month], kmPerHour: cell.sec > 0 ? cell.km / (cell.sec / 3600) : null }
      : { key: k, year: Math.floor(k / 12), month: k % 12, km: 0, sec: 0, n: 0, label: MONTHS_SHORT[k % 12], kmPerHour: null })
  }

  const months = full.slice(-TREND_MONTHS)
  const km = sum(months, m => m.km)
  const sec = sum(months, m => m.sec)

  return {
    months,
    // La media di riferimento è quella dei mesi mostrati, non di tutto lo
    // storico: la linea deve essere confrontabile con le barre che le stanno
    // accanto, altrimenti indica un valore che nel grafico non esiste.
    avg: sec > 0 ? km / (sec / 3600) : null,
    truncated: full.length > months.length,
    hiddenMonths: full.length - months.length,
  }
}

// ── Economia cardiaca ──────────────────────────────────────
// La metrica di fitness vera di questa sezione, e l'unica che vede il
// miglioramento MESI prima che si veda nei risultati: la FC media a parità di
// velocità. Coprire la stessa distanza allo stesso ritmo con 8 battiti in meno
// significa che il motore è migliorato, e non c'è nessun altro numero
// nell'app che possa dirlo.
//
// ── Perché serve una correzione, e come funziona ──
// Confrontare le FC medie grezze di due periodi non dice niente: se nel secondo
// hai giocato partite più tirate, ti sei mosso di più e la FC sale per forza.
// Bisogna togliere l'effetto della velocità. Il modo più semplice che regge su
// dieci sessioni è una retta di regressione FC ~ velocità: la pendenza `beta`
// dice di quanti battiti sale la FC per ogni km/h in più, e con quella si
// riporta ogni sessione a una velocità comune (la media del periodo).
//
//   adjusted = FC − beta × (velocità − velocità media)
//
// ── Quando la correzione NON si applica ──
// Su un campione piccolo la pendenza può venire negativa (fisiologicamente
// assurda) o del tutto scollegata dai dati. Correggere con un coefficiente
// casuale è peggio che non correggere: se la pendenza non è positiva o la
// correlazione è sotto MIN_ECONOMY_R si lascia la FC grezza e si alza il flag
// `corrected: false`, che la UI deve dichiarare. Non è un fallimento — se le
// tue sessioni hanno tutte più o meno la stessa velocità, confrontare le FC
// grezze È già un confronto a parità di velocità.

export function cardiacEconomy(sessions) {
  const ok = sessions.filter(s => s.hr != null && s.speed != null && s.speed > 0)
  const n = ok.length

  if (n < MIN_ECONOMY) {
    return { available: false, reason: 'sample', n, missing: MIN_ECONOMY - n }
  }

  const speeds = ok.map(s => s.speed)
  const hrs    = ok.map(s => s.hr)
  const meanSpeed = avg(speeds)
  const meanHr    = avg(hrs)
  const varSpeed  = avg(speeds.map(v => (v - meanSpeed) ** 2))
  const sdSpeed   = Math.sqrt(varSpeed)
  const sdHr      = Math.sqrt(avg(hrs.map(v => (v - meanHr) ** 2)))
  const cov       = avg(ok.map(s => (s.speed - meanSpeed) * (s.hr - meanHr)))

  const beta = varSpeed > 0 ? cov / varSpeed : 0
  const r    = sdSpeed > 0 && sdHr > 0 ? cov / (sdSpeed * sdHr) : null
  const corrected = beta > 0 && r != null && r >= MIN_ECONOMY_R
  const b = corrected ? beta : 0

  const points = ok.map(s => ({
    id: s.id, kind: s.kind, day: s.day, label: s.label,
    hr: s.hr, speed: s.speed, km: s.km, minutes: s.minutes,
    adjusted: s.hr - b * (s.speed - meanSpeed),
    // Costo cardiaco descrittivo: quanti battiti ti è costato un chilometro.
    // Non è la metrica di fitness (è confuso dalla velocità quanto la FC
    // grezza), ma è l'unica lettura del blocco che non passa da un modello.
    beatsPerKm: s.km > 0 && s.minutes != null ? (s.hr * s.minutes) / s.km : null,
  }))

  // Due metà cronologiche. Con un numero dispari di sessioni quella centrale
  // resta fuori invece di essere assegnata arbitrariamente a una delle due: su
  // dieci sessioni una sola spostata da una parte cambia la media di un battito.
  const half = Math.floor(n / 2)
  const first  = points.slice(0, half)
  const second = points.slice(n - half)
  const enoughSides = half >= MIN_ECONOMY_SIDE

  const firstHr  = enoughSides ? avg(first.map(p => p.adjusted))  : null
  const secondHr = enoughSides ? avg(second.map(p => p.adjusted)) : null

  return {
    available: true,
    n, points, corrected, beta, r, refSpeed: meanSpeed, meanHr,
    matchN:    ok.filter(s => s.kind === 'match').length,
    trainingN: ok.filter(s => s.kind === 'training').length,
    speedRange: { min: Math.min(...speeds), max: Math.max(...speeds) },
    halves: enoughSides ? {
      first:  { n: first.length,  hr: firstHr,  speed: avg(first.map(p => p.speed)),  from: first[0].day,  to: first[first.length - 1].day },
      second: { n: second.length, hr: secondHr, speed: avg(second.map(p => p.speed)), from: second[0].day, to: second[second.length - 1].day },
      // Negativo = FC più bassa nella seconda metà = economia migliorata.
      delta: secondHr - firstHr,
      dropped: n % 2 === 1,
    } : null,
    missingSides: Math.max(0, MIN_ECONOMY_SIDE - half),
    beatsPerKm: beatsPerKmOf(points),
  }
}

function beatsPerKmOf(points) {
  const ok = points.filter(p => p.beatsPerKm != null)
  return ok.length ? { n: ok.length, value: avg(ok.map(p => p.beatsPerKm)) } : { n: 0, value: null }
}

// ── Fisico ↔ risultato ─────────────────────────────────────
// Le partite che vinci e quelle che perdi sono fisicamente diverse, e la
// differenza è di solito più grande di quanto chiunque si aspetti. La riga che
// conta è la durata: "le partite che perdi durano in media 22 minuti in più" è
// una frase che cambia come ti prepari, non una curiosità.
//
// ── Perché "minuti per game" sta accanto a "durata" ──
// Una sconfitta dura di più anche solo perché va al terzo set: sono più game,
// non punti più lunghi. Il minuti-per-game separa le due cose. Se cresce anche
// quello, gli scambi sono davvero più lunghi; se resta uguale, la partita è
// semplicemente durata di più.
//
// I pareggi restano fuori: sono match interrotti, e la loro durata è per
// definizione arbitraria.

export const OUTCOME_ROWS = [
  { id: 'durata',   label: 'Durata',           unit: 'min',  digits: 0, pick: s => s.minutes },
  { id: 'game',     label: 'Game giocati',     unit: '',     digits: 1, pick: s => (s.games > 0 ? s.games : null) },
  { id: 'minGame',  label: 'Minuti per game',  unit: 'min',  digits: 1, pick: s => (s.minutes != null && s.games > 0 ? s.minutes / s.games : null) },
  { id: 'km',       label: 'Distanza',         unit: 'km',   digits: 2, pick: s => s.km },
  { id: 'hr',       label: 'FC media',         unit: 'bpm',  digits: 0, pick: s => s.hr },
  { id: 'speed',    label: 'Velocità',         unit: 'km/h', digits: 1, pick: s => s.speed },
]

export function outcomeSplit(sessions) {
  const played = sessions.filter(s => s.kind === 'match' && (s.result === 'win' || s.result === 'loss'))
  const wins   = played.filter(s => s.result === 'win')
  const losses = played.filter(s => s.result === 'loss')

  const rows = OUTCOME_ROWS.map(row => {
    const side = (list) => {
      const ok = list.filter(s => row.pick(s) != null)
      return { n: ok.length, value: ok.length ? avg(ok.map(row.pick)) : null }
    }
    const win  = side(wins)
    const loss = side(losses)
    const enough = win.n >= MIN_OUTCOME && loss.n >= MIN_OUTCOME
    return {
      ...row,
      win, loss, enough,
      // Segno: sempre sconfitte − vittorie, così un delta positivo significa
      // "di più quando perdi" per ogni riga, senza dover ricordare il verso.
      delta: enough ? loss.value - win.value : null,
      share: enough && win.value ? (loss.value - win.value) / win.value : null,
    }
  })

  const ready = rows.filter(r => r.enough)

  return {
    rows,
    ready: ready.length,
    enough: ready.length > 0,
    wins: wins.length,
    losses: losses.length,
    // Il campione più grande disponibile su una riga: serve alla UI per dire su
    // quante partite si sta ragionando senza scegliere una riga a caso.
    maxN: rows.reduce((m, r) => Math.max(m, Math.min(r.win.n, r.loss.n)), 0),
    missingWins:   Math.max(0, MIN_OUTCOME - wins.length),
    missingLosses: Math.max(0, MIN_OUTCOME - losses.length),
  }
}

// ── Report completo ────────────────────────────────────────
// Stesso contratto di buildRendimento / buildActivity / buildTechnique: un solo
// punto d'ingresso che restituisce tutto il necessario alla sezione, insight
// compresi, così il componente fa un solo useMemo.
//
// A differenza di Attività e Tecnica qui NON serve lo storico non filtrato:
// tutto in questa sezione è una proprietà del periodo (com'era il tuo cuore in
// quei mesi), non un fatto del presente. L'unica cosa che assomiglia a un
// "adesso" — il trend dell'economia — è per costruzione un confronto interno al
// periodo scelto, e su una finestra diversa deve dare una risposta diversa.

export function buildPhysical({ matches = [], trainings = [] }) {
  const sessions = toAthleticSessions(matches, trainings)
  const withData = sessions.filter(s => s.has)

  const report = {
    n: withData.length,
    total: sessions.length,
    enough: withData.length >= MIN_PHYSICAL,
    missing: Math.max(0, MIN_PHYSICAL - withData.length),
    sessions,
    withData,
    coverage: coverage(sessions),
    zones:    zoneMix(withData),
    stimulus: stimulus(withData),
    movement: movement(withData),
    economy:  cardiacEconomy(withData),
    outcome:  outcomeSplit(withData),
  }

  report.insights = report.enough ? physicalInsights(report) : []
  return report
}

// ── Insight ────────────────────────────────────────────────
// Stesso motore a regole delle altre tre sezioni: soglia di campione + soglia di
// effetto minimo, frase con dentro i numeri che l'hanno generata, `target` (id
// del blocco) + `tab`.

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const one = v => (v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits: 1 }))

function insight(o) {
  return { ...o, tab: 'fisico', weight: o.weight ?? Math.abs(o.effect) * Math.sqrt(o.n) }
}

export function physicalInsights(r) {
  const out = []

  // Economia cardiaca: la frase più forte della sezione, perché è l'unica che
  // parla di miglioramento vero e non di come hai giocato.
  const h = r.economy.available ? r.economy.halves : null
  if (h && Math.abs(h.delta) >= 3) {
    const better = h.delta < 0
    out.push(insight({
      id: 'economia', target: 'economia', tone: better ? 'good' : 'bad', icon: better ? '❤️‍🔥' : '📛',
      effect: Math.abs(h.delta) / 10, n: r.economy.n, weight: better ? 2.1 : 1.6,
      text: better
        ? `A parità di velocità la tua FC media è scesa di ${Math.round(Math.abs(h.delta))} battiti nella seconda metà del periodo: il motore sta migliorando.`
        : `A parità di velocità la tua FC media è salita di ${Math.round(h.delta)} battiti nella seconda metà del periodo: stessa corsa, più fatica.`,
    }))
  }

  // Durata di vittorie e sconfitte.
  const durata = r.outcome.rows.find(x => x.id === 'durata')
  if (durata?.enough && Math.abs(durata.delta) >= 8) {
    const longer = durata.delta > 0
    out.push(insight({
      id: 'durata-esito', target: 'esito-fisico', tone: 'neutral', icon: '⏱',
      effect: Math.abs(durata.delta) / 60, n: Math.min(durata.win.n, durata.loss.n), weight: 1.3,
      text: longer
        ? `Le partite che perdi durano in media ${Math.round(durata.delta)} minuti in più di quelle che vinci.`
        : `Le partite che perdi durano in media ${Math.round(Math.abs(durata.delta))} minuti in meno di quelle che vinci: quando cede, cede in fretta.`,
    }))
  }

  // FC media nelle vittorie e nelle sconfitte.
  const hrRow = r.outcome.rows.find(x => x.id === 'hr')
  if (hrRow?.enough && Math.abs(hrRow.delta) >= 4) {
    const higher = hrRow.delta > 0
    out.push(insight({
      id: 'hr-esito', target: 'esito-fisico', tone: 'neutral', icon: '❤️',
      effect: Math.abs(hrRow.delta) / 20, n: Math.min(hrRow.win.n, hrRow.loss.n), weight: 0.9,
      text: `Quando perdi il cuore va in media a ${Math.round(hrRow.loss.value)} bpm, quando vinci a ${Math.round(hrRow.win.value)}: ${higher ? 'le sconfitte ti costano di più' : 'le vittorie sono le partite in cui spingi di più'}.`,
    }))
  }

  // Zone: partita contro allenamento. È l'insight che cambia la programmazione.
  const z = r.zones
  if (z.comparable && z.highGap != null && Math.abs(z.highGap) >= 0.15) {
    const harder = z.highGap > 0
    out.push(insight({
      id: 'zone-gap', target: 'zone', tone: harder ? 'bad' : 'neutral', icon: harder ? '🔥' : '🧊',
      effect: Math.abs(z.highGap), n: z.match.n + z.training.n, weight: 1.2,
      text: harder
        ? `In partita stai il ${pct(z.match.highShare)} del tempo in Z4-Z5, in allenamento il ${pct(z.training.highShare)}: ti alleni più piano di come giochi.`
        : `In allenamento stai il ${pct(z.training.highShare)} del tempo in Z4-Z5, in partita il ${pct(z.match.highShare)}: gli allenamenti sono più duri delle partite.`,
    }))
  }

  // Profilo di stimolo: la risposta a "che allenamento è, per me, il tennis".
  const st = r.stimulus
  if (st.enough && st.ratio != null && st.all.anaerobicN >= MIN_TE) {
    if (st.ratio < 0.4) {
      out.push(insight({
        id: 'stimolo', target: 'stimolo', tone: 'neutral', icon: '🫀',
        effect: 0.5 - st.ratio, n: st.all.anaerobicN, weight: 0.8,
        text: `Il tuo tennis è un lavoro aerobico (${one(st.all.aerobic)}) con stimolo anaerobico basso (${one(st.all.anaerobic)}): corri tanto, ma quasi mai al massimo.`,
      }))
    } else if (st.ratio >= 0.9) {
      out.push(insight({
        id: 'stimolo', target: 'stimolo', tone: 'neutral', icon: '⚡️',
        effect: st.ratio - 0.5, n: st.all.anaerobicN, weight: 0.8,
        text: `Il tuo tennis è fatto di scatti: effetto anaerobico ${one(st.all.anaerobic)} contro aerobico ${one(st.all.aerobic)}. È il profilo che chiede più recupero.`,
      }))
    }
  }

  // Copertura: non è un'analisi, è un avvertimento sulla lettura di tutte le
  // altre frasi. Peso basso di proposito — sta in fondo, ma deve esserci.
  const c = r.coverage
  if (c.total >= 10 && c.share != null && c.share < 0.5) {
    out.push(insight({
      id: 'copertura-fisico', target: 'copertura', tone: 'neutral', icon: 'ℹ️',
      effect: 0.5 - c.share, n: c.total, weight: 0.3,
      text: `Solo ${c.n} sessioni su ${c.total} hanno dati atletici: tutta la sezione Fisico descrive quelle.`,
    }))
  }

  return out.sort((a, b) => b.weight - a.weight)
}

// ── Formattazione condivisa ────────────────────────────────

export function formatKm(km, digits = 2) {
  return km == null ? '—' : km.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatKmh(v) {
  return v == null ? '—' : v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatBpm(v) {
  return v == null ? '—' : String(Math.round(v))
}

// Delta con segno esplicito: senza il "+" un +22 e un -22 si distinguono solo
// per un trattino, che a 11px si perde.
export function formatDelta(v, digits = 0) {
  if (v == null) return '—'
  const s = Math.abs(v).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`
}

// "1h 42" per le durate lunghe, "48 min" per le brevi — stessa forma di
// formatDuration in activity.js, ma su minuti decimali invece che interi.
export function formatMinutes(min) {
  if (min == null) return '—'
  const n = Math.round(min)
  if (n < 60) return `${n} min`
  return `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}`
}

export function formatMonthLabel(month) {
  return `${month.label} ${String(month.year).slice(2)}`
}

// ── Helpers ────────────────────────────────────────────────

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function sum(list, pick) {
  return (list || []).reduce((s, x) => s + (pick(x) || 0), 0)
}

function mean(list, pick) {
  return list.length ? sum(list, pick) / list.length : null
}

function avg(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}
