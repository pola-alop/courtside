// Modulo puro di src/lib/ (nessun React/Firestore, nessun import: si carica
// anche da Node per i collaudi). Tutto ciò che riguarda la DISCIPLINA di una
// partita: singolo o doppio.
//
// Sul documento `discipline` vale 'singolo' | 'doppio'; **assente = singolo**
// (le partite registrate prima della 2.2.0 non si migrano). Il singolo porta
// `opponentId` come sempre. Il doppio porta `partnerId` e `opponentIds: [a, b]`
// e ha **`opponentId: null`**: chi legge `opponentId` (H2H, rotazione dei
// gruppi, split per mano/livello/stile, classifica degli avversari) lascia fuori
// i doppi senza una riga di codice, e non attribuisce a un avversario solo
// l'esito di una partita in coppia. I quattro giocatori vengono tutti
// dall'anagrafica (il tab «Avversari» è di fatto l'anagrafica dei giocatori).
//
// Il nome da mostrare per il doppio, «Rossi / Bianchi», è `opponentName`
// salvato come per il singolo e riallineato da `syncOpponentNames`; compagno,
// forma breve e categoria si derivano in memoria e non si salvano.

export const DISCIPLINES = [
  { id: 'singolo', label: 'Singolo' },
  { id: 'doppio',  label: 'Doppio'  },
]

export const NAME_SEPARATOR = ' / '

// Gli avversari di un doppio sono sempre due.
export const DOUBLES_OPPONENTS = 2

export const isDoubles = match => match?.discipline === 'doppio'

export const matchDiscipline = match => (isDoubles(match) ? 'doppio' : 'singolo')

// Id valido = stringa non vuota; il resto (null, undefined, '') non è un giocatore.
const validId = id => (typeof id === 'string' && id ? id : null)

// Gli avversari affrontati: quello del singolo, i due del doppio.
export function facedIds(match) {
  if (isDoubles(match)) return (Array.isArray(match.opponentIds) ? match.opponentIds : []).map(validId).filter(Boolean)
  const id = validId(match?.opponentId)
  return id ? [id] : []
}

// Tutti gli altri giocatori della partita: gli avversari, più il compagno nel doppio.
export function playerIds(match) {
  if (!isDoubles(match)) return facedIds(match)
  const partner = validId(match.partnerId)
  return partner ? [partner, ...facedIds(match)] : facedIds(match)
}

// Il giocatore è coinvolto in qualsiasi ruolo (avversario o compagno): serve al
// guard di eliminazione, che non deve lasciare orfano nessun riferimento.
export const involvesPlayer = (match, id) => Boolean(id) && playerIds(match).includes(id)

// Il giocatore è stato affrontato (avversario, nel singolo o nel doppio).
export const facedPlayer = (match, id) => Boolean(id) && facedIds(match).includes(id)

// Il giocatore è stato compagno di doppio.
export const wasPartner = (match, id) => Boolean(id) && isDoubles(match) && validId(match.partnerId) === id

export const joinNames = names => names.filter(Boolean).join(NAME_SEPARATOR)

// Il `opponentName` che la partita dovrebbe avere secondo l'anagrafica, oppure
// null se non si può stabilire (un id che l'anagrafica non conosce più: la
// partita resta com'era, come per il singolo). `nameById` è una Map id → nome.
export function expectedOpponentName(match, nameById) {
  const ids = facedIds(match)
  if (ids.length === 0) return null
  if (isDoubles(match) && ids.length !== DOUBLES_OPPONENTS) return null
  const names = ids.map(id => nameById.get(id))
  return names.every(Boolean) ? joinNames(names) : null
}

// Motivo per cui i giocatori scelti non vanno bene, oppure null. `partnerId` e
// `opponentIds` possono contenere null (slot vuoti). Quattro persone distinte:
// l'utente più tre dell'anagrafica.
export function playersIssue({ partnerId, opponentIds }) {
  const opps = Array.isArray(opponentIds) ? opponentIds : []
  const slots = [validId(partnerId), ...Array.from({ length: DOUBLES_OPPONENTS }, (_, i) => validId(opps[i]))]
  if (slots.includes(null)) return 'Scegli il compagno e i due avversari.'
  if (new Set(slots).size !== slots.length) return 'Ogni giocatore può comparire una volta sola.'
  return null
}

// I generi dei quattro giocatori nell'ordine che `doublesCategory` si aspetta
// (utente, compagno, due avversari). Un giocatore sconosciuto vale null, quindi
// la categoria non si ricava. `genderById` è una Map id → genere.
export function doublesGenders(match, genderById, userGender) {
  if (!isDoubles(match)) return null
  const opps = Array.isArray(match.opponentIds) ? match.opponentIds : []
  const ids = [match.partnerId, ...Array.from({ length: DOUBLES_OPPONENTS }, (_, i) => opps[i])]
  return [userGender ?? null, ...ids.map(id => genderById.get(id) ?? null)]
}

// Etichetta della partita nelle righe: «Doppio misto», o «Doppio» se la
// categoria non si ricava; null per il singolo.
export function disciplineLabel(match) {
  if (!isDoubles(match)) return null
  const category = { maschile: 'maschile', femminile: 'femminile', misto: 'misto' }[match.category]
  return category ? `Doppio ${category}` : 'Doppio'
}

// ── Record di un giocatore ─────────────────────────────────
// I tre record separati del dettaglio giocatore:
//  · `single`         — i singoli contro di lui (l'H2H di sempre);
//  · `againstDoubles` — i doppi in cui era uno dei due avversari;
//  · `withDoubles`    — i doppi in cui era il compagno (il risultato è della coppia).
// Ogni record porta V/P/S, `n` e l'elenco delle partite, nell'ordine ricevuto.
// Un doppio senza `partnerId`/`opponentIds` validi non entra in nessun record.
function recordOf(list) {
  return {
    wins:   list.filter(m => m.result === 'win').length,
    draws:  list.filter(m => m.result === 'draw').length,
    losses: list.filter(m => m.result === 'loss').length,
    n: list.length,
    matches: list,
  }
}

export function playerRecords(matches, id) {
  const all = Array.isArray(matches) ? matches : []
  return {
    single:         recordOf(all.filter(m => !isDoubles(m) && facedPlayer(m, id))),
    againstDoubles: recordOf(all.filter(m => isDoubles(m) && facedPlayer(m, id))),
    withDoubles:    recordOf(all.filter(m => wasPartner(m, id))),
  }
}
